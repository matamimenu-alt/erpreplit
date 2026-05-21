import { useState } from "react";
import { useGetVatReport } from "@workspace/api-client-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrintButton } from "@/components/ui/PrintButton";
import { formatSAR, formatMonth } from "@/lib/format";
import { useLanguage } from "@/i18n/LanguageContext";
import { Calculator, ShieldCheck, ArrowRightLeft, ArrowUpRight, ArrowDownLeft, Info, Receipt, Wallet, TrendingUp, TrendingDown } from "lucide-react";

function SourceTotal({ label, vat, net, color }: { label: string; vat: number; net: number; color: "blue" | "emerald" | "purple" }) {
  const { t } = useLanguage();
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
      <div className="text-end text-xs">
        <div className="text-slate-500">{t("common.net")}: <span className="font-semibold text-slate-700">{formatSAR(net)}</span></div>
        <div className={`font-bold ${palette.text}`}>{t("common.vat")}: {formatSAR(vat)}</div>
      </div>
    </div>
  );
}

export default function VatReport() {
  const [month, setMonth] = useState("");
  const { data: reportRaw, isLoading } = useGetVatReport(month ? { month } : undefined);
  const { t, lang } = useLanguage();

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
  const r = report;

  const hasTransfers =
    (r?.vatTransferredOut ?? 0) > 0 || (r?.vatReceivedIn ?? 0) > 0;
  const hasFixedCostVat = (r?.fixedCostInputVat ?? 0) > 0;
  const hasExpenseLedgerVat = (r?.expenseLedgerInputVat ?? 0) > 0;

  const periodLabel = month ? formatMonth(month) : t("vat.allPeriods");
  const heroPeriod  = month ? (lang === "ar" ? formatMonth(month) : formatMonth(month).toUpperCase()) : t("vat.allTime").toUpperCase();

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title={t("vat.title")}
        description={t("vat.subtitle")}
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
          <h3 className="font-bold text-slate-800">{t("vat.summaryTitle")}</h3>
          <span className="text-xs text-slate-400 ms-auto">{periodLabel}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          {/* OUTPUT SIDE */}
          <div className="p-6 space-y-3">
            <div className="flex items-center gap-2 text-emerald-700 mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wide">{t("vat.output.header")}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">{t("vat.output.totalTaxableSales")}</span>
              <span className="font-semibold text-slate-900 tabular-nums">{formatSAR(r?.totalTaxableSales ?? r?.totalSales)}</span>
            </div>
            <div className="flex justify-between text-base bg-emerald-50 rounded-lg px-3 py-2.5">
              <span className="font-bold text-emerald-800">{t("vat.output.totalOutputVat")}</span>
              <span className="font-bold text-emerald-700 tabular-nums">{formatSAR(r?.totalOutputVat ?? r?.outputVat)}</span>
            </div>
          </div>

          {/* INPUT SIDE */}
          <div className="p-6 space-y-3">
            <div className="flex items-center gap-2 text-rose-700 mb-2">
              <TrendingDown className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wide">{t("vat.input.header")}</span>
            </div>
            <div className="space-y-1.5 text-xs text-slate-500">
              <div className="flex justify-between"><span>{t("vat.input.purchases")}</span><span className="tabular-nums">{formatSAR(r?.totalPurchases)}</span></div>
              <div className="flex justify-between"><span>{t("vat.input.expenseLedger")}</span><span className="tabular-nums">{formatSAR(r?.expenseLedgerNet ?? 0)}</span></div>
              {hasFixedCostVat && <div className="flex justify-between"><span>{t("vat.input.fixedTaxable")}</span><span className="text-emerald-600 tabular-nums">{t("common.vat")}: {formatSAR(r?.fixedCostInputVat)}</span></div>}
            </div>
            <div className="flex justify-between text-sm pt-1 border-t border-slate-100">
              <span className="text-slate-600">{t("vat.input.totalTaxableExpenses")}</span>
              <span className="font-semibold text-slate-900 tabular-nums">{formatSAR(r?.totalTaxableExpenses)}</span>
            </div>
            <div className="flex justify-between text-base bg-rose-50 rounded-lg px-3 py-2.5">
              <span className="font-bold text-rose-800">{t("vat.input.totalInputVat")}</span>
              <span className="font-bold text-rose-700 tabular-nums">{formatSAR(r?.totalInputVat ?? r?.adjustedInputVat)}</span>
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
                {(r?.finalVatDue ?? r?.vatPayable ?? 0) >= 0 ? t("vat.finalDue") : t("vat.refundable")}
              </div>
              <div className="text-[11px] text-slate-400 font-mono">{t("vat.formula")}</div>
            </div>
          </div>
          <div className={`text-3xl font-display font-bold tabular-nums ${(r?.finalVatDue ?? r?.vatPayable ?? 0) >= 0 ? "text-rose-700" : "text-teal-700"}`}>
            {isLoading ? "..." : formatSAR(r?.finalVatDue ?? r?.vatPayable)}
          </div>
        </div>

        {/* Source breakdown chips */}
        <div className="px-6 py-3 bg-slate-50 border-t flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-slate-400 font-semibold uppercase">{t("vat.sources")}</span>
          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold flex items-center gap-1">
            <Receipt className="w-3 h-3" /> {t("vat.chips.purchases", { amount: formatSAR(r?.inputVat) })}
          </span>
          {hasExpenseLedgerVat && (
            <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold flex items-center gap-1">
              <Receipt className="w-3 h-3" /> {t("vat.chips.ledger", { amount: formatSAR(r?.expenseLedgerInputVat) })}
            </span>
          )}
          {hasFixedCostVat && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold flex items-center gap-1">
              <Receipt className="w-3 h-3" /> {t("vat.chips.fixedTax", { amount: formatSAR(r?.fixedCostInputVat) })}
            </span>
          )}
          {hasTransfers && (
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold flex items-center gap-1">
              <ArrowRightLeft className="w-3 h-3" /> {t("vat.chips.netTransfers", { amount: formatSAR(r?.netTransferVatImpact ?? 0) })}
            </span>
          )}
        </div>
      </div>

      {/* ── Hero card ── */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-xl mb-8 relative overflow-hidden">
        <div className="absolute top-0 end-0 p-8 opacity-10 pointer-events-none">
          <Calculator className="w-48 h-48" />
        </div>
        <div className="relative z-10">
          <p className="text-blue-100 font-medium tracking-wide uppercase text-sm mb-2">
            {t("vat.hero.label", { period: heroPeriod })}
          </p>
          <h2 className="text-5xl font-display font-bold tabular-nums">
            {isLoading ? "..." : formatSAR(report?.vatPayable)}
          </h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-lg backdrop-blur-md">
              <ShieldCheck className="w-5 h-5" />
              <span className="text-sm font-medium">{t("vat.hero.compliant")}</span>
            </div>
            {hasTransfers && (
              <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-lg backdrop-blur-md">
                <ArrowRightLeft className="w-4 h-4" />
                <span className="text-sm font-medium">{t("vat.hero.transfers")}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Output / Input cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-card rounded-2xl p-6 border shadow-sm">
          <h3 className="text-lg font-bold border-b pb-4 mb-4">{t("vat.outputCard")}</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-slate-600 text-sm">
              <span>{t("vat.totalSalesInclVat")}</span>
              <span className="font-medium tabular-nums">{formatSAR(report?.totalSales)}</span>
            </div>
            <div className="flex justify-between items-center text-lg font-bold text-slate-900 bg-slate-50 p-3 rounded-lg">
              <span>{t("vat.outputVatCollected")}</span>
              <span className="text-emerald-600 tabular-nums">{formatSAR(report?.outputVat)}</span>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl p-6 border shadow-sm">
          <h3 className="text-lg font-bold border-b pb-4 mb-4">{t("vat.inputCard")}</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-slate-600 text-sm">
              <span>{t("vat.totalPurchasesPreVat")}</span>
              <span className="font-medium tabular-nums">{formatSAR(report?.totalPurchases)}</span>
            </div>
            <div className="flex justify-between items-center text-sm text-slate-600">
              <span>{t("vat.inputVatPurchases")}</span>
              <span className="font-medium text-rose-500 tabular-nums">{formatSAR(report?.inputVat)}</span>
            </div>
            {hasFixedCostVat && (
              <div className="flex justify-between items-center text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">
                <span className="flex items-center gap-1.5">
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  {t("vat.vatFixed")}
                </span>
                <span className="font-semibold tabular-nums">+ {formatSAR(r?.fixedCostInputVat)}</span>
              </div>
            )}
            {hasExpenseLedgerVat && (
              <div className="flex justify-between items-center text-sm text-purple-700 bg-purple-50 px-3 py-2 rounded-lg">
                <span className="flex items-center gap-1.5">
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  {t("vat.vatLedger")}
                </span>
                <span className="font-semibold tabular-nums">+ {formatSAR(r?.expenseLedgerInputVat)}</span>
              </div>
            )}
            {hasTransfers && (
              <>
                {(r?.vatTransferredOut ?? 0) > 0 && (
                  <div className="flex justify-between items-center text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                    <span className="flex items-center gap-1.5">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      {t("vat.vatTransferredOut")}
                    </span>
                    <span className="font-semibold tabular-nums">− {formatSAR(r?.vatTransferredOut)}</span>
                  </div>
                )}
                {(r?.vatReceivedIn ?? 0) > 0 && (
                  <div className="flex justify-between items-center text-sm text-teal-700 bg-teal-50 px-3 py-2 rounded-lg">
                    <span className="flex items-center gap-1.5">
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                      {t("vat.vatReceivedIn")}
                    </span>
                    <span className="font-semibold tabular-nums">+ {formatSAR(r?.vatReceivedIn)}</span>
                  </div>
                )}
              </>
            )}
            <div className="flex justify-between items-center text-lg font-bold text-slate-900 bg-slate-50 p-3 rounded-lg">
              <span>{(hasTransfers || hasFixedCostVat || hasExpenseLedgerVat) ? t("vat.adjustedInput") : t("vat.inputVatPaid")}</span>
              <span className="text-rose-600 tabular-nums">
                {formatSAR((hasTransfers || hasFixedCostVat || hasExpenseLedgerVat) ? r?.adjustedInputVat : report?.inputVat)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Per-Source VAT Breakdown ── */}
      {(r?.breakdown?.length ?? 0) > 0 && (
        <div className="bg-card rounded-2xl border shadow-sm mb-6 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
            <Receipt className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-slate-800">{t("vat.breakdown.title")}</h3>
            <span className="text-xs text-slate-400">{t("vat.breakdown.subtitle")}</span>

            <div className="ms-auto flex flex-wrap items-center gap-1.5 text-xs no-print">
              {([
                ["all",            t("vat.breakdown.all"),           r?.breakdown?.length ?? 0],
                ["purchase",       t("vat.breakdown.purchases"),     r?.breakdown?.filter(b => b.sourceType === "purchase").length ?? 0],
                ["fixed-cost",     t("vat.breakdown.fixedCosts"),    r?.breakdown?.filter(b => b.sourceType === "fixed-cost").length ?? 0],
                ["expense-ledger", t("vat.breakdown.expenseLedger"), r?.breakdown?.filter(b => b.sourceType === "expense-ledger").length ?? 0],
              ] as const).map(([k, label, n]) => (
                <button
                  key={k}
                  onClick={() => setBdFilter(k as typeof bdFilter)}
                  className={`px-2.5 py-1 rounded-full font-semibold border transition ${
                    bdFilter === k
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                  }`}
                >
                  {label} <span className="opacity-70">({n})</span>
                </button>
              ))}
              <label className="flex items-center gap-1.5 ms-2 cursor-pointer text-slate-600">
                <input type="checkbox" checked={showExempt} onChange={e => setShowExempt(e.target.checked)} className="accent-indigo-600" />
                {t("vat.breakdown.showExempt")}
              </label>
            </div>
          </div>

          {/* Source totals */}
          {r?.breakdownTotals && (
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100 bg-slate-50 border-b">
              <SourceTotal label={t("vat.breakdown.purchases")}     vat={r.breakdownTotals.purchases.vat}     net={r.breakdownTotals.purchases.net}     color="blue"   />
              <SourceTotal label={t("vat.breakdown.fixedCosts")}    vat={r.breakdownTotals.fixedCosts.vat}    net={r.breakdownTotals.fixedCosts.net}    color="emerald"/>
              <SourceTotal label={t("vat.breakdown.expenseLedger")} vat={r.breakdownTotals.expenseLedger.vat} net={r.breakdownTotals.expenseLedger.net} color="purple" />
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-2.5 text-start font-semibold">{t("vat.breakdown.source")}</th>
                  <th className="px-4 py-2.5 text-start font-semibold">{t("vat.breakdown.item")}</th>
                  <th className="px-4 py-2.5 text-center font-semibold">{t("vat.breakdown.date")}</th>
                  <th className="px-4 py-2.5 text-center font-semibold">{t("vat.breakdown.vatType")}</th>
                  <th className="px-4 py-2.5 text-end font-semibold">{t("vat.breakdown.rate")}</th>
                  <th className="px-4 py-2.5 text-end font-semibold">{t("vat.breakdown.taxable")}</th>
                  <th className="px-4 py-2.5 text-end font-semibold">{t("vat.breakdown.vatAmount")}</th>
                  <th className="px-4 py-2.5 text-center font-semibold">{t("vat.breakdown.status")}</th>
                </tr>
              </thead>
              <tbody>
                {(r?.breakdown ?? [])
                  .filter(b => bdFilter === "all" || b.sourceType === bdFilter)
                  .filter(b => showExempt || b.status === "taxable")
                  .map((b) => {
                    const srcMeta = b.sourceType === "purchase"
                      ? { label: t("vat.breakdown.purchaseChip"), color: "bg-blue-100 text-blue-700" }
                      : b.sourceType === "fixed-cost"
                        ? { label: t("vat.breakdown.fixedChip"),   color: "bg-emerald-100 text-emerald-700" }
                        : { label: t("vat.breakdown.expenseChip"), color: "bg-purple-100 text-purple-700" };
                    const statusMeta = b.status === "taxable"
                      ? { label: t("vat.breakdown.taxableStatus"),  color: "bg-emerald-50 text-emerald-700 border-emerald-200" }
                      : b.status === "exempt"
                        ? { label: t("vat.breakdown.exemptStatus"), color: "bg-slate-50 text-slate-500 border-slate-200" }
                        : { label: t("vat.breakdown.excludedStatus"), color: "bg-amber-50 text-amber-700 border-amber-200" };
                    return (
                      <tr key={`${b.sourceType}-${b.sourceId}`} className="border-t border-slate-100 hover:bg-slate-50/60">
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${srcMeta.color}`}>{srcMeta.label}</span>
                        </td>
                        <td className="px-4 py-2 text-slate-700">{b.label}</td>
                        <td className="px-4 py-2 text-center text-slate-500 text-xs tabular-nums">{b.date}</td>
                        <td className="px-4 py-2 text-center text-xs text-slate-600 capitalize">{b.vatType}</td>
                        <td className="px-4 py-2 text-end text-xs text-slate-500 tabular-nums">{b.vatRate ? `${b.vatRate}%` : "—"}</td>
                        <td className="px-4 py-2 text-end tabular-nums">{formatSAR(b.taxableAmount)}</td>
                        <td className={`px-4 py-2 text-end font-semibold tabular-nums ${b.vatAmount > 0 ? "text-rose-600" : "text-slate-400"}`}>
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
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400 text-sm">{t("vat.breakdown.noEntries")}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {(r?.excluded?.length ?? 0) > 0 && (
            <div className="border-t border-slate-100 bg-amber-50/40 p-4">
              <details>
                <summary className="cursor-pointer text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  {t("vat.breakdown.excludedNote", { n: r?.excluded?.length ?? 0 })}
                </summary>
                <ul className="mt-3 space-y-1 text-xs text-slate-600">
                  {r?.excluded?.map(e => (
                    <li key={`x-${e.sourceId}`} className="flex justify-between gap-4">
                      <span className="truncate">{e.label} <span className="text-slate-400">· {e.date}</span></span>
                      <span className="text-slate-500 tabular-nums">{formatSAR(e.amount)} · {e.reason}</span>
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
            <h3 className="text-base font-bold text-blue-800">{t("vat.transfers.title")}</h3>
            <div className="ms-auto flex items-center gap-1.5 text-xs text-blue-500 bg-blue-100 px-3 py-1 rounded-full">
              <Info className="w-3.5 h-3.5" />
              {t("vat.transfers.note")}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* VAT Out */}
            <div className="bg-white rounded-xl p-4 border border-amber-200">
              <div className="flex items-center gap-2 text-amber-600 mb-2">
                <ArrowUpRight className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">{t("vat.transfers.out")}</span>
              </div>
              <p className="text-xl font-bold text-amber-700 tabular-nums">
                {formatSAR(r?.vatTransferredOut ?? 0)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {t("vat.transfers.netGoods", { amount: formatSAR(r?.netAmountTransferredOut ?? 0) })}<br />
                {t("vat.transfers.count", { n: r?.transfersOutCount ?? 0 })}
              </p>
              <p className="text-xs text-amber-600 mt-2 font-medium">
                {t("vat.transfers.reducesInput")}
              </p>
            </div>

            {/* Net VAT Impact */}
            <div className="bg-white rounded-xl p-4 border border-blue-200 flex flex-col items-center justify-center text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-500 mb-2">{t("vat.transfers.impact")}</p>
              <p className={`text-2xl font-bold tabular-nums ${(r?.netTransferVatImpact ?? 0) >= 0 ? "text-teal-600" : "text-rose-600"}`}>
                {(r?.netTransferVatImpact ?? 0) >= 0 ? "+" : ""}
                {formatSAR(r?.netTransferVatImpact ?? 0)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {(r?.netTransferVatImpact ?? 0) >= 0
                  ? t("vat.transfers.netGain")
                  : t("vat.transfers.netReduction")}
              </p>
            </div>

            {/* VAT In */}
            <div className="bg-white rounded-xl p-4 border border-teal-200">
              <div className="flex items-center gap-2 text-teal-600 mb-2">
                <ArrowDownLeft className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">{t("vat.transfers.in")}</span>
              </div>
              <p className="text-xl font-bold text-teal-700 tabular-nums">
                {formatSAR(r?.vatReceivedIn ?? 0)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {t("vat.transfers.netGoods", { amount: formatSAR(r?.netAmountReceivedIn ?? 0) })}<br />
                {t("vat.transfers.count", { n: r?.transfersInCount ?? 0 })}
              </p>
              <p className="text-xs text-teal-600 mt-2 font-medium">
                {t("vat.transfers.increasesInput")}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-blue-100 text-sm text-slate-600">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-slate-400 mb-1">{t("vat.transfers.grossInput")}</p>
                <p className="font-semibold tabular-nums">{formatSAR(report?.inputVat)}</p>
              </div>
              <div className="text-blue-400 flex items-center justify-center text-lg">→</div>
              <div>
                <p className="text-xs text-slate-400 mb-1">{t("vat.transfers.adjustedInput")}</p>
                <p className="font-bold text-rose-600 tabular-nums">{formatSAR(r?.adjustedInputVat)}</p>
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
            {t("vat.zatca.title")}
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b">
              <span className="text-slate-600">{t("vat.zatca.box1")}</span>
              <span className="font-medium tabular-nums">{formatSAR(r.zatca.box1_taxableSupplies)}</span>
            </div>
            <div className="flex justify-between py-2 border-b font-semibold text-emerald-700">
              <span>{t("vat.zatca.box2")}</span>
              <span className="tabular-nums">{formatSAR(r.zatca.box2_outputVat)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-slate-600">{t("vat.zatca.box3")}</span>
              <span className="font-medium tabular-nums">{formatSAR(r.zatca.box3_taxablePurchases)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-600">{t("vat.zatca.box4a")}</span>
              <span className="font-medium tabular-nums">{formatSAR(r.zatca.box4_inputVatGross)}</span>
            </div>
            {(r.zatca.box4_vatTransferredOut) < 0 && (
              <div className="flex justify-between py-1 ps-4 text-amber-700">
                <span>{t("vat.zatca.box4out")}</span>
                <span className="font-medium tabular-nums">{formatSAR(r.zatca.box4_vatTransferredOut)}</span>
              </div>
            )}
            {(r.zatca.box4_vatReceivedIn) > 0 && (
              <div className="flex justify-between py-1 ps-4 text-teal-700">
                <span>{t("vat.zatca.box4in")}</span>
                <span className="font-medium tabular-nums">+ {formatSAR(r.zatca.box4_vatReceivedIn)}</span>
              </div>
            )}
            <div className="flex justify-between py-2 border-t font-semibold text-rose-700">
              <span>{t("vat.zatca.box4")}</span>
              <span className="tabular-nums">{formatSAR(r.zatca.box4_inputVatNet)}</span>
            </div>
            <div className="flex justify-between py-3 border-t-2 border-slate-300 text-lg font-bold">
              <span>{t("vat.zatca.box5")}</span>
              <span className={`tabular-nums ${(r.zatca.box5_vatPayable ?? 0) >= 0 ? "text-rose-600" : "text-teal-600"}`}>
                {formatSAR(r.zatca.box5_vatPayable)}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="mt-2 text-center text-sm text-slate-500">
        {t("vat.formulaLabel")}{" "}
        <span className="font-mono bg-slate-100 px-2 py-1 rounded">
          {t("vat.formulaBasic")}
        </span>
        {hasTransfers && (
          <span className="ms-2 font-mono bg-blue-50 text-blue-600 px-2 py-1 rounded">
            {t("vat.formulaAdjusted")}
          </span>
        )}
      </div>
    </div>
  );
}
