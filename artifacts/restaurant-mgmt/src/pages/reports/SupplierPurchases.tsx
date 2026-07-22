import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrintButton } from "@/components/ui/PrintButton";
import { useReportData } from "@/hooks/use-report-data";
import { formatSAR } from "@/lib/format";
import { exportToExcel } from "@/lib/export-excel";
import { Link } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, TrendingDown, ArrowLeft, FileSpreadsheet, Truck, ChevronDown, ChevronUp,
} from "lucide-react";

type SupplierData = {
  suppliers: Array<{
    supplierName: string;
    invoiceCount: number;
    totalAmount: number;
    monthlyBreakdown: Array<{ month: string; amount: number; count: number }>;
    prevMonthChangePct: number;
  }>;
};

export default function SupplierPurchases() {
  const { t } = useLanguage();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);

  const { data, isLoading } = useReportData<SupplierData>("supplier-purchases", {
    from: fromDate || null,
    to: toDate || null,
  });

  const handleExport = () => {
    if (!data) return;
    const rows = data.suppliers.map(s => ({
      [t("rptSupplier.supplierName")]: s.supplierName,
      [t("rptSupplier.invoiceCount")]: s.invoiceCount,
      [t("rptSupplier.totalAmount")]: s.totalAmount,
      [t("rptSupplier.vsPrev")]: `${s.prevMonthChangePct}%`,
    }));
    exportToExcel(rows, "supplier-purchases", t("rptSupplier.title"));
  };

  return (
    <div>
      <PageHeader
        title={t("rptSupplier.title")}
        description={t("rptSupplier.description")}
        action={
          <div className="flex gap-2 items-center flex-wrap no-print">
            <Link href="/reports" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
              <ArrowLeft className="w-4 h-4" /> {t("rptCommon.backToReports")}
            </Link>
            <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm">
              <FileSpreadsheet className="w-4 h-4" /> {t("common.exportExcel")}
            </button>
            <PrintButton />
          </div>
        }
      />

      {/* Filters */}
      <div className="no-print bg-white rounded-2xl border p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">{t("rptCommon.from")}</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="px-3 py-2 border rounded-xl text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">{t("rptCommon.to")}</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="px-3 py-2 border rounded-xl text-sm" />
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-slate-400">{t("common.loading")}</div>
      ) : (
        <>
          {/* KPI Cards */}
          {data && data.suppliers.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">{t("rptSupplier.totalSuppliers")}</p>
                <p className="text-2xl font-bold text-blue-800">{data.suppliers.length}</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
                <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">{t("rptSupplier.totalPurchases")}</p>
                <p className="text-2xl font-bold text-emerald-800">{formatSAR(data.suppliers.reduce((s, r) => s + Number(r.totalAmount), 0))}</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1">{t("rptSupplier.totalInvoices")}</p>
                <p className="text-2xl font-bold text-amber-800">{data.suppliers.reduce((s, r) => s + r.invoiceCount, 0)}</p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5">
                <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider mb-1">{t("rptSupplier.topSupplier")}</p>
                <p className="text-lg font-bold text-purple-800 truncate">{data.suppliers[0]?.supplierName ?? "-"}</p>
              </div>
            </div>
          )}

          {/* Supplier Cards */}
          <div className="space-y-4">
            {(data?.suppliers ?? []).map(s => {
              const isExpanded = expandedSupplier === s.supplierName;
              return (
                <div key={s.supplierName} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                  <button
                    onClick={() => setExpandedSupplier(isExpanded ? null : s.supplierName)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Truck className="w-5 h-5 text-slate-400" />
                      <div className="text-start">
                        <p className="font-bold text-slate-800">{s.supplierName}</p>
                        <p className="text-xs text-slate-500">{t("rptSupplier.invoiceCount")}: {s.invoiceCount}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-end">
                        <p className="font-bold text-slate-800 tabular-nums">{formatSAR(s.totalAmount)}</p>
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${s.prevMonthChangePct >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          {s.prevMonthChangePct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {Math.abs(s.prevMonthChangePct)}% {t("rptSupplier.vsPrev")}
                        </span>
                      </div>
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t px-6 py-4 space-y-4">
                      {/* Monthly Chart */}
                      {s.monthlyBreakdown.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-slate-600 mb-3">{t("rptSupplier.monthlyTrend")}</h4>
                          <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={s.monthlyBreakdown}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                              <YAxis tick={{ fontSize: 11 }} />
                              <Tooltip formatter={(v: number) => formatSAR(v)} />
                              <Bar dataKey="amount" fill="#3b82f6" radius={[6, 6, 0, 0]} name={t("rptSupplier.amount")} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {/* Monthly Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50">
                              <th className="px-4 py-2 text-start font-semibold text-slate-600">{t("rptSupplier.month")}</th>
                              <th className="px-4 py-2 text-end font-semibold text-slate-600">{t("rptSupplier.amount")}</th>
                              <th className="px-4 py-2 text-end font-semibold text-slate-600">{t("rptSupplier.invoiceCount")}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {s.monthlyBreakdown.map(m => (
                              <tr key={m.month} className="hover:bg-slate-50">
                                <td className="px-4 py-2 text-slate-700">{m.month}</td>
                                <td className="px-4 py-2 text-end tabular-nums font-medium">{formatSAR(m.amount)}</td>
                                <td className="px-4 py-2 text-end text-slate-500">{m.count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {(!data?.suppliers || data.suppliers.length === 0) && (
              <div className="bg-white rounded-2xl border p-16 text-center text-slate-400">{t("rptCommon.noData")}</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
