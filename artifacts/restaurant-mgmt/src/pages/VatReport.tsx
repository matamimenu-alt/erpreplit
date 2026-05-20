import { useState } from "react";
import { useGetVatReport } from "@workspace/api-client-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrintButton } from "@/components/ui/PrintButton";
import { formatSAR, formatMonth } from "@/lib/format";
import { Calculator, ShieldCheck, ArrowRightLeft, ArrowUpRight, ArrowDownLeft, Info, Receipt, Wallet, TrendingUp, TrendingDown } from "lucide-react";

function SourceTotal({ label, vat, net, color }: { label: string; vat: number; net: number; color: "blue" | "emerald" | "purple" }) {
  const palette = {
    blue:    { dot: "bg-blue-500",    text: "text-blue-700" },
    emerald: { dot: "bg-emerald-500", text: "text-emerald-700" },
    purple:  { dot: "bg-purple-500",  text: "text-purple-700" },
  }[color];
  return (
    <div className="px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${palette.dot}`} />
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      </div>
      <div className="text-right text-xs">
        <div className="text-slate-500">Net: <span className="font-semibold text-slate-700">{formatSAR(net)}</span></div>
        <div className={`font-bold ${palette.text}`}>VAT: {formatSAR(vat)}</div>
      </div>
    </div>
  );
}

export default function VatReport() {
  const [month, setMonth] = useState("");
  const { data: reportRaw, isLoading } = useGetVatReport(month ? { month } : undefined);

  // Extended type — API returns these fields; generated type may lag behind
  type VatReportExt = typeof reportRaw & {
    vatTransferredOut?: number;
    netAmountTransferredOut?: number;
    transfersOutCount?: number;
    vatReceivedIn?: number;
    netAmountReceivedIn?: number;
    transfersInCount?: number;
    netTransferVatImpact?: number;
    adjustedInputVat?: number;
    fixedCostInputVat?: number;
    expenseLedgerNet?: number;
    expenseLedgerInputVat?: number;
    totalTaxableSales?: number;
    totalOutputVat?: number;
    totalTaxableExpenses?: number;
    totalInputVat?: number;
    finalVatDue?: number;
    zatca?: {
      box1_taxableSupplies: number;
      box2_outputVat: number;
      box3_taxablePurchases: number;
      box4_inputVatGross: number;
      box4_fixedCostInputVat: number;
      box4_vatTransferredOut: number;
      box4_vatReceivedIn: number;
      box4_inputVatNet: number;
      box5_vatPayable: number;
    };
    breakdown?: BreakdownRow[];
    breakdownTotals?: {
      purchases:     { vat: number; net: number };
      expenseLedger: { vat: number; net: number };
      fixedCosts:    { vat: number; net: number };
    };
    excluded?: Array<{ sourceType: string; sourceId: string; label: string; date: string; amount: number; reason: string }>;
  };

  type BreakdownRow = {
    sourceType: "purchase" | "fixed-cost" | "expense-ledger";
    sourceId: string;
    label: string;
    date: string;
    vatType: string;
    vatRate: number;
    taxableAmount: number;
    vatAmount: number;
    status: "taxable" | "exempt" | "excluded";
    reason?: string;
  };

  const [bdFilter, setBdFilter] = useState<"all" | "purchase" | "fixed-cost" | "expense-ledger">("all");
  const [showExempt, setShowExempt] = useState(true);

  const report = reportRaw as VatReportExt | undefined;
  const r = report; // alias for clarity

  const hasTransfers =
    (r?.vatTransferredOut ?? 0) > 0 || (r?.vatReceivedIn ?? 0) > 0;
  const hasFixedCostVat = (r?.fixedCostInputVat ?? 0) > 0;
  const hasExpenseLedgerVat = (r?.expenseLedgerInputVat ?? 0) > 0;

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="ZATCA VAT Report"
        description="Automated 15% VAT calculation — inter-branch VAT allocation included."
        action={
          <div className="flex gap-2 items-center">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="no-print px-4 py-2 border rounded-xl shadow-sm focus:ring-primary/20 outline-none"
            />
            <PrintButton />
          </div>
        }
      />

      {/* ── Comprehensive Summary ── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm mb-6 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <Calculator className="w-4 h-4 text-indigo-600" />
          <h3 className="font-bold text-slate-800">ملخص ضريبة القيمة المضافة</h3>
          <span className="text-xs text-slate-400 mr-auto">
            {month ? formatMonth(month) : "كل الفترات"}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          {/* OUTPUT SIDE */}
          <div className="p-6 space-y-3">
            <div className="flex items-center gap-2 text-emerald-700 mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wide">المبيعات — Output VAT</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">إجمالي المبيعات الخاضعة</span>
              <span className="font-semibold text-slate-900">{formatSAR(r?.totalTaxableSales ?? r?.totalSales)}</span>
            </div>
            <div className="flex justify-between text-base bg-emerald-50 rounded-lg px-3 py-2.5">
              <span className="font-bold text-emerald-800">إجمالي ضريبة المبيعات</span>
              <span className="font-bold text-emerald-700">{formatSAR(r?.totalOutputVat ?? r?.outputVat)}</span>
            </div>
          </div>

          {/* INPUT SIDE */}
          <div className="p-6 space-y-3">
            <div className="flex items-center gap-2 text-rose-700 mb-2">
              <TrendingDown className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wide">المصروفات — Input VAT</span>
            </div>
            <div className="space-y-1.5 text-xs text-slate-500">
              <div className="flex justify-between"><span>المشتريات</span><span>{formatSAR(r?.totalPurchases)}</span></div>
              <div className="flex justify-between"><span>المصروفات التشغيلية</span><span>{formatSAR(r?.expenseLedgerNet ?? 0)}</span></div>
              {hasFixedCostVat && <div className="flex justify-between"><span>المصروفات الثابتة (خاضعة)</span><span className="text-emerald-600">VAT: {formatSAR(r?.fixedCostInputVat)}</span></div>}
            </div>
            <div className="flex justify-between text-sm pt-1 border-t border-slate-100">
              <span className="text-slate-600">إجمالي المصروفات الخاضعة</span>
              <span className="font-semibold text-slate-900">{formatSAR(r?.totalTaxableExpenses)}</span>
            </div>
            <div className="flex justify-between text-base bg-rose-50 rounded-lg px-3 py-2.5">
              <span className="font-bold text-rose-800">إجمالي ضريبة المصروفات</span>
              <span className="font-bold text-rose-700">{formatSAR(r?.totalInputVat ?? r?.adjustedInputVat)}</span>
            </div>
          </div>
        </div>

        {/* Final VAT Due Bar */}
        <div className={`px-6 py-4 border-t flex items-center justify-between ${(r?.finalVatDue ?? r?.vatPayable ?? 0) >= 0 ? "bg-gradient-to-r from-rose-50 to-amber-50" : "bg-gradient-to-r from-teal-50 to-emerald-50"}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${(r?.finalVatDue ?? r?.vatPayable ?? 0) >= 0 ? "bg-rose-100 text-rose-700" : "bg-teal-100 text-teal-700"}`}>
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide">
                {(r?.finalVatDue ?? r?.vatPayable ?? 0) >= 0 ? "صافي الضريبة المستحقة" : "رصيد ضريبي للاسترداد"}
              </div>
              <div className="text-[11px] text-slate-400 font-mono">Output VAT − Input VAT</div>
            </div>
          </div>
          <div className={`text-3xl font-display font-bold ${(r?.finalVatDue ?? r?.vatPayable ?? 0) >= 0 ? "text-rose-700" : "text-teal-700"}`}>
            {isLoading ? "..." : formatSAR(r?.finalVatDue ?? r?.vatPayable)}
          </div>
        </div>

        {/* Source breakdown chips */}
        <div className="px-6 py-3 bg-slate-50 border-t flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-slate-400 font-semibold uppercase">مصادر ضريبة المصروفات:</span>
          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold flex items-center gap-1">
            <Receipt className="w-3 h-3" /> المشتريات {formatSAR(r?.inputVat)}
          </span>
          {hasExpenseLedgerVat && (
            <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold flex items-center gap-1">
              <Receipt className="w-3 h-3" /> دفتر المصروفات {formatSAR(r?.expenseLedgerInputVat)}
            </span>
          )}
          {hasFixedCostVat && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold flex items-center gap-1">
              <Receipt className="w-3 h-3" /> المصروفات الثابتة {formatSAR(r?.fixedCostInputVat)}
            </span>
          )}
          {hasTransfers && (
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold flex items-center gap-1">
              <ArrowRightLeft className="w-3 h-3" /> صافي تحويلات الفروع {formatSAR(r?.netTransferVatImpact ?? 0)}
            </span>
          )}
        </div>
      </div>

      {/* ── Hero card ── */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-xl mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Calculator className="w-48 h-48" />
        </div>
        <div className="relative z-10">
          <p className="text-blue-100 font-medium tracking-wide uppercase text-sm mb-2">
            NET VAT PAYABLE — {month ? formatMonth(month).toUpperCase() : "ALL TIME"}
          </p>
          <h2 className="text-5xl font-display font-bold">
            {isLoading ? "..." : formatSAR(report?.vatPayable)}
          </h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-lg backdrop-blur-md">
              <ShieldCheck className="w-5 h-5" />
              <span className="text-sm font-medium">ZATCA Compliant · 15% Standard Rate</span>
            </div>
            {hasTransfers && (
              <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-lg backdrop-blur-md">
                <ArrowRightLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Inter-Branch VAT Allocated</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Output / Input cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Output VAT */}
        <div className="bg-card rounded-2xl p-6 border shadow-sm">
          <h3 className="text-lg font-bold border-b pb-4 mb-4">Output VAT (From Sales)</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-slate-600 text-sm">
              <span>Total Sales (Incl. VAT)</span>
              <span className="font-medium">{formatSAR(report?.totalSales)}</span>
            </div>
            <div className="flex justify-between items-center text-lg font-bold text-slate-900 bg-slate-50 p-3 rounded-lg">
              <span>Output VAT Collected</span>
              <span className="text-emerald-600">{formatSAR(report?.outputVat)}</span>
            </div>
          </div>
        </div>

        {/* Input VAT */}
        <div className="bg-card rounded-2xl p-6 border shadow-sm">
          <h3 className="text-lg font-bold border-b pb-4 mb-4">Input VAT (From Purchases)</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-slate-600 text-sm">
              <span>Total Purchases (Pre-VAT)</span>
              <span className="font-medium">{formatSAR(report?.totalPurchases)}</span>
            </div>
            <div className="flex justify-between items-center text-sm text-slate-600">
              <span>Input VAT on Purchase Invoices</span>
              <span className="font-medium text-rose-500">{formatSAR(report?.inputVat)}</span>
            </div>
            {hasFixedCostVat && (
              <div className="flex justify-between items-center text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">
                <span className="flex items-center gap-1.5">
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  VAT on Fixed Costs (rent, utilities, subscriptions)
                </span>
                <span className="font-semibold">+ {formatSAR(r?.fixedCostInputVat)}</span>
              </div>
            )}
            {hasExpenseLedgerVat && (
              <div className="flex justify-between items-center text-sm text-purple-700 bg-purple-50 px-3 py-2 rounded-lg">
                <span className="flex items-center gap-1.5">
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  VAT on Expense Ledger (insurance, gov fees, services, contracts)
                </span>
                <span className="font-semibold">+ {formatSAR(r?.expenseLedgerInputVat)}</span>
              </div>
            )}
            {hasTransfers && (
              <>
                {(r?.vatTransferredOut ?? 0) > 0 && (
                  <div className="flex justify-between items-center text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                    <span className="flex items-center gap-1.5">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      VAT Transferred Out (goods sent)
                    </span>
                    <span className="font-semibold">− {formatSAR(r?.vatTransferredOut)}</span>
                  </div>
                )}
                {(r?.vatReceivedIn ?? 0) > 0 && (
                  <div className="flex justify-between items-center text-sm text-teal-700 bg-teal-50 px-3 py-2 rounded-lg">
                    <span className="flex items-center gap-1.5">
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                      VAT Received In (goods received)
                    </span>
                    <span className="font-semibold">+ {formatSAR(r?.vatReceivedIn)}</span>
                  </div>
                )}
              </>
            )}
            <div className="flex justify-between items-center text-lg font-bold text-slate-900 bg-slate-50 p-3 rounded-lg">
              <span>{(hasTransfers || hasFixedCostVat || hasExpenseLedgerVat) ? "Adjusted Input VAT" : "Input VAT Paid"}</span>
              <span className="text-rose-600">
                {formatSAR((hasTransfers || hasFixedCostVat || hasExpenseLedgerVat) ? r?.adjustedInputVat : report?.inputVat)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Per-Source VAT Breakdown (Purchases / Fixed Costs / Expense Ledger) ── */}
      {(r?.breakdown?.length ?? 0) > 0 && (
        <div className="bg-card rounded-2xl border shadow-sm mb-6 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
            <Receipt className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-slate-800">VAT Breakdown by Source</h3>
            <span className="text-xs text-slate-400">كل بنود الضريبة من جميع المصادر</span>

            {/* Filter chips */}
            <div className="ml-auto flex flex-wrap items-center gap-1.5 text-xs no-print">
              {([
                ["all",            "All",            r?.breakdown?.length ?? 0],
                ["purchase",       "Purchases",      r?.breakdown?.filter(b => b.sourceType === "purchase").length ?? 0],
                ["fixed-cost",     "Fixed Costs",    r?.breakdown?.filter(b => b.sourceType === "fixed-cost").length ?? 0],
                ["expense-ledger", "Expense Ledger", r?.breakdown?.filter(b => b.sourceType === "expense-ledger").length ?? 0],
              ] as const).map(([k, label, n]) => (
                <button
                  key={k}
                  onClick={() => setBdFilter(k)}
                  className={`px-2.5 py-1 rounded-full font-semibold border transition ${
                    bdFilter === k
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                  }`}
                >
                  {label} <span className="opacity-70">({n})</span>
                </button>
              ))}
              <label className="flex items-center gap-1.5 ml-2 cursor-pointer text-slate-600">
                <input type="checkbox" checked={showExempt} onChange={e => setShowExempt(e.target.checked)} className="accent-indigo-600" />
                Show exempt / excluded
              </label>
            </div>
          </div>

          {/* Source totals */}
          {r?.breakdownTotals && (
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100 bg-slate-50 border-b">
              <SourceTotal label="Purchases"      vat={r.breakdownTotals.purchases.vat}     net={r.breakdownTotals.purchases.net}     color="blue"   />
              <SourceTotal label="Fixed Costs"    vat={r.breakdownTotals.fixedCosts.vat}    net={r.breakdownTotals.fixedCosts.net}    color="emerald"/>
              <SourceTotal label="Expense Ledger" vat={r.breakdownTotals.expenseLedger.vat} net={r.breakdownTotals.expenseLedger.net} color="purple" />
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold">Source</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Item</th>
                  <th className="px-4 py-2.5 text-center font-semibold">Date</th>
                  <th className="px-4 py-2.5 text-center font-semibold">VAT Type</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Rate</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Taxable (net)</th>
                  <th className="px-4 py-2.5 text-right font-semibold">VAT Amount</th>
                  <th className="px-4 py-2.5 text-center font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {(r?.breakdown ?? [])
                  .filter(b => bdFilter === "all" || b.sourceType === bdFilter)
                  .filter(b => showExempt || b.status === "taxable")
                  .map((b) => {
                    const srcMeta = b.sourceType === "purchase"
                      ? { label: "Purchase",       color: "bg-blue-100 text-blue-700" }
                      : b.sourceType === "fixed-cost"
                        ? { label: "Fixed Cost",   color: "bg-emerald-100 text-emerald-700" }
                        : { label: "Expense",      color: "bg-purple-100 text-purple-700" };
                    const statusMeta = b.status === "taxable"
                      ? { label: "Taxable",  color: "bg-emerald-50 text-emerald-700 border-emerald-200" }
                      : b.status === "exempt"
                        ? { label: "Exempt", color: "bg-slate-50 text-slate-500 border-slate-200" }
                        : { label: "Excluded", color: "bg-amber-50 text-amber-700 border-amber-200" };
                    return (
                      <tr key={`${b.sourceType}-${b.sourceId}`} className="border-t border-slate-100 hover:bg-slate-50/60">
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${srcMeta.color}`}>{srcMeta.label}</span>
                        </td>
                        <td className="px-4 py-2 text-slate-700">{b.label}</td>
                        <td className="px-4 py-2 text-center text-slate-500 text-xs">{b.date}</td>
                        <td className="px-4 py-2 text-center text-xs text-slate-600 capitalize">{b.vatType}</td>
                        <td className="px-4 py-2 text-right text-xs text-slate-500">{b.vatRate ? `${b.vatRate}%` : "—"}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{formatSAR(b.taxableAmount)}</td>
                        <td className={`px-4 py-2 text-right font-semibold tabular-nums ${b.vatAmount > 0 ? "text-rose-600" : "text-slate-400"}`}>
                          {formatSAR(b.vatAmount)}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] border font-semibold ${statusMeta.color}`} title={b.reason ?? ""}>
                            {statusMeta.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                {(r?.breakdown ?? []).filter(b => bdFilter === "all" || b.sourceType === bdFilter).filter(b => showExempt || b.status === "taxable").length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400 text-sm">No entries match the current filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Excluded audit list (auto-generated entries) */}
          {(r?.excluded?.length ?? 0) > 0 && (
            <div className="border-t border-slate-100 bg-amber-50/40 p-4">
              <details>
                <summary className="cursor-pointer text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  {r?.excluded?.length} auto-generated entries excluded from Input VAT (already counted at source) — click for audit list
                </summary>
                <ul className="mt-3 space-y-1 text-xs text-slate-600">
                  {r?.excluded?.map(e => (
                    <li key={`x-${e.sourceId}`} className="flex justify-between gap-4">
                      <span className="truncate">{e.label} <span className="text-slate-400">· {e.date}</span></span>
                      <span className="text-slate-500">{formatSAR(e.amount)} · {e.reason}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          )}
        </div>
      )}

      {/* ── Inter-Branch Transfer VAT Section ── */}
      {hasTransfers && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <ArrowRightLeft className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-blue-800">Inter-Branch Transfer VAT Allocation</h3>
            <div className="ml-auto flex items-center gap-1.5 text-xs text-blue-500 bg-blue-100 px-3 py-1 rounded-full">
              <Info className="w-3.5 h-3.5" />
              VAT travels with goods — not copied
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* VAT Out */}
            <div className="bg-white rounded-xl p-4 border border-amber-200">
              <div className="flex items-center gap-2 text-amber-600 mb-2">
                <ArrowUpRight className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">VAT Transferred Out</span>
              </div>
              <p className="text-xl font-bold text-amber-700">
                {formatSAR(r?.vatTransferredOut ?? 0)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Net goods: {formatSAR(r?.netAmountTransferredOut ?? 0)}<br />
                {r?.transfersOutCount ?? 0} transfer(s)
              </p>
              <p className="text-xs text-amber-600 mt-2 font-medium">
                Reduces this branch's input VAT
              </p>
            </div>

            {/* Net VAT Impact */}
            <div className="bg-white rounded-xl p-4 border border-blue-200 flex flex-col items-center justify-center text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-500 mb-2">Net VAT Impact</p>
              <p className={`text-2xl font-bold ${(r?.netTransferVatImpact ?? 0) >= 0 ? "text-teal-600" : "text-rose-600"}`}>
                {(r?.netTransferVatImpact ?? 0) >= 0 ? "+" : ""}
                {formatSAR(r?.netTransferVatImpact ?? 0)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {(r?.netTransferVatImpact ?? 0) >= 0
                  ? "Net gain in input VAT credit"
                  : "Net reduction in input VAT credit"}
              </p>
            </div>

            {/* VAT In */}
            <div className="bg-white rounded-xl p-4 border border-teal-200">
              <div className="flex items-center gap-2 text-teal-600 mb-2">
                <ArrowDownLeft className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">VAT Received In</span>
              </div>
              <p className="text-xl font-bold text-teal-700">
                {formatSAR(r?.vatReceivedIn ?? 0)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Net goods: {formatSAR(r?.netAmountReceivedIn ?? 0)}<br />
                {r?.transfersInCount ?? 0} transfer(s)
              </p>
              <p className="text-xs text-teal-600 mt-2 font-medium">
                Increases this branch's input VAT
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-blue-100 text-sm text-slate-600">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-slate-400 mb-1">Gross Input VAT (from invoices)</p>
                <p className="font-semibold">{formatSAR(report?.inputVat)}</p>
              </div>
              <div className="text-blue-400 flex items-center justify-center text-lg">→</div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Adjusted Input VAT (after transfers)</p>
                <p className="font-bold text-rose-600">{formatSAR(r?.adjustedInputVat)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ZATCA Filing Breakdown ── */}
      {r?.zatca && (
        <div className="bg-card rounded-2xl p-6 border shadow-sm mb-6">
          <h3 className="text-base font-bold border-b pb-4 mb-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            ZATCA VAT Return — Box Summary
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b">
              <span className="text-slate-600">Box 1 — Standard Rated Sales</span>
              <span className="font-medium">{formatSAR(r.zatca.box1_taxableSupplies)}</span>
            </div>
            <div className="flex justify-between py-2 border-b font-semibold text-emerald-700">
              <span>Box 2 — VAT on Sales (Output)</span>
              <span>{formatSAR(r.zatca.box2_outputVat)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-slate-600">Box 3 — Standard Rated Purchases</span>
              <span className="font-medium">{formatSAR(r.zatca.box3_taxablePurchases)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-600">Box 4a — Input VAT (from invoices)</span>
              <span className="font-medium">{formatSAR(r.zatca.box4_inputVatGross)}</span>
            </div>
            {(r.zatca.box4_vatTransferredOut) < 0 && (
              <div className="flex justify-between py-1 pl-4 text-amber-700">
                <span>├ VAT Transferred Out (−)</span>
                <span className="font-medium">{formatSAR(r.zatca.box4_vatTransferredOut)}</span>
              </div>
            )}
            {(r.zatca.box4_vatReceivedIn) > 0 && (
              <div className="flex justify-between py-1 pl-4 text-teal-700">
                <span>├ VAT Received In (+)</span>
                <span className="font-medium">+ {formatSAR(r.zatca.box4_vatReceivedIn)}</span>
              </div>
            )}
            <div className="flex justify-between py-2 border-t font-semibold text-rose-700">
              <span>Box 4 — Net Input VAT (deductible)</span>
              <span>{formatSAR(r.zatca.box4_inputVatNet)}</span>
            </div>
            <div className="flex justify-between py-3 border-t-2 border-slate-300 text-lg font-bold">
              <span>Box 5 — VAT Payable / (Reclaimable)</span>
              <span className={(r.zatca.box5_vatPayable ?? 0) >= 0 ? "text-rose-600" : "text-teal-600"}>
                {formatSAR(r.zatca.box5_vatPayable)}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="mt-2 text-center text-sm text-slate-500">
        Formula:{" "}
        <span className="font-mono bg-slate-100 px-2 py-1 rounded">
          VAT Payable = Output VAT − Adjusted Input VAT
        </span>
        {hasTransfers && (
          <span className="ml-2 font-mono bg-blue-50 text-blue-600 px-2 py-1 rounded">
            Adjusted Input VAT = Invoice VAT − Transferred Out + Received In
          </span>
        )}
      </div>
    </div>
  );
}
