import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { purchasesTable, stockMovementsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { getRestaurantId } from "../lib/restaurant";

async function upsertStockMovementForPurchase(
  restaurantId: number,
  purchaseId: number,
  data: { date: string; productName: string; category: string; quantity: number; price: number; amountBeforeVat: number }
) {
  // Delete existing movement for this purchase (handles update scenario)
  await db.delete(stockMovementsTable).where(
    and(eq(stockMovementsTable.referenceType, "purchase"), eq(stockMovementsTable.referenceId, purchaseId))
  );
  // Create new movement
  if (data.quantity > 0) {
    await db.insert(stockMovementsTable).values({
      restaurantId,
      itemName: data.productName,
      category: data.category || "others",
      unit: "unit",
      movementType: "purchase",
      quantity: String(data.quantity.toFixed(3)),
      unitPrice: String(data.price.toFixed(2)),
      totalValue: String(data.amountBeforeVat.toFixed(2)),
      movementDate: data.date,
      referenceType: "purchase",
      referenceId: purchaseId,
      notes: null,
    });
  }
}

const router: IRouter = Router();

const VAT_RATE = 0.15;

function calcPurchase(quantity: number, price: number, priceIncludesVat: boolean) {
  const gross = quantity * price;
  if (priceIncludesVat) {
    const amountBeforeVat = gross / (1 + VAT_RATE);
    const vatAmount = gross - amountBeforeVat;
    return {
      amountBeforeVat: +amountBeforeVat.toFixed(2),
      vatAmount: +vatAmount.toFixed(2),
      totalAmount: +gross.toFixed(2),
    };
  } else {
    const vatAmount = gross * VAT_RATE;
    return {
      amountBeforeVat: +gross.toFixed(2),
      vatAmount: +vatAmount.toFixed(2),
      totalAmount: +(gross + vatAmount).toFixed(2),
    };
  }
}

function toNum(v: unknown) {
  return parseFloat(String(v));
}

function toRecord(r: typeof purchasesTable.$inferSelect) {
  return {
    id: r.id,
    date: r.date,
    supplierName: r.supplierName ?? "",
    productName: r.productName,
    category: r.category || "others",
    quantity: toNum(r.quantity),
    price: toNum(r.price),
    priceIncludesVat: r.priceIncludesVat,
    amountBeforeVat: toNum(r.amountBeforeVat),
    vatAmount: toNum(r.vatAmount),
    totalAmount: toNum(r.totalAmount),
    paymentType: r.paymentType ?? "cash",
    notes: r.notes ?? undefined,
    createdAt: r.createdAt.toISOString(),
  };
}

// GET /api/purchases
router.get("/", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const month = req.query.month as string | undefined;
    const category = req.query.category as string | undefined;
    const search = req.query.search as string | undefined;

    let records = await db.select().from(purchasesTable)
      .where(eq(purchasesTable.restaurantId, restaurantId))
      .orderBy(purchasesTable.date);

    if (month) {
      records = records.filter((r) => r.date.startsWith(month));
    }
    if (category) {
      records = records.filter((r) => r.category === category);
    }
    if (search) {
      const q = search.toLowerCase();
      records = records.filter((r) => r.productName.toLowerCase().includes(q));
    }

    res.json(records.map(toRecord));
  } catch (err) {
    req.log.error({ err }, "Error listing purchases");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/purchases
router.post("/", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const { date, supplierName, productName, category, quantity, price, priceIncludesVat, paymentType, notes } = req.body;
    const { amountBeforeVat, vatAmount, totalAmount } = calcPurchase(
      Number(quantity),
      Number(price),
      Boolean(priceIncludesVat)
    );
    const [record] = await db
      .insert(purchasesTable)
      .values({
        restaurantId,
        date,
        supplierName: supplierName || "",
        productName,
        category: category || "others",
        quantity: String(Number(quantity).toFixed(3)),
        price: String(Number(price).toFixed(2)),
        priceIncludesVat: Boolean(priceIncludesVat),
        amountBeforeVat: String(amountBeforeVat),
        vatAmount: String(vatAmount),
        totalAmount: String(totalAmount),
        paymentType: paymentType || "cash",
        notes: notes || null,
      })
      .returning();

    // Auto-create stock movement for this purchase
    await upsertStockMovementForPurchase(restaurantId, record.id, {
      date,
      productName,
      category: category || "others",
      quantity: Number(quantity),
      price: Number(price),
      amountBeforeVat,
    });

    res.status(201).json(toRecord(record));
  } catch (err) {
    req.log.error({ err }, "Error creating purchase");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/purchases/:id
router.put("/:id", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const id = parseInt(req.params.id);
    const { date, supplierName, productName, category, quantity, price, priceIncludesVat, paymentType, notes } = req.body;
    const { amountBeforeVat, vatAmount, totalAmount } = calcPurchase(
      Number(quantity),
      Number(price),
      Boolean(priceIncludesVat)
    );
    const [record] = await db
      .update(purchasesTable)
      .set({
        date,
        supplierName: supplierName || "",
        productName,
        category: category || "others",
        quantity: String(Number(quantity).toFixed(3)),
        price: String(Number(price).toFixed(2)),
        priceIncludesVat: Boolean(priceIncludesVat),
        amountBeforeVat: String(amountBeforeVat),
        vatAmount: String(vatAmount),
        totalAmount: String(totalAmount),
        paymentType: paymentType || "cash",
        notes: notes || null,
      })
      .where(and(eq(purchasesTable.id, id), eq(purchasesTable.restaurantId, restaurantId)))
      .returning();
    if (!record) return res.status(404).json({ error: "Not found" });

    // Update linked stock movement
    await upsertStockMovementForPurchase(restaurantId, id, {
      date,
      productName,
      category: category || "others",
      quantity: Number(quantity),
      price: Number(price),
      amountBeforeVat,
    });

    res.json(toRecord(record));
  } catch (err) {
    req.log.error({ err }, "Error updating purchase");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/purchases/:id
router.delete("/:id", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const id = parseInt(req.params.id);
    // Remove linked stock movement first
    await db.delete(stockMovementsTable).where(
      and(eq(stockMovementsTable.referenceType, "purchase"), eq(stockMovementsTable.referenceId, id))
    );
    await db.delete(purchasesTable).where(and(eq(purchasesTable.id, id), eq(purchasesTable.restaurantId, restaurantId)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting purchase");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
