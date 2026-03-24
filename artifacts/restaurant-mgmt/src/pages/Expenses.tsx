import { useState } from "react";
import { useListExpenses } from "@workspace/api-client-react";
import { useExpenseMutations } from "@/hooks/use-expenses";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatSAR, formatDate } from "@/lib/format";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, CalendarDays } from "lucide-react";

const expSchema = z.object({
  name: z.string().min(1),
  monthlyCost: z.coerce.number().min(0),
  contractStartDate: z.string().optional(),
  contractEndDate: z.string().optional()
});
type ExpForm = z.infer<typeof expSchema>;

export default function Expenses() {
  const [open, setOpen] = useState(false);
  const { data: expenses, isLoading } = useListExpenses();
  const { create, remove } = useExpenseMutations();

  const form = useForm<ExpForm>({ resolver: zodResolver(expSchema) });

  return (
    <div>
      <PageHeader 
        title="Fixed Monthly Expenses" 
        description="Rent, utilities, licenses, and other recurring costs."
        action={
          <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl shadow-lg hover:-translate-y-0.5 transition-all">
            <Plus className="w-4 h-4" /> Add Expense
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? <p>Loading...</p> : 
          expenses?.map(e => (
            <div key={e.id} className="bg-card rounded-2xl p-6 shadow-sm border relative group flex flex-col justify-between">
              <button onClick={() => remove.mutate({ id: e.id })} className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
                <Trash2 className="w-4 h-4" />
              </button>
              <div>
                <h3 className="font-bold text-lg text-slate-900 mb-1">{e.name}</h3>
                <p className="text-3xl font-display font-bold text-blue-600 mt-4">{formatSAR(e.monthlyCost)}<span className="text-sm text-slate-400 font-normal"> /mo</span></p>
              </div>
              {(e.contractStartDate || e.contractEndDate) && (
                <div className="mt-6 pt-4 border-t border-slate-100 text-sm text-slate-500 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4" />
                  <span>{formatDate(e.contractStartDate)} &rarr; {formatDate(e.contractEndDate)}</span>
                </div>
              )}
            </div>
          ))
        }
      </div>

      {open && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">New Fixed Expense</h2></div>
            <form onSubmit={form.handleSubmit(d => create.mutate({ data: d }, { onSuccess: () => { setOpen(false); form.reset(); } }))} className="p-6 space-y-4">
              <div><label className="block text-sm mb-1">Expense Name (e.g. Rent, POS License)</label><input {...form.register("name")} className="w-full px-3 py-2 border rounded-xl" /></div>
              <div><label className="block text-sm mb-1">Monthly Cost (SAR)</label><input type="number" step="0.01" {...form.register("monthlyCost")} className="w-full px-3 py-2 border rounded-xl" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm mb-1">Contract Start</label><input type="date" {...form.register("contractStartDate")} className="w-full px-3 py-2 border rounded-xl" /></div>
                <div><label className="block text-sm mb-1">Contract End</label><input type="date" {...form.register("contractEndDate")} className="w-full px-3 py-2 border rounded-xl" /></div>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t">
                <button type="button" onClick={() => setOpen(false)} className="px-4 py-2">Cancel</button>
                <button type="submit" disabled={create.isPending} className="px-6 py-2 bg-primary text-white rounded-xl shadow-md">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
