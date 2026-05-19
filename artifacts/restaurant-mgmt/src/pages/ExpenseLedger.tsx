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
  Search, BarChart2, Table2, FileText, TrendingDown,
  Percent, AlertTriangle, Flame, ShieldAlert, Info,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function currentMonth() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}
function toNum(v: unknown) { return parseFloat(String(v)) || 0; }
function today() { return new Date().toISOString().split("T")[0]; }
function pct(part: number, total: number) { return total > 0 ? (part / total) * 100 : 0; }

// ─── VAT Mode ────────────────────────────────────────────────────────────────
type VatMode = "none" | "exclusive" | "inclusive";

function computeVat(inputAmount: number, mode: VatMode) {
  const VAT_RATE = 15;
  if (mode === "none")      return { net: inputAmount, vat: 0,                                     total: inputAmount };
  if (mode === "exclusive") return { net: inputAmount, vat: +(inputAmount * VAT_RATE / 100).toFixed(2), total: +(inputAmount * (1 + VAT_RATE / 100)).toFixed(2) };
  // inclusive: user entered total-including-VAT
  const net = +(inputAmount / (1 + VAT_RATE / 100)).toFixed(2);
  return { net, vat: +(inputAmount - net).toFixed(2), total: inputAmount };
}

// ─── Warning thresholds ───────────────────────────────────────────────────────
// "critical" if item ≥ 30% of total, "warning" if ≥ 15%
type Risk = "critical" | "warning" | "ok";
function getRisk(itemNet: number, totalNet: number): Risk {
  const p = pct(itemNet, totalNet);
  if (p >= 30) return "critical";
  if (p >= 15) return "warning";
  return "ok";
}
const RISK_ROW: Record<Risk, string> = {
  critical: "bg-red-50/70 border-l-4 border-l-red-500",
  warning:  "bg-amber-50/50 border-l-4 border-l-amber-400",
  ok:       "",
};
const RISK_BADGE: Record<Risk, { icon: typeof Flame; cls: string; label: string }> = {
  critical: { icon: Flame,        cls: "text-red-600",   label: "مرتفع جداً"  },
  warning:  { icon: ShieldAlert,  cls: "text-amber-500", label: "مرتفع"       },
  ok:       { icon: Info,         cls: "text-slate-300", label: ""            },
};

// ─── Category colours ────────────────────────────────────────────────────────
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
  return MAIN_COLORS[code.split("-").slice(0, 2).join("-")] ?? "text-slate-700 bg-slate-50 border-slate-200";
}

// ─── Category Picker ──────────────────────────────────────────────────────────
function CategoryPicker({ categories, value, onChange }: {
  categories: ExpenseCategory[]; value: string; onChange: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = categories.find(c => c.code === value);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white hover:border-slate-400 transition-colors">
        {selected
          ? <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold border ${getCatColor(selected.code)}`}>{selected.code} — {selected.nameAr}</span>
          : <span className="text-slate-400">اختر التصنيف...</span>}
        <ChevronDown className="w-4 h-4 opacity-50 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl max-h-72 overflow-y-auto">
          {categories.filter(c => c.level === 1).map(main => (
            <div key={main.code}>
              <button type="button" onClick={() => { onChange(main.code); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors text-left">
                <span className="text-xs text-slate-500 font-mono">{main.code}</span>
                <span>{main.nameAr}</span>
              </button>
              {categories.filter(s => s.parentCode === main.code).map(sub => (
                <button key={sub.code} type="button" onClick={() => { onChange(sub.code); setOpen(false); }}
                  className={`w-full flex items-center gap-2 px-6 py-2 text-sm hover:bg-slate-50 transition-colors text-left ${value === sub.code ? "bg-primary/10 text-primary font-semibold" : "text-slate-600"}`}>
                  <span className="text-xs opacity-60 font-mono">{sub.code}</span>
                  <span>{sub.nameAr}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── VAT Mode Selector ────────────────────────────────────────────────────────
function VatModeSelector({ value, onChange }: { value: VatMode; onChange: (m: VatMode) => void }) {
  const opts: { key: VatMode; label: string; sub: string }[] = [
    { key: "none",      label: "بدون ضريبة",      sub: "المبلغ صافي"               },
    { key: "exclusive", label: "يُضاف 15%",        sub: "الضريبة تُضاف على السعر"   },
    { key: "inclusive", label: "شامل الضريبة 15%", sub: "المبلغ المُدخَل يشمل الضريبة" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {opts.map(o => (
        <button key={o.key} type="button" onClick={() => onChange(o.key)}
          className={`flex flex-col items-center text-center px-2 py-2.5 rounded-xl border-2 text-xs font-medium transition-all ${
            value === o.key
              ? o.key === "none"      ? "border-slate-500 bg-slate-50 text-slate-700"
              : o.key === "exclusive" ? "border-amber-500 bg-amber-50 text-amber-700"
              :                         "border-emerald-500 bg-emerald-50 text-emerald-700"
              : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
          }`}>
          <Percent className={`w-4 h-4 mb-1 ${value === o.key ? "" : "opacity-40"}`} />
          <span className="font-semibold leading-tight">{o.label}</span>
          <span className="text-[10px] opacity-70 mt-0.5 leading-tight">{o.sub}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Transaction Form ─────────────────────────────────────────────────────────
const EMPTY: { date: string; categoryCode: string; description: string; inputAmount: string; vatMode: VatMode; costCenter: string; referenceNo: string; notes: string } = {
  date: today(), categoryCode: "", description: "", inputAmount: "",
  vatMode: "none", costCenter: "", referenceNo: "", notes: "",
};

function deriveVatMode(txn: ExpenseTransaction): VatMode {
  if (!txn.isVatApplicable) return "none";
  // If net × 1.15 ≈ total  → exclusive; if net + vat ≈ total and vat < net → could be either
  // We distinguish by checking if total ≈ stored amount × 1.15 (exclusive saved net as amount)
  // vs total ≈ amount (inclusive saved total as input, net as amount)
  // In our system we always store the NET in amount, so exclusive and inclusive both store net.
  // We can't reliably distinguish without an extra field, so default to exclusive.
  return "exclusive";
}

function TransactionForm({ categories, initial, onClose, onSave, isPending }: {
  categories: ExpenseCategory[];
  initial?: ExpenseTransaction;
  onClose: () => void;
  onSave: (data: CreateExpenseTransaction) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState(() => {
    if (!initial) return { ...EMPTY };
    return {
      date: initial.date,
      categoryCode: initial.categoryCode,
      description: initial.description,
      inputAmount: String(toNum(initial.amount)),
      vatMode: deriveVatMode(initial),
      costCenter: initial.costCenter ?? "",
      referenceNo: initial.referenceNo ?? "",
      notes: initial.notes ?? "",
    };
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => { const n = { ...e }; delete n[k]; return n; });
  }

  const inputAmt = parseFloat(form.inputAmount) || 0;
  const { net, vat, total } = computeVat(inputAmt, form.vatMode);

  function validate() {
    const e: Record<string, string> = {};
    if (!form.date)             e.date = "التاريخ مطلوب";
    if (!form.categoryCode)     e.categoryCode = "التصنيف مطلوب";
    if (!form.description.trim()) e.description = "الوصف مطلوب";
    if (!inputAmt || inputAmt <= 0) e.inputAmount = "أدخل مبلغاً صحيحاً";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    onSave({
      date: form.date,
      categoryCode: form.categoryCode,
      description: form.description,
      amount: net,
      isVatApplicable: form.vatMode !== "none",
      vatRate: 15,
      costCenter: form.costCenter || undefined,
      referenceNo: form.referenceNo || undefined,
      notes: form.notes || undefined,
    });
  }

  const amtLabel = form.vatMode === "inclusive" ? "المبلغ الإجمالي (شامل الضريبة)" :
                   form.vatMode === "exclusive" ? "المبلغ قبل الضريبة (صافي)"    : "المبلغ";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{initial ? "تعديل مصروف" : "إضافة مصروف جديد"}</h2>
            <p className="text-sm text-slate-500 mt-0.5">تسجيل قيد في شجرة المصروفات</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5" /></button>
        </div>

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
              <input type="text" value={form.referenceNo} onChange={e => set("referenceNo", e.target.value)}
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

          {/* VAT Mode */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">وضع ضريبة القيمة المضافة</label>
            <VatModeSelector value={form.vatMode} onChange={v => set("vatMode", v)} />
          </div>

          {/* Amount box */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-200">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{amtLabel} *</label>
                <div className="relative">
                  <input type="number" value={form.inputAmount} onChange={e => set("inputAmount", e.target.value)}
                    min="0" step="0.01" placeholder="0.00"
                    className="w-full pl-12 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none" />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">SAR</span>
                </div>
                {errors.inputAmount && <p className="text-red-500 text-xs mt-1">{errors.inputAmount}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">مركز التكلفة</label>
                <input type="text" value={form.costCenter} onChange={e => set("costCenter", e.target.value)}
                  placeholder="اختياري" className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none" />
              </div>
            </div>

            {/* Breakdown */}
            {inputAmt > 0 && (
              <div className={`grid gap-2 text-center text-xs border-t border-slate-200 pt-3 ${form.vatMode === "none" ? "grid-cols-1" : "grid-cols-3"}`}>
                <div>
                  <div className="text-slate-500 mb-0.5">صافي المبلغ</div>
                  <div className="font-bold text-slate-900 text-sm">{formatSAR(net)}</div>
                </div>
                {form.vatMode !== "none" && <>
                  <div>
                    <div className="text-slate-500 mb-0.5">ضريبة 15%</div>
                    <div className="font-bold text-amber-600 text-sm">{formatSAR(vat)}</div>
                  </div>
                  <div className="bg-primary/5 rounded-lg py-1">
                    <div className="text-slate-500 mb-0.5">الإجمالي</div>
                    <div className="font-bold text-primary text-sm">{formatSAR(total)}</div>
                  </div>
                </>}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">ملاحظات</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
              rows={2} placeholder="ملاحظات إضافية (اختياري)"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none resize-none" />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 p-6 border-t bg-slate-50 rounded-b-2xl">
          <div className="text-sm">
            <span className="text-slate-500">الإجمالي: </span>
            <span className="font-bold text-slate-900 text-base">{formatSAR(total)}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={isPending}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-medium transition-colors">إلغاء</button>
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

// ─── Summary Tree ─────────────────────────────────────────────────────────────
type SummaryNode = {
  code: string; name: string; nameAr: string; level: number;
  net: number; vat: number; total: number; count: number;
  children: SummaryNode[];
};

function SummaryTreeNode({ node, grandTotal, depth = 0 }: { node: SummaryNode; grandTotal: number; depth?: number }) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const colorCls = getCatColor(node.code);
  const share = pct(node.net, grandTotal);
  const risk: Risk = share >= 40 ? "critical" : share >= 25 ? "warning" : "ok";
  const RiskIcon = RISK_BADGE[risk].icon;

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer
          ${depth === 1 ? "border-b border-slate-100 font-semibold" : ""}
          ${risk === "critical" ? "bg-red-50/40" : risk === "warning" ? "bg-amber-50/30" : ""}
        `}
        style={{ paddingLeft: `${16 + depth * 20}px`, paddingRight: "16px" }}
        onClick={() => hasChildren && setOpen(o => !o)}
      >
        <div className="w-4 flex-shrink-0">
          {hasChildren && (open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />)}
        </div>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border ${colorCls} flex-shrink-0`}>{node.code}</span>
        <span className={`text-sm flex-1 ${depth <= 1 ? "font-bold text-slate-800" : "text-slate-700"}`}>{node.nameAr}</span>
        {node.total > 0 && (
          <div className="flex items-center gap-3 text-right flex-shrink-0">
            {node.vat > 0 && <span className="text-xs text-amber-600 hidden sm:block">ض.ق.م {formatSAR(node.vat)}</span>}
            {share > 0 && depth >= 1 && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-lg ${
                risk === "critical" ? "bg-red-100 text-red-700" :
                risk === "warning"  ? "bg-amber-100 text-amber-700" :
                                      "bg-slate-100 text-slate-500"
              }`}>
                {share.toFixed(1)}%
              </span>
            )}
            {risk !== "ok" && <RiskIcon className={`w-4 h-4 ${RISK_BADGE[risk].cls}`} />}
            <span className={`font-bold ${depth <= 1 ? "text-base text-slate-900" : "text-sm text-slate-700"}`}>
              {formatSAR(node.net)}
            </span>
          </div>
        )}
      </div>
      {open && node.children.map(child => (
        <SummaryTreeNode key={child.code} node={child} grandTotal={grandTotal} depth={depth + 1} />
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
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

  const { data: categories = [] } = useListExpenseCategories<ExpenseCategory[]>({});
  const { data: transactions = [], isLoading } = useListExpenseTransactions<ExpenseTransaction[]>({ month, categoryCode: filterCat || undefined });
  const { data: summary } = useGetExpenseSummary<{ tree: SummaryNode[] }>({ month });

  const invalidate = () => queryClient.invalidateQueries({ predicate: q => String(q.queryKey[0]).includes("expense") });

  const createMut = useCreateExpenseTransaction({ mutation: { onSuccess: () => { toast({ title: "تم حفظ المصروف" }); setFormOpen(false); invalidate(); }, onError: () => toast({ title: "خطأ في الحفظ", variant: "destructive" }) } });
  const updateMut = useUpdateExpenseTransaction({ mutation: { onSuccess: () => { toast({ title: "تم التحديث" }); setEditTxn(null); invalidate(); }, onError: () => toast({ title: "خطأ في التحديث", variant: "destructive" }) } });
  const deleteMut = useDeleteExpenseTransaction({ mutation: { onSuccess: () => { toast({ title: "تم الحذف" }); setDeleteId(null); invalidate(); }, onError: () => toast({ title: "خطأ في الحذف", variant: "destructive" }) } });

  const filtered = useMemo(() => {
    let list = [...transactions];
    if (searchQ) { const q = searchQ.toLowerCase(); list = list.filter(t => t.description.toLowerCase().includes(q) || t.categoryCode.includes(q)); }
    return list;
  }, [transactions, searchQ]);

  const totalNet   = filtered.reduce((s, t) => s + toNum(t.amount), 0);
  const totalVat   = filtered.reduce((s, t) => s + toNum(t.vatAmount), 0);
  const totalGross = filtered.reduce((s, t) => s + toNum(t.totalAmount), 0);

  // Warnings: items ≥ 15% of total
  const riskItems = filtered.filter(t => pct(toNum(t.amount), totalNet) >= 15);

  const getCatLabel = (code: string) => categories.find(c => c.code === code);

  function shiftMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  const MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  const [my, mm] = month.split("-").map(Number);
  const monthLabel = `${MONTHS[mm - 1]} ${my}`;

  const grandTotal = (summary?.tree ?? []).reduce((s: number, n: SummaryNode) => s + n.net, 0);

  return (
    <div className="space-y-6">
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

      {/* Month + View Toggle */}
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
        <div className="flex bg-slate-100 rounded-xl p-1">
          <button onClick={() => setView("table")} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === "table" ? "bg-white shadow text-slate-900" : "text-slate-500"}`}><Table2 className="w-4 h-4" /></button>
          <button onClick={() => setView("tree")} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === "tree" ? "bg-white shadow text-slate-900" : "text-slate-500"}`}><BarChart2 className="w-4 h-4" /></button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "إجمالي المصروفات (صافي)", value: totalNet, color: "text-slate-900" },
          { label: "ضريبة القيمة المضافة",    value: totalVat, color: "text-amber-600" },
          { label: "الإجمالي شامل الضريبة",   value: totalGross, color: "text-primary" },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="text-sm text-slate-500 mb-1">{k.label}</div>
            <div className={`text-2xl font-bold ${k.color}`}>{formatSAR(k.value)}</div>
          </div>
        ))}
      </div>

      {/* ── Warning Panel ────────────────────────────────────────────────────── */}
      {riskItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            تنبيهات — مصروفات تستحق المراجعة ({riskItems.length})
          </div>
          <div className="space-y-2">
            {riskItems.map(t => {
              const share = pct(toNum(t.amount), totalNet);
              const isCritical = share >= 30;
              const cat = getCatLabel(t.categoryCode);
              return (
                <div key={t.id} className={`flex items-center gap-3 p-3 rounded-xl border ${isCritical ? "bg-red-50 border-red-200" : "bg-white border-amber-200"}`}>
                  {isCritical
                    ? <Flame className="w-4 h-4 text-red-500 flex-shrink-0" />
                    : <ShieldAlert className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-800 truncate">{t.description}</div>
                    <div className="text-xs text-slate-500">{cat?.nameAr ?? t.categoryCode} · {t.date}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`text-sm font-bold ${isCritical ? "text-red-700" : "text-amber-700"}`}>{formatSAR(toNum(t.amount))}</div>
                    <div className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${isCritical ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"}`}>
                      {share.toFixed(1)}% من الإجمالي
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-amber-600 flex items-center gap-1">
            <Info className="w-3.5 h-3.5" />
            مصروف يتجاوز 15% من إجمالي المصروفات يستحق المراجعة · أكثر من 30% يُعدّ تهديداً مالياً
          </p>
        </div>
      )}

      {/* ── Tree View ──────────────────────────────────────────────────────── */}
      {view === "tree" && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">شجرة المصروفات المحاسبية</h3>
              <p className="text-sm text-slate-500 mt-0.5">تجميع الأرقام حسب التصنيف المحاسبي — الإشارات الحمراء تعني نسبة مرتفعة</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">الإجمالي</div>
              <div className="text-lg font-bold text-slate-900">{formatSAR(grandTotal)}</div>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {(summary?.tree ?? []).map((node: SummaryNode) => (
              <SummaryTreeNode key={node.code} node={node} grandTotal={grandTotal} depth={0} />
            ))}
            {(!summary?.tree || summary.tree.length === 0) && (
              <div className="py-12 text-center text-slate-400">لا توجد بيانات لهذا الشهر</div>
            )}
          </div>
        </div>
      )}

      {/* ── Table View ──────────────────────────────────────────────────────── */}
      {view === "table" && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
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
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1"><Flame className="w-3.5 h-3.5 text-red-500" /> &gt;30% تهديد</span>
              <span className="flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5 text-amber-400" /> &gt;15% مرتفع</span>
            </div>
          </div>

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
                    <th className="px-4 py-3 font-semibold text-slate-600 w-8"></th>
                    <th className="px-4 py-3 font-semibold text-slate-600">التاريخ</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">التصنيف</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">الوصف</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">مركز التكلفة</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">صافي</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">ضريبة</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">الإجمالي</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">النسبة</th>
                    <th className="px-4 py-3 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(txn => {
                    const net = toNum(txn.amount);
                    const share = pct(net, totalNet);
                    const risk = getRisk(net, totalNet);
                    const cat = getCatLabel(txn.categoryCode);
                    const RiskIcon = RISK_BADGE[risk].icon;
                    return (
                      <tr key={txn.id} className={`transition-colors hover:brightness-95 ${RISK_ROW[risk]}`}>
                        <td className="px-3 py-3">
                          {risk !== "ok" && <RiskIcon className={`w-4 h-4 ${RISK_BADGE[risk].cls}`} />}
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{txn.date}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border ${getCatColor(txn.categoryCode)}`}>{txn.categoryCode}</span>
                          {cat && <div className="text-xs text-slate-500 mt-0.5">{cat.nameAr}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800">{txn.description}</div>
                          {txn.notes && <div className="text-xs text-slate-400">{txn.notes}</div>}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{txn.costCenter ?? "—"}</td>
                        <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{formatSAR(net)}</td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          {txn.isVatApplicable
                            ? <><span className="text-amber-600 font-medium">{formatSAR(toNum(txn.vatAmount))}</span><br /><span className="text-slate-400">15%</span></>
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 font-bold text-primary whitespace-nowrap">{formatSAR(toNum(txn.totalAmount))}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <div className="w-14 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div className={`h-full rounded-full ${risk === "critical" ? "bg-red-500" : risk === "warning" ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${Math.min(share, 100)}%` }} />
                            </div>
                            <span className={`text-xs font-semibold ${risk === "critical" ? "text-red-600" : risk === "warning" ? "text-amber-600" : "text-slate-500"}`}>
                              {share.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setEditTxn(txn)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-700"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setDeleteId(txn.id)} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold">
                    <td colSpan={5} className="px-4 py-3 text-slate-700 text-right">الإجمالي ({filtered.length} قيد)</td>
                    <td className="px-4 py-3 text-slate-900">{formatSAR(totalNet)}</td>
                    <td className="px-4 py-3 text-amber-600">{formatSAR(totalVat)}</td>
                    <td className="px-4 py-3 text-primary">{formatSAR(totalGross)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Form Modal */}
      {(formOpen || editTxn) && (
        <TransactionForm
          categories={categories.filter(c => c.level >= 1)}
          initial={editTxn ?? undefined}
          onClose={() => { setFormOpen(false); setEditTxn(null); }}
          onSave={data => {
            if (editTxn) updateMut.mutate({ id: editTxn.id, data });
            else         createMut.mutate({ data });
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
              <button onClick={() => deleteMut.mutate({ id: deleteId })} disabled={deleteMut.isPending}
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
