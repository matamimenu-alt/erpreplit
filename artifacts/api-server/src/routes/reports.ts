import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { salesTable, purchasesTable, employeesTable, expensesTable, inventoryTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { getRestaurantId } from "../lib/restaurant";

const router: IRouter = Router();

function toNum(v: unknown) { return parseFloat(String(v)) || 0; }
function pct(part: number, total: number): number {
  if (!total) return 0;
  return +((part / total) * 100).toFixed(2);
}

function isFoodCost(cat: string) {
  return cat.startsWith("food-") || cat === "cost-food" || cat === "food";
}
function isBeverageCost(cat: string) {
  return cat.startsWith("bev-") || cat === "cost-beverage" || cat === "beverage";
}
function isGeneralCogs(cat: string) {
  return cat.startsWith("gen-") || cat === "cost-general" || cat === "other";
}

const CATEGORY_LABELS: Record<string, string> = {
  "food-vegetables":    "Vegetables, Tomatoes & Onions",
  "food-meat":          "Meat, Poultry & Eggs",
  "food-seafood":       "Fish & Seafood",
  "food-spices":        "Spices & Seasonings",
  "food-dairy":         "Dairy Products",
  "food-other":         "Other Food Items",
  "bev-coffee":         "Fresh Coffee",
  "bev-spices":         "Beverage Spices & Syrups",
  "bev-cold":           "Cold Beverages",
  "bev-hot-materials":  "Hot Beverage Materials",
  "bev-cold-materials": "Cold Beverage Materials",
  "gen-consumables":    "Operational Consumables",
  "gen-kitchen":        "Kitchen Supplies",
  "gen-cleaning":       "Cleaning Tools & Supplies",
  "gen-delivery":       "Delivery Needs",
  "fuel-energy":        "Fuel & Energy",
  "maintenance":        "Maintenance and Repair",
  "it-communication":   "IT & Communication",
  "marketing":          "Marketing and Advertising",
  "others":             "Others Expenses",
  "cost-food":          "Cost of Sale – Food",
  "cost-beverage":      "Cost of Sale – Beverage",
  "cost-general":       "Cost of Sale – General",
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

    // Revenue channel breakdown
    const dineInFood     = salesRecords.reduce((s, r) => s + toNum(r.dineInFood), 0);
    const dineInBeverage = salesRecords.reduce((s, r) => s + toNum(r.dineInBeverage), 0);
    const takeawayFood   = salesRecords.reduce((s, r) => s + toNum(r.takeawayFood), 0);
    const takeawayBeverage = salesRecords.reduce((s, r) => s + toNum(r.takeawayBeverage), 0);
    const deliveryFood   = salesRecords.reduce((s, r) => s + toNum(r.deliveryFood), 0);
    const deliveryBeverage = salesRecords.reduce((s, r) => s + toNum(r.deliveryBeverage), 0);
    const appSalesFood   = salesRecords.reduce((s, r) => s + toNum(r.appSalesFood), 0);
    const appSalesBeverage = salesRecords.reduce((s, r) => s + toNum(r.appSalesBeverage), 0);

    const foodSales      = dineInFood + takeawayFood + deliveryFood + appSalesFood;
    const beverageSales  = dineInBeverage + takeawayBeverage + deliveryBeverage + appSalesBeverage;
    const totalRevenue   = foodSales + beverageSales;
    const outputVat      = salesRecords.reduce((s, r) => s + toNum(r.outputVat), 0);

    // COGS from purchases
    const foodCost = purchaseRecords.filter(r => isFoodCost(r.category))
      .reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const beverageCost = purchaseRecords.filter(r => isBeverageCost(r.category))
      .reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const otherCost = purchaseRecords.filter(r => isGeneralCogs(r.category))
      .reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const totalCOGS = foodCost + beverageCost + otherCost;
    const inputVat = purchaseRecords.reduce((s, r) => s + toNum(r.vatAmount), 0);

    // Closing Inventory Adjustment
    let closingFoodInventory = 0, closingBeverageInventory = 0, closingGeneralInventory = 0;
    if (month) {
      const [inv] = await db.select().from(inventoryTable)
        .where(and(eq(inventoryTable.restaurantId, restaurantId), eq(inventoryTable.month, month)));
      if (inv) {
        closingFoodInventory     = toNum(inv.foodInventory);
        closingBeverageInventory = toNum(inv.beverageInventory);
        closingGeneralInventory  = toNum(inv.generalInventory);
      }
    }
    const totalInventoryAdjustment = closingFoodInventory + closingBeverageInventory + closingGeneralInventory;
    const adjustedFoodCost     = Math.max(0, foodCost - closingFoodInventory);
    const adjustedBeverageCost = Math.max(0, beverageCost - closingBeverageInventory);
    const adjustedOtherCost    = Math.max(0, otherCost - closingGeneralInventory);
    const adjustedCOGS         = adjustedFoodCost + adjustedBeverageCost + adjustedOtherCost;

    const grossProfit = totalRevenue - adjustedCOGS;

    // Purchase Operating Expenses
    const fuelEnergyCost    = purchaseRecords.filter(r => r.category === "fuel-energy").reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const maintenanceCost   = purchaseRecords.filter(r => r.category === "maintenance").reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const itCommunicationCost = purchaseRecords.filter(r => r.category === "it-communication").reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const marketingCost     = purchaseRecords.filter(r => r.category === "marketing").reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const othersPurchaseCost = purchaseRecords.filter(r => r.category === "others").reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const totalPurchaseOpex = fuelEnergyCost + maintenanceCost + itCommunicationCost + marketingCost + othersPurchaseCost;

    // Labour Cost
    const employees = await db.select().from(employeesTable).where(eq(employeesTable.restaurantId, restaurantId));
    const totalLaborCost = employees.reduce((s, e) => s + toNum(e.totalMonthlyCost), 0);

    // Fixed Expenses & App Commissions
    const expenses = await db.select().from(expensesTable).where(eq(expensesTable.restaurantId, restaurantId));
    const totalFixedExpenses  = expenses.filter(e => (e.category ?? "fixed") === "fixed").reduce((s, e) => s + toNum(e.monthlyCost), 0);
    const totalAppCommissions = expenses.filter(e => e.category === "app-commission").reduce((s, e) => s + toNum(e.monthlyCost), 0);

    const totalOperatingExpenses = totalLaborCost + totalPurchaseOpex + totalFixedExpenses + totalAppCommissions;
    const operatingProfit = grossProfit - totalOperatingExpenses;
    const vatPayable = outputVat - inputVat;
    const netProfit  = operatingProfit - vatPayable;

    res.json({
      month: month ?? "all",
      // Channel breakdown
      dineInFood: +dineInFood.toFixed(2),
      dineInBeverage: +dineInBeverage.toFixed(2),
      takeawayFood: +takeawayFood.toFixed(2),
      takeawayBeverage: +takeawayBeverage.toFixed(2),
      deliveryFood: +deliveryFood.toFixed(2),
      deliveryBeverage: +deliveryBeverage.toFixed(2),
      appSalesFood: +appSalesFood.toFixed(2),
      appSalesBeverage: +appSalesBeverage.toFixed(2),
      // Revenue totals
      foodSales: +foodSales.toFixed(2),
      beverageSales: +beverageSales.toFixed(2),
      totalRevenue: +totalRevenue.toFixed(2),
      // Raw COGS from purchases
      foodCost: +foodCost.toFixed(2),
      beverageCost: +beverageCost.toFixed(2),
      otherCost: +otherCost.toFixed(2),
      totalCOGS: +totalCOGS.toFixed(2),
      // Inventory deductions
      closingFoodInventory: +closingFoodInventory.toFixed(2),
      closingBeverageInventory: +closingBeverageInventory.toFixed(2),
      closingGeneralInventory: +closingGeneralInventory.toFixed(2),
      totalInventoryAdjustment: +totalInventoryAdjustment.toFixed(2),
      adjustedFoodCost: +adjustedFoodCost.toFixed(2),
      adjustedBeverageCost: +adjustedBeverageCost.toFixed(2),
      adjustedOtherCost: +adjustedOtherCost.toFixed(2),
      adjustedCOGS: +adjustedCOGS.toFixed(2),
      // Gross Profit (after inventory adjustment)
      grossProfit: +grossProfit.toFixed(2),
      grossMarginPercent: pct(grossProfit, totalRevenue),
      foodCostPercent: pct(adjustedFoodCost, foodSales),
      beverageCostPercent: pct(adjustedBeverageCost, beverageSales),
      // OpEx
      fuelEnergyCost: +fuelEnergyCost.toFixed(2),
      maintenanceCost: +maintenanceCost.toFixed(2),
      itCommunicationCost: +itCommunicationCost.toFixed(2),
      marketingCost: +marketingCost.toFixed(2),
      othersPurchaseCost: +othersPurchaseCost.toFixed(2),
      totalPurchaseOpex: +totalPurchaseOpex.toFixed(2),
      totalLaborCost: +totalLaborCost.toFixed(2),
      totalFixedExpenses: +totalFixedExpenses.toFixed(2),
      totalAppCommissions: +totalAppCommissions.toFixed(2),
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
      monthMap[month].vat   += toNum(r.vatAmount);
      monthMap[month].net   += toNum(r.amountBeforeVat);
      monthMap[month].count += 1;
    }

    const result = Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b))
      .map(([month, d]) => ({ month, totalAmount: +d.total.toFixed(2), totalVat: +d.vat.toFixed(2), netAmount: +d.net.toFixed(2), count: d.count }));

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

    if (month) records = records.filter((r) => r.date.startsWith(month));

    const catMap: Record<string, { total: number; vat: number; net: number; count: number }> = {};
    for (const r of records) {
      const cat = r.category || "others";
      if (!catMap[cat]) catMap[cat] = { total: 0, vat: 0, net: 0, count: 0 };
      catMap[cat].total += toNum(r.totalAmount);
      catMap[cat].vat   += toNum(r.vatAmount);
      catMap[cat].net   += toNum(r.amountBeforeVat);
      catMap[cat].count += 1;
    }

    const result = Object.entries(catMap).sort(([a], [b]) => a.localeCompare(b))
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
