import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { salesTable, purchasesTable, employeesTable, expensesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getRestaurantId } from "../lib/restaurant";

const router: IRouter = Router();

function toNum(v: unknown) {
  return parseFloat(String(v));
}

function pct(part: number, total: number): number {
  if (!total) return 0;
  return +((part / total) * 100).toFixed(2);
}

// Category helpers — support both old and new category values
function isFoodCost(cat: string) {
  return cat === "cost-food" || cat === "food";
}
function isBeverageCost(cat: string) {
  return cat === "cost-beverage" || cat === "beverage";
}
function isGeneralCogs(cat: string) {
  return cat === "cost-general" || cat === "other";
}
function isOpex(cat: string) {
  return ["fuel-energy", "maintenance", "it-communication", "marketing", "others"].includes(cat);
}

const CATEGORY_LABELS: Record<string, string> = {
  "cost-food": "Cost of Sale – Food",
  "cost-beverage": "Cost of Sale – Beverage",
  "cost-general": "Cost of Sale – General",
  "fuel-energy": "Fuel & Energy",
  "maintenance": "Maintenance and Repair",
  "it-communication": "IT & Communication",
  "marketing": "Marketing and Advertising",
  "others": "Others Expenses",
  // legacy
  "food": "Cost of Sale – Food",
  "beverage": "Cost of Sale – Beverage",
  "other": "Cost of Sale – General",
};

// GET /api/reports/pl
router.get("/pl", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const month = req.query.month as string | undefined;

    let salesRecords = await db.select().from(salesTable)
      .where(eq(salesTable.restaurantId, restaurantId))
      .orderBy(salesTable.date);
    let purchaseRecords = await db.select().from(purchasesTable)
      .where(eq(purchasesTable.restaurantId, restaurantId))
      .orderBy(purchasesTable.date);

    if (month) {
      salesRecords = salesRecords.filter((r) => r.date.startsWith(month));
      purchaseRecords = purchaseRecords.filter((r) => r.date.startsWith(month));
    }

    const foodSales = salesRecords.reduce((s, r) => s + toNum(r.foodSales), 0);
    const beverageSales = salesRecords.reduce((s, r) => s + toNum(r.beverageSales), 0);
    const totalRevenue = foodSales + beverageSales;
    const outputVat = salesRecords.reduce((s, r) => s + toNum(r.outputVat), 0);

    // COGS
    const foodCost = purchaseRecords
      .filter((r) => isFoodCost(r.category))
      .reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const beverageCost = purchaseRecords
      .filter((r) => isBeverageCost(r.category))
      .reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const otherCost = purchaseRecords
      .filter((r) => isGeneralCogs(r.category))
      .reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const totalCOGS = foodCost + beverageCost + otherCost;
    const inputVat = purchaseRecords.reduce((s, r) => s + toNum(r.vatAmount), 0);

    const grossProfit = totalRevenue - totalCOGS;

    // Purchase Operating Expenses (broken down)
    const fuelEnergyCost = purchaseRecords
      .filter((r) => r.category === "fuel-energy")
      .reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const maintenanceCost = purchaseRecords
      .filter((r) => r.category === "maintenance")
      .reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const itCommunicationCost = purchaseRecords
      .filter((r) => r.category === "it-communication")
      .reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const marketingCost = purchaseRecords
      .filter((r) => r.category === "marketing")
      .reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const othersPurchaseCost = purchaseRecords
      .filter((r) => r.category === "others")
      .reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const totalPurchaseOpex = fuelEnergyCost + maintenanceCost + itCommunicationCost + marketingCost + othersPurchaseCost;

    // Labour Cost (TLC)
    const employees = await db.select().from(employeesTable)
      .where(eq(employeesTable.restaurantId, restaurantId));
    const totalLaborCost = employees.reduce((s, e) => s + toNum(e.totalMonthlyCost), 0);

    // Fixed Expenses
    const expenses = await db.select().from(expensesTable)
      .where(eq(expensesTable.restaurantId, restaurantId));
    const totalFixedExpenses = expenses.reduce((s, e) => s + toNum(e.monthlyCost), 0);

    // Total Operating Expenses = Labour + Purchase Opex + Fixed Expenses
    const totalOperatingExpenses = totalLaborCost + totalPurchaseOpex + totalFixedExpenses;
    const operatingProfit = grossProfit - totalOperatingExpenses;
    const vatPayable = outputVat - inputVat;
    const netProfit = operatingProfit - vatPayable;

    res.json({
      month: month ?? "all",
      foodSales: +foodSales.toFixed(2),
      beverageSales: +beverageSales.toFixed(2),
      totalRevenue: +totalRevenue.toFixed(2),
      foodCost: +foodCost.toFixed(2),
      beverageCost: +beverageCost.toFixed(2),
      otherCost: +otherCost.toFixed(2),
      totalCOGS: +totalCOGS.toFixed(2),
      grossProfit: +grossProfit.toFixed(2),
      grossMarginPercent: pct(grossProfit, totalRevenue),
      foodCostPercent: pct(foodCost, foodSales),
      beverageCostPercent: pct(beverageCost, beverageSales),
      fuelEnergyCost: +fuelEnergyCost.toFixed(2),
      maintenanceCost: +maintenanceCost.toFixed(2),
      itCommunicationCost: +itCommunicationCost.toFixed(2),
      marketingCost: +marketingCost.toFixed(2),
      othersPurchaseCost: +othersPurchaseCost.toFixed(2),
      totalPurchaseOpex: +totalPurchaseOpex.toFixed(2),
      totalLaborCost: +totalLaborCost.toFixed(2),
      totalFixedExpenses: +totalFixedExpenses.toFixed(2),
      totalOperatingExpenses: +totalOperatingExpenses.toFixed(2),
      operatingProfit: +operatingProfit.toFixed(2),
      outputVat: +outputVat.toFixed(2),
      inputVat: +inputVat.toFixed(2),
      vatPayable: +vatPayable.toFixed(2),
      netProfit: +netProfit.toFixed(2),
      netMarginPercent: pct(netProfit, totalRevenue),
    });
  } catch (err) {
    req.log.error({ err }, "Error getting P&L report");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/reports/purchases/monthly
router.get("/purchases/monthly", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const records = await db.select().from(purchasesTable)
      .where(eq(purchasesTable.restaurantId, restaurantId))
      .orderBy(purchasesTable.date);

    const monthMap: Record<string, { total: number; vat: number; net: number; count: number }> = {};
    for (const r of records) {
      const month = r.date.substring(0, 7);
      if (!monthMap[month]) monthMap[month] = { total: 0, vat: 0, net: 0, count: 0 };
      monthMap[month].total += toNum(r.totalAmount);
      monthMap[month].vat += toNum(r.vatAmount);
      monthMap[month].net += toNum(r.amountBeforeVat);
      monthMap[month].count += 1;
    }

    const result = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, d]) => ({
        month,
        totalAmount: +d.total.toFixed(2),
        totalVat: +d.vat.toFixed(2),
        netAmount: +d.net.toFixed(2),
        count: d.count,
      }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error getting monthly purchase report");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/reports/purchases/by-category
router.get("/purchases/by-category", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const month = req.query.month as string | undefined;

    let records = await db.select().from(purchasesTable)
      .where(eq(purchasesTable.restaurantId, restaurantId))
      .orderBy(purchasesTable.date);

    if (month) {
      records = records.filter((r) => r.date.startsWith(month));
    }

    const catMap: Record<string, { total: number; vat: number; net: number; count: number }> = {};
    for (const r of records) {
      const cat = r.category || "others";
      if (!catMap[cat]) catMap[cat] = { total: 0, vat: 0, net: 0, count: 0 };
      catMap[cat].total += toNum(r.totalAmount);
      catMap[cat].vat += toNum(r.vatAmount);
      catMap[cat].net += toNum(r.amountBeforeVat);
      catMap[cat].count += 1;
    }

    const result = Object.entries(catMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cat, d]) => ({
        category: cat,
        label: CATEGORY_LABELS[cat] ?? cat,
        totalAmount: +d.total.toFixed(2),
        totalVat: +d.vat.toFixed(2),
        netAmount: +d.net.toFixed(2),
        count: d.count,
      }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error getting category expense report");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
