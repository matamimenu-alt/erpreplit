import { useState, useMemo } from "react";
import {
  useListFixedCostTemplates,
  useCreateFixedCostTemplate,
  useUpdateFixedCostTemplate,
  useDeleteFixedCostTemplate,
  useGetMonthlyFixedCosts,
  useSetMonthlyOverride,
  useRemoveMonthlyOverride,
  useCloseMonth,
  useUnlockMonth,
  useGetFixedCostHistory,
  useGetFixedCostAuditLog,
  // Legacy
  useListExpenses,
} from "@workspace/api-client-react";
import type { FixedCostTemplate, MonthlyFixedCostItem } from "@workspace/api-client-react";
import { useExpenseMutations } from "@/hooks/use-expenses";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrintButton } from "@/components/ui/PrintButton";
import { formatSAR } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListFixedCostTemplatesQueryKey,
  getGetMonthlyFixedCostsQueryKey,
  getGetFixedCostHistoryQueryKey,
  getGetFixedCostAuditLogQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from "recharts";
import {
  Plus, Trash2, Pencil, Building2, Smartphone, Users, X, Lock, Unlock, ChevronLeft, ChevronRight,
  TrendingUp, RotateCcw, Clock, FileText, Settings, Calendar, AlertTriangle, CheckCircle,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: "staff-salaries",      label: "Staff Salaries",               labelAr: "رواتب الموظفين",    color: "#3b82f6", bg: "bg-blue-50",    border: "border-blue-200",   text: "text-blue-700",    badge: "bg-blue-100 text-blue-700" },
  { key: "owner-drawings",      label: "Owner Drawings",               labelAr: "مسحوبات المالك",    color: "#8b5cf6", bg: "bg-purple-50",  border: "border-purple-200", text: "text-purple-700",  badge: "bg-purple-100 text-purple-700" },
  { key: "apps-subscriptions",  label: "Applications & Subscriptions", labelAr: "اشتراكات وتطبيقات", color: "#06b6d4", bg: "bg-cyan-50",    border: "border-cyan-200",   text: "text-cyan-700",    badge: "bg-cyan-100 text-cyan-700" },
  { key: "rent",                label: "Rent",                         labelAr: "الإيجار",           color: "#f59e0b", bg: "bg-amber-50",   border: "border-amber-200",  text: "text-amber-700",   badge: "bg-amber-100 text-amber-700" },
  { key: "utilities",           label: "Utilities",                    labelAr: "المرافق",           color: "#10b981", bg: "bg-emerald-50", border: "border-emerald-200",text: "text-emerald-700", badge: "bg-emerald-100 text-emerald-700" },
  { key: "other-fixed",         label: "Other Fixed Costs",            labelAr: "مصاريف ثابتة أخرى", color: "#6b7280", bg: "bg-slate-50",   border: "border-slate-200",  text: "text-slate-700",   badge: "bg-slate-100 text-slate-700" },
];

const getCatMeta = (key: string) => CATEGORIES.find(c => c.key === key) ?? CATEGORIES[CATEGORIES.length - 1];

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

function prevMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Override Edit Modal ───────────────────────────────────────────────────────

function OverrideModal({
  item, month, isLocked, onClose,
}: {
  item: MonthlyFixedCostItem; month: string; isLocked: boolean; onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const setOverride = useSetMonthlyOverride();
  const removeOverride = useRemoveMonthlyOverride();

  const [amount, setAmount] = useState(String(item.overrideAmount ?? item.defaultAmount));
  const [notes, setNotes] = useState(item.overrideNotes ?? "");

  const catMeta = getCatMeta(item.category);

  async function handleSave() {
    const val = parseFloat(amount);
    if (isNaN(val) || val < 0) { toast({ title: "Invalid amount", variant: "destructive" }); return; }
    try {
      await setOverride.mutateAsync({ data: { templateId: item.templateId, month, amount: val, notes: notes || null } });
      await qc.invalidateQueries({ queryKey: getGetMonthlyFixedCostsQueryKey({ month }) });
      await qc.invalidateQueries({ queryKey: getGetFixedCostHistoryQueryKey() });
      await qc.invalidateQueries({ queryKey: getGetFixedCostAuditLogQueryKey() });
      toast({ title: `${item.name} updated for ${formatMonth(month)}` });
      onClose();
    } catch {
      toast({ title: "Failed to save override", variant: "destructive" });
    }
  }

  async function handleReset() {
    if (!item.hasOverride) return;
    try {
      await removeOverride.mutateAsync({ templateId: item.templateId, params: { month } });
      await qc.invalidateQueries({ queryKey: getGetMonthlyFixedCostsQueryKey({ month }) });
      await qc.invalidateQueries({ queryKey: getGetFixedCostHistoryQueryKey() });
      await qc.invalidateQueries({ queryKey: getGetFixedCostAuditLogQueryKey() });
      toast({ title: `Reset to default (${formatSAR(item.defaultAmount)})` });
      onClose();
    } catch {
      toast({ title: "Failed to reset", variant: "destructive" });
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
        <div className={`p-5 border-b flex items-center justify-between ${catMeta.bg}`}>
          <div>
            <span className={`text-xs font-bold uppercase ${catMeta.text}`}>{catMeta.label}</span>
            <h2 className="text-lg font-bold text-slate-900 mt-0.5">{item.name}</h2>
            <p className="text-xs text-slate-500">Override for {formatMonth(month)}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="p-5 space-y-4">
          {isLocked && (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-3 py-2 text-xs">
              <Lock className="w-4 h-4" /> This month is locked. Unlock to edit.
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-xl p-3">
            <div>
              <p className="text-[11px] text-slate-400 uppercase font-semibold">Default Amount</p>
              <p className="text-lg font-bold text-slate-700">{formatSAR(item.defaultAmount)}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400 uppercase font-semibold">Current Effective</p>
              <p className={`text-lg font-bold ${item.hasOverride ? catMeta.text : "text-slate-700"}`}>{formatSAR(item.effectiveAmount)}</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Amount for {formatMonth(month)} (SAR)</label>
            <input
              type="number" min="0" step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              disabled={isLocked}
              className="w-full px-3 py-2.5 border rounded-xl text-sm outline-none focus:border-primary disabled:bg-slate-100 disabled:cursor-not-allowed"
              autoFocus={!isLocked}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Notes (optional)</label>
            <input
              type="text" value={notes}
              onChange={e => setNotes(e.target.value)}
              disabled={isLocked}
              placeholder="e.g. Salary increase, bonus, etc."
              className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-primary disabled:bg-slate-100"
            />
          </div>
          <div className="flex gap-2 pt-2 border-t">
            {item.hasOverride && !isLocked && (
              <button
                onClick={handleReset}
                disabled={removeOverride.isPending}
                className="flex items-center gap-1 px-3 py-2 text-sm text-slate-600 border rounded-xl hover:bg-slate-100 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset to Default
              </button>
            )}
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
            <button
              onClick={handleSave}
              disabled={isLocked || setOverride.isPending}
              className="flex-1 py-2 text-sm font-semibold bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              {setOverride.isPending ? "Saving..." : "Save Override"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Template Form Modal ───────────────────────────────────────────────────────

function TemplateModal({
  mode, template, onClose,
}: {
  mode: "add" | "edit"; template?: FixedCostTemplate; onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const createTpl = useCreateFixedCostTemplate();
  const updateTpl = useUpdateFixedCostTemplate();

  const [form, setForm] = useState({
    category: template?.category ?? "rent",
    name: template?.name ?? "",
    defaultAmount: String(template?.defaultAmount ?? ""),
    notes: template?.notes ?? "",
  });

  async function handleSubmit() {
    if (!form.name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    const amt = parseFloat(form.defaultAmount);
    if (isNaN(amt) || amt < 0) { toast({ title: "Invalid amount", variant: "destructive" }); return; }
    try {
      if (mode === "edit" && template) {
        await updateTpl.mutateAsync({ id: template.id, data: { category: form.category, name: form.name, defaultAmount: amt, notes: form.notes || null } });
        toast({ title: "Template updated" });
      } else {
        await createTpl.mutateAsync({ data: { category: form.category, name: form.name, defaultAmount: amt, notes: form.notes || null } });
        toast({ title: "Template added" });
      }
      await qc.invalidateQueries({ queryKey: getListFixedCostTemplatesQueryKey() });
      await qc.invalidateQueries({ queryKey: getGetFixedCostHistoryQueryKey({}) });
      onClose();
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold">{mode === "add" ? "Add Fixed Cost" : "Edit Fixed Cost"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Category</label>
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full px-3 py-2.5 border rounded-xl text-sm outline-none focus:border-primary bg-white"
            >
              {CATEGORIES.map(c => (
                <option key={c.key} value={c.key}>{c.label} — {c.labelAr}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Name / Description *</label>
            <input
              type="text" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Main Branch Rent, Staff Salaries, Office 365..."
              className="w-full px-3 py-2.5 border rounded-xl text-sm outline-none focus:border-primary"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Default Monthly Amount (SAR) *</label>
            <input
              type="number" min="0" step="0.01"
              value={form.defaultAmount}
              onChange={e => setForm(f => ({ ...f, defaultAmount: e.target.value }))}
              placeholder="0.00"
              className="w-full px-3 py-2.5 border rounded-xl text-sm outline-none focus:border-primary"
            />
            <p className="text-xs text-slate-400 mt-1">Used when no monthly override is set</p>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Notes (optional)</label>
            <input
              type="text" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Contract ref, expiry date, etc."
              className="w-full px-3 py-2.5 border rounded-xl text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="flex gap-2 pt-2 border-t">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
            <button
              onClick={handleSubmit}
              disabled={createTpl.isPending || updateTpl.isPending}
              className="flex-1 py-2.5 text-sm font-semibold bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-60"
            >
              {(createTpl.isPending || updateTpl.isPending) ? "Saving..." : mode === "add" ? "Add" : "Update"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Monthly Overview Tab ─────────────────────────────────────────────────────

function MonthlyOverviewTab({ selectedMonth, setSelectedMonth }: { selectedMonth: string; setSelectedMonth: (m: string) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: monthData, isLoading } = useGetMonthlyFixedCosts({ month: selectedMonth });
  const closeMonth = useCloseMonth();
  const unlockMonth = useUnlockMonth();
  const [overrideItem, setOverrideItem] = useState<MonthlyFixedCostItem | null>(null);
  const isLocked = monthData?.isLocked ?? false;

  // Group items by category
  const grouped = useMemo(() => {
    const items = monthData?.items ?? [];
    const map = new Map<string, MonthlyFixedCostItem[]>();
    for (const item of items) {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)!.push(item);
    }
    return CATEGORIES.map(cat => ({
      cat,
      items: map.get(cat.key) ?? [],
      subtotal: (map.get(cat.key) ?? []).reduce((s, i) => s + i.effectiveAmount, 0),
    })).filter(g => g.items.length > 0);
  }, [monthData]);

  async function handleToggleLock() {
    if (isLocked) {
      if (!confirm(`Unlock ${formatMonth(selectedMonth)}? This allows editing fixed costs for this month.`)) return;
      try {
        await unlockMonth.mutateAsync({ data: { month: selectedMonth } });
        await qc.invalidateQueries({ queryKey: getGetMonthlyFixedCostsQueryKey({ month: selectedMonth }) });
        await qc.invalidateQueries({ queryKey: getGetFixedCostAuditLogQueryKey({}) });
        toast({ title: `${formatMonth(selectedMonth)} unlocked` });
      } catch { toast({ title: "Failed to unlock", variant: "destructive" }); }
    } else {
      if (!confirm(`Lock ${formatMonth(selectedMonth)}? This will prevent editing fixed costs for this period.`)) return;
      try {
        await closeMonth.mutateAsync({ data: { month: selectedMonth } });
        await qc.invalidateQueries({ queryKey: getGetMonthlyFixedCostsQueryKey({ month: selectedMonth }) });
        await qc.invalidateQueries({ queryKey: getGetFixedCostAuditLogQueryKey({}) });
        toast({ title: `${formatMonth(selectedMonth)} locked` });
      } catch { toast({ title: "Failed to lock", variant: "destructive" }); }
    }
  }

  return (
    <div>
      {/* Month Navigator */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => setSelectedMonth(prevMonth(selectedMonth))} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-900">{formatMonth(selectedMonth)}</h2>
          <p className="text-xs text-slate-500">{selectedMonth}</p>
        </div>
        <button
          onClick={() => setSelectedMonth(nextMonth(selectedMonth))}
          disabled={selectedMonth >= getCurrentMonth()}
          className="p-2 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Status + Total Bar */}
      <div className="flex items-center justify-between bg-white border rounded-2xl px-5 py-4 mb-6 shadow-sm">
        <div>
          <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Total Fixed Costs</p>
          <p className="text-3xl font-extrabold text-slate-900">{formatSAR(monthData?.total ?? 0)}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {(monthData?.items ?? []).filter(i => i.hasOverride).length} overrides active
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isLocked ? (
            <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-3 py-1.5 text-xs font-semibold">
              <Lock className="w-3.5 h-3.5" /> Locked
              {monthData?.lockedBy && <span className="opacity-60">by {monthData.lockedBy}</span>}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-3 py-1.5 text-xs font-semibold">
              <CheckCircle className="w-3.5 h-3.5" /> Open
            </div>
          )}
          <button
            onClick={handleToggleLock}
            disabled={closeMonth.isPending || unlockMonth.isPending}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 ${
              isLocked
                ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                : "bg-slate-800 text-white hover:bg-slate-700"
            }`}
          >
            {isLocked ? <><Unlock className="w-4 h-4" /> Unlock Month</> : <><Lock className="w-4 h-4" /> Lock Month</>}
          </button>
        </div>
      </div>

      {/* Category Groups */}
      {isLoading ? (
        <p className="text-slate-400 text-center py-10">Loading...</p>
      ) : monthData?.items.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-2xl text-slate-400">
          <Settings className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-slate-600">No fixed costs configured yet</p>
          <p className="text-sm mt-1">Switch to the Templates tab to add your first fixed cost item.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ cat, items, subtotal }) => (
            <div key={cat.key} className={`border rounded-2xl overflow-hidden ${cat.border}`}>
              <div className={`flex items-center justify-between px-5 py-3 ${cat.bg}`}>
                <div>
                  <p className={`text-xs font-bold uppercase tracking-wide ${cat.text}`}>{cat.label}</p>
                  <p className="text-xs text-slate-500">{cat.labelAr}</p>
                </div>
                <p className={`text-xl font-extrabold ${cat.text}`}>{formatSAR(subtotal)}</p>
              </div>
              <div className="divide-y bg-white">
                {items.map(item => (
                  <div key={item.templateId} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{item.name}</p>
                        {item.notes && <p className="text-xs text-slate-400 truncate">{item.notes}</p>}
                      </div>
                      {item.hasOverride && (
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">
                          Override
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <p className={`text-base font-bold ${item.hasOverride ? cat.text : "text-slate-900"}`}>
                          {formatSAR(item.effectiveAmount)}
                        </p>
                        {item.hasOverride && (
                          <p className="text-[10px] text-slate-400 line-through">{formatSAR(item.defaultAmount)}</p>
                        )}
                      </div>
                      <button
                        onClick={() => !isLocked && setOverrideItem(item)}
                        disabled={isLocked}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                          isLocked
                            ? "text-slate-400 border cursor-not-allowed opacity-50"
                            : item.hasOverride
                              ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                              : "border text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {isLocked
                          ? <><Lock className="w-3 h-3" /> Locked</>
                          : item.hasOverride
                            ? <><Pencil className="w-3 h-3" /> Edit Override</>
                            : <><Pencil className="w-3 h-3" /> Set Override</>
                        }
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {overrideItem && (
        <OverrideModal
          item={overrideItem}
          month={selectedMonth}
          isLocked={isLocked}
          onClose={() => setOverrideItem(null)}
        />
      )}
    </div>
  );
}

// ─── Templates Tab ─────────────────────────────────────────────────────────────

function TemplatesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: templates = [], isLoading } = useListFixedCostTemplates();
  const deleteTpl = useDeleteFixedCostTemplate();
  const [modal, setModal] = useState<{ mode: "add" | "edit"; template?: FixedCostTemplate } | null>(null);

  async function handleDelete(t: FixedCostTemplate) {
    if (!confirm(`Delete "${t.name}"? All monthly overrides for this template will also be deleted.`)) return;
    try {
      await deleteTpl.mutateAsync({ id: t.id });
      await qc.invalidateQueries({ queryKey: getListFixedCostTemplatesQueryKey() });
      await qc.invalidateQueries({ queryKey: getGetFixedCostHistoryQueryKey({}) });
      toast({ title: "Template deleted" });
    } catch { toast({ title: "Failed to delete", variant: "destructive" }); }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, FixedCostTemplate[]>();
    for (const t of templates) {
      if (!map.has(t.category)) map.set(t.category, []);
      map.get(t.category)!.push(t);
    }
    return CATEGORIES.map(cat => ({
      cat, items: map.get(cat.key) ?? [],
      subtotal: (map.get(cat.key) ?? []).reduce((s, t) => s + t.defaultAmount, 0),
    }));
  }, [templates]);

  const grandTotal = templates.reduce((s, t) => s + t.defaultAmount, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-slate-500">Manage default amounts for each fixed cost item.</p>
          <p className="text-xs text-slate-400 mt-0.5">Default amounts are used when no monthly override is set.</p>
        </div>
        <button
          onClick={() => setModal({ mode: "add" })}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl shadow hover:-translate-y-0.5 transition-all text-sm font-semibold"
        >
          <Plus className="w-4 h-4" /> Add Fixed Cost
        </button>
      </div>

      {/* Grand Total */}
      {templates.length > 0 && (
        <div className="bg-slate-800 text-white rounded-2xl px-5 py-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-semibold opacity-60">Total Default Monthly Overhead</p>
            <p className="text-2xl font-extrabold mt-0.5">{formatSAR(grandTotal)}</p>
          </div>
          <p className="text-sm opacity-50">{templates.length} items</p>
        </div>
      )}

      {isLoading ? (
        <p className="text-slate-400 text-center py-10">Loading...</p>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-2xl text-slate-400">
          <Settings className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-slate-600">No templates yet</p>
          <button onClick={() => setModal({ mode: "add" })} className="mt-3 flex items-center gap-1 px-4 py-2 bg-primary text-white rounded-xl mx-auto text-sm">
            <Plus className="w-4 h-4" /> Add First Item
          </button>
        </div>
      ) : (
        <div className="space-y-5">
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
                      <p className="text-sm font-semibold text-slate-800">{t.name}</p>
                      {t.notes && <p className="text-xs text-slate-400">{t.notes}</p>}
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <p className="text-base font-bold text-slate-900">{formatSAR(t.defaultAmount)}</p>
                        <p className="text-[10px] text-slate-400">default / month</p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setModal({ mode: "edit", template: t })} className="p-1.5 text-primary hover:bg-primary/10 rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(t)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
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

// ─── History & Charts Tab ─────────────────────────────────────────────────────

function HistoryChartsTab() {
  const { data: history = [], isLoading } = useGetFixedCostHistory({ months: 6 });

  const chartData = useMemo(() =>
    history.map(h => ({
      month: h.month.slice(5), // "MM"
      fullMonth: formatMonth(h.month),
      total: h.total,
      ...h.breakdown,
    })), [history]);

  const catColors: Record<string, string> = Object.fromEntries(CATEGORIES.map(c => [c.key, c.color]));

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const h of history) Object.keys(h.breakdown).forEach(k => cats.add(k));
    return CATEGORIES.filter(c => cats.has(c.key));
  }, [history]);

  if (isLoading) return <p className="text-slate-400 text-center py-10">Loading charts...</p>;

  if (history.length === 0) return (
    <div className="text-center py-16 border-2 border-dashed rounded-2xl text-slate-400">
      <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p>No history data yet. Add templates and set monthly values to see charts.</p>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Monthly Total Trend */}
      <div className="bg-white border rounded-2xl p-5 shadow-sm">
        <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" /> Total Fixed Costs — Last 6 Months
        </h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="fullMonth" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
            <Tooltip formatter={(v: number) => formatSAR(v)} />
            <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="#3b82f6" name="Total">
              {chartData.map((_, i) => (
                <Cell key={i} fill={i === chartData.length - 1 ? "#2563eb" : "#93c5fd"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Category Stacked Breakdown */}
      <div className="bg-white border rounded-2xl p-5 shadow-sm">
        <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" /> Category Breakdown — Stacked
        </h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="fullMonth" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
            <Tooltip formatter={(v: number) => formatSAR(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {allCategories.map(cat => (
              <Bar key={cat.key} dataKey={cat.key} name={cat.label} stackId="a" fill={cat.color} radius={[0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Line Trend per Category */}
      <div className="bg-white border rounded-2xl p-5 shadow-sm">
        <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-amber-500" /> Operating Expense Trend
        </h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="fullMonth" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
            <Tooltip formatter={(v: number) => formatSAR(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {allCategories.map(cat => (
              <Line
                key={cat.key}
                type="monotone"
                dataKey={cat.key}
                name={cat.label}
                stroke={cat.color}
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Month History Table */}
      <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <h3 className="text-base font-bold text-slate-800">Monthly History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Month</th>
                {allCategories.map(c => (
                  <th key={c.key} className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase">{c.label}</th>
                ))}
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Total</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[...history].reverse().map(h => (
                <tr key={h.month} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    {formatMonth(h.month)}
                    {h.month === getCurrentMonth() && <span className="ml-2 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Current</span>}
                  </td>
                  {allCategories.map(c => (
                    <td key={c.key} className="text-right px-3 py-3 text-slate-600">
                      {h.breakdown[c.key] != null ? formatSAR(Number(h.breakdown[c.key])) : "—"}
                    </td>
                  ))}
                  <td className="text-right px-4 py-3 font-bold text-slate-900">{formatSAR(h.total)}</td>
                  <td className="px-3 py-3">
                    {h.isLocked ? (
                      <Lock className="w-3.5 h-3.5 text-rose-400" aria-label="Locked" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5 text-emerald-400" aria-label="Open" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Audit Log Tab ─────────────────────────────────────────────────────────────

const ACTION_META: Record<string, { label: string; color: string }> = {
  create_template:  { label: "Created", color: "bg-emerald-100 text-emerald-700" },
  update_default:   { label: "Default Updated", color: "bg-blue-100 text-blue-700" },
  update_template:  { label: "Template Updated", color: "bg-blue-100 text-blue-700" },
  delete_template:  { label: "Deleted", color: "bg-rose-100 text-rose-700" },
  set_override:     { label: "Override Set", color: "bg-amber-100 text-amber-700" },
  update_override:  { label: "Override Updated", color: "bg-amber-100 text-amber-700" },
  remove_override:  { label: "Reset to Default", color: "bg-slate-100 text-slate-700" },
  lock_month:       { label: "Month Locked", color: "bg-rose-100 text-rose-700" },
  unlock_month:     { label: "Month Unlocked", color: "bg-emerald-100 text-emerald-700" },
};

function AuditLogTab() {
  const { data: logs = [], isLoading } = useGetFixedCostAuditLog({ limit: 200 });

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <Clock className="w-4 h-4 text-slate-400" />
        <p className="text-sm text-slate-500">Complete history of all changes to fixed costs and monthly overrides.</p>
      </div>
      {isLoading ? (
        <p className="text-slate-400 text-center py-10">Loading...</p>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-2xl text-slate-400">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No audit log entries yet.</p>
        </div>
      ) : (
        <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Action</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Item</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Month</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Old</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">New</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">By</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">When</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map(l => {
                const meta = ACTION_META[l.action] ?? { label: l.action, color: "bg-slate-100 text-slate-700" };
                return (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${meta.color}`}>{meta.label}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{l.templateName ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {l.month ? <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{l.month}</span> : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">
                      {l.oldAmount != null ? formatSAR(l.oldAmount) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {l.newAmount != null ? formatSAR(l.newAmount) : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{l.changedBy}</td>
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

  const total = allExpenses.reduce((s, e) => s + e.monthlyCost, 0);

  function handleDelete(id: number, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    remove.mutate({ id }, { onSuccess: () => toast({ title: "Deleted" }) });
  }

  if (allExpenses.length === 0) return null;

  return (
    <div className="mt-8 border-t pt-6">
      <h3 className="text-sm font-bold text-slate-500 uppercase mb-4 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        Legacy Fixed Expenses (App Commissions, Staff, Old Fixed Items)
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {[...fixedExpenses, ...commissions, ...staffExpenses].map(e => {
          const isComm = e.category === "app-commission";
          const isStaff = e.category === "staff-expenses";
          const badgeColor = isComm ? "bg-purple-100 text-purple-700" : isStaff ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700";
          const label = isComm ? "App Commission" : isStaff ? "Staff" : "Fixed";
          return (
            <div key={e.id} className="bg-white border rounded-xl px-4 py-3 flex items-center justify-between group hover:shadow-sm">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${badgeColor}`}>{label}</span>
                  <p className="text-sm font-semibold text-slate-800 truncate">{e.name}</p>
                </div>
                <p className="text-base font-bold text-slate-900">{formatSAR(e.monthlyCost)}<span className="text-xs text-slate-400 font-normal">/mo</span></p>
              </div>
              <button onClick={() => handleDelete(e.id, e.name)} className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
      {allExpenses.length > 0 && (
        <p className="text-xs text-slate-400 mt-3 text-right">Legacy total: {formatSAR(total)} / month</p>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: "monthly",   label: "Monthly Overview", icon: Calendar },
  { key: "templates", label: "Templates",         icon: Settings },
  { key: "charts",    label: "History & Charts",  icon: TrendingUp },
  { key: "audit",     label: "Audit Log",         icon: Clock },
] as const;

type TabKey = typeof TABS[number]["key"];

export default function Expenses() {
  const [activeTab, setActiveTab] = useState<TabKey>("monthly");
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());

  return (
    <div>
      <PageHeader
        title="Fixed Costs"
        description="Dynamic monthly fixed costs with override history, audit trail, and trend analysis."
        action={
          <div className="flex items-center gap-2">
            <PrintButton />
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-2xl p-1 mb-6">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === t.key
                ? "bg-white text-primary shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <t.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "monthly" && (
        <MonthlyOverviewTab selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />
      )}
      {activeTab === "templates" && <TemplatesTab />}
      {activeTab === "charts" && <HistoryChartsTab />}
      {activeTab === "audit" && <AuditLogTab />}

      {/* Legacy Section (always visible if legacy data exists) */}
      {(activeTab === "monthly" || activeTab === "templates") && <LegacyExpensesSection />}
    </div>
  );
}
