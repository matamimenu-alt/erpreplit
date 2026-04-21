import { useState, memo } from "react";
import { useListExpenses } from "@workspace/api-client-react";
import { useExpenseMutations } from "@/hooks/use-expenses";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatSAR, formatDate } from "@/lib/format";
import { exportToExcel } from "@/lib/export-excel";
import { useForm, FormProvider, useFormContext } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, CalendarDays, Smartphone, Building2, X, FileSpreadsheet, Users } from "lucide-react";

// ────────────── Schemas ───────────────────────────────────────────────────────

const fixedSchema = z.object({
  category: z.literal("fixed"),
  name: z.string().min(1, "Required"),
  monthlyCost: z.coerce.number().min(0, "Must be ≥ 0"),
  notes: z.string().optional(),
  contractStartDate: z.string().optional(),
  contractEndDate: z.string().optional(),
});

const commissionSchema = z.object({
  category: z.literal("app-commission"),
  name: z.string().min(1, "Required"),
  monthlyCost: z.coerce.number().min(0, "Must be ≥ 0"),
  notes: z.string().optional(),
  contractStartDate: z.string().optional(),
  contractEndDate: z.string().optional(),
});

const staffExpenseSchema = z.object({
  category: z.literal("staff-expenses"),
  name: z.string().min(1, "Required"),
  monthlyCost: z.coerce.number().min(0, "Must be ≥ 0"),
  notes: z.string().optional(),
  contractStartDate: z.string().optional(),
  contractEndDate: z.string().optional(),
});

type FixedForm = z.infer<typeof fixedSchema>;
type CommissionForm = z.infer<typeof commissionSchema>;
type StaffExpenseForm = z.infer<typeof staffExpenseSchema>;
type AnyExpenseForm = FixedForm | CommissionForm | StaffExpenseForm;

const APP_OPTIONS = ["HungerStation", "Jahez", "Noon Food", "Careem", "Other App"];

const STAFF_EXPENSE_TYPES = [
  "Iqama Renewal",
  "Visa Fees",
  "Medical Insurance",
  "Travel Ticket",
  "Government Fees",
  "Work Permit",
  "Recruitment Fees",
  "Other Staff Expense",
];

// ────────────── Module-level Form Field ──────────────────────────────────────
const Field = memo(({ label, name, type = "text", step, placeholder }: {
  label: string; name: string; type?: string; step?: string; placeholder?: string;
}) => {
  const form = useFormContext();
  const err = form.formState.errors[name] as { message?: string } | undefined;
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      <input
        type={type}
        step={step}
        min={type === "number" ? "0" : undefined}
        placeholder={placeholder}
        {...form.register(name)}
        className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      {err?.message && <p className="text-xs text-rose-500 mt-0.5">{err.message}</p>}
    </div>
  );
});

// ────────────── Fixed Expense Modal ──────────────────────────────────────────
function FixedModal({ open, title, defaultValues, onClose, onSubmit, isPending }: {
  open: boolean; title: string; defaultValues: FixedForm;
  onClose: () => void; onSubmit: (d: FixedForm) => void; isPending: boolean;
}) {
  const form = useForm<FixedForm>({ resolver: zodResolver(fixedSchema), defaultValues });
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95">
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><X className="w-4 h-4" /></button>
        </div>
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-5 space-y-4">
            <Field label="Expense Name (e.g. Rent, POS License, Utilities)" name="name" placeholder="e.g. Monthly Rent" />
            <Field label="Monthly Cost (SAR)" name="monthlyCost" type="number" step="0.01" placeholder="0.00" />
            <Field label="Notes (optional)" name="notes" placeholder="Any additional details" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contract Start" name="contractStartDate" type="date" />
              <Field label="Contract End" name="contractEndDate" type="date" />
            </div>
            <div className="pt-3 flex justify-end gap-3 border-t">
              <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
              <button type="submit" disabled={isPending} className="px-6 py-2 bg-primary text-white rounded-xl shadow-md disabled:opacity-60">
                {isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  );
}

// ────────────── Staff Expense Modal ──────────────────────────────────────────
function StaffExpenseModal({ open, title, defaultValues, onClose, onSubmit, isPending }: {
  open: boolean; title: string; defaultValues: StaffExpenseForm;
  onClose: () => void; onSubmit: (d: StaffExpenseForm) => void; isPending: boolean;
}) {
  const form = useForm<StaffExpenseForm>({ resolver: zodResolver(staffExpenseSchema), defaultValues });
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95">
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2"><Users className="w-5 h-5 text-orange-600" />{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><X className="w-4 h-4" /></button>
        </div>
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Expense Type *</label>
              <select
                {...form.register("name")}
                className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-white"
              >
                <option value="">Select type...</option>
                {STAFF_EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {form.formState.errors.name && <p className="text-xs text-rose-500 mt-0.5">{form.formState.errors.name.message}</p>}
            </div>
            <Field label="Monthly Cost (SAR)" name="monthlyCost" type="number" step="0.01" placeholder="0.00" />
            <Field label="Notes (e.g. employee name, reference)" name="notes" placeholder="e.g. Ahmed's Iqama - expires Mar 2026" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start Date" name="contractStartDate" type="date" />
              <Field label="End Date" name="contractEndDate" type="date" />
            </div>
            <div className="pt-3 flex justify-end gap-3 border-t">
              <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
              <button type="submit" disabled={isPending} className="px-6 py-2 bg-orange-600 text-white rounded-xl shadow-md disabled:opacity-60">
                {isPending ? "Saving..." : "Save Staff Expense"}
              </button>
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  );
}

// ────────────── App Commission Modal ─────────────────────────────────────────
function CommissionModal({ open, title, defaultValues, onClose, onSubmit, isPending }: {
  open: boolean; title: string; defaultValues: CommissionForm;
  onClose: () => void; onSubmit: (d: CommissionForm) => void; isPending: boolean;
}) {
  const form = useForm<CommissionForm>({ resolver: zodResolver(commissionSchema), defaultValues });
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95">
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2"><Smartphone className="w-5 h-5 text-purple-600" />{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><X className="w-4 h-4" /></button>
        </div>
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">App / Platform</label>
              <select
                {...form.register("name")}
                className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-white"
              >
                <option value="">Select app...</option>
                {APP_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              {form.formState.errors.name && <p className="text-xs text-rose-500 mt-0.5">{form.formState.errors.name.message}</p>}
            </div>
            <Field label="Monthly Commission Amount (SAR)" name="monthlyCost" type="number" step="0.01" placeholder="0.00" />
            <Field label="Notes (e.g. commission %, contract reference)" name="notes" placeholder="e.g. 18% of app sales" />
            <div className="pt-3 flex justify-end gap-3 border-t">
              <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
              <button type="submit" disabled={isPending} className="px-6 py-2 bg-purple-600 text-white rounded-xl shadow-md disabled:opacity-60">
                {isPending ? "Saving..." : "Save Commission"}
              </button>
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  );
}

// ────────────── Edit Modal (generic) ─────────────────────────────────────────
type ExpenseRecord = { id: number; category: string; name: string; monthlyCost: number; notes?: string; contractStartDate?: string; contractEndDate?: string };

function EditModal({ open, record, onClose, onSubmit, isPending }: {
  open: boolean; record: ExpenseRecord | null;
  onClose: () => void; onSubmit: (d: AnyExpenseForm) => void; isPending: boolean;
}) {
  if (!open || !record) return null;
  if (record.category === "app-commission") {
    return (
      <CommissionModal
        open={open} title="Edit App Commission"
        defaultValues={{ category: "app-commission", name: record.name, monthlyCost: record.monthlyCost, notes: record.notes || "", contractStartDate: record.contractStartDate || "", contractEndDate: record.contractEndDate || "" }}
        onClose={onClose} onSubmit={onSubmit as (d: CommissionForm) => void} isPending={isPending}
      />
    );
  }
  if (record.category === "staff-expenses") {
    return (
      <StaffExpenseModal
        open={open} title="Edit Staff Expense"
        defaultValues={{ category: "staff-expenses", name: record.name, monthlyCost: record.monthlyCost, notes: record.notes || "", contractStartDate: record.contractStartDate || "", contractEndDate: record.contractEndDate || "" }}
        onClose={onClose} onSubmit={onSubmit as (d: StaffExpenseForm) => void} isPending={isPending}
      />
    );
  }
  return (
    <FixedModal
      open={open} title="Edit Fixed Expense"
      defaultValues={{ category: "fixed", name: record.name, monthlyCost: record.monthlyCost, notes: record.notes || "", contractStartDate: record.contractStartDate || "", contractEndDate: record.contractEndDate || "" }}
      onClose={onClose} onSubmit={onSubmit as (d: FixedForm) => void} isPending={isPending}
    />
  );
}

// ────────────── Expense Card ──────────────────────────────────────────────────
function ExpenseCard({ e, onEdit, onDelete, accentClass, badgeClass, badgeLabel }: {
  e: ExpenseRecord; onEdit: () => void; onDelete: () => void;
  accentClass: string; badgeClass: string; badgeLabel: string;
}) {
  return (
    <div className={`bg-card rounded-2xl p-5 shadow-sm border relative group flex flex-col justify-between hover:shadow-md transition-shadow`}>
      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
        <button onClick={onEdit} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"><Pencil className="w-3.5 h-3.5" /></button>
        <button onClick={onDelete} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${badgeClass}`}>{badgeLabel}</span>
        </div>
        <h3 className="font-bold text-slate-900 text-base">{e.name}</h3>
        {e.notes && <p className="text-xs text-slate-500 mt-1">{e.notes}</p>}
        <p className={`text-3xl font-extrabold mt-3 ${accentClass}`}>{formatSAR(e.monthlyCost)}<span className="text-sm text-slate-400 font-normal"> /mo</span></p>
      </div>
      {(e.contractStartDate || e.contractEndDate) && (
        <div className="mt-4 pt-3 border-t text-xs text-slate-500 flex items-center gap-2">
          <CalendarDays className="w-3.5 h-3.5" />
          <span>{e.contractStartDate ? formatDate(e.contractStartDate) : "—"} → {e.contractEndDate ? formatDate(e.contractEndDate) : "—"}</span>
        </div>
      )}
    </div>
  );
}

// ────────────── Main Page ─────────────────────────────────────────────────────
export default function Expenses() {
  const [addFixed, setAddFixed] = useState(false);
  const [addCommission, setAddCommission] = useState(false);
  const [addStaff, setAddStaff] = useState(false);
  const [editRecord, setEditRecord] = useState<ExpenseRecord | null>(null);

  const { data: allExpenses = [], isLoading } = useListExpenses();
  const { create, update, remove } = useExpenseMutations();

  const fixedExpenses = allExpenses.filter(e => (e.category ?? "fixed") === "fixed");
  const commissions = allExpenses.filter(e => e.category === "app-commission");
  const staffExpenses = allExpenses.filter(e => e.category === "staff-expenses");

  const totalFixed = fixedExpenses.reduce((s, e) => s + e.monthlyCost, 0);
  const totalCommissions = commissions.reduce((s, e) => s + e.monthlyCost, 0);
  const totalStaff = staffExpenses.reduce((s, e) => s + e.monthlyCost, 0);
  const grandTotal = totalFixed + totalCommissions + totalStaff;

  function handleCreate(data: AnyExpenseForm) {
    create.mutate({ data: data as Parameters<typeof create.mutate>[0]["data"] }, {
      onSuccess: () => {
        setAddFixed(false);
        setAddCommission(false);
        setAddStaff(false);
        toast({ title: "Expense added", description: "Changes saved successfully." });
      },
    });
  }

  function handleUpdate(data: AnyExpenseForm) {
    if (!editRecord) return;
    update.mutate({ id: editRecord.id, data: data as Parameters<typeof update.mutate>[0]["data"] }, {
      onSuccess: () => {
        setEditRecord(null);
        toast({ title: "Expense updated", description: "Changes saved successfully." });
      },
    });
  }

  function handleDelete(id: number) {
    if (!confirm("Delete this expense?")) return;
    remove.mutate({ id }, { onSuccess: () => toast({ title: "Expense deleted" }) });
  }

  function handleExport() {
    const rows = allExpenses.map(e => ({
      Category: e.category === "app-commission" ? "App Commission" : e.category === "staff-expenses" ? "Staff Expenses" : "Fixed Expense",
      Name: e.name,
      "Monthly Cost (SAR)": e.monthlyCost,
      Notes: e.notes || "",
      "Contract Start": e.contractStartDate || "",
      "Contract End": e.contractEndDate || "",
    }));
    exportToExcel(rows, "expenses", "Expenses");
  }

  function openEdit(e: typeof allExpenses[0]) {
    setEditRecord({ id: e.id, category: e.category ?? "fixed", name: e.name, monthlyCost: e.monthlyCost, notes: e.notes ?? undefined, contractStartDate: e.contractStartDate ?? undefined, contractEndDate: e.contractEndDate ?? undefined });
  }

  return (
    <div>
      <PageHeader
        title="Fixed Expenses"
        description="Track recurring monthly costs, delivery app commissions, and employee-related expenses."
        action={
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm">
              <FileSpreadsheet className="w-4 h-4" /> Export Excel
            </button>
            <button onClick={() => setAddStaff(true)} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-xl shadow-lg hover:-translate-y-0.5 transition-all text-sm">
              <Users className="w-4 h-4" /> Add Staff Expense
            </button>
            <button onClick={() => setAddCommission(true)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl shadow-lg hover:-translate-y-0.5 transition-all text-sm">
              <Smartphone className="w-4 h-4" /> Add App Commission
            </button>
            <button onClick={() => setAddFixed(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl shadow-lg hover:-translate-y-0.5 transition-all text-sm">
              <Plus className="w-4 h-4" /> Add Fixed Expense
            </button>
          </div>
        }
      />

      {/* ── Summary KPI ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-blue-700">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-4 h-4 opacity-70" />
            <p className="text-xs font-bold uppercase tracking-wide opacity-60">Fixed Expenses</p>
          </div>
          <p className="text-2xl font-extrabold">{formatSAR(totalFixed)}</p>
          <p className="text-[11px] opacity-50 mt-1">{fixedExpenses.length} items / month</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 text-orange-700">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 opacity-70" />
            <p className="text-xs font-bold uppercase tracking-wide opacity-60">Staff Expenses</p>
          </div>
          <p className="text-2xl font-extrabold">{formatSAR(totalStaff)}</p>
          <p className="text-[11px] opacity-50 mt-1">{staffExpenses.length} items — iqama, visa, insurance…</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 text-purple-700">
          <div className="flex items-center gap-2 mb-1">
            <Smartphone className="w-4 h-4 opacity-70" />
            <p className="text-xs font-bold uppercase tracking-wide opacity-60">App Commissions</p>
          </div>
          <p className="text-2xl font-extrabold">{formatSAR(totalCommissions)}</p>
          <p className="text-[11px] opacity-50 mt-1">{commissions.length} apps / month</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 text-white">
          <p className="text-xs font-bold uppercase tracking-wide opacity-60 mb-1">Total Monthly Overhead</p>
          <p className="text-2xl font-extrabold">{formatSAR(grandTotal)}</p>
          <p className="text-[11px] opacity-50 mt-1">Fixed + Staff + Commissions</p>
        </div>
      </div>

      {/* ── Fixed Expenses Section ── */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-slate-800">Fixed Monthly Expenses</h2>
          <span className="ml-auto text-sm font-semibold text-blue-700">{formatSAR(totalFixed)} / month</span>
        </div>
        {isLoading ? (
          <p className="text-slate-400 text-sm">Loading...</p>
        ) : fixedExpenses.length === 0 ? (
          <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center text-slate-400 text-sm">
            No fixed expenses yet — click "Add Fixed Expense" to add rent, utilities, licenses, etc.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {fixedExpenses.map(e => (
              <ExpenseCard key={e.id} e={{ id: e.id, category: e.category ?? "fixed", name: e.name, monthlyCost: e.monthlyCost, notes: e.notes ?? undefined, contractStartDate: e.contractStartDate ?? undefined, contractEndDate: e.contractEndDate ?? undefined }}
                onEdit={() => openEdit(e)}
                onDelete={() => handleDelete(e.id)}
                accentClass="text-blue-600"
                badgeClass="bg-blue-100 text-blue-700"
                badgeLabel="Fixed"
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Staff Expenses Section ── */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-orange-600" />
          <h2 className="text-lg font-bold text-slate-800">Staff Expenses</h2>
          <span className="text-xs text-slate-400 ml-1">(Iqama, Visa, Medical Insurance, Travel Tickets, Gov Fees…)</span>
          <span className="ml-auto text-sm font-semibold text-orange-700">{formatSAR(totalStaff)} / month</span>
        </div>
        {isLoading ? (
          <p className="text-slate-400 text-sm">Loading...</p>
        ) : staffExpenses.length === 0 ? (
          <div className="border-2 border-dashed border-orange-200 rounded-2xl p-8 text-center text-slate-400 text-sm">
            No staff expenses yet — click "Add Staff Expense" to record Iqama renewals, visa fees, medical insurance, travel tickets, and government fees.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {staffExpenses.map(e => (
              <ExpenseCard key={e.id} e={{ id: e.id, category: e.category ?? "staff-expenses", name: e.name, monthlyCost: e.monthlyCost, notes: e.notes ?? undefined, contractStartDate: e.contractStartDate ?? undefined, contractEndDate: e.contractEndDate ?? undefined }}
                onEdit={() => openEdit(e)}
                onDelete={() => handleDelete(e.id)}
                accentClass="text-orange-600"
                badgeClass="bg-orange-100 text-orange-700"
                badgeLabel="Staff"
              />
            ))}
          </div>
        )}
      </section>

      {/* ── App Commission Section ── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Smartphone className="w-5 h-5 text-purple-600" />
          <h2 className="text-lg font-bold text-slate-800">App Commission Expenses</h2>
          <span className="text-xs text-slate-400 ml-1">(HungerStation, Jahez, Noon, Careem…)</span>
          <span className="ml-auto text-sm font-semibold text-purple-700">{formatSAR(totalCommissions)} / month</span>
        </div>
        {isLoading ? (
          <p className="text-slate-400 text-sm">Loading...</p>
        ) : commissions.length === 0 ? (
          <div className="border-2 border-dashed border-purple-200 rounded-2xl p-8 text-center text-slate-400 text-sm">
            No app commissions yet — click "Add App Commission" to track HungerStation, Jahez, Noon, etc.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {commissions.map(e => (
              <ExpenseCard key={e.id} e={{ id: e.id, category: e.category ?? "app-commission", name: e.name, monthlyCost: e.monthlyCost, notes: e.notes ?? undefined, contractStartDate: e.contractStartDate ?? undefined, contractEndDate: e.contractEndDate ?? undefined }}
                onEdit={() => openEdit(e)}
                onDelete={() => handleDelete(e.id)}
                accentClass="text-purple-600"
                badgeClass="bg-purple-100 text-purple-700"
                badgeLabel="App Commission"
              />
            ))}
          </div>
        )}
      </section>

      {/* Modals */}
      <FixedModal
        open={addFixed} title="Add Fixed Expense"
        defaultValues={{ category: "fixed", name: "", monthlyCost: 0, notes: "", contractStartDate: "", contractEndDate: "" }}
        onClose={() => setAddFixed(false)} onSubmit={handleCreate} isPending={create.isPending}
      />
      <StaffExpenseModal
        open={addStaff} title="Add Staff Expense"
        defaultValues={{ category: "staff-expenses", name: "", monthlyCost: 0, notes: "", contractStartDate: "", contractEndDate: "" }}
        onClose={() => setAddStaff(false)} onSubmit={handleCreate} isPending={create.isPending}
      />
      <CommissionModal
        open={addCommission} title="Add App Commission"
        defaultValues={{ category: "app-commission", name: "", monthlyCost: 0, notes: "", contractStartDate: "", contractEndDate: "" }}
        onClose={() => setAddCommission(false)} onSubmit={handleCreate} isPending={create.isPending}
      />
      <EditModal
        open={!!editRecord} record={editRecord}
        onClose={() => setEditRecord(null)} onSubmit={handleUpdate} isPending={update.isPending}
      />
    </div>
  );
}
