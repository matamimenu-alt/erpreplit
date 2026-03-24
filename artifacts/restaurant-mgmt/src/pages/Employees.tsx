import { useState, useEffect } from "react";
import { useListEmployees } from "@workspace/api-client-react";
import { useEmployeeMutations } from "@/hooks/use-employees";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatSAR, formatDate } from "@/lib/format";
import { exportToExcel } from "@/lib/export-excel";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, Pencil, Users, Wallet, BadgeCheck, FileSpreadsheet, X } from "lucide-react";

// ──────────────────────────────── Schema ────────────────────────────────
const empSchema = z.object({
  designation: z.string().min(1, "Required"),
  fullTime: z.boolean(),
  name: z.string().min(1, "Required"),
  nationality: z.string().optional(),
  joiningDate: z.string().optional(),
  salary: z.coerce.number().min(0),
  socialSecurity: z.coerce.number().min(0),
  laborFees: z.coerce.number().min(0),
  iqamaRenewalYearly: z.coerce.number().min(0),
  medicalInsurance: z.coerce.number().min(0),
  airTicketCost: z.coerce.number().min(0),
  foodMeal: z.coerce.number().min(0),
  iqamaExpiryDate: z.string().optional(),
  iqamaRenewalDate: z.string().optional(),
});
type EmpForm = z.infer<typeof empSchema>;

const DEFAULT: EmpForm = {
  designation: "",
  fullTime: true,
  name: "",
  nationality: "",
  joiningDate: "",
  salary: 0,
  socialSecurity: 0,
  laborFees: 0,
  iqamaRenewalYearly: 0,
  medicalInsurance: 0,
  airTicketCost: 0,
  foodMeal: 0,
  iqamaExpiryDate: "",
  iqamaRenewalDate: "",
};

// ──────────────────── Live calculation preview ─────────────────────────
function usePayrollPreview(form: ReturnType<typeof useForm<EmpForm>>) {
  const salary = Number(useWatch({ control: form.control, name: "salary" })) || 0;
  const ss = Number(useWatch({ control: form.control, name: "socialSecurity" })) || 0;
  const lf = Number(useWatch({ control: form.control, name: "laborFees" })) || 0;
  const iqama = Number(useWatch({ control: form.control, name: "iqamaRenewalYearly" })) || 0;
  const medical = Number(useWatch({ control: form.control, name: "medicalInsurance" })) || 0;
  const ticket = Number(useWatch({ control: form.control, name: "airTicketCost" })) || 0;
  const food = Number(useWatch({ control: form.control, name: "foodMeal" })) || 0;

  const monthlyIqama = +(iqama / 12).toFixed(2);
  const monthlyMedical = +(medical / 12).toFixed(2);
  const monthlyTicket = +(ticket / 12).toFixed(2);
  const monthlyIndemnity = +(salary / 12).toFixed(2);
  const monthlyVacation = +((salary / 30 * 21) / 12).toFixed(2);
  const totalTaxes = +(ss + lf + monthlyIqama).toFixed(2);
  const totalBenefits = +(monthlyMedical + monthlyIndemnity + monthlyTicket + monthlyVacation + food).toFixed(2);
  const totalCost = +(salary + totalTaxes + totalBenefits).toFixed(2);

  return { monthlyIqama, monthlyMedical, monthlyTicket, monthlyIndemnity, monthlyVacation, totalTaxes, totalBenefits, totalCost };
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

  if (!open) return null;

  const F = ({ label, name, type = "number", step = "0.01", hint }: {
    label: string; name: keyof EmpForm; type?: string; step?: string; hint?: string;
  }) => (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      <input
        type={type}
        step={type === "number" ? step : undefined}
        min={type === "number" ? "0" : undefined}
        {...form.register(name)}
        className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-primary"
      />
      {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
      {form.formState.errors[name] && (
        <p className="text-xs text-rose-500 mt-0.5">{(form.formState.errors[name] as { message?: string })?.message}</p>
      )}
    </div>
  );

  const SH = ({ t }: { t: string }) => (
    <h4 className="col-span-full text-xs font-bold uppercase tracking-widest text-slate-400 border-b pt-3 pb-1">{t}</h4>
  );

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-3xl rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 max-h-[92vh] flex flex-col">
        <div className="p-5 border-b flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto flex-1 p-5">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">

              {/* Employee Information */}
              <SH t="Employee Information" />
              <F label="Designation / Job Title *" name="designation" type="text" />
              <F label="Full Name *" name="name" type="text" />
              <F label="Nationality" name="nationality" type="text" />
              <F label="Joining Date" name="joiningDate" type="date" />
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Employment Type</label>
                <div className="flex gap-3 mt-1">
                  {[{ v: true, l: "Full Time" }, { v: false, l: "Part Time" }].map(({ v, l }) => (
                    <label key={l} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" value={String(v)}
                        checked={form.watch("fullTime") === v}
                        onChange={() => form.setValue("fullTime", v)}
                        className="accent-primary" />
                      <span className="text-sm">{l}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <F label="Iqama Expiry" name="iqamaExpiryDate" type="date" />
                <F label="Iqama Renewal Date" name="iqamaRenewalDate" type="date" />
              </div>

              {/* Salary */}
              <SH t="Basic Salary" />
              <F label="Basic Salary (SAR/month) *" name="salary" hint="Monthly gross salary" />
              <div />

              {/* Payroll Taxes */}
              <SH t="Monthly Payroll Taxes" />
              <F label="Social Security / GOSI (SAR/month)" name="socialSecurity" hint="Monthly GOSI contribution amount" />
              <F label="Labor Fees (SAR/month)" name="laborFees" hint="Monthly government labor fees" />
              <F label="Iqama Renewal (SAR/year)" name="iqamaRenewalYearly" hint={`Monthly = SAR ${(Number(form.watch("iqamaRenewalYearly")) / 12).toFixed(2)}`} />
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm col-span-full">
                <div className="flex justify-between"><span className="text-slate-600">Total Payroll Taxes / month</span><span className="font-bold">{formatSAR(p.totalTaxes)}</span></div>
              </div>

              {/* Benefits */}
              <SH t="Employee Benefits" />
              <F label="Medical Insurance (SAR/year)" name="medicalInsurance" hint={`Monthly = SAR ${(Number(form.watch("medicalInsurance")) / 12).toFixed(2)}`} />
              <F label="Air Ticket (SAR/year)" name="airTicketCost" hint={`Monthly provision = SAR ${(Number(form.watch("airTicketCost")) / 12).toFixed(2)}`} />
              <F label="Food / Meal Allowance (SAR/month)" name="foodMeal" />
              <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500 space-y-1 col-span-full">
                <p><span className="font-semibold">Indemnity:</span> SAR {formatSAR(p.monthlyIndemnity)}/mo (= Salary ÷ 12)</p>
                <p><span className="font-semibold">Annual Vacation:</span> SAR {formatSAR(p.monthlyVacation)}/mo (= Salary ÷ 30 × 21 days ÷ 12)</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm col-span-full">
                <div className="flex justify-between"><span className="text-slate-600">Total Employee Benefits / month</span><span className="font-bold text-emerald-700">{formatSAR(p.totalBenefits)}</span></div>
              </div>
            </div>
          </div>

          {/* Footer with total */}
          <div className="p-5 border-t bg-slate-50 shrink-0">
            <div className="flex items-center justify-between mb-4 bg-primary/10 rounded-xl px-4 py-3">
              <span className="font-bold text-primary">Total Monthly Labor Cost per Employee</span>
              <span className="text-xl font-extrabold text-primary">{formatSAR(p.totalCost)}</span>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl">Cancel</button>
              <button type="submit" disabled={isPending} className="px-6 py-2 bg-primary text-white rounded-xl shadow-md disabled:opacity-60">
                {isPending ? "Saving..." : "Save Employee"}
              </button>
            </div>
          </div>
        </form>
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

  // Aggregates
  const totalCount = emps.length;
  const fullTimeCount = emps.filter(e => e.fullTime).length;
  const totalSalaries = emps.reduce((s, e) => s + e.salary, 0);
  const totalPayrollTaxes = emps.reduce((s, e) => s + e.totalPayrollTaxes, 0);
  const totalBenefits = emps.reduce((s, e) => s + e.totalEmployeesBenefits, 0);
  const totalLaborCost = emps.reduce((s, e) => s + e.totalMonthlyCost, 0);

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
        socialSecurity: e.socialSecurity,
        laborFees: e.laborFees,
        iqamaRenewalYearly: e.iqamaRenewalYearly,
        medicalInsurance: e.medicalInsurance,
        airTicketCost: e.airTicketCost,
        foodMeal: e.foodMeal,
        iqamaExpiryDate: e.iqamaExpiryDate ?? "",
        iqamaRenewalDate: e.iqamaRenewalDate ?? "",
      },
    });
  }

  function handleCreate(data: EmpForm) {
    create.mutate({ data }, { onSuccess: () => setAddOpen(false) });
  }

  function handleUpdate(data: EmpForm) {
    if (!editEmp) return;
    update.mutate({ id: editEmp.id, data }, { onSuccess: () => setEditEmp(null) });
  }

  function handleExport() {
    const rows = emps.map(e => ({
      "Designation": e.designation,
      "Full Time": e.fullTime ? "Yes" : "No",
      "Employee Name": e.name,
      "Nationality": e.nationality,
      "Joining Date": e.joiningDate ?? "",
      "# Months": e.numberOfMonths,
      "Basic Salary (SAR)": e.salary,
      "Social Security (SAR/mo)": e.socialSecurity,
      "Labor Fees (SAR/mo)": e.laborFees,
      "Iqama Renewal (SAR/yr)": e.iqamaRenewalYearly,
      "Monthly Iqama (SAR)": e.monthlyIqamaRenewal,
      "Total Payroll Taxes (SAR)": e.totalPayrollTaxes,
      "Medical Insurance (SAR/yr)": e.medicalInsurance,
      "Monthly Medical (SAR)": e.monthlyMedical,
      "Indemnity/mo (SAR)": e.monthlyIndemnity,
      "Air Ticket (SAR/yr)": e.airTicketCost,
      "Monthly Air Ticket (SAR)": e.monthlyAirTicket,
      "Annual Vacation/mo (SAR)": e.monthlyVacation,
      "Food Meal (SAR/mo)": e.foodMeal,
      "Total Benefits (SAR)": e.totalEmployeesBenefits,
      "Total Labor Cost (SAR)": e.totalMonthlyCost,
    }));
    exportToExcel(rows, "payroll-report", "Payroll");
  }

  const TD = ({ children, className = "", colSpan }: { children?: React.ReactNode; className?: string; colSpan?: number }) => (
    <td colSpan={colSpan} className={`px-2.5 py-3 text-xs border-r border-slate-100 last:border-0 ${className}`}>{children}</td>
  );
  const TH = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <th className={`px-2.5 py-2 text-left text-[11px] font-semibold text-slate-500 border-r border-slate-200 last:border-0 whitespace-nowrap ${className}`}>{children}</th>
  );
  const THR = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <TH className={`text-right ${className}`}>{children}</TH>
  );
  const TDR = ({ v, className = "" }: { v: number; className?: string }) => (
    <TD className={`text-right tabular-nums ${className}`}>{formatSAR(v)}</TD>
  );

  return (
    <div>
      <PageHeader
        title="HR & Payroll"
        description="Employee payroll table with automatic monthly cost calculations."
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

      {/* ── Labor Cost Summary Dashboard ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Employees", value: String(totalCount), sub: `${fullTimeCount} full time`, icon: Users, color: "bg-blue-50 border-blue-200 text-blue-700" },
          { label: "Total Salaries & Wages", value: formatSAR(totalSalaries), sub: "Monthly payroll", icon: Wallet, color: "bg-slate-50 border-slate-200 text-slate-700" },
          { label: "Total Employee Benefits", value: formatSAR(totalBenefits), sub: "Medical + Indemnity + Ticket + Vacation + Food", icon: BadgeCheck, color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
          { label: "Total Labor Cost", value: formatSAR(totalLaborCost), sub: "All-in monthly cost", icon: Wallet, color: "bg-primary/10 border-primary/30 text-primary" },
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

      {/* ── Payroll Table ── */}
      <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            {/* Column group headers */}
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-widest">
                <th colSpan={6} className="px-2.5 py-2 bg-slate-100 text-slate-500 border-r border-slate-300 text-center">Employee Information</th>
                <th colSpan={1} className="px-2.5 py-2 bg-blue-50 text-blue-600 border-r border-blue-200 text-center">Salary</th>
                <th colSpan={4} className="px-2.5 py-2 bg-amber-50 text-amber-700 border-r border-amber-200 text-center">Monthly Payroll Taxes</th>
                <th colSpan={5} className="px-2.5 py-2 bg-emerald-50 text-emerald-700 border-r border-emerald-200 text-center">Employee Benefits (Monthly)</th>
                <th colSpan={2} className="px-2.5 py-2 bg-primary/10 text-primary border-r border-primary/20 text-center">Final Cost</th>
                <th className="px-2.5 py-2 bg-slate-50" />
              </tr>
              <tr className="bg-slate-50 border-b-2 border-slate-200">
                {/* Employee Info */}
                <TH>Designation</TH>
                <TH>Type</TH>
                <TH>Employee Name</TH>
                <TH>Nationality</TH>
                <TH>Joining Date</TH>
                <TH className="border-r-2 border-slate-300"># Months</TH>
                {/* Salary */}
                <THR className="bg-blue-50/50 border-r-2 border-blue-200">B. Salary</THR>
                {/* Payroll Taxes */}
                <THR className="bg-amber-50/50">Social Security</THR>
                <THR className="bg-amber-50/50">Labor Fees</THR>
                <THR className="bg-amber-50/50">Iqama /mo</THR>
                <THR className="bg-amber-50/50 border-r-2 border-amber-200 font-bold text-amber-800">Total Taxes</THR>
                {/* Benefits */}
                <THR className="bg-emerald-50/50">Medical /mo</THR>
                <THR className="bg-emerald-50/50">Indemnity /mo</THR>
                <THR className="bg-emerald-50/50">Air Ticket /mo</THR>
                <THR className="bg-emerald-50/50">Vacation /mo</THR>
                <THR className="bg-emerald-50/50 border-r-2 border-emerald-200">Food Meal</THR>
                {/* Final */}
                <THR className="bg-primary/5">Total Benefits</THR>
                <THR className="bg-primary/10 font-bold text-primary">Total Labor Cost</THR>
                <TH className="w-14" />
              </tr>
            </thead>
            <tbody className="divide-y text-slate-700">
              {isLoading ? (
                <tr><td colSpan={19} className="py-12 text-center text-slate-400">Loading payroll data...</td></tr>
              ) : emps.length === 0 ? (
                <tr><td colSpan={19} className="py-12 text-center text-slate-400">No employees added yet. Click "Add Employee" to start.</td></tr>
              ) : (
                emps.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                    {/* Employee Info */}
                    <TD><span className="font-medium text-slate-800">{e.designation}</span></TD>
                    <TD>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${e.fullTime ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                        {e.fullTime ? "Full" : "Part"}
                      </span>
                    </TD>
                    <TD><span className="font-semibold">{e.name}</span></TD>
                    <TD className="text-slate-500">{e.nationality || "—"}</TD>
                    <TD className="text-slate-500">{e.joiningDate ? formatDate(e.joiningDate) : "—"}</TD>
                    <TD className="border-r-2 border-slate-200 text-slate-500 text-center">{e.numberOfMonths || "—"}</TD>
                    {/* Salary */}
                    <TDR v={e.salary} className="bg-blue-50/20 font-bold text-blue-800 border-r-2 border-blue-100" />
                    {/* Payroll Taxes */}
                    <TDR v={e.socialSecurity} className="bg-amber-50/20" />
                    <TDR v={e.laborFees} className="bg-amber-50/20" />
                    <TDR v={e.monthlyIqamaRenewal} className="bg-amber-50/20" />
                    <TDR v={e.totalPayrollTaxes} className="bg-amber-50/30 font-bold text-amber-800 border-r-2 border-amber-100" />
                    {/* Benefits */}
                    <TDR v={e.monthlyMedical} className="bg-emerald-50/20" />
                    <TDR v={e.monthlyIndemnity} className="bg-emerald-50/20" />
                    <TDR v={e.monthlyAirTicket} className="bg-emerald-50/20" />
                    <TDR v={e.monthlyVacation} className="bg-emerald-50/20" />
                    <TDR v={e.foodMeal} className="bg-emerald-50/20 border-r-2 border-emerald-100" />
                    {/* Final */}
                    <TDR v={e.totalEmployeesBenefits} className="bg-primary/5 font-semibold" />
                    <TDR v={e.totalMonthlyCost} className="bg-primary/10 font-extrabold text-primary" />
                    {/* Actions */}
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
                  <TD colSpan={6} className="border-r-2 border-slate-300 text-slate-500">
                    {totalCount} employees
                  </TD>
                  <TDR v={totalSalaries} className="bg-blue-100 border-r-2 border-blue-200 text-blue-900 text-sm" />
                  <TD className="bg-amber-50" />
                  <TD className="bg-amber-50" />
                  <TD className="bg-amber-50" />
                  <TDR v={totalPayrollTaxes} className="bg-amber-100 border-r-2 border-amber-200 text-amber-900 text-sm" />
                  <TD className="bg-emerald-50" />
                  <TD className="bg-emerald-50" />
                  <TD className="bg-emerald-50" />
                  <TD className="bg-emerald-50" />
                  <TD className="bg-emerald-50 border-r-2 border-emerald-200" />
                  <TDR v={totalBenefits} className="bg-primary/5 text-sm" />
                  <TDR v={totalLaborCost} className="bg-primary/20 text-primary text-sm" />
                  <TD />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Formula Legend */}
        {emps.length > 0 && (
          <div className="px-4 py-3 bg-slate-50 border-t text-[11px] text-slate-400 flex flex-wrap gap-x-6 gap-y-1">
            <span>Total Labor Cost = Basic Salary + Payroll Taxes + Benefits</span>
            <span>Payroll Taxes = Social Security + Labor Fees + Iqama ÷ 12</span>
            <span>Benefits = Medical÷12 + Indemnity (Salary÷12) + Ticket÷12 + Vacation (Salary÷30×21÷12) + Food</span>
          </div>
        )}
      </div>

      {/* Add Modal */}
      <EmpModal
        open={addOpen}
        title="New Employee Record"
        defaultValues={DEFAULT}
        onClose={() => setAddOpen(false)}
        onSubmit={handleCreate}
        isPending={create.isPending}
      />

      {/* Edit Modal */}
      {editEmp && (
        <EmpModal
          open={!!editEmp}
          title="Edit Employee"
          defaultValues={editEmp.data}
          onClose={() => setEditEmp(null)}
          onSubmit={handleUpdate}
          isPending={update.isPending}
        />
      )}
    </div>
  );
}
