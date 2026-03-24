import { useState, useRef } from "react";
import { useGetPLReport } from "@workspace/api-client-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatSAR, formatMonth } from "@/lib/format";
import { Printer, TrendingUp, TrendingDown, Minus } from "lucide-react";

function Row({
  label, value, bold, indent, highlight, percent,
}: {
  label: string; value: number; bold?: boolean; indent?: boolean;
  highlight?: "profit" | "loss" | "neutral"; percent?: number;
}) {
  const highlightClass =
    highlight === "profit" ? "text-emerald-600" :
    highlight === "loss" ? "text-rose-600" :
    highlight === "neutral" ? "text-slate-700" : "";

  return (
    <tr className={`border-b border-slate-100 ${bold ? "font-bold" : ""}`}>
      <td className={`py-3 ${indent ? "pl-8 text-slate-500" : "pl-4 text-slate-800"}`}>{label}</td>
      <td className={`py-3 pr-4 text-right tabular-nums ${highlightClass} ${bold ? "text-base" : "text-sm"}`}>
        {formatSAR(value)}
      </td>
      {percent !== undefined ? (
        <td className="py-3 pr-4 text-right text-xs text-slate-400 w-20">{percent.toFixed(1)}%</td>
      ) : (
        <td className="w-20" />
      )}
    </tr>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <tr>
      <td colSpan={3} className="pt-6 pb-2 pl-4 text-xs font-bold uppercase tracking-widest text-slate-400">{title}</td>
    </tr>
  );
}

function Divider() {
  return (
    <tr>
      <td colSpan={3} className="py-0">
        <div className="border-t-2 border-slate-300" />
      </td>
    </tr>
  );
}

export default function Reports() {
  const [month, setMonth] = useState("");
  const printRef = useRef<HTMLDivElement>(null);
  const { data: pl, isLoading } = useGetPLReport(month ? { month } : undefined);

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>P&L Report - ${formatMonth(month)}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 32px; color: #1e293b; }
        h1 { font-size: 24px; margin-bottom: 4px; }
        p { color: #64748b; margin-bottom: 24px; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }
        .section { padding-top: 20px; padding-bottom: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; }
        .bold td { font-weight: bold; }
        .indent td:first-child { padding-left: 28px; color: #64748b; }
        .right { text-align: right; }
        .divider td { border-top: 2px solid #94a3b8; padding: 0; }
        .profit { color: #059669; font-weight: bold; }
        .loss { color: #dc2626; font-weight: bold; }
        .percent { color: #94a3b8; font-size: 11px; }
        .header { margin-bottom: 32px; }
      </style>
      </head><body>${el.innerHTML}</body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const totalRevenue = pl?.totalRevenue ?? 0;

  return (
    <div>
      <PageHeader
        title="Profit & Loss Statement"
        description={`Financial performance — ${formatMonth(month)}`}
        action={
          <div className="flex gap-3 items-center">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="px-4 py-2 border rounded-xl shadow-sm focus:ring-primary/20 outline-none"
            />
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-700 transition-colors"
            >
              <Printer className="w-4 h-4" /> Print / Export
            </button>
          </div>
        }
      />

      {/* KPI Summary Cards */}
      {pl && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Revenue", value: pl.totalRevenue, color: "bg-blue-50 border-blue-200 text-blue-700", icon: TrendingUp },
            { label: "Gross Profit", value: pl.grossProfit, color: pl.grossProfit >= 0 ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-rose-50 border-rose-200 text-rose-700", icon: pl.grossProfit >= 0 ? TrendingUp : TrendingDown },
            { label: "Operating Profit", value: pl.operatingProfit, color: pl.operatingProfit >= 0 ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-rose-50 border-rose-200 text-rose-700", icon: pl.operatingProfit >= 0 ? TrendingUp : TrendingDown },
            { label: "Net Profit / (Loss)", value: pl.netProfit, color: pl.netProfit >= 0 ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-rose-50 border-rose-200 text-rose-700", icon: pl.netProfit >= 0 ? TrendingUp : TrendingDown },
          ].map((k, i) => (
            <div key={i} className={`rounded-2xl border p-5 ${k.color}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{k.label}</p>
                <k.icon className="w-4 h-4 opacity-60" />
              </div>
              <p className="text-2xl font-bold">{formatSAR(k.value)}</p>
              {i === 0 && <p className="text-xs mt-1 opacity-60">Food + Beverage</p>}
              {i === 1 && <p className="text-xs mt-1 opacity-60">Margin: {pl.grossMarginPercent.toFixed(1)}%</p>}
              {i === 3 && <p className="text-xs mt-1 opacity-60">Net margin: {pl.netMarginPercent.toFixed(1)}%</p>}
            </div>
          ))}
        </div>
      )}

      {/* Printable P&L Table */}
      <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400">Loading P&L data...</div>
        ) : (
          <div ref={printRef}>
            {/* Print header (hidden on screen) */}
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
                <SectionHeader title="Revenue" />
                <Row label="Food Sales" value={pl?.foodSales ?? 0} indent percent={totalRevenue ? ((pl?.foodSales ?? 0) / totalRevenue * 100) : 0} />
                <Row label="Beverage Sales" value={pl?.beverageSales ?? 0} indent percent={totalRevenue ? ((pl?.beverageSales ?? 0) / totalRevenue * 100) : 0} />
                <Row label="Total Revenue" value={pl?.totalRevenue ?? 0} bold highlight="neutral" percent={100} />
                <Divider />

                {/* COST OF GOODS SOLD */}
                <SectionHeader title="Cost of Goods Sold (COGS)" />
                <Row label="Food Cost" value={pl?.foodCost ?? 0} indent percent={pl?.foodCostPercent} />
                <Row label="Beverage Cost" value={pl?.beverageCost ?? 0} indent percent={pl?.beverageCostPercent} />
                <Row label="Other Purchases" value={pl?.otherCost ?? 0} indent percent={totalRevenue ? ((pl?.otherCost ?? 0) / totalRevenue * 100) : 0} />
                <Row label="Total COGS" value={pl?.totalCOGS ?? 0} bold highlight="neutral" percent={totalRevenue ? ((pl?.totalCOGS ?? 0) / totalRevenue * 100) : 0} />
                <Divider />

                {/* GROSS PROFIT */}
                <Row
                  label="Gross Profit"
                  value={pl?.grossProfit ?? 0}
                  bold
                  highlight={(pl?.grossProfit ?? 0) >= 0 ? "profit" : "loss"}
                  percent={pl?.grossMarginPercent}
                />
                <Divider />

                {/* OPERATING EXPENSES */}
                <SectionHeader title="Operating Expenses" />
                <Row label="Total Labour Cost (TLC) — Salaries + Benefits" value={pl?.totalLaborCost ?? 0} indent percent={totalRevenue ? ((pl?.totalLaborCost ?? 0) / totalRevenue * 100) : 0} />
                <Row label="Fixed Expenses (Rent, Utilities, etc.)" value={pl?.totalFixedExpenses ?? 0} indent percent={totalRevenue ? ((pl?.totalFixedExpenses ?? 0) / totalRevenue * 100) : 0} />
                <Row label="Total Operating Expenses" value={pl?.totalOperatingExpenses ?? 0} bold highlight="neutral" percent={totalRevenue ? ((pl?.totalOperatingExpenses ?? 0) / totalRevenue * 100) : 0} />
                <Divider />

                {/* OPERATING PROFIT */}
                <Row
                  label="Operating Profit (EBITDA)"
                  value={pl?.operatingProfit ?? 0}
                  bold
                  highlight={(pl?.operatingProfit ?? 0) >= 0 ? "profit" : "loss"}
                  percent={totalRevenue ? ((pl?.operatingProfit ?? 0) / totalRevenue * 100) : 0}
                />
                <Divider />

                {/* VAT */}
                <SectionHeader title="VAT (Saudi ZATCA 15%)" />
                <Row label="Output VAT (Sales × 15%)" value={pl?.outputVat ?? 0} indent />
                <Row label="Input VAT (Recoverable from Purchases)" value={pl?.inputVat ?? 0} indent />
                <Row label="VAT Payable to Government" value={pl?.vatPayable ?? 0} bold highlight="neutral" />
                <Divider />

                {/* NET PROFIT */}
                <tr>
                  <td className="pl-4 pt-4 pb-5 text-base font-extrabold text-slate-900">
                    Net Profit / (Loss)
                  </td>
                  <td className={`pr-4 pt-4 pb-5 text-right text-xl font-extrabold tabular-nums ${(pl?.netProfit ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {formatSAR(pl?.netProfit)}
                  </td>
                  <td className="pr-4 pt-4 pb-5 text-right text-sm font-semibold text-slate-400">
                    {pl?.netMarginPercent?.toFixed(1)}%
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Footer note */}
            <div className="px-6 py-4 bg-slate-50 border-t text-xs text-slate-400">
              <p>Formula: Net Profit = Revenue − COGS − Labour Cost (TLC) − Fixed Expenses − VAT Payable</p>
              <p className="mt-1">VAT Rate: 15% (Saudi ZATCA) · Labour Cost includes: Salary + Accommodation + Medical Insurance + GOSI + Air Ticket ÷ 12</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
