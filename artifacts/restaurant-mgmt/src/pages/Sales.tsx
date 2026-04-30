import { useState, memo, useEffect } from "react";
import {
  useListSales, useGetMonthlySalesSummary, useGetSalesAppConfig,
  useUpdateSalesAppConfig, useGetSalesReport,
  getListSalesQueryKey, getGetMonthlySalesSummaryQueryKey, getGetDashboardSummaryQueryKey,
  getGetVatReportQueryKey, getGetSalesAppConfigQueryKey, getGetSalesReportQueryKey,
  useCreateSale, useUpdateSale, useDeleteSale,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrintButton } from "@/components/ui/PrintButton";
import { formatSAR, formatDate } from "@/lib/format";
import { exportToExcel } from "@/lib/export-excel";
import { useForm, FormProvider, useFormContext } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/hooks/use-toast";
import {
  Plus, Trash2, Pencil, FileSpreadsheet, X, Settings, BarChart3,
  Wallet, Smartphone, AlertTriangle, CheckCircle2, Calendar,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
type AppConfig = {
  app1Name: string; app2Name: string; app3Name: string;
  app4Name: string; app5Name: string; app6Name: string;
  defaultVatMode: string;
};

type SaleRecord = {
  id: number; date: string; vatMode: string;
  cash: number; card: number;
  app1: number; app2: number; app3: number; app4: number; app5: number; app6: number;
  totalRevenue: number; netSales: number; outputVat: number;
  openingBalance: number; cashExpenses: number; pettyCash: number;
  closingBalance: number; expectedClosing: number; cashDiscrepancy: number;
  dailyNotes: string;
};

// ─── Form Schema ─────────────────────────────────────────────────────────────
const saleSchema = z.object({
  date: z.string().min(1, "Date required"),
  vatMode: z.string(),
  cash: z.coerce.number().min(0),
  card: z.coerce.number().min(0),
  app1: z.coerce.number().min(0),
  app2: z.coerce.number().min(0),
  app3: z.coerce.number().min(0),
  app4: z.coerce.number().min(0),
  app5: z.coerce.number().min(0),
  app6: z.coerce.number().min(0),
  openingBalance: z.coerce.number().min(0),
  cashExpenses: z.coerce.number().min(0),
  pettyCash: z.coerce.number().min(0),
  closingBalance: z.coerce.number().min(0),
  dailyNotes: z.string(),
});
type SaleForm = z.infer<typeof saleSchema>;

function makeDefault(vatMode: string): SaleForm {
  return {
    date: new Date().toISOString().split("T")[0],
    vatMode,
    cash: 0, card: 0,
    app1: 0, app2: 0, app3: 0, app4: 0, app5: 0, app6: 0,
    openingBalance: 0, cashExpenses: 0, pettyCash: 0, closingBalance: 0,
    dailyNotes: "",
  };
}

// ─── Module-level inputs (prevent focus loss) ─────────────────────────────────
const AmtInput = memo(({ name, label }: { name: keyof SaleForm; label: string }) => {
  const form = useFormContext<SaleForm>();
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-0.5">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">SAR</span>
        <input
          type="number" step="0.01" min="0"
          {...form.register(name)}
          className="w-full pl-12 pr-3 py-2 border rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          placeholder="0.00"
        />
      </div>
    </div>
  );
});

// ─── Live Preview inside modal ────────────────────────────────────────────────
function LivePreview({ appNames }: { appNames: AppConfig }) {
  const form = useFormContext<SaleForm>();
  const vals = form.watch();
  const vatMode = vals.vatMode;
  const n = (v: unknown) => Number(v) || 0;
  const raw = n(vals.cash) + n(vals.card) +
    n(vals.app1) + n(vals.app2) + n(vals.app3) +
    n(vals.app4) + n(vals.app5) + n(vals.app6);
  const VAT = 0.15;
  const netSales = vatMode === "inclusive" ? raw / (1 + VAT) : raw;
  const vat = vatMode === "inclusive" ? raw - netSales : raw * VAT;
  const expectedClosing = n(vals.openingBalance) + n(vals.cash) - n(vals.cashExpenses) - n(vals.pettyCash);
  const discrepancy = n(vals.closingBalance) - expectedClosing;

  return (
    <div className="bg-slate-50 rounded-xl p-3 border grid grid-cols-2 gap-2 text-xs">
      <div><span className="text-slate-500">Total Revenue:</span><span className="font-bold ml-1 text-slate-800">{formatSAR(raw)}</span></div>
      <div><span className="text-slate-500">Net Sales:</span><span className="font-bold ml-1 text-emerald-700">{formatSAR(netSales)}</span></div>
      <div><span className="text-slate-500">VAT ({vatMode === "inclusive" ? "incl" : "excl"}):</span><span className="font-bold ml-1 text-purple-700">{formatSAR(vat)}</span></div>
      <div>
        <span className="text-slate-500">Cash Discrepancy:</span>
        <span className={`font-bold ml-1 ${Math.abs(discrepancy) < 0.01 ? "text-emerald-600" : discrepancy > 0 ? "text-blue-600" : "text-rose-600"}`}>
          {discrepancy >= 0 ? "+" : ""}{formatSAR(discrepancy)}
        </span>
      </div>
    </div>
  );
}

// ─── Sale Modal ───────────────────────────────────────────────────────────────
function SaleModal({
  open, title, defaultValues, appNames, onClose, onSubmit, isPending,
}: {
  open: boolean; title: string; defaultValues: SaleForm;
  appNames: AppConfig;
  onClose: () => void; onSubmit: (d: SaleForm) => void; isPending: boolean;
}) {
  const form = useForm<SaleForm>({ resolver: zodResolver(saleSchema), defaultValues });
  useEffect(() => { if (open) form.reset(defaultValues); }, [open]);

  if (!open) return null;

  const vatMode = form.watch("vatMode");

  const appFields: Array<{ name: keyof SaleForm; label: string }> = [
    { name: "app1", label: appNames.app1Name },
    { name: "app2", label: appNames.app2Name },
    { name: "app3", label: appNames.app3Name },
    { name: "app4", label: appNames.app4Name },
    { name: "app5", label: appNames.app5Name },
    { name: "app6", label: appNames.app6Name },
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 max-h-[92vh] flex flex-col">
        <div className="p-5 border-b flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><X className="w-4 h-4" /></button>
        </div>

        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <div className="overflow-y-auto flex-1 p-5 space-y-5">

              {/* Date + VAT Mode */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Date *</label>
                  <input
                    type="date"
                    {...form.register("date")}
                    className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  {form.formState.errors.date && <p className="text-rose-500 text-xs mt-1">{form.formState.errors.date.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">VAT Mode</label>
                  <select
                    {...form.register("vatMode")}
                    className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-white"
                  >
                    <option value="exclusive">Exclusive (Add 15% VAT)</option>
                    <option value="inclusive">Inclusive (VAT included)</option>
                  </select>
                  <p className="text-xs text-slate-400 mt-1">
                    {vatMode === "inclusive" ? "Amounts include VAT — system extracts it" : "Enter amounts without VAT — system adds 15%"}
                  </p>
                </div>
              </div>

              {/* Revenue Section */}
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" /> Revenue by Payment Channel
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 grid grid-cols-2 gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <AmtInput name="cash" label="💵 Cash Sales (SAR)" />
                    <AmtInput name="card" label="💳 Card / POS / Visa (SAR)" />
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs font-semibold text-purple-700 mb-2 flex items-center gap-1">
                      <Smartphone className="w-3 h-3" /> Delivery Apps
                    </p>
                    <div className="grid grid-cols-2 gap-3 bg-purple-50 border border-purple-200 rounded-xl p-3">
                      {appFields.map((f) => (
                        <AmtInput key={f.name} name={f.name} label={f.label} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Cash Management */}
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-amber-600" /> Cash Management
                </h3>
                <div className="grid grid-cols-2 gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <AmtInput name="openingBalance" label="Opening Balance (SAR)" />
                  <AmtInput name="cashExpenses" label="Cash Expenses (SAR)" />
                  <AmtInput name="pettyCash" label="Petty Cash / Float (SAR)" />
                  <AmtInput name="closingBalance" label="Actual Closing Balance (SAR)" />
                </div>
              </div>

              {/* Live Preview */}
              <LivePreview appNames={appNames} />

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold mb-1">Daily Notes</label>
                <textarea
                  {...form.register("dailyNotes")}
                  rows={2}
                  placeholder="Cash shortages, overages, operational issues..."
                  className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>
            </div>

            <div className="p-5 border-t bg-slate-50 shrink-0 flex justify-end gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl text-sm">Cancel</button>
              <button
                type="submit" disabled={isPending}
                className="px-6 py-2 bg-primary text-white rounded-xl shadow-md hover:shadow-lg disabled:opacity-50 text-sm"
              >
                {isPending ? "Saving..." : "Save Record"}
              </button>
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "dashboard", label: "Daily Records", icon: Calendar },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "cash", label: "Cash Management", icon: Wallet },
  { id: "settings", label: "Settings", icon: Settings },
] as const;
type TabId = typeof TABS[number]["id"];

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Sales() {
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<TabId>("dashboard");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [addOpen, setAddOpen] = useState(false);
  const [editSale, setEditSale] = useState<SaleRecord | null>(null);

  // Reports tab state
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [reportFetch, setReportFetch] = useState(false);

  // Settings state
  const [settingsEdit, setSettingsEdit] = useState(false);
  const [settingsForm, setSettingsForm] = useState<AppConfig>({
    app1Name: "HungerStation", app2Name: "Jahez", app3Name: "Noon Food",
    app4Name: "Talabat", app5Name: "App 5", app6Name: "App 6",
    defaultVatMode: "exclusive",
  });

  const { data: appConfigData } = useGetSalesAppConfig();
  const appNames: AppConfig = appConfigData ?? settingsForm;

  useEffect(() => {
    if (appConfigData) setSettingsForm(appConfigData as AppConfig);
  }, [appConfigData]);

  const updateConfig = useUpdateSalesAppConfig({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSalesAppConfigQueryKey() });
        setSettingsEdit(false);
        toast({ title: "Settings saved" });
      },
    },
  });

  const { data: salesRaw = [], isLoading } = useListSales(month ? { month } : undefined);
  const { data: summary = [] } = useGetMonthlySalesSummary();

  const { data: reportData, isLoading: reportLoading } = useGetSalesReport(
    reportFetch ? { from: reportFrom || undefined, to: reportTo || undefined } : undefined,
    { query: { enabled: reportFetch } }
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListSalesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetMonthlySalesSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetVatReportQueryKey() });
    if (reportFetch) queryClient.invalidateQueries({ queryKey: getGetSalesReportQueryKey() });
  };

  const create = useCreateSale({ mutation: { onSuccess: invalidate } });
  const update = useUpdateSale({ mutation: { onSuccess: invalidate } });
  const remove = useDeleteSale({ mutation: { onSuccess: invalidate } });

  const sales = salesRaw as SaleRecord[];
  const latestSummary = summary.length > 0 ? summary[summary.length - 1] : null;

  function handleCreate(data: SaleForm) {
    create.mutate({ data: data as Parameters<typeof create.mutate>[0]["data"] }, {
      onSuccess: () => { setAddOpen(false); toast({ title: "Record added" }); },
    });
  }
  function handleUpdate(data: SaleForm) {
    if (!editSale) return;
    update.mutate({ id: editSale.id, data: data as Parameters<typeof update.mutate>[0]["data"] }, {
      onSuccess: () => { setEditSale(null); toast({ title: "Record updated" }); },
    });
  }
  function handleDelete(id: number) {
    if (!confirm("Delete this sales record?")) return;
    remove.mutate({ id }, { onSuccess: () => toast({ title: "Record deleted" }) });
  }

  // Computed per row: apps total
  const appsTotal = (r: SaleRecord) => r.app1 + r.app2 + r.app3 + r.app4 + r.app5 + r.app6;
  const hasDiscrepancy = sales.some((r) => Math.abs(r.cashDiscrepancy) > 0.5);

  function exportExcel() {
    const rows = sales.map((r) => ({
      "Date": r.date,
      "VAT Mode": r.vatMode,
      "Cash (SAR)": r.cash,
      "Card (SAR)": r.card,
      [appNames.app1Name]: r.app1,
      [appNames.app2Name]: r.app2,
      [appNames.app3Name]: r.app3,
      [appNames.app4Name]: r.app4,
      [appNames.app5Name]: r.app5,
      [appNames.app6Name]: r.app6,
      "Apps Total (SAR)": appsTotal(r),
      "Total Revenue (SAR)": r.totalRevenue,
      "Net Sales (SAR)": r.netSales,
      "Output VAT (SAR)": r.outputVat,
      "Opening Balance (SAR)": r.openingBalance,
      "Cash Expenses (SAR)": r.cashExpenses,
      "Petty Cash (SAR)": r.pettyCash,
      "Closing Balance (SAR)": r.closingBalance,
      "Expected Closing (SAR)": r.expectedClosing,
      "Cash Discrepancy (SAR)": r.cashDiscrepancy,
      "Notes": r.dailyNotes,
    }));
    exportToExcel(rows, `sales-${month || "all"}`, "Sales");
  }

  function DiscrepancyBadge({ val }: { val: number }) {
    if (Math.abs(val) < 0.01) return <span className="text-emerald-600 text-xs font-semibold">✓</span>;
    return (
      <span className={`text-xs font-bold ${val > 0 ? "text-blue-600" : "text-rose-600"}`}>
        {val > 0 ? "+" : ""}{formatSAR(val)}
      </span>
    );
  }

  // ─── KPI Cards ─────────────────────────────────────────────────────────────
  const kpiCards = latestSummary
    ? [
        { label: "Total Revenue", value: latestSummary.totalRevenue, sub: "as entered", color: "bg-slate-700 text-white" },
        { label: "Net Sales (excl. VAT)", value: latestSummary.netSales, sub: "taxable base", color: "bg-emerald-50 border border-emerald-200 text-emerald-900" },
        { label: "Output VAT (15%)", value: latestSummary.totalOutputVat, sub: "ZATCA", color: "bg-purple-50 border border-purple-200 text-purple-900" },
        { label: "Cash Total", value: latestSummary.cash, sub: "cash channel", color: "bg-amber-50 border border-amber-200 text-amber-900" },
        { label: "Card Total", value: latestSummary.card, sub: "POS / Visa", color: "bg-blue-50 border border-blue-200 text-blue-900" },
        { label: "Delivery Apps", value: (latestSummary.app1 ?? 0) + (latestSummary.app2 ?? 0) + (latestSummary.app3 ?? 0) + (latestSummary.app4 ?? 0) + (latestSummary.app5 ?? 0) + (latestSummary.app6 ?? 0), sub: "all apps combined", color: "bg-indigo-50 border border-indigo-200 text-indigo-900" },
      ]
    : [];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="Sales & Cash Management"
        description="Daily revenue tracking by payment channel with VAT handling and cash discrepancy control."
        action={
          <div className="flex gap-2 flex-wrap items-center">
            <div className="no-print flex gap-2 flex-wrap">
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="px-4 py-2 border rounded-xl shadow-sm focus:ring-primary/20 outline-none text-sm"
              />
              <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm">
                <FileSpreadsheet className="w-4 h-4" /> Export
              </button>
              <button
                onClick={() => setAddOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all text-sm"
              >
                <Plus className="w-4 h-4" /> Add Daily Record
              </button>
            </div>
            <PrintButton />
          </div>
        }
      />

      {/* KPI Summary Cards */}
      {kpiCards.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
          {kpiCards.map((k) => (
            <div key={k.label} className={`rounded-2xl p-4 ${k.color}`}>
              <p className="text-[10px] font-bold uppercase tracking-wide opacity-60 mb-1">{k.label}</p>
              <p className="text-lg font-extrabold tabular-nums">{formatSAR(k.value)}</p>
              <p className="text-[10px] mt-0.5 opacity-50">{k.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Cash Discrepancy Alert */}
      {hasDiscrepancy && tab === "dashboard" && (
        <div className="mb-4 flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-rose-700">Cash Discrepancy Detected</p>
            <p className="text-xs text-rose-600">One or more daily records have a mismatch between expected and actual closing balance. Review the Cash Management tab.</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-5 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${tab === t.id ? "bg-white shadow text-primary" : "text-slate-600 hover:text-slate-900"}`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Daily Records ── */}
      {tab === "dashboard" && (
        <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100 border-b text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  <th className="px-3 py-2 whitespace-nowrap">Date</th>
                  <th className="px-3 py-2 text-right">Cash</th>
                  <th className="px-3 py-2 text-right">Card</th>
                  <th className="px-3 py-2 text-right text-purple-600">Apps Total</th>
                  <th className="px-3 py-2 text-right font-extrabold text-slate-700">Total Revenue</th>
                  <th className="px-3 py-2 text-right text-purple-500">VAT</th>
                  <th className="px-3 py-2 text-right text-emerald-700">Net Sales</th>
                  <th className="px-3 py-2 text-right text-amber-600">Opening Bal</th>
                  <th className="px-3 py-2 text-right text-amber-600">Closing Bal</th>
                  <th className="px-3 py-2 text-right">Discrepancy</th>
                  <th className="px-3 py-2">Notes</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-700">
                {isLoading ? (
                  <tr><td colSpan={12} className="text-center py-10 text-slate-400">Loading...</td></tr>
                ) : sales.length === 0 ? (
                  <tr><td colSpan={12} className="text-center py-10 text-slate-400">No records — click "Add Daily Record" to start.</td></tr>
                ) : sales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3 font-semibold whitespace-nowrap">
                      <div>{formatDate(s.date)}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{s.vatMode === "inclusive" ? "VAT Incl." : "VAT Excl."}</div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatSAR(s.cash)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatSAR(s.card)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-purple-700">{formatSAR(appsTotal(s))}</td>
                    <td className="px-3 py-3 text-right tabular-nums font-bold text-slate-900">{formatSAR(s.totalRevenue)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-purple-600">{formatSAR(s.outputVat)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-emerald-700 font-semibold">{formatSAR(s.netSales)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-amber-700">{formatSAR(s.openingBalance)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-amber-700">{formatSAR(s.closingBalance)}</td>
                    <td className="px-3 py-3 text-right"><DiscrepancyBadge val={s.cashDiscrepancy} /></td>
                    <td className="px-3 py-3 max-w-[140px] truncate text-slate-500">{s.dailyNotes || "—"}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => setEditSale(s)} className="p-1.5 text-primary hover:bg-primary/10 rounded-lg" title="Edit">
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleDelete(s.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg" title="Delete">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {sales.length > 0 && (
                <tfoot className="border-t-2 border-slate-300 bg-slate-100 font-bold text-slate-800 text-xs">
                  <tr>
                    <td className="px-3 py-3 text-slate-500">{sales.length} records</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatSAR(sales.reduce((s, r) => s + r.cash, 0))}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatSAR(sales.reduce((s, r) => s + r.card, 0))}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-purple-700">{formatSAR(sales.reduce((s, r) => s + appsTotal(r), 0))}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-900">{formatSAR(sales.reduce((s, r) => s + r.totalRevenue, 0))}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-purple-600">{formatSAR(sales.reduce((s, r) => s + r.outputVat, 0))}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-emerald-700">{formatSAR(sales.reduce((s, r) => s + r.netSales, 0))}</td>
                    <td colSpan={3} />
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: Reports ── */}
      {tab === "reports" && (
        <div className="space-y-5">
          {/* Date range filter */}
          <div className="bg-card rounded-2xl border shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-4">Date Range Filter</h3>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs text-slate-500 mb-1">From</label>
                <input
                  type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)}
                  className="px-3 py-2 border rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">To</label>
                <input
                  type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)}
                  className="px-3 py-2 border rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <button
                onClick={() => setReportFetch(true)}
                className="px-5 py-2 bg-primary text-white rounded-xl text-sm hover:shadow-md"
              >
                Generate Report
              </button>
              {reportFetch && (
                <button
                  onClick={() => { setReportFetch(false); setReportFrom(""); setReportTo(""); }}
                  className="px-4 py-2 border rounded-xl text-sm text-slate-600 hover:bg-slate-100"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {reportFetch && (
            reportLoading ? (
              <div className="text-center py-10 text-slate-400">Generating report...</div>
            ) : reportData ? (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: "Total Revenue", value: reportData.totals.totalRevenue, color: "bg-slate-700 text-white" },
                    { label: "Net Sales", value: reportData.totals.netSales, color: "bg-emerald-50 border border-emerald-200 text-emerald-900" },
                    { label: "Output VAT", value: reportData.totals.outputVat, color: "bg-purple-50 border border-purple-200 text-purple-900" },
                    { label: "Cash Discrepancy", value: reportData.totals.cashDiscrepancy, color: Math.abs(reportData.totals.cashDiscrepancy) < 1 ? "bg-emerald-50 border border-emerald-200 text-emerald-900" : "bg-rose-50 border border-rose-200 text-rose-900" },
                  ].map((k) => (
                    <div key={k.label} className={`rounded-2xl p-4 ${k.color}`}>
                      <p className="text-[10px] font-bold uppercase tracking-wide opacity-60 mb-1">{k.label}</p>
                      <p className="text-xl font-extrabold tabular-nums">{formatSAR(k.value)}</p>
                      <p className="text-[10px] mt-0.5 opacity-50">{reportData.recordCount} days</p>
                    </div>
                  ))}
                </div>

                {/* Channel Breakdown */}
                <div className="bg-card rounded-2xl border shadow-sm p-5">
                  <h3 className="text-sm font-bold text-slate-700 mb-4">Channel Breakdown</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { label: "Cash", value: reportData.totals.cash, icon: "💵" },
                      { label: "Card / POS", value: reportData.totals.card, icon: "💳" },
                      { label: appNames.app1Name, value: reportData.totals.app1 ?? 0, icon: "📱" },
                      { label: appNames.app2Name, value: reportData.totals.app2 ?? 0, icon: "📱" },
                      { label: appNames.app3Name, value: reportData.totals.app3 ?? 0, icon: "📱" },
                      { label: appNames.app4Name, value: reportData.totals.app4 ?? 0, icon: "📱" },
                      { label: appNames.app5Name, value: reportData.totals.app5 ?? 0, icon: "📱" },
                      { label: appNames.app6Name, value: reportData.totals.app6 ?? 0, icon: "📱" },
                    ].map((ch) => (
                      <div key={ch.label} className="bg-slate-50 rounded-xl border p-3">
                        <div className="text-xs text-slate-500 mb-1">{ch.icon} {ch.label}</div>
                        <div className="font-bold tabular-nums">{formatSAR(ch.value)}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {reportData.totals.totalRevenue > 0
                            ? `${((ch.value / reportData.totals.totalRevenue) * 100).toFixed(1)}%`
                            : "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Daily Breakdown Table */}
                <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b bg-slate-50 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-700">Daily Breakdown</h3>
                    <button
                      onClick={() => {
                        const rows = (reportData.daily as typeof reportData.daily).map((d) => ({
                          "Date": d.date,
                          "Cash": d.cash,
                          "Card": d.card,
                          [appNames.app1Name]: d.app1,
                          [appNames.app2Name]: d.app2,
                          [appNames.app3Name]: d.app3,
                          [appNames.app4Name]: d.app4,
                          [appNames.app5Name]: d.app5,
                          [appNames.app6Name]: d.app6,
                          "Apps Total": d.appsTotal,
                          "Total Revenue": d.totalRevenue,
                          "Net Sales": d.netSales,
                          "Output VAT": d.outputVat,
                          "Cash Discrepancy": d.cashDiscrepancy,
                          "Notes": d.dailyNotes,
                        }));
                        exportToExcel(rows, `sales-report-${reportFrom}-${reportTo}`, "Sales Report");
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs hover:bg-emerald-700"
                    >
                      <FileSpreadsheet className="w-3 h-3" /> Export Excel
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 border-b text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2 text-right">Cash</th>
                          <th className="px-3 py-2 text-right">Card</th>
                          <th className="px-3 py-2 text-right text-purple-600">Apps</th>
                          <th className="px-3 py-2 text-right font-extrabold text-slate-700">Revenue</th>
                          <th className="px-3 py-2 text-right text-purple-500">VAT</th>
                          <th className="px-3 py-2 text-right text-emerald-700">Net Sales</th>
                          <th className="px-3 py-2 text-right">Discrepancy</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {(reportData.daily as typeof reportData.daily).map((d) => (
                          <tr key={d.date} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-semibold">{formatDate(d.date)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{formatSAR(d.cash)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{formatSAR(d.card)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-purple-700">{formatSAR(d.appsTotal)}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-bold">{formatSAR(d.totalRevenue)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-purple-600">{formatSAR(d.outputVat)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-emerald-700 font-semibold">{formatSAR(d.netSales)}</td>
                            <td className="px-3 py-2 text-right">
                              {Math.abs(d.cashDiscrepancy) < 0.01
                                ? <CheckCircle2 className="w-3 h-3 text-emerald-500 inline" />
                                : <span className={`font-bold ${d.cashDiscrepancy > 0 ? "text-blue-600" : "text-rose-600"}`}>
                                    {d.cashDiscrepancy > 0 ? "+" : ""}{formatSAR(d.cashDiscrepancy)}
                                  </span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : null
          )}

          {!reportFetch && (
            <div className="text-center py-12 text-slate-400">
              <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Select a date range and click "Generate Report"</p>
              <p className="text-xs mt-1">Get a full breakdown of cash, card, app sales, VAT, and cash discrepancies</p>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Cash Management ── */}
      {tab === "cash" && (
        <div className="space-y-5">
          <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-amber-50 border-b border-amber-200">
              <h3 className="font-bold text-amber-900">Cash Flow Summary — {month}</h3>
              <p className="text-xs text-amber-700 mt-0.5">Compare expected vs actual closing balance per day</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2 text-right">Opening</th>
                    <th className="px-3 py-2 text-right">Cash Sales</th>
                    <th className="px-3 py-2 text-right text-rose-500">Cash Expenses</th>
                    <th className="px-3 py-2 text-right text-amber-500">Petty Cash</th>
                    <th className="px-3 py-2 text-right text-blue-600">Expected Closing</th>
                    <th className="px-3 py-2 text-right text-slate-700">Actual Closing</th>
                    <th className="px-3 py-2 text-right font-bold">Discrepancy</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isLoading ? (
                    <tr><td colSpan={9} className="text-center py-8 text-slate-400">Loading...</td></tr>
                  ) : sales.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-8 text-slate-400">No cash records for {month}</td></tr>
                  ) : sales.map((s) => {
                    const ok = Math.abs(s.cashDiscrepancy) < 0.5;
                    const surplus = s.cashDiscrepancy > 0;
                    return (
                      <tr key={s.id} className={`hover:bg-slate-50 ${!ok ? (surplus ? "bg-blue-50/50" : "bg-rose-50/50") : ""}`}>
                        <td className="px-3 py-3 font-semibold">{formatDate(s.date)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{formatSAR(s.openingBalance)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-emerald-700">{formatSAR(s.cash)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-rose-600">{formatSAR(s.cashExpenses)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-amber-600">{formatSAR(s.pettyCash)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-blue-700 font-semibold">{formatSAR(s.expectedClosing)}</td>
                        <td className="px-3 py-3 text-right tabular-nums font-bold">{formatSAR(s.closingBalance)}</td>
                        <td className="px-3 py-3 text-right">
                          <span className={`font-bold ${ok ? "text-emerald-600" : surplus ? "text-blue-600" : "text-rose-600"}`}>
                            {s.cashDiscrepancy >= 0 ? "+" : ""}{formatSAR(s.cashDiscrepancy)}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {ok
                            ? <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium"><CheckCircle2 className="w-3 h-3" /> OK</span>
                            : <span className={`inline-flex items-center gap-1 text-xs font-medium ${surplus ? "text-blue-600" : "text-rose-600"}`}>
                                <AlertTriangle className="w-3 h-3" /> {surplus ? "Surplus" : "Shortage"}
                              </span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {sales.length > 0 && (
                  <tfoot className="border-t-2 border-slate-300 bg-slate-100 font-bold text-xs text-slate-800">
                    <tr>
                      <td className="px-3 py-3 text-slate-500">Total</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatSAR(sales.reduce((s, r) => s + r.openingBalance, 0))}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-emerald-700">{formatSAR(sales.reduce((s, r) => s + r.cash, 0))}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-rose-600">{formatSAR(sales.reduce((s, r) => s + r.cashExpenses, 0))}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-amber-600">{formatSAR(sales.reduce((s, r) => s + r.pettyCash, 0))}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-blue-700">{formatSAR(sales.reduce((s, r) => s + r.expectedClosing, 0))}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatSAR(sales.reduce((s, r) => s + r.closingBalance, 0))}</td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {(() => {
                          const total = sales.reduce((s, r) => s + r.cashDiscrepancy, 0);
                          return <span className={`font-bold ${Math.abs(total) < 1 ? "text-emerald-600" : total > 0 ? "text-blue-600" : "text-rose-600"}`}>
                            {total >= 0 ? "+" : ""}{formatSAR(total)}
                          </span>;
                        })()}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Settings ── */}
      {tab === "settings" && (
        <div className="max-w-xl">
          <div className="bg-card rounded-2xl border shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-slate-800">Delivery App Names</h3>
                <p className="text-xs text-slate-500 mt-0.5">Customize names for up to 6 delivery platforms</p>
              </div>
              <button
                onClick={() => setSettingsEdit(!settingsEdit)}
                className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm text-slate-600 hover:bg-slate-100"
              >
                {settingsEdit ? <X className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                {settingsEdit ? "Cancel" : "Edit"}
              </button>
            </div>

            <div className="space-y-4">
              {/* Default VAT Mode */}
              <div>
                <label className="block text-sm font-semibold mb-1.5">Default VAT Mode</label>
                {settingsEdit ? (
                  <select
                    value={settingsForm.defaultVatMode}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, defaultVatMode: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-white"
                  >
                    <option value="exclusive">Exclusive — Amounts entered without VAT (system adds 15%)</option>
                    <option value="inclusive">Inclusive — Amounts entered with VAT (system extracts it)</option>
                  </select>
                ) : (
                  <div className="px-3 py-2 bg-slate-50 border rounded-xl text-sm text-slate-700">
                    {settingsForm.defaultVatMode === "inclusive" ? "Inclusive (VAT included in amounts)" : "Exclusive (VAT added on top)"}
                  </div>
                )}
              </div>

              {/* App Names */}
              <div className="grid grid-cols-2 gap-3">
                {(["app1Name", "app2Name", "app3Name", "app4Name", "app5Name", "app6Name"] as const).map((k, i) => (
                  <div key={k}>
                    <label className="block text-xs text-slate-500 mb-1">App {i + 1}</label>
                    {settingsEdit ? (
                      <input
                        value={settingsForm[k]}
                        onChange={(e) => setSettingsForm((f) => ({ ...f, [k]: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        placeholder={`App ${i + 1}`}
                      />
                    ) : (
                      <div className="px-3 py-2 bg-slate-50 border rounded-xl text-sm text-slate-700">{settingsForm[k]}</div>
                    )}
                  </div>
                ))}
              </div>

              {settingsEdit && (
                <button
                  onClick={() => updateConfig.mutate({ data: settingsForm as Parameters<typeof updateConfig.mutate>[0]["data"] })}
                  disabled={updateConfig.isPending}
                  className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:shadow-md disabled:opacity-50"
                >
                  {updateConfig.isPending ? "Saving..." : "Save Settings"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      <SaleModal
        open={addOpen}
        title="Add Daily Sales Record"
        defaultValues={makeDefault(appNames.defaultVatMode)}
        appNames={appNames}
        onClose={() => setAddOpen(false)}
        onSubmit={handleCreate}
        isPending={create.isPending}
      />

      {/* Edit Modal */}
      {editSale && (
        <SaleModal
          open={true}
          title="Edit Sales Record"
          defaultValues={{
            date: editSale.date,
            vatMode: editSale.vatMode,
            cash: editSale.cash, card: editSale.card,
            app1: editSale.app1, app2: editSale.app2, app3: editSale.app3,
            app4: editSale.app4, app5: editSale.app5, app6: editSale.app6,
            openingBalance: editSale.openingBalance,
            cashExpenses: editSale.cashExpenses,
            pettyCash: editSale.pettyCash,
            closingBalance: editSale.closingBalance,
            dailyNotes: editSale.dailyNotes,
          }}
          appNames={appNames}
          onClose={() => setEditSale(null)}
          onSubmit={handleUpdate}
          isPending={update.isPending}
        />
      )}
    </div>
  );
}
