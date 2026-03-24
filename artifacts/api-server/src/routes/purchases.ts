import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { purchasesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

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
    supplierName: r.supplierName,
    productName: r.productName,
    category: (r.category || "other") as "food" | "beverage" | "other",
    quantity: toNum(r.quantity),
    price: toNum(r.price),
    priceIncludesVat: r.priceIncludesVat,
    amountBeforeVat: toNum(r.amountBeforeVat),
    vatAmount: toNum(r.vatAmount),
    totalAmount: toNum(r.totalAmount),
    createdAt: r.createdAt.toISOString(),
  };
}

// GET /api/purchases
router.get("/", async (req, res) => {
  try {
    const month = req.query.month as string | undefined;
    let records = await db.select().from(purchasesTable).orderBy(purchasesTable.date);
    if (month) {
      records = records.filter((r) => r.date.startsWith(month));
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
    const { date, supplierName, productName, category, quantity, price, priceIncludesVat } = req.body;
    const { amountBeforeVat, vatAmount, totalAmount } = calcPurchase(
      Number(quantity),
      Number(price),
      Boolean(priceIncludesVat)
    );
    const [record] = await db
      .insert(purchasesTable)
      .values({
        date,
        supplierName,
        productName,
        category: category || "other",
        quantity: String(Number(quantity).toFixed(3)),
        price: String(Number(price).toFixed(2)),
        priceIncludesVat: Boolean(priceIncludesVat),
        amountBeforeVat: String(amountBeforeVat),
        vatAmount: String(vatAmount),
        totalAmount: String(totalAmount),
      })
      .returning();
    res.status(201).json(toRecord(record));
  } catch (err) {
    req.log.error({ err }, "Error creating purchase");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/purchases/:id
router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { date, supplierName, productName, category, quantity, price, priceIncludesVat } = req.body;
    const { amountBeforeVat, vatAmount, totalAmount } = calcPurchase(
      Number(quantity),
      Number(price),
      Boolean(priceIncludesVat)
    );
    const [record] = await db
      .update(purchasesTable)
      .set({
        date,
        supplierName,
        productName,
        category: category || "other",
        quantity: String(Number(quantity).toFixed(3)),
        price: String(Number(price).toFixed(2)),
        priceIncludesVat: Boolean(priceIncludesVat),
        amountBeforeVat: String(amountBeforeVat),
        vatAmount: String(vatAmount),
        totalAmount: String(totalAmount),
      })
      .where(eq(purchasesTable.id, id))
      .returning();
    if (!record) return res.status(404).json({ error: "Not found" });
    res.json(toRecord(record));
  } catch (err) {
    req.log.error({ err }, "Error updating purchase");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/purchases/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(purchasesTable).where(eq(purchasesTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting purchase");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
