import { useState, useEffect } from "react";
import { useListPurchases } from "@workspace/api-client-react";
import { usePurchasesMutations } from "@/hooks/use-purchases";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatSAR, formatDate, formatMonth } from "@/lib/format";
import { exportToExcel } from "@/lib/export-excel";
import { PURCHASE_CATEGORIES, PURCHASE_CATEGORY_GROUPS, getCategoryMeta } from "@/lib/categories";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, Pencil, Search, X, FileSpreadsheet } from "lucide-react";

const purchaseSchema = z.object({
  date: z.string().min(1, "Required"),
  supplierName: z.string().optional(),
  productName: z.string().min(1, "Required"),
  category: z.string().min(1, "Required"),
  quantity: z.coerce.number().min(0.001, "Must be > 0"),
  price: z.coerce.number().min(0, "Must be ≥ 0"),
  priceIncludesVat: z.boolean(),
  notes: z.string().optional(),
});
type PurchaseForm = z.infer<typeof purchaseSchema>;

const VAT_RATE = 0.15;

function calcTotals(quantity: number, price: number, priceIncludesVat: boolean) {
  const gross = quantity * price;
  if (priceIncludesVat) {
    const net = gross / (1 + VAT_RATE);
    const vat = gross - net;
    return { net: +net.toFixed(2), vat: +vat.toFixed(2), total: +gross.toFixed(2) };
  } else {
    const vat = gross * VAT_RATE;
    return { net: +gross.toFixed(2), vat: +vat.toFixed(2), total: +(gross + vat).toFixed(2) };
  }
}

function PurchaseFormModal({
  open,
  title,
  defaultValues,
  onClose,
  onSubmit,
  isPending,
}: {
  open: boolean;
  title: string;
  defaultValues: PurchaseForm;
  onClose: () => void;
  onSubmit: (data: PurchaseForm) => void;
  isPending: boolean;
}) {
  const form = useForm<PurchaseForm>({
    resolver: zodResolver(purchaseSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) form.reset(defaultValues);
  }, [open]);

  const qty = useWatch({ control: form.control, name: "quantity" });
  const price = useWatch({ control: form.control, name: "price" });
  const vatIncluded = useWatch({ control: form.control, name: "priceIncludesVat" });

  const preview = calcTotals(Number(qty) || 0, Number(price) || 0, Boolean(vatIncluded));

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 max-h-[90vh] flex flex-col">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="p-6 space-y-4 overflow-y-auto flex-1"
        >
          {/* Row 1: Date + Supplier */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Purchase Date <span className="text-rose-500">*</span></label>
              <input type="date" {...form.register("date")} className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary text-sm" />
              {form.formState.errors.date && <p className="text-xs text-rose-500 mt-1">{form.formState.errors.date.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Supplier (optional)</label>
              <input {...form.register("supplierName")} placeholder="Supplier name" className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary text-sm" />
            </div>
          </div>

          {/* Product name */}
          <div>
            <label className="block text-sm font-medium mb-1">Product / Item Name <span className="text-rose-500">*</span></label>
            <input {...form.register("productName")} placeholder="e.g. Chicken breast, Cooking oil..." className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary text-sm" />
            {form.formState.errors.productName && <p className="text-xs text-rose-500 mt-1">{form.formState.errors.productName.message}</p>}
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium mb-1">Category <span className="text-rose-500">*</span></label>
            <select {...form.register("category")} className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary bg-white text-sm">
              {PURCHASE_CATEGORY_GROUPS.map(g => (
                <optgroup key={g.groupLabel} label={g.groupLabel}>
                  {g.categories.map(c => (
                    <option key={c.value} value={c.value}>{c.label} — {c.labelAr}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">Cost of Sale categories reduce Gross Profit; Operating Expenses reduce Operating Profit in P&L</p>
          </div>

          {/* Qty + Unit Price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Quantity <span className="text-rose-500">*</span></label>
              <input type="number" step="0.001" min="0" {...form.register("quantity")} className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary text-sm" />
              {form.formState.errors.quantity && <p className="text-xs text-rose-500 mt-1">{form.formState.errors.quantity.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Unit Price (SAR) <span className="text-rose-500">*</span></label>
              <input type="number" step="0.01" min="0" {...form.register("price")} className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary text-sm" />
              {form.formState.errors.price && <p className="text-xs text-rose-500 mt-1">{form.formState.errors.price.message}</p>}
            </div>
          </div>

          {/* VAT toggle */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" {...form.register("priceIncludesVat")} className="sr-only peer" />
              <div className="w-11 h-6 bg-slate-300 rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
            </label>
            <span className="text-sm font-medium text-slate-700">Price includes 15% VAT</span>
          </div>

          {/* Auto-calculated total */}
          <div className="grid grid-cols-3 gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm">
            <div className="text-center">
              <p className="text-xs text-slate-500 font-medium">Net Amount</p>
              <p className="font-bold text-slate-800">{formatSAR(preview.net)}</p>
            </div>
            <div className="text-center border-x border-emerald-200">
              <p className="text-xs text-slate-500 font-medium">VAT (15%)</p>
              <p className="font-bold text-emerald-700">{formatSAR(preview.vat)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 font-medium">Total Price</p>
              <p className="font-bold text-slate-900 text-base">{formatSAR(preview.total)}</p>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">Notes (optional)</label>
            <textarea {...form.register("notes")} rows={2} placeholder="Any additional notes..." className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary text-sm resize-none" />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t mt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-xl">
              Cancel
            </button>
            <button type="submit" disabled={isPending} className="px-6 py-2 bg-primary text-white rounded-xl shadow-md disabled:opacity-60">
              {isPending ? "Saving..." : "Save Purchase"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Purchases() {
  const [month, setMonth] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<{ id: number; data: PurchaseForm } | null>(null);

  const { data: purchases, isLoading } = useListPurchases(
    month ? { month } : undefined
  );
  const { create, update, remove } = usePurchasesMutations();

  // Client-side filtering (category + search)
  const filtered = (purchases ?? []).filter((p) => {
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (searchQuery && !p.productName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Summary stats
  const totalNet = filtered.reduce((s, p) => s + p.amountBeforeVat, 0);
  const totalVat = filtered.reduce((s, p) => s + p.vatAmount, 0);
  const totalGross = filtered.reduce((s, p) => s + p.totalAmount, 0);

  const defaultForm: PurchaseForm = {
    date: new Date().toISOString().split("T")[0],
    supplierName: "",
    productName: "",
    category: "cost-food",
    quantity: 1,
    price: 0,
    priceIncludesVat: false,
    notes: "",
  };

  function handleAdd(data: PurchaseForm) {
    create.mutate(
      { data: { ...data, supplierName: data.supplierName || "" } },
      { onSuccess: () => setAddOpen(false) }
    );
  }

  function handleEdit(data: PurchaseForm) {
    if (!editRecord) return;
    update.mutate(
      { id: editRecord.id, data: { ...data, supplierName: data.supplierName || "" } },
      { onSuccess: () => setEditRecord(null) }
    );
  }

  function openEdit(p: typeof filtered[0]) {
    setEditRecord({
      id: p.id,
      data: {
        date: p.date,
        supplierName: p.supplierName ?? "",
        productName: p.productName,
        category: p.category,
        quantity: p.quantity,
        price: p.price,
        priceIncludesVat: p.priceIncludesVat,
        notes: p.notes ?? "",
      },
    });
  }

  function handleExport() {
    const rows = filtered.map((p) => ({
      Date: p.date,
      Product: p.productName,
      Category: getCategoryMeta(p.category).label,
      Supplier: p.supplierName || "",
      Quantity: p.quantity,
      "Unit Price (SAR)": p.price,
      "Net Amount (SAR)": p.amountBeforeVat,
      "VAT (SAR)": p.vatAmount,
      "Total (SAR)": p.totalAmount,
      "VAT Included": p.priceIncludesVat ? "Yes" : "No",
      Notes: p.notes || "",
    }));
    exportToExcel(rows, `purchases-${month || "all"}`);
  }

  return (
    <div>
      <PageHeader
        title="Purchases & Expenses"
        description="Track all purchasing and expense records with VAT."
        action={
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-sm"
            >
              <FileSpreadsheet className="w-4 h-4" /> Export Excel
            </button>
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all"
            >
              <Plus className="w-4 h-4" /> Add Purchase
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="px-4 py-2 border rounded-xl shadow-sm focus:ring-primary/20 outline-none text-sm"
        />
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by product..."
            className="w-full pl-9 pr-3 py-2 border rounded-xl shadow-sm focus:ring-primary/20 outline-none text-sm"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 border rounded-xl shadow-sm focus:ring-primary/20 outline-none text-sm bg-white"
        >
          <option value="">All Categories</option>
          <optgroup label="Cost of Sales (COGS)">
            {PURCHASE_CATEGORIES.filter(c => c.section === "cogs").map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </optgroup>
          <optgroup label="Operating Expenses">
            {PURCHASE_CATEGORIES.filter(c => c.section === "opex").map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </optgroup>
        </select>
        {(categoryFilter || searchQuery || month) && (
          <button
            onClick={() => { setCategoryFilter(""); setSearchQuery(""); setMonth(""); }}
            className="px-3 py-2 text-sm text-slate-500 hover:text-slate-800 border rounded-xl"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Summary Bar */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-slate-50 border rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-slate-500 mb-0.5">Net Amount</p>
            <p className="font-bold text-slate-800">{formatSAR(totalNet)}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-slate-500 mb-0.5">VAT (Input)</p>
            <p className="font-bold text-emerald-700">{formatSAR(totalVat)}</p>
          </div>
          <div className="bg-slate-900 rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-slate-400 mb-0.5">Total Amount</p>
            <p className="font-bold text-white">{formatSAR(totalGross)}</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Unit Price</th>
                <th className="px-4 py-3 text-right">Net Amount</th>
                <th className="px-4 py-3 text-right">VAT</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y text-slate-700">
              {isLoading ? (
                <tr><td colSpan={10} className="text-center py-12 text-slate-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-slate-400">
                    {(searchQuery || categoryFilter) ? "No records match your filters" : `No purchases found for ${formatMonth(month)}`}
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const meta = getCategoryMeta(p.category);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(p.date)}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{p.productName}</div>
                        {p.notes && <div className="text-xs text-slate-400 truncate max-w-32">{p.notes}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${meta.badge}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{p.supplierName || "—"}</td>
                      <td className="px-4 py-3 text-right">{p.quantity}</td>
                      <td className="px-4 py-3 text-right">
                        {formatSAR(p.price)}
                        {p.priceIncludesVat && <span className="text-[10px] text-slate-400 block">inc. VAT</span>}
                      </td>
                      <td className="px-4 py-3 text-right">{formatSAR(p.amountBeforeVat)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600">{formatSAR(p.vatAmount)}</td>
                      <td className="px-4 py-3 text-right font-bold">{formatSAR(p.totalAmount)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => openEdit(p)}
                            className="text-primary p-1.5 hover:bg-primary/10 rounded-lg"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => remove.mutate({ id: p.id })}
                            className="text-rose-500 p-1.5 hover:bg-rose-50 rounded-lg"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="bg-slate-50 border-t font-semibold text-slate-800">
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-right text-slate-500">
                    {filtered.length} records
                  </td>
                  <td className="px-4 py-3 text-right">{formatSAR(totalNet)}</td>
                  <td className="px-4 py-3 text-right text-emerald-600">{formatSAR(totalVat)}</td>
                  <td className="px-4 py-3 text-right">{formatSAR(totalGross)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Add Modal */}
      <PurchaseFormModal
        open={addOpen}
        title="New Purchase Entry"
        defaultValues={defaultForm}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAdd}
        isPending={create.isPending}
      />

      {/* Edit Modal */}
      {editRecord && (
        <PurchaseFormModal
          open={!!editRecord}
          title="Edit Purchase"
          defaultValues={editRecord.data}
          onClose={() => setEditRecord(null)}
          onSubmit={handleEdit}
          isPending={update.isPending}
        />
      )}
    </div>
  );
}
