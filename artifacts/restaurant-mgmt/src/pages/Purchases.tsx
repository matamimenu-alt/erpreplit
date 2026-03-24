import { useState } from "react";
import { useListPurchases } from "@workspace/api-client-react";
import { usePurchasesMutations } from "@/hooks/use-purchases";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatSAR, formatDate, formatMonth } from "@/lib/format";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";

const purchaseSchema = z.object({
  date: z.string().min(1, "Required"),
  supplierName: z.string().min(1, "Required"),
  productName: z.string().min(1, "Required"),
  quantity: z.coerce.number().min(0.01),
  price: z.coerce.number().min(0),
  priceIncludesVat: z.boolean()
});
type PurchaseForm = z.infer<typeof purchaseSchema>;

export default function Purchases() {
  const [month, setMonth] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const { data: purchases, isLoading } = useListPurchases(month ? { month } : undefined);
  const { create, remove } = usePurchasesMutations();

  const form = useForm<PurchaseForm>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: { date: new Date().toISOString().split('T')[0], quantity: 1, price: 0, priceIncludesVat: false, supplierName: "", productName: "" }
  });

  return (
    <div>
      <PageHeader 
        title="Purchases & Inventory" 
        description="Track supplier invoices and Input VAT."
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
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all"
            >
              <Plus className="w-4 h-4" /> Add Invoice
            </button>
          </div>
        }
      />

      <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Supplier</th>
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4 text-right">Qty</th>
                <th className="px-6 py-4 text-right">Unit Price</th>
                <th className="px-6 py-4 text-right">Pre-VAT</th>
                <th className="px-6 py-4 text-right">Input VAT</th>
                <th className="px-6 py-4 text-right">Total</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y text-slate-700">
              {isLoading ? (
                <tr><td colSpan={9} className="text-center py-8">Loading...</td></tr>
              ) : purchases?.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8">No records</td></tr>
              ) : (
                purchases?.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">{formatDate(p.date)}</td>
                    <td className="px-6 py-4 font-medium">{p.supplierName}</td>
                    <td className="px-6 py-4 text-slate-500">{p.productName}</td>
                    <td className="px-6 py-4 text-right">{p.quantity}</td>
                    <td className="px-6 py-4 text-right">{formatSAR(p.price)} {p.priceIncludesVat && <span className="text-[10px] text-slate-400 block">inc. VAT</span>}</td>
                    <td className="px-6 py-4 text-right">{formatSAR(p.amountBeforeVat)}</td>
                    <td className="px-6 py-4 text-right text-emerald-600">{formatSAR(p.vatAmount)}</td>
                    <td className="px-6 py-4 text-right font-bold">{formatSAR(p.totalAmount)}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => remove.mutate({ id: p.id })} className="text-rose-500 p-2 hover:bg-rose-50 rounded-lg">
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

      {isDialogOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold font-display">Log Purchase Invoice</h2>
            </div>
            <form onSubmit={form.handleSubmit((d) => create.mutate({ data: d }, { onSuccess: () => { setIsDialogOpen(false); form.reset(); } }))} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Date</label>
                  <input type="date" {...form.register("date")} className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Supplier Name</label>
                  <input {...form.register("supplierName")} className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Product Description</label>
                <input {...form.register("productName")} className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Quantity</label>
                  <input type="number" step="0.01" {...form.register("quantity")} className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Unit Price</label>
                  <input type="number" step="0.01" {...form.register("price")} className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary" />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" id="vat" {...form.register("priceIncludesVat")} className="w-4 h-4 text-primary rounded" />
                <label htmlFor="vat" className="text-sm font-medium text-slate-700">Price already includes 15% VAT</label>
              </div>
              
              <div className="pt-4 flex justify-end gap-3 border-t mt-6">
                <button type="button" onClick={() => setIsDialogOpen(false)} className="px-4 py-2 font-medium">Cancel</button>
                <button type="submit" disabled={create.isPending} className="px-6 py-2 bg-primary text-white rounded-xl shadow-md">
                  {create.isPending ? "Saving..." : "Save Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
