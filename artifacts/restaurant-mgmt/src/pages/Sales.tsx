import { useState, memo } from "react";
import { useListSales, useGetMonthlySalesSummary } from "@workspace/api-client-react";
import { useSalesMutations } from "@/hooks/use-sales";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatSAR, formatDate, formatMonth } from "@/lib/format";
import { exportToExcel } from "@/lib/export-excel";
import { useForm, FormProvider, useFormContext } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, FileSpreadsheet, X, UtensilsCrossed, ShoppingBag, Truck, Smartphone } from "lucide-react";

// ─────────────────────────── Schema ──────────────────────────────────────────
const saleSchema = z.object({
  date: z.string().min(1, "Date is required"),
  dineInFood: z.coerce.number().min(0),
  dineInBeverage: z.coerce.number().min(0),
  takeawayFood: z.coerce.number().min(0),
  takeawayBeverage: z.coerce.number().min(0),
  deliveryFood: z.coerce.number().min(0),
  deliveryBeverage: z.coerce.number().min(0),
  appSalesFood: z.coerce.number().min(0),
  appSalesBeverage: z.coerce.number().min(0),
});
type SaleForm = z.infer<typeof saleSchema>;

const DEFAULT: SaleForm = {
  date: new Date().toISOString().split("T")[0],
  dineInFood: 0, dineInBeverage: 0,
  takeawayFood: 0, takeawayBeverage: 0,
  deliveryFood: 0, deliveryBeverage: 0,
  appSalesFood: 0, appSalesBeverage: 0,
};

// ─────────────────────────── Module-level sub-components ─────────────────────
// Defined outside modal to ensure stable references — prevents focus loss on re-render

const ChannelInput = memo(({ name, label }: { name: keyof SaleForm; label: string }) => {
  const form = useFormContext<SaleForm>();
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-0.5">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">SAR</span>
        <input
          type="number"
          step="0.01"
          min="0"
          {...form.register(name)}
          className="w-full pl-12 pr-3 py-2 border rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          placeholder="0.00"
        />
      </div>
    </div>
  );
});

// ─────────────────────────── Sale Form Modal ──────────────────────────────────
const CHANNELS = [
  { key: "dineIn" as const, label: "Local Dine-In", icon: UtensilsCrossed, color: "bg-blue-50 border-blue-200 text-blue-700" },
  { key: "takeaway" as const, label: "Takeaway", icon: ShoppingBag, color: "bg-amber-50 border-amber-200 text-amber-700" },
  { key: "delivery" as const, label: "Delivery", icon: Truck, color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  { key: "appSales" as const, label: "App Sales (HungerStation, Jahez, Noon…)", icon: Smartphone, color: "bg-purple-50 border-purple-200 text-purple-700" },
];

function SaleModal({
  open, title, defaultValues, onClose, onSubmit, isPending,
}: {
  open: boolean; title: string; defaultValues: SaleForm;
  onClose: () => void; onSubmit: (d: SaleForm) => void; isPending: boolean;
}) {
  const form = useForm<SaleForm>({
    resolver: zodResolver(saleSchema),
    defaultValues,
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 max-h-[90vh] flex flex-col">
        <div className="p-5 border-b flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><X className="w-4 h-4" /></button>
        </div>

        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Date */}
              <div>
                <label className="block text-sm font-semibold mb-1">Date</label>
                <input
                  type="date"
                  {...form.register("date")}
                  className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                {form.formState.errors.date && <p className="text-rose-500 text-xs mt-1">{form.formState.errors.date.message}</p>}
              </div>

              {/* Note */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-xs text-blue-700">
                All amounts are entered excluding VAT (ex-VAT). The system automatically calculates 15% ZATCA VAT.
              </div>

              {/* Channels */}
              {CHANNELS.map((ch) => {
                const foodKey = `${ch.key}Food` as keyof SaleForm;
                const bevKey = `${ch.key}Beverage` as keyof SaleForm;
                return (
                  <div key={ch.key} className={`rounded-xl border p-4 ${ch.color}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <ch.icon className="w-4 h-4" />
                      <span className="font-semibold text-sm">{ch.label}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <ChannelInput name={foodKey} label="Food Sales (SAR)" />
                      <ChannelInput name={bevKey} label="Beverage Sales (SAR)" />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-5 border-t bg-slate-50 shrink-0 flex justify-end gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl">Cancel</button>
              <button
                type="submit"
                disabled={isPending}
                className="px-6 py-2 bg-primary text-white rounded-xl shadow-md hover:shadow-lg disabled:opacity-50"
              >
                {isPending ? "Saving..." : "Save Record"}
              </button>
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  );
}

// ─────────────────────────── Helpers ─────────────────────────────────────────
type SaleRecord = {
  id: number; date: string;
  dineInFood: number; dineInBeverage: number;
  takeawayFood: number; takeawayBeverage: number;
  deliveryFood: number; deliveryBeverage: number;
  appSalesFood: number; appSalesBeverage: number;
  foodSales: number; beverageSales: number;
  totalSales: number; outputVat: number;
};

// ─────────────────────────── Main Page ───────────────────────────────────────
export default function Sales() {
  const [month, setMonth] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editSale, setEditSale] = useState<SaleRecord | null>(null);

  const { data: sales = [], isLoading } = useListSales(month ? { month } : undefined);
  const { data: summary = [] } = useGetMonthlySalesSummary();
  const { create, update, remove } = useSalesMutations();

  const latestSummary = summary[summary.length - 1];

  function openEdit(sale: SaleRecord) {
    setEditSale(sale);
  }

  function handleCreate(data: SaleForm) {
    create.mutate({ data: { ...data } as Parameters<typeof create.mutate>[0]["data"] }, {
      onSuccess: () => {
        setAddOpen(false);
        toast({ title: "Record added", description: "Changes saved successfully." });
      },
    });
  }

  function handleUpdate(data: SaleForm) {
    if (!editSale) return;
    update.mutate({ id: editSale.id, data: { ...data } as Parameters<typeof update.mutate>[0]["data"] }, {
      onSuccess: () => {
        setEditSale(null);
        toast({ title: "Record updated", description: "Changes saved successfully." });
      },
    });
  }

  function handleDelete(id: number) {
    if (!confirm("Delete this record?")) return;
    remove.mutate({ id }, {
      onSuccess: () => toast({ title: "Record deleted" }),
    });
  }

  function exportExcel() {
    const rows = (sales as SaleRecord[]).map((s) => ({
      "Date": s.date,
      "Dine-In Food (SAR)": s.dineInFood,
      "Dine-In Beverage (SAR)": s.dineInBeverage,
      "Dine-In Total (SAR)": s.dineInFood + s.dineInBeverage,
      "Takeaway Food (SAR)": s.takeawayFood,
      "Takeaway Beverage (SAR)": s.takeawayBeverage,
      "Takeaway Total (SAR)": s.takeawayFood + s.takeawayBeverage,
      "Delivery Food (SAR)": s.deliveryFood,
      "Delivery Beverage (SAR)": s.deliveryBeverage,
      "Delivery Total (SAR)": s.deliveryFood + s.deliveryBeverage,
      "App Sales Food (SAR)": s.appSalesFood,
      "App Sales Beverage (SAR)": s.appSalesBeverage,
      "App Sales Total (SAR)": s.appSalesFood + s.appSalesBeverage,
      "Total Food Sales (SAR)": s.foodSales,
      "Total Beverage Sales (SAR)": s.beverageSales,
      "Grand Total (SAR)": s.totalSales,
      "Output VAT 15% (SAR)": s.outputVat,
    }));
    exportToExcel(rows, `sales-${month || "all"}`, "Sales");
  }

  const typedSales = (sales as SaleRecord[]);

  return (
    <div>
      <PageHeader
        title="Sales & Revenue"
        description="Daily sales by channel with automatic 15% ZATCA VAT tracking. All amounts exclude VAT."
        action={
          <div className="flex gap-2 flex-wrap">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="px-4 py-2 border rounded-xl shadow-sm focus:ring-primary/20 outline-none text-sm"
            />
            <button
              onClick={exportExcel}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm"
            >
              <FileSpreadsheet className="w-4 h-4" /> Export Excel
            </button>
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all"
            >
              <Plus className="w-4 h-4" /> Add Daily Record
            </button>
          </div>
        }
      />

      {/* ── Summary KPI Cards ── */}
      {latestSummary && !month && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Food Sales", value: latestSummary.totalFoodSales, color: "bg-blue-50 border-blue-200 text-blue-700" },
            { label: "Total Beverage Sales", value: latestSummary.totalBeverageSales, color: "bg-amber-50 border-amber-200 text-amber-700" },
            { label: "Total Revenue", value: latestSummary.totalSales, color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
            { label: "Output VAT (15%)", value: latestSummary.totalOutputVat, color: "bg-purple-50 border-purple-200 text-purple-700" },
          ].map((k) => (
            <div key={k.label} className={`rounded-2xl border p-5 ${k.color}`}>
              <p className="text-xs font-bold uppercase tracking-wide opacity-60 mb-1">{k.label}</p>
              <p className="text-xl font-extrabold">{formatSAR(k.value)}</p>
              <p className="text-[11px] mt-1 opacity-50">Latest month</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Channel Icons Legend ── */}
      <div className="flex flex-wrap gap-3 mb-4">
        {CHANNELS.map((ch) => (
          <div key={ch.key} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${ch.color}`}>
            <ch.icon className="w-3.5 h-3.5" />
            {ch.label.split("(")[0].trim()}
          </div>
        ))}
      </div>

      {/* ── Data Table ── */}
      <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-widest">
                <th className="px-3 py-2 bg-slate-100 text-slate-500" rowSpan={2}>Date</th>
                <th colSpan={2} className="px-3 py-2 bg-blue-50 text-blue-700 border-l border-blue-200 text-center">Dine-In</th>
                <th colSpan={2} className="px-3 py-2 bg-amber-50 text-amber-700 border-l border-amber-200 text-center">Takeaway</th>
                <th colSpan={2} className="px-3 py-2 bg-emerald-50 text-emerald-700 border-l border-emerald-200 text-center">Delivery</th>
                <th colSpan={2} className="px-3 py-2 bg-purple-50 text-purple-700 border-l border-purple-200 text-center">App Sales</th>
                <th colSpan={3} className="px-3 py-2 bg-slate-700 text-white border-l border-slate-500 text-center">Totals</th>
                <th className="px-3 py-2 bg-slate-100" rowSpan={2}></th>
              </tr>
              <tr className="bg-slate-50 border-b-2 border-slate-200 text-[10px]">
                <th className="px-3 py-2 text-right text-blue-600 border-l border-blue-100">Food</th>
                <th className="px-3 py-2 text-right text-blue-600">Bev</th>
                <th className="px-3 py-2 text-right text-amber-600 border-l border-amber-100">Food</th>
                <th className="px-3 py-2 text-right text-amber-600">Bev</th>
                <th className="px-3 py-2 text-right text-emerald-600 border-l border-emerald-100">Food</th>
                <th className="px-3 py-2 text-right text-emerald-600">Bev</th>
                <th className="px-3 py-2 text-right text-purple-600 border-l border-purple-100">Food</th>
                <th className="px-3 py-2 text-right text-purple-600">Bev</th>
                <th className="px-3 py-2 text-right border-l border-slate-300 font-bold text-slate-700">Food</th>
                <th className="px-3 py-2 text-right font-bold text-slate-700">Bev</th>
                <th className="px-3 py-2 text-right font-bold text-slate-900">Total + VAT</th>
              </tr>
            </thead>
            <tbody className="divide-y text-slate-700">
              {isLoading ? (
                <tr><td colSpan={13} className="text-center py-10 text-slate-400">Loading records...</td></tr>
              ) : typedSales.length === 0 ? (
                <tr><td colSpan={13} className="text-center py-10 text-slate-400">No records {month ? `for ${formatMonth(month)}` : "— click Add Daily Record to start"}</td></tr>
              ) : (
                typedSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-3 font-semibold whitespace-nowrap">{formatDate(sale.date)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-blue-700 border-l border-blue-50">{formatSAR(sale.dineInFood)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-blue-600">{formatSAR(sale.dineInBeverage)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-amber-700 border-l border-amber-50">{formatSAR(sale.takeawayFood)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-amber-600">{formatSAR(sale.takeawayBeverage)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-emerald-700 border-l border-emerald-50">{formatSAR(sale.deliveryFood)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-emerald-600">{formatSAR(sale.deliveryBeverage)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-purple-700 border-l border-purple-50">{formatSAR(sale.appSalesFood)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-purple-600">{formatSAR(sale.appSalesBeverage)}</td>
                    <td className="px-3 py-3 text-right tabular-nums font-bold text-slate-800 border-l border-slate-200">{formatSAR(sale.foodSales)}</td>
                    <td className="px-3 py-3 text-right tabular-nums font-bold text-slate-700">{formatSAR(sale.beverageSales)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      <div className="font-bold text-slate-900">{formatSAR(sale.totalSales)}</div>
                      <div className="text-[10px] text-purple-500">+{formatSAR(sale.outputVat)} VAT</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEdit(sale)}
                          className="p-1.5 text-primary hover:bg-primary/10 rounded-lg"
                          title="Edit"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(sale.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {typedSales.length > 0 && (
              <tfoot className="border-t-2 border-slate-300 bg-slate-100 font-bold text-slate-800 text-xs">
                <tr>
                  <td className="px-3 py-3 text-slate-500">{typedSales.length} records</td>
                  <td className="px-3 py-3 text-right tabular-nums text-blue-700 border-l border-blue-100">
                    {formatSAR(typedSales.reduce((s, r) => s + r.dineInFood, 0))}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-blue-600">
                    {formatSAR(typedSales.reduce((s, r) => s + r.dineInBeverage, 0))}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-amber-700 border-l border-amber-100">
                    {formatSAR(typedSales.reduce((s, r) => s + r.takeawayFood, 0))}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-amber-600">
                    {formatSAR(typedSales.reduce((s, r) => s + r.takeawayBeverage, 0))}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-emerald-700 border-l border-emerald-100">
                    {formatSAR(typedSales.reduce((s, r) => s + r.deliveryFood, 0))}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-emerald-600">
                    {formatSAR(typedSales.reduce((s, r) => s + r.deliveryBeverage, 0))}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-purple-700 border-l border-purple-100">
                    {formatSAR(typedSales.reduce((s, r) => s + r.appSalesFood, 0))}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-purple-600">
                    {formatSAR(typedSales.reduce((s, r) => s + r.appSalesBeverage, 0))}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums border-l border-slate-300">
                    {formatSAR(typedSales.reduce((s, r) => s + r.foodSales, 0))}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatSAR(typedSales.reduce((s, r) => s + r.beverageSales, 0))}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    <div>{formatSAR(typedSales.reduce((s, r) => s + r.totalSales, 0))}</div>
                    <div className="text-[10px] text-purple-500 font-normal">
                      +{formatSAR(typedSales.reduce((s, r) => s + r.outputVat, 0))} VAT
                    </div>
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Add Modal */}
      <SaleModal
        open={addOpen}
        title="Add Daily Sales Record"
        defaultValues={DEFAULT}
        onClose={() => setAddOpen(false)}
        onSubmit={handleCreate}
        isPending={create.isPending}
      />

      {/* Edit Modal */}
      {editSale && (
        <SaleModal
          open={true}
          title="Edit Sales Record"
          defaultValues={{
            date: editSale.date,
            dineInFood: editSale.dineInFood,
            dineInBeverage: editSale.dineInBeverage,
            takeawayFood: editSale.takeawayFood,
            takeawayBeverage: editSale.takeawayBeverage,
            deliveryFood: editSale.deliveryFood,
            deliveryBeverage: editSale.deliveryBeverage,
            appSalesFood: editSale.appSalesFood,
            appSalesBeverage: editSale.appSalesBeverage,
          }}
          onClose={() => setEditSale(null)}
          onSubmit={handleUpdate}
          isPending={update.isPending}
        />
      )}
    </div>
  );
}
