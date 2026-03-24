import { useState } from "react";
import { useListSales, useGetMonthlySalesSummary } from "@workspace/api-client-react";
import { useSalesMutations } from "@/hooks/use-sales";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatSAR, formatDate, formatMonth } from "@/lib/format";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";

const saleSchema = z.object({
  date: z.string().min(1, "Date is required"),
  foodSales: z.coerce.number().min(0, "Must be positive"),
  beverageSales: z.coerce.number().min(0, "Must be positive"),
});

type SaleFormValues = z.infer<typeof saleSchema>;

export default function Sales() {
  const [month, setMonth] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const { data: sales, isLoading } = useListSales(month ? { month } : undefined);
  const { data: summary } = useGetMonthlySalesSummary();
  const { create, remove } = useSalesMutations();

  const form = useForm<SaleFormValues>({
    resolver: zodResolver(saleSchema),
    defaultValues: { date: new Date().toISOString().split('T')[0], foodSales: 0, beverageSales: 0 }
  });

  const onSubmit = (data: SaleFormValues) => {
    create.mutate({ data }, {
      onSuccess: () => {
        setIsDialogOpen(false);
        form.reset();
      }
    });
  };

  return (
    <div>
      <PageHeader 
        title="Sales & Revenue" 
        description="Daily sales records and automatic VAT tracking."
        action={
          <div className="flex gap-3">
            <input 
              type="month" 
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="px-4 py-2 border rounded-xl shadow-sm focus:ring-primary/20 outline-none"
            />
            <button 
              onClick={() => setIsDialogOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all"
            >
              <Plus className="w-4 h-4" /> Add Record
            </button>
          </div>
        }
      />

      {/* Summary Cards */}
      {summary && summary.length > 0 && !month && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-card p-6 rounded-2xl border shadow-sm">
            <h4 className="text-sm font-medium text-slate-500">Current Month Total</h4>
            <p className="text-2xl font-bold mt-2">{formatSAR(summary[0].totalSales)}</p>
          </div>
          <div className="bg-card p-6 rounded-2xl border shadow-sm">
            <h4 className="text-sm font-medium text-slate-500">Output VAT (15%)</h4>
            <p className="text-2xl font-bold mt-2">{formatSAR(summary[0].totalOutputVat)}</p>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Food Sales</th>
                <th className="px-6 py-4 text-right">Beverage Sales</th>
                <th className="px-6 py-4 text-right">Total Sales</th>
                <th className="px-6 py-4 text-right">Output VAT (15%)</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y text-slate-700">
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-8">Loading records...</td></tr>
              ) : sales?.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500">No records found for {formatMonth(month)}</td></tr>
              ) : (
                sales?.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium">{formatDate(sale.date)}</td>
                    <td className="px-6 py-4 text-right">{formatSAR(sale.foodSales)}</td>
                    <td className="px-6 py-4 text-right">{formatSAR(sale.beverageSales)}</td>
                    <td className="px-6 py-4 text-right font-semibold">{formatSAR(sale.totalSales)}</td>
                    <td className="px-6 py-4 text-right text-purple-600 font-medium">{formatSAR(sale.outputVat)}</td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => { if(confirm('Delete record?')) remove.mutate({ id: sale.id }) }}
                        className="text-rose-500 hover:text-rose-700 p-2 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialog Form */}
      {isDialogOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold font-display">Add Daily Sales</h2>
            </div>
            <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <input 
                  type="date" 
                  {...form.register("date")} 
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" 
                />
                {form.formState.errors.date && <p className="text-rose-500 text-xs mt-1">{form.formState.errors.date.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Food Sales (SAR)</label>
                <input 
                  type="number" step="0.01" 
                  {...form.register("foodSales")} 
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Beverage Sales (SAR)</label>
                <input 
                  type="number" step="0.01" 
                  {...form.register("beverageSales")} 
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" 
                />
              </div>
              
              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsDialogOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={create.isPending}
                  className="px-6 py-2 bg-primary text-white rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50"
                >
                  {create.isPending ? "Saving..." : "Save Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
