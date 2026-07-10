import { useState, useMemo } from "react";
import {
  useListFixedCostTemplates,
  useCreateFixedCostTemplate,
  useUpdateFixedCostTemplate,
  useDeleteFixedCostTemplate,
  useGetMonthlyFixedCosts,
  useBatchSaveMonthlyFixedCosts,
  useCloseMonth,
  useUnlockMonth,
  useGetFixedCostHistory,
  useGetFixedCostAuditLog,
  useCopyPrevMonthFixedCosts,
  useGetFixedCostYearSummary,
  useListExpenses,
} from "@workspace/api-client-react";
import type { FixedCostTemplate } from "@workspace/api-client-react";
import { useInvalidateFinancials } from "@/hooks/use-invalidate-financials";
import {
  getListFixedCostTemplatesQueryKey,
  getGetMonthlyFixedCostsQueryKey,
  getGetFixedCostHistoryQueryKey,
  getGetFixedCostAuditLogQueryKey,
  getGetFixedCostYearSummaryQueryKey,
} from "@workspace/api-client-react";
import { useExpenseMutations } from "@/hooks/use-expenses";
import { PageHeader } from "@/components/ui/PageHeader";
import { useLanguage } from "@/i18n/LanguageContext";
import { PrintButton } from "@/components/ui/PrintButton";
import { formatSAR } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from "recharts";
import {
  Plus, Trash2, Pencil, Lock, Unlock, ChevronLeft, ChevronRight,
  TrendingUp, Clock, FileText, Settings, Calendar, AlertTriangle,
  CheckCircle, Copy, Save, X, RotateCcw, ChevronDown, ChevronUp,
  BarChart2, Table2,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: "staff-salaries",     label: "Staff Salaries",      labelAr: "رواتب الموظفين",    color: "#3b82f6", bg: "bg-blue-50",    border: "border-blue-200",   text: "text-blue-700",    badge: "bg-blue-100 text-blue-700",    light: "bg-blue-500" },
  { key: "owner-drawings",     label: "Owner Drawings",      labelAr: "مسحوبات المالك",    color: "#8b5cf6", bg: "bg-purple-50",  border: "border-purple-200", text: "text-purple-700",  badge: "bg-purple-100 text-purple-700", light: "bg-purple-500" },
  { key: "apps-subscriptions", label: "Apps & Subscriptions",labelAr: "اشتراكات وتطبيقات",color: "#06b6d4", bg: "bg-cyan-50",    border: "border-cyan-200",   text: "text-cyan-700",    badge: "bg-cyan-100 text-cyan-700",    light: "bg-cyan-500" },
  { key: "rent",               label: "Rent",                labelAr: "الإيجار",           color: "#f59e0b", bg: "bg-amber-50",   border: "border-amber-200",  text: "text-amber-700",   badge: "bg-amber-100 text-amber-700",  light: "bg-amber-500" },
  { key: "utilities",          label: "Utilities",           labelAr: "المرافق",           color: "#10b981", bg: "bg-emerald-50", border: "border-emerald-200",text: "text-emerald-700", badge: "bg-emerald-100 text-emerald-700",light: "bg-emerald-500" },
  { key: "other-fixed",        label: "Other Fixed",         labelAr: "مصاريف ثابتة أخرى",color: "#6b7280", bg: "bg-slate-50",   border: "border-slate-200",  text: "text-slate-700",   badge: "bg-slate-100 text-slate-700",  light: "bg-slate-400" },
];
const getCat = (key: string) => CATEGORIES.find(c => c.key === key) ?? CATEGORIES[CATEGORIES.length - 1];

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function currentMonth() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}
function fmtMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return `${MONTH_NAMES[mo - 1]} ${y}`;
}
function shiftMonth(m: string, delta: number) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Month Navigator ──────────────────────────────────────────────────────────

function MonthNav({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const isCurrentMonth = month >= currentMonth();
  return (
    <div className="flex items-center gap-3">
      <button onClick={() => onChange(shiftMonth(month, -1))} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
        <ChevronLeft className="w-5 h-5" />
      </button>
      <div className="text-center min-w-[160px]">
        <p className="text-xl font-bold text-slate-900">{fmtMonth(month)}</p>
        <p className="text-xs text-slate-400">{month}</p>
      </div>
      <button
        onClick={() => onChange(shiftMonth(month, 1))}
        disabled={isCurrentMonth}
        className="p-2 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}

// ─── Template Form Modal ──────────────────────────────────────────────────────

function TemplateModal({ mode, template, onClose }: { mode: "add" | "edit"; template?: FixedCostTemplate; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const invalidateFinancials = useInvalidateFinancials();
  const createTpl = useCreateFixedCostTemplate();
  const updateTpl = useUpdateFixedCostTemplate();

  const [form, setForm] = useState({
    category:      template?.category ?? "rent",
    name:          template?.name ?? "",
    defaultAmount: String(template?.defaultAmount ?? ""),
    notes:         template?.notes ?? "",
    vatType:       template?.vatType ?? "none",
    vatRate:       String(template?.vatRate ?? "15"),
  });

  const vatPreview = (() => {
    const amt = parseFloat(form.defaultAmount) || 0;
    const rate = (parseFloat(form.vatRate) || 15) / 100;
    if (form.vatType === "none" || !amt) return null;
    if (form.vatType === "included") {
      const base = +(amt / (1 + rate)).toFixed(2);
      return { base, vat: +(amt - base).toFixed(2), total: amt };
    }
    const vat = +(amt * rate).toFixed(2);
    return { base: amt, vat, total: +(amt + vat).toFixed(2) };
  })();

  async function handleSubmit() {
    if (!form.name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    const amt = parseFloat(form.defaultAmount);
    if (isNaN(amt) || amt < 0) { toast({ title: "Invalid amount", variant: "destructive" }); return; }
    const vatRate = parseFloat(form.vatRate) || 15;
    try {
      if (mode === "edit" && template) {
        await updateTpl.mutateAsync({ id: template.id, data: { category: form.category, name: form.name, defaultAmount: amt, notes: form.notes || null, vatType: form.vatType, vatRate } });
        toast({ title: "Updated successfully" });
      } else {
        await createTpl.mutateAsync({ data: { category: form.category, name: form.name, defaultAmount: amt, notes: form.notes || null, vatType: form.vatType, vatRate } });
        toast({ title: "Cost item added" });
      }
      await qc.invalidateQueries({ queryKey: getListFixedCostTemplatesQueryKey() });
      await qc.invalidateQueries({ queryKey: getGetFixedCostHistoryQueryKey() });
      invalidateFinancials(); // refresh P&L / VAT / dashboard live
      onClose();
    } catch { toast({ title: "Failed to save", variant: "destructive" }); }
  }

  const catMeta = getCat(form.category);
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
        <div className={`p-5 border-b flex items-center justify-between ${catMeta.bg}`}>
          <h2 className="text-lg font-bold">{mode === "add" ? "Add Cost Item" : "Edit Cost Item"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/60 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1.5">Category</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(c => (
                <button
                  key={c.key}
                  onClick={() => setForm(f => ({ ...f, category: c.key }))}
                  className={`text-left px-3 py-2 rounded-xl border-2 text-xs font-semibold transition-all ${
                    form.category === c.key ? `${c.badge} border-current` : "border-transparent bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <div>{c.label}</div>
                  <div className="opacity-60 font-normal mt-0.5">{c.labelAr}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">Name / Description *</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Main Branch Rent, Monthly Salaries..."
              className="w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:border-primary" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">Reference / Default Amount (SAR)</label>
            <input type="number" min="0" step="0.01" value={form.defaultAmount} onChange={e => setForm(f => ({ ...f, defaultAmount: e.target.value }))}
              placeholder="0.00"
              className="w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:border-primary" />
            <p className="text-xs text-slate-400 mt-1">Used as a starting point when entering new months — can be changed for each month</p>
          </div>

          {/* VAT Type */}
          <div>
            <label className="block text-sm font-semibold mb-1.5">VAT Treatment <span className="text-slate-400 font-normal">(الضريبة)</span></label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: "none",     label: "No VAT",        labelAr: "بدون ضريبة",      desc: "Amount is final cost" },
                { key: "included", label: "VAT Included",  labelAr: "الضريبة مشمولة",  desc: "Extract VAT from total" },
                { key: "excluded", label: "VAT Excluded",  labelAr: "الضريبة تُضاف",   desc: "Add VAT on top" },
              ] as const).map(v => (
                <button key={v.key} type="button"
                  onClick={() => setForm(f => ({ ...f, vatType: v.key }))}
                  className={`text-left px-3 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all ${
                    form.vatType === v.key
                      ? "bg-primary text-white border-primary"
                      : "border-transparent bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <div>{v.label}</div>
                  <div className={`font-normal mt-0.5 ${form.vatType === v.key ? "opacity-80" : "opacity-50"}`}>{v.labelAr}</div>
                </button>
              ))}
            </div>
            {form.vatType !== "none" && (
              <div className="mt-2 flex items-center gap-2">
                <label className="text-xs text-slate-500 shrink-0">VAT Rate (%)</label>
                <input type="number" min="0" max="100" step="0.5" value={form.vatRate}
                  onChange={e => setForm(f => ({ ...f, vatRate: e.target.value }))}
                  className="w-24 px-2 py-1.5 border rounded-lg text-xs text-center focus:outline-none focus:border-primary" />
                {vatPreview && (
                  <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 text-xs text-emerald-700 space-y-0.5">
                    <div className="flex justify-between"><span>Base (net):</span><span className="font-bold">{vatPreview.base.toFixed(2)} SAR</span></div>
                    <div className="flex justify-between"><span>VAT ({form.vatRate}%):</span><span className="font-bold">{vatPreview.vat.toFixed(2)} SAR</span></div>
                    <div className="flex justify-between border-t border-emerald-200 pt-0.5 mt-0.5"><span>Total (gross):</span><span className="font-extrabold">{vatPreview.total.toFixed(2)} SAR</span></div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">Notes (optional)</label>
            <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Contract ref, billing cycle, etc."
              className="w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:border-primary" />
          </div>
          <div className="flex gap-2 pt-2 border-t">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
            <button onClick={handleSubmit} disabled={createTpl.isPending || updateTpl.isPending}
              className="flex-1 py-2.5 text-sm font-semibold bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-60">
              {(createTpl.isPending || updateTpl.isPending) ? "Saving..." : mode === "add" ? "Add Item" : "Update Item"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Monthly Entry Tab ────────────────────────────────────────────────────────

type EditRow = { templateId: number; amount: string; notes: string };

function MonthlyEntryTab({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const invalidateFinancials = useInvalidateFinancials();
  const { data: monthData, isLoading } = useGetMonthlyFixedCosts({ month });
  const batchSave = useBatchSaveMonthlyFixedCosts();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const copyPrev = useCopyPrevMonthFixedCosts({ month }, { query: { enabled: false } as any });
  const closeMonth = useCloseMonth();
  const unlockMonth = useUnlockMonth();

  const [editMode, setEditMode] = useState(false);
  const [editRows, setEditRows] = useState<EditRow[]>([]);
  const [savingBatch, setSavingBatch] = useState(false);

  const isLocked = monthData?.isLocked ?? false;
  const items = monthData?.items ?? [];

  // Grouped items for display
  const grouped = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const it of items) {
      if (!map.has(it.category)) map.set(it.category, []);
      map.get(it.category)!.push(it);
    }
    return CATEGORIES.map(cat => ({
      cat,
      items: map.get(cat.key) ?? [],
      subtotal: (map.get(cat.key) ?? []).reduce((s, i) => s + i.effectiveAmount, 0),
    })).filter(g => g.items.length > 0);
  }, [items]);

  // Enter edit mode: initialize rows from current month data
  function enterEditMode() {
    setEditRows(items.map(it => ({
      templateId: it.templateId,
      amount: String(it.effectiveAmount),
      notes: it.overrideNotes ?? "",
    })));
    setEditMode(true);
  }

  function cancelEdit() {
    setEditMode(false);
    setEditRows([]);
  }

  function setRowAmount(templateId: number, val: string) {
    setEditRows(rows => rows.map(r => r.templateId === templateId ? { ...r, amount: val } : r));
  }
  function setRowNotes(templateId: number, val: string) {
    setEditRows(rows => rows.map(r => r.templateId === templateId ? { ...r, notes: val } : r));
  }

  // Copy from previous month
  async function handleCopyPrev() {
    try {
      const result = await copyPrev.refetch();
      if (result.data) {
        const data = result.data as { sourceMonth: string; items: { templateId: number; suggestedAmount: number; source: string }[] };
        setEditRows(rows => rows.map(r => {
          const found = data.items.find(i => i.templateId === r.templateId);
          return found ? { ...r, amount: String(found.suggestedAmount) } : r;
        }));
        toast({ title: `Copied from ${fmtMonth(data.sourceMonth)}` });
      }
    } catch { toast({ title: "Could not load previous month", variant: "destructive" }); }
  }

  // Fill from template defaults
  function fillFromDefaults() {
    setEditRows(rows => rows.map(r => {
      const item = items.find(i => i.templateId === r.templateId);
      return item ? { ...r, amount: String(item.defaultAmount) } : r;
    }));
    toast({ title: "Filled from default reference amounts" });
  }

  // Clear all to zero
  function clearAll() {
    setEditRows(rows => rows.map(r => ({ ...r, amount: "0", notes: "" })));
  }

  // Save batch
  async function handleSave() {
    setSavingBatch(true);
    try {
      const payload = editRows.map(r => ({
        templateId: r.templateId,
        amount: parseFloat(r.amount) || 0,
        notes: r.notes || null,
      }));
      await batchSave.mutateAsync({ data: { month, items: payload } });
      await qc.invalidateQueries({ queryKey: getGetMonthlyFixedCostsQueryKey({ month }) });
      await qc.invalidateQueries({ queryKey: getGetFixedCostHistoryQueryKey() });
      await qc.invalidateQueries({ queryKey: getGetFixedCostAuditLogQueryKey() });
      await qc.invalidateQueries({ queryKey: getGetFixedCostYearSummaryQueryKey({}) });
      invalidateFinancials();
      setEditMode(false);
      setEditRows([]);
      toast({ title: `${fmtMonth(month)} costs saved`, description: `${payload.length} items updated` });
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error ?? "Failed to save";
      toast({ title: msg, variant: "destructive" });
    } finally { setSavingBatch(false); }
  }

  // Lock / Unlock month
  async function handleToggleLock() {
    if (isLocked) {
      if (!confirm(`Unlock ${fmtMonth(month)}? This allows editing costs for this month.`)) return;
      await unlockMonth.mutateAsync({ data: { month } });
      await qc.invalidateQueries({ queryKey: getGetMonthlyFixedCostsQueryKey({ month }) });
      await qc.invalidateQueries({ queryKey: getGetFixedCostAuditLogQueryKey() });
      invalidateFinancials();
      toast({ title: `${fmtMonth(month)} unlocked` });
    } else {
      if (!confirm(`Lock ${fmtMonth(month)}? This will prevent any edits to this period.`)) return;
      await closeMonth.mutateAsync({ data: { month } });
      await qc.invalidateQueries({ queryKey: getGetMonthlyFixedCostsQueryKey({ month }) });
      await qc.invalidateQueries({ queryKey: getGetFixedCostAuditLogQueryKey() });
      invalidateFinancials();
      toast({ title: `${fmtMonth(month)} locked` });
    }
  }

  // Total for edit mode
  const editTotal = useMemo(() =>
    editRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0),
    [editRows]
  );

  if (isLoading) return <div className="text-center py-16 text-slate-400">Loading...</div>;

  if (items.length === 0) {
    return (
      <div>
        <div className="flex justify-center mb-6"><MonthNav month={month} onChange={setMonth} /></div>
        <div className="text-center py-16 border-2 border-dashed rounded-2xl text-slate-400">
          <Settings className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-semibold text-slate-600">No cost items configured</p>
          <p className="text-sm mt-1">Go to the Templates tab to add your cost items first.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <MonthNav month={month} onChange={m => { cancelEdit(); setMonth(m); }} />
        <div className="flex items-center gap-2">
          {isLocked ? (
            <span className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 text-rose-700 px-3 py-1.5 rounded-xl text-xs font-semibold">
              <Lock className="w-3.5 h-3.5" /> Locked{monthData?.lockedBy ? ` by ${monthData.lockedBy}` : ""}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-xl text-xs font-semibold">
              <CheckCircle className="w-3.5 h-3.5" /> Open
            </span>
          )}
          <button onClick={handleToggleLock} disabled={closeMonth.isPending || unlockMonth.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border hover:bg-slate-50 transition-colors disabled:opacity-60">
            {isLocked ? <><Unlock className="w-3.5 h-3.5" /> Unlock</> : <><Lock className="w-3.5 h-3.5" /> Lock Month</>}
          </button>
          {!editMode && !isLocked && (
            <button onClick={enterEditMode}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors">
              <Pencil className="w-3.5 h-3.5" /> Edit {fmtMonth(month)}
            </button>
          )}
        </div>
      </div>

      {/* Summary bar */}
      <div className="bg-white border rounded-2xl px-5 py-4 mb-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Total — {fmtMonth(month)}</p>
            <p className="text-3xl font-extrabold text-slate-900">
              {editMode ? formatSAR(editTotal) : formatSAR(monthData?.totalGross ?? monthData?.total ?? 0)}
            </p>
            {editMode && Math.abs(editTotal - (monthData?.total ?? 0)) > 0.01 && (
              <p className="text-xs mt-1">
                <span className={editTotal > (monthData?.total ?? 0) ? "text-rose-600" : "text-emerald-600"}>
                  {editTotal > (monthData?.total ?? 0) ? "▲" : "▼"} {formatSAR(Math.abs(editTotal - (monthData?.total ?? 0)))} vs current
                </span>
              </p>
            )}
          </div>
          {/* Category breakdown pills */}
          <div className="flex flex-wrap gap-2 justify-end max-w-[55%]">
            {grouped.map(({ cat, subtotal }) => (
              <div key={cat.key} className={`px-3 py-1 rounded-full text-xs font-semibold ${cat.badge}`}>
                {cat.label}: {formatSAR(subtotal)}
              </div>
            ))}
          </div>
        </div>
        {/* VAT Summary (only shown when any items have VAT) */}
        {!editMode && (monthData?.totalVat ?? 0) > 0 && (
          <div className="mt-3 pt-3 border-t flex gap-4 text-xs">
            <div className="flex-1 flex justify-between items-center bg-slate-50 rounded-lg px-3 py-2">
              <span className="text-slate-500 font-medium">Net (excl. VAT)</span>
              <span className="font-bold text-slate-800">{formatSAR(monthData?.totalBase ?? 0)}</span>
            </div>
            <div className="flex-1 flex justify-between items-center bg-emerald-50 rounded-lg px-3 py-2">
              <span className="text-emerald-600 font-medium">VAT (Input)</span>
              <span className="font-bold text-emerald-700">{formatSAR(monthData?.totalVat ?? 0)}</span>
            </div>
            <div className="flex-1 flex justify-between items-center bg-slate-800 rounded-lg px-3 py-2">
              <span className="text-slate-300 font-medium">Total (incl. VAT)</span>
              <span className="font-bold text-white">{formatSAR(monthData?.totalGross ?? 0)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Edit Mode Controls */}
      {editMode && (
        <div className="flex items-center gap-2 mb-4 flex-wrap bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <span className="text-xs font-semibold text-amber-700 mr-2">Editing {fmtMonth(month)}:</span>
          <button onClick={handleCopyPrev} disabled={copyPrev.isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-300 text-amber-700 rounded-lg text-xs font-semibold hover:bg-amber-50 transition-colors disabled:opacity-60">
            <Copy className="w-3.5 h-3.5" /> {copyPrev.isFetching ? "Loading..." : "Copy Last Month"}
          </button>
          <button onClick={fillFromDefaults}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors">
            <RotateCcw className="w-3.5 h-3.5" /> Fill from Defaults
          </button>
          <button onClick={clearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors">
            <X className="w-3.5 h-3.5" /> Clear All
          </button>
          <div className="flex-1" />
          <button onClick={cancelEdit}
            className="px-4 py-1.5 text-xs text-slate-600 hover:bg-white rounded-lg border transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={savingBatch}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition-colors">
            <Save className="w-3.5 h-3.5" /> {savingBatch ? "Saving..." : "Save All"}
          </button>
        </div>
      )}

      {/* Category sections */}
      <div className="space-y-3">
        {editMode ? (
          // ── Edit mode: all items as inputs grouped by category ──
          CATEGORIES.map(cat => {
            const catRows = editRows.filter(r =>
              items.find(i => i.templateId === r.templateId && i.category === cat.key)
            );
            if (catRows.length === 0) return null;
            const catTotal = catRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
            return (
              <div key={cat.key} className={`border rounded-2xl overflow-hidden ${cat.border}`}>
                <div className={`flex items-center justify-between px-5 py-3 ${cat.bg}`}>
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-wide ${cat.text}`}>{cat.label}</p>
                    <p className="text-xs text-slate-500">{cat.labelAr}</p>
                  </div>
                  <p className={`text-lg font-extrabold ${cat.text}`}>{formatSAR(catTotal)}</p>
                </div>
                <div className="divide-y bg-white">
                  {catRows.map(row => {
                    const item = items.find(i => i.templateId === row.templateId)!;
                    return (
                      <div key={row.templateId} className="px-5 py-3">
                        <div className="flex items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                            {item.defaultAmount > 0 && (
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                Reference: {formatSAR(item.defaultAmount)}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">SAR</span>
                              <input
                                type="number" min="0" step="0.01"
                                value={row.amount}
                                onChange={e => setRowAmount(row.templateId, e.target.value)}
                                className="w-36 pl-11 pr-3 py-2 border rounded-xl text-sm text-right font-semibold focus:outline-none focus:border-primary"
                              />
                            </div>
                            <input
                              type="text"
                              value={row.notes}
                              onChange={e => setRowNotes(row.templateId, e.target.value)}
                              placeholder="Notes..."
                              className="w-40 px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-primary text-slate-600"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        ) : (
          // ── View mode: category cards with amounts ──
          grouped.map(({ cat, items: catItems, subtotal }) => (
            <div key={cat.key} className={`border rounded-2xl overflow-hidden ${cat.border}`}>
              <div className={`flex items-center justify-between px-5 py-3 ${cat.bg}`}>
                <div>
                  <p className={`text-xs font-bold uppercase tracking-wide ${cat.text}`}>{cat.label}</p>
                  <p className="text-xs text-slate-500">{cat.labelAr}</p>
                </div>
                <p className={`text-xl font-extrabold ${cat.text}`}>{formatSAR(subtotal)}</p>
              </div>
              <div className="divide-y bg-white">
                {catItems.map(item => (
                  <div key={item.templateId} className="flex items-center justify-between px-5 py-3.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                        {item.vatType && item.vatType !== "none" && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 shrink-0">
                            VAT {item.vatType === "included" ? "incl." : "excl."}
                          </span>
                        )}
                      </div>
                      {item.overrideNotes && (
                        <p className="text-xs text-slate-400 mt-0.5">{item.overrideNotes}</p>
                      )}
                      {item.vatType && item.vatType !== "none" && item.vatAmount > 0 && (
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Net: {formatSAR(item.baseAmount)} + VAT: {formatSAR(item.vatAmount)}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className={`text-base font-bold ${item.hasOverride ? cat.text : "text-slate-900"}`}>
                        {item.vatType && item.vatType !== "none" ? formatSAR(item.totalAmount) : formatSAR(item.effectiveAmount)}
                      </p>
                      {item.vatType && item.vatType !== "none" && (
                        <p className="text-[10px] text-slate-400">incl. VAT</p>
                      )}
                      {item.hasOverride && item.effectiveAmount !== item.defaultAmount && (
                        <p className="text-[10px] text-slate-400">ref: {formatSAR(item.defaultAmount)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {!editMode && !isLocked && items.length > 0 && (
        <button onClick={enterEditMode}
          className="mt-4 w-full py-3 border-2 border-dashed border-primary/30 text-primary text-sm font-semibold rounded-2xl hover:bg-primary/5 transition-colors flex items-center justify-center gap-2">
          <Pencil className="w-4 h-4" /> Edit amounts for {fmtMonth(month)}
        </button>
      )}
    </div>
  );
}

// ─── Templates Tab ────────────────────────────────────────────────────────────

function TemplatesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const invalidateFinancials = useInvalidateFinancials();
  const { data: templates = [], isLoading } = useListFixedCostTemplates();
  const deleteTpl = useDeleteFixedCostTemplate();
  const [modal, setModal] = useState<{ mode: "add" | "edit"; template?: FixedCostTemplate } | null>(null);

  async function handleDelete(t: FixedCostTemplate) {
    if (!confirm(`Delete "${t.name}"? Monthly data saved for this item will also be removed.`)) return;
    await deleteTpl.mutateAsync({ id: t.id });
    await qc.invalidateQueries({ queryKey: getListFixedCostTemplatesQueryKey() });
    invalidateFinancials();
    toast({ title: "Item deleted" });
  }

  const grouped = useMemo(() => {
    const map = new Map<string, FixedCostTemplate[]>();
    for (const t of templates) {
      if (!map.has(t.category)) map.set(t.category, []);
      map.get(t.category)!.push(t);
    }
    return CATEGORIES.map(cat => ({
      cat,
      items: map.get(cat.key) ?? [],
      subtotal: (map.get(cat.key) ?? []).reduce((s, t) => s + t.defaultAmount, 0),
    }));
  }, [templates]);

  const grandTotal = templates.reduce((s, t) => s + t.defaultAmount, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm text-slate-600 font-medium">Define your fixed cost items by category.</p>
          <p className="text-xs text-slate-400 mt-0.5">The reference amount is a starting point — you set the actual amount for each month.</p>
        </div>
        <button onClick={() => setModal({ mode: "add" })}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl shadow text-sm font-semibold hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Add Cost Item
        </button>
      </div>

      {templates.length > 0 && (
        <div className="bg-slate-800 text-white rounded-2xl px-5 py-4 mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-semibold opacity-60">Reference Monthly Total</p>
            <p className="text-2xl font-extrabold mt-0.5">{formatSAR(grandTotal)}</p>
          </div>
          <p className="text-sm opacity-40">{templates.length} items across {grouped.filter(g => g.items.length > 0).length} categories</p>
        </div>
      )}

      {isLoading ? (
        <p className="text-center text-slate-400 py-10">Loading...</p>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-2xl text-slate-400">
          <Settings className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-semibold text-slate-600">No items yet</p>
          <button onClick={() => setModal({ mode: "add" })}
            className="mt-3 flex items-center gap-1 px-4 py-2 bg-primary text-white rounded-xl mx-auto text-sm">
            <Plus className="w-4 h-4" /> Add First Item
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.filter(g => g.items.length > 0).map(({ cat, items, subtotal }) => (
            <div key={cat.key} className={`border rounded-2xl overflow-hidden ${cat.border}`}>
              <div className={`flex items-center justify-between px-5 py-3 ${cat.bg}`}>
                <p className={`text-sm font-bold ${cat.text}`}>{cat.label} — {cat.labelAr}</p>
                <p className={`font-bold ${cat.text}`}>{formatSAR(subtotal)}</p>
              </div>
              <div className="divide-y bg-white">
                {items.map(t => (
                  <div key={t.id} className="flex items-center justify-between px-5 py-3.5 group hover:bg-slate-50">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-800">{t.name}</p>
                        {t.vatType && t.vatType !== "none" && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 shrink-0">
                            VAT {t.vatType === "included" ? "incl." : "excl."} {t.vatRate}%
                          </span>
                        )}
                      </div>
                      {t.notes && <p className="text-xs text-slate-400">{t.notes}</p>}
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900">{formatSAR(t.defaultAmount)}</p>
                        <p className="text-[10px] text-slate-400">reference / month</p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setModal({ mode: "edit", template: t })}
                          className="p-1.5 text-primary hover:bg-primary/10 rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(t)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && <TemplateModal mode={modal.mode} template={modal.template} onClose={() => setModal(null)} />}
    </div>
  );
}

// ─── Trends & Charts Tab ──────────────────────────────────────────────────────

function ChartsTab() {
  const { data: history = [], isLoading } = useGetFixedCostHistory({ months: 12 });

  const chartData = useMemo(() =>
    history.map(h => ({
      month: fmtMonth(h.month).split(" ")[0].slice(0, 3),
      fullMonth: fmtMonth(h.month),
      total: h.total,
      ...h.breakdown,
    })), [history]);

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    history.forEach(h => Object.keys(h.breakdown).forEach(k => cats.add(k)));
    return CATEGORIES.filter(c => cats.has(c.key));
  }, [history]);

  if (isLoading) return <p className="text-center text-slate-400 py-16">Loading charts...</p>;
  if (history.length === 0) return (
    <div className="text-center py-16 border-2 border-dashed rounded-2xl text-slate-400">
      <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p>No data yet. Add templates and enter monthly costs to see trends.</p>
    </div>
  );

  const maxVal = Math.max(...chartData.map(d => d.total));

  return (
    <div className="space-y-6">
      {/* Trend Line */}
      <div className="bg-white border rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" /> Monthly Total — Last 12 Months
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
            <Tooltip formatter={(v: number) => [formatSAR(v), "Total"]} />
            <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4, fill: "#3b82f6" }} name="Total" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Stacked Bar by Category */}
      <div className="bg-white border rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-purple-500" /> Category Breakdown — Stacked
        </h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
            <Tooltip formatter={(v: number, name: string) => [formatSAR(v), getCat(name).label]} />
            <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => getCat(v).label} />
            {allCategories.map(cat => (
              <Bar key={cat.key} dataKey={cat.key} stackId="a" fill={cat.color} name={cat.key} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Horizontal Mini-bars table */}
      <div className="bg-white border rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
          <Table2 className="w-4 h-4 text-amber-500" /> Monthly Overview
        </h3>
        <div className="space-y-2">
          {[...history].reverse().map(h => {
            const pct = maxVal > 0 ? (h.total / maxVal) * 100 : 0;
            return (
              <div key={h.month} className="flex items-center gap-3">
                <div className="w-24 text-xs font-semibold text-slate-600 shrink-0">{fmtMonth(h.month).split(" ")[0].slice(0, 3) + " " + h.month.split("-")[0]}</div>
                <div className="flex-1 h-6 bg-slate-100 rounded-lg overflow-hidden relative">
                  <div className="h-full bg-blue-500 rounded-lg transition-all" style={{ width: `${pct}%` }} />
                  <span className="absolute inset-0 flex items-center px-2 text-xs font-bold text-slate-700">
                    {formatSAR(h.total)}
                  </span>
                </div>
                {h.isLocked && <Lock className="w-3 h-3 text-rose-400 shrink-0" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Year Comparison Tab ──────────────────────────────────────────────────────

function YearComparisonTab() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: yearData, isLoading } = useGetFixedCostYearSummary({ year }, { query: {} as any });
  const [showAll, setShowAll] = useState(false);

  const templates = (yearData as { templates?: { id: number; name: string; category: string }[] })?.templates ?? [];
  const months = (yearData as { months?: { month: string; total: number; byTemplate: Record<number, number>; hasData: boolean; isLocked: boolean }[] })?.months ?? [];
  const yearTotal = (yearData as { yearTotal?: number })?.yearTotal ?? 0;

  const displayedTemplates = showAll ? templates : templates.slice(0, 10);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setYear(y => y - 1)} className="p-2 hover:bg-slate-100 rounded-xl"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-xl font-bold w-16 text-center">{year}</span>
          <button onClick={() => setYear(y => y + 1)} disabled={year >= currentYear}
            className="p-2 hover:bg-slate-100 rounded-xl disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
        </div>
        {yearTotal > 0 && (
          <div className="text-right">
            <p className="text-xs text-slate-400">Annual Total</p>
            <p className="text-2xl font-extrabold text-slate-900">{formatSAR(yearTotal)}</p>
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="text-center text-slate-400 py-10">Loading...</p>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-2xl text-slate-400">
          <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No cost items configured yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="text-left px-4 py-3 font-semibold rounded-tl-xl sticky left-0 bg-slate-800 z-10 min-w-[140px]">Cost Item</th>
                {months.map(m => (
                  <th key={m.month} className={`text-right px-3 py-3 font-semibold min-w-[80px] whitespace-nowrap ${m.month === currentMonth() ? "text-amber-300" : ""}`}>
                    {MONTH_NAMES[parseInt(m.month.split("-")[1]) - 1].slice(0, 3)}
                    {m.isLocked && <Lock className="w-2.5 h-2.5 inline ml-0.5 opacity-60" />}
                  </th>
                ))}
                <th className="text-right px-4 py-3 font-semibold rounded-tr-xl">Total</th>
              </tr>
            </thead>
            <tbody>
              {/* Category subtotals */}
              {CATEGORIES.map(cat => {
                const catTemplates = displayedTemplates.filter(t => t.category === cat.key);
                if (catTemplates.length === 0) return null;
                const catMonthTotals = months.map(m =>
                  catTemplates.reduce((s, t) => s + (m.byTemplate[t.id] ?? 0), 0)
                );
                const catYearTotal = catMonthTotals.reduce((s, v) => s + v, 0);

                return [
                  // Category header row
                  <tr key={`cat-${cat.key}`} className={`${cat.bg}`}>
                    <td className={`px-4 py-2 font-bold ${cat.text} sticky left-0 ${cat.bg} z-10`}>
                      {cat.label}
                    </td>
                    {catMonthTotals.map((total, i) => (
                      <td key={i} className={`text-right px-3 py-2 font-bold ${cat.text}`}>
                        {total > 0 ? formatSAR(total) : <span className="opacity-30">—</span>}
                      </td>
                    ))}
                    <td className={`text-right px-4 py-2 font-bold ${cat.text}`}>{formatSAR(catYearTotal)}</td>
                  </tr>,
                  // Item rows
                  ...catTemplates.map(t => {
                    const rowTotal = months.reduce((s, m) => s + (m.byTemplate[t.id] ?? 0), 0);
                    return (
                      <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-2.5 text-slate-700 pl-8 sticky left-0 bg-white hover:bg-slate-50 z-10">{t.name}</td>
                        {months.map(m => {
                          const val = m.byTemplate[t.id] ?? 0;
                          return (
                            <td key={m.month} className={`text-right px-3 py-2.5 ${m.hasData ? "text-slate-800 font-medium" : "text-slate-400"} ${m.month === currentMonth() ? "bg-amber-50" : ""}`}>
                              {val > 0 ? formatSAR(val) : <span className="opacity-30">—</span>}
                            </td>
                          );
                        })}
                        <td className="text-right px-4 py-2.5 font-bold text-slate-900">{rowTotal > 0 ? formatSAR(rowTotal) : "—"}</td>
                      </tr>
                    );
                  }),
                ];
              })}

              {/* Show more / Show less toggle */}
              {templates.length > 10 && (
                <tr>
                  <td colSpan={14} className="px-4 py-2 text-center">
                    <button onClick={() => setShowAll(s => !s)}
                      className="text-xs text-primary hover:underline flex items-center gap-1 mx-auto">
                      {showAll ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Show all {templates.length} items</>}
                    </button>
                  </td>
                </tr>
              )}

              {/* Grand total row */}
              <tr className="bg-slate-800 text-white font-bold">
                <td className="px-4 py-3 rounded-bl-xl sticky left-0 bg-slate-800 z-10">Monthly Total</td>
                {months.map(m => (
                  <td key={m.month} className={`text-right px-3 py-3 ${m.month === currentMonth() ? "text-amber-300" : ""}`}>
                    {formatSAR(m.total)}
                  </td>
                ))}
                <td className="text-right px-4 py-3 rounded-br-xl">{formatSAR(yearTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Audit Log Tab ────────────────────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  set_monthly:      "bg-emerald-100 text-emerald-700",
  update_monthly:   "bg-blue-100 text-blue-700",
  create_template:  "bg-emerald-100 text-emerald-700",
  update_default:   "bg-blue-100 text-blue-700",
  delete_template:  "bg-rose-100 text-rose-700",
  set_override:     "bg-amber-100 text-amber-700",
  update_override:  "bg-amber-100 text-amber-700",
  remove_override:  "bg-slate-100 text-slate-700",
  lock_month:       "bg-rose-100 text-rose-700",
  unlock_month:     "bg-emerald-100 text-emerald-700",
};
const ACTION_LABELS: Record<string, string> = {
  set_monthly:     "Entry Added",
  update_monthly:  "Entry Updated",
  create_template: "Item Created",
  update_default:  "Reference Updated",
  delete_template: "Item Deleted",
  set_override:    "Amount Set",
  update_override: "Amount Updated",
  remove_override: "Reset to Ref",
  lock_month:      "Month Locked",
  unlock_month:    "Month Unlocked",
};

function AuditLogTab() {
  const { data: logs = [], isLoading } = useGetFixedCostAuditLog({ limit: 300 });
  const [filterMonth, setFilterMonth] = useState("");

  const filtered = filterMonth
    ? logs.filter(l => l.month === filterMonth)
    : logs;

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <Clock className="w-4 h-4 text-slate-400" />
        <p className="text-sm text-slate-500">Complete history of all changes to fixed costs entries.</p>
        <div className="flex-1" />
        <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
          className="px-3 py-1.5 border rounded-xl text-sm focus:outline-none focus:border-primary" />
        {filterMonth && <button onClick={() => setFilterMonth("")} className="text-xs text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>}
      </div>

      {isLoading ? (
        <p className="text-center text-slate-400 py-10">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-2xl text-slate-400">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No entries found.</p>
        </div>
      ) : (
        <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Action</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Item</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Month</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Before</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">After</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Change</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">When</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(l => {
                const color = ACTION_COLORS[l.action] ?? "bg-slate-100 text-slate-700";
                const label = ACTION_LABELS[l.action] ?? l.action;
                const change = l.newAmount != null && l.oldAmount != null ? l.newAmount - l.oldAmount : null;
                return (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${color}`}>{label}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{l.templateName ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {l.month ? <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{fmtMonth(l.month)}</span> : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400">
                      {l.oldAmount != null ? formatSAR(l.oldAmount) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {l.newAmount != null ? formatSAR(l.newAmount) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-semibold">
                      {change != null ? (
                        <span className={change > 0 ? "text-rose-600" : change < 0 ? "text-emerald-600" : "text-slate-400"}>
                          {change > 0 ? "+" : ""}{formatSAR(change)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {new Date(l.changedAt).toLocaleString("en-SA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Legacy Expenses (App Commissions + Staff Expenses) ────────────────────────

function LegacyExpensesSection() {
  const { data: allExpenses = [] } = useListExpenses();
  const { remove } = useExpenseMutations();
  const { toast } = useToast();

  const commissions = allExpenses.filter(e => e.category === "app-commission");
  const staffExpenses = allExpenses.filter(e => e.category === "staff-expenses");
  const fixedExpenses = allExpenses.filter(e => (e.category ?? "fixed") === "fixed");

  if (allExpenses.length === 0) return null;

  function handleDelete(id: number, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    remove.mutate({ id }, { onSuccess: () => toast({ title: "Deleted" }) });
  }

  return (
    <div className="mt-8 border-t pt-6">
      <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        Legacy Items (migrate these to the new system above)
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {[...fixedExpenses, ...commissions, ...staffExpenses].map(e => {
          const isComm = e.category === "app-commission";
          const isStaff = e.category === "staff-expenses";
          const badge = isComm ? "bg-purple-100 text-purple-700" : isStaff ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700";
          const lbl = isComm ? "App Commission" : isStaff ? "Staff" : "Fixed";
          return (
            <div key={e.id} className="bg-white border rounded-xl px-4 py-3 flex items-center justify-between group hover:shadow-sm">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${badge}`}>{lbl}</span>
                  <p className="text-sm font-semibold text-slate-800">{e.name}</p>
                </div>
                <p className="text-base font-bold text-slate-900">{formatSAR(e.monthlyCost)}<span className="text-xs text-slate-400 font-normal">/mo</span></p>
              </div>
              <button onClick={() => handleDelete(e.id, e.name)}
                className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = [
  { key: "entry",     label: "Monthly Entry",    icon: Calendar },
  { key: "templates", label: "Cost Items",        icon: Settings },
  { key: "charts",    label: "Trends",            icon: TrendingUp },
  { key: "year",      label: "Year Comparison",   icon: Table2 },
  { key: "audit",     label: "Audit Log",         icon: Clock },
] as const;
type TabKey = typeof TABS[number]["key"];

export default function Expenses() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabKey>("entry");
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());

  return (
    <div>
      <PageHeader
        title={t("pages.fixedCostsPageTitle")}
        description={t("pages.fixedCostsDesc")}
        action={<PrintButton />}
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-2xl p-1 mb-6">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === t.key ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {activeTab === "entry"     && <MonthlyEntryTab month={selectedMonth} setMonth={setSelectedMonth} />}
      {activeTab === "templates" && <TemplatesTab />}
      {activeTab === "charts"    && <ChartsTab />}
      {activeTab === "year"      && <YearComparisonTab />}
      {activeTab === "audit"     && <AuditLogTab />}

      {(activeTab === "entry" || activeTab === "templates") && <LegacyExpensesSection />}
    </div>
  );
}
