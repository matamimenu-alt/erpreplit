import { useState, useMemo } from "react";
import {
  useListExpenseCategories,
  useListExpenseTransactions,
  useCreateExpenseTransaction,
  useUpdateExpenseTransaction,
  useDeleteExpenseTransaction,
  useGetExpenseSummary,
} from "@workspace/api-client-react";
import type { ExpenseTransaction, CreateExpenseTransaction, ExpenseCategory } from "@workspace/api-client-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrintButton } from "@/components/ui/PrintButton";
import { formatSAR } from "@/lib/format";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Pencil, Trash2, X, Check, ChevronDown, ChevronRight,
  Search, Filter, BarChart2, Table2, FileText, TrendingDown,
  Building2, Tag, Calendar, Percent, AlertTriangle,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function currentMonth() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}
function toNum(v: unknown) { return parseFloat(String(v)) || 0; }
function today() { return new Date().toISOString().split("T")[0]; }

const MAIN_COLORS: Record<string, string> = {
  "5-1": "text-blue-700 bg-blue-50 border-blue-200",
  "5-2": "text-purple-700 bg-purple-50 border-purple-200",
  "5-3": "text-red-700 bg-red-50 border-red-200",
  "5-4": "text-amber-700 bg-amber-50 border-amber-200",
  "5-5": "text-emerald-700 bg-emerald-50 border-emerald-200",
  "5-6": "text-cyan-700 bg-cyan-50 border-cyan-200",
  "5-7": "text-orange-700 bg-orange-50 border-orange-200",
  "5-8": "text-slate-700 bg-slate-50 border-slate-200",
};
function getCatColor(code: string) {
  const mainCode = code.split("-").slice(0, 2).join("-");
  return MAIN_COLORS[mainCode] ?? "text-slate-700 bg-slate-50 border-slate-200";
}

// ─── Category Picker ──────────────────────────────────────────────────────────
function CategoryPicker({
  categories, value, onChange,
}: { categories: ExpenseCategory[]; value: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const mains = categories.filter(c => c.level === 1);
  const selected = categories.find(c => c.code === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white hover:border-slate-400 transition-colors"
      >
        {selected ? (
          <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold border ${getCatColor(selected.code)}`}>
            {selected.code} — {selected.nameAr}
          </span>
        ) : (
          <span className="text-slate-400">اختر التصنيف...</span>
        )}
        <ChevronDown className="w-4 h-4 opacity-50 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl max-h-72 overflow-y-auto">
          {mains.map(main => {
            const subs = categories.filter(c => c.parentCode === main.code);
            return (
              <div key={main.code}>
                <button
                  type="button"
                  onClick={() => { onChange(main.code); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                >
                  <span className="text-xs text-slate-500 font-mono">{main.code}</span>
                  <span>{main.nameAr}</span>
                </button>
                {subs.map(sub => (
                  <button
                    key={sub.code}
                    type="button"
                    onClick={() => { onChange(sub.code); setOpen(false); }}
                    className={`w-full flex items-center gap-2 px-6 py-2 text-sm hover:bg-slate-50 transition-colors text-left ${value === sub.code ? "bg-primary/10 text-primary font-semibold" : "text-slate-600"}`}
                  >
                    <span className="text-xs opacity-60 font-mono">{sub.code}</span>
                    <span>{sub.nameAr}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Transaction Form ─────────────────────────────────────────────────────────
const EMPTY_FORM: CreateExpenseTransaction = {
  date: today(),
  categoryCode: "",
  description: "",
  amount: 0,
  isVatApplicable: false,
  vatRate: 15,
};

function TransactionForm({
  categories, initial, onClose, onSave, isPending,
}: {
  categories: ExpenseCategory[];
  initial?: ExpenseTransaction;
  onClose: () => void;
  onSave: (data: CreateExpenseTransaction) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<CreateExpenseTransaction>(
    initial ? {
      date: initial.date,
      categoryCode: initial.categoryCode,
      description: initial.description,
      descriptionAr: initial.descriptionAr ?? undefined,
      amount: toNum(initial.amount),
      isVatApplicable: initial.isVatApplicable,
      vatRate: toNum(initial.vatRate),
      costCenter: initial.costCenter ?? undefined,
      referenceNo: initial.referenceNo ?? undefined,
      notes: initial.notes ?? undefined,
    } : { ...EMPTY_FORM }
  );

  const net   = toNum(form.amount);
  const rate  = form.isVatApplicable ? toNum(form.vatRate) : 0;
  const vat   = form.isVatApplicable ? +(net * rate / 100).toFixed(2) : 0;
  const total = +(net + vat).toFixed(2);

  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!form.date) e.date = "التاريخ مطلوب";
    if (!form.categoryCode) e.categoryCode = "التصنيف مطلوب";
    if (!form.description?.trim()) e.description = "الوصف مطلوب";
    if (!form.amount || toNum(form.amount) <= 0) e.amount = "المبلغ يجب أن يكون أكبر من صفر";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function set(key: keyof CreateExpenseTransaction, val: unknown) {
    setForm(f => ({ ...f, [key]: val }));
    setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  }

  function handleSubmit() {
    if (!validate()) return;
    onSave({ ...form, amount: net });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{initial ? "تعديل مصروف" : "إضافة مصروف جديد"}</h2>
            <p className="text-sm text-slate-500 mt-0.5">تسجيل قيد في شجرة المصروفات</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* Date + Ref */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">التاريخ *</label>
              <input type="date" value={form.date} onChange={e => set("date", e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none" />
              {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">رقم المرجع</label>
              <input type="text" value={form.referenceNo ?? ""} onChange={e => set("referenceNo", e.target.value)}
                placeholder="اختياري" className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none" />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">التصنيف المحاسبي *</label>
            <CategoryPicker categories={categories} value={form.categoryCode} onChange={v => set("categoryCode", v)} />
            {errors.categoryCode && <p className="text-red-500 text-xs mt-1">{errors.categoryCode}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">الوصف *</label>
            <input type="text" value={form.description} onChange={e => set("description", e.target.value)}
              placeholder="وصف المصروف" className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none" />
            {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
          </div>

          {/* Amount + VAT */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-200">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">المبلغ (صافي) *</label>
                <div className="relative">
                  <input type="number" value={form.amount || ""} onChange={e => set("amount", parseFloat(e.target.value) || 0)}
                    min="0" step="0.01" placeholder="0.00"
                    className="w-full pl-12 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none" />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">SAR</span>
                </div>
                {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">مركز التكلفة</label>
                <input type="text" value={form.costCenter ?? ""} onChange={e => set("costCenter", e.target.value)}
                  placeholder="اختياري" className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none" />
              </div>
            </div>

            {/* VAT toggle */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => set("isVatApplicable", !form.isVatApplicable)}
                  className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${form.isVatApplicable ? "bg-primary" : "bg-slate-300"}`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isVatApplicable ? "translate-x-5" : "translate-x-0"}`} />
                </div>
                <span className="text-sm font-medium text-slate-700">خاضع لضريبة القيمة المضافة</span>
              </label>
              {form.isVatApplicable && (
                <div className="flex items-center gap-1">
                  <input type="number" value={form.vatRate} onChange={e => set("vatRate", parseFloat(e.target.value) || 15)}
                    min="0" max="100" step="0.5"
                    className="w-16 px-2 py-1 border border-slate-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none" />
                  <Percent className="w-4 h-4 text-slate-400" />
                </div>
              )}
            </div>

            {/* Live VAT breakdown */}
            {form.isVatApplicable && (
              <div className="grid grid-cols-3 gap-2 text-center text-xs border-t border-slate-200 pt-3">
                <div>
                  <div className="text-slate-500 mb-0.5">صافي المبلغ</div>
                  <div className="font-bold text-slate-900">{formatSAR(net)}</div>
                </div>
                <div>
                  <div className="text-slate-500 mb-0.5">ضريبة {rate}%</div>
                  <div className="font-bold text-amber-600">{formatSAR(vat)}</div>
                </div>
                <div>
                  <div className="text-slate-500 mb-0.5">الإجمالي</div>
                  <div className="font-bold text-primary">{formatSAR(total)}</div>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">ملاحظات</label>
            <textarea value={form.notes ?? ""} onChange={e => set("notes", e.target.value)}
              rows={2} placeholder="ملاحظات إضافية (اختياري)"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none resize-none" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t bg-slate-50 rounded-b-2xl">
          <div className="text-sm">
            <span className="text-slate-500">الإجمالي: </span>
            <span className="font-bold text-slate-900 text-base">{formatSAR(total)}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={isPending}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-medium transition-colors">
              إلغاء
            </button>
            <button onClick={handleSubmit} disabled={isPending}
              className="px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary/90 text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2">
              {isPending ? "جاري الحفظ..." : <><Check className="w-4 h-4" />{initial ? "تحديث" : "حفظ"}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Summary Tree Node ────────────────────────────────────────────────────────
type SummaryNode = {
  code: string; name: string; nameAr: string; level: number;
  net: number; vat: number; total: number; count: number;
  children: SummaryNode[];
};

function SummaryTreeNode({ node, depth = 0 }: { node: SummaryNode; depth?: number }) {
  const [open, setOpen] = useState(depth < 1 || node.total > 0);
  const hasChildren = node.children.length > 0;
  const colorCls = getCatColor(node.code);

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer ${depth === 0 ? "border-b border-slate-100" : ""}`}
        style={{ paddingLeft: `${16 + depth * 20}px` }}
        onClick={() => hasChildren && setOpen(o => !o)}
      >
        <div className="w-4 flex-shrink-0">
          {hasChildren && (open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />)}
        </div>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border ${colorCls} flex-shrink-0`}>
          {node.code}
        </span>
        <span className={`text-sm font-medium flex-1 ${depth === 1 ? "font-bold text-slate-800" : "text-slate-700"}`}>{node.nameAr}</span>
        {node.total > 0 && (
          <div className="flex items-center gap-4 text-right flex-shrink-0">
            {node.vat > 0 && <span className="text-xs text-amber-600">ضريبة {formatSAR(node.vat)}</span>}
            <span className={`font-bold ${depth <= 1 ? "text-base text-slate-900" : "text-sm text-slate-700"}`}>
              {formatSAR(node.net)}
            </span>
          </div>
        )}
      </div>
      {open && node.children.map(child => (
        <SummaryTreeNode key={child.code} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ExpenseLedger() {
  const { activeRestaurant } = useRestaurant();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [month, setMonth] = useState(currentMonth());
  const [view, setView] = useState<"table" | "tree">("table");
  const [searchQ, setSearchQ] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editTxn, setEditTxn] = useState<ExpenseTransaction | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(["5-1","5-2","5-3","5-4","5-5","5-6","5-7","5-8"]));

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: categories = [] } = useListExpenseCategories<ExpenseCategory[]>({});
  const { data: transactions = [], isLoading } = useListExpenseTransactions<ExpenseTransaction[]>({ month, categoryCode: filterCat || undefined });
  const { data: summary } = useGetExpenseSummary<{ tree: SummaryNode[] }>({ month });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const invalidate = () => {
    queryClient.invalidateQueries({ predicate: q => String(q.queryKey[0]).includes("expense") });
  };

  const createMut = useCreateExpenseTransaction({
    mutation: {
      onSuccess: () => { toast({ title: "تم حفظ المصروف" }); setFormOpen(false); invalidate(); },
      onError: () => toast({ title: "خطأ في الحفظ", variant: "destructive" }),
    }
  });
  const updateMut = useUpdateExpenseTransaction({
    mutation: {
      onSuccess: () => { toast({ title: "تم التحديث" }); setEditTxn(null); invalidate(); },
      onError: () => toast({ title: "خطأ في التحديث", variant: "destructive" }),
    }
  });
  const deleteMut = useDeleteExpenseTransaction({
    mutation: {
      onSuccess: () => { toast({ title: "تم الحذف" }); setDeleteId(null); invalidate(); },
      onError: () => toast({ title: "خطأ في الحذف", variant: "destructive" }),
    }
  });

  // ── Derived data ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...transactions];
    if (searchQ) {
      const q = searchQ.toLowerCase();
      list = list.filter(t => t.description.toLowerCase().includes(q) || (t.descriptionAr ?? "").includes(q) || t.categoryCode.includes(q));
    }
    return list;
  }, [transactions, searchQ]);

  const totalNet   = filtered.reduce((s, t) => s + toNum(t.amount), 0);
  const totalVat   = filtered.reduce((s, t) => s + toNum(t.vatAmount), 0);
  const totalGross = filtered.reduce((s, t) => s + toNum(t.totalAmount), 0);

  const getCatLabel = (code: string) => categories.find(c => c.code === code);

  // ── Month helpers ─────────────────────────────────────────────────────────
  function shiftMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  const MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  const [my, mm] = month.split("-").map(Number);
  const monthLabel = `${MONTHS[mm - 1]} ${my}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="دفتر المصروفات"
        description={`شجرة المصروفات المحاسبية — ${activeRestaurant?.name ?? ""}`}
        action={
          <div className="flex items-center gap-2">
            <PrintButton />
            <button onClick={() => setFormOpen(true)}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm">
              <Plus className="w-4 h-4" /> إضافة مصروف
            </button>
          </div>
        }
      />

      {/* Month Nav + View Toggle */}
      <div className="bg-white rounded-2xl border border-slate-200 px-6 py-4 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setMonth(shiftMonth(-1))} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="text-center min-w-[150px]">
            <div className="text-xl font-bold text-slate-900">{monthLabel}</div>
            <div className="text-xs text-slate-400">الفترة المحاسبية</div>
          </div>
          <button onClick={() => setMonth(shiftMonth(1))} disabled={month >= currentMonth()} className="p-2 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-30">
            <ChevronDown className="w-5 h-5 rotate-90" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 rounded-xl p-1">
            <button onClick={() => setView("table")} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === "table" ? "bg-white shadow text-slate-900" : "text-slate-500"}`}>
              <Table2 className="w-4 h-4" />
            </button>
            <button onClick={() => setView("tree")} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === "tree" ? "bg-white shadow text-slate-900" : "text-slate-500"}`}>
              <BarChart2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "إجمالي المصروفات (صافي)", value: totalNet, color: "text-slate-900" },
          { label: "ضريبة القيمة المضافة", value: totalVat, color: "text-amber-600" },
          { label: "الإجمالي شامل الضريبة", value: totalGross, color: "text-primary" },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="text-sm text-slate-500 mb-1">{k.label}</div>
            <div className={`text-2xl font-bold ${k.color}`}>{formatSAR(k.value)}</div>
          </div>
        ))}
      </div>

      {/* Tree View */}
      {view === "tree" && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">شجرة المصروفات المحاسبية</h3>
              <p className="text-sm text-slate-500 mt-0.5">تجميع الأرقام حسب التصنيف المحاسبي</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">الإجمالي</div>
              <div className="text-lg font-bold text-slate-900">{formatSAR(totalNet)}</div>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {(summary?.tree ?? []).map((node: SummaryNode) => (
              <SummaryTreeNode key={node.code} node={node} depth={0} />
            ))}
            {(!summary?.tree || summary.tree.length === 0) && (
              <div className="py-12 text-center text-slate-400">لا توجد بيانات لهذا الشهر</div>
            )}
          </div>
        </div>
      )}

      {/* Table View */}
      {view === "table" && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          {/* Search + Filter */}
          <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)}
                placeholder="بحث في المصروفات..." dir="rtl"
                className="w-full pr-9 pl-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none" />
            </div>
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
              className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none">
              <option value="">كل التصنيفات</option>
              {categories.filter(c => c.level === 1).map(c => (
                <optgroup key={c.code} label={`${c.code} — ${c.nameAr}`}>
                  {categories.filter(s => s.parentCode === c.code).map(s => (
                    <option key={s.code} value={s.code}>{s.code} — {s.nameAr}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div className="text-sm text-slate-500">{filtered.length} قيد</div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="py-16 text-center text-slate-400">جاري التحميل...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <FileText className="w-12 h-12 mx-auto text-slate-200 mb-3" />
              <div className="text-slate-500 font-medium">لا توجد مصروفات مسجلة</div>
              <div className="text-slate-400 text-sm mt-1">اضغط "إضافة مصروف" لبدء التسجيل</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-right">
                    <th className="px-4 py-3 font-semibold text-slate-600 text-right">التاريخ</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-right">التصنيف</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-right">الوصف</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-right">مركز التكلفة</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-right">صافي</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-right">ضريبة</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-right">الإجمالي</th>
                    <th className="px-4 py-3 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(txn => {
                    const cat = getCatLabel(txn.categoryCode);
                    return (
                      <tr key={txn.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{txn.date}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border ${getCatColor(txn.categoryCode)}`}>
                            {txn.categoryCode}
                          </span>
                          {cat && <div className="text-xs text-slate-500 mt-0.5">{cat.nameAr}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800">{txn.description}</div>
                          {txn.notes && <div className="text-xs text-slate-400">{txn.notes}</div>}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{txn.costCenter ?? "—"}</td>
                        <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{formatSAR(toNum(txn.amount))}</td>
                        <td className="px-4 py-3 text-amber-600 text-xs whitespace-nowrap">
                          {txn.isVatApplicable ? <>{formatSAR(toNum(txn.vatAmount))}<br /><span className="text-slate-400">{toNum(txn.vatRate)}%</span></> : "—"}
                        </td>
                        <td className="px-4 py-3 font-bold text-primary whitespace-nowrap">{formatSAR(toNum(txn.totalAmount))}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setEditTxn(txn)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-700">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setDeleteId(txn.id)} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors text-slate-400 hover:text-red-600">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold">
                    <td colSpan={4} className="px-4 py-3 text-slate-700 text-right">الإجمالي ({filtered.length} قيد)</td>
                    <td className="px-4 py-3 text-slate-900">{formatSAR(totalNet)}</td>
                    <td className="px-4 py-3 text-amber-600">{formatSAR(totalVat)}</td>
                    <td className="px-4 py-3 text-primary">{formatSAR(totalGross)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {(formOpen || editTxn) && (
        <TransactionForm
          categories={categories.filter(c => c.level >= 1)}
          initial={editTxn ?? undefined}
          onClose={() => { setFormOpen(false); setEditTxn(null); }}
          onSave={data => {
            if (editTxn) {
              updateMut.mutate({ id: editTxn.id, data });
            } else {
              createMut.mutate({ data });
            }
          }}
          isPending={createMut.isPending || updateMut.isPending}
        />
      )}

      {/* Delete Confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-xl"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
              <div>
                <h3 className="font-bold text-slate-900">تأكيد الحذف</h3>
                <p className="text-sm text-slate-500">سيتم حذف هذا القيد نهائياً</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 border border-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50">إلغاء</button>
              <button
                onClick={() => deleteMut.mutate({ id: deleteId })}
                disabled={deleteMut.isPending}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
                {deleteMut.isPending ? "جاري الحذف..." : "حذف"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
