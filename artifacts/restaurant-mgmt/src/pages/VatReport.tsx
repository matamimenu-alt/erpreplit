import { useState } from "react";
import { useGetVatReport } from "@workspace/api-client-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrintButton } from "@/components/ui/PrintButton";
import { formatSAR, formatMonth } from "@/lib/format";
import { Calculator, ShieldCheck, ArrowRightLeft, ArrowUpRight, ArrowDownLeft, Info } from "lucide-react";

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
  };

  const report = reportRaw as VatReportExt | undefined;
  const r = report; // alias for clarity

  const hasTransfers =
    (r?.vatTransferredOut ?? 0) > 0 || (r?.vatReceivedIn ?? 0) > 0;
  const hasFixedCostVat = (r?.fixedCostInputVat ?? 0) > 0;

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
              <span>{(hasTransfers || hasFixedCostVat) ? "Adjusted Input VAT" : "Input VAT Paid"}</span>
              <span className="text-rose-600">
                {formatSAR((hasTransfers || hasFixedCostVat) ? r?.adjustedInputVat : report?.inputVat)}
              </span>
            </div>
          </div>
        </div>
      </div>

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
