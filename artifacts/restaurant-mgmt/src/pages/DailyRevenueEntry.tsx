import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useCreateSale,
  useUpdateSale,
  useGetSalesAppConfig,
  getListSalesQueryKey,
  customFetch,
} from "@workspace/api-client-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { useInvalidateFinancials } from "@/hooks/use-invalidate-financials";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrintButton } from "@/components/ui/PrintButton";
import { formatSAR } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import {
  CalendarDays,
  Save,
  Loader2,
  Banknote,
  CreditCard,
  Smartphone,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
} from "lucide-react";

const VAT_RATE = 0.15;

type ExistingSale = {
  id: number;
  date: string;
  cash: number;
  card: number;
  app1: number;
  app2: number;
  app3: number;
  app4: number;
  app5: number;
  app6: number;
  vatMode: string;
  totalRevenue: number;
  netSales: number;
  outputVat: number;
  openingBalance: number;
  cashExpenses: number;
  pettyCash: number;
  closingBalance: number;
  expectedClosing: number;
  cashDiscrepancy: number;
  dailyNotes: string;
  createdAt: string;
};

function toNum(v: string | number): number {
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

export default function DailyRevenueEntry() {
  const { t, pickName, dir } = useLanguage();
  const { activeRestaurant } = useRestaurant();
  const queryClient = useQueryClient();
  const invalidateFinancials = useInvalidateFinancials();

  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);

  // Form fields
  const [cash, setCash] = useState("");
  const [card, setCard] = useState("");
  const [app1, setApp1] = useState("");
  const [app2, setApp2] = useState("");
  const [app3, setApp3] = useState("");
  const [app4, setApp4] = useState("");
  const [app5, setApp5] = useState("");
  const [app6, setApp6] = useState("");

  // Purchasing (maps to cashExpenses for cash purchases, pettyCash for credit)
  const [purchasingCash, setPurchasingCash] = useState("");
  const [purchasingCredit, setPurchasingCredit] = useState("");

  // POS reported total (the "report" line from Excel)
  const [posReportedTotal, setPosReportedTotal] = useState("");

  const [dailyNotes, setDailyNotes] = useState("");

  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // App config (delivery app names)
  const { data: appConfig } = useGetSalesAppConfig();

  const appNames = useMemo(() => ({
    app1: appConfig?.app1Name ?? "HungerStation",
    app2: appConfig?.app2Name ?? "Jahez",
    app3: appConfig?.app3Name ?? "Noon Food",
    app4: appConfig?.app4Name ?? "Talabat",
    app5: appConfig?.app5Name ?? "The Chefz",
    app6: appConfig?.app6Name ?? "Colada",
  }), [appConfig]);

  // Check if a record already exists for this date
  const byDateUrl = `/api/sales/by-date?date=${date}`;
  const { data: existingRecord, isLoading: isLoadingExisting } = useQuery<ExistingSale | null>({
    queryKey: [byDateUrl],
    queryFn: () => customFetch<ExistingSale | null>(byDateUrl),
    enabled: !!date,
    staleTime: 0,
  });

  // Populate form when an existing record is found
  useEffect(() => {
    if (existingRecord) {
      setCash(existingRecord.cash ? String(existingRecord.cash) : "");
      setCard(existingRecord.card ? String(existingRecord.card) : "");
      setApp1(existingRecord.app1 ? String(existingRecord.app1) : "");
      setApp2(existingRecord.app2 ? String(existingRecord.app2) : "");
      setApp3(existingRecord.app3 ? String(existingRecord.app3) : "");
      setApp4(existingRecord.app4 ? String(existingRecord.app4) : "");
      setApp5(existingRecord.app5 ? String(existingRecord.app5) : "");
      setApp6(existingRecord.app6 ? String(existingRecord.app6) : "");
      setPurchasingCash(existingRecord.cashExpenses ? String(existingRecord.cashExpenses) : "");
      setPurchasingCredit(existingRecord.pettyCash ? String(existingRecord.pettyCash) : "");
      setPosReportedTotal(existingRecord.closingBalance ? String(existingRecord.closingBalance) : "");
      setDailyNotes(existingRecord.dailyNotes ?? "");
      setLastSaved(existingRecord.createdAt);
    } else if (existingRecord === null) {
      setCash("");
      setCard("");
      setApp1("");
      setApp2("");
      setApp3("");
      setApp4("");
      setApp5("");
      setApp6("");
      setPurchasingCash("");
      setPurchasingCredit("");
      setPosReportedTotal("");
      setDailyNotes("");
      setLastSaved(null);
    }
  }, [existingRecord]);

  // Real-time calculations
  const cashNum = toNum(cash);
  const cardNum = toNum(card);
  const app1Num = toNum(app1);
  const app2Num = toNum(app2);
  const app3Num = toNum(app3);
  const app4Num = toNum(app4);
  const app5Num = toNum(app5);
  const app6Num = toNum(app6);
  const appsTotal = app1Num + app2Num + app3Num + app4Num + app5Num + app6Num;
  const totalIncomeInclVat = cashNum + cardNum + appsTotal;
  const netSales = +(totalIncomeInclVat / (1 + VAT_RATE)).toFixed(2);
  const outputVat = +(totalIncomeInclVat - netSales).toFixed(2);

  const purchasingCashNum = toNum(purchasingCash);
  const purchasingCreditNum = toNum(purchasingCredit);
  const totalPurchases = purchasingCashNum + purchasingCreditNum;

  const posReportedNum = toNum(posReportedTotal);
  const discrepancy = totalIncomeInclVat - posReportedNum;

  const netProfit = totalIncomeInclVat - totalPurchases;

  // Mutations
  const createSale = useCreateSale();
  const updateSale = useUpdateSale();

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getListSalesQueryKey() });
    queryClient.invalidateQueries({ queryKey: [byDateUrl] });
    invalidateFinancials();
  }, [queryClient, byDateUrl, invalidateFinancials]);

  const handleSave = async () => {
    if (!date) {
      toast({ title: t("dailyRevenue.dateRequired"), variant: "destructive" });
      return;
    }
    setIsSaving(true);

    const payload = {
      date,
      cash: cashNum,
      card: cardNum,
      app1: app1Num,
      app2: app2Num,
      app3: app3Num,
      app4: app4Num,
      app5: app5Num,
      app6: app6Num,
      vatMode: "inclusive" as const,
      openingBalance: 0,
      cashExpenses: purchasingCashNum,
      pettyCash: purchasingCreditNum,
      closingBalance: posReportedNum,
      dailyNotes: dailyNotes || "",
    };

    try {
      if (existingRecord?.id) {
        await updateSale.mutateAsync(
          { id: existingRecord.id, data: payload },
          { onSuccess: invalidateAll },
        );
        toast({ title: t("dailyRevenue.updated") });
      } else {
        await createSale.mutateAsync(
          { data: payload },
          { onSuccess: invalidateAll },
        );
        toast({ title: t("dailyRevenue.saved") });
      }
      setLastSaved(new Date().toISOString());
      queryClient.invalidateQueries({ queryKey: [byDateUrl] });
    } catch {
      toast({ title: t("dailyRevenue.saveFailed"), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const isEditing = !!existingRecord?.id;

  return (
    <div>
      <PageHeader
        title={t("dailyRevenue.title")}
        description={t("dailyRevenue.description")}
        action={
          <div className="flex gap-2 items-center flex-wrap no-print">
            <PrintButton />
          </div>
        }
      />

      {/* Header Info Bar */}
      <div className="bg-white rounded-2xl border shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-center gap-6">
          {/* Date */}
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{t("dailyRevenue.date")}</p>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="px-3 py-1.5 border rounded-xl text-sm font-medium text-slate-800 bg-slate-50"
              />
            </div>
          </div>

          {/* Restaurant */}
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{t("dailyRevenue.restaurant")}</p>
              <p className="text-sm font-bold text-slate-800">{activeRestaurant ? pickName(activeRestaurant) : "-"}</p>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            {isEditing ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-500" />
            )}
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{t("dailyRevenue.status")}</p>
              <p className={`text-sm font-bold ${isEditing ? "text-emerald-600" : "text-amber-600"}`}>
                {isLoadingExisting ? t("common.loading") : isEditing ? t("dailyRevenue.editing") : t("dailyRevenue.newEntry")}
              </p>
            </div>
          </div>

          {/* Last saved */}
          {lastSaved && (
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{t("dailyRevenue.lastSaved")}</p>
                <p className="text-sm text-slate-600">
                  {new Date(lastSaved).toLocaleString(dir === "rtl" ? "ar-SA" : "en-SA")}
                </p>
              </div>
            </div>
          )}

          {/* User */}
          <div className="flex items-center gap-2 ms-auto">
            <User className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{t("dailyRevenue.user")}</p>
              <p className="text-sm text-slate-600">{t("dailyRevenue.currentUser")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Entry Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Income Section */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            {/* Income Header */}
            <div className="px-6 py-4 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-emerald-800 text-sm uppercase tracking-wider">{t("dailyRevenue.incomeSection")}</h3>
            </div>

            {/* Cash & Card Row */}
            <div className="px-6 py-4 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{t("dailyRevenue.directPayments")}</p>
              <div className="grid grid-cols-2 gap-4">
                <InputField icon={<Banknote className="w-4 h-4" />} label={t("dailyRevenue.cash")} value={cash} onChange={setCash} color="emerald" />
                <InputField icon={<CreditCard className="w-4 h-4" />} label={t("dailyRevenue.card")} value={card} onChange={setCard} color="blue" />
              </div>
            </div>

            {/* Delivery Apps */}
            <div className="px-6 py-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{t("dailyRevenue.deliveryApps")}</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <InputField icon={<Smartphone className="w-4 h-4" />} label={appNames.app2} value={app2} onChange={setApp2} color="violet" />
                <InputField icon={<Smartphone className="w-4 h-4" />} label={appNames.app1} value={app1} onChange={setApp1} color="orange" />
                <InputField icon={<Smartphone className="w-4 h-4" />} label={appNames.app4} value={app4} onChange={setApp4} color="pink" />
                <InputField icon={<Smartphone className="w-4 h-4" />} label={appNames.app3} value={app3} onChange={setApp3} color="cyan" />
                <InputField icon={<Smartphone className="w-4 h-4" />} label={appNames.app5} value={app5} onChange={setApp5} color="amber" />
                <InputField icon={<Smartphone className="w-4 h-4" />} label={appNames.app6} value={app6} onChange={setApp6} color="indigo" />
              </div>
            </div>

            {/* Income Totals */}
            <div className="px-6 py-4 bg-emerald-50 border-t border-emerald-100">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <TotalCard label={t("dailyRevenue.cashTotal")} value={cashNum} color="emerald" />
                <TotalCard label={t("dailyRevenue.cardTotal")} value={cardNum} color="blue" />
                <TotalCard label={t("dailyRevenue.appsTotal")} value={appsTotal} color="violet" />
                <TotalCard label={t("dailyRevenue.totalIncomeVat")} value={totalIncomeInclVat} color="emerald" highlight />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Summary + Purchases */}
        <div className="space-y-6">
          {/* Live Summary */}
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-blue-50 border-b border-blue-100">
              <h3 className="font-bold text-blue-800 text-sm uppercase tracking-wider">{t("dailyRevenue.summary")}</h3>
            </div>
            <div className="p-5 space-y-3">
              <SummaryRow label={t("dailyRevenue.totalIncomeVat")} value={totalIncomeInclVat} bold color="emerald" />
              <SummaryRow label={t("dailyRevenue.netSalesExVat")} value={netSales} color="blue" />
              <SummaryRow label={t("dailyRevenue.outputVat15")} value={outputVat} color="amber" />
              <div className="h-px bg-slate-200" />
              <SummaryRow label={t("dailyRevenue.totalPurchases")} value={totalPurchases} color="rose" />
              <div className="h-px bg-slate-200" />
              <SummaryRow label={t("dailyRevenue.netProfit")} value={netProfit} bold color={netProfit >= 0 ? "emerald" : "rose"} />
            </div>
          </div>

          {/* Purchases Section */}
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-rose-50 border-b border-rose-100 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-rose-600" />
              <h3 className="font-bold text-rose-800 text-sm uppercase tracking-wider">{t("dailyRevenue.purchasesSection")}</h3>
            </div>
            <div className="p-5 space-y-4">
              <InputField icon={<Banknote className="w-4 h-4" />} label={t("dailyRevenue.purchasingCash")} value={purchasingCash} onChange={setPurchasingCash} color="rose" />
              <InputField icon={<CreditCard className="w-4 h-4" />} label={t("dailyRevenue.purchasingCredit")} value={purchasingCredit} onChange={setPurchasingCredit} color="rose" />
              <div className="bg-rose-50 rounded-xl p-3 flex justify-between items-center">
                <span className="text-sm font-semibold text-rose-700">{t("dailyRevenue.totalPurchases")}</span>
                <span className="text-lg font-extrabold text-rose-700 tabular-nums">{formatSAR(totalPurchases)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* POS Report & Discrepancy */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-2xl border shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{t("dailyRevenue.posReport")}</p>
          <InputField icon={<TrendingUp className="w-4 h-4" />} label={t("dailyRevenue.posReportedTotal")} value={posReportedTotal} onChange={setPosReportedTotal} color="slate" />
          {posReportedNum > 0 && (
            <div className={`mt-3 rounded-xl p-3 flex justify-between items-center ${discrepancy >= 0 ? "bg-amber-50" : "bg-rose-50"}`}>
              <span className="text-sm font-semibold text-slate-600">
                {discrepancy >= 0 ? t("dailyRevenue.surplus") : t("dailyRevenue.shortage")}
              </span>
              <span className={`text-lg font-extrabold tabular-nums ${discrepancy >= 0 ? "text-amber-700" : "text-rose-700"}`}>
                {formatSAR(Math.abs(discrepancy))}
              </span>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{t("dailyRevenue.notes")}</p>
          <textarea
            value={dailyNotes}
            onChange={e => setDailyNotes(e.target.value)}
            placeholder={t("dailyRevenue.notesPlaceholder")}
            className="w-full px-3 py-2 border rounded-xl text-sm min-h-[80px] resize-none"
          />
        </div>
      </div>

      {/* Save Button */}
      <div className="no-print flex justify-center mb-8">
        <button
          onClick={handleSave}
          disabled={isSaving || !date}
          className="flex items-center gap-3 px-8 py-4 bg-primary text-primary-foreground rounded-2xl text-lg font-bold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <Save className="w-6 h-6" />
          )}
          {isSaving
            ? t("common.saving")
            : isEditing
              ? t("dailyRevenue.updateRecord")
              : t("dailyRevenue.saveRecord")}
        </button>
      </div>
    </div>
  );
}

/* ── Reusable Sub-Components ──────────────────────────────────────────── */

function InputField({
  icon,
  label,
  value,
  onChange,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: "focus:border-emerald-400 focus:ring-emerald-200",
    blue: "focus:border-blue-400 focus:ring-blue-200",
    violet: "focus:border-violet-400 focus:ring-violet-200",
    orange: "focus:border-orange-400 focus:ring-orange-200",
    pink: "focus:border-pink-400 focus:ring-pink-200",
    cyan: "focus:border-cyan-400 focus:ring-cyan-200",
    amber: "focus:border-amber-400 focus:ring-amber-200",
    indigo: "focus:border-indigo-400 focus:ring-indigo-200",
    rose: "focus:border-rose-400 focus:ring-rose-200",
    slate: "focus:border-slate-400 focus:ring-slate-200",
  };
  const iconColor: Record<string, string> = {
    emerald: "text-emerald-500",
    blue: "text-blue-500",
    violet: "text-violet-500",
    orange: "text-orange-500",
    pink: "text-pink-500",
    cyan: "text-cyan-500",
    amber: "text-amber-500",
    indigo: "text-indigo-500",
    rose: "text-rose-500",
    slate: "text-slate-500",
  };

  return (
    <div>
      <label className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1.5">
        <span className={iconColor[color] ?? "text-slate-400"}>{icon}</span>
        {label}
      </label>
      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="0.00"
        className={`w-full px-3 py-2.5 border rounded-xl text-sm font-medium tabular-nums text-end bg-slate-50 focus:bg-white focus:ring-2 focus:outline-none transition-all ${colorMap[color] ?? ""}`}
      />
    </div>
  );
}

function TotalCard({
  label,
  value,
  color,
  highlight,
}: {
  label: string;
  value: number;
  color: string;
  highlight?: boolean;
}) {
  const bg = highlight ? `bg-${color}-100` : `bg-${color}-50`;
  const text = `text-${color}-700`;
  return (
    <div className={`rounded-xl p-3 text-center ${highlight ? "bg-emerald-100 ring-2 ring-emerald-300" : "bg-slate-50"}`}>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-lg font-extrabold tabular-nums ${highlight ? "text-emerald-700" : `text-${color}-600`}`}>{formatSAR(value)}</p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  bold,
  color,
}: {
  label: string;
  value: number;
  bold?: boolean;
  color: string;
}) {
  const textColor: Record<string, string> = {
    emerald: "text-emerald-700",
    blue: "text-blue-700",
    amber: "text-amber-700",
    rose: "text-rose-700",
    slate: "text-slate-700",
  };
  return (
    <div className="flex justify-between items-center">
      <span className={`text-sm ${bold ? "font-bold text-slate-800" : "text-slate-500"}`}>{label}</span>
      <span className={`tabular-nums ${bold ? "text-lg font-extrabold" : "text-sm font-semibold"} ${textColor[color] ?? "text-slate-700"}`}>
        {formatSAR(value)}
      </span>
    </div>
  );
}
