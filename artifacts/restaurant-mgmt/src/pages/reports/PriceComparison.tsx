import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrintButton } from "@/components/ui/PrintButton";
import { useReportData } from "@/hooks/use-report-data";
import { formatSAR } from "@/lib/format";
import { exportToExcel } from "@/lib/export-excel";
import { Link } from "wouter";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  ArrowLeft, FileSpreadsheet, Scale, ChevronDown, ChevronUp, Search, TrendingDown, TrendingUp,
} from "lucide-react";

type PriceData = {
  items: Array<{
    productName: string;
    suppliers: Array<{
      supplierName: string;
      avgPrice: number;
      minPrice: number;
      maxPrice: number;
      monthlyPrices: Array<{ month: string; avgPrice: number; minPrice: number; maxPrice: number }>;
    }>;
    lowestPrice: number;
    highestPrice: number;
    averagePrice: number;
    priceDiff: number;
  }>;
};

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];

export default function PriceComparison() {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const { data, isLoading } = useReportData<PriceData>("item-price-comparison", {
    productName: searchTerm || null,
    from: fromDate || null,
    to: toDate || null,
  });

  const handleExport = () => {
    if (!data) return;
    const rows: Record<string, unknown>[] = [];
    data.items.forEach(item => {
      item.suppliers.forEach(s => {
        rows.push({
          [t("rptPrice.product")]: item.productName,
          [t("rptPrice.supplier")]: s.supplierName,
          [t("rptPrice.avgPrice")]: s.avgPrice,
          [t("rptPrice.minPrice")]: s.minPrice,
          [t("rptPrice.maxPrice")]: s.maxPrice,
          [t("rptPrice.lowestOverall")]: item.lowestPrice,
          [t("rptPrice.highestOverall")]: item.highestPrice,
          [t("rptPrice.priceDiff")]: item.priceDiff,
        });
      });
    });
    exportToExcel(rows, "price-comparison", t("rptPrice.title"));
  };

  return (
    <div>
      <PageHeader
        title={t("rptPrice.title")}
        description={t("rptPrice.description")}
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
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-slate-500 mb-1 block">{t("rptPrice.searchProduct")}</label>
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder={t("rptPrice.searchPlaceholder")}
              className="w-full ps-9 pe-3 py-2 border rounded-xl text-sm"
            />
          </div>
        </div>
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
        <div className="space-y-4">
          {(data?.items ?? []).map(item => {
            const isExpanded = expandedItem === item.productName;
            const allMonths = new Set<string>();
            item.suppliers.forEach(s => s.monthlyPrices.forEach(m => allMonths.add(m.month)));
            const chartData = [...allMonths].sort().map(month => {
              const point: Record<string, string | number> = { month };
              item.suppliers.forEach(s => {
                const entry = s.monthlyPrices.find(m => m.month === month);
                point[s.supplierName] = entry?.avgPrice ?? 0;
              });
              return point;
            });

            return (
              <div key={item.productName} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpandedItem(isExpanded ? null : item.productName)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Scale className="w-5 h-5 text-cyan-600" />
                    <div className="text-start">
                      <p className="font-bold text-slate-800">{item.productName}</p>
                      <p className="text-xs text-slate-500">{item.suppliers.length} {t("rptPrice.suppliersCount")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex gap-4 text-sm">
                      <div className="text-center">
                        <p className="text-[10px] text-slate-400 uppercase">{t("rptPrice.lowest")}</p>
                        <p className="font-bold text-emerald-600 tabular-nums">{formatSAR(item.lowestPrice)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-slate-400 uppercase">{t("rptPrice.highest")}</p>
                        <p className="font-bold text-rose-600 tabular-nums">{formatSAR(item.highestPrice)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-slate-400 uppercase">{t("rptPrice.avg")}</p>
                        <p className="font-bold text-blue-600 tabular-nums">{formatSAR(item.averagePrice)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-slate-400 uppercase">{t("rptPrice.diff")}</p>
                        <p className="font-bold text-amber-600 tabular-nums">{formatSAR(item.priceDiff)}</p>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t px-6 py-4 space-y-4">
                    {/* Supplier Comparison Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50">
                            <th className="px-4 py-2 text-start font-semibold text-slate-600">{t("rptPrice.supplier")}</th>
                            <th className="px-4 py-2 text-end font-semibold text-slate-600">{t("rptPrice.avgPrice")}</th>
                            <th className="px-4 py-2 text-end font-semibold text-slate-600">{t("rptPrice.minPrice")}</th>
                            <th className="px-4 py-2 text-end font-semibold text-slate-600">{t("rptPrice.maxPrice")}</th>
                            <th className="px-4 py-2 text-end font-semibold text-slate-600">{t("rptPrice.status")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {item.suppliers.map(s => {
                            const isCheapest = s.avgPrice === item.lowestPrice && item.suppliers.length > 1;
                            const isMostExpensive = s.avgPrice === item.highestPrice && item.suppliers.length > 1;
                            return (
                              <tr key={s.supplierName} className="hover:bg-slate-50">
                                <td className="px-4 py-2 font-medium text-slate-700">{s.supplierName}</td>
                                <td className="px-4 py-2 text-end tabular-nums font-semibold">{formatSAR(s.avgPrice)}</td>
                                <td className="px-4 py-2 text-end tabular-nums text-emerald-600">{formatSAR(s.minPrice)}</td>
                                <td className="px-4 py-2 text-end tabular-nums text-rose-600">{formatSAR(s.maxPrice)}</td>
                                <td className="px-4 py-2 text-end">
                                  {isCheapest && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                      <TrendingDown className="w-3 h-3" /> {t("rptPrice.cheapest")}
                                    </span>
                                  )}
                                  {isMostExpensive && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700">
                                      <TrendingUp className="w-3 h-3" /> {t("rptPrice.mostExpensive")}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Price Trend Chart */}
                    {chartData.length > 1 && (
                      <div>
                        <h4 className="text-sm font-semibold text-slate-600 mb-3">{t("rptPrice.priceTrend")}</h4>
                        <ResponsiveContainer width="100%" height={280}>
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip formatter={(v: number) => formatSAR(v)} />
                            <Legend />
                            {item.suppliers.map((s, i) => (
                              <Line key={s.supplierName} type="monotone" dataKey={s.supplierName}
                                stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {(!data?.items || data.items.length === 0) && (
            <div className="bg-white rounded-2xl border p-16 text-center text-slate-400">{t("rptCommon.noData")}</div>
          )}
        </div>
      )}
    </div>
  );
}
