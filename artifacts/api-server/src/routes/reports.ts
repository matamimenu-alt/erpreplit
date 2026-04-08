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

const LEGACY_MAP: Record<string, string> = {
  "cost-food":          "food-poultry",
  "food":               "food-poultry",
  "food-meat":          "food-poultry",
  "food-seafood":       "food-supplies",
  "food-other":         "food-supplies",
  "cost-beverage":      "bev-juices",
  "beverage":           "bev-juices",
  "bev-coffee":         "bev-juices",
  "bev-spices":         "bev-juices",
  "bev-cold":           "bev-soft",
  "bev-hot-materials":  "bev-juices",
  "bev-cold-materials": "bev-soft",
  "cost-general":       "gen-kitchen",
  "other":              "gen-kitchen",
  "gen-consumables":    "gen-cashier",
  "gen-delivery":       "gen-packaging",
  "fuel-energy":        "fuel-gas",
  "maintenance":        "maint-services",
  "it-communication":   "it-internet",
  "marketing":          "mkt-campaigns",
  "others":             "others-misc",
};

function resolveCat(cat: string): string {
  return LEGACY_MAP[cat] ?? cat;
}

function isFoodCost(cat: string)      { const r = resolveCat(cat); return r.startsWith("food-"); }
function isBeverageCost(cat: string)  { const r = resolveCat(cat); return r.startsWith("bev-"); }
function isGeneralCogs(cat: string)   { const r = resolveCat(cat); return r.startsWith("gen-"); }
function isFuelCost(cat: string)      { const r = resolveCat(cat); return r.startsWith("fuel-"); }
function isMaintenanceCost(cat: string){ const r = resolveCat(cat); return r.startsWith("maint-"); }
function isItCost(cat: string)        { const r = resolveCat(cat); return r.startsWith("it-"); }
function isMarketingCost(cat: string) { const r = resolveCat(cat); return r.startsWith("mkt-"); }
function isOthersCost(cat: string)    { const r = resolveCat(cat); return r.startsWith("others-") || r === "others"; }

const CATEGORY_LABELS: Record<string, string> = {
  // Food subcategories
  "food-poultry":    "Poultry & Meat",
  "food-vegetables": "Vegetables & Fruits",
  "food-dairy":      "Milk & Dairy",
  "food-spices":     "Spices & Seasoning",
  "food-products":   "Food Products & Desserts",
  "food-supplies":   "Food Supplies & Oils",
  // Beverage subcategories
  "bev-juices": "Juices",
  "bev-water":  "Mineral Water",
  "bev-soft":   "Soft Drinks",
  // General subcategories
  "gen-cashier":   "Cashier Supplies",
  "gen-kitchen":   "Kitchen Supplies",
  "gen-cleaning":  "Cleaning Supplies",
  "gen-packaging": "Packaging & Paper",
  // Fuel subcategories
  "fuel-vehicle":   "Vehicle Fuel",
  "fuel-charcoal":  "Charcoal",
  "fuel-gas":       "Gas",
  "fuel-utilities": "Electricity & Water",
  // Maintenance subcategories
  "maint-services":  "Maintenance Services",
  "maint-materials": "Maintenance Materials",
  // IT subcategories
  "it-internet": "Internet",
  "it-phones":   "Telephones",
  // Marketing subcategories
  "mkt-campaigns": "Advertising Campaigns",
  "mkt-promo":     "Promotion / Distribution",
  // Others
  "others-misc": "Miscellaneous",
};

const CATEGORY_LABELS_AR: Record<string, string> = {
  "food-poultry":    "الدواجن واللحوم",
  "food-vegetables": "الخضروات والفواكه",
  "food-dairy":      "الحليب والألبان",
  "food-spices":     "بهارات وتوابل",
  "food-products":   "منتجات غذائية وحلويات",
  "food-supplies":   "مواد غذائية وزيوت",
  "bev-juices": "عصائر",
  "bev-water":  "مياه معدنية",
  "bev-soft":   "مشروبات غازية",
  "gen-cashier":   "مستلزمات الكاشير",
  "gen-kitchen":   "مستلزمات المطبخ",
  "gen-cleaning":  "مستلزمات التنظيف",
  "gen-packaging": "التغليف والورقيات",
  "fuel-vehicle":   "محروقات سيارات",
  "fuel-charcoal":  "الفحم",
  "fuel-gas":       "الغاز",
  "fuel-utilities": "الكهرباء والماء",
  "maint-services":  "خدمات صيانة",
  "maint-materials": "مواد صيانة",
  "it-internet": "الإنترنت",
  "it-phones":   "الاتصالات / تلفونات",
  "mkt-campaigns": "حملات إعلانية",
  "mkt-promo":     "ترويج وتوزيع",
  "others-misc": "متفرقات",
};

const GROUP_LABELS: Record<string, { label: string; labelAr: string }> = {
  "food":        { label: "Cost of Sale – Food",      labelAr: "تكلفة المبيعات – أغذية" },
  "beverage":    { label: "Cost of Sale – Beverage",  labelAr: "تكلفة المبيعات – مشروبات" },
  "general":     { label: "Cost of Sale – General",   labelAr: "تكلفة المبيعات – عام" },
  "fuel":        { label: "Fuel & Energy",             labelAr: "الوقود والطاقة" },
  "maintenance": { label: "Maintenance & Repair",      labelAr: "الصيانة والإصلاح" },
  "it":          { label: "IT & Communication",        labelAr: "تقنية المعلومات والاتصالات" },
  "marketing":   { label: "Marketing & Advertising",   labelAr: "التسويق والإعلانات" },
  "others":      { label: "Other Expenses",            labelAr: "مصاريف أخرى" },
};

function getCatGroup(resolvedCat: string): string {
  if (resolvedCat.startsWith("food-"))  return "food";
  if (resolvedCat.startsWith("bev-"))   return "beverage";
  if (resolvedCat.startsWith("gen-"))   return "general";
  if (resolvedCat.startsWith("fuel-"))  return "fuel";
  if (resolvedCat.startsWith("maint-")) return "maintenance";
  if (resolvedCat.startsWith("it-"))    return "it";
  if (resolvedCat.startsWith("mkt-"))   return "marketing";
  return "others";
}

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

    // Revenue channel breakdown (new schema: cash / card / app1-6)
    const cashSales   = salesRecords.reduce((s, r) => s + toNum(r.cash), 0);
    const cardSales   = salesRecords.reduce((s, r) => s + toNum(r.card), 0);
    const app1Sales   = salesRecords.reduce((s, r) => s + toNum(r.app1), 0);
    const app2Sales   = salesRecords.reduce((s, r) => s + toNum(r.app2), 0);
    const app3Sales   = salesRecords.reduce((s, r) => s + toNum(r.app3), 0);
    const app4Sales   = salesRecords.reduce((s, r) => s + toNum(r.app4), 0);
    const app5Sales   = salesRecords.reduce((s, r) => s + toNum(r.app5), 0);
    const app6Sales   = salesRecords.reduce((s, r) => s + toNum(r.app6), 0);
    const appSalesTotal = app1Sales + app2Sales + app3Sales + app4Sales + app5Sales + app6Sales;

    const netSales       = salesRecords.reduce((s, r) => s + toNum(r.netSales), 0);
    const totalRevenue   = salesRecords.reduce((s, r) => s + toNum(r.totalRevenue), 0);
    const outputVat      = salesRecords.reduce((s, r) => s + toNum(r.outputVat), 0);

    // Aliases for P&L compatibility
    const foodSales    = netSales;
    const beverageSales = 0;

    // COGS from purchases
    const foodCost = purchaseRecords.filter(r => isFoodCost(r.category))
      .reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const beverageCost = purchaseRecords.filter(r => isBeverageCost(r.category))
      .reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const otherCost = purchaseRecords.filter(r => isGeneralCogs(r.category))
      .reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const totalCOGS = foodCost + beverageCost + otherCost;
    const inputVat = purchaseRecords.reduce((s, r) => s + toNum(r.vatAmount), 0);

    // Opening + Closing Inventory (for proper COGS: Opening + Purchases - Closing)
    let closingFoodInventory = 0, closingBeverageInventory = 0, closingGeneralInventory = 0;
    let openingInventory = 0;
    if (month) {
      // Closing inventory for current month
      const [inv] = await db.select().from(inventoryTable)
        .where(and(eq(inventoryTable.restaurantId, restaurantId), eq(inventoryTable.month, month)));
      if (inv) {
        closingFoodInventory     = toNum(inv.foodInventory);
        closingBeverageInventory = toNum(inv.beverageInventory);
        closingGeneralInventory  = toNum(inv.generalInventory);
      }
      // Opening inventory = previous month's closing inventory
      const [y, m] = month.split("-").map(Number);
      const prevDate = new Date(y, m - 2, 1);
      const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
      const [prevInv] = await db.select().from(inventoryTable)
        .where(and(eq(inventoryTable.restaurantId, restaurantId), eq(inventoryTable.month, prevMonth)));
      if (prevInv) {
        openingInventory = toNum(prevInv.foodInventory) + toNum(prevInv.beverageInventory) + toNum(prevInv.generalInventory);
      }
    }
    const totalInventoryAdjustment = closingFoodInventory + closingBeverageInventory + closingGeneralInventory;
    // Actual COGS = Opening Inventory + Purchases - Closing Inventory
    const adjustedFoodCost     = Math.max(0, foodCost - closingFoodInventory);
    const adjustedBeverageCost = Math.max(0, beverageCost - closingBeverageInventory);
    const adjustedOtherCost    = Math.max(0, otherCost - closingGeneralInventory);
    const adjustedCOGS         = openingInventory + adjustedFoodCost + adjustedBeverageCost + adjustedOtherCost;

    const grossProfit = totalRevenue - adjustedCOGS;

    // Purchase Operating Expenses
    const fuelEnergyCost    = purchaseRecords.filter(r => isFuelCost(r.category)).reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const maintenanceCost   = purchaseRecords.filter(r => isMaintenanceCost(r.category)).reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const itCommunicationCost = purchaseRecords.filter(r => isItCost(r.category)).reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const marketingCost     = purchaseRecords.filter(r => isMarketingCost(r.category)).reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const othersPurchaseCost = purchaseRecords.filter(r => isOthersCost(r.category)).reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
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
      // Channel breakdown (new schema)
      cashSales: +cashSales.toFixed(2),
      cardSales: +cardSales.toFixed(2),
      app1Sales: +app1Sales.toFixed(2),
      app2Sales: +app2Sales.toFixed(2),
      app3Sales: +app3Sales.toFixed(2),
      app4Sales: +app4Sales.toFixed(2),
      app5Sales: +app5Sales.toFixed(2),
      app6Sales: +app6Sales.toFixed(2),
      appSalesTotal: +appSalesTotal.toFixed(2),
      // Revenue totals
      netSales: +netSales.toFixed(2),
      foodSales: +foodSales.toFixed(2),
      beverageSales: +beverageSales.toFixed(2),
      totalRevenue: +totalRevenue.toFixed(2),
      // Raw COGS from purchases
      foodCost: +foodCost.toFixed(2),
      beverageCost: +beverageCost.toFixed(2),
      otherCost: +otherCost.toFixed(2),
      totalCOGS: +totalCOGS.toFixed(2),
      // Inventory (Opening + Closing)
      openingInventory: +openingInventory.toFixed(2),
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

    type MonthEntry = { total: number; vat: number; net: number; count: number; taxableNet: number; taxableTotal: number; nonTaxableTotal: number; taxCount: number; nonTaxCount: number };
    const monthMap: Record<string, MonthEntry> = {};
    for (const r of records) {
      const month = r.date.substring(0, 7);
      if (!monthMap[month]) monthMap[month] = { total: 0, vat: 0, net: 0, count: 0, taxableNet: 0, taxableTotal: 0, nonTaxableTotal: 0, taxCount: 0, nonTaxCount: 0 };
      const isNonTax = r.invoiceType === "non-tax";
      monthMap[month].total += toNum(r.totalAmount);
      monthMap[month].vat   += toNum(r.vatAmount);
      monthMap[month].net   += toNum(r.amountBeforeVat);
      monthMap[month].count += 1;
      if (isNonTax) {
        monthMap[month].nonTaxableTotal += toNum(r.totalAmount);
        monthMap[month].nonTaxCount += 1;
      } else {
        monthMap[month].taxableNet   += toNum(r.amountBeforeVat);
        monthMap[month].taxableTotal += toNum(r.totalAmount);
        monthMap[month].taxCount     += 1;
      }
    }

    const result = Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b))
      .map(([month, d]) => ({
        month,
        totalAmount: +d.total.toFixed(2),
        totalVat: +d.vat.toFixed(2),
        netAmount: +d.net.toFixed(2),
        count: d.count,
        taxableNet: +d.taxableNet.toFixed(2),
        taxableTotal: +d.taxableTotal.toFixed(2),
        nonTaxableTotal: +d.nonTaxableTotal.toFixed(2),
        taxCount: d.taxCount,
        nonTaxCount: d.nonTaxCount,
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

    if (month) records = records.filter((r) => r.date.startsWith(month));

    type CatEntry = { total: number; vat: number; net: number; count: number; resolved: string };
    const catMap: Record<string, CatEntry> = {};
    for (const r of records) {
      const raw = r.category || "others";
      const resolved = resolveCat(raw);
      const key = resolved;
      if (!catMap[key]) catMap[key] = { total: 0, vat: 0, net: 0, count: 0, resolved };
      catMap[key].total += toNum(r.totalAmount);
      catMap[key].vat   += toNum(r.vatAmount);
      catMap[key].net   += toNum(r.amountBeforeVat);
      catMap[key].count += 1;
    }

    const result = Object.entries(catMap).sort(([a], [b]) => a.localeCompare(b))
      .map(([, d]) => {
        const groupKey = getCatGroup(d.resolved);
        const grp = GROUP_LABELS[groupKey] ?? { label: groupKey, labelAr: groupKey };
        return {
          category: d.resolved,
          label: CATEGORY_LABELS[d.resolved] ?? d.resolved,
          labelAr: CATEGORY_LABELS_AR[d.resolved] ?? d.resolved,
          groupKey,
          groupLabel: grp.label,
          groupLabelAr: grp.labelAr,
          totalAmount: +d.total.toFixed(2),
          totalVat: +d.vat.toFixed(2),
          netAmount: +d.net.toFixed(2),
          count: d.count,
        };
      });

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error getting category expense report");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
