import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { salesTable, purchasesTable, employeesTable, inventoryTable, branchTransfersTable, fixedCostTemplatesTable, fixedCostMonthlyValuesTable, expenseTransactionsTable, expenseCategoriesTable } from "@workspace/db/schema";
import { eq, and, or } from "drizzle-orm";
import { getRestaurantId } from "../lib/restaurant";
import { computeVatSummary } from "../lib/vat-engine";

const router: IRouter = Router();

function toNum(v: unknown) { return parseFloat(String(v)) || 0; }
function pct(part: number, total: number): number {
  if (!total) return 0;
  return +((part / total) * 100).toFixed(2);
}
function f2(n: number) { return +n.toFixed(2); }

// VAT helper for fixed costs (same logic as in fixed-costs route)
function computeFixedVat(amount: number, vatType: string, vatRate: number) {
  const rate = (vatRate || 15) / 100;
  if (!vatType || vatType === "none" || amount === 0) return { base: amount, vatAmount: 0 };
  if (vatType === "included") {
    const base = +(amount / (1 + rate)).toFixed(2);
    return { base, vatAmount: +(amount - base).toFixed(2) };
  }
  const vatAmount = +(amount * rate).toFixed(2);
  return { base: +amount.toFixed(2), vatAmount };
}

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

    // ── Internal Branch Transfers impact on COGS & VAT ──────────────────────
    // COGS uses NET cost (before VAT) — VAT is tracked separately per branch
    // Rule: VAT travels WITH the goods — it is NOT copied.
    //   Sender: COGS decreases by net cost transferred; Input VAT decreases by VAT transferred
    //   Receiver: COGS increases by net cost received; Input VAT increases by VAT received
    let allTransfers = await db.select().from(branchTransfersTable)
      .where(or(eq(branchTransfersTable.fromRestaurantId, restaurantId), eq(branchTransfersTable.toRestaurantId, restaurantId)));
    if (month) allTransfers = allTransfers.filter(t => t.transferDate.startsWith(month));

    const inboundTransfers  = allTransfers.filter(t => t.toRestaurantId === restaurantId);
    const outboundTransfers = allTransfers.filter(t => t.fromRestaurantId === restaurantId && t.toRestaurantId !== null && t.toRestaurantId !== restaurantId);

    // NET cost transfers (for COGS adjustment — VAT excluded, same as before)
    const transfersInCost   = inboundTransfers.reduce((s, t) => s + toNum(t.quantity) * toNum(t.unitPrice), 0);
    const transfersOutCost  = outboundTransfers.reduce((s, t) => s + toNum(t.quantity) * toNum(t.unitPrice), 0);
    const netTransferCOGS   = transfersInCost - transfersOutCost;

    // VAT allocation per branch (for VAT report accuracy)
    const transfersVatOut   = outboundTransfers.reduce((s, t) => s + toNum(t.vatAmount), 0);
    const transfersVatIn    = inboundTransfers.reduce((s, t) => s + toNum(t.vatAmount), 0);
    const netTransferVat    = transfersVatIn - transfersVatOut;

    // Gross (net + VAT) transfer values — for full-cost transparency
    const transfersInGross  = transfersInCost  + transfersVatIn;
    const transfersOutGross = transfersOutCost + transfersVatOut;

    const adjustedCOGS      = adjustedCOGSBeforeTransfers + netTransferCOGS;

    // ── GROSS PROFIT ────────────────────────────────────────────────────────
    // IFRS-style: ALL profitability uses NET (Ex-VAT) revenue. VAT is a
    // pass-through liability and MUST NOT inflate profit. `totalRevenue`
    // (= cash + card + apps as entered at POS) is VAT-inclusive whenever
    // priceIncludesVat=true, so we must use `netSales` here.
    const grossProfit = netSales - adjustedCOGS;

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

    // Legacy `expensesTable` is deprecated as of the Expenses Management merge.
    // All recurring items (rent, utilities, staff-expenses, app-commission,
    // operating) now live in `fixed_cost_templates` (see migration). Reading
    // here is kept at 0 to preserve the field shape for downstream consumers.
    const totalStaffExpenses  = 0;
    const totalAppCommissions = 0;
    const totalFixedExpenses  = 0;

    // ── [5] FIXED EXPENSES — SOURCE RULE: Fixed Cost Templates (excl. staff-salaries) ──
    // ⚠ 'staff-salaries' is EXCLUDED here — payroll module owns all HR costs
    // ⚠ If 'apps-subscriptions' = software subscriptions (NOT delivery commissions), keep it
    const fcTemplates = await db.select().from(fixedCostTemplatesTable)
      .where(and(eq(fixedCostTemplatesTable.restaurantId, restaurantId), eq(fixedCostTemplatesTable.isActive, true)));
    let totalDynamicFixedCosts = 0;
    let totalDynamicFixedVat   = 0;
    const dynamicBreakdown: Record<string, number> = {};
    if (fcTemplates.length > 0) {
      const fcOverrides = month
        ? await db.select().from(fixedCostMonthlyValuesTable)
            .where(and(eq(fixedCostMonthlyValuesTable.restaurantId, restaurantId), eq(fixedCostMonthlyValuesTable.month, month)))
        : [];
      const overrideMap = new Map(fcOverrides.map(o => [o.templateId, toNum(o.amount)]));
      for (const t of fcTemplates) {
        // DUPLICATE PREVENTION: skip 'staff-salaries' — accounted for in Payroll above
        if (t.category === "staff-salaries") continue;
        const enteredAmt = overrideMap.has(t.id) ? overrideMap.get(t.id)! : toNum(t.defaultAmount);
        const vatType = t.vatType ?? "none";
        const vatRate = toNum(t.vatRate ?? "15.00");
        const { base, vatAmount } = computeFixedVat(enteredAmt, vatType, vatRate);
        // P&L expense = NET amount before VAT (VAT on fixed costs = reclaimable input VAT)
        totalDynamicFixedCosts += base;
        totalDynamicFixedVat   += vatAmount;
        dynamicBreakdown[t.category] = (dynamicBreakdown[t.category] ?? 0) + base;
      }
    }

    // ── [6] EXPENSE LEDGER — SOURCE RULE: all non-HR ledger entries ─────────
    // Only MANUAL entries. Auto-generated mirrors are excluded.
    // HR_MAIN_CODE (5-1) is EXCLUDED — Payroll module is the single source
    // of truth for HR costs. The rest is grouped DYNAMICALLY by the level-1
    // main category, so any user-defined or restructured category flows into
    // the right P&L bucket without code changes.
    const HR_MAIN_CODE = "5-1"; // ⚠ kept in sync with CATEGORY_SEED main #1
    let expTxns = await db.select().from(expenseTransactionsTable)
      .where(and(
        eq(expenseTransactionsTable.restaurantId, restaurantId),
        eq(expenseTransactionsTable.isAutoGenerated, false),
      ));
    if (month) expTxns = expTxns.filter(t => t.month === month);

    // Load category tree once — reused for both byMainCategory rollup and the
    // Fixed-vs-Variable classification below.
    const allCats = await db.select().from(expenseCategoriesTable);
    const catByCode = new Map(allCats.map(c => [c.code, c]));

    // Walk up the tree to find the level-1 (main category) ancestor.
    const mainAncestor = (code: string): string => {
      let cur: string | null = code;
      const seen = new Set<string>();
      while (cur && !seen.has(cur)) {
        seen.add(cur);
        const row = catByCode.get(cur);
        if (!row) {
          // Unknown code — synthesise a main code from the first segment
          // (e.g. '5-1-7' → '5-1') so it still rolls up sensibly.
          const parts = code.split("-");
          return parts.length >= 2 ? `${parts[0]}-${parts[1]}` : code;
        }
        if (row.level === 1) return row.code;
        cur = row.parentCode;
      }
      return code;
    };

    // Build per-main-category rollup with leaf breakdown (HR excluded — owned by payroll).
    type LeafRow = { code: string; name: string; nameAr: string; nature: "fixed" | "variable" | null; amount: number };
    type MainRow = { code: string; name: string; nameAr: string; total: number; leaves: LeafRow[] };
    const mainRollup = new Map<string, MainRow>();
    let ledgerHR = 0;
    for (const t of expTxns) {
      const amt = toNum(t.amount);
      const main = mainAncestor(t.categoryCode);
      if (main === HR_MAIN_CODE) { ledgerHR += amt; continue; }
      const mainCat = catByCode.get(main);
      if (!mainRollup.has(main)) {
        mainRollup.set(main, {
          code: main,
          name:   mainCat?.name   ?? main,
          nameAr: mainCat?.nameAr ?? "",
          total: 0,
          leaves: [],
        });
      }
      const row = mainRollup.get(main)!;
      row.total += amt;
      const leaf = catByCode.get(t.categoryCode);
      const existing = row.leaves.find(l => l.code === t.categoryCode);
      if (existing) {
        existing.amount += amt;
      } else {
        row.leaves.push({
          code:   t.categoryCode,
          name:   leaf?.name   ?? t.categoryCode,
          nameAr: leaf?.nameAr ?? "",
          nature: (leaf?.nature === "fixed" || leaf?.nature === "variable") ? leaf.nature : null,
          amount: amt,
        });
      }
    }

    // Total Expense-Ledger net (excluding HR — payroll owns that).
    const totalExpenseTxnNet = expTxns
      .filter(t => mainAncestor(t.categoryCode) !== HR_MAIN_CODE)
      .reduce((s, t) => s + toNum(t.amount), 0);

    // Build the ordered byMainCategory array using the canonical sort order
    // from expense_categories so the P&L always renders 5-2, 5-3, … in the
    // same sequence as the category tree (even when some mains have no
    // transactions yet — those are returned with total=0 and empty leaves).
    const mainCatsOrdered = allCats
      .filter(c => c.level === 1 && c.isActive && c.code !== HR_MAIN_CODE)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const byMainCategory = mainCatsOrdered.map(mc => {
      const r = mainRollup.get(mc.code) ?? { code: mc.code, name: mc.name, nameAr: mc.nameAr, total: 0, leaves: [] };
      r.leaves.sort((a, b) => b.amount - a.amount);
      return {
        code:   r.code,
        name:   r.name,
        nameAr: r.nameAr,
        total:  f2(r.total),
        leaves: r.leaves.map(l => ({ ...l, amount: f2(l.amount) })),
      };
    });
    // Surface unknown/legacy main codes too so nothing is silently dropped.
    for (const [code, r] of mainRollup) {
      if (mainCatsOrdered.some(m => m.code === code)) continue;
      r.leaves.sort((a, b) => b.amount - a.amount);
      byMainCategory.push({
        code: r.code, name: r.name, nameAr: r.nameAr,
        total: f2(r.total),
        leaves: r.leaves.map(l => ({ ...l, amount: f2(l.amount) })),
      });
    }

    // ── Fixed vs Variable classification (single source of truth) ─────────────
    // Every leaf category in `expense_categories` has a `nature` of 'fixed' or
    // 'variable'. We split the ledger totals along that axis, then add the
    // fixed-cost templates (each with their own nature, default 'fixed') and
    // payroll (always fixed). Unmapped rows fall into "unclassified" and
    // raise a diagnostic warning rather than being silently dropped.
    const natureByCode = new Map<string, "fixed" | "variable">();
    for (const c of allCats) {
      if (c.nature === "fixed" || c.nature === "variable") natureByCode.set(c.code, c.nature);
    }
    const findNature = (code: string): "fixed" | "variable" | null => {
      // Try exact, then walk up the tree (5-1-1 → 5-1 → 5)
      if (natureByCode.has(code)) return natureByCode.get(code)!;
      const parts = code.split("-");
      while (parts.length > 1) {
        parts.pop();
        const parent = parts.join("-");
        if (natureByCode.has(parent)) return natureByCode.get(parent)!;
      }
      return null;
    };

    type NatureBucket = {
      total: number;
      bySubcategory: Array<{ code: string; label: string; amount: number; nature: "fixed" | "variable" }>;
    };
    const fixedBucket: NatureBucket    = { total: 0, bySubcategory: [] };
    const variableBucket: NatureBucket = { total: 0, bySubcategory: [] };
    const unclassified: Array<{ code: string; label: string; amount: number }> = [];

    // Aggregate ledger by code → nature
    const ledgerAggByCode = new Map<string, number>();
    for (const t of expTxns) {
      if (mainAncestor(t.categoryCode) === HR_MAIN_CODE) continue; // HR owned by payroll
      ledgerAggByCode.set(t.categoryCode, (ledgerAggByCode.get(t.categoryCode) ?? 0) + toNum(t.amount));
    }
    for (const [code, amt] of ledgerAggByCode) {
      const nature = findNature(code);
      const label = allCats.find(c => c.code === code)?.name ?? code;
      if (nature === "fixed") {
        fixedBucket.total += amt;
        fixedBucket.bySubcategory.push({ code, label, amount: amt, nature });
      } else if (nature === "variable") {
        variableBucket.total += amt;
        variableBucket.bySubcategory.push({ code, label, amount: amt, nature });
      } else {
        unclassified.push({ code, label, amount: amt });
      }
    }

    // Fixed-cost templates — use already-computed dynamicBreakdown for the
    // VAT-exclusive base, and read each template's `nature` (default 'fixed').
    {
      const fcOverridesForNature = month
        ? await db.select().from(fixedCostMonthlyValuesTable)
            .where(and(eq(fixedCostMonthlyValuesTable.restaurantId, restaurantId), eq(fixedCostMonthlyValuesTable.month, month)))
        : [];
      const ovMap = new Map(fcOverridesForNature.map(o => [o.templateId, toNum(o.amount)]));
      for (const t of fcTemplates) {
        if (t.category === "staff-salaries") continue;
        const enteredAmt = ovMap.has(t.id) ? ovMap.get(t.id)! : toNum(t.defaultAmount);
        const { base } = computeFixedVat(enteredAmt, t.vatType ?? "none", toNum(t.vatRate ?? "15.00"));
        if (base === 0) continue;
        const nature = (t.nature === "variable" ? "variable" : "fixed") as "fixed" | "variable";
        const bucket = nature === "fixed" ? fixedBucket : variableBucket;
        bucket.total += base;
        bucket.bySubcategory.push({
          code: `fixed-cost:${t.id}`,
          label: `${t.name} (${t.category})`,
          amount: base,
          nature,
        });
      }
    }

    // Payroll — always fixed
    if (payrollExpenses > 0) {
      fixedBucket.total += payrollExpenses;
      fixedBucket.bySubcategory.push({ code: "payroll", label: "Payroll (HR Module)", amount: payrollExpenses, nature: "fixed" });
    }
    // Staff expenses (legacy iqama/visa) — fixed
    if (totalStaffExpenses > 0) {
      fixedBucket.total += totalStaffExpenses;
      fixedBucket.bySubcategory.push({ code: "legacy-staff", label: "Staff Expenses (legacy)", amount: totalStaffExpenses, nature: "fixed" });
    }
    // Legacy fixed expenses table — fixed
    if (totalFixedExpenses > 0) {
      fixedBucket.total += totalFixedExpenses;
      fixedBucket.bySubcategory.push({ code: "legacy-fixed", label: "Fixed Costs (legacy table)", amount: totalFixedExpenses, nature: "fixed" });
    }
    // Purchase OpEx (vehicle fuel/maintenance/IT/marketing/others) — variable
    if (totalPurchaseOpex > 0) {
      variableBucket.total += totalPurchaseOpex;
      variableBucket.bySubcategory.push({ code: "purchase-opex", label: "Purchase OpEx (vehicle, IT, marketing, …)", amount: totalPurchaseOpex, nature: "variable" });
    }
    // App commissions — variable (depends on order volume)
    if (totalAppCommissions > 0) {
      variableBucket.total += totalAppCommissions;
      variableBucket.bySubcategory.push({ code: "app-commissions", label: "App Commissions", amount: totalAppCommissions, nature: "variable" });
    }

    fixedBucket.bySubcategory.sort((a, b) => b.amount - a.amount);
    variableBucket.bySubcategory.sort((a, b) => b.amount - a.amount);

    const fixedVsVariable = {
      fixedTotal:      f2(fixedBucket.total),
      variableTotal:   f2(variableBucket.total),
      unclassifiedTotal: f2(unclassified.reduce((s, u) => s + u.amount, 0)),
      grandTotal:      f2(fixedBucket.total + variableBucket.total + unclassified.reduce((s, u) => s + u.amount, 0)),
      fixedRatio:      0,
      variableRatio:   0,
      fixed:    fixedBucket.bySubcategory.map(b => ({ ...b, amount: f2(b.amount) })),
      variable: variableBucket.bySubcategory.map(b => ({ ...b, amount: f2(b.amount) })),
      unclassified: unclassified.map(u => ({ ...u, amount: f2(u.amount) })),
    };
    const totalOpExForRatio = fixedBucket.total + variableBucket.total;
    if (totalOpExForRatio > 0) {
      fixedVsVariable.fixedRatio    = +((fixedBucket.total    / totalOpExForRatio) * 100).toFixed(1);
      fixedVsVariable.variableRatio = +((variableBucket.total / totalOpExForRatio) * 100).toFixed(1);
    }
    if (unclassified.length > 0) {
      req.log.warn({ unclassified }, "P&L: expense entries with unmapped nature — falling outside Fixed/Variable totals");
    }
    const totalExpenseTxnVat   = expTxns.filter(t => mainAncestor(t.categoryCode) !== HR_MAIN_CODE).reduce((s, t) => s + toNum(t.vatAmount), 0);
    const totalExpenseTxnTotal = expTxns.filter(t => mainAncestor(t.categoryCode) !== HR_MAIN_CODE).reduce((s, t) => s + toNum(t.totalAmount), 0);

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

    // ── VAT (informational only — NOT included in Net Profit) ─────────────
    // Accounting rule (Saudi VAT, IFRS): VAT is a pass-through liability,
    // not an income/expense. P&L lines are already VAT-exclusive (Net), so
    // Net Profit MUST NOT subtract Net VAT Payable. VAT figures are exposed
    // here purely for cross-referencing the dedicated Zakat & VAT report.
    const vatSummary   = await computeVatSummary({ restaurantId, month });
    const vatPayable   = vatSummary.netVatPayable;          // canonical Net VAT (info only)
    const netProfit    = ebitda;                            // VAT-exclusive net profit
    const operatingProfit = ebitda; // alias for backward compat

    return res.json({
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
      netSales:           f2(netSales),
      foodSales:          f2(foodSales),
      beverageSales:      f2(beverageSales),
      // `totalRevenue` retained for backward compatibility: it is the
      // GROSS (VAT-inclusive when priceIncludesVat=true) revenue actually
      // collected by the POS. It is NOT used for profitability — use
      // `accountingRevenue` (= netSales) for that.
      totalRevenue:       f2(totalRevenue),
      grossSales:         f2(totalRevenue),    // explicit alias
      accountingRevenue:  f2(netSales),        // IFRS-style top line

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

      // Branch transfers — COGS (net cost only, VAT tracked separately)
      transfersInCost:   f2(transfersInCost),
      transfersOutCost:  f2(transfersOutCost),
      netTransferCOGS:   f2(netTransferCOGS),
      // Branch transfers — VAT allocation (VAT travels WITH the goods)
      transfersVatOut:   f2(transfersVatOut),   // VAT that left this branch
      transfersVatIn:    f2(transfersVatIn),    // VAT that arrived at this branch
      netTransferVat:    f2(netTransferVat),    // net VAT impact
      // Gross (cost + VAT) for full-cost transparency in Purchase Report
      transfersOutGross: f2(transfersOutGross),
      transfersInGross:  f2(transfersInGross),

      // Final COGS
      adjustedCOGS:    f2(adjustedCOGS),
      grossProfit:     f2(grossProfit),
      grossMarginPercent: pct(grossProfit, netSales),
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

      // ── Expense Ledger — grouped by Main Category (dynamic) ───────────────
      // SOURCE: Expense Ledger (manual entries only, HR main category excluded —
      // payroll owns HR costs). Every main category from `expense_categories`
      // is rendered in canonical sort order, with leaves underneath. Any new
      // category created by the user appears here automatically.
      byMainCategory,
      ledgerOpex: {
        hrExcluded:  f2(ledgerHR),   // HR total (5-1-x) excluded from P&L
        total:       f2(totalExpenseTxnNet),
      },

      // ── Fixed vs Variable classification (single source of truth) ──────────
      // Splits ALL operating expenses by `nature` from expense_categories.
      // Includes payroll/legacy/purchase-opex/app-commissions in the right bucket.
      // `unclassified` length > 0 means a category is missing its `nature` mapping.
      fixedVsVariable,

      // ── Payroll Expenses ───────────────────────────────────────────────────
      // SOURCE: HR Module (employees table) — ONLY source for HR costs
      // ⚠ Fixed Cost templates with 'staff-salaries' are skipped to prevent double-counting
      totalLaborCost:      f2(payrollExpenses),
      payrollExpenses:     f2(payrollExpenses),
      totalStaffExpenses:  f2(totalStaffExpenses),  // iqama, visa, tickets (legacy)

      // ── Fixed Expenses ─────────────────────────────────────────────────────
      // SOURCE: Fixed Cost Templates (staff-salaries excluded to prevent double-count)
      // P&L uses NET amounts (before VAT). VAT on fixed costs → input VAT in VAT report.
      totalFixedExpenses:      f2(totalFixedExpenses),     // legacy
      totalDynamicFixedCosts:  f2(totalDynamicFixedCosts), // new templates NET (excl. staff-salaries, excl. VAT)
      totalDynamicFixedVat:    f2(totalDynamicFixedVat),   // VAT portion (reclaimable input VAT)
      dynamicFixedBreakdown:   dynamicBreakdown,

      // ── App Commissions ────────────────────────────────────────────────────
      // SOURCE: Legacy Expenses table (app-commission category)
      totalAppCommissions: f2(totalAppCommissions),

      // ── Totals ─────────────────────────────────────────────────────────────
      totalOperatingExpenses: f2(totalOperatingExpenses),
      operatingProfit:        f2(ebitda),   // backward compat alias
      ebitda:                 f2(ebitda),

      // ── VAT (UNIFIED — from lib/vat-engine.ts) ─────────────────────────────
      // These fields MUST match /api/vat/report and /api/dashboard/summary
      // for the same restaurant + month. Any drift is a bug.
      outputVat:               vatSummary.outputVat,
      inputVat:                vatSummary.inputVatRaw,              // purchases only (legacy field)
      inputVatRaw:             vatSummary.inputVatRaw,
      fixedCostInputVat:       vatSummary.fixedCostInputVat,
      expenseLedgerInputVat:   vatSummary.expenseLedgerInputVat,
      vatTransferredOut:       vatSummary.vatTransferredOut,
      vatReceivedIn:           vatSummary.vatReceivedIn,
      adjustedInputVat:        vatSummary.adjustedInputVat,
      vatPayable:              vatSummary.netVatPayable,            // canonical Net VAT Payable
      netVatPayable:           vatSummary.netVatPayable,
      vatDebug:                vatSummary.debug,

      // ── Net Profit ─────────────────────────────────────────────────────────
      netProfit:        f2(netProfit),
      netMarginPercent: pct(netProfit, netSales),

      // ── Expense Accounting (full breakdown for Expense Ledger page) ────────
      // Dynamic: keyed by main-category code (5-2, 5-3, …) plus an
      // `humanResources` key for the HR total that is excluded from the
      // P&L grand total.
      expenseAccounting: {
        totalNet:   f2(totalExpenseTxnNet),
        totalVat:   f2(totalExpenseTxnVat),
        totalGross: f2(totalExpenseTxnTotal),
        byCategory: {
          humanResources: f2(ledgerHR),
          ...Object.fromEntries(byMainCategory.map(m => [m.code, m.total])),
        },
      },
    });
  } catch (err) {
    req.log.error({ err }, "Error getting P&L report");
    return res.status(500).json({ error: "Internal server error" });
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
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error getting monthly purchase report");
    return res.status(500).json({ error: "Internal server error" });
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
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error getting category expense report");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
