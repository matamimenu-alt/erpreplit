import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { salesTable, purchasesTable, employeesTable, expensesTable, branchTransfersTable } from "@workspace/db/schema";
import { eq, or, isNotNull } from "drizzle-orm";
import { getRestaurantId } from "../lib/restaurant";

const router: IRouter = Router();

function toNum(v: unknown) {
  return parseFloat(String(v));
}

// GET /api/dashboard/summary
router.get("/summary", async (req, res) => {
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

    const totalNetSales = salesRecords.reduce((s, r) => s + toNum(r.netSales), 0);
    const totalRevenue = salesRecords.reduce((s, r) => s + toNum(r.totalRevenue), 0);
    const outputVat = salesRecords.reduce((s, r) => s + toNum(r.outputVat), 0);
    const totalCash = salesRecords.reduce((s, r) => s + toNum(r.cash), 0);
    const totalCard = salesRecords.reduce((s, r) => s + toNum(r.card), 0);
    const totalApps = salesRecords.reduce((s, r) =>
      s + toNum(r.app1) + toNum(r.app2) + toNum(r.app3) + toNum(r.app4) + toNum(r.app5) + toNum(r.app6), 0);

    const totalPurchases = purchaseRecords.reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const inputVat = purchaseRecords.reduce((s, r) => s + toNum(r.vatAmount), 0);
    const vatPayable = outputVat - inputVat;

    const employees = await db.select().from(employeesTable)
      .where(eq(employeesTable.restaurantId, restaurantId));
    const expenses = await db.select().from(expensesTable)
      .where(eq(expensesTable.restaurantId, restaurantId));

    const totalSalaries = employees.reduce((s, e) => s + toNum(e.totalMonthlyCost), 0);
    const totalFixedExpenses = expenses.reduce((s, e) => s + toNum(e.monthlyCost), 0);

    // ── Internal Branch Transfers — adjust effective purchases ─────────────────
    // Transfers received from other branches = additional internal cost (adds to this branch's effective purchases)
    // Transfers sent to other branches = those goods are no longer this branch's cost (reduces effective purchases)
    // Only branch-to-branch transfers (toRestaurantId IS NOT NULL) are credited back — free-text destinations are consumption
    let allTransfers = await db.select()
      .from(branchTransfersTable)
      .where(or(
        eq(branchTransfersTable.toRestaurantId, restaurantId),
        eq(branchTransfersTable.fromRestaurantId, restaurantId),
      ));

    if (month) {
      allTransfers = allTransfers.filter(t => t.transferDate.startsWith(month));
    }

    const transfersInCost = allTransfers
      .filter(t => t.toRestaurantId === restaurantId)
      .reduce((s, t) => s + toNum(t.quantity) * toNum(t.unitPrice), 0);

    const transfersOutCost = allTransfers
      .filter(t => t.fromRestaurantId === restaurantId && t.toRestaurantId !== null && t.toRestaurantId !== restaurantId)
      .reduce((s, t) => s + toNum(t.quantity) * toNum(t.unitPrice), 0);

    const netTransferCost = transfersInCost - transfersOutCost;
    const effectivePurchases = totalPurchases + netTransferCost;

    const netProfit = totalNetSales - effectivePurchases - totalSalaries - totalFixedExpenses - vatPayable;

    res.json({
      month: month ?? "all",
      totalNetSales: +totalNetSales.toFixed(2),
      totalRevenue: +totalRevenue.toFixed(2),
      // Legacy aliases for dashboard compatibility
      totalFoodSales: +totalNetSales.toFixed(2),
      totalBeverageSales: 0,
      totalSales: +totalNetSales.toFixed(2),
      totalCash: +totalCash.toFixed(2),
      totalCard: +totalCard.toFixed(2),
      totalApps: +totalApps.toFixed(2),
      totalPurchases: +totalPurchases.toFixed(2),
      transfersInCost: +transfersInCost.toFixed(2),
      transfersOutCost: +transfersOutCost.toFixed(2),
      netTransferCost: +netTransferCost.toFixed(2),
      effectivePurchases: +effectivePurchases.toFixed(2),
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
