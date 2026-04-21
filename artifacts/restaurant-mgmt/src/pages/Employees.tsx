import { useState, useEffect, memo } from "react";
import { useListEmployees } from "@workspace/api-client-react";
import { useEmployeeMutations } from "@/hooks/use-employees";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatSAR, formatDate } from "@/lib/format";
import { exportToExcel } from "@/lib/export-excel";
import { useForm, useWatch, FormProvider, useFormContext } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, Pencil, Users, Wallet, TrendingUp, FileSpreadsheet, X, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";

// ──────────────────────────────── Schema ────────────────────────────────
const empSchema = z.object({
  designation: z.string().min(1, "Required"),
  fullTime: z.boolean(),
  name: z.string().min(1, "Required"),
  nationality: z.string().optional(),
  joiningDate: z.string().optional(),
  salary: z.coerce.number().min(0),
  overtime: z.coerce.number().min(0),
  deductions: z.coerce.number().min(0),
  absences: z.coerce.number().min(0),
  iqamaExpiryDate: z.string().optional(),
  iqamaRenewalDate: z.string().optional(),
});
type EmpForm = z.infer<typeof empSchema>;

const DEFAULT: EmpForm = {
  designation: "", fullTime: true, name: "", nationality: "",
  joiningDate: "", salary: 0, overtime: 0, deductions: 0, absences: 0,
  iqamaExpiryDate: "", iqamaRenewalDate: "",
};

// ── Module-level helpers ──────────────────────────────────────────────

const TD = memo(({ children, className = "", colSpan }: { children?: React.ReactNode; className?: string; colSpan?: number }) => (
  <td colSpan={colSpan} className={`px-3 py-3 text-xs border-r border-slate-100 last:border-0 ${className}`}>{children}</td>
));

const TH = memo(({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <th className={`px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 border-r border-slate-200 last:border-0 whitespace-nowrap ${className}`}>{children}</th>
));

const THR = memo(({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <TH className={`text-right ${className}`}>{children}</TH>
));

const TDR = memo(({ v, className = "" }: { v: number; className?: string }) => (
  <TD className={`text-right tabular-nums ${className}`}>{formatSAR(v)}</TD>
));

const FormField = memo(({ label, name, type = "number", step = "0.01", hint }: {
  label: string; name: keyof EmpForm; type?: string; step?: string; hint?: string;
}) => {
  const form = useFormContext<EmpForm>();
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      <input
        type={type}
        step={type === "number" ? step : undefined}
        min={type === "number" ? "0" : undefined}
        {...form.register(name)}
        className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
      {form.formState.errors[name] && (
        <p className="text-xs text-rose-500 mt-0.5">{(form.formState.errors[name] as { message?: string })?.message}</p>
      )}
    </div>
  );
});

// ──────────────────── Live calculation preview ─────────────────────────
function usePayrollPreview(form: ReturnType<typeof useForm<EmpForm>>) {
  const salary = Number(useWatch({ control: form.control, name: "salary" })) || 0;
  const overtime = Number(useWatch({ control: form.control, name: "overtime" })) || 0;
  const deductions = Number(useWatch({ control: form.control, name: "deductions" })) || 0;
  const absences = Number(useWatch({ control: form.control, name: "absences" })) || 0;
  const netSalary = +(salary + overtime - deductions - absences).toFixed(2);
  return { salary, overtime, deductions, absences, netSalary };
}

// ──────────────────── Form Modal ───────────────────────────────────────
function EmpModal({
  open, title, defaultValues, onClose, onSubmit, isPending,
}: {
  open: boolean; title: string; defaultValues: EmpForm;
  onClose: () => void; onSubmit: (d: EmpForm) => void; isPending: boolean;
}) {
  const form = useForm<EmpForm>({ resolver: zodResolver(empSchema), defaultValues });
  useEffect(() => { if (open) form.reset(defaultValues); }, [open]);

  const p = usePayrollPreview(form);
  const fullTime = useWatch({ control: form.control, name: "fullTime" });

  if (!open) return null;

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

              {/* Employee Info */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b pb-1 mb-3">Employee Information</h4>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Designation / Position *" name="designation" type="text" />
                  <FormField label="Full Name *" name="name" type="text" />
                  <FormField label="Nationality" name="nationality" type="text" />
                  <FormField label="Joining Date" name="joiningDate" type="date" />
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Employment Type</label>
                    <div className="flex gap-3 mt-1">
                      {[{ v: true, l: "Full Time" }, { v: false, l: "Part Time" }].map(({ v, l }) => (
                        <label key={l} className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" value={String(v)}
                            checked={fullTime === v}
                            onChange={() => form.setValue("fullTime", v)}
                            className="accent-primary" />
                          <span className="text-sm">{l}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <FormField label="Iqama Expiry" name="iqamaExpiryDate" type="date" />
                    <FormField label="Iqama Renewal" name="iqamaRenewalDate" type="date" />
                  </div>
                </div>
              </div>

              {/* Payroll */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b pb-1 mb-3">Payroll</h4>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Basic Salary (SAR/month) *" name="salary" hint="Monthly gross salary" />
                  <FormField label="Overtime (SAR/month)" name="overtime" hint="Extra hours / additional pay" />
                  <FormField label="Deductions (SAR/month)" name="deductions" hint="Any regular deductions" />
                  <FormField label="Absences (SAR/month)" name="absences" hint="Value of absent days" />
                </div>

                {/* Info note */}
                <div className="mt-3 flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-xs text-blue-700">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>
                    Iqama costs, visa fees, medical insurance, and travel tickets should be recorded under <strong>Fixed Expenses → Staff Expenses</strong>.
                  </span>
                </div>

                {/* Net Salary preview */}
                <div className="mt-3 bg-primary/10 rounded-xl px-4 py-3 text-sm">
                  <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
                    <span>Basic Salary</span><span className="tabular-nums">{formatSAR(p.salary)}</span>
                  </div>
                  {p.overtime > 0 && (
                    <div className="flex items-center justify-between text-emerald-700 text-xs mb-2">
                      <span>+ Overtime</span><span className="tabular-nums">+{formatSAR(p.overtime)}</span>
                    </div>
                  )}
                  {p.deductions > 0 && (
                    <div className="flex items-center justify-between text-rose-600 text-xs mb-2">
                      <span>− Deductions</span><span className="tabular-nums">−{formatSAR(p.deductions)}</span>
                    </div>
                  )}
                  {p.absences > 0 && (
                    <div className="flex items-center justify-between text-rose-600 text-xs mb-2">
                      <span>− Absences</span><span className="tabular-nums">−{formatSAR(p.absences)}</span>
                    </div>
                  )}
                  <div className="border-t pt-2 flex items-center justify-between">
                    <span className="font-bold text-primary">Net Salary / Month</span>
                    <span className="text-xl font-extrabold text-primary">{formatSAR(p.netSalary)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 border-t bg-slate-50 shrink-0 flex justify-end gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl">Cancel</button>
              <button type="submit" disabled={isPending} className="px-6 py-2 bg-primary text-white rounded-xl shadow-md disabled:opacity-60">
                {isPending ? "Saving..." : "Save Employee"}
              </button>
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  );
}

// ──────────────────── Main Page ────────────────────────────────────────
export default function Employees() {
  const [addOpen, setAddOpen] = useState(false);
  const [editEmp, setEditEmp] = useState<{ id: number; data: EmpForm } | null>(null);

  const { data: employees, isLoading } = useListEmployees();
  const { create, update, remove } = useEmployeeMutations();

  const emps = employees ?? [];

  const totalCount = emps.length;
  const fullTimeCount = emps.filter(e => e.fullTime).length;
  const totalBasic = emps.reduce((s, e) => s + e.salary, 0);
  const totalOvertime = emps.reduce((s, e) => s + e.overtime, 0);
  const totalDeductions = emps.reduce((s, e) => s + (e.deductions + e.absences), 0);
  const totalNet = emps.reduce((s, e) => s + e.netSalary, 0);

  function openEdit(e: (typeof emps)[0]) {
    setEditEmp({
      id: e.id,
      data: {
        designation: e.designation,
        fullTime: e.fullTime,
        name: e.name,
        nationality: e.nationality,
        joiningDate: e.joiningDate ?? "",
        salary: e.salary,
        overtime: e.overtime,
        deductions: e.deductions,
        absences: e.absences,
        iqamaExpiryDate: e.iqamaExpiryDate ?? "",
        iqamaRenewalDate: e.iqamaRenewalDate ?? "",
      },
    });
  }

  function handleCreate(data: EmpForm) {
    create.mutate({ data }, {
      onSuccess: () => {
        setAddOpen(false);
        toast({ title: "Employee added", description: "Payroll record saved." });
      }
    });
  }

  function handleUpdate(data: EmpForm) {
    if (!editEmp) return;
    update.mutate({ id: editEmp.id, data }, {
      onSuccess: () => {
        setEditEmp(null);
        toast({ title: "Employee updated", description: "Changes saved." });
      }
    });
  }

  function handleExport() {
    const rows = emps.map(e => ({
      "Designation": e.designation,
      "Employee Name": e.name,
      "Type": e.fullTime ? "Full Time" : "Part Time",
      "Nationality": e.nationality,
      "Joining Date": e.joiningDate ?? "",
      "# Months": e.numberOfMonths,
      "Basic Salary (SAR)": e.salary,
      "Overtime (SAR)": e.overtime,
      "Deductions (SAR)": e.deductions,
      "Absences (SAR)": e.absences,
      "Net Salary (SAR)": e.netSalary,
    }));
    exportToExcel(rows, "payroll-report", "Payroll");
  }

  return (
    <div>
      <PageHeader
        title="HR & Payroll"
        description="Employee payroll — Net Salary = Basic + Overtime − Deductions − Absences."
        action={
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm">
              <FileSpreadsheet className="w-4 h-4" /> Export Excel
            </button>
            <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl shadow-lg hover:-translate-y-0.5 transition-all">
              <Plus className="w-4 h-4" /> Add Employee
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Employees", value: String(totalCount), sub: `${fullTimeCount} full time`, icon: Users, color: "bg-blue-50 border-blue-200 text-blue-700" },
          { label: "Total Basic Salaries", value: formatSAR(totalBasic), sub: "Monthly gross", icon: Wallet, color: "bg-slate-50 border-slate-200 text-slate-700" },
          { label: "Total Overtime", value: formatSAR(totalOvertime), sub: "Additional pay", icon: TrendingUp, color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
          { label: "Total Net Payroll", value: formatSAR(totalNet), sub: `After ${formatSAR(totalDeductions)} deductions`, icon: Wallet, color: "bg-primary/10 border-primary/30 text-primary" },
        ].map((k, i) => (
          <div key={i} className={`rounded-2xl border p-5 ${k.color}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold uppercase tracking-wide opacity-60">{k.label}</p>
              <k.icon className="w-4 h-4 opacity-50" />
            </div>
            <p className="text-xl font-extrabold">{k.value}</p>
            <p className="text-[11px] mt-1 opacity-50">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Staff Expenses Note */}
      <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          <strong>Note:</strong> Employee-related costs such as Iqama renewal, visa fees, medical insurance, and travel tickets are recorded under <strong>Fixed Expenses → Staff Expenses</strong> — not in payroll.
        </span>
      </div>

      {/* Payroll Table */}
      <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-widest">
                <th colSpan={5} className="px-3 py-2 bg-slate-100 text-slate-500 border-r border-slate-300 text-center">Employee Info</th>
                <th colSpan={4} className="px-3 py-2 bg-blue-50 text-blue-600 border-r border-blue-200 text-center">Payroll</th>
                <th colSpan={1} className="px-3 py-2 bg-primary/10 text-primary text-center">Net</th>
                <th className="px-3 py-2 bg-slate-50" />
              </tr>
              <tr className="bg-slate-50 border-b-2 border-slate-200">
                <TH>Designation</TH>
                <TH>Type</TH>
                <TH>Employee Name</TH>
                <TH>Nationality</TH>
                <TH className="border-r-2 border-slate-300"># Months</TH>
                <THR className="bg-blue-50/50">Basic Salary</THR>
                <THR className="bg-blue-50/50">Overtime</THR>
                <THR className="bg-rose-50/50">Deductions</THR>
                <THR className="bg-rose-50/50 border-r-2 border-rose-100">Absences</THR>
                <THR className="bg-primary/5 font-bold text-primary">Net Salary</THR>
                <TH className="w-14" />
              </tr>
            </thead>
            <tbody className="divide-y text-slate-700">
              {isLoading ? (
                <tr><td colSpan={11} className="py-12 text-center text-slate-400">Loading payroll data...</td></tr>
              ) : emps.length === 0 ? (
                <tr><td colSpan={11} className="py-12 text-center text-slate-400">No employees yet. Click "Add Employee" to start.</td></tr>
              ) : (
                emps.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                    <TD><span className="font-medium text-slate-800">{e.designation}</span></TD>
                    <TD>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${e.fullTime ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                        {e.fullTime ? "Full" : "Part"}
                      </span>
                    </TD>
                    <TD><span className="font-semibold">{e.name}</span></TD>
                    <TD className="text-slate-500">{e.nationality || "—"}</TD>
                    <TD className="border-r-2 border-slate-200 text-slate-500 text-center">{e.numberOfMonths || "—"}</TD>
                    <TDR v={e.salary} className="bg-blue-50/20 font-semibold text-blue-800" />
                    <TDR v={e.overtime} className={`bg-blue-50/20 ${e.overtime > 0 ? "text-emerald-700 font-semibold" : "text-slate-400"}`} />
                    <TDR v={e.deductions} className={`bg-rose-50/20 ${e.deductions > 0 ? "text-rose-600" : "text-slate-400"}`} />
                    <TDR v={e.absences} className={`bg-rose-50/20 border-r-2 border-rose-100 ${e.absences > 0 ? "text-rose-600" : "text-slate-400"}`} />
                    <TDR v={e.netSalary} className="bg-primary/10 font-extrabold text-primary" />
                    <TD>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(e)} className="p-1.5 text-primary hover:bg-primary/10 rounded-lg">
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button onClick={() => remove.mutate({ id: e.id })} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </TD>
                  </tr>
                ))
              )}
            </tbody>
            {emps.length > 0 && (
              <tfoot className="border-t-2 border-slate-300 bg-slate-100 font-bold text-slate-800 text-xs">
                <tr>
                  <TD colSpan={5} className="border-r-2 border-slate-300 text-slate-500">{totalCount} employees</TD>
                  <TDR v={totalBasic} className="bg-blue-100 text-blue-900 text-sm" />
                  <TDR v={totalOvertime} className="bg-blue-100 text-emerald-800 text-sm" />
                  <TDR v={emps.reduce((s, e) => s + e.deductions, 0)} className="bg-rose-100 text-rose-800 text-sm" />
                  <TDR v={emps.reduce((s, e) => s + e.absences, 0)} className="bg-rose-100 text-rose-800 text-sm border-r-2 border-rose-200" />
                  <TDR v={totalNet} className="bg-primary/20 text-primary text-sm" />
                  <TD />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {emps.length > 0 && (
          <div className="px-4 py-2 bg-slate-50 border-t text-[11px] text-slate-400">
            Net Salary = Basic Salary + Overtime − Deductions − Absences
          </div>
        )}
      </div>

      <EmpModal open={addOpen} title="Add Employee" defaultValues={DEFAULT}
        onClose={() => setAddOpen(false)} onSubmit={handleCreate} isPending={create.isPending} />

      {editEmp && (
        <EmpModal open={!!editEmp} title="Edit Employee" defaultValues={editEmp.data}
          onClose={() => setEditEmp(null)} onSubmit={handleUpdate} isPending={update.isPending} />
      )}
    </div>
  );
}
