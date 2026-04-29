import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { stockMovementsTable, branchTransfersTable, restaurantsTable } from "@workspace/db/schema";
import { eq, and, gte, lte, like, or, sql } from "drizzle-orm";
import { getRestaurantId } from "../lib/restaurant";

const router: IRouter = Router();

function toNum(v: unknown) {
  return parseFloat(String(v)) || 0;
}

function toMovementRecord(r: typeof stockMovementsTable.$inferSelect) {
  return {
    id: r.id,
    restaurantId: r.restaurantId,
    itemName: r.itemName,
    category: r.category,
    subCategory: r.subCategory ?? undefined,
    unit: r.unit,
    movementType: r.movementType,
    quantity: toNum(r.quantity),
    unitPrice: toNum(r.unitPrice),
    totalValue: toNum(r.totalValue),
    movementDate: r.movementDate,
    referenceType: r.referenceType ?? undefined,
    referenceId: r.referenceId ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: r.createdAt.toISOString(),
  };
}

/** Compute Weighted Average Cost (WAC) for a sequence of movements sorted by date */
function computeWAC(movements: (typeof stockMovementsTable.$inferSelect)[]) {
  // movements must be sorted oldest→newest
  let qty = 0;
  let avgCost = 0;

  for (const m of movements) {
    const mQty = toNum(m.quantity);
    const mPrice = toNum(m.unitPrice);

    switch (m.movementType) {
      case "opening":
        if (mPrice > 0) {
          // Weighted blend with existing stock
          const newTotal = qty * avgCost + mQty * mPrice;
          qty += mQty;
          avgCost = qty > 0 ? newTotal / qty : mPrice;
        } else {
          qty += mQty;
        }
        break;
      case "purchase":
      case "transfer-in": {
        const inPrice = mPrice > 0 ? mPrice : avgCost;
        const newTotal = qty * avgCost + mQty * inPrice;
        qty += mQty;
        avgCost = qty > 0 ? newTotal / qty : inPrice;
        break;
      }
      case "consumption":
      case "transfer-out":
        qty = Math.max(0, qty - mQty);
        // avgCost stays the same on outflow
        break;
      case "adjustment":
        if (mQty > 0) {
          // Treat positive adjustments at current avg cost (or given price)
          const aPrice = mPrice > 0 ? mPrice : avgCost;
          const newTotal = qty * avgCost + mQty * aPrice;
          qty += mQty;
          avgCost = qty > 0 ? newTotal / qty : aPrice;
        } else {
          qty = Math.max(0, qty + mQty); // mQty is negative
        }
        break;
    }
  }

  return { qty: +qty.toFixed(3), avgCost: +avgCost.toFixed(4) };
}

// Aggregate stock items from movements — uses WAC for valuation
async function aggregateStockItems(restaurantId: number, dateFrom?: string, dateTo?: string) {
  let movements = await db.select()
    .from(stockMovementsTable)
    .where(eq(stockMovementsTable.restaurantId, restaurantId));

  // Apply optional date filters AFTER fetching (WAC needs all history before dateFrom for opening stock)
  const allMovements = [...movements].sort((a, b) => a.movementDate.localeCompare(b.movementDate));

  // Group by itemName+category
  const itemKeys = [...new Set(allMovements.map(m => `${m.itemName}:::${m.category}`))];

  const result = [];

  for (const key of itemKeys) {
    const [itemName, category] = key.split(":::");
    const itemMovements = allMovements.filter(m => m.itemName === itemName && m.category === category);
    const latest = itemMovements[itemMovements.length - 1];
    const unit = latest?.unit ?? "unit";
    const subCategory = latest?.subCategory ?? undefined;

    // WAC up to dateFrom (for opening balance when filtering)
    let openingQty = 0;
    let openingAvgCost = 0;
    if (dateFrom) {
      const before = itemMovements.filter(m => m.movementDate < dateFrom);
      const w = computeWAC(before);
      openingQty = w.qty;
      openingAvgCost = w.avgCost;
    }

    // Filter to date range for the period metrics
    const rangeMovements = itemMovements.filter(m =>
      (!dateFrom || m.movementDate >= dateFrom) &&
      (!dateTo || m.movementDate <= dateTo)
    );

    // Running WAC through full history (no date filter) gives current state
    const fullWAC = computeWAC(itemMovements);

    // Period metrics
    let purchasesQuantity = 0, consumptionQuantity = 0;
    let transferInQuantity = 0, transferOutQuantity = 0, adjustmentQuantity = 0;
    let lastMovementDate = itemMovements[0]?.movementDate ?? "";

    for (const m of rangeMovements) {
      const qty = toNum(m.quantity);
      switch (m.movementType) {
        case "purchase": purchasesQuantity += qty; break;
        case "consumption": consumptionQuantity += qty; break;
        case "transfer-in": transferInQuantity += qty; break;
        case "transfer-out": transferOutQuantity += qty; break;
        case "adjustment": adjustmentQuantity += qty; break;
      }
      if (m.movementDate > lastMovementDate) lastMovementDate = m.movementDate;
    }

    result.push({
      itemName,
      category,
      subCategory,
      unit,
      openingQuantity: dateFrom ? openingQty : 0,
      purchasesQuantity: +purchasesQuantity.toFixed(3),
      consumptionQuantity: +consumptionQuantity.toFixed(3),
      transferInQuantity: +transferInQuantity.toFixed(3),
      transferOutQuantity: +transferOutQuantity.toFixed(3),
      adjustmentQuantity: +adjustmentQuantity.toFixed(3),
      currentQuantity: fullWAC.qty,
      avgCost: fullWAC.avgCost,
      currentValue: +(fullWAC.qty * fullWAC.avgCost).toFixed(2),
      lastMovementDate,
    });
  }

  return result.sort((a, b) => a.itemName.localeCompare(b.itemName));
}

// GET /api/stock/items
router.get("/items", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const { category, search, dateFrom, dateTo } = req.query as Record<string, string>;

    let items = await aggregateStockItems(restaurantId, dateFrom, dateTo);

    if (category) items = items.filter(i => i.category === category || i.category.startsWith(category));
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(i => i.itemName.toLowerCase().includes(q));
    }

    res.json(items);
  } catch (err) {
    req.log.error({ err }, "Error listing stock items");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/stock/movements
router.get("/movements", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const { category, movementType, dateFrom, dateTo, search } = req.query as Record<string, string>;

    let movements = await db.select()
      .from(stockMovementsTable)
      .where(eq(stockMovementsTable.restaurantId, restaurantId))
      .orderBy(sql`${stockMovementsTable.movementDate} DESC, ${stockMovementsTable.createdAt} DESC`);

    if (category) movements = movements.filter(m => m.category === category || m.category.startsWith(category));
    if (movementType) movements = movements.filter(m => m.movementType === movementType);
    if (dateFrom) movements = movements.filter(m => m.movementDate >= dateFrom);
    if (dateTo) movements = movements.filter(m => m.movementDate <= dateTo);
    if (search) {
      const q = search.toLowerCase();
      movements = movements.filter(m => m.itemName.toLowerCase().includes(q));
    }

    res.json(movements.map(toMovementRecord));
  } catch (err) {
    req.log.error({ err }, "Error listing stock movements");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/stock/movements (manual: consumption, adjustment, opening balance)
router.post("/movements", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const { itemName, category, subCategory, unit, movementType, quantity, unitPrice, movementDate, notes } = req.body;

    const qty = parseFloat(String(quantity));
    const price = parseFloat(String(unitPrice)) || 0;
    // For consumption and transfer-out, quantity should be stored as negative convention
    // But in our DB we store positive and use movementType to determine direction for display
    // The aggregation logic handles direction by movementType
    const [record] = await db.insert(stockMovementsTable).values({
      restaurantId,
      itemName,
      category,
      subCategory: subCategory || null,
      unit: unit || "unit",
      movementType,
      quantity: String(qty.toFixed(3)),
      unitPrice: String(price.toFixed(2)),
      totalValue: String((qty * price).toFixed(2)),
      movementDate,
      referenceType: "manual",
      notes: notes || null,
    }).returning();

    res.status(201).json(toMovementRecord(record));
  } catch (err) {
    req.log.error({ err }, "Error creating stock movement");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/stock/movements/:id
router.delete("/movements/:id", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const id = parseInt(req.params.id);
    await db.delete(stockMovementsTable).where(
      and(eq(stockMovementsTable.id, id), eq(stockMovementsTable.restaurantId, restaurantId))
    );
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting stock movement");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/stock/transfers
router.get("/transfers", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const { dateFrom, dateTo } = req.query as Record<string, string>;

    const allRestaurants = await db.select().from(restaurantsTable);
    const restaurantMap = new Map(allRestaurants.map(r => [r.id, r.name]));

    let transfers = await db.select().from(branchTransfersTable)
      .where(or(
        eq(branchTransfersTable.fromRestaurantId, restaurantId),
        eq(branchTransfersTable.toRestaurantId, restaurantId)
      ))
      .orderBy(sql`${branchTransfersTable.transferDate} DESC`);

    if (dateFrom) transfers = transfers.filter(t => t.transferDate >= dateFrom);
    if (dateTo) transfers = transfers.filter(t => t.transferDate <= dateTo);

    res.json(transfers.map(t => ({
      id: t.id,
      fromRestaurantId: t.fromRestaurantId,
      toRestaurantId: t.toRestaurantId,
      fromRestaurantName: restaurantMap.get(t.fromRestaurantId) ?? String(t.fromRestaurantId),
      toRestaurantName: restaurantMap.get(t.toRestaurantId) ?? String(t.toRestaurantId),
      itemName: t.itemName,
      category: t.category,
      subCategory: t.subCategory ?? undefined,
      unit: t.unit,
      quantity: toNum(t.quantity),
      unitPrice: toNum(t.unitPrice),
      totalValue: toNum(t.quantity) * toNum(t.unitPrice),
      referenceNumber: t.referenceNumber ?? undefined,
      transferDate: t.transferDate,
      notes: t.notes ?? undefined,
      createdAt: t.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Error listing branch transfers");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/stock/transfers
router.post("/transfers", async (req, res) => {
  try {
    const { fromRestaurantId, toRestaurantId, itemName, category, subCategory, unit, quantity, unitPrice, referenceNumber, transferDate, notes } = req.body;

    const qty = parseFloat(String(quantity));
    const price = parseFloat(String(unitPrice)) || 0;
    const totalValue = qty * price;

    const [transfer] = await db.insert(branchTransfersTable).values({
      fromRestaurantId: parseInt(String(fromRestaurantId)),
      toRestaurantId: parseInt(String(toRestaurantId)),
      itemName,
      category,
      subCategory: subCategory || null,
      unit: unit || "unit",
      quantity: String(qty.toFixed(3)),
      unitPrice: String(price.toFixed(2)),
      referenceNumber: referenceNumber || null,
      transferDate,
      notes: notes || null,
    }).returning();

    // Auto-create stock movements for both branches
    const moveValues = [
      {
        restaurantId: parseInt(String(fromRestaurantId)),
        itemName,
        category,
        subCategory: subCategory || null,
        unit: unit || "unit",
        movementType: "transfer-out",
        quantity: String(qty.toFixed(3)),
        unitPrice: String(price.toFixed(2)),
        totalValue: String(totalValue.toFixed(2)),
        movementDate: transferDate,
        referenceType: "transfer",
        referenceId: transfer.id,
        notes: `Transfer to ${toRestaurantId} - Ref: ${referenceNumber || transfer.id}`,
      },
      {
        restaurantId: parseInt(String(toRestaurantId)),
        itemName,
        category,
        subCategory: subCategory || null,
        unit: unit || "unit",
        movementType: "transfer-in",
        quantity: String(qty.toFixed(3)),
        unitPrice: String(price.toFixed(2)),
        totalValue: String(totalValue.toFixed(2)),
        movementDate: transferDate,
        referenceType: "transfer",
        referenceId: transfer.id,
        notes: `Transfer from ${fromRestaurantId} - Ref: ${referenceNumber || transfer.id}`,
      },
    ];
    await db.insert(stockMovementsTable).values(moveValues);

    const allRestaurants = await db.select().from(restaurantsTable);
    const restaurantMap = new Map(allRestaurants.map(r => [r.id, r.name]));

    res.status(201).json({
      id: transfer.id,
      fromRestaurantId: transfer.fromRestaurantId,
      toRestaurantId: transfer.toRestaurantId,
      fromRestaurantName: restaurantMap.get(transfer.fromRestaurantId) ?? String(transfer.fromRestaurantId),
      toRestaurantName: restaurantMap.get(transfer.toRestaurantId) ?? String(transfer.toRestaurantId),
      itemName: transfer.itemName,
      category: transfer.category,
      subCategory: transfer.subCategory ?? undefined,
      unit: transfer.unit,
      quantity: toNum(transfer.quantity),
      unitPrice: toNum(transfer.unitPrice),
      totalValue,
      referenceNumber: transfer.referenceNumber ?? undefined,
      transferDate: transfer.transferDate,
      notes: transfer.notes ?? undefined,
      createdAt: transfer.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error creating branch transfer");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/stock/transfers/:id
router.delete("/transfers/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    // Delete related stock movements (transfer-in and transfer-out)
    await db.delete(stockMovementsTable).where(
      and(eq(stockMovementsTable.referenceType, "transfer"), eq(stockMovementsTable.referenceId, id))
    );
    await db.delete(branchTransfersTable).where(eq(branchTransfersTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting branch transfer");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/stock/report
router.get("/report", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const month = req.query.month as string;
    const categoryFilter = req.query.category as string | undefined;

    if (!month) return res.status(400).json({ error: "month is required" });

    const monthStart = `${month}-01`;
    const monthEnd = `${month}-31`;

    // All movements up to end of month
    let allMovements = await db.select()
      .from(stockMovementsTable)
      .where(and(
        eq(stockMovementsTable.restaurantId, restaurantId),
        lte(stockMovementsTable.movementDate, monthEnd)
      ));

    if (categoryFilter) {
      allMovements = allMovements.filter(m => m.category === categoryFilter || m.category.startsWith(categoryFilter));
    }

    // Group by item
    const itemKeys = [...new Set(allMovements.map(m => `${m.itemName}:::${m.category}`))];

    // Sort all movements by date for WAC calculation
    allMovements.sort((a, b) => a.movementDate.localeCompare(b.movementDate));

    const reportItems = itemKeys.map(key => {
      const [itemName, category] = key.split(":::");
      const itemMovements = allMovements.filter(m => m.itemName === itemName && m.category === category);

      const latest = itemMovements[itemMovements.length - 1];
      const unit = latest?.unit ?? "unit";
      const subCategory = latest?.subCategory ?? undefined;

      // WAC up to start of month = opening balance with WAC-based price
      const beforeMonth = itemMovements.filter(m => m.movementDate < monthStart);
      const openingWAC = computeWAC(beforeMonth);
      const openingQty = openingWAC.qty;
      const openingAvgCost = openingWAC.avgCost;

      // WAC through end of month = closing balance with WAC-based price
      const closingWAC = computeWAC(itemMovements);
      const closingQty = closingWAC.qty;
      const closingAvgCost = closingWAC.avgCost;

      // Period metrics (in-month movements)
      const inMonth = itemMovements.filter(m => m.movementDate >= monthStart && m.movementDate <= monthEnd);
      let purchasesQty = 0, purchasesValue = 0;
      let consumptionQty = 0, consumptionValue = 0;
      let transferInQty = 0, transferOutQty = 0;
      let adjustmentQty = 0;

      // Running WAC for consumption valuation during the period
      let runQty = openingQty;
      let runAvg = openingAvgCost;

      for (const m of inMonth) {
        const qty = toNum(m.quantity);
        const price = toNum(m.unitPrice);
        const val = toNum(m.totalValue);

        switch (m.movementType) {
          case "purchase": {
            purchasesQty += qty;
            purchasesValue += val || qty * price;
            const inPrice = price > 0 ? price : runAvg;
            const newTotal = runQty * runAvg + qty * inPrice;
            runQty += qty;
            runAvg = runQty > 0 ? newTotal / runQty : inPrice;
            break;
          }
          case "transfer-in": {
            transferInQty += qty;
            const inPrice = price > 0 ? price : runAvg;
            const newTotal = runQty * runAvg + qty * inPrice;
            runQty += qty;
            runAvg = runQty > 0 ? newTotal / runQty : inPrice;
            break;
          }
          case "consumption":
            consumptionQty += qty;
            consumptionValue += val || qty * runAvg;
            runQty = Math.max(0, runQty - qty);
            break;
          case "transfer-out":
            transferOutQty += qty;
            runQty = Math.max(0, runQty - qty);
            break;
          case "adjustment":
            adjustmentQty += qty;
            if (qty > 0) {
              const aPrice = price > 0 ? price : runAvg;
              const newTotal = runQty * runAvg + qty * aPrice;
              runQty += qty;
              runAvg = runQty > 0 ? newTotal / runQty : aPrice;
            } else {
              runQty = Math.max(0, runQty + qty);
            }
            break;
          case "opening":
            if (price > 0) {
              const newTotal = runQty * runAvg + qty * price;
              runQty += qty;
              runAvg = runQty > 0 ? newTotal / runQty : price;
            } else {
              runQty += qty;
            }
            break;
        }
      }

      const openingValue = openingQty * openingAvgCost;
      const closingValue = closingQty * closingAvgCost;

      return {
        itemName,
        category,
        subCategory,
        unit,
        openingQty: +openingQty.toFixed(3),
        openingValue: +openingValue.toFixed(2),
        purchasesQty: +purchasesQty.toFixed(3),
        purchasesValue: +purchasesValue.toFixed(2),
        consumptionQty: +consumptionQty.toFixed(3),
        consumptionValue: +consumptionValue.toFixed(2),
        transferInQty: +transferInQty.toFixed(3),
        transferOutQty: +transferOutQty.toFixed(3),
        adjustmentQty: +adjustmentQty.toFixed(3),
        closingQty: +closingQty.toFixed(3),
        closingValue: +closingValue.toFixed(2),
        avgCost: +closingAvgCost.toFixed(4),
      };
    }).sort((a, b) => a.itemName.localeCompare(b.itemName));

    const totalOpeningValue = reportItems.reduce((s, i) => s + i.openingValue, 0);
    const totalPurchasesValue = reportItems.reduce((s, i) => s + i.purchasesValue, 0);
    const totalConsumptionValue = reportItems.reduce((s, i) => s + i.consumptionValue, 0);
    const totalClosingValue = reportItems.reduce((s, i) => s + i.closingValue, 0);
    const totalTransferIn = reportItems.reduce((s, i) => s + i.transferInQty, 0);
    const totalTransferOut = reportItems.reduce((s, i) => s + i.transferOutQty, 0);

    res.json({
      month,
      items: reportItems,
      totalOpeningValue: +totalOpeningValue.toFixed(2),
      totalPurchasesValue: +totalPurchasesValue.toFixed(2),
      totalConsumptionValue: +totalConsumptionValue.toFixed(2),
      totalClosingValue: +totalClosingValue.toFixed(2),
      totalTransferIn: +totalTransferIn.toFixed(3),
      totalTransferOut: +totalTransferOut.toFixed(3),
    });
  } catch (err) {
    req.log.error({ err }, "Error generating stock report");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
