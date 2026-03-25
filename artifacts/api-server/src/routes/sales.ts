import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { salesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { getRestaurantId } from "../lib/restaurant";

const router: IRouter = Router();

const VAT_RATE = 0.15;

function toNum(v: unknown) {
  return parseFloat(String(v)) || 0;
}

function n2s(v: number): string {
  return v.toFixed(2);
}

function calcChannelTotals(body: Record<string, unknown>) {
  const dineInFood = toNum(body.dineInFood);
  const dineInBeverage = toNum(body.dineInBeverage);
  const takeawayFood = toNum(body.takeawayFood);
  const takeawayBeverage = toNum(body.takeawayBeverage);
  const deliveryFood = toNum(body.deliveryFood);
  const deliveryBeverage = toNum(body.deliveryBeverage);
  const appSalesFood = toNum(body.appSalesFood);
  const appSalesBeverage = toNum(body.appSalesBeverage);

  const foodSales = dineInFood + takeawayFood + deliveryFood + appSalesFood;
  const beverageSales = dineInBeverage + takeawayBeverage + deliveryBeverage + appSalesBeverage;
  const totalSales = foodSales + beverageSales;
  const outputVat = +(totalSales * VAT_RATE).toFixed(2);

  return {
    dineInFood, dineInBeverage,
    takeawayFood, takeawayBeverage,
    deliveryFood, deliveryBeverage,
    appSalesFood, appSalesBeverage,
    foodSales: +foodSales.toFixed(2),
    beverageSales: +beverageSales.toFixed(2),
    totalSales: +totalSales.toFixed(2),
    outputVat,
  };
}

function formatRecord(r: typeof salesTable.$inferSelect) {
  return {
    id: r.id,
    date: r.date,
    dineInFood: toNum(r.dineInFood),
    dineInBeverage: toNum(r.dineInBeverage),
    takeawayFood: toNum(r.takeawayFood),
    takeawayBeverage: toNum(r.takeawayBeverage),
    deliveryFood: toNum(r.deliveryFood),
    deliveryBeverage: toNum(r.deliveryBeverage),
    appSalesFood: toNum(r.appSalesFood),
    appSalesBeverage: toNum(r.appSalesBeverage),
    foodSales: toNum(r.foodSales),
    beverageSales: toNum(r.beverageSales),
    totalSales: toNum(r.totalSales),
    outputVat: toNum(r.outputVat),
    createdAt: r.createdAt.toISOString(),
  };
}

// GET /api/sales
router.get("/", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const month = req.query.month as string | undefined;
    let records = await db.select().from(salesTable)
      .where(eq(salesTable.restaurantId, restaurantId))
      .orderBy(salesTable.date);
    if (month) {
      records = records.filter((r) => r.date.startsWith(month));
    }
    res.json(records.map(formatRecord));
  } catch (err) {
    req.log.error({ err }, "Error listing sales");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/sales
router.post("/", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const t = calcChannelTotals(req.body);
    const [record] = await db
      .insert(salesTable)
      .values({
        restaurantId,
        date: req.body.date,
        dineInFood: n2s(t.dineInFood),
        dineInBeverage: n2s(t.dineInBeverage),
        takeawayFood: n2s(t.takeawayFood),
        takeawayBeverage: n2s(t.takeawayBeverage),
        deliveryFood: n2s(t.deliveryFood),
        deliveryBeverage: n2s(t.deliveryBeverage),
        appSalesFood: n2s(t.appSalesFood),
        appSalesBeverage: n2s(t.appSalesBeverage),
        foodSales: n2s(t.foodSales),
        beverageSales: n2s(t.beverageSales),
        totalSales: n2s(t.totalSales),
        outputVat: n2s(t.outputVat),
      })
      .returning();
    res.status(201).json(formatRecord(record));
  } catch (err) {
    req.log.error({ err }, "Error creating sale");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/sales/:id
router.put("/:id", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const id = parseInt(req.params.id);
    const t = calcChannelTotals(req.body);
    const [record] = await db
      .update(salesTable)
      .set({
        date: req.body.date,
        dineInFood: n2s(t.dineInFood),
        dineInBeverage: n2s(t.dineInBeverage),
        takeawayFood: n2s(t.takeawayFood),
        takeawayBeverage: n2s(t.takeawayBeverage),
        deliveryFood: n2s(t.deliveryFood),
        deliveryBeverage: n2s(t.deliveryBeverage),
        appSalesFood: n2s(t.appSalesFood),
        appSalesBeverage: n2s(t.appSalesBeverage),
        foodSales: n2s(t.foodSales),
        beverageSales: n2s(t.beverageSales),
        totalSales: n2s(t.totalSales),
        outputVat: n2s(t.outputVat),
      })
      .where(and(eq(salesTable.id, id), eq(salesTable.restaurantId, restaurantId)))
      .returning();
    if (!record) return res.status(404).json({ error: "Not found" });
    res.json(formatRecord(record));
  } catch (err) {
    req.log.error({ err }, "Error updating sale");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/sales/:id
router.delete("/:id", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const id = parseInt(req.params.id);
    await db.delete(salesTable).where(and(eq(salesTable.id, id), eq(salesTable.restaurantId, restaurantId)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting sale");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/sales/monthly-summary
router.get("/monthly-summary", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const records = await db.select().from(salesTable)
      .where(eq(salesTable.restaurantId, restaurantId))
      .orderBy(salesTable.date);

    type MonthBucket = {
      dineInFood: number; dineInBeverage: number;
      takeawayFood: number; takeawayBeverage: number;
      deliveryFood: number; deliveryBeverage: number;
      appSalesFood: number; appSalesBeverage: number;
      food: number; beverage: number; total: number; vat: number;
    };
    const monthMap: Record<string, MonthBucket> = {};

    for (const r of records) {
      const month = r.date.substring(0, 7);
      if (!monthMap[month]) monthMap[month] = {
        dineInFood: 0, dineInBeverage: 0,
        takeawayFood: 0, takeawayBeverage: 0,
        deliveryFood: 0, deliveryBeverage: 0,
        appSalesFood: 0, appSalesBeverage: 0,
        food: 0, beverage: 0, total: 0, vat: 0,
      };
      const b = monthMap[month];
      b.dineInFood += toNum(r.dineInFood);
      b.dineInBeverage += toNum(r.dineInBeverage);
      b.takeawayFood += toNum(r.takeawayFood);
      b.takeawayBeverage += toNum(r.takeawayBeverage);
      b.deliveryFood += toNum(r.deliveryFood);
      b.deliveryBeverage += toNum(r.deliveryBeverage);
      b.appSalesFood += toNum(r.appSalesFood);
      b.appSalesBeverage += toNum(r.appSalesBeverage);
      b.food += toNum(r.foodSales);
      b.beverage += toNum(r.beverageSales);
      b.total += toNum(r.totalSales);
      b.vat += toNum(r.outputVat);
    }

    const result = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, d]) => ({
        month,
        dineInFood: +d.dineInFood.toFixed(2),
        dineInBeverage: +d.dineInBeverage.toFixed(2),
        takeawayFood: +d.takeawayFood.toFixed(2),
        takeawayBeverage: +d.takeawayBeverage.toFixed(2),
        deliveryFood: +d.deliveryFood.toFixed(2),
        deliveryBeverage: +d.deliveryBeverage.toFixed(2),
        appSalesFood: +d.appSalesFood.toFixed(2),
        appSalesBeverage: +d.appSalesBeverage.toFixed(2),
        totalFoodSales: +d.food.toFixed(2),
        totalBeverageSales: +d.beverage.toFixed(2),
        totalSales: +d.total.toFixed(2),
        totalOutputVat: +d.vat.toFixed(2),
      }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error getting monthly summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
