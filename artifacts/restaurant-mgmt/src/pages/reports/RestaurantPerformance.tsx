import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useRestaurant } from "@/contexts/RestaurantContext";
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
  TrendingUp, TrendingDown, ArrowLeft, FileSpreadsheet, Building2,
} from "lucide-react";

type PerfResult = {
  results: Array<{
    restaurantId: number;
    restaurantName: string;
    restaurantNameAr: string;
    totalSales: number;
    orderCount: number;
    avgOrderValue: number;
    currentMonthSales: number;
    previousMonthSales: number;
    lastYearSamePeriodSales: number;
    monthVsPrevPct: number;
    monthVsLastYearPct: number;
    monthlyTrend: Array<{ month: string; sales: number; purchases: number; orders: number }>;
  }>;
};

type ViewMode = "all" | "single" | "compare";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

export default function RestaurantPerformance() {
  const { t, pickName } = useLanguage();
  const { restaurants } = useRestaurant();
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [selectedId, setSelectedId] = useState<string>("");
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const params: Record<string, string | null> = {};
  if (viewMode === "single" && selectedId) params.restaurantId = selectedId;
  if (viewMode === "compare" && compareIds.length > 0) params.compareIds = compareIds.join(",");

  const { data, isLoading } = useReportData<PerfResult>("restaurant-performance", params);

  const handleCompareToggle = (id: string) => {
    setCompareIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const chartData = (() => {
    if (!data?.results?.length) return [];
    const allMonths = new Set<string>();
    data.results.forEach(r => r.monthlyTrend.forEach(m => allMonths.add(m.month)));
    const months = [...allMonths].sort();

    return months.map(month => {
      const point: Record<string, string | number> = { month };
      data.results.forEach(r => {
        const entry = r.monthlyTrend.find(m => m.month === month);
        point[pickName({ name: r.restaurantName, nameAr: r.restaurantNameAr })] = entry?.sales ?? 0;
      });
      return point;
    });
  })();

  const handleExport = () => {
    if (!data) return;
    const rows = data.results.map(r => ({
      [t("rptPerf.restaurant")]: pickName({ name: r.restaurantName, nameAr: r.restaurantNameAr }),
      [t("rptPerf.totalSales")]: r.totalSales,
      [t("rptPerf.orderCount")]: r.orderCount,
      [t("rptPerf.avgOrder")]: r.avgOrderValue,
      [t("rptPerf.curMonth")]: r.currentMonthSales,
      [t("rptPerf.prevMonth")]: r.previousMonthSales,
      [t("rptPerf.lastYear")]: r.lastYearSamePeriodSales,
      [t("rptPerf.vsPrev")]: `${r.monthVsPrevPct}%`,
      [t("rptPerf.vsLastYear")]: `${r.monthVsLastYearPct}%`,
    }));
    exportToExcel(rows, "restaurant-performance", t("rptPerf.title"));
  };

  return (
    <div>
      <PageHeader
        title={t("rptPerf.title")}
        description={t("rptPerf.description")}
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
      <div className="no-print bg-white rounded-2xl border p-4 mb-6 space-y-4">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          {([
            { id: "all" as ViewMode, label: t("rptPerf.allRestaurants") },
            { id: "single" as ViewMode, label: t("rptPerf.singleRestaurant") },
            { id: "compare" as ViewMode, label: t("rptPerf.compareRestaurants") },
          ]).map(m => (
            <button key={m.id} onClick={() => setViewMode(m.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === m.id ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
              {m.label}
            </button>
          ))}
        </div>

        {viewMode === "single" && (
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
            className="px-3 py-2 border rounded-xl text-sm min-w-[200px]">
            <option value="">{t("rptCommon.selectRestaurant")}</option>
            {restaurants.map(r => (
              <option key={r.id} value={r.id}>{pickName(r)}</option>
            ))}
          </select>
        )}

        {viewMode === "compare" && (
          <div className="flex flex-wrap gap-2">
            {restaurants.map(r => (
              <button key={r.id} onClick={() => handleCompareToggle(String(r.id))}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${compareIds.includes(String(r.id)) ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"}`}>
                <Building2 className="w-3.5 h-3.5 inline me-1" />
                {pickName(r)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Performance Cards */}
      {data?.results && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
          {data.results.map(r => (
            <div key={r.restaurantId} className="bg-white rounded-2xl border p-5">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-800">{pickName({ name: r.restaurantName, nameAr: r.restaurantNameAr })}</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{t("rptPerf.totalSales")}</span>
                  <span className="font-semibold tabular-nums">{formatSAR(r.totalSales)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{t("rptPerf.orderCount")}</span>
                  <span className="font-semibold tabular-nums">{r.orderCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{t("rptPerf.avgOrder")}</span>
                  <span className="font-semibold tabular-nums">{formatSAR(r.avgOrderValue)}</span>
                </div>
                <div className="h-px bg-slate-100 my-2" />
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{t("rptPerf.vsPrev")}</span>
                  <span className={`inline-flex items-center gap-1 font-medium ${r.monthVsPrevPct >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {r.monthVsPrevPct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {Math.abs(r.monthVsPrevPct)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{t("rptPerf.vsLastYear")}</span>
                  <span className={`inline-flex items-center gap-1 font-medium ${r.monthVsLastYearPct >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {r.monthVsLastYearPct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {Math.abs(r.monthVsLastYearPct)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 && data?.results && (
        <div className="bg-white rounded-2xl border p-6 mb-6">
          <h3 className="text-sm font-semibold text-slate-600 mb-4">{t("rptPerf.trendChart")}</h3>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => formatSAR(v)} />
              <Legend />
              {data.results.map((r, i) => (
                <Line key={r.restaurantId} type="monotone" dataKey={pickName({ name: r.restaurantName, nameAr: r.restaurantNameAr })}
                  stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400">{t("common.loading")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-start font-semibold text-slate-600">{t("rptPerf.restaurant")}</th>
                  <th className="px-4 py-3 text-end font-semibold text-slate-600">{t("rptPerf.totalSales")}</th>
                  <th className="px-4 py-3 text-end font-semibold text-slate-600">{t("rptPerf.orderCount")}</th>
                  <th className="px-4 py-3 text-end font-semibold text-slate-600">{t("rptPerf.avgOrder")}</th>
                  <th className="px-4 py-3 text-end font-semibold text-slate-600">{t("rptPerf.curMonth")}</th>
                  <th className="px-4 py-3 text-end font-semibold text-slate-600">{t("rptPerf.vsPrev")}</th>
                  <th className="px-4 py-3 text-end font-semibold text-slate-600">{t("rptPerf.vsLastYear")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.results ?? []).map(r => (
                  <tr key={r.restaurantId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700">{pickName({ name: r.restaurantName, nameAr: r.restaurantNameAr })}</td>
                    <td className="px-4 py-3 text-end tabular-nums font-semibold text-slate-800">{formatSAR(r.totalSales)}</td>
                    <td className="px-4 py-3 text-end tabular-nums text-slate-600">{r.orderCount}</td>
                    <td className="px-4 py-3 text-end tabular-nums text-slate-600">{formatSAR(r.avgOrderValue)}</td>
                    <td className="px-4 py-3 text-end tabular-nums text-slate-700">{formatSAR(r.currentMonthSales)}</td>
                    <td className="px-4 py-3 text-end">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${r.monthVsPrevPct >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                        {r.monthVsPrevPct >= 0 ? "+" : ""}{r.monthVsPrevPct}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${r.monthVsLastYearPct >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                        {r.monthVsLastYearPct >= 0 ? "+" : ""}{r.monthVsLastYearPct}%
                      </span>
                    </td>
                  </tr>
                ))}
                {(!data?.results || data.results.length === 0) && (
                  <tr><td colSpan={7} className="py-16 text-center text-slate-400">{t("rptCommon.noData")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
