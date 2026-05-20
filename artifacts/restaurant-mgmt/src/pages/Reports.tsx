import { useState, useCallback, useEffect, useRef } from "react";
import {
  useGetPLReport,
  useGetMonthlyPurchaseReport,
  useGetCategoryExpenseReport,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetPLReportQueryKey,
  getGetMonthlyPurchaseReportQueryKey,
  getGetCategoryExpenseReportQueryKey,
} from "@workspace/api-client-react";
import { useInvalidateFinancials } from "@/hooks/use-invalidate-financials";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrintButton } from "@/components/ui/PrintButton";
import { formatSAR, formatMonth } from "@/lib/format";
import { exportToExcel } from "@/lib/export-excel";
import {
  TrendingUp, TrendingDown, FileSpreadsheet, RefreshCw,
  ShoppingCart, Users, Building2, Flame, Receipt, Landmark,
  Wrench, Wifi, Megaphone, Truck, Package, AlertTriangle, Info,
} from "lucide-react";

// ─── P&L table helpers ────────────────────────────────────────────────────────
function Row({
  label, value, bold, indent, highlight, percent, sub,
}: {
  label: string; value: number; bold?: boolean; indent?: boolean;
  highlight?: "profit" | "loss" | "neutral"; percent?: number; sub?: string;
}) {
  const col =
    highlight === "profit"  ? "text-emerald-600" :
    highlight === "loss"    ? "text-rose-600" :
    highlight === "neutral" ? "text-slate-700" : "";
  return (
    <tr className={`border-b border-slate-100 ${bold ? "font-bold" : ""}`}>
      <td className={`py-2.5 ${indent ? "pl-10 text-slate-500" : "pl-4 text-slate-800"}`}>
        {label}
        {sub && <span className="block text-[10px] font-normal text-slate-400 mt-0">{sub}</span>}
      </td>
      <td className={`py-2.5 pr-4 text-right tabular-nums ${col} ${bold ? "text-base" : "text-sm"}`}>
        {formatSAR(value)}
      </td>
      {percent !== undefined
        ? <td className="py-2.5 pr-4 text-right text-xs text-slate-400 w-20">{percent.toFixed(1)}%</td>
        : <td className="w-20" />}
    </tr>
  );
}

function SH({ title, icon }: { title: string; icon?: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={3} className="pt-6 pb-1.5 pl-4">
        <div className="flex items-center gap-2">
          {icon && <span className="text-slate-400">{icon}</span>}
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{title}</span>
        </div>
      </td>
    </tr>
  );
}

function Div({ double }: { double?: boolean }) {
  return (
    <tr><td colSpan={3} className="py-0">
      <div className={double ? "border-t-2 border-slate-400" : "border-t border-slate-200"} />
    </td></tr>
  );
}

function OwnershipNote({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <tr>
      <td colSpan={3} className="px-4 pb-1">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          {icon}<span>{text}</span>
        </div>
      </td>
    </tr>
  );
}

// ─── Types ─────────────────────────────────────────────────────────────────────
type Tab = "pl" | "monthly" | "category";

// The P&L API returns additional fields not in the generated type
type PLExtra = {
  cookingFuelCost?: number;
  payrollExpenses?: number;
  ebitda?: number;
  ledgerOpex?: {
    cleaning: number; fuel: number; utilities: number; maintenance: number;
    tools: number; marketing: number; totalOperational: number;
    government: number; administrative: number; financial: number;
    transport: number; rent: number; other: number; hrExcluded: number; total: number;
  };
  governmentFees?: {
    laborOffice: number; passport: number; sponsorship: number; other: number; total: number;
  };
  dynamicFixedBreakdown?: Record<string, number>;
  // Branch transfer VAT allocation
  transfersVatOut?: number;
  transfersVatIn?: number;
  netTransferVat?: number;
  transfersOutGross?: number;
  transfersInGross?: number;
};

export default function Reports() {
  const [tab, setTab]     = useState<Tab>("pl");
  const [month, setMonth] = useState("");
  const queryClient       = useQueryClient();
  const invalidateFinancials = useInvalidateFinancials();

  // Live mode — always refetch on mount AND on window focus so any change made
  // in another tab/page reflects immediately when user returns to the report.
  const liveOpts = {
    query: {
      refetchOnMount: "always" as const,
      refetchOnWindowFocus: true,
      staleTime: 0,
    },
  };
  const { data: plRaw, isLoading: plLoading, isFetching: plFetching, dataUpdatedAt: plUpdatedAt } =
    useGetPLReport(month ? { month } : undefined, liveOpts);
  const { data: monthly, isLoading: monthlyLoading } = useGetMonthlyPurchaseReport(liveOpts);
  const { data: catReport, isLoading: catLoading } = useGetCategoryExpenseReport(
    month ? { month } : undefined,
    liveOpts,
  );

  const pl = plRaw as (typeof plRaw & PLExtra) | undefined;

  // Debug log: P&L data turnover for live-update verification
  const prevUpdatedAtRef = useRef<number>(0);
  useEffect(() => {
    if (plUpdatedAt && plUpdatedAt !== prevUpdatedAtRef.current) {
      prevUpdatedAtRef.current = plUpdatedAt;
      // eslint-disable-next-line no-console
      console.debug(
        "[P&L] data refreshed",
        new Date(plUpdatedAt).toLocaleTimeString(),
        "month=", month || "all",
        "revenue=", pl?.totalRevenue,
        "cogs=", pl?.adjustedCOGS ?? pl?.totalCOGS,
        "netProfit=", pl?.netProfit,
      );
    }
  }, [plUpdatedAt, month, pl?.totalRevenue, pl?.adjustedCOGS, pl?.totalCOGS, pl?.netProfit]);

  const handleRefreshAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetPLReportQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetMonthlyPurchaseReportQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetCategoryExpenseReportQueryKey() });
    invalidateFinancials();
  }, [queryClient, invalidateFinancials]);

  const R = pl?.totalRevenue ?? 0; // denominator for % column

  // ── Derived values ──────────────────────────────────────────────────────────
  const cookingFuel   = pl?.cookingFuelCost ?? 0;
  const adjCOGS       = pl?.adjustedCOGS ?? pl?.totalCOGS ?? 0;
  const ledger        = pl?.ledgerOpex;
  const govFees       = pl?.governmentFees;
  const payroll       = pl?.payrollExpenses ?? pl?.totalLaborCost ?? 0;
  const staffExp      = (pl as unknown as Record<string, number>)?.totalStaffExpenses ?? 0;
  const fixedDyn      = (pl as unknown as Record<string, number>)?.totalDynamicFixedCosts ?? 0;
  const fixedLegacy   = pl?.totalFixedExpenses ?? 0;
  const appCommissions = pl?.totalAppCommissions ?? 0;
  const ebitda        = pl?.ebitda ?? pl?.operatingProfit ?? 0;

  const dynBreakdown  = (pl as unknown as Record<string, unknown>)?.dynamicFixedBreakdown as Record<string, number> | undefined;

  // ── Export P&L ──────────────────────────────────────────────────────────────
  function exportPL() {
    if (!pl) return;
    const rows = [
      { Section: "REVENUE", Item: "Cash Sales",            "SAR": pl.cashSales ?? 0 },
      { Section: "REVENUE", Item: "Card / POS Sales",      "SAR": pl.cardSales ?? 0 },
      { Section: "REVENUE", Item: "Delivery Apps Total",   "SAR": pl.appSalesTotal ?? 0 },
      { Section: "REVENUE", Item: "Total Revenue",         "SAR": pl.totalRevenue },
      { Section: "COGS", Item: "Food Cost",                "SAR": pl.foodCost },
      { Section: "COGS", Item: "Beverage Cost",            "SAR": pl.beverageCost },
      { Section: "COGS", Item: "General / Consumables",    "SAR": pl.otherCost },
      { Section: "COGS", Item: "Cooking Fuel (Gas+Charcoal)", "SAR": cookingFuel },
      { Section: "COGS", Item: "Adjusted COGS",            "SAR": adjCOGS },
      { Section: "GROSS PROFIT", Item: "Gross Profit",     "SAR": pl.grossProfit },
      { Section: "PURCHASE OPEX", Item: "Vehicle Fuel",    "SAR": pl.fuelEnergyCost ?? 0 },
      { Section: "PURCHASE OPEX", Item: "Maintenance",     "SAR": pl.maintenanceCost ?? 0 },
      { Section: "PURCHASE OPEX", Item: "IT & Communication","SAR": pl.itCommunicationCost ?? 0 },
      { Section: "PURCHASE OPEX", Item: "Marketing",       "SAR": pl.marketingCost ?? 0 },
      { Section: "PURCHASE OPEX", Item: "Others",          "SAR": pl.othersPurchaseCost ?? 0 },
      { Section: "LEDGER OPEX", Item: "Utilities",         "SAR": ledger?.utilities ?? 0 },
      { Section: "LEDGER OPEX", Item: "Maintenance",       "SAR": ledger?.maintenance ?? 0 },
      { Section: "LEDGER OPEX", Item: "Marketing",         "SAR": ledger?.marketing ?? 0 },
      { Section: "GOVT FEES", Item: "Labor Office",        "SAR": govFees?.laborOffice ?? 0 },
      { Section: "GOVT FEES", Item: "Passport Fees",       "SAR": govFees?.passport ?? 0 },
      { Section: "GOVT FEES", Item: "Sponsorship Transfer","SAR": govFees?.sponsorship ?? 0 },
      { Section: "GOVT FEES", Item: "Other Govt Fees",     "SAR": govFees?.other ?? 0 },
      { Section: "PAYROLL", Item: "Net Salaries",          "SAR": payroll },
      { Section: "PAYROLL", Item: "Staff Expenses",        "SAR": staffExp },
      { Section: "FIXED", Item: "Fixed Costs (Templates)", "SAR": fixedDyn || fixedLegacy },
      { Section: "COMMISSIONS", Item: "App Commissions",   "SAR": appCommissions },
      { Section: "EBITDA", Item: "EBITDA",                 "SAR": ebitda },
      { Section: "VAT", Item: "Output VAT",                "SAR": pl.outputVat ?? 0 },
      { Section: "VAT", Item: "Input VAT (Recoverable)",   "SAR": pl.inputVat ?? 0 },
      { Section: "VAT", Item: "Net VAT Payable",           "SAR": pl.vatPayable ?? 0 },
      { Section: "NET PROFIT", Item: "Net Profit / (Loss)","SAR": pl.netProfit },
    ];
    exportToExcel(rows, `pl-report-${month || "all"}`, "P&L Report");
  }

  function exportMonthly() {
    const rows = (monthly ?? []).map(m => ({
      Month: m.month, "Net Amount (SAR)": m.netAmount, "VAT (SAR)": m.totalVat,
      "Total (SAR)": m.totalAmount, "Records": m.count,
    }));
    exportToExcel(rows, "monthly-purchases", "Monthly Purchases");
  }

  function exportCategory() {
    const rows = (catReport ?? []).map(c => ({
      Category: c.label, "Net Amount (SAR)": c.netAmount, "VAT (SAR)": c.totalVat,
      "Total (SAR)": c.totalAmount, "Records": c.count,
    }));
    exportToExcel(rows, `category-expenses-${month || "all"}`, "Category Expenses");
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "pl",       label: "P&L Statement"      },
    { id: "monthly",  label: "Monthly Purchases"  },
    { id: "category", label: "Category Expenses"  },
  ];

  return (
    <div>
      <PageHeader
        title="Financial Reports"
        description="Profit & Loss, Purchase Analysis, and Category Breakdown"
        action={
          <div className="flex gap-2 items-center flex-wrap">
            <div className="no-print flex gap-2 items-center flex-wrap">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-medium text-emerald-700" title="Auto-updates after every Add / Edit / Delete / Transfer">
                <span className={`w-1.5 h-1.5 rounded-full ${plFetching ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
                {plFetching ? "Updating…" : "Live"}
                {plUpdatedAt > 0 && !plFetching && (
                  <span className="text-emerald-500/80 font-normal">· {new Date(plUpdatedAt).toLocaleTimeString()}</span>
                )}
              </div>
              <button onClick={handleRefreshAll} disabled={plFetching} title="Refresh all"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm disabled:opacity-60">
                <RefreshCw className={`w-4 h-4 ${plFetching ? "animate-spin" : ""}`} /> Refresh
              </button>
              <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                className="px-4 py-2 border rounded-xl shadow-sm focus:ring-primary/20 outline-none text-sm" />
              {tab === "pl"       && <button onClick={exportPL}       className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm"><FileSpreadsheet className="w-4 h-4" /> Excel</button>}
              {tab === "monthly"  && <button onClick={exportMonthly}  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm"><FileSpreadsheet className="w-4 h-4" /> Export Excel</button>}
              {tab === "category" && <button onClick={exportCategory} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm"><FileSpreadsheet className="w-4 h-4" /> Export Excel</button>}
            </div>
            <PrintButton />
          </div>
        }
      />

      {/* Tabs */}
      <div className="no-print flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── P&L TAB ──────────────────────────────────────────────────────────── */}
      {tab === "pl" && (
        <>
          {/* KPI Cards */}
          {pl && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Total Revenue",       value: pl.totalRevenue,  sub: formatMonth(month), color: "bg-blue-50 border-blue-200 text-blue-700",       icon: TrendingUp },
                { label: "Gross Profit",         value: pl.grossProfit,   sub: `Margin: ${pl.grossMarginPercent?.toFixed(1)}%`, color: (pl.grossProfit ?? 0) >= 0 ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-rose-50 border-rose-200 text-rose-700", icon: (pl.grossProfit ?? 0) >= 0 ? TrendingUp : TrendingDown },
                { label: "EBITDA",               value: ebitda,           sub: `${pctOf(ebitda, pl.totalRevenue)}% of revenue`,  color: ebitda >= 0 ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-rose-50 border-rose-200 text-rose-700", icon: ebitda >= 0 ? TrendingUp : TrendingDown },
                { label: "Net Profit / (Loss)",  value: pl.netProfit,     sub: `Net margin: ${pl.netMarginPercent?.toFixed(1)}%`, color: (pl.netProfit ?? 0) >= 0 ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-rose-50 border-rose-200 text-rose-700", icon: (pl.netProfit ?? 0) >= 0 ? TrendingUp : TrendingDown },
              ].map((k, i) => (
                <div key={i} className={`rounded-2xl border p-5 ${k.color}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{k.label}</p>
                    <k.icon className="w-4 h-4 opacity-60" />
                  </div>
                  <p className="text-2xl font-bold">{formatSAR(k.value)}</p>
                  {k.sub && <p className="text-xs mt-1 opacity-60">{k.sub}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Source Ownership Legend */}
          <div className="no-print mb-4 flex flex-wrap gap-2">
            {[
              { icon: <ShoppingCart className="w-3 h-3" />, label: "Purchases → COGS",       cls: "bg-blue-50 text-blue-700 border-blue-200" },
              { icon: <Wrench className="w-3 h-3" />,       label: "Purchases → Opex",       cls: "bg-orange-50 text-orange-700 border-orange-200" },
              { icon: <Receipt className="w-3 h-3" />,      label: "Expense Ledger → Opex",  cls: "bg-slate-50 text-slate-700 border-slate-200" },
              { icon: <Landmark className="w-3 h-3" />,     label: "Expense Ledger → Govt",  cls: "bg-red-50 text-red-700 border-red-200" },
              { icon: <Users className="w-3 h-3" />,        label: "HR Module → Payroll",    cls: "bg-purple-50 text-purple-700 border-purple-200" },
              { icon: <Building2 className="w-3 h-3" />,    label: "Fixed Costs → Fixed",    cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
              { icon: <Flame className="w-3 h-3" />,        label: "Sales → App Commissions",cls: "bg-pink-50 text-pink-700 border-pink-200" },
            ].map(b => (
              <span key={b.label} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border ${b.cls}`}>
                {b.icon}{b.label}
              </span>
            ))}
          </div>

          <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
            {plLoading ? (
              <div className="py-16 text-center text-slate-400">Loading P&L data...</div>
            ) : (
              <div>
                <div className="hidden print:block mb-6 p-6">
                  <h1 className="text-2xl font-bold">Profit & Loss Statement</h1>
                  <p className="text-slate-500">{formatMonth(month)} — Gourmet Ledger, Saudi Arabia</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="pl-4 py-4 text-left text-slate-600 font-semibold">Description</th>
                      <th className="pr-4 py-4 text-right text-slate-600 font-semibold">Amount (SAR)</th>
                      <th className="pr-4 py-4 text-right text-slate-400 font-normal text-xs w-20">% Rev</th>
                    </tr>
                  </thead>
                  <tbody>

                    {/* ── [1] REVENUE ─────────────────────────────────────────────────── */}
                    <SH title="Revenue" icon={<TrendingUp className="w-3.5 h-3.5" />} />
                    <Row label="Cash Sales"                 value={pl?.cashSales ?? 0}    indent percent={pctOf(pl?.cashSales, R)} />
                    <Row label="Card / POS"                 value={pl?.cardSales ?? 0}    indent percent={pctOf(pl?.cardSales, R)} />
                    <Row label="Delivery Apps"              value={pl?.appSalesTotal ?? 0} indent percent={pctOf(pl?.appSalesTotal, R)} />
                    <Row label="Net Sales (excl. VAT)"      value={pl?.netSales ?? 0}     indent percent={pctOf(pl?.netSales, R)} />
                    <Div />
                    <Row label="Total Revenue"              value={pl?.totalRevenue ?? 0} bold highlight="neutral" percent={100} />
                    <Div double />

                    {/* ── [2] COGS ────────────────────────────────────────────────────── */}
                    <SH title="Cost of Goods Sold — COGS" icon={<ShoppingCart className="w-3.5 h-3.5" />} />
                    <OwnershipNote icon={<ShoppingCart className="w-3 h-3" />} text="Source: Purchases Module only" />
                    <Row label="Food (Poultry, Meat, Dairy, Produce…)" value={pl?.foodCost ?? 0}    indent percent={pctOf(pl?.foodCost, R)} />
                    <Row label="Beverage (Juices, Water, Soft Drinks)"  value={pl?.beverageCost ?? 0} indent percent={pctOf(pl?.beverageCost, R)} />
                    <Row label="General (Kitchen, Cleaning, Packaging)" value={pl?.otherCost ?? 0}   indent percent={pctOf(pl?.otherCost, R)} />
                    <Row label="Cooking Fuel (Gas & Charcoal)" value={cookingFuel} indent percent={pctOf(cookingFuel, R)}
                      sub="Direct production inputs — رeclassified to COGS, not OpEx" />

                    {(pl?.totalInventoryAdjustment ?? 0) > 0 && <>
                      <Div />
                      <Row label="Opening Inventory (+)"               value={pl?.openingInventory ?? 0}          indent />
                      <Row label="Closing Food Inventory (−)"          value={-(pl?.closingFoodInventory ?? 0)}    indent />
                      <Row label="Closing Beverage Inventory (−)"      value={-(pl?.closingBeverageInventory ?? 0)} indent />
                      <Row label="Closing General Inventory (−)"       value={-(pl?.closingGeneralInventory ?? 0)} indent />
                    </>}
                    {((pl?.transfersInCost ?? 0) > 0 || (pl?.transfersOutCost ?? 0) > 0) && <>
                      <Div />
                      <div className="px-4 py-1 text-[10px] font-semibold uppercase tracking-widest text-blue-500 bg-blue-50 rounded-lg mx-1 mb-1">
                        Inter-Branch Transfers — Net Cost (VAT travels with goods)
                      </div>
                      {(pl?.transfersInCost ?? 0) > 0 && (
                        <Row label={`Received from Other Branches — Net (+)${(pl?.transfersVatIn ?? 0) > 0 ? ` · VAT In: +${(pl?.transfersVatIn ?? 0).toLocaleString("en-SA", { minimumFractionDigits: 2 })}` : ""}`}
                          value={pl?.transfersInCost ?? 0} indent />
                      )}
                      {(pl?.transfersOutCost ?? 0) > 0 && (
                        <Row label={`Sent to Other Branches — Net (−)${(pl?.transfersVatOut ?? 0) > 0 ? ` · VAT Out: −${(pl?.transfersVatOut ?? 0).toLocaleString("en-SA", { minimumFractionDigits: 2 })}` : ""}`}
                          value={-(pl?.transfersOutCost ?? 0)} indent />
                      )}
                      {((pl?.transfersVatOut ?? 0) > 0 || (pl?.transfersVatIn ?? 0) > 0) && (
                        <div className="flex justify-between px-6 py-1 text-[11px] text-blue-600 italic">
                          <span>VAT impact: see ZATCA VAT Report for per-branch VAT allocation</span>
                          <span>{(pl?.netTransferVat ?? 0) >= 0 ? "+" : ""}{(pl?.netTransferVat ?? 0).toLocaleString("en-SA", { minimumFractionDigits: 2 })} SAR input VAT</span>
                        </div>
                      )}
                    </>}
                    <Div />
                    <Row label="Adjusted COGS" value={adjCOGS} bold highlight="neutral" percent={pctOf(adjCOGS, R)} />
                    <Div double />

                    {/* ── GROSS PROFIT ──────────────────────────────────────────────── */}
                    <Row label="Gross Profit" value={pl?.grossProfit ?? 0} bold
                      highlight={(pl?.grossProfit ?? 0) >= 0 ? "profit" : "loss"}
                      percent={pl?.grossMarginPercent} />
                    <Div double />

                    {/* ── [3] PURCHASE OPERATING EXPENSES ───────────────────────────── */}
                    {(pl?.totalPurchaseOpex ?? 0) > 0 && <>
                      <SH title="Purchase Operating Expenses" icon={<Wrench className="w-3.5 h-3.5" />} />
                      <OwnershipNote icon={<ShoppingCart className="w-3 h-3" />} text="Source: Purchases Module — non-COGS categories" />
                      {(pl?.fuelEnergyCost ?? 0) > 0      && <Row label="Vehicle Fuel"              value={pl?.fuelEnergyCost ?? 0}      indent percent={pctOf(pl?.fuelEnergyCost, R)} />}
                      {(pl?.maintenanceCost ?? 0) > 0     && <Row label="Maintenance & Repair"      value={pl?.maintenanceCost ?? 0}     indent percent={pctOf(pl?.maintenanceCost, R)} />}
                      {(pl?.itCommunicationCost ?? 0) > 0 && <Row label="IT & Communication"        value={pl?.itCommunicationCost ?? 0} indent percent={pctOf(pl?.itCommunicationCost, R)} />}
                      {(pl?.marketingCost ?? 0) > 0       && <Row label="Marketing & Advertising"   value={pl?.marketingCost ?? 0}       indent percent={pctOf(pl?.marketingCost, R)} />}
                      {(pl?.othersPurchaseCost ?? 0) > 0  && <Row label="Other Purchase Expenses"   value={pl?.othersPurchaseCost ?? 0}  indent percent={pctOf(pl?.othersPurchaseCost, R)} />}
                      <Row label="Total Purchase OpEx" value={pl?.totalPurchaseOpex ?? 0} bold highlight="neutral" percent={pctOf(pl?.totalPurchaseOpex, R)} />
                      <Div />
                    </>}

                    {/* ── [4] OPERATING EXPENSES — EXPENSE LEDGER ───────────────────── */}
                    {(ledger?.total ?? 0) > 0 && <>
                      <SH title="Operating Expenses — Expense Ledger" icon={<Receipt className="w-3.5 h-3.5" />} />
                      <OwnershipNote icon={<Receipt className="w-3 h-3" />} text="Source: Expense Ledger (manual entries, excl. HR — HR owned by Payroll module)" />
                      {(ledger?.utilities ?? 0) > 0   && <Row label="Utilities & Telecom (5-1-3)"    value={ledger.utilities}   indent percent={pctOf(ledger.utilities, R)} />}
                      {(ledger?.cleaning ?? 0) > 0    && <Row label="Cleaning Supplies (5-1-1)"       value={ledger.cleaning}    indent percent={pctOf(ledger.cleaning, R)} />}
                      {(ledger?.maintenance ?? 0) > 0 && <Row label="Maintenance (5-1-4)"             value={ledger.maintenance} indent percent={pctOf(ledger.maintenance, R)} />}
                      {(ledger?.tools ?? 0) > 0       && <Row label="Tools & Consumables (5-1-5)"     value={ledger.tools}       indent percent={pctOf(ledger.tools, R)} />}
                      {(ledger?.marketing ?? 0) > 0   && <Row label="Marketing & Advertising (5-1-6)" value={ledger.marketing}   indent percent={pctOf(ledger.marketing, R)} />}
                      {(ledger?.fuel ?? 0) > 0        && <Row label="Fuel — Ledger (5-1-2)"           value={ledger.fuel}        indent percent={pctOf(ledger.fuel, R)} />}
                      {(ledger?.administrative ?? 0) > 0 && <Row label="Administrative (5-4)"         value={ledger.administrative} indent percent={pctOf(ledger.administrative, R)} />}
                      {(ledger?.financial ?? 0) > 0   && <Row label="Financial Expenses (5-5)"        value={ledger.financial}   indent percent={pctOf(ledger.financial, R)} />}
                      {(ledger?.transport ?? 0) > 0   && <Row label="Transport & Vehicles (5-6)"      value={ledger.transport}   indent percent={pctOf(ledger.transport, R)} />}
                      {(ledger?.rent ?? 0) > 0        && <Row label="Rent — Manual (5-7)"             value={ledger.rent}        indent percent={pctOf(ledger.rent, R)} />}
                      {(ledger?.other ?? 0) > 0       && <Row label="Other Expenses (5-8)"            value={ledger.other}       indent percent={pctOf(ledger.other, R)} />}
                      {(ledger?.hrExcluded ?? 0) > 0  && (
                        <tr className="border-b border-slate-100">
                          <td colSpan={3} className="pl-10 py-2 text-xs text-slate-400 flex items-center gap-1">
                            <Info className="w-3 h-3 inline mr-0.5" />
                            HR entries excluded ({formatSAR(ledger.hrExcluded)}) — accounted for in Payroll section
                          </td>
                        </tr>
                      )}
                      <Row label="Total Ledger OpEx" value={ledger?.total ?? 0} bold highlight="neutral" percent={pctOf(ledger?.total, R)} />
                      <Div />
                    </>}

                    {/* ── [5] GOVERNMENT FEES ───────────────────────────────────────── */}
                    {(govFees?.total ?? 0) > 0 && <>
                      <SH title="Government Fees (5-3-x)" icon={<Landmark className="w-3.5 h-3.5" />} />
                      <OwnershipNote icon={<Receipt className="w-3 h-3" />} text="Source: Expense Ledger 5-3-x — مكتب العمل، جوازات، كفالة، بلدية، رخص" />
                      {(govFees?.laborOffice ?? 0) > 0  && <Row label="Labor Office Fees (5-3-1)"    value={govFees.laborOffice}  indent percent={pctOf(govFees.laborOffice, R)} />}
                      {(govFees?.passport ?? 0) > 0     && <Row label="Passport / Visa Fees (5-3-2)" value={govFees.passport}     indent percent={pctOf(govFees.passport, R)} />}
                      {(govFees?.sponsorship ?? 0) > 0  && <Row label="Sponsorship Transfer (5-3-3)" value={govFees.sponsorship}  indent percent={pctOf(govFees.sponsorship, R)} />}
                      {(govFees?.other ?? 0) > 0        && <Row label="Other Government Fees (5-3-4)" value={govFees.other}       indent percent={pctOf(govFees.other, R)} />}
                      <Row label="Total Government Fees" value={govFees?.total ?? 0} bold highlight="neutral" percent={pctOf(govFees?.total, R)} />
                      <Div />
                    </>}

                    {/* ── [6] PAYROLL EXPENSES ──────────────────────────────────────── */}
                    <SH title="Payroll Expenses" icon={<Users className="w-3.5 h-3.5" />} />
                    <OwnershipNote icon={<Users className="w-3 h-3" />} text="Source: HR Module (employees table) — single source of truth for all HR costs" />
                    <Row label="Net Salaries (Salary + OT − Deductions)" value={payroll} indent percent={pctOf(payroll, R)}
                      sub="رواتب + إضافي − خصومات − غيابات" />
                    {staffExp > 0 && <Row label="Staff Expenses (Iqama, Visa, Insurance, Tickets)" value={staffExp} indent percent={pctOf(staffExp, R)} />}
                    <Row label="Total Payroll Expenses" value={payroll + staffExp} bold highlight="neutral" percent={pctOf(payroll + staffExp, R)} />
                    <Div />

                    {/* ── [7] FIXED EXPENSES ────────────────────────────────────────── */}
                    {(fixedDyn > 0 || fixedLegacy > 0) && <>
                      <SH title="Fixed Expenses" icon={<Building2 className="w-3.5 h-3.5" />} />
                      <OwnershipNote icon={<Building2 className="w-3 h-3" />} text="Source: Fixed Cost Templates (staff-salaries excluded — owned by Payroll module)" />
                      {fixedDyn > 0 && dynBreakdown && Object.entries(dynBreakdown).length > 0
                        ? Object.entries(dynBreakdown).map(([cat, amt]) => (
                            <Row key={cat} label={FIXED_CAT_LABELS[cat] ?? cat} value={amt} indent percent={pctOf(amt, R)} />
                          ))
                        : fixedDyn > 0 && <Row label="Fixed Costs (Templates)" value={fixedDyn} indent percent={pctOf(fixedDyn, R)} />
                      }
                      {fixedLegacy > 0 && fixedDyn === 0 && <Row label="Fixed Costs (Legacy)" value={fixedLegacy} indent percent={pctOf(fixedLegacy, R)} />}
                      <Row label="Total Fixed Expenses" value={fixedDyn || fixedLegacy} bold highlight="neutral" percent={pctOf(fixedDyn || fixedLegacy, R)} />
                      <Div />
                    </>}

                    {/* ── [8] APP COMMISSIONS ───────────────────────────────────────── */}
                    {appCommissions > 0 && <>
                      <SH title="App Commissions" icon={<Flame className="w-3.5 h-3.5" />} />
                      <OwnershipNote icon={<Flame className="w-3 h-3" />} text="Source: Sales Channels — HungerStation, Jahez, Talabat, ToYou, The Chefz" />
                      <Row label="Delivery App Commissions" value={appCommissions} indent percent={pctOf(appCommissions, R)} />
                      <Div />
                    </>}

                    {/* ── Total OpEx ────────────────────────────────────────────────── */}
                    <Row label="Total Operating Expenses" value={pl?.totalOperatingExpenses ?? 0} bold highlight="neutral" percent={pctOf(pl?.totalOperatingExpenses, R)} />
                    <Div double />

                    {/* ── [9] EBITDA ────────────────────────────────────────────────── */}
                    <Row
                      label="EBITDA"
                      value={ebitda}
                      bold
                      highlight={ebitda >= 0 ? "profit" : "loss"}
                      percent={pctOf(ebitda, R)}
                      sub="Gross Profit − All Operating Expenses"
                    />
                    <Div double />

                    {/* ── [10] VAT ──────────────────────────────────────────────────── */}
                    <SH title="VAT Summary — Saudi ZATCA 15%" />
                    <Row label="Output VAT (Sales × 15%)"          value={pl?.outputVat ?? 0} indent />
                    <Row label="Input VAT (Recoverable from Purchases)" value={pl?.inputVat ?? 0} indent />
                    <Div />
                    <Row label="Net VAT Payable to Government" value={pl?.vatPayable ?? 0} bold highlight="neutral" />
                    <Div double />

                    {/* ── [11] NET PROFIT ───────────────────────────────────────────── */}
                    <tr>
                      <td className="pl-4 pt-4 pb-5 text-base font-extrabold text-slate-900">Net Profit / (Loss)</td>
                      <td className={`pr-4 pt-4 pb-5 text-right text-xl font-extrabold tabular-nums ${(pl?.netProfit ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {formatSAR(pl?.netProfit)}
                      </td>
                      <td className="pr-4 pt-4 pb-5 text-right text-sm font-semibold text-slate-400">
                        {pl?.netMarginPercent?.toFixed(1)}%
                      </td>
                    </tr>

                  </tbody>
                </table>

                {/* Source Ownership Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t space-y-1.5 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-600">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    Single Source of Truth — Duplicate Prevention Rules
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5">
                    <span>🛒 <strong>Purchases</strong> → COGS only (food, bev, gen, gas, charcoal)</span>
                    <span>📋 <strong>Expense Ledger</strong> → Operating expenses (excl. HR)</span>
                    <span>👥 <strong>HR Module</strong> → Payroll only (salaries, OT, deductions)</span>
                    <span>🏢 <strong>Fixed Cost Templates</strong> → Rent, subscriptions (excl. staff-salaries)</span>
                    <span>🏛 <strong>Expense Ledger 5-3-x</strong> → Government fees only</span>
                    <span>🔥 <strong>Sales Channels</strong> → App commissions only</span>
                  </div>
                  <p className="text-slate-400">EBITDA = Gross Profit − Purchase OpEx − Ledger OpEx − Govt Fees − Payroll − Fixed − Commissions</p>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── MONTHLY PURCHASES TAB ─────────────────────────────────────────────── */}
      {tab === "monthly" && (
        <div className="space-y-4">
          {monthly && monthly.length > 0 && (() => {
            const totTaxNet   = monthly.reduce((s, m) => s + (m.taxableNet ?? 0), 0);
            const totTaxGross = monthly.reduce((s, m) => s + (m.taxableTotal ?? 0), 0);
            const totNonTax   = monthly.reduce((s, m) => s + (m.nonTaxableTotal ?? 0), 0);
            const totVat      = monthly.reduce((s, m) => s + m.totalVat, 0);
            const grandTot    = monthly.reduce((s, m) => s + m.totalAmount, 0);
            return (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-xs text-slate-500 mb-0.5">Tax Invoice Net</p>
                  <p className="font-bold text-blue-800">{formatSAR(totTaxNet)}</p>
                  <p className="text-[10px] text-blue-600">Before VAT</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-xs text-slate-500 mb-0.5">Input VAT</p>
                  <p className="font-bold text-emerald-700">{formatSAR(totVat)}</p>
                  <p className="text-[10px] text-emerald-600">Reclaimable</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-xs text-slate-500 mb-0.5">Tax Invoice Total</p>
                  <p className="font-bold text-emerald-800">{formatSAR(totTaxGross)}</p>
                  <p className="text-[10px] text-emerald-600">incl. VAT</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-xs text-slate-500 mb-0.5">Non-Tax Total</p>
                  <p className="font-bold text-amber-700">{formatSAR(totNonTax)}</p>
                  <p className="text-[10px] text-amber-600">No VAT</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-xs text-slate-500 mb-0.5">Grand Total</p>
                  <p className="font-bold text-slate-800">{formatSAR(grandTot)}</p>
                  <p className="text-[10px] text-slate-500">All invoices</p>
                </div>
              </div>
            );
          })()}
          {monthlyLoading ? (
            <div className="py-16 text-center text-slate-400">Loading…</div>
          ) : (
            <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-200 bg-slate-50">
                    <th className="pl-4 py-3 text-left font-semibold text-slate-600">Month</th>
                    <th className="pr-4 py-3 text-right font-semibold text-slate-600">Tax Net</th>
                    <th className="pr-4 py-3 text-right font-semibold text-slate-600">Input VAT</th>
                    <th className="pr-4 py-3 text-right font-semibold text-slate-600">Tax Total</th>
                    <th className="pr-4 py-3 text-right font-semibold text-slate-600">Non-Tax</th>
                    <th className="pr-4 py-3 text-right font-semibold text-slate-600">Grand Total</th>
                    <th className="pr-4 py-3 text-right font-semibold text-slate-600">Records</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(monthly ?? []).map(m => (
                    <tr key={m.month} className="hover:bg-slate-50">
                      <td className="pl-4 py-3 font-medium text-slate-700">{m.month}</td>
                      <td className="pr-4 py-3 text-right tabular-nums text-slate-700">{formatSAR(m.taxableNet ?? 0)}</td>
                      <td className="pr-4 py-3 text-right tabular-nums text-emerald-700">{formatSAR(m.totalVat)}</td>
                      <td className="pr-4 py-3 text-right tabular-nums text-slate-700">{formatSAR(m.taxableTotal ?? 0)}</td>
                      <td className="pr-4 py-3 text-right tabular-nums text-amber-700">{formatSAR(m.nonTaxableTotal ?? 0)}</td>
                      <td className="pr-4 py-3 text-right tabular-nums font-bold text-slate-900">{formatSAR(m.totalAmount)}</td>
                      <td className="pr-4 py-3 text-right text-slate-500">{m.count}</td>
                    </tr>
                  ))}
                  {(!monthly || monthly.length === 0) && (
                    <tr><td colSpan={7} className="py-16 text-center text-slate-400">No purchase data available</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── CATEGORY EXPENSES TAB ─────────────────────────────────────────────── */}
      {tab === "category" && (
        <div className="space-y-4">
          {catLoading ? (
            <div className="py-16 text-center text-slate-400">Loading…</div>
          ) : (
            <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-200 bg-slate-50">
                    <th className="pl-4 py-3 text-left font-semibold text-slate-600">Category</th>
                    <th className="pl-4 py-3 text-left font-semibold text-slate-600">Group</th>
                    <th className="pr-4 py-3 text-right font-semibold text-slate-600">Net (SAR)</th>
                    <th className="pr-4 py-3 text-right font-semibold text-slate-600">VAT</th>
                    <th className="pr-4 py-3 text-right font-semibold text-slate-600">Total</th>
                    <th className="pr-4 py-3 text-right font-semibold text-slate-600">Records</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(catReport ?? []).map(c => (
                    <tr key={c.category} className="hover:bg-slate-50">
                      <td className="pl-4 py-3">
                        <div className="font-medium text-slate-700">{c.label}</div>
                        <div className="text-xs text-slate-400">{c.labelAr}</div>
                      </td>
                      <td className="pl-4 py-3 text-xs text-slate-500">{c.groupLabel}</td>
                      <td className="pr-4 py-3 text-right tabular-nums text-slate-700">{formatSAR(c.netAmount)}</td>
                      <td className="pr-4 py-3 text-right tabular-nums text-amber-700">{formatSAR(c.totalVat)}</td>
                      <td className="pr-4 py-3 text-right tabular-nums font-bold text-slate-900">{formatSAR(c.totalAmount)}</td>
                      <td className="pr-4 py-3 text-right text-slate-500">{c.count}</td>
                    </tr>
                  ))}
                  {(!catReport || catReport.length === 0) && (
                    <tr><td colSpan={6} className="py-16 text-center text-slate-400">No category data for this period</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function pctOf(part: number | undefined | null, total: number | undefined | null): number {
  if (!total || !part) return 0;
  return +((part / total) * 100).toFixed(1);
}

const FIXED_CAT_LABELS: Record<string, string> = {
  "rent":              "Branch / Warehouse Rent",
  "utilities":         "Utilities (Fixed Contract)",
  "apps-subscriptions":"Software Subscriptions",
  "other-fixed":       "Other Fixed Costs",
  "owner-drawings":    "Owner Drawings",
};
