import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { salesTable, salesAppConfigTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { getRestaurantId } from "../lib/restaurant";

const router: IRouter = Router();
const VAT_RATE = 0.15;

function toNum(v: unknown) { return parseFloat(String(v)) || 0; }
function n2s(v: number): string { return v.toFixed(2); }

function calcSaleTotals(body: Record<string, unknown>) {
  const cash = toNum(body.cash);
  const card = toNum(body.card);
  const app1 = toNum(body.app1);
  const app2 = toNum(body.app2);
  const app3 = toNum(body.app3);
  const app4 = toNum(body.app4);
  const app5 = toNum(body.app5);
  const app6 = toNum(body.app6);
  const vatMode = String(body.vatMode || "exclusive");

  const totalRevenue = cash + card + app1 + app2 + app3 + app4 + app5 + app6;

  let netSales: number;
  let outputVat: number;
  if (vatMode === "inclusive") {
    netSales = +(totalRevenue / (1 + VAT_RATE)).toFixed(2);
    outputVat = +(totalRevenue - netSales).toFixed(2);
  } else {
    netSales = +totalRevenue.toFixed(2);
    outputVat = +(totalRevenue * VAT_RATE).toFixed(2);
  }

  const openingBalance = toNum(body.openingBalance);
  const cashExpenses = toNum(body.cashExpenses);
  const pettyCash = toNum(body.pettyCash);
  const closingBalance = toNum(body.closingBalance);
  const expectedClosing = +(openingBalance + cash - cashExpenses - pettyCash).toFixed(2);
  const cashDiscrepancy = +(closingBalance - expectedClosing).toFixed(2);

  return {
    cash, card, app1, app2, app3, app4, app5, app6,
    vatMode,
    totalRevenue: +totalRevenue.toFixed(2),
    netSales,
    outputVat,
    openingBalance: +openingBalance.toFixed(2),
    cashExpenses: +cashExpenses.toFixed(2),
    pettyCash: +pettyCash.toFixed(2),
    closingBalance: +closingBalance.toFixed(2),
    expectedClosing,
    cashDiscrepancy,
  };
}

function formatRecord(r: typeof salesTable.$inferSelect) {
  return {
    id: r.id,
    date: r.date,
    cash: toNum(r.cash),
    card: toNum(r.card),
    app1: toNum(r.app1),
    app2: toNum(r.app2),
    app3: toNum(r.app3),
    app4: toNum(r.app4),
    app5: toNum(r.app5),
    app6: toNum(r.app6),
    vatMode: r.vatMode,
    totalRevenue: toNum(r.totalRevenue),
    netSales: toNum(r.netSales),
    outputVat: toNum(r.outputVat),
    openingBalance: toNum(r.openingBalance),
    cashExpenses: toNum(r.cashExpenses),
    pettyCash: toNum(r.pettyCash),
    closingBalance: toNum(r.closingBalance),
    expectedClosing: toNum(r.expectedClosing),
    cashDiscrepancy: toNum(r.cashDiscrepancy),
    dailyNotes: r.dailyNotes ?? "",
    createdAt: r.createdAt.toISOString(),
  };
}

// GET /api/sales
router.get("/", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const month = req.query.month as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    let records = await db.select().from(salesTable)
      .where(eq(salesTable.restaurantId, restaurantId))
      .orderBy(salesTable.date);

    if (month) records = records.filter((r) => r.date.startsWith(month));
    if (from) records = records.filter((r) => r.date >= from);
    if (to) records = records.filter((r) => r.date <= to);

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
    const t = calcSaleTotals(req.body);
    const [record] = await db.insert(salesTable).values({
      restaurantId,
      date: req.body.date,
      cash: n2s(t.cash),
      card: n2s(t.card),
      app1: n2s(t.app1),
      app2: n2s(t.app2),
      app3: n2s(t.app3),
      app4: n2s(t.app4),
      app5: n2s(t.app5),
      app6: n2s(t.app6),
      vatMode: t.vatMode,
      totalRevenue: n2s(t.totalRevenue),
      netSales: n2s(t.netSales),
      outputVat: n2s(t.outputVat),
      openingBalance: n2s(t.openingBalance),
      cashExpenses: n2s(t.cashExpenses),
      pettyCash: n2s(t.pettyCash),
      closingBalance: n2s(t.closingBalance),
      expectedClosing: n2s(t.expectedClosing),
      cashDiscrepancy: n2s(t.cashDiscrepancy),
      dailyNotes: req.body.dailyNotes ?? null,
    }).returning();
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
    const t = calcSaleTotals(req.body);
    const [record] = await db.update(salesTable).set({
      date: req.body.date,
      cash: n2s(t.cash),
      card: n2s(t.card),
      app1: n2s(t.app1),
      app2: n2s(t.app2),
      app3: n2s(t.app3),
      app4: n2s(t.app4),
      app5: n2s(t.app5),
      app6: n2s(t.app6),
      vatMode: t.vatMode,
      totalRevenue: n2s(t.totalRevenue),
      netSales: n2s(t.netSales),
      outputVat: n2s(t.outputVat),
      openingBalance: n2s(t.openingBalance),
      cashExpenses: n2s(t.cashExpenses),
      pettyCash: n2s(t.pettyCash),
      closingBalance: n2s(t.closingBalance),
      expectedClosing: n2s(t.expectedClosing),
      cashDiscrepancy: n2s(t.cashDiscrepancy),
      dailyNotes: req.body.dailyNotes ?? null,
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

    type Bucket = {
      cash: number; card: number;
      app1: number; app2: number; app3: number; app4: number; app5: number; app6: number;
      totalRevenue: number; netSales: number; outputVat: number;
      cashDiscrepancy: number;
    };
    const monthMap: Record<string, Bucket> = {};

    for (const r of records) {
      const month = r.date.substring(0, 7);
      if (!monthMap[month]) monthMap[month] = {
        cash: 0, card: 0,
        app1: 0, app2: 0, app3: 0, app4: 0, app5: 0, app6: 0,
        totalRevenue: 0, netSales: 0, outputVat: 0, cashDiscrepancy: 0,
      };
      const b = monthMap[month];
      b.cash += toNum(r.cash);
      b.card += toNum(r.card);
      b.app1 += toNum(r.app1);
      b.app2 += toNum(r.app2);
      b.app3 += toNum(r.app3);
      b.app4 += toNum(r.app4);
      b.app5 += toNum(r.app5);
      b.app6 += toNum(r.app6);
      b.totalRevenue += toNum(r.totalRevenue);
      b.netSales += toNum(r.netSales);
      b.outputVat += toNum(r.outputVat);
      b.cashDiscrepancy += toNum(r.cashDiscrepancy);
    }

    const result = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, d]) => ({
        month,
        cash: +d.cash.toFixed(2),
        card: +d.card.toFixed(2),
        app1: +d.app1.toFixed(2),
        app2: +d.app2.toFixed(2),
        app3: +d.app3.toFixed(2),
        app4: +d.app4.toFixed(2),
        app5: +d.app5.toFixed(2),
        app6: +d.app6.toFixed(2),
        totalRevenue: +d.totalRevenue.toFixed(2),
        netSales: +d.netSales.toFixed(2),
        totalOutputVat: +d.outputVat.toFixed(2),
        totalCashDiscrepancy: +d.cashDiscrepancy.toFixed(2),
      }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error getting monthly summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/sales/app-config
router.get("/app-config", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const [config] = await db.select().from(salesAppConfigTable)
      .where(eq(salesAppConfigTable.restaurantId, restaurantId));

    if (!config) {
      // Return defaults
      return res.json({
        id: null,
        app1Name: "HungerStation", app2Name: "Jahez",
        app3Name: "Noon Food", app4Name: "Talabat",
        app5Name: "App 5", app6Name: "App 6",
        defaultVatMode: "exclusive",
      });
    }
    res.json({
      id: config.id,
      app1Name: config.app1Name, app2Name: config.app2Name,
      app3Name: config.app3Name, app4Name: config.app4Name,
      app5Name: config.app5Name, app6Name: config.app6Name,
      defaultVatMode: config.defaultVatMode,
    });
  } catch (err) {
    req.log.error({ err }, "Error getting app config");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/sales/app-config
router.put("/app-config", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const [existing] = await db.select().from(salesAppConfigTable)
      .where(eq(salesAppConfigTable.restaurantId, restaurantId));

    const data = {
      restaurantId,
      app1Name: req.body.app1Name ?? "HungerStation",
      app2Name: req.body.app2Name ?? "Jahez",
      app3Name: req.body.app3Name ?? "Noon Food",
      app4Name: req.body.app4Name ?? "Talabat",
      app5Name: req.body.app5Name ?? "App 5",
      app6Name: req.body.app6Name ?? "App 6",
      defaultVatMode: req.body.defaultVatMode ?? "exclusive",
      updatedAt: new Date(),
    };

    if (existing) {
      await db.update(salesAppConfigTable).set(data)
        .where(eq(salesAppConfigTable.restaurantId, restaurantId));
    } else {
      await db.insert(salesAppConfigTable).values(data);
    }

    res.json({ success: true, ...data });
  } catch (err) {
    req.log.error({ err }, "Error updating app config");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/sales/report  — date-range report with channel breakdown
router.get("/report", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    let records = await db.select().from(salesTable)
      .where(eq(salesTable.restaurantId, restaurantId))
      .orderBy(salesTable.date);

    if (from) records = records.filter((r) => r.date >= from);
    if (to) records = records.filter((r) => r.date <= to);

    const totals = {
      cash: 0, card: 0,
      app1: 0, app2: 0, app3: 0, app4: 0, app5: 0, app6: 0,
      appsTotal: 0, totalRevenue: 0, netSales: 0, outputVat: 0,
      cashDiscrepancy: 0,
    };

    const daily = records.map((r) => {
      const apps = toNum(r.app1) + toNum(r.app2) + toNum(r.app3) +
        toNum(r.app4) + toNum(r.app5) + toNum(r.app6);
      totals.cash += toNum(r.cash);
      totals.card += toNum(r.card);
      totals.app1 += toNum(r.app1);
      totals.app2 += toNum(r.app2);
      totals.app3 += toNum(r.app3);
      totals.app4 += toNum(r.app4);
      totals.app5 += toNum(r.app5);
      totals.app6 += toNum(r.app6);
      totals.appsTotal += apps;
      totals.totalRevenue += toNum(r.totalRevenue);
      totals.netSales += toNum(r.netSales);
      totals.outputVat += toNum(r.outputVat);
      totals.cashDiscrepancy += toNum(r.cashDiscrepancy);
      return {
        date: r.date,
        cash: toNum(r.cash),
        card: toNum(r.card),
        app1: toNum(r.app1), app2: toNum(r.app2), app3: toNum(r.app3),
        app4: toNum(r.app4), app5: toNum(r.app5), app6: toNum(r.app6),
        appsTotal: +apps.toFixed(2),
        totalRevenue: toNum(r.totalRevenue),
        netSales: toNum(r.netSales),
        outputVat: toNum(r.outputVat),
        vatMode: r.vatMode,
        cashDiscrepancy: toNum(r.cashDiscrepancy),
        dailyNotes: r.dailyNotes ?? "",
      };
    });

    res.json({
      from: from ?? null,
      to: to ?? null,
      recordCount: records.length,
      totals: {
        cash: +totals.cash.toFixed(2),
        card: +totals.card.toFixed(2),
        app1: +totals.app1.toFixed(2),
        app2: +totals.app2.toFixed(2),
        app3: +totals.app3.toFixed(2),
        app4: +totals.app4.toFixed(2),
        app5: +totals.app5.toFixed(2),
        app6: +totals.app6.toFixed(2),
        appsTotal: +totals.appsTotal.toFixed(2),
        totalRevenue: +totals.totalRevenue.toFixed(2),
        netSales: +totals.netSales.toFixed(2),
        outputVat: +totals.outputVat.toFixed(2),
        cashDiscrepancy: +totals.cashDiscrepancy.toFixed(2),
      },
      daily,
    });
  } catch (err) {
    req.log.error({ err }, "Error generating sales report");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
