import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { salesTable, purchasesTable, employeesTable, expensesTable } from "@workspace/db/schema";

const router: IRouter = Router();

function toNum(v: unknown) {
  return parseFloat(String(v));
}

// GET /api/dashboard/summary
router.get("/summary", async (req, res) => {
  try {
    const month = req.query.month as string | undefined;

    let salesRecords = await db.select().from(salesTable).orderBy(salesTable.date);
    let purchaseRecords = await db.select().from(purchasesTable).orderBy(purchasesTable.date);

    if (month) {
      salesRecords = salesRecords.filter((r) => r.date.startsWith(month));
      purchaseRecords = purchaseRecords.filter((r) => r.date.startsWith(month));
    }

    const totalFoodSales = salesRecords.reduce((s, r) => s + toNum(r.foodSales), 0);
    const totalBeverageSales = salesRecords.reduce((s, r) => s + toNum(r.beverageSales), 0);
    const totalSales = salesRecords.reduce((s, r) => s + toNum(r.totalSales), 0);
    const outputVat = salesRecords.reduce((s, r) => s + toNum(r.outputVat), 0);

    const totalPurchases = purchaseRecords.reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const inputVat = purchaseRecords.reduce((s, r) => s + toNum(r.vatAmount), 0);
    const vatPayable = outputVat - inputVat;

    // Employees and expenses are always totals (monthly recurring)
    const employees = await db.select().from(employeesTable);
    const expenses = await db.select().from(expensesTable);

    const totalSalaries = employees.reduce((s, e) => s + toNum(e.totalMonthlyCost), 0);
    const totalFixedExpenses = expenses.reduce((s, e) => s + toNum(e.monthlyCost), 0);

    // Net Profit = Sales - Purchases - Salaries - Expenses - VAT Payable
    const netProfit = totalSales - totalPurchases - totalSalaries - totalFixedExpenses - vatPayable;

    res.json({
      month: month ?? "all",
      totalFoodSales: +totalFoodSales.toFixed(2),
      totalBeverageSales: +totalBeverageSales.toFixed(2),
      totalSales: +totalSales.toFixed(2),
      totalPurchases: +totalPurchases.toFixed(2),
      outputVat: +outputVat.toFixed(2),
      inputVat: +inputVat.toFixed(2),
      vatPayable: +vatPayable.toFixed(2),
      totalSalaries: +totalSalaries.toFixed(2),
      totalFixedExpenses: +totalFixedExpenses.toFixed(2),
      netProfit: +netProfit.toFixed(2),
    });
  } catch (err) {
    req.log.error({ err }, "Error getting dashboard summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
