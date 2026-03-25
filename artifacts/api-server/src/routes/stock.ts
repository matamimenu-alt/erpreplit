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

// Aggregate stock items from movements
async function aggregateStockItems(restaurantId: number, dateFrom?: string, dateTo?: string) {
  let movements = await db.select()
    .from(stockMovementsTable)
    .where(eq(stockMovementsTable.restaurantId, restaurantId));

  if (dateFrom) movements = movements.filter(m => m.movementDate >= dateFrom);
  if (dateTo) movements = movements.filter(m => m.movementDate <= dateTo);

  // Group by itemName+category
  const itemMap = new Map<string, {
    itemName: string; category: string; subCategory?: string; unit: string;
    openingQuantity: number; purchasesQuantity: number; consumptionQuantity: number;
    transferInQuantity: number; transferOutQuantity: number; adjustmentQuantity: number;
    currentQuantity: number; lastPurchasePrice: number; currentValue: number;
    lastMovementDate: string;
  }>();

  // Sort by date to get correct last price
  movements.sort((a, b) => a.movementDate.localeCompare(b.movementDate));

  for (const m of movements) {
    const key = `${m.itemName}:::${m.category}`;
    if (!itemMap.has(key)) {
      itemMap.set(key, {
        itemName: m.itemName,
        category: m.category,
        subCategory: m.subCategory ?? undefined,
        unit: m.unit,
        openingQuantity: 0,
        purchasesQuantity: 0,
        consumptionQuantity: 0,
        transferInQuantity: 0,
        transferOutQuantity: 0,
        adjustmentQuantity: 0,
        currentQuantity: 0,
        lastPurchasePrice: 0,
        currentValue: 0,
        lastMovementDate: m.movementDate,
      });
    }
    const item = itemMap.get(key)!;
    const qty = toNum(m.quantity);
    const price = toNum(m.unitPrice);

    switch (m.movementType) {
      case "opening":
        item.openingQuantity += qty;
        break;
      case "purchase":
        item.purchasesQuantity += qty;
        item.lastPurchasePrice = price;
        break;
      case "consumption":
        item.consumptionQuantity += Math.abs(qty);
        break;
      case "transfer-in":
        item.transferInQuantity += Math.abs(qty);
        if (price > 0) item.lastPurchasePrice = price;
        break;
      case "transfer-out":
        item.transferOutQuantity += Math.abs(qty);
        break;
      case "adjustment":
        item.adjustmentQuantity += qty;
        break;
    }
    if (m.movementDate > item.lastMovementDate) item.lastMovementDate = m.movementDate;
  }

  // Calculate current quantity and value
  for (const item of itemMap.values()) {
    item.currentQuantity =
      item.openingQuantity +
      item.purchasesQuantity +
      item.transferInQuantity -
      item.consumptionQuantity -
      item.transferOutQuantity +
      item.adjustmentQuantity;
    item.currentValue = item.currentQuantity * item.lastPurchasePrice;
  }

  return Array.from(itemMap.values()).sort((a, b) => a.itemName.localeCompare(b.itemName));
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

    const reportItems = itemKeys.map(key => {
      const [itemName, category] = key.split(":::");
      const itemMovements = allMovements.filter(m => m.itemName === itemName && m.category === category);

      let subCategory: string | undefined;
      let unit = "unit";
      let lastPrice = 0;

      // Split into before-month and in-month
      const beforeMonth = itemMovements.filter(m => m.movementDate < monthStart);
      const inMonth = itemMovements.filter(m => m.movementDate >= monthStart && m.movementDate <= monthEnd);

      // Opening balance = closing stock of previous month
      let openingQty = 0;
      for (const m of beforeMonth) {
        unit = m.unit;
        subCategory = m.subCategory ?? undefined;
        const qty = toNum(m.quantity);
        if (m.movementType === "purchase" || m.movementType === "opening" || m.movementType === "transfer-in") {
          openingQty += qty;
          if (m.movementType === "purchase") lastPrice = toNum(m.unitPrice);
        } else if (m.movementType === "consumption" || m.movementType === "transfer-out") {
          openingQty -= qty;
        } else if (m.movementType === "adjustment") {
          openingQty += qty;
        }
      }

      let purchasesQty = 0, purchasesValue = 0;
      let consumptionQty = 0, consumptionValue = 0;
      let transferInQty = 0, transferOutQty = 0;
      let adjustmentQty = 0;

      for (const m of inMonth) {
        unit = m.unit;
        subCategory = m.subCategory ?? undefined;
        const qty = toNum(m.quantity);
        const price = toNum(m.unitPrice);
        const val = toNum(m.totalValue);

        switch (m.movementType) {
          case "purchase":
            purchasesQty += qty;
            purchasesValue += val || qty * price;
            lastPrice = price || lastPrice;
            break;
          case "consumption":
            consumptionQty += qty;
            consumptionValue += val || qty * (lastPrice || price);
            break;
          case "transfer-in":
            transferInQty += qty;
            if (price > 0) lastPrice = price;
            break;
          case "transfer-out":
            transferOutQty += qty;
            break;
          case "adjustment":
            adjustmentQty += qty;
            break;
          case "opening":
            openingQty += qty;
            break;
        }
      }

      const closingQty = openingQty + purchasesQty + transferInQty - consumptionQty - transferOutQty + adjustmentQty;
      const openingValue = openingQty * lastPrice;
      const closingValue = closingQty * lastPrice;

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
        lastPrice: +lastPrice.toFixed(2),
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
