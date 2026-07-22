import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrintButton } from "@/components/ui/PrintButton";
import { useReportData } from "@/hooks/use-report-data";
import { formatSAR } from "@/lib/format";
import { exportToExcel } from "@/lib/export-excel";
import { Link } from "wouter";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { ArrowLeft, FileSpreadsheet, ArrowDownCircle, ArrowUpCircle } from "lucide-react";

type FinData = {
  restaurants: Array<{
    restaurantId: number;
    restaurantName: string;
    restaurantNameAr: string;
    income: { cash: number; card: number; apps: number; total: number };
    purchases: { cash: number; credit: number; total: number };
    netProfit: number;
  }>;
  consolidated: {
    income: { cash: number; card: number; apps: number; total: number };
    purchases: { cash: number; credit: number; total: number };
    netProfit: number;
  };
};

type PeriodPreset = "today" | "week" | "month" | "year" | "custom";

function getPresetDates(preset: PeriodPreset): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  switch (preset) {
    case "today":
      return { from: fmt(today), to: fmt(today) };
    case "week": {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      return { from: fmt(weekStart), to: fmt(today) };
    }
    case "month": {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: fmt(monthStart), to: fmt(today) };
    }
    case "year": {
      const yearStart = new Date(today.getFullYear(), 0, 1);
      return { from: fmt(yearStart), to: fmt(today) };
    }
    case "custom":
      return { from: "", to: "" };
  }
}

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function ConsolidatedFinancial() {
  const { t, pickName } = useLanguage();
  const [preset, setPreset] = useState<PeriodPreset>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const presetDates = preset === "custom" ? { from: customFrom, to: customTo } : getPresetDates(preset);

  const { data, isLoading } = useReportData<FinData>("financial", {
    from: presetDates.from || null,
    to: presetDates.to || null,
  });

  const c = data?.consolidated;

  const incomeChartData = c ? [
    { name: t("rptFin.cashIncome"), value: Number(c.income.cash) },
    { name: t("rptFin.cardIncome"), value: Number(c.income.card) },
    { name: t("rptFin.appIncome"), value: Number(c.income.apps) },
  ].filter(d => d.value > 0) : [];

  const purchaseChartData = c ? [
    { name: t("rptFin.cashPurchases"), value: Number(c.purchases.cash) },
    { name: t("rptFin.creditPurchases"), value: Number(c.purchases.credit) },
  ].filter(d => d.value > 0) : [];

  const handleExport = () => {
    if (!data) return;
    const rows = data.restaurants.map(r => ({
      [t("rptFin.restaurant")]: pickName({ name: r.restaurantName, nameAr: r.restaurantNameAr }),
      [t("rptFin.cashIncome")]: r.income.cash,
      [t("rptFin.cardIncome")]: r.income.card,
      [t("rptFin.appIncome")]: r.income.apps,
      [t("rptFin.totalIncome")]: r.income.total,
      [t("rptFin.cashPurchases")]: r.purchases.cash,
      [t("rptFin.creditPurchases")]: r.purchases.credit,
      [t("rptFin.totalPurchases")]: r.purchases.total,
      [t("rptFin.netProfit")]: r.netProfit,
    }));
    exportToExcel(rows, "consolidated-financial", t("rptConsol.title"));
  };

  const presetButtons: { id: PeriodPreset; label: string }[] = [
    { id: "today",  label: t("rptConsol.today") },
    { id: "week",   label: t("rptConsol.thisWeek") },
    { id: "month",  label: t("rptConsol.thisMonth") },
    { id: "year",   label: t("rptConsol.thisYear") },
    { id: "custom", label: t("rptSales.custom") },
  ];

  return (
    <div>
      <PageHeader
        title={t("rptConsol.title")}
        description={t("rptConsol.description")}
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

      {/* Period Filter */}
      <div className="no-print bg-white rounded-2xl border p-4 mb-6 space-y-4">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit flex-wrap">
          {presetButtons.map(p => (
            <button key={p.id} onClick={() => setPreset(p.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${preset === p.id ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
              {p.label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">{t("rptCommon.from")}</label>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="px-3 py-2 border rounded-xl text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">{t("rptCommon.to")}</label>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="px-3 py-2 border rounded-xl text-sm" />
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-slate-400">{t("common.loading")}</div>
      ) : c ? (
        <>
          {/* Consolidated Totals */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <ArrowDownCircle className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-emerald-800 uppercase text-sm tracking-wider">{t("rptConsol.totalIncome")}</h3>
              </div>
              <p className="text-3xl font-extrabold text-emerald-700 tabular-nums mb-3">{formatSAR(c.income.total)}</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-emerald-600">{t("rptFin.cashIncome")}</span><span className="tabular-nums font-medium">{formatSAR(c.income.cash)}</span></div>
                <div className="flex justify-between"><span className="text-emerald-600">{t("rptFin.cardIncome")}</span><span className="tabular-nums font-medium">{formatSAR(c.income.card)}</span></div>
                <div className="flex justify-between"><span className="text-emerald-600">{t("rptFin.appIncome")}</span><span className="tabular-nums font-medium">{formatSAR(c.income.apps)}</span></div>
              </div>
            </div>

            <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <ArrowUpCircle className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-rose-800 uppercase text-sm tracking-wider">{t("rptConsol.totalPurchases")}</h3>
              </div>
              <p className="text-3xl font-extrabold text-rose-700 tabular-nums mb-3">{formatSAR(c.purchases.total)}</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-rose-600">{t("rptFin.cashPurchases")}</span><span className="tabular-nums font-medium">{formatSAR(c.purchases.cash)}</span></div>
                <div className="flex justify-between"><span className="text-rose-600">{t("rptFin.creditPurchases")}</span><span className="tabular-nums font-medium">{formatSAR(c.purchases.credit)}</span></div>
              </div>
            </div>

            <div className={`border-2 rounded-2xl p-6 flex flex-col items-center justify-center ${c.netProfit >= 0 ? "bg-blue-50 border-blue-200" : "bg-amber-50 border-amber-200"}`}>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("rptFin.netProfit")}</p>
              <p className={`text-4xl font-extrabold tabular-nums ${c.netProfit >= 0 ? "text-blue-700" : "text-amber-700"}`}>
                {formatSAR(c.netProfit)}
              </p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
            {incomeChartData.length > 0 && (
              <div className="bg-white rounded-2xl border p-6">
                <h3 className="text-sm font-semibold text-slate-600 mb-4">{t("rptConsol.incomeBreakdown")}</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={incomeChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {incomeChartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatSAR(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            {purchaseChartData.length > 0 && (
              <div className="bg-white rounded-2xl border p-6">
                <h3 className="text-sm font-semibold text-slate-600 mb-4">{t("rptConsol.purchaseBreakdown")}</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={purchaseChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {purchaseChartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[(i + 3) % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatSAR(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Per-Restaurant Table */}
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-start font-semibold text-slate-600">{t("rptFin.restaurant")}</th>
                    <th className="px-4 py-3 text-end font-semibold text-emerald-600">{t("rptFin.cashIncome")}</th>
                    <th className="px-4 py-3 text-end font-semibold text-emerald-600">{t("rptFin.cardIncome")}</th>
                    <th className="px-4 py-3 text-end font-semibold text-emerald-600">{t("rptFin.appIncome")}</th>
                    <th className="px-4 py-3 text-end font-semibold text-emerald-700">{t("rptFin.totalIncome")}</th>
                    <th className="px-4 py-3 text-end font-semibold text-rose-600">{t("rptFin.cashPurchases")}</th>
                    <th className="px-4 py-3 text-end font-semibold text-rose-600">{t("rptFin.creditPurchases")}</th>
                    <th className="px-4 py-3 text-end font-semibold text-rose-700">{t("rptFin.totalPurchases")}</th>
                    <th className="px-4 py-3 text-end font-semibold text-slate-800">{t("rptFin.netProfit")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data!.restaurants.map(r => (
                    <tr key={r.restaurantId} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-700">{pickName({ name: r.restaurantName, nameAr: r.restaurantNameAr })}</td>
                      <td className="px-4 py-3 text-end tabular-nums text-slate-600">{formatSAR(r.income.cash)}</td>
                      <td className="px-4 py-3 text-end tabular-nums text-slate-600">{formatSAR(r.income.card)}</td>
                      <td className="px-4 py-3 text-end tabular-nums text-slate-600">{formatSAR(r.income.apps)}</td>
                      <td className="px-4 py-3 text-end tabular-nums font-semibold text-emerald-700">{formatSAR(r.income.total)}</td>
                      <td className="px-4 py-3 text-end tabular-nums text-slate-600">{formatSAR(r.purchases.cash)}</td>
                      <td className="px-4 py-3 text-end tabular-nums text-slate-600">{formatSAR(r.purchases.credit)}</td>
                      <td className="px-4 py-3 text-end tabular-nums font-semibold text-rose-700">{formatSAR(r.purchases.total)}</td>
                      <td className={`px-4 py-3 text-end tabular-nums font-bold ${r.netProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatSAR(r.netProfit)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                    <td className="px-4 py-3 text-slate-800">{t("rptConsol.grandTotal")}</td>
                    <td className="px-4 py-3 text-end tabular-nums">{formatSAR(c.income.cash)}</td>
                    <td className="px-4 py-3 text-end tabular-nums">{formatSAR(c.income.card)}</td>
                    <td className="px-4 py-3 text-end tabular-nums">{formatSAR(c.income.apps)}</td>
                    <td className="px-4 py-3 text-end tabular-nums text-emerald-700">{formatSAR(c.income.total)}</td>
                    <td className="px-4 py-3 text-end tabular-nums">{formatSAR(c.purchases.cash)}</td>
                    <td className="px-4 py-3 text-end tabular-nums">{formatSAR(c.purchases.credit)}</td>
                    <td className="px-4 py-3 text-end tabular-nums text-rose-700">{formatSAR(c.purchases.total)}</td>
                    <td className={`px-4 py-3 text-end tabular-nums ${c.netProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatSAR(c.netProfit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
