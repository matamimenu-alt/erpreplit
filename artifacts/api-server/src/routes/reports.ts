import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { salesTable, purchasesTable, employeesTable, expensesTable, inventoryTable, branchTransfersTable, fixedCostTemplatesTable, fixedCostMonthlyValuesTable, expenseTransactionsTable } from "@workspace/db/schema";
import { eq, and, or } from "drizzle-orm";
import { getRestaurantId } from "../lib/restaurant";

const router: IRouter = Router();

function toNum(v: unknown) { return parseFloat(String(v)) || 0; }
function pct(part: number, total: number): number {
  if (!total) return 0;
  return +((part / total) * 100).toFixed(2);
}
function f2(n: number) { return +n.toFixed(2); }

// ─── Legacy category normalisation ────────────────────────────────────────────
const LEGACY_MAP: Record<string, string> = {
  "cost-food": "food-poultry", "food": "food-poultry", "food-meat": "food-poultry",
  "food-seafood": "food-supplies", "food-other": "food-supplies",
  "cost-beverage": "bev-juices", "beverage": "bev-juices", "bev-coffee": "bev-juices",
  "bev-spices": "bev-juices", "bev-cold": "bev-soft",
  "bev-hot-materials": "bev-juices", "bev-cold-materials": "bev-soft",
  "cost-general": "gen-kitchen", "other": "gen-kitchen",
  "gen-consumables": "gen-cashier", "gen-delivery": "gen-packaging",
  "fuel-energy": "fuel-gas",
  "maintenance": "maint-services",
  "it-communication": "it-internet",
  "marketing": "mkt-campaigns",
  "others": "others-misc",
};
function resolveCat(cat: string): string { return LEGACY_MAP[cat] ?? cat; }

// ─── COGS classifiers ─────────────────────────────────────────────────────────
function isFoodCost(cat: string)      { return resolveCat(cat).startsWith("food-"); }
function isBeverageCost(cat: string)  { return resolveCat(cat).startsWith("bev-"); }
function isGeneralCogs(cat: string)   { return resolveCat(cat).startsWith("gen-"); }

// Cooking fuel = DIRECT production input → COGS
// (gas cylinders & charcoal used in kitchen/grilling)
function isCookingFuel(cat: string) {
  const r = resolveCat(cat);
  return r === "fuel-charcoal" || r === "fuel-gas";
}

// ─── Purchase Operating Expense classifiers (non-COGS) ───────────────────────
// Vehicle fuel & utility bills that come as purchase invoices → OpEx
function isPurchaseVehicleFuel(cat: string) {
  const r = resolveCat(cat);
  return r === "fuel-vehicle" || r === "fuel-utilities";
}
function isPurchaseMaintenance(cat: string) { return resolveCat(cat).startsWith("maint-"); }
function isPurchaseIT(cat: string)          { return resolveCat(cat).startsWith("it-"); }
function isPurchaseMarketing(cat: string)   { return resolveCat(cat).startsWith("mkt-"); }
function isPurchaseOthers(cat: string)      { return resolveCat(cat).startsWith("others-") || resolveCat(cat) === "others"; }

// ─── Category labels ──────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  "food-poultry": "Poultry & Meat", "food-vegetables": "Vegetables & Fruits",
  "food-dairy": "Milk & Dairy", "food-spices": "Spices & Seasoning",
  "food-products": "Food Products & Desserts", "food-supplies": "Food Supplies & Oils",
  "bev-juices": "Juices", "bev-water": "Mineral Water", "bev-soft": "Soft Drinks",
  "gen-cashier": "Cashier Supplies", "gen-kitchen": "Kitchen Supplies",
  "gen-cleaning": "Cleaning Supplies", "gen-packaging": "Packaging & Paper",
  "fuel-vehicle": "Vehicle Fuel", "fuel-charcoal": "Charcoal",
  "fuel-gas": "Gas", "fuel-utilities": "Electricity & Water (Utility Bill)",
  "maint-services": "Maintenance Services", "maint-materials": "Maintenance Materials",
  "it-internet": "Internet", "it-phones": "Telephones",
  "mkt-campaigns": "Advertising Campaigns", "mkt-promo": "Promotion / Distribution",
  "others-misc": "Miscellaneous",
};
const CATEGORY_LABELS_AR: Record<string, string> = {
  "food-poultry": "الدواجن واللحوم", "food-vegetables": "الخضروات والفواكه",
  "food-dairy": "الحليب والألبان", "food-spices": "بهارات وتوابل",
  "food-products": "منتجات غذائية وحلويات", "food-supplies": "مواد غذائية وزيوت",
  "bev-juices": "عصائر", "bev-water": "مياه معدنية", "bev-soft": "مشروبات غازية",
  "gen-cashier": "مستلزمات الكاشير", "gen-kitchen": "مستلزمات المطبخ",
  "gen-cleaning": "مستلزمات التنظيف", "gen-packaging": "التغليف والورقيات",
  "fuel-vehicle": "محروقات سيارات", "fuel-charcoal": "الفحم",
  "fuel-gas": "الغاز", "fuel-utilities": "فاتورة كهرباء/مياه",
  "maint-services": "خدمات صيانة", "maint-materials": "مواد صيانة",
  "it-internet": "الإنترنت", "it-phones": "الاتصالات / تلفونات",
  "mkt-campaigns": "حملات إعلانية", "mkt-promo": "ترويج وتوزيع",
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
function getCatGroup(r: string): string {
  if (r.startsWith("food-"))  return "food";
  if (r.startsWith("bev-"))   return "beverage";
  if (r.startsWith("gen-"))   return "general";
  if (r.startsWith("fuel-"))  return "fuel";
  if (r.startsWith("maint-")) return "maintenance";
  if (r.startsWith("it-"))    return "it";
  if (r.startsWith("mkt-"))   return "marketing";
  return "others";
}

// ─── GET /api/reports/pl ──────────────────────────────────────────────────────
router.get("/pl", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const month = req.query.month as string | undefined;

    // ── Raw data fetch ──────────────────────────────────────────────────────
    let salesRecords = await db.select().from(salesTable)
      .where(eq(salesTable.restaurantId, restaurantId)).orderBy(salesTable.date);
    let purchaseRecords = await db.select().from(purchasesTable)
      .where(eq(purchasesTable.restaurantId, restaurantId)).orderBy(purchasesTable.date);
    if (month) {
      salesRecords    = salesRecords.filter(r => r.date.startsWith(month));
      purchaseRecords = purchaseRecords.filter(r => r.date.startsWith(month));
    }

    // ── [1] REVENUE ─────────────────────────────────────────────────────────
    const cashSales    = salesRecords.reduce((s, r) => s + toNum(r.cash), 0);
    const cardSales    = salesRecords.reduce((s, r) => s + toNum(r.card), 0);
    const app1Sales    = salesRecords.reduce((s, r) => s + toNum(r.app1), 0);
    const app2Sales    = salesRecords.reduce((s, r) => s + toNum(r.app2), 0);
    const app3Sales    = salesRecords.reduce((s, r) => s + toNum(r.app3), 0);
    const app4Sales    = salesRecords.reduce((s, r) => s + toNum(r.app4), 0);
    const app5Sales    = salesRecords.reduce((s, r) => s + toNum(r.app5), 0);
    const app6Sales    = salesRecords.reduce((s, r) => s + toNum(r.app6), 0);
    const appSalesTotal = app1Sales + app2Sales + app3Sales + app4Sales + app5Sales + app6Sales;
    const netSales      = salesRecords.reduce((s, r) => s + toNum(r.netSales), 0);
    const totalRevenue  = salesRecords.reduce((s, r) => s + toNum(r.totalRevenue), 0);
    const outputVat     = salesRecords.reduce((s, r) => s + toNum(r.outputVat), 0);
    const foodSales     = netSales;
    const beverageSales = 0;

    // ── [2] COGS from purchases ─────────────────────────────────────────────
    // ▸ Food / Beverage / General Consumables
    const foodCost     = purchaseRecords.filter(r => isFoodCost(r.category)).reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const beverageCost = purchaseRecords.filter(r => isBeverageCost(r.category)).reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const otherCost    = purchaseRecords.filter(r => isGeneralCogs(r.category)).reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    // ▸ Cooking fuel (gas & charcoal) = direct production input → COGS, NOT OpEx
    const cookingFuelCost = purchaseRecords.filter(r => isCookingFuel(r.category)).reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const totalCOGS    = foodCost + beverageCost + otherCost + cookingFuelCost;
    const inputVat     = purchaseRecords.reduce((s, r) => s + toNum(r.vatAmount), 0);

    // ── Inventory adjustment (Opening + Purchases − Closing = Actual COGS) ──
    let closingFoodInventory = 0, closingBeverageInventory = 0, closingGeneralInventory = 0;
    let openingInventory = 0;
    if (month) {
      const [inv] = await db.select().from(inventoryTable)
        .where(and(eq(inventoryTable.restaurantId, restaurantId), eq(inventoryTable.month, month)));
      if (inv) {
        closingFoodInventory     = toNum(inv.foodInventory);
        closingBeverageInventory = toNum(inv.beverageInventory);
        closingGeneralInventory  = toNum(inv.generalInventory);
      }
      const [y, m] = month.split("-").map(Number);
      const prevDate  = new Date(y, m - 2, 1);
      const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
      const [prevInv] = await db.select().from(inventoryTable)
        .where(and(eq(inventoryTable.restaurantId, restaurantId), eq(inventoryTable.month, prevMonth)));
      if (prevInv) openingInventory = toNum(prevInv.foodInventory) + toNum(prevInv.beverageInventory) + toNum(prevInv.generalInventory);
    }
    const totalInventoryAdjustment = closingFoodInventory + closingBeverageInventory + closingGeneralInventory;
    const adjustedFoodCost     = Math.max(0, foodCost - closingFoodInventory);
    const adjustedBeverageCost = Math.max(0, beverageCost - closingBeverageInventory);
    const adjustedOtherCost    = Math.max(0, otherCost - closingGeneralInventory);
    const adjustedCOGSBeforeTransfers = openingInventory + adjustedFoodCost + adjustedBeverageCost + adjustedOtherCost + cookingFuelCost;

    // ── Internal Branch Transfers impact on COGS ────────────────────────────
    let allTransfers = await db.select().from(branchTransfersTable)
      .where(or(eq(branchTransfersTable.fromRestaurantId, restaurantId), eq(branchTransfersTable.toRestaurantId, restaurantId)));
    if (month) allTransfers = allTransfers.filter(t => t.transferDate.startsWith(month));
    const transfersInCost  = allTransfers.filter(t => t.toRestaurantId === restaurantId).reduce((s, t) => s + toNum(t.quantity) * toNum(t.unitPrice), 0);
    const transfersOutCost = allTransfers.filter(t => t.fromRestaurantId === restaurantId && t.toRestaurantId !== null && t.toRestaurantId !== restaurantId).reduce((s, t) => s + toNum(t.quantity) * toNum(t.unitPrice), 0);
    const netTransferCOGS  = transfersInCost - transfersOutCost;
    const adjustedCOGS     = adjustedCOGSBeforeTransfers + netTransferCOGS;

    // ── GROSS PROFIT ────────────────────────────────────────────────────────
    const grossProfit = totalRevenue - adjustedCOGS;

    // ── [3] PURCHASE OPERATING EXPENSES (non-COGS purchase categories) ──────
    // SOURCE RULE: purchase module owns these specific categories
    // Vehicle fuel (not cooking), utility bills via purchase invoice, maintenance, IT, marketing
    const purchaseVehicleFuel   = purchaseRecords.filter(r => isPurchaseVehicleFuel(r.category)).reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const purchaseMaintenance   = purchaseRecords.filter(r => isPurchaseMaintenance(r.category)).reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const purchaseIT            = purchaseRecords.filter(r => isPurchaseIT(r.category)).reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const purchaseMarketing     = purchaseRecords.filter(r => isPurchaseMarketing(r.category)).reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const purchaseOthers        = purchaseRecords.filter(r => isPurchaseOthers(r.category)).reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const totalPurchaseOpex     = purchaseVehicleFuel + purchaseMaintenance + purchaseIT + purchaseMarketing + purchaseOthers;
    // Backward-compat aliases
    const fuelEnergyCost        = purchaseVehicleFuel;
    const maintenanceCost       = purchaseMaintenance;
    const itCommunicationCost   = purchaseIT;
    const marketingCost         = purchaseMarketing;
    const othersPurchaseCost    = purchaseOthers;

    // ── [4] PAYROLL EXPENSES — SOURCE RULE: HR Module is the ONLY source ────
    // Salary + Overtime − Deductions − Absences per employee
    // ⚠ Fixed Cost templates with category='staff-salaries' are EXCLUDED to prevent double-counting
    const employees     = await db.select().from(employeesTable).where(eq(employeesTable.restaurantId, restaurantId));
    const payrollExpenses = employees.reduce((s, e) => {
      return s + Math.max(0, toNum(e.salary) + toNum(e.overtime) - toNum(e.deductions) - toNum(e.absences));
    }, 0);
    const totalLaborCost = payrollExpenses; // backward-compat alias

    // Legacy staff & commissions from expensesTable (non-payroll HR costs: iqama, visa, tickets)
    const legacyExpenses      = await db.select().from(expensesTable).where(eq(expensesTable.restaurantId, restaurantId));
    const totalStaffExpenses  = legacyExpenses.filter(e => e.category === "staff-expenses").reduce((s, e) => s + toNum(e.monthlyCost), 0);
    const totalAppCommissions = legacyExpenses.filter(e => e.category === "app-commission").reduce((s, e) => s + toNum(e.monthlyCost), 0);
    // Legacy fixed (kept for backward compat, may overlap with dynamic — prefer dynamic)
    const totalFixedExpenses  = legacyExpenses.filter(e => (e.category ?? "fixed") === "fixed").reduce((s, e) => s + toNum(e.monthlyCost), 0);

    // ── [5] FIXED EXPENSES — SOURCE RULE: Fixed Cost Templates (excl. staff-salaries) ──
    // ⚠ 'staff-salaries' is EXCLUDED here — payroll module owns all HR costs
    // ⚠ If 'apps-subscriptions' = software subscriptions (NOT delivery commissions), keep it
    const fcTemplates = await db.select().from(fixedCostTemplatesTable)
      .where(and(eq(fixedCostTemplatesTable.restaurantId, restaurantId), eq(fixedCostTemplatesTable.isActive, true)));
    let totalDynamicFixedCosts = 0;
    const dynamicBreakdown: Record<string, number> = {};
    if (fcTemplates.length > 0) {
      const fcOverrides = month
        ? await db.select().from(fixedCostMonthlyValuesTable)
            .where(and(eq(fixedCostMonthlyValuesTable.restaurantId, restaurantId), eq(fixedCostMonthlyValuesTable.month, month)))
        : [];
      const overrideMap = new Map(fcOverrides.map(o => [o.templateId, toNum(o.amount)]));
      for (const t of fcTemplates) {
        // DUPLICATE PREVENTION: skip 'staff-salaries' — these are accounted for in Payroll above
        if (t.category === "staff-salaries") continue;
        const amt = overrideMap.has(t.id) ? overrideMap.get(t.id)! : toNum(t.defaultAmount);
        totalDynamicFixedCosts += amt;
        dynamicBreakdown[t.category] = (dynamicBreakdown[t.category] ?? 0) + amt;
      }
    }

    // ── [6] EXPENSE LEDGER — SOURCE RULE: Operational & Administrative only ─
    // Only MANUAL entries. Auto-generated mirrors are excluded.
    // 5-2-x (HR): EXCLUDED — Payroll module is the single source of truth for HR costs
    // 5-3-x (Government): surfaced as its own P&L section
    // 5-7-x (Rent): included here only if entered manually (and user should not also have it in Fixed Costs)
    let expTxns = await db.select().from(expenseTransactionsTable)
      .where(and(
        eq(expenseTransactionsTable.restaurantId, restaurantId),
        eq(expenseTransactionsTable.isAutoGenerated, false),
      ));
    if (month) expTxns = expTxns.filter(t => t.month === month);

    const ledgerByCode = (prefix: string) =>
      expTxns.filter(t => t.categoryCode.startsWith(prefix)).reduce((s, t) => s + toNum(t.amount), 0);

    // 5-1-x Operational (cleaned of 5-2-x payroll)
    const ledgerCleaning     = ledgerByCode("5-1-1");
    const ledgerFuel         = ledgerByCode("5-1-2");
    const ledgerUtilities    = ledgerByCode("5-1-3");
    const ledgerMaintenance  = ledgerByCode("5-1-4");
    const ledgerTools        = ledgerByCode("5-1-5");
    const ledgerMarketing    = ledgerByCode("5-1-6");
    const ledgerOperational  = ledgerCleaning + ledgerFuel + ledgerUtilities + ledgerMaintenance + ledgerTools + ledgerMarketing;

    // 5-2-x HR → EXCLUDED from P&L total (payroll is the source)
    const ledgerHR           = ledgerByCode("5-2"); // tracked but NOT added to any total

    // 5-3-x Government Fees → SEPARATE SECTION in P&L
    const govLaborOffice     = expTxns.filter(t => t.categoryCode === "5-3-1").reduce((s, t) => s + toNum(t.amount), 0);
    const govPassport        = expTxns.filter(t => t.categoryCode === "5-3-2").reduce((s, t) => s + toNum(t.amount), 0);
    const govSponsor         = expTxns.filter(t => t.categoryCode === "5-3-3").reduce((s, t) => s + toNum(t.amount), 0);
    const govOther           = expTxns.filter(t => t.categoryCode === "5-3-4").reduce((s, t) => s + toNum(t.amount), 0);
    const totalGovernmentFees = govLaborOffice + govPassport + govSponsor + govOther;

    // 5-4-x Administrative
    const ledgerAdmin        = ledgerByCode("5-4");
    // 5-5-x Financial
    const ledgerFinancial    = ledgerByCode("5-5");
    // 5-6-x Transport/Vehicles
    const ledgerTransport    = ledgerByCode("5-6");
    // 5-7-x Rent (manual — if also in Fixed Costs templates this is a user data entry issue)
    const ledgerRent         = ledgerByCode("5-7");
    // 5-8-x Other
    const ledgerOther        = ledgerByCode("5-8");

    // Total from Expense Ledger (EXCLUDING 5-2-x HR — payroll owns that)
    const totalExpenseTxnNet = ledgerOperational + totalGovernmentFees + ledgerAdmin + ledgerFinancial + ledgerTransport + ledgerRent + ledgerOther;
    const totalExpenseTxnVat   = expTxns.filter(t => !t.categoryCode.startsWith("5-2")).reduce((s, t) => s + toNum(t.vatAmount), 0);
    const totalExpenseTxnTotal = expTxns.filter(t => !t.categoryCode.startsWith("5-2")).reduce((s, t) => s + toNum(t.totalAmount), 0);

    // ── [7] TOTALS & EBITDA ─────────────────────────────────────────────────
    // Each cost type comes from exactly ONE module — no overlaps:
    //   COGS          ← Purchases (food, bev, gen, cooking fuel) + Inventory + Transfers
    //   Purchase OpEx ← Purchases (vehicle fuel, maintenance, IT, marketing, others)
    //   OpEx Ledger   ← Expense Ledger manual entries (operational, admin, financial, transport, rent, other)
    //   Govt Fees     ← Expense Ledger 5-3-x
    //   Payroll       ← HR Module (employees table)
    //   Fixed         ← Fixed Cost Templates (excl. staff-salaries)
    //   Commissions   ← Legacy Expenses (app-commission category)
    //   Staff Expenses← Legacy Expenses (iqama, visa, tickets)
    const totalOperatingExpenses =
      totalPurchaseOpex        // from purchases
      + totalExpenseTxnNet     // from expense ledger (excl. HR)
      + payrollExpenses        // from HR module
      + totalStaffExpenses     // from legacy (iqama, visa, etc.)
      + totalDynamicFixedCosts // from fixed cost templates (excl. staff-salaries)
      + totalFixedExpenses     // from legacy fixed costs
      + totalAppCommissions;   // from legacy app commissions

    const ebitda       = grossProfit - totalOperatingExpenses;
    const vatPayable   = outputVat - inputVat;
    const netProfit    = ebitda - vatPayable;
    const operatingProfit = ebitda; // alias for backward compat

    res.json({
      month: month ?? "all",

      // ── Revenue ────────────────────────────────────────────────────────────
      cashSales:    f2(cashSales),
      cardSales:    f2(cardSales),
      app1Sales:    f2(app1Sales),
      app2Sales:    f2(app2Sales),
      app3Sales:    f2(app3Sales),
      app4Sales:    f2(app4Sales),
      app5Sales:    f2(app5Sales),
      app6Sales:    f2(app6Sales),
      appSalesTotal: f2(appSalesTotal),
      netSales:     f2(netSales),
      foodSales:    f2(foodSales),
      beverageSales: f2(beverageSales),
      totalRevenue: f2(totalRevenue),

      // ── COGS (now includes cooking fuel) ───────────────────────────────────
      foodCost:            f2(foodCost),
      beverageCost:        f2(beverageCost),
      otherCost:           f2(otherCost),
      cookingFuelCost:     f2(cookingFuelCost),   // gas & charcoal = direct production cost
      totalCOGS:           f2(totalCOGS),

      // Inventory adjustment
      openingInventory:           f2(openingInventory),
      closingFoodInventory:       f2(closingFoodInventory),
      closingBeverageInventory:   f2(closingBeverageInventory),
      closingGeneralInventory:    f2(closingGeneralInventory),
      totalInventoryAdjustment:   f2(totalInventoryAdjustment),
      adjustedFoodCost:           f2(adjustedFoodCost),
      adjustedBeverageCost:       f2(adjustedBeverageCost),
      adjustedOtherCost:          f2(adjustedOtherCost),

      // Branch transfers
      transfersInCost:  f2(transfersInCost),
      transfersOutCost: f2(transfersOutCost),
      netTransferCOGS:  f2(netTransferCOGS),

      // Final COGS
      adjustedCOGS:    f2(adjustedCOGS),
      grossProfit:     f2(grossProfit),
      grossMarginPercent: pct(grossProfit, totalRevenue),
      foodCostPercent:    pct(adjustedFoodCost, foodSales),
      beverageCostPercent: pct(adjustedBeverageCost, beverageSales),

      // ── Purchase OpEx (non-COGS) ───────────────────────────────────────────
      // SOURCE: Purchases module only
      // Vehicle fuel, utility bills, maintenance, IT, marketing bought via purchase invoices
      fuelEnergyCost:      f2(purchaseVehicleFuel),    // vehicle fuel only (cooking fuel moved to COGS)
      maintenanceCost:     f2(purchaseMaintenance),
      itCommunicationCost: f2(purchaseIT),
      marketingCost:       f2(purchaseMarketing),
      othersPurchaseCost:  f2(purchaseOthers),
      totalPurchaseOpex:   f2(totalPurchaseOpex),

      // ── Expense Ledger OpEx breakdown ─────────────────────────────────────
      // SOURCE: Expense Ledger (manual entries only, 5-2-x HR excluded)
      ledgerOpex: {
        // 5-1-x Operational
        cleaning:    f2(ledgerCleaning),
        fuel:        f2(ledgerFuel),
        utilities:   f2(ledgerUtilities),
        maintenance: f2(ledgerMaintenance),
        tools:       f2(ledgerTools),
        marketing:   f2(ledgerMarketing),
        totalOperational: f2(ledgerOperational),
        // 5-3-x Government (own section)
        government:  f2(totalGovernmentFees),
        // 5-4 Admin
        administrative: f2(ledgerAdmin),
        // 5-5 Financial
        financial:   f2(ledgerFinancial),
        // 5-6 Transport
        transport:   f2(ledgerTransport),
        // 5-7 Rent (manual)
        rent:        f2(ledgerRent),
        // 5-8 Other
        other:       f2(ledgerOther),
        // EXCLUDED from totals (HR owned by payroll):
        hrExcluded:  f2(ledgerHR),
        // Grand total from ledger (excl. HR)
        total:       f2(totalExpenseTxnNet),
      },

      // ── Government Fees (dedicated section) ────────────────────────────────
      // SOURCE: Expense Ledger 5-3-x ONLY
      governmentFees: {
        laborOffice: f2(govLaborOffice),
        passport:    f2(govPassport),
        sponsorship: f2(govSponsor),
        other:       f2(govOther),
        total:       f2(totalGovernmentFees),
      },

      // ── Payroll Expenses ───────────────────────────────────────────────────
      // SOURCE: HR Module (employees table) — ONLY source for HR costs
      // ⚠ Fixed Cost templates with 'staff-salaries' are skipped to prevent double-counting
      totalLaborCost:      f2(payrollExpenses),
      payrollExpenses:     f2(payrollExpenses),
      totalStaffExpenses:  f2(totalStaffExpenses),  // iqama, visa, tickets (legacy)

      // ── Fixed Expenses ─────────────────────────────────────────────────────
      // SOURCE: Fixed Cost Templates (staff-salaries excluded to prevent double-count)
      totalFixedExpenses:      f2(totalFixedExpenses),     // legacy
      totalDynamicFixedCosts:  f2(totalDynamicFixedCosts), // new templates (excl. staff-salaries)
      dynamicFixedBreakdown:   dynamicBreakdown,

      // ── App Commissions ────────────────────────────────────────────────────
      // SOURCE: Legacy Expenses table (app-commission category)
      totalAppCommissions: f2(totalAppCommissions),

      // ── Totals ─────────────────────────────────────────────────────────────
      totalOperatingExpenses: f2(totalOperatingExpenses),
      operatingProfit:        f2(ebitda),   // backward compat alias
      ebitda:                 f2(ebitda),

      // ── VAT ────────────────────────────────────────────────────────────────
      outputVat:  f2(outputVat),
      inputVat:   f2(inputVat),
      vatPayable: f2(vatPayable),

      // ── Net Profit ─────────────────────────────────────────────────────────
      netProfit:        f2(netProfit),
      netMarginPercent: pct(netProfit, totalRevenue),

      // ── Expense Accounting (full breakdown for Expense Ledger page) ────────
      expenseAccounting: {
        totalNet:   f2(totalExpenseTxnNet),
        totalVat:   f2(totalExpenseTxnVat),
        totalGross: f2(totalExpenseTxnTotal),
        byCategory: {
          operational:    f2(ledgerOperational),
          humanResources: f2(ledgerHR),   // excluded from P&L total
          government:     f2(totalGovernmentFees),
          administrative: f2(ledgerAdmin),
          financial:      f2(ledgerFinancial),
          transport:      f2(ledgerTransport),
          rent:           f2(ledgerRent),
          other:          f2(ledgerOther),
        },
      },
    });
  } catch (err) {
    req.log.error({ err }, "Error getting P&L report");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/reports/purchases/monthly ──────────────────────────────────────
router.get("/purchases/monthly", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const records = await db.select().from(purchasesTable)
      .where(eq(purchasesTable.restaurantId, restaurantId)).orderBy(purchasesTable.date);

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
    const result = Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b)).map(([month, d]) => ({
      month,
      totalAmount:     f2(d.total),
      totalVat:        f2(d.vat),
      netAmount:       f2(d.net),
      count:           d.count,
      taxableNet:      f2(d.taxableNet),
      taxableTotal:    f2(d.taxableTotal),
      nonTaxableTotal: f2(d.nonTaxableTotal),
      taxCount:        d.taxCount,
      nonTaxCount:     d.nonTaxCount,
    }));
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error getting monthly purchase report");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/reports/purchases/by-category ──────────────────────────────────
router.get("/purchases/by-category", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const month = req.query.month as string | undefined;
    let records = await db.select().from(purchasesTable)
      .where(eq(purchasesTable.restaurantId, restaurantId)).orderBy(purchasesTable.date);
    if (month) records = records.filter(r => r.date.startsWith(month));

    type CatEntry = { total: number; vat: number; net: number; count: number; resolved: string };
    const catMap: Record<string, CatEntry> = {};
    for (const r of records) {
      const resolved = resolveCat(r.category || "others");
      if (!catMap[resolved]) catMap[resolved] = { total: 0, vat: 0, net: 0, count: 0, resolved };
      catMap[resolved].total += toNum(r.totalAmount);
      catMap[resolved].vat   += toNum(r.vatAmount);
      catMap[resolved].net   += toNum(r.amountBeforeVat);
      catMap[resolved].count += 1;
    }
    const result = Object.entries(catMap).sort(([a], [b]) => a.localeCompare(b)).map(([, d]) => {
      const groupKey = getCatGroup(d.resolved);
      const grp = GROUP_LABELS[groupKey] ?? { label: groupKey, labelAr: groupKey };
      return {
        category:     d.resolved,
        label:        CATEGORY_LABELS[d.resolved] ?? d.resolved,
        labelAr:      CATEGORY_LABELS_AR[d.resolved] ?? d.resolved,
        groupKey,
        groupLabel:   grp.label,
        groupLabelAr: grp.labelAr,
        totalAmount:  f2(d.total),
        totalVat:     f2(d.vat),
        netAmount:    f2(d.net),
        count:        d.count,
      };
    });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error getting category expense report");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
