import { useState, useRef } from "react";
import {
  useGetPLReport,
  useGetMonthlyPurchaseReport,
  useGetCategoryExpenseReport,
} from "@workspace/api-client-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatSAR, formatMonth } from "@/lib/format";
import { exportToExcel } from "@/lib/export-excel";
import { getCategoryMeta } from "@/lib/categories";
import { Printer, TrendingUp, TrendingDown, FileSpreadsheet } from "lucide-react";

// ─────────────────────────────────────── P&L helpers ──────────────────────────
function Row({
  label, value, bold, indent, highlight, percent,
}: {
  label: string; value: number; bold?: boolean; indent?: boolean;
  highlight?: "profit" | "loss" | "neutral"; percent?: number;
}) {
  const col =
    highlight === "profit" ? "text-emerald-600" :
    highlight === "loss" ? "text-rose-600" :
    highlight === "neutral" ? "text-slate-700" : "";

  return (
    <tr className={`border-b border-slate-100 ${bold ? "font-bold" : ""}`}>
      <td className={`py-3 ${indent ? "pl-8 text-slate-500" : "pl-4 text-slate-800"}`}>{label}</td>
      <td className={`py-3 pr-4 text-right tabular-nums ${col} ${bold ? "text-base" : "text-sm"}`}>
        {formatSAR(value)}
      </td>
      {percent !== undefined
        ? <td className="py-3 pr-4 text-right text-xs text-slate-400 w-20">{percent.toFixed(1)}%</td>
        : <td className="w-20" />}
    </tr>
  );
}

function SH({ title }: { title: string }) {
  return (
    <tr>
      <td colSpan={3} className="pt-6 pb-2 pl-4 text-xs font-bold uppercase tracking-widest text-slate-400">{title}</td>
    </tr>
  );
}

function Div() {
  return (
    <tr><td colSpan={3} className="py-0"><div className="border-t-2 border-slate-300" /></td></tr>
  );
}

// ──────────────────────────────────────── Component ───────────────────────────
type Tab = "pl" | "monthly" | "category";

export default function Reports() {
  const [tab, setTab] = useState<Tab>("pl");
  const [month, setMonth] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  const { data: pl, isLoading: plLoading } = useGetPLReport(month ? { month } : undefined);
  const { data: monthly, isLoading: monthlyLoading } = useGetMonthlyPurchaseReport();
  const { data: catReport, isLoading: catLoading } = useGetCategoryExpenseReport(month ? { month } : undefined);

  const totalRevenue = pl?.totalRevenue ?? 0;

  // ── Print P&L ──
  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>P&L Report</title>
    <style>
      body{font-family:Arial,sans-serif;padding:32px;color:#1e293b}
      table{width:100%;border-collapse:collapse;font-size:14px}
      td{padding:8px 12px;border-bottom:1px solid #f1f5f9}
      .section{padding:20px 0 4px;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8}
      .bold td{font-weight:bold}.indent td:first-child{padding-left:28px;color:#64748b}
      .right{text-align:right}.divider td{border-top:2px solid #94a3b8;padding:0}
      .profit{color:#059669;font-weight:bold}.loss{color:#dc2626;font-weight:bold}
    </style></head><body>${el.innerHTML}</body></html>`);
    w.document.close();
    w.print();
  };

  // ── Export monthly ──
  function exportMonthly() {
    const rows = (monthly ?? []).map(m => ({
      Month: m.month,
      "Net Amount (SAR)": m.netAmount,
      "VAT (SAR)": m.totalVat,
      "Total (SAR)": m.totalAmount,
      "Records": m.count,
    }));
    exportToExcel(rows, "monthly-purchases", "Monthly Purchases");
  }

  // ── Export category ──
  function exportCategory() {
    const rows = (catReport ?? []).map(c => ({
      Category: c.label,
      "Net Amount (SAR)": c.netAmount,
      "VAT (SAR)": c.totalVat,
      "Total (SAR)": c.totalAmount,
      "Records": c.count,
    }));
    exportToExcel(rows, `category-expenses-${month || "all"}`, "Category Expenses");
  }

  // ── Export P&L ──
  function exportPL() {
    if (!pl) return;
    const rows = [
      { Section: "REVENUE", Item: "Cash Sales", "Amount (SAR)": pl.cashSales ?? 0 },
      { Section: "REVENUE", Item: "Card / POS Sales", "Amount (SAR)": pl.cardSales ?? 0 },
      { Section: "REVENUE", Item: "Delivery Apps Total", "Amount (SAR)": pl.appSalesTotal ?? 0 },
      { Section: "REVENUE", Item: "Net Sales (excl. VAT)", "Amount (SAR)": pl.netSales ?? 0 },
      { Section: "REVENUE", Item: "Total Revenue", "Amount (SAR)": pl.totalRevenue },
      { Section: "COGS", Item: "Food Cost (Purchases)", "Amount (SAR)": pl.foodCost },
      { Section: "COGS", Item: "Beverage Cost (Purchases)", "Amount (SAR)": pl.beverageCost },
      { Section: "COGS", Item: "General Cost (Purchases)", "Amount (SAR)": pl.otherCost },
      { Section: "COGS", Item: "Total COGS (Raw Purchases)", "Amount (SAR)": pl.totalCOGS },
      { Section: "INVENTORY", Item: "Closing Food Inventory (−)", "Amount (SAR)": -(pl.closingFoodInventory ?? 0) },
      { Section: "INVENTORY", Item: "Closing Beverage Inventory (−)", "Amount (SAR)": -(pl.closingBeverageInventory ?? 0) },
      { Section: "INVENTORY", Item: "Closing General Inventory (−)", "Amount (SAR)": -(pl.closingGeneralInventory ?? 0) },
      { Section: "INVENTORY", Item: "Total Inventory Adjustment (−)", "Amount (SAR)": -(pl.totalInventoryAdjustment ?? 0) },
      { Section: "ADJUSTED COGS", Item: "Adjusted COGS (After Inventory)", "Amount (SAR)": pl.adjustedCOGS ?? pl.totalCOGS },
      { Section: "GROSS PROFIT", Item: "Gross Profit", "Amount (SAR)": pl.grossProfit },
      { Section: "OPEX", Item: "Labour Cost (TLC)", "Amount (SAR)": pl.totalLaborCost },
      { Section: "OPEX", Item: "Fuel & Energy", "Amount (SAR)": pl.fuelEnergyCost },
      { Section: "OPEX", Item: "Maintenance & Repair", "Amount (SAR)": pl.maintenanceCost },
      { Section: "OPEX", Item: "IT & Communication", "Amount (SAR)": pl.itCommunicationCost },
      { Section: "OPEX", Item: "Marketing & Advertising", "Amount (SAR)": pl.marketingCost },
      { Section: "OPEX", Item: "Others Expenses", "Amount (SAR)": pl.othersPurchaseCost },
      { Section: "OPEX", Item: "Fixed Expenses (Rent, Utilities, etc.)", "Amount (SAR)": pl.totalFixedExpenses },
      { Section: "OPEX", Item: "App Commissions (HungerStation, Jahez, etc.)", "Amount (SAR)": pl.totalAppCommissions ?? 0 },
      { Section: "OPEX", Item: "Total Operating Expenses", "Amount (SAR)": pl.totalOperatingExpenses },
      { Section: "OPERATING PROFIT", Item: "Operating Profit", "Amount (SAR)": pl.operatingProfit },
      { Section: "VAT", Item: "Output VAT", "Amount (SAR)": pl.outputVat },
      { Section: "VAT", Item: "Input VAT", "Amount (SAR)": pl.inputVat },
      { Section: "VAT", Item: "VAT Payable", "Amount (SAR)": pl.vatPayable },
      { Section: "NET PROFIT", Item: "Net Profit / (Loss)", "Amount (SAR)": pl.netProfit },
    ];
    exportToExcel(rows, `pl-report-${month || "all"}`, "P&L Report");
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "pl", label: "P&L Statement" },
    { id: "monthly", label: "Monthly Purchases" },
    { id: "category", label: "Category Expenses" },
  ];

  return (
    <div>
      <PageHeader
        title="Financial Reports"
        description="Profit & Loss, Purchase Analysis, and Category Breakdown"
        action={
          <div className="flex gap-2 items-center flex-wrap">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="px-4 py-2 border rounded-xl shadow-sm focus:ring-primary/20 outline-none text-sm"
            />
            {tab === "pl" && (
              <>
                <button onClick={exportPL} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm">
                  <FileSpreadsheet className="w-4 h-4" /> Excel
                </button>
                <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-700 text-sm">
                  <Printer className="w-4 h-4" /> Print
                </button>
              </>
            )}
            {tab === "monthly" && (
              <button onClick={exportMonthly} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm">
                <FileSpreadsheet className="w-4 h-4" /> Export Excel
              </button>
            )}
            {tab === "category" && (
              <button onClick={exportCategory} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm">
                <FileSpreadsheet className="w-4 h-4" /> Export Excel
              </button>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── P&L TAB ─── */}
      {tab === "pl" && (
        <>
          {pl && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Total Revenue", value: pl.totalRevenue, color: "bg-blue-50 border-blue-200 text-blue-700", icon: TrendingUp, sub: "Food + Beverage" },
                { label: "Gross Profit", value: pl.grossProfit, color: pl.grossProfit >= 0 ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-rose-50 border-rose-200 text-rose-700", icon: pl.grossProfit >= 0 ? TrendingUp : TrendingDown, sub: `Margin: ${pl.grossMarginPercent.toFixed(1)}%` },
                { label: "Operating Profit", value: pl.operatingProfit, color: pl.operatingProfit >= 0 ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-rose-50 border-rose-200 text-rose-700", icon: pl.operatingProfit >= 0 ? TrendingUp : TrendingDown, sub: "" },
                { label: "Net Profit / (Loss)", value: pl.netProfit, color: pl.netProfit >= 0 ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-rose-50 border-rose-200 text-rose-700", icon: pl.netProfit >= 0 ? TrendingUp : TrendingDown, sub: `Net margin: ${pl.netMarginPercent.toFixed(1)}%` },
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

          <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
            {plLoading ? (
              <div className="py-16 text-center text-slate-400">Loading P&L data...</div>
            ) : (
              <div ref={printRef}>
                <div className="hidden print:block mb-6 p-6">
                  <h1 className="text-2xl font-bold">Profit & Loss Statement</h1>
                  <p className="text-slate-500">{formatMonth(month)} — Gourmet Ledger, Saudi Arabia</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="pl-4 py-4 text-left text-slate-600 font-semibold">Description</th>
                      <th className="pr-4 py-4 text-right text-slate-600 font-semibold">Amount (SAR)</th>
                      <th className="pr-4 py-4 text-right text-slate-400 font-normal text-xs">% of Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* REVENUE */}
                    <SH title="Revenue by Payment Channel" />

                    {/* Cash & Card */}
                    <tr><td colSpan={3} className="pl-4 pt-3 pb-0.5 text-xs font-semibold text-slate-500">
                      <span className="w-2 h-2 rounded-full bg-blue-400 inline-block mr-1.5" />Direct Channels
                    </td></tr>
                    <Row label="Cash Sales" value={pl?.cashSales ?? 0} indent percent={totalRevenue ? ((pl?.cashSales ?? 0) / totalRevenue * 100) : 0} />
                    <Row label="Card / POS / Visa" value={pl?.cardSales ?? 0} indent percent={totalRevenue ? ((pl?.cardSales ?? 0) / totalRevenue * 100) : 0} />

                    {/* Delivery Apps */}
                    <tr><td colSpan={3} className="pl-4 pt-3 pb-0.5 text-xs font-semibold text-slate-500">
                      <span className="w-2 h-2 rounded-full bg-purple-400 inline-block mr-1.5" />Delivery Apps (HungerStation, Jahez, Talabat…)
                    </td></tr>
                    <Row label="All Apps Combined" value={pl?.appSalesTotal ?? 0} indent percent={totalRevenue ? ((pl?.appSalesTotal ?? 0) / totalRevenue * 100) : 0} />

                    <Div />
                    {/* Revenue totals */}
                    <Row label="Net Sales (excl. VAT)" value={pl?.netSales ?? 0} indent percent={totalRevenue ? ((pl?.netSales ?? 0) / totalRevenue * 100) : 0} />
                    <Row label="Total Revenue" value={pl?.totalRevenue ?? 0} bold highlight="neutral" percent={100} />
                    <Div />

                    {/* COGS */}
                    <SH title="Cost of Goods Sold — Purchases" />
                    <Row label="Cost of Sale – Food (Purchases)" value={pl?.foodCost ?? 0} indent percent={totalRevenue ? ((pl?.foodCost ?? 0) / totalRevenue * 100) : 0} />
                    <Row label="Cost of Sale – Beverage (Purchases)" value={pl?.beverageCost ?? 0} indent percent={totalRevenue ? ((pl?.beverageCost ?? 0) / totalRevenue * 100) : 0} />
                    <Row label="Cost of Sale – General (Purchases)" value={pl?.otherCost ?? 0} indent percent={totalRevenue ? ((pl?.otherCost ?? 0) / totalRevenue * 100) : 0} />
                    <Row label="Total COGS (Raw Purchases)" value={pl?.totalCOGS ?? 0} bold highlight="neutral" percent={totalRevenue ? ((pl?.totalCOGS ?? 0) / totalRevenue * 100) : 0} />

                    {/* Inventory Adjustment */}
                    {(pl?.totalInventoryAdjustment ?? 0) > 0 && (
                      <>
                        <Div />
                        <SH title="Closing Inventory Adjustment (−)" />
                        <Row label="Closing Food Inventory" value={-(pl?.closingFoodInventory ?? 0)} indent percent={totalRevenue ? ((pl?.closingFoodInventory ?? 0) / totalRevenue * 100) : 0} />
                        <Row label="Closing Beverage Inventory" value={-(pl?.closingBeverageInventory ?? 0)} indent percent={totalRevenue ? ((pl?.closingBeverageInventory ?? 0) / totalRevenue * 100) : 0} />
                        <Row label="Closing General Inventory" value={-(pl?.closingGeneralInventory ?? 0)} indent percent={totalRevenue ? ((pl?.closingGeneralInventory ?? 0) / totalRevenue * 100) : 0} />
                        <Row label="Total Inventory Deduction" value={-(pl?.totalInventoryAdjustment ?? 0)} bold highlight="neutral" percent={totalRevenue ? ((pl?.totalInventoryAdjustment ?? 0) / totalRevenue * 100) : 0} />
                        <Div />
                        <Row label="Adjusted COGS (After Inventory)" value={pl?.adjustedCOGS ?? pl?.totalCOGS ?? 0} bold highlight="neutral" percent={totalRevenue ? ((pl?.adjustedCOGS ?? pl?.totalCOGS ?? 0) / totalRevenue * 100) : 0} />
                      </>
                    )}
                    <Div />

                    {/* GROSS PROFIT */}
                    <Row label="Gross Profit" value={pl?.grossProfit ?? 0} bold highlight={(pl?.grossProfit ?? 0) >= 0 ? "profit" : "loss"} percent={pl?.grossMarginPercent} />
                    <Div />

                    {/* OPERATING EXPENSES */}
                    <SH title="Operating Expenses" />
                    <Row label="Total Labour Cost (TLC) — Salaries + Benefits" value={pl?.totalLaborCost ?? 0} indent percent={totalRevenue ? ((pl?.totalLaborCost ?? 0) / totalRevenue * 100) : 0} />
                    {/* Purchase OpEx breakdown */}
                    <Row label="Fuel & Energy" value={pl?.fuelEnergyCost ?? 0} indent percent={totalRevenue ? ((pl?.fuelEnergyCost ?? 0) / totalRevenue * 100) : 0} />
                    <Row label="Maintenance and Repair" value={pl?.maintenanceCost ?? 0} indent percent={totalRevenue ? ((pl?.maintenanceCost ?? 0) / totalRevenue * 100) : 0} />
                    <Row label="IT & Communication" value={pl?.itCommunicationCost ?? 0} indent percent={totalRevenue ? ((pl?.itCommunicationCost ?? 0) / totalRevenue * 100) : 0} />
                    <Row label="Marketing and Advertising" value={pl?.marketingCost ?? 0} indent percent={totalRevenue ? ((pl?.marketingCost ?? 0) / totalRevenue * 100) : 0} />
                    <Row label="Others Expenses" value={pl?.othersPurchaseCost ?? 0} indent percent={totalRevenue ? ((pl?.othersPurchaseCost ?? 0) / totalRevenue * 100) : 0} />
                    <Row label="Fixed Expenses (Rent, Utilities, etc.)" value={pl?.totalFixedExpenses ?? 0} indent percent={totalRevenue ? ((pl?.totalFixedExpenses ?? 0) / totalRevenue * 100) : 0} />
                    <Row label="App Commissions (HungerStation, Jahez, etc.)" value={pl?.totalAppCommissions ?? 0} indent percent={totalRevenue ? ((pl?.totalAppCommissions ?? 0) / totalRevenue * 100) : 0} />
                    <Row label="Total Operating Expenses" value={pl?.totalOperatingExpenses ?? 0} bold highlight="neutral" percent={totalRevenue ? ((pl?.totalOperatingExpenses ?? 0) / totalRevenue * 100) : 0} />
                    <Div />

                    {/* OPERATING PROFIT */}
                    <Row label="Operating Profit (EBITDA)" value={pl?.operatingProfit ?? 0} bold highlight={(pl?.operatingProfit ?? 0) >= 0 ? "profit" : "loss"} percent={totalRevenue ? ((pl?.operatingProfit ?? 0) / totalRevenue * 100) : 0} />
                    <Div />

                    {/* VAT */}
                    <SH title="VAT (Saudi ZATCA 15%)" />
                    <Row label="Output VAT (Sales × 15%)" value={pl?.outputVat ?? 0} indent />
                    <Row label="Input VAT (Recoverable from Purchases)" value={pl?.inputVat ?? 0} indent />
                    <Row label="VAT Payable to Government" value={pl?.vatPayable ?? 0} bold highlight="neutral" />
                    <Div />

                    {/* NET PROFIT */}
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
                <div className="px-6 py-4 bg-slate-50 border-t text-xs text-slate-400">
                  <p>Net Profit = Revenue − COGS − Labour Cost (TLC) − Purchase Operating Expenses − Fixed Expenses − VAT Payable</p>
                  <p className="mt-1">VAT: 15% Saudi ZATCA · TLC = Salary + Accommodation + Medical Insurance + GOSI + Air Ticket ÷ 12</p>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── MONTHLY PURCHASES TAB ─── */}
      {tab === "monthly" && (
        <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
          {monthlyLoading ? (
            <div className="py-16 text-center text-slate-400">Loading...</div>
          ) : !monthly?.length ? (
            <div className="py-16 text-center text-slate-400">No purchase data available</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-6 py-4 text-left text-slate-600 font-semibold">Month</th>
                  <th className="px-6 py-4 text-right text-slate-600 font-semibold">Records</th>
                  <th className="px-6 py-4 text-right text-slate-600 font-semibold">Net Amount</th>
                  <th className="px-6 py-4 text-right text-slate-600 font-semibold">VAT (Input)</th>
                  <th className="px-6 py-4 text-right text-slate-600 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-700">
                {monthly.map((m) => (
                  <tr key={m.month} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium">{formatMonth(m.month)}</td>
                    <td className="px-6 py-4 text-right text-slate-500">{m.count}</td>
                    <td className="px-6 py-4 text-right">{formatSAR(m.netAmount)}</td>
                    <td className="px-6 py-4 text-right text-emerald-600">{formatSAR(m.totalVat)}</td>
                    <td className="px-6 py-4 text-right font-bold">{formatSAR(m.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t font-bold text-slate-800">
                <tr>
                  <td className="px-6 py-4">Total</td>
                  <td className="px-6 py-4 text-right text-slate-500">{monthly.reduce((s, m) => s + m.count, 0)}</td>
                  <td className="px-6 py-4 text-right">{formatSAR(monthly.reduce((s, m) => s + m.netAmount, 0))}</td>
                  <td className="px-6 py-4 text-right text-emerald-600">{formatSAR(monthly.reduce((s, m) => s + m.totalVat, 0))}</td>
                  <td className="px-6 py-4 text-right">{formatSAR(monthly.reduce((s, m) => s + m.totalAmount, 0))}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

      {/* ─── CATEGORY EXPENSES TAB ─── */}
      {tab === "category" && (
        <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
          {catLoading ? (
            <div className="py-16 text-center text-slate-400">Loading...</div>
          ) : !catReport?.length ? (
            <div className="py-16 text-center text-slate-400">No purchase data for {formatMonth(month)}</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-6 py-4 text-left text-slate-600 font-semibold">Category</th>
                  <th className="px-6 py-4 text-left text-slate-600 font-semibold">P&L Section</th>
                  <th className="px-6 py-4 text-right text-slate-600 font-semibold">Records</th>
                  <th className="px-6 py-4 text-right text-slate-600 font-semibold">Net Amount</th>
                  <th className="px-6 py-4 text-right text-slate-600 font-semibold">VAT</th>
                  <th className="px-6 py-4 text-right text-slate-600 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-700">
                {catReport.map((c) => {
                  const meta = getCategoryMeta(c.category);
                  return (
                    <tr key={c.category} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${meta.badge}`}>
                          {c.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-xs">
                        {meta.section === "cogs" ? "Cost of Goods Sold" : "Operating Expenses"}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-500">{c.count}</td>
                      <td className="px-6 py-4 text-right">{formatSAR(c.netAmount)}</td>
                      <td className="px-6 py-4 text-right text-emerald-600">{formatSAR(c.totalVat)}</td>
                      <td className="px-6 py-4 text-right font-bold">{formatSAR(c.totalAmount)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 border-t font-bold text-slate-800">
                <tr>
                  <td colSpan={3} className="px-6 py-4">Total</td>
                  <td className="px-6 py-4 text-right">{formatSAR(catReport.reduce((s, c) => s + c.netAmount, 0))}</td>
                  <td className="px-6 py-4 text-right text-emerald-600">{formatSAR(catReport.reduce((s, c) => s + c.totalVat, 0))}</td>
                  <td className="px-6 py-4 text-right">{formatSAR(catReport.reduce((s, c) => s + c.totalAmount, 0))}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
