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
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, ArrowLeft, FileSpreadsheet, Minus,
} from "lucide-react";

type ComparisonMode = "day" | "month" | "year" | "custom";

type SalesResult = {
  results: Array<{
    restaurantId: number;
    restaurantName: string;
    restaurantNameAr: string;
    period1: { netSales: number; cash: number; card: number; apps: number; days: number };
    period2: { netSales: number; cash: number; card: number; apps: number; days: number };
    diff: number;
    changePct: number;
  }>;
  totalPeriod1: number;
  totalPeriod2: number;
};

function getDateRanges(mode: ComparisonMode, customFrom1: string, customTo1: string, customFrom2: string, customTo2: string) {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

  switch (mode) {
    case "day":
      return { from1: fmt(today), to1: fmt(today), from2: fmt(yesterday), to2: fmt(yesterday) };
    case "month": {
      const curStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const curEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const prevStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const prevEnd = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from1: fmt(curStart), to1: fmt(curEnd), from2: fmt(prevStart), to2: fmt(prevEnd) };
    }
    case "year": {
      const curYearStart = new Date(today.getFullYear(), 0, 1);
      const prevYearStart = new Date(today.getFullYear() - 1, 0, 1);
      const prevYearEnd = new Date(today.getFullYear() - 1, 11, 31);
      return { from1: fmt(curYearStart), to1: fmt(today), from2: fmt(prevYearStart), to2: fmt(prevYearEnd) };
    }
    case "custom":
      return { from1: customFrom1, to1: customTo1, from2: customFrom2, to2: customTo2 };
  }
}

export default function SalesComparison() {
  const { t, pickName } = useLanguage();
  const { restaurants } = useRestaurant();
  const [mode, setMode] = useState<ComparisonMode>("month");
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>("all");
  const [customFrom1, setCustomFrom1] = useState("");
  const [customTo1, setCustomTo1] = useState("");
  const [customFrom2, setCustomFrom2] = useState("");
  const [customTo2, setCustomTo2] = useState("");

  const { from1, to1, from2, to2 } = getDateRanges(mode, customFrom1, customTo1, customFrom2, customTo2);

  const { data, isLoading } = useReportData<SalesResult>("sales-comparison", {
    restaurantId: selectedRestaurant !== "all" ? selectedRestaurant : null,
    from1, to1, from2, to2,
  });

  const chartData = data?.results.map(r => ({
    name: pickName({ name: r.restaurantName, nameAr: r.restaurantNameAr }),
    [t("rptSales.period1")]: r.period1.netSales,
    [t("rptSales.period2")]: r.period2.netSales,
  })) ?? [];

  const totalDiff = (data?.totalPeriod1 ?? 0) - (data?.totalPeriod2 ?? 0);
  const totalChangePct = (data?.totalPeriod2 ?? 0) ? ((totalDiff / (data?.totalPeriod2 ?? 1)) * 100).toFixed(1) : "0";

  const handleExport = () => {
    if (!data) return;
    const rows = data.results.map(r => ({
      [t("rptSales.restaurant")]: pickName({ name: r.restaurantName, nameAr: r.restaurantNameAr }),
      [t("rptSales.period1")]: r.period1.netSales,
      [t("rptSales.period2")]: r.period2.netSales,
      [t("rptSales.diff")]: r.diff,
      [t("rptSales.change")]: `${r.changePct}%`,
    }));
    exportToExcel(rows, "sales-comparison", t("rptSales.title"));
  };

  const modeButtons: { id: ComparisonMode; label: string }[] = [
    { id: "day",    label: t("rptSales.dayVsDay") },
    { id: "month",  label: t("rptSales.monthVsMonth") },
    { id: "year",   label: t("rptSales.yearVsYear") },
    { id: "custom", label: t("rptSales.custom") },
  ];

  return (
    <div>
      <PageHeader
        title={t("rptSales.title")}
        description={t("rptSales.description")}
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
          {modeButtons.map(m => (
            <button key={m.id} onClick={() => setMode(m.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === m.id ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
              {m.label}
            </button>
          ))}
        </div>

        {mode === "custom" && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">{t("rptSales.from1")}</label>
              <input type="date" value={customFrom1} onChange={e => setCustomFrom1(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">{t("rptSales.to1")}</label>
              <input type="date" value={customTo1} onChange={e => setCustomTo1(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">{t("rptSales.from2")}</label>
              <input type="date" value={customFrom2} onChange={e => setCustomFrom2(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">{t("rptSales.to2")}</label>
              <input type="date" value={customTo2} onChange={e => setCustomTo2(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" />
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">{t("rptCommon.restaurant")}</label>
          <select value={selectedRestaurant} onChange={e => setSelectedRestaurant(e.target.value)}
            className="px-3 py-2 border rounded-xl text-sm min-w-[200px]">
            <option value="all">{t("rptCommon.allRestaurants")}</option>
            {restaurants.map(r => (
              <option key={r.id} value={r.id}>{pickName(r)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">{t("rptSales.period1")}</p>
            <p className="text-2xl font-bold text-blue-800">{formatSAR(data.totalPeriod1)}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">{t("rptSales.period2")}</p>
            <p className="text-2xl font-bold text-slate-800">{formatSAR(data.totalPeriod2)}</p>
          </div>
          <div className={`rounded-2xl p-5 border ${totalDiff >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"}`}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1 opacity-70">{t("rptSales.diff")}</p>
            <div className="flex items-center gap-2">
              {totalDiff > 0 ? <TrendingUp className="w-5 h-5 text-emerald-600" /> : totalDiff < 0 ? <TrendingDown className="w-5 h-5 text-rose-600" /> : <Minus className="w-5 h-5 text-slate-400" />}
              <p className={`text-2xl font-bold ${totalDiff >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatSAR(Math.abs(totalDiff))}</p>
              <span className={`text-sm font-medium ${totalDiff >= 0 ? "text-emerald-600" : "text-rose-600"}`}>({totalChangePct}%)</span>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-2xl border p-6 mb-6">
          <h3 className="text-sm font-semibold text-slate-600 mb-4">{t("rptSales.chartTitle")}</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData} barGap={8}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => formatSAR(v)} />
              <Legend />
              <Bar dataKey={t("rptSales.period1")} fill="#3b82f6" radius={[6, 6, 0, 0]} />
              <Bar dataKey={t("rptSales.period2")} fill="#94a3b8" radius={[6, 6, 0, 0]} />
            </BarChart>
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
                  <th className="px-4 py-3 text-start font-semibold text-slate-600">{t("rptSales.restaurant")}</th>
                  <th className="px-4 py-3 text-end font-semibold text-slate-600">{t("rptSales.period1")}</th>
                  <th className="px-4 py-3 text-end font-semibold text-slate-600">{t("rptSales.period2")}</th>
                  <th className="px-4 py-3 text-end font-semibold text-slate-600">{t("rptSales.diff")}</th>
                  <th className="px-4 py-3 text-end font-semibold text-slate-600">{t("rptSales.change")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.results ?? []).map(r => (
                  <tr key={r.restaurantId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700">{pickName({ name: r.restaurantName, nameAr: r.restaurantNameAr })}</td>
                    <td className="px-4 py-3 text-end tabular-nums text-slate-700">{formatSAR(r.period1.netSales)}</td>
                    <td className="px-4 py-3 text-end tabular-nums text-slate-500">{formatSAR(r.period2.netSales)}</td>
                    <td className={`px-4 py-3 text-end tabular-nums font-medium ${r.diff >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatSAR(r.diff)}</td>
                    <td className="px-4 py-3 text-end">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${r.changePct >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                        {r.changePct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(r.changePct)}%
                      </span>
                    </td>
                  </tr>
                ))}
                {(!data?.results || data.results.length === 0) && (
                  <tr><td colSpan={5} className="py-16 text-center text-slate-400">{t("rptCommon.noData")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
