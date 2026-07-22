import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrintButton } from "@/components/ui/PrintButton";
import { useReportData } from "@/hooks/use-report-data";
import { formatSAR } from "@/lib/format";
import { exportToExcel } from "@/lib/export-excel";
import { Link } from "wouter";
import { ArrowLeft, FileSpreadsheet, Wallet, ArrowDownCircle, ArrowUpCircle } from "lucide-react";

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

export default function FinancialReport() {
  const { t, pickName } = useLanguage();
  const { restaurants } = useRestaurant();
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const { data, isLoading } = useReportData<FinData>("financial", {
    restaurantId: selectedRestaurant || null,
    from: fromDate || null,
    to: toDate || null,
  });

  const displayRestaurants = data?.restaurants ?? [];

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
    exportToExcel(rows, "financial-report", t("rptFin.title"));
  };

  return (
    <div>
      <PageHeader
        title={t("rptFin.title")}
        description={t("rptFin.description")}
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
          <label className="text-xs font-medium text-slate-500 mb-1 block">{t("rptCommon.restaurant")}</label>
          <select value={selectedRestaurant} onChange={e => setSelectedRestaurant(e.target.value)}
            className="px-3 py-2 border rounded-xl text-sm min-w-[200px]">
            <option value="">{t("rptCommon.selectRestaurant")}</option>
            {restaurants.map(r => (
              <option key={r.id} value={r.id}>{pickName(r)}</option>
            ))}
          </select>
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
        displayRestaurants.map(r => (
          <div key={r.restaurantId} className="bg-white rounded-2xl border shadow-sm mb-6 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b flex items-center gap-2">
              <Wallet className="w-5 h-5 text-purple-600" />
              <h3 className="font-bold text-slate-800">{pickName({ name: r.restaurantName, nameAr: r.restaurantNameAr })}</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
              {/* Income */}
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ArrowDownCircle className="w-4 h-4 text-emerald-600" />
                  <h4 className="font-semibold text-emerald-700 text-sm uppercase tracking-wider">{t("rptFin.incomeSection")}</h4>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-slate-500">{t("rptFin.cashIncome")}</span><span className="tabular-nums">{formatSAR(r.income.cash)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500">{t("rptFin.cardIncome")}</span><span className="tabular-nums">{formatSAR(r.income.card)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500">{t("rptFin.appIncome")}</span><span className="tabular-nums">{formatSAR(r.income.apps)}</span></div>
                  <div className="h-px bg-slate-200 my-1" />
                  <div className="flex justify-between text-sm font-bold"><span className="text-emerald-700">{t("rptFin.totalIncome")}</span><span className="tabular-nums text-emerald-700">{formatSAR(r.income.total)}</span></div>
                </div>
              </div>

              {/* Purchases */}
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ArrowUpCircle className="w-4 h-4 text-rose-600" />
                  <h4 className="font-semibold text-rose-700 text-sm uppercase tracking-wider">{t("rptFin.purchasesSection")}</h4>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-slate-500">{t("rptFin.cashPurchases")}</span><span className="tabular-nums">{formatSAR(r.purchases.cash)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500">{t("rptFin.creditPurchases")}</span><span className="tabular-nums">{formatSAR(r.purchases.credit)}</span></div>
                  <div className="h-px bg-slate-200 my-1" />
                  <div className="flex justify-between text-sm font-bold"><span className="text-rose-700">{t("rptFin.totalPurchases")}</span><span className="tabular-nums text-rose-700">{formatSAR(r.purchases.total)}</span></div>
                </div>
              </div>

              {/* Net Profit */}
              <div className="p-5 flex flex-col items-center justify-center">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t("rptFin.netProfit")}</p>
                <p className={`text-3xl font-extrabold tabular-nums ${r.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {formatSAR(r.netProfit)}
                </p>
              </div>
            </div>
          </div>
        ))
      )}

      {displayRestaurants.length === 0 && !isLoading && (
        <div className="bg-white rounded-2xl border p-16 text-center text-slate-400">
          {t("rptCommon.selectRestaurantPrompt")}
        </div>
      )}
    </div>
  );
}
