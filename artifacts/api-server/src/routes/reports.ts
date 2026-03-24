import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { salesTable, purchasesTable, employeesTable, expensesTable } from "@workspace/db/schema";

const router: IRouter = Router();

function toNum(v: unknown) {
  return parseFloat(String(v));
}

function pct(part: number, total: number): number {
  if (!total) return 0;
  return +((part / total) * 100).toFixed(2);
}

// GET /api/reports/pl
router.get("/pl", async (req, res) => {
  try {
    const month = req.query.month as string | undefined;

    let salesRecords = await db.select().from(salesTable).orderBy(salesTable.date);
    let purchaseRecords = await db.select().from(purchasesTable).orderBy(purchasesTable.date);

    if (month) {
      salesRecords = salesRecords.filter((r) => r.date.startsWith(month));
      purchaseRecords = purchaseRecords.filter((r) => r.date.startsWith(month));
    }

    // Revenue
    const foodSales = salesRecords.reduce((s, r) => s + toNum(r.foodSales), 0);
    const beverageSales = salesRecords.reduce((s, r) => s + toNum(r.beverageSales), 0);
    const totalRevenue = foodSales + beverageSales;

    // VAT
    const outputVat = salesRecords.reduce((s, r) => s + toNum(r.outputVat), 0);

    // COGS by category
    const foodCost = purchaseRecords
      .filter((r) => r.category === "food")
      .reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const beverageCost = purchaseRecords
      .filter((r) => r.category === "beverage")
      .reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const otherCost = purchaseRecords
      .filter((r) => !r.category || r.category === "other")
      .reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const totalCOGS = foodCost + beverageCost + otherCost;
    const inputVat = purchaseRecords.reduce((s, r) => s + toNum(r.vatAmount), 0);

    // Gross Profit
    const grossProfit = totalRevenue - totalCOGS;

    // Labor Cost (TLC) - sum of all employee total monthly costs
    const employees = await db.select().from(employeesTable);
    const totalLaborCost = employees.reduce((s, e) => s + toNum(e.totalMonthlyCost), 0);

    // Fixed Expenses
    const expenses = await db.select().from(expensesTable);
    const totalFixedExpenses = expenses.reduce((s, e) => s + toNum(e.monthlyCost), 0);

    // Operating Expenses = Labor + Fixed
    const totalOperatingExpenses = totalLaborCost + totalFixedExpenses;

    // Operating Profit (EBITDA)
    const operatingProfit = grossProfit - totalOperatingExpenses;

    // VAT Payable
    const vatPayable = outputVat - inputVat;

    // Net Profit = Operating Profit - VAT Payable
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

export default router;
