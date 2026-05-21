import { useState } from "react";
import { useGetSupplierPriceComparison, useListSuppliers } from "@workspace/api-client-react";
import { useSupplierProductMutations } from "@/hooks/use-suppliers";
import { PageHeader } from "@/components/ui/PageHeader";
import { useLanguage } from "@/i18n/LanguageContext";
import { PrintButton } from "@/components/ui/PrintButton";
import { formatSAR } from "@/lib/format";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, TrendingDown, TrendingUp, Minus } from "lucide-react";

const schema = z.object({
  supplierId: z.coerce.number(),
  productName: z.string().min(1),
  previousPrice: z.coerce.number().optional(),
  currentPrice: z.coerce.number().min(0),
});
type FormVals = z.infer<typeof schema>;

export default function SupplierPrices() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const { data: prices, isLoading } = useGetSupplierPriceComparison();
  const { data: suppliers } = useListSuppliers();
  const { createProduct } = useSupplierProductMutations();

  const form = useForm<FormVals>({ resolver: zodResolver(schema) });

  const renderTrend = (trend: string, pct: number) => {
    if (trend === 'up') return <span className="flex items-center gap-1 text-rose-600 bg-rose-50 px-2 py-1 rounded-md text-xs font-bold w-fit"><TrendingUp className="w-3 h-3"/> +{pct.toFixed(1)}%</span>;
    if (trend === 'down') return <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md text-xs font-bold w-fit"><TrendingDown className="w-3 h-3"/> {pct.toFixed(1)}%</span>;
    return <span className="flex items-center gap-1 text-slate-500 bg-slate-100 px-2 py-1 rounded-md text-xs font-bold w-fit"><Minus className="w-3 h-3"/> 0%</span>;
  };

  return (
    <div>
      <PageHeader 
        title={t("pages.supplierPricesPageTitle")} 
        description={t("pages.supplierPricesDesc")}
        action={
          <div className="flex gap-2 items-center">
            <button onClick={() => setOpen(true)} className="no-print flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl shadow-lg hover:-translate-y-0.5 transition-all">
              <Plus className="w-4 h-4" /> Update Price
            </button>
            <PrintButton />
          </div>
        }
      />

      <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 font-medium border-b">
            <tr>
              <th className="px-6 py-4">Product Name</th>
              <th className="px-6 py-4">Supplier</th>
              <th className="px-6 py-4 text-right">Previous Price</th>
              <th className="px-6 py-4 text-right">Current Price</th>
              <th className="px-6 py-4 text-right">Difference</th>
              <th className="px-6 py-4">Trend</th>
            </tr>
          </thead>
          <tbody className="divide-y text-slate-700">
            {isLoading ? <tr><td colSpan={6} className="p-8 text-center">Loading...</td></tr> : 
              prices?.map((p, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium">{p.productName}</td>
                  <td className="px-6 py-4 text-slate-500">{p.supplierName}</td>
                  <td className="px-6 py-4 text-right text-slate-400 line-through">{p.previousPrice ? formatSAR(p.previousPrice) : '-'}</td>
                  <td className="px-6 py-4 text-right font-bold">{formatSAR(p.currentPrice)}</td>
                  <td className="px-6 py-4 text-right">{formatSAR(p.priceDifference)}</td>
                  <td className="px-6 py-4">{renderTrend(p.trend, p.priceChangePercent)}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">Log New Product Price</h2></div>
            <form onSubmit={form.handleSubmit(d => createProduct.mutate({ data: d }, { onSuccess: () => { setOpen(false); form.reset(); } }))} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Supplier</label>
                <select {...form.register("supplierId")} className="w-full px-3 py-2 border rounded-xl outline-none">
                  <option value="">Select Supplier...</option>
                  {suppliers?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Product Name</label>
                <input {...form.register("productName")} className="w-full px-3 py-2 border rounded-xl outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Old Price (Optional)</label>
                  <input type="number" step="0.01" {...form.register("previousPrice")} className="w-full px-3 py-2 border rounded-xl outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">New Price *</label>
                  <input type="number" step="0.01" {...form.register("currentPrice")} className="w-full px-3 py-2 border rounded-xl outline-none" />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t">
                <button type="button" onClick={() => setOpen(false)} className="px-4 py-2">Cancel</button>
                <button type="submit" disabled={createProduct.isPending} className="px-6 py-2 bg-primary text-white rounded-xl shadow-md">Save Price</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
