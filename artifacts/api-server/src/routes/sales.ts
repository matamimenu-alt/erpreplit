import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { salesTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

const VAT_RATE = 0.15;

function calcSales(foodSales: number, beverageSales: number) {
  const totalSales = foodSales + beverageSales;
  const outputVat = +(totalSales * VAT_RATE).toFixed(2);
  return { totalSales: +totalSales.toFixed(2), outputVat };
}

function toNum(v: unknown) {
  return parseFloat(String(v));
}

// GET /api/sales
router.get("/", async (req, res) => {
  try {
    const month = req.query.month as string | undefined;
    let records = await db.select().from(salesTable).orderBy(salesTable.date);
    if (month) {
      records = records.filter((r) => r.date.startsWith(month));
    }
    const result = records.map((r) => ({
      id: r.id,
      date: r.date,
      foodSales: toNum(r.foodSales),
      beverageSales: toNum(r.beverageSales),
      totalSales: toNum(r.totalSales),
      outputVat: toNum(r.outputVat),
      createdAt: r.createdAt.toISOString(),
    }));
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error listing sales");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/sales
router.post("/", async (req, res) => {
  try {
    const { date, foodSales, beverageSales } = req.body;
    const { totalSales, outputVat } = calcSales(Number(foodSales), Number(beverageSales));
    const [record] = await db
      .insert(salesTable)
      .values({
        date,
        foodSales: String(Number(foodSales).toFixed(2)),
        beverageSales: String(Number(beverageSales).toFixed(2)),
        totalSales: String(totalSales),
        outputVat: String(outputVat),
      })
      .returning();
    res.status(201).json({
      id: record.id,
      date: record.date,
      foodSales: toNum(record.foodSales),
      beverageSales: toNum(record.beverageSales),
      totalSales: toNum(record.totalSales),
      outputVat: toNum(record.outputVat),
      createdAt: record.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error creating sale");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/sales/:id
router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { date, foodSales, beverageSales } = req.body;
    const { totalSales, outputVat } = calcSales(Number(foodSales), Number(beverageSales));
    const [record] = await db
      .update(salesTable)
      .set({
        date,
        foodSales: String(Number(foodSales).toFixed(2)),
        beverageSales: String(Number(beverageSales).toFixed(2)),
        totalSales: String(totalSales),
        outputVat: String(outputVat),
      })
      .where(eq(salesTable.id, id))
      .returning();
    if (!record) return res.status(404).json({ error: "Not found" });
    res.json({
      id: record.id,
      date: record.date,
      foodSales: toNum(record.foodSales),
      beverageSales: toNum(record.beverageSales),
      totalSales: toNum(record.totalSales),
      outputVat: toNum(record.outputVat),
      createdAt: record.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error updating sale");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/sales/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(salesTable).where(eq(salesTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting sale");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/sales/monthly-summary
router.get("/monthly-summary", async (req, res) => {
  try {
    const records = await db.select().from(salesTable).orderBy(salesTable.date);
    const monthMap: Record<string, { food: number; beverage: number; total: number; vat: number }> = {};
    for (const r of records) {
      const month = r.date.substring(0, 7);
      if (!monthMap[month]) monthMap[month] = { food: 0, beverage: 0, total: 0, vat: 0 };
      monthMap[month].food += toNum(r.foodSales);
      monthMap[month].beverage += toNum(r.beverageSales);
      monthMap[month].total += toNum(r.totalSales);
      monthMap[month].vat += toNum(r.outputVat);
    }
    const result = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        totalFoodSales: +data.food.toFixed(2),
        totalBeverageSales: +data.beverage.toFixed(2),
        totalSales: +data.total.toFixed(2),
        totalOutputVat: +data.vat.toFixed(2),
      }));
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error getting monthly summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
