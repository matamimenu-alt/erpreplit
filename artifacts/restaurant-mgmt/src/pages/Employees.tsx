import { useState } from "react";
import { useListEmployees } from "@workspace/api-client-react";
import { useEmployeeMutations } from "@/hooks/use-employees";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatSAR, formatDate } from "@/lib/format";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, Calendar } from "lucide-react";

const hrSchema = z.object({
  name: z.string().min(1),
  jobTitle: z.string().min(1),
  salary: z.coerce.number().min(0),
  iqamaExpiryDate: z.string().optional(),
  iqamaRenewalDate: z.string().optional(),
  lastTravelDate: z.string().optional(),
  vacationBalance: z.coerce.number().min(0),
  accommodationCost: z.coerce.number().min(0),
  medicalInsurance: z.coerce.number().min(0),
  gosiInsurance: z.coerce.number().min(0),
  airTicketCost: z.coerce.number().min(0),
});
type HRForm = z.infer<typeof hrSchema>;

export default function Employees() {
  const [open, setOpen] = useState(false);
  const { data: employees, isLoading } = useListEmployees();
  const { create, remove } = useEmployeeMutations();

  const form = useForm<HRForm>({ 
    resolver: zodResolver(hrSchema),
    defaultValues: { salary: 0, vacationBalance: 0, accommodationCost: 0, medicalInsurance: 0, gosiInsurance: 0, airTicketCost: 0 }
  });

  return (
    <div>
      <PageHeader 
        title="Human Resources" 
        description="Manage staff, Iqama dates, and compute true monthly costs."
        action={
          <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl shadow-lg hover:-translate-y-0.5 transition-all">
            <Plus className="w-4 h-4" /> Add Employee
          </button>
        }
      />

      <div className="bg-card rounded-2xl shadow-sm border overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-600 font-medium border-b">
            <tr>
              <th className="px-4 py-4">Employee</th>
              <th className="px-4 py-4">Iqama Expiry</th>
              <th className="px-4 py-4 text-right">Base Salary</th>
              <th className="px-4 py-4 text-right">Accomm.</th>
              <th className="px-4 py-4 text-right">Medical/GOSI</th>
              <th className="px-4 py-4 text-right">Air Ticket/mo</th>
              <th className="px-4 py-4 text-right bg-blue-50/50">Total Mo. Cost</th>
              <th className="px-4 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y text-slate-700">
            {isLoading ? <tr><td colSpan={8} className="p-8 text-center">Loading...</td></tr> : 
              employees?.map(e => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4">
                    <div className="font-bold text-slate-900">{e.name}</div>
                    <div className="text-xs text-slate-500">{e.jobTitle}</div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-slate-400"/>{formatDate(e.iqamaExpiryDate)}</span>
                  </td>
                  <td className="px-4 py-4 text-right">{formatSAR(e.salary)}</td>
                  <td className="px-4 py-4 text-right text-slate-500">{formatSAR(e.accommodationCost)}</td>
                  <td className="px-4 py-4 text-right text-slate-500">{formatSAR(e.medicalInsurance + e.gosiInsurance)}</td>
                  <td className="px-4 py-4 text-right text-slate-500">{formatSAR(e.airTicketCost / 12)}</td>
                  <td className="px-4 py-4 text-right font-bold text-blue-700 bg-blue-50/20">{formatSAR(e.totalMonthlyCost)}</td>
                  <td className="px-4 py-4 text-right">
                    <button onClick={() => remove.mutate({ id: e.id })} className="text-rose-500 p-2 hover:bg-rose-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b shrink-0"><h2 className="text-xl font-bold">New Employee Record</h2></div>
            <div className="overflow-y-auto p-6">
              <form id="hr-form" onSubmit={form.handleSubmit(d => create.mutate({ data: d }, { onSuccess: () => { setOpen(false); form.reset(); } }))} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm mb-1">Name</label><input {...form.register("name")} className="w-full px-3 py-2 border rounded-xl" /></div>
                  <div><label className="block text-sm mb-1">Job Title</label><input {...form.register("jobTitle")} className="w-full px-3 py-2 border rounded-xl" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm mb-1">Iqama Expiry Date</label><input type="date" {...form.register("iqamaExpiryDate")} className="w-full px-3 py-2 border rounded-xl" /></div>
                  <div><label className="block text-sm mb-1">Vacation Balance (days)</label><input type="number" {...form.register("vacationBalance")} className="w-full px-3 py-2 border rounded-xl" /></div>
                </div>
                
                <h3 className="font-bold text-slate-800 border-b pb-2 pt-4">Financials & Benefits (Monthly values except Ticket)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm mb-1">Base Salary (SAR)</label><input type="number" step="0.01" {...form.register("salary")} className="w-full px-3 py-2 border rounded-xl" /></div>
                  <div><label className="block text-sm mb-1">Accommodation</label><input type="number" step="0.01" {...form.register("accommodationCost")} className="w-full px-3 py-2 border rounded-xl" /></div>
                  <div><label className="block text-sm mb-1">Medical Ins. (Monthly)</label><input type="number" step="0.01" {...form.register("medicalInsurance")} className="w-full px-3 py-2 border rounded-xl" /></div>
                  <div><label className="block text-sm mb-1">GOSI (Monthly)</label><input type="number" step="0.01" {...form.register("gosiInsurance")} className="w-full px-3 py-2 border rounded-xl" /></div>
                  <div className="col-span-2"><label className="block text-sm mb-1">Annual Air Ticket Allowance (will be divided by 12)</label><input type="number" step="0.01" {...form.register("airTicketCost")} className="w-full px-3 py-2 border rounded-xl" /></div>
                </div>
              </form>
            </div>
            <div className="p-4 border-t shrink-0 flex justify-end gap-3 bg-slate-50">
              <button onClick={() => setOpen(false)} className="px-4 py-2">Cancel</button>
              <button form="hr-form" type="submit" disabled={create.isPending} className="px-6 py-2 bg-primary text-white rounded-xl shadow-md">Save Employee</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
