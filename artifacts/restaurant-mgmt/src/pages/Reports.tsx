import { Fragment, useState, useCallback, useEffect, useRef } from "react";
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
import { useLanguage } from "@/i18n/LanguageContext";
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
    hrExcluded: number; total: number;
  };
  // Dynamic per-main-category rollup (5-2 Government, 5-3 Fixed Operating,
  // 5-4 Variable Operating, 5-5 Marketing, 5-6 Repairs, 5-7 Administrative,
  // plus any user-defined mains). HR (5-1) is excluded — owned by Payroll.
  byMainCategory?: Array<{
    code: string;
    name: string;
    nameAr: string;
    total: number;
    leaves: Array<{ code: string; name: string; nameAr: string; nature: "fixed" | "variable" | null; amount: number }>;
  }>;
  dynamicFixedBreakdown?: Record<string, number>;
  fixedVsVariable?: {
    fixedTotal: number;
    variableTotal: number;
    unclassifiedTotal: number;
    grandTotal: number;
    fixedRatio: number;
    variableRatio: number;
    fixed:    Array<{ code: string; label: string; amount: number; nature: "fixed" }>;
    variable: Array<{ code: string; label: string; amount: number; nature: "variable" }>;
    unclassified: Array<{ code: string; label: string; amount: number }>;
  };
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
  const { t, pickName, lang } = useLanguage();

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

  // Denominator for the % column = NET sales (Ex-VAT). Using gross sales
  // here would silently understate every cost ratio (food-cost %, opex %, etc.).
  const R = pl?.netSales ?? 0;

  // ── Derived values ──────────────────────────────────────────────────────────
  const cookingFuel   = pl?.cookingFuelCost ?? 0;
  const adjCOGS       = pl?.adjustedCOGS ?? pl?.totalCOGS ?? 0;
  const ledger        = pl?.ledgerOpex;
  const byMain        = pl?.byMainCategory ?? [];
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
    // Use translated labels so the exported Excel matches the on-screen UI.
    const S = (k: string) => t(`pl.sections.${k}`).toUpperCase();
    const L = (k: string) => t(`pl.rows.${k}`);
    const COL_SECTION = t("reportsExtra.export.colSection");
    const COL_ITEM    = t("reportsExtra.export.colItem");
    const COL_SAR     = t("reportsExtra.export.colSar");
    const row = (section: string, item: string, value: number) => ({
      [COL_SECTION]: section, [COL_ITEM]: item, [COL_SAR]: value,
    });
    const rows = [
      row(S("revenue"), L("cashSales"),    pl.cashSales ?? 0),
      row(S("revenue"), L("cardSales"),    pl.cardSales ?? 0),
      row(S("revenue"), L("appSales"),     pl.appSalesTotal ?? 0),
      row(S("revenue"), L("grossSales"),   (pl as { grossSales?: number }).grossSales ?? pl.totalRevenue ?? 0),
      row(S("revenue"), L("outputVatRevenue"), pl.outputVat ?? 0),
      row(S("revenue"), L("netSales"),     pl.netSales ?? 0),
      row(S("cogs"), L("foodCost"),     pl.foodCost),
      row(S("cogs"), L("beverageCost"), pl.beverageCost),
      row(S("cogs"), L("generalCost"),  pl.otherCost),
      row(S("cogs"), L("cookingFuel"),  cookingFuel),
      row(S("cogs"), L("adjustedCogs"), adjCOGS),
      row(t("pl.rows.grossProfit").toUpperCase(), L("grossProfit"), pl.grossProfit),
      row(S("purchaseOpex"), L("vehicleFuel"),   pl.fuelEnergyCost ?? 0),
      row(S("purchaseOpex"), L("maintenance"),   pl.maintenanceCost ?? 0),
      row(S("purchaseOpex"), L("itComm"),        pl.itCommunicationCost ?? 0),
      row(S("purchaseOpex"), L("marketing"),     pl.marketingCost ?? 0),
      row(S("purchaseOpex"), L("otherPurchase"), pl.othersPurchaseCost ?? 0),
      // Per-main-category breakdown — names come from the bilingual category tree.
      ...byMain.flatMap(mc => {
        const mcName = pickName(mc);
        return [
          row(mcName.toUpperCase(), mcName, mc.total),
          ...mc.leaves.map(l => row(mcName.toUpperCase(), `  ${pickName(l)}`, l.amount)),
        ];
      }),
      row(S("payroll"), L("netSalaries"),   payroll),
      row(S("payroll"), L("staffExpenses"), staffExp),
      row(S("fixed"), L("fixedTemplates"), fixedDyn || fixedLegacy),
      row(S("appCommissions"), L("deliveryAppCommissions"), appCommissions),
      row("EBITDA", L("ebitda"), ebitda),
      row(t("common.vat").toUpperCase(), L("outputVat"),     pl.outputVat ?? 0),
      row(t("common.vat").toUpperCase(), L("inputVat"),      pl.inputVat ?? 0),
      row(t("common.vat").toUpperCase(), L("netVatPayable"), pl.vatPayable ?? 0),
      row(L("netProfit").toUpperCase(),  L("netProfit"),     pl.netProfit),
    ];
    exportToExcel(rows, `pl-report-${month || "all"}`, t("reportsExtra.export.plSheet"));
  }

  function exportMonthly() {
    const rows = (monthly ?? []).map(m => ({
      [t("reportsExtra.export.colMonth")]:   m.month,
      [t("reportsExtra.export.colNetSar")]:  m.netAmount,
      [t("reportsExtra.export.colVatSar")]:  m.totalVat,
      [t("reportsExtra.export.colTotalSar")]:m.totalAmount,
      [t("reportsExtra.export.colRecords")]: m.count,
    }));
    exportToExcel(rows, "monthly-purchases", t("reportsExtra.export.monthlySheet"));
  }

  function exportCategory() {
    const rows = (catReport ?? []).map(c => ({
      [t("reportsExtra.export.colCategory")]:pickName({ name: c.label, nameAr: c.labelAr }),
      [t("reportsExtra.export.colNetSar")]:  c.netAmount,
      [t("reportsExtra.export.colVatSar")]:  c.totalVat,
      [t("reportsExtra.export.colTotalSar")]:c.totalAmount,
      [t("reportsExtra.export.colRecords")]: c.count,
    }));
    exportToExcel(rows, `category-expenses-${month || "all"}`, t("reportsExtra.export.categorySheet"));
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "pl",       label: t("reports.tabs.pl")       },
    { id: "monthly",  label: t("reports.tabs.monthly")  },
    { id: "category", label: t("reports.tabs.category") },
  ];

  return (
    <div>
      <PageHeader
        title={t("reports.title")}
        description={t("reports.subtitle")}
        action={
          <div className="flex gap-2 items-center flex-wrap">
            <div className="no-print flex gap-2 items-center flex-wrap">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-medium text-emerald-700" title="Auto-updates after every Add / Edit / Delete / Transfer">
                <span className={`w-1.5 h-1.5 rounded-full ${plFetching ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
                {plFetching ? t("common.updating") : t("common.live")}
                {plUpdatedAt > 0 && !plFetching && (
                  <span className="text-emerald-500/80 font-normal">· {new Date(plUpdatedAt).toLocaleTimeString()}</span>
                )}
              </div>
              <button onClick={handleRefreshAll} disabled={plFetching} title={t("common.refresh")}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm disabled:opacity-60">
                <RefreshCw className={`w-4 h-4 ${plFetching ? "animate-spin" : ""}`} /> {t("common.refresh")}
              </button>
              <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                className="px-4 py-2 border rounded-xl shadow-sm focus:ring-primary/20 outline-none text-sm" />
              {tab === "pl"       && <button onClick={exportPL}       className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm"><FileSpreadsheet className="w-4 h-4" /> {t("common.exportExcel")}</button>}
              {tab === "monthly"  && <button onClick={exportMonthly}  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm"><FileSpreadsheet className="w-4 h-4" /> {t("common.exportExcelLong")}</button>}
              {tab === "category" && <button onClick={exportCategory} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm"><FileSpreadsheet className="w-4 h-4" /> {t("common.exportExcelLong")}</button>}
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
                { label: t("pl.kpi.totalRevenue"), value: pl.netSales, sub: t("pl.kpi.exVatSub"), color: "bg-blue-50 border-blue-200 text-blue-700",       icon: TrendingUp },
                { label: t("pl.kpi.grossProfit"),  value: pl.grossProfit,  sub: t("pl.kpi.margin",      { value: (pl.grossMarginPercent ?? 0).toFixed(1) }), color: (pl.grossProfit ?? 0) >= 0 ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-rose-50 border-rose-200 text-rose-700", icon: (pl.grossProfit ?? 0) >= 0 ? TrendingUp : TrendingDown },
                { label: t("pl.kpi.ebitda"),       value: ebitda,          sub: t("pl.kpi.pctOfRevenue",{ value: pctOf(ebitda, pl.netSales) }),             color: ebitda >= 0 ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-rose-50 border-rose-200 text-rose-700", icon: ebitda >= 0 ? TrendingUp : TrendingDown },
                { label: t("pl.kpi.netProfit"),    value: pl.netProfit,    sub: t("pl.kpi.netMargin",   { value: (pl.netMarginPercent ?? 0).toFixed(1) }), color: (pl.netProfit ?? 0) >= 0 ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-rose-50 border-rose-200 text-rose-700", icon: (pl.netProfit ?? 0) >= 0 ? TrendingUp : TrendingDown },
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
              { icon: <ShoppingCart className="w-3 h-3" />, label: t("reports.legend.purchasesCogs"),  cls: "bg-blue-50 text-blue-700 border-blue-200" },
              { icon: <Wrench className="w-3 h-3" />,       label: t("reports.legend.purchasesOpex"),  cls: "bg-orange-50 text-orange-700 border-orange-200" },
              { icon: <Receipt className="w-3 h-3" />,      label: t("reports.legend.ledgerOpex"),     cls: "bg-slate-50 text-slate-700 border-slate-200" },
              { icon: <Landmark className="w-3 h-3" />,     label: t("reports.legend.ledgerGovt"),     cls: "bg-red-50 text-red-700 border-red-200" },
              { icon: <Users className="w-3 h-3" />,        label: t("reports.legend.hrPayroll"),      cls: "bg-purple-50 text-purple-700 border-purple-200" },
              { icon: <Building2 className="w-3 h-3" />,    label: t("reports.legend.fixedTemplates"), cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
              { icon: <Flame className="w-3 h-3" />,        label: t("reports.legend.appCommissions"), cls: "bg-pink-50 text-pink-700 border-pink-200" },
            ].map(b => (
              <span key={b.label} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border ${b.cls}`}>
                {b.icon}{b.label}
              </span>
            ))}
          </div>

          <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
            {plLoading ? (
              <div className="py-16 text-center text-slate-400">{t("reports.loadingPl")}</div>
            ) : (
              <div>
                <div className="hidden print:block mb-6 p-6">
                  <h1 className="text-2xl font-bold">{t("reports.plTitle")}</h1>
                  <p className="text-slate-500">{t("reports.plLocation", { month: formatMonth(month) })}</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="pl-4 py-4 text-start text-slate-600 font-semibold">{t("reports.tableHeader.description")}</th>
                      <th className="pr-4 py-4 text-end   text-slate-600 font-semibold">{t("reports.tableHeader.amount")}</th>
                      <th className="pr-4 py-4 text-end   text-slate-400 font-normal text-xs w-20">{t("reports.tableHeader.pctRev")}</th>
                    </tr>
                  </thead>
                  <tbody>

                    {/* ── [1] REVENUE ─────────────────────────────────────────────────── */}
                    {/* IFRS-style: NET SALES (Ex-VAT) is the accounting top line.
                        Channel rows are shown for cash-flow transparency and are
                        VAT-INCLUSIVE (as collected at POS); they intentionally
                        sum to Gross Sales, not to the accounting revenue line. */}
                    <SH title={t("pl.sections.revenue")} icon={<TrendingUp className="w-3.5 h-3.5" />} />
                    <Row label={t("pl.rows.cashSales")}     value={pl?.cashSales ?? 0}    indent sub={t("pl.rows.inclVatSub")} />
                    <Row label={t("pl.rows.cardSales")}     value={pl?.cardSales ?? 0}    indent sub={t("pl.rows.inclVatSub")} />
                    <Row label={t("pl.rows.appSales")}      value={pl?.appSalesTotal ?? 0} indent sub={t("pl.rows.inclVatSub")} />
                    <Div />
                    <Row label={t("pl.rows.grossSales")}    value={pl?.grossSales ?? pl?.totalRevenue ?? 0} indent sub={t("pl.rows.grossSalesSub")} />
                    <Row label={t("pl.rows.outputVatRevenue")} value={pl?.outputVat ?? 0} indent sub={t("pl.rows.outputVatSub")} />
                    <Div />
                    <Row label={t("pl.rows.netSales")}      value={pl?.netSales ?? 0}     bold highlight="neutral" percent={100} sub={t("pl.rows.netSalesSub")} />
                    <Div double />

                    {/* ── [2] COGS ────────────────────────────────────────────────────── */}
                    <SH title={t("pl.sections.cogs")} icon={<ShoppingCart className="w-3.5 h-3.5" />} />
                    <OwnershipNote icon={<ShoppingCart className="w-3 h-3" />} text={t("pl.ownership.cogs")} />
                    <Row label={t("pl.rows.foodCost")}      value={pl?.foodCost ?? 0}    indent percent={pctOf(pl?.foodCost, R)} />
                    <Row label={t("pl.rows.beverageCost")}  value={pl?.beverageCost ?? 0} indent percent={pctOf(pl?.beverageCost, R)} />
                    <Row label={t("pl.rows.generalCost")}   value={pl?.otherCost ?? 0}   indent percent={pctOf(pl?.otherCost, R)} />
                    <Row label={t("pl.rows.cookingFuel")}   value={cookingFuel} indent percent={pctOf(cookingFuel, R)}
                      sub={t("pl.rows.cookingFuelSub")} />

                    {(pl?.totalInventoryAdjustment ?? 0) > 0 && <>
                      <Div />
                      <Row label={t("pl.rows.openingInventory")} value={pl?.openingInventory ?? 0}          indent />
                      <Row label={t("pl.rows.closingFood")}      value={-(pl?.closingFoodInventory ?? 0)}    indent />
                      <Row label={t("pl.rows.closingBev")}       value={-(pl?.closingBeverageInventory ?? 0)} indent />
                      <Row label={t("pl.rows.closingGen")}       value={-(pl?.closingGeneralInventory ?? 0)} indent />
                    </>}
                    {((pl?.transfersInCost ?? 0) > 0 || (pl?.transfersOutCost ?? 0) > 0) && <>
                      <Div />
                      <div className="px-4 py-1 text-[10px] font-semibold uppercase tracking-widest text-blue-500 bg-blue-50 rounded-lg mx-1 mb-1">
                        {t("pl.rows.interBranchTransfers")}
                      </div>
                      {(pl?.transfersInCost ?? 0) > 0 && (
                        <Row label={`${t("pl.rows.receivedFromBranches")}${(pl?.transfersVatIn ?? 0) > 0 ? ` · ${t("pl.rows.inputVat")}: +${(pl?.transfersVatIn ?? 0).toLocaleString(lang === "ar" ? "ar-SA" : "en-SA", { minimumFractionDigits: 2 })}` : ""}`}
                          value={pl?.transfersInCost ?? 0} indent />
                      )}
                      {(pl?.transfersOutCost ?? 0) > 0 && (
                        <Row label={`${t("pl.rows.sentToBranches")}${(pl?.transfersVatOut ?? 0) > 0 ? ` · ${t("pl.rows.outputVat")}: −${(pl?.transfersVatOut ?? 0).toLocaleString(lang === "ar" ? "ar-SA" : "en-SA", { minimumFractionDigits: 2 })}` : ""}`}
                          value={-(pl?.transfersOutCost ?? 0)} indent />
                      )}
                    </>}
                    <Div />
                    <Row label={t("pl.rows.adjustedCogs")} value={adjCOGS} bold highlight="neutral" percent={pctOf(adjCOGS, R)} />
                    <Div double />

                    {/* ── GROSS PROFIT ──────────────────────────────────────────────── */}
                    <Row label={t("pl.rows.grossProfit")} value={pl?.grossProfit ?? 0} bold
                      highlight={(pl?.grossProfit ?? 0) >= 0 ? "profit" : "loss"}
                      percent={pl?.grossMarginPercent} />
                    <Div double />

                    {/* ── [3] PURCHASE OPERATING EXPENSES ───────────────────────────── */}
                    {(pl?.totalPurchaseOpex ?? 0) > 0 && <>
                      <SH title={t("pl.sections.purchaseOpex")} icon={<Wrench className="w-3.5 h-3.5" />} />
                      <OwnershipNote icon={<ShoppingCart className="w-3 h-3" />} text={t("pl.ownership.purchaseOpex")} />
                      {(pl?.fuelEnergyCost ?? 0) > 0      && <Row label={t("pl.rows.vehicleFuel")}   value={pl?.fuelEnergyCost ?? 0}      indent percent={pctOf(pl?.fuelEnergyCost, R)} />}
                      {(pl?.maintenanceCost ?? 0) > 0     && <Row label={t("pl.rows.maintenance")}   value={pl?.maintenanceCost ?? 0}     indent percent={pctOf(pl?.maintenanceCost, R)} />}
                      {(pl?.itCommunicationCost ?? 0) > 0 && <Row label={t("pl.rows.itComm")}        value={pl?.itCommunicationCost ?? 0} indent percent={pctOf(pl?.itCommunicationCost, R)} />}
                      {(pl?.marketingCost ?? 0) > 0       && <Row label={t("pl.rows.marketing")}     value={pl?.marketingCost ?? 0}       indent percent={pctOf(pl?.marketingCost, R)} />}
                      {(pl?.othersPurchaseCost ?? 0) > 0  && <Row label={t("pl.rows.otherPurchase")} value={pl?.othersPurchaseCost ?? 0}  indent percent={pctOf(pl?.othersPurchaseCost, R)} />}
                      <Row label={t("pl.rows.totalPurchaseOpex")} value={pl?.totalPurchaseOpex ?? 0} bold highlight="neutral" percent={pctOf(pl?.totalPurchaseOpex, R)} />
                      <Div />
                    </>}

                    {/* ── [4] OPERATING EXPENSES — by Main Category (dynamic) ───── */}
                    {/* One section per main category from the expense tree (HR excluded — owned by Payroll). */}
                    {byMain.filter(mc => mc.total > 0).map(mc => {
                      const mcName = pickName(mc);
                      return (
                        <Fragment key={mc.code}>
                          <SH title={`${mcName} (${mc.code})`} icon={<Receipt className="w-3.5 h-3.5" />} />
                          <OwnershipNote
                            icon={<Receipt className="w-3 h-3" />}
                            text={t("pl.ownership.ledger", { code: mc.code })}
                          />
                          {mc.leaves.map(l => (
                            <Row
                              key={l.code}
                              label={`${pickName(l)} (${l.code})${l.nature ? " · " + t(`common.${l.nature}`) : ""}`}
                              value={l.amount}
                              indent
                              percent={pctOf(l.amount, R)}
                            />
                          ))}
                          <Row label={`${t("pl.totalsPrefix")} ${mcName}`} value={mc.total} bold highlight="neutral" percent={pctOf(mc.total, R)} />
                          <Div />
                        </Fragment>
                      );
                    })}
                    {(ledger?.hrExcluded ?? 0) > 0 && (
                      <tr className="border-b border-slate-100">
                        <td colSpan={3} className="pl-10 py-2 text-xs text-slate-400 flex items-center gap-1">
                          <Info className="w-3 h-3 inline me-0.5" />
                          {t("pl.rows.hrExcluded", { amount: formatSAR(ledger!.hrExcluded) })}
                        </td>
                      </tr>
                    )}
                    {(ledger?.total ?? 0) > 0 && <>
                      <Row label={t("pl.rows.totalLedgerOpex")} value={ledger!.total} bold highlight="neutral" percent={pctOf(ledger!.total, R)} />
                      <Div />
                    </>}

                    {/* ── [6] PAYROLL EXPENSES ──────────────────────────────────────── */}
                    <SH title={t("pl.sections.payroll")} icon={<Users className="w-3.5 h-3.5" />} />
                    <OwnershipNote icon={<Users className="w-3 h-3" />} text={t("pl.ownership.payroll")} />
                    <Row label={t("pl.rows.netSalaries")} value={payroll} indent percent={pctOf(payroll, R)}
                      sub={t("pl.rows.netSalariesSub")} />
                    {staffExp > 0 && <Row label={t("pl.rows.staffExpenses")} value={staffExp} indent percent={pctOf(staffExp, R)} />}
                    <Row label={t("pl.rows.totalPayroll")} value={payroll + staffExp} bold highlight="neutral" percent={pctOf(payroll + staffExp, R)} />
                    <Div />

                    {/* ── [7] FIXED EXPENSES ────────────────────────────────────────── */}
                    {(fixedDyn > 0 || fixedLegacy > 0) && <>
                      <SH title={t("pl.sections.fixed")} icon={<Building2 className="w-3.5 h-3.5" />} />
                      <OwnershipNote icon={<Building2 className="w-3 h-3" />} text={t("pl.ownership.fixed")} />
                      {fixedDyn > 0 && dynBreakdown && Object.entries(dynBreakdown).length > 0
                        ? Object.entries(dynBreakdown).map(([cat, amt]) => (
                            <Row key={cat} label={t(`reportsExtra.fixedCats.${cat}`) !== `reportsExtra.fixedCats.${cat}` ? t(`reportsExtra.fixedCats.${cat}`) : (FIXED_CAT_LABELS[cat] ?? cat)} value={amt} indent percent={pctOf(amt, R)} />
                          ))
                        : fixedDyn > 0 && <Row label={t("pl.rows.fixedTemplates")} value={fixedDyn} indent percent={pctOf(fixedDyn, R)} />
                      }
                      {fixedLegacy > 0 && <Row label={t("pl.rows.fixedLegacy")} value={fixedLegacy} indent percent={pctOf(fixedLegacy, R)} />}
                      <Row label={t("pl.rows.totalFixed")} value={fixedDyn + fixedLegacy} bold highlight="neutral" percent={pctOf(fixedDyn + fixedLegacy, R)} />
                      <Div />
                    </>}

                    {/* ── [7.5] FIXED vs VARIABLE BREAKDOWN ─────────────────────────── */}
                    {pl?.fixedVsVariable && pl.fixedVsVariable.grandTotal > 0 && (() => {
                      const fv = pl.fixedVsVariable!;
                      return (
                        <>
                          <SH title={t("pl.sections.fixedVsVariable")} icon={<Building2 className="w-3.5 h-3.5" />} />
                          <OwnershipNote
                            icon={<Info className="w-3 h-3" />}
                            text={t("pl.ownership.fixedVsVariable")}
                          />
                          <tr className="border-b border-slate-100">
                            <td colSpan={3} className="pl-6 py-2">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden flex">
                                  <div
                                    className="h-full bg-blue-500"
                                    style={{ width: `${fv.fixedRatio}%` }}
                                    title={`Fixed ${fv.fixedRatio}%`}
                                  />
                                  <div
                                    className="h-full bg-amber-500"
                                    style={{ width: `${fv.variableRatio}%` }}
                                    title={`Variable ${fv.variableRatio}%`}
                                  />
                                </div>
                                <span className="text-xs text-slate-500 whitespace-nowrap">
                                  {fv.fixedRatio}% / {fv.variableRatio}%
                                </span>
                              </div>
                            </td>
                          </tr>
                          <Row
                            label={t("pl.rows.fixedSources", { n: fv.fixed.length })}
                            value={fv.fixedTotal}
                            indent
                            percent={pctOf(fv.fixedTotal, R)}
                          />
                          <tr className="border-b border-slate-100">
                            <td colSpan={3} className="pl-12 py-1">
                              <details className="text-xs">
                                <summary className="cursor-pointer text-slate-500 hover:text-slate-700">
                                  {t("pl.rows.showFixed")}
                                </summary>
                                <table className="w-full mt-1">
                                  <tbody>
                                    {fv.fixed.map(b => (
                                      <tr key={b.code} className="text-slate-600">
                                        <td className="py-0.5">{b.code} — {b.label}</td>
                                        <td className="py-0.5 text-right tabular-nums">{formatSAR(b.amount)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </details>
                            </td>
                          </tr>
                          <Row
                            label={t("pl.rows.variableSources", { n: fv.variable.length })}
                            value={fv.variableTotal}
                            indent
                            percent={pctOf(fv.variableTotal, R)}
                          />
                          <tr className="border-b border-slate-100">
                            <td colSpan={3} className="pl-12 py-1">
                              <details className="text-xs">
                                <summary className="cursor-pointer text-slate-500 hover:text-slate-700">
                                  {t("pl.rows.showVariable")}
                                </summary>
                                <table className="w-full mt-1">
                                  <tbody>
                                    {fv.variable.map(b => (
                                      <tr key={b.code} className="text-slate-600">
                                        <td className="py-0.5">{b.code} — {b.label}</td>
                                        <td className="py-0.5 text-right tabular-nums">{formatSAR(b.amount)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </details>
                            </td>
                          </tr>
                          {fv.unclassified.length > 0 && (
                            <tr className="border-b border-red-200 bg-red-50">
                              <td colSpan={3} className="pl-6 py-2 text-xs text-red-700">
                                <Info className="w-3 h-3 inline me-1" />
                                {t("pl.rows.unclassified", { n: fv.unclassified.length, total: formatSAR(fv.unclassifiedTotal) })}
                              </td>
                            </tr>
                          )}
                          <Row
                            label={t("pl.rows.totalOpExFixedVariable")}
                            value={fv.grandTotal}
                            bold
                            highlight="neutral"
                            percent={pctOf(fv.grandTotal, R)}
                          />
                          <Div />
                        </>
                      );
                    })()}

                    {/* ── [8] APP COMMISSIONS ───────────────────────────────────────── */}
                    {appCommissions > 0 && <>
                      <SH title={t("pl.sections.appCommissions")} icon={<Flame className="w-3.5 h-3.5" />} />
                      <OwnershipNote icon={<Flame className="w-3 h-3" />} text={t("pl.ownership.commissions")} />
                      <Row label={t("pl.rows.deliveryAppCommissions")} value={appCommissions} indent percent={pctOf(appCommissions, R)} />
                      <Div />
                    </>}

                    {/* ── Total OpEx ────────────────────────────────────────────────── */}
                    <Row label={t("pl.rows.totalOpEx")} value={pl?.totalOperatingExpenses ?? 0} bold highlight="neutral" percent={pctOf(pl?.totalOperatingExpenses, R)} />
                    <Div double />

                    {/* ── [9] EBITDA ────────────────────────────────────────────────── */}
                    <Row
                      label={t("pl.rows.ebitda")}
                      value={ebitda}
                      bold
                      highlight={ebitda >= 0 ? "profit" : "loss"}
                      percent={pctOf(ebitda, R)}
                    />
                    <Div double />

                    {/* ── [10] VAT ──────────────────────────────────────────────────── */}
                    <SH title={t("pl.sections.vat")} />
                    <Row label={t("pl.rows.outputVat")}     value={pl?.outputVat ?? 0} indent />
                    <Row label={t("pl.rows.inputVat")}      value={pl?.inputVat ?? 0} indent />
                    <Div />
                    <Row label={t("pl.rows.netVatPayable")} value={pl?.vatPayable ?? 0} bold highlight="neutral" />
                    <Div double />

                    {/* ── [11] NET PROFIT ───────────────────────────────────────────── */}
                    <tr>
                      <td className="pl-4 pt-4 pb-5 text-base font-extrabold text-slate-900">{t("pl.rows.netProfit")}</td>
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
                    {t("reportsExtra.footer.title")}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5">
                    <span>{t("reportsExtra.footer.rule1")}</span>
                    <span>{t("reportsExtra.footer.rule2")}</span>
                    <span>{t("reportsExtra.footer.rule3")}</span>
                    <span>{t("reportsExtra.footer.rule4")}</span>
                    <span>{t("reportsExtra.footer.rule5")}</span>
                    <span>{t("reportsExtra.footer.rule6")}</span>
                  </div>
                  <p className="text-slate-400">{t("reportsExtra.footer.ebitdaFormula")}</p>
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
                  <p className="text-xs text-slate-500 mb-0.5">{t("reportsExtra.monthlyKpi.taxInvoiceNet")}</p>
                  <p className="font-bold text-blue-800 tabular-nums">{formatSAR(totTaxNet)}</p>
                  <p className="text-[10px] text-blue-600">{t("reportsExtra.monthlyKpi.beforeVat")}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-xs text-slate-500 mb-0.5">{t("reportsExtra.monthlyKpi.inputVat")}</p>
                  <p className="font-bold text-emerald-700 tabular-nums">{formatSAR(totVat)}</p>
                  <p className="text-[10px] text-emerald-600">{t("reportsExtra.monthlyKpi.reclaimable")}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-xs text-slate-500 mb-0.5">{t("reportsExtra.monthlyKpi.taxInvoiceTotal")}</p>
                  <p className="font-bold text-emerald-800 tabular-nums">{formatSAR(totTaxGross)}</p>
                  <p className="text-[10px] text-emerald-600">{t("reportsExtra.monthlyKpi.inclVat")}</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-xs text-slate-500 mb-0.5">{t("reportsExtra.monthlyKpi.nonTaxTotal")}</p>
                  <p className="font-bold text-amber-700 tabular-nums">{formatSAR(totNonTax)}</p>
                  <p className="text-[10px] text-amber-600">{t("reportsExtra.monthlyKpi.noVat")}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-xs text-slate-500 mb-0.5">{t("reportsExtra.monthlyKpi.grandTotal")}</p>
                  <p className="font-bold text-slate-800 tabular-nums">{formatSAR(grandTot)}</p>
                  <p className="text-[10px] text-slate-500">{t("reportsExtra.monthlyKpi.allInvoices")}</p>
                </div>
              </div>
            );
          })()}
          {monthlyLoading ? (
            <div className="py-16 text-center text-slate-400">{t("common.loading")}</div>
          ) : (
            <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-start font-semibold text-slate-600">{t("reportsExtra.monthlyTable.month")}</th>
                    <th className="px-4 py-3 text-end font-semibold text-slate-600">{t("reportsExtra.monthlyTable.taxNet")}</th>
                    <th className="px-4 py-3 text-end font-semibold text-slate-600">{t("reportsExtra.monthlyTable.inputVat")}</th>
                    <th className="px-4 py-3 text-end font-semibold text-slate-600">{t("reportsExtra.monthlyTable.taxTotal")}</th>
                    <th className="px-4 py-3 text-end font-semibold text-slate-600">{t("reportsExtra.monthlyTable.nonTax")}</th>
                    <th className="px-4 py-3 text-end font-semibold text-slate-600">{t("reportsExtra.monthlyTable.grandTotal")}</th>
                    <th className="px-4 py-3 text-end font-semibold text-slate-600">{t("reportsExtra.monthlyTable.records")}</th>
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
                    <tr><td colSpan={7} className="py-16 text-center text-slate-400">{t("reportsExtra.monthlyTable.empty")}</td></tr>
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
            <div className="py-16 text-center text-slate-400">{t("common.loading")}</div>
          ) : (
            <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-start font-semibold text-slate-600">{t("reportsExtra.categoryTable.category")}</th>
                    <th className="px-4 py-3 text-start font-semibold text-slate-600">{t("reportsExtra.categoryTable.group")}</th>
                    <th className="px-4 py-3 text-end font-semibold text-slate-600">{t("reportsExtra.categoryTable.netSar")}</th>
                    <th className="px-4 py-3 text-end font-semibold text-slate-600">{t("reportsExtra.categoryTable.vat")}</th>
                    <th className="px-4 py-3 text-end font-semibold text-slate-600">{t("reportsExtra.categoryTable.total")}</th>
                    <th className="px-4 py-3 text-end font-semibold text-slate-600">{t("reportsExtra.categoryTable.records")}</th>
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
                    <tr><td colSpan={6} className="py-16 text-center text-slate-400">{t("reportsExtra.categoryTable.empty")}</td></tr>
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
