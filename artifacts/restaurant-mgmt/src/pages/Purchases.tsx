import { useState, useEffect } from "react";
import { useListPurchases } from "@workspace/api-client-react";
import { usePurchasesMutations } from "@/hooks/use-purchases";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatSAR, formatDate, formatMonth } from "@/lib/format";
import { exportToExcel } from "@/lib/export-excel";
import { PURCHASE_CATEGORIES, PURCHASE_CATEGORY_GROUPS, getCategoryMeta, getGroupForCategory } from "@/lib/categories";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, Pencil, Search, X, FileSpreadsheet, Receipt, Tag } from "lucide-react";

const purchaseSchema = z.object({
  date: z.string().min(1, "Required"),
  supplierName: z.string().optional(),
  productName: z.string().min(1, "Required"),
  category: z.string().min(1, "Required"),
  quantity: z.coerce.number().min(0.001, "Must be > 0"),
  price: z.coerce.number().min(0, "Must be ≥ 0"),
  invoiceType: z.enum(["tax", "non-tax"]).default("tax"),
  priceIncludesVat: z.boolean(),
  paymentType: z.enum(["cash", "card", "credit"]).default("cash"),
  notes: z.string().optional(),
});
type PurchaseForm = z.infer<typeof purchaseSchema>;

const VAT_RATE = 0.15;

function calcTotals(quantity: number, price: number, priceIncludesVat: boolean, invoiceType: string) {
  const gross = quantity * price;
  if (invoiceType === "non-tax") {
    return { net: +gross.toFixed(2), vat: 0, total: +gross.toFixed(2) };
  }
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

  const currentCategory = useWatch({ control: form.control, name: "category" });
  const [selectedGroupKey, setSelectedGroupKey] = useState<string>(() => {
    return getGroupForCategory(defaultValues.category)?.key ?? PURCHASE_CATEGORY_GROUPS[0].key;
  });

  useEffect(() => {
    if (open) {
      form.reset(defaultValues);
      setSelectedGroupKey(getGroupForCategory(defaultValues.category)?.key ?? PURCHASE_CATEGORY_GROUPS[0].key);
    }
  }, [open]);

  const activeGroup = PURCHASE_CATEGORY_GROUPS.find(g => g.key === selectedGroupKey) ?? PURCHASE_CATEGORY_GROUPS[0];

  function handleGroupChange(key: string) {
    setSelectedGroupKey(key);
    const group = PURCHASE_CATEGORY_GROUPS.find(g => g.key === key);
    if (group && group.subcategories.length > 0) {
      form.setValue("category", group.subcategories[0].value, { shouldValidate: true });
    }
  }

  const qty = useWatch({ control: form.control, name: "quantity" });
  const price = useWatch({ control: form.control, name: "price" });
  const vatIncluded = useWatch({ control: form.control, name: "priceIncludesVat" });
  const invoiceType = useWatch({ control: form.control, name: "invoiceType" });
  const isTax = invoiceType !== "non-tax";

  const preview = calcTotals(Number(qty) || 0, Number(price) || 0, Boolean(vatIncluded), invoiceType);

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
          {/* Invoice Type */}
          <div>
            <label className="block text-sm font-medium mb-2">Invoice Type <span className="text-rose-500">*</span></label>
            <div className="grid grid-cols-2 gap-3">
              <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${invoiceType === "tax" ? "border-primary bg-primary/5" : "border-slate-200 hover:border-slate-300"}`}>
                <input type="radio" value="tax" {...form.register("invoiceType")} className="sr-only" />
                <Receipt className={`w-5 h-5 flex-shrink-0 ${invoiceType === "tax" ? "text-primary" : "text-slate-400"}`} />
                <div>
                  <p className={`text-sm font-semibold ${invoiceType === "tax" ? "text-primary" : "text-slate-700"}`}>Tax Invoice</p>
                  <p className="text-xs text-slate-500">VAT (15%) applies</p>
                </div>
              </label>
              <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${invoiceType === "non-tax" ? "border-amber-500 bg-amber-50" : "border-slate-200 hover:border-slate-300"}`}>
                <input type="radio" value="non-tax" {...form.register("invoiceType")} className="sr-only" />
                <Tag className={`w-5 h-5 flex-shrink-0 ${invoiceType === "non-tax" ? "text-amber-600" : "text-slate-400"}`} />
                <div>
                  <p className={`text-sm font-semibold ${invoiceType === "non-tax" ? "text-amber-700" : "text-slate-700"}`}>Non-Tax Invoice</p>
                  <p className="text-xs text-slate-500">No VAT applied</p>
                </div>
              </label>
            </div>
          </div>

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

          {/* Category — Step 1: Main Group */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Main Category <span className="text-rose-500">*</span>
              <span className="font-normal text-slate-400 text-xs mr-2"> / التصنيف الرئيسي</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {PURCHASE_CATEGORY_GROUPS.map(g => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => handleGroupChange(g.key)}
                  className={`text-left px-3 py-2 rounded-xl border-2 text-xs transition-all ${
                    selectedGroupKey === g.key
                      ? "border-primary bg-primary/5 font-semibold"
                      : "border-slate-200 hover:border-slate-300 text-slate-600"
                  }`}
                >
                  <span className="block font-medium leading-tight">{g.label}</span>
                  <span className="block text-slate-400 text-[10px] leading-tight mt-0.5" dir="rtl">{g.labelAr}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Category — Step 2: Subcategory */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Subcategory <span className="text-rose-500">*</span>
              <span className="font-normal text-slate-400 text-xs mr-2"> / التصنيف الفرعي</span>
            </label>
            <select
              {...form.register("category")}
              value={currentCategory}
              className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary bg-white text-sm"
            >
              {activeGroup.subcategories.map(s => (
                <option key={s.value} value={s.value}>
                  {s.label} — {s.labelAr}
                </option>
              ))}
            </select>
            {form.formState.errors.category && (
              <p className="text-xs text-rose-500 mt-1">{form.formState.errors.category.message}</p>
            )}
            <p className="text-xs text-slate-400 mt-1">
              {activeGroup.section === "opex"
                ? "Operating Expense → reduces Operating Profit in P&L"
                : "Cost of Sale → reduces Gross Profit in P&L"}
            </p>
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

          {/* VAT toggle — only for tax invoices */}
          {isTax && (
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" {...form.register("priceIncludesVat")} className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-300 rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
              </label>
              <span className="text-sm font-medium text-slate-700">Price already includes 15% VAT</span>
            </div>
          )}

          {/* Auto-calculated total */}
          <div className={`grid gap-3 p-4 rounded-xl text-sm border ${isTax ? "grid-cols-3 bg-emerald-50 border-emerald-200" : "grid-cols-2 bg-amber-50 border-amber-200"}`}>
            <div className="text-center">
              <p className="text-xs text-slate-500 font-medium">Net Amount</p>
              <p className="font-bold text-slate-800">{formatSAR(preview.net)}</p>
            </div>
            {isTax && (
              <div className="text-center border-x border-emerald-200">
                <p className="text-xs text-slate-500 font-medium">VAT (15%)</p>
                <p className="font-bold text-emerald-700">{formatSAR(preview.vat)}</p>
              </div>
            )}
            <div className="text-center">
              <p className="text-xs text-slate-500 font-medium">Total Price</p>
              <p className={`font-bold text-base ${isTax ? "text-slate-900" : "text-amber-800"}`}>{formatSAR(preview.total)}</p>
            </div>
            {!isTax && (
              <div className="col-span-2 text-center mt-1">
                <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">No VAT — Non-Tax Invoice</span>
              </div>
            )}
          </div>

          {/* Payment Type */}
          <div>
            <label className="block text-sm font-medium mb-1">Payment Type</label>
            <select {...form.register("paymentType")} className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary bg-white text-sm">
              <option value="cash">💵 Cash</option>
              <option value="card">💳 Card / Bank Transfer</option>
              <option value="credit">📄 Credit / On Account</option>
            </select>
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
  const [invoiceFilter, setInvoiceFilter] = useState<"" | "tax" | "non-tax">("");
  const [addOpen, setAddOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<{ id: number; data: PurchaseForm } | null>(null);

  const { data: purchases, isLoading } = useListPurchases(
    month ? { month } : undefined
  );
  const { create, update, remove } = usePurchasesMutations();

  // Client-side filtering
  const filtered = (purchases ?? []).filter((p) => {
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (searchQuery && !p.productName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (invoiceFilter && p.invoiceType !== invoiceFilter) return false;
    return true;
  });

  // Summary stats — split by invoice type
  const taxable    = filtered.filter(p => p.invoiceType !== "non-tax");
  const nonTaxable = filtered.filter(p => p.invoiceType === "non-tax");

  const totalTaxableNet  = taxable.reduce((s, p) => s + p.amountBeforeVat, 0);
  const totalInputVat    = taxable.reduce((s, p) => s + p.vatAmount, 0);
  const totalTaxableGross = taxable.reduce((s, p) => s + p.totalAmount, 0);
  const totalNonTaxable  = nonTaxable.reduce((s, p) => s + p.totalAmount, 0);
  const grandTotal       = filtered.reduce((s, p) => s + p.totalAmount, 0);

  const defaultForm: PurchaseForm = {
    date: new Date().toISOString().split("T")[0],
    supplierName: "",
    productName: "",
    category: "food-poultry",
    quantity: 1,
    price: 0,
    invoiceType: "tax",
    priceIncludesVat: false,
    paymentType: "cash",
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
        invoiceType: (p.invoiceType as "tax" | "non-tax") ?? "tax",
        priceIncludesVat: p.priceIncludesVat,
        paymentType: (p.paymentType as "cash" | "card" | "credit") ?? "cash",
        notes: p.notes ?? "",
      },
    });
  }

  function handleExport() {
    const rows = filtered.map((p) => ({
      Date: p.date,
      "Invoice Type": p.invoiceType === "non-tax" ? "Non-Tax Invoice" : "Tax Invoice",
      Product: p.productName,
      Category: getCategoryMeta(p.category).label,
      Supplier: p.supplierName || "",
      Quantity: p.quantity,
      "Unit Price (SAR)": p.price,
      "Net Amount (SAR)": p.amountBeforeVat,
      "VAT (SAR)": p.vatAmount,
      "Total (SAR)": p.totalAmount,
      "VAT Included in Price": p.invoiceType === "non-tax" ? "N/A" : p.priceIncludesVat ? "Yes" : "No",
      Payment: p.paymentType,
      Notes: p.notes || "",
    }));
    exportToExcel(rows, `purchases-${month || "all"}`);
  }

  const hasActiveFilters = !!(categoryFilter || searchQuery || month || invoiceFilter);

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
          {PURCHASE_CATEGORY_GROUPS.map(g => (
            <optgroup key={g.key} label={`${g.label} — ${g.labelAr}`}>
              {g.subcategories.map(s => (
                <option key={s.value} value={s.value}>{s.label} — {s.labelAr}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <select
          value={invoiceFilter}
          onChange={(e) => setInvoiceFilter(e.target.value as "" | "tax" | "non-tax")}
          className="px-4 py-2 border rounded-xl shadow-sm focus:ring-primary/20 outline-none text-sm bg-white"
        >
          <option value="">All Invoice Types</option>
          <option value="tax">🧾 Tax Invoice</option>
          <option value="non-tax">🏷️ Non-Tax Invoice</option>
        </select>
        {hasActiveFilters && (
          <button
            onClick={() => { setCategoryFilter(""); setSearchQuery(""); setMonth(""); setInvoiceFilter(""); }}
            className="px-3 py-2 text-sm text-slate-500 hover:text-slate-800 border rounded-xl"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Summary Bar */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          <div className="bg-slate-50 border rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-slate-500 mb-0.5">Taxable Net</p>
            <p className="font-bold text-slate-800 text-sm">{formatSAR(totalTaxableNet)}</p>
            <p className="text-[10px] text-slate-400">{taxable.length} tax invoices</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-slate-500 mb-0.5">Input VAT</p>
            <p className="font-bold text-emerald-700 text-sm">{formatSAR(totalInputVat)}</p>
            <p className="text-[10px] text-slate-400">Reclaimable</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-slate-500 mb-0.5">Taxable Total</p>
            <p className="font-bold text-emerald-800 text-sm">{formatSAR(totalTaxableGross)}</p>
            <p className="text-[10px] text-slate-400">incl. VAT</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-slate-500 mb-0.5">Non-Taxable</p>
            <p className="font-bold text-amber-700 text-sm">{formatSAR(totalNonTaxable)}</p>
            <p className="text-[10px] text-slate-400">{nonTaxable.length} non-tax invoices</p>
          </div>
          <div className="bg-slate-900 rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-slate-400 mb-0.5">Grand Total</p>
            <p className="font-bold text-white text-sm">{formatSAR(grandTotal)}</p>
            <p className="text-[10px] text-slate-400">{filtered.length} records</p>
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
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Payment</th>
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
                <tr><td colSpan={12} className="text-center py-12 text-slate-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-12 text-slate-400">
                    {hasActiveFilters ? "No records match your filters" : `No purchases found for ${formatMonth(month)}`}
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const meta = getCategoryMeta(p.category);
                  const isNonTax = p.invoiceType === "non-tax";
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(p.date)}</td>
                      <td className="px-4 py-3">
                        {isNonTax ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 whitespace-nowrap">
                            🏷️ No VAT
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 whitespace-nowrap">
                            🧾 Tax
                          </span>
                        )}
                      </td>
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
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          p.paymentType === "card" ? "bg-blue-50 text-blue-700" :
                          p.paymentType === "credit" ? "bg-amber-50 text-amber-700" :
                          "bg-slate-100 text-slate-600"
                        }`}>
                          {p.paymentType === "card" ? "💳 Card" : p.paymentType === "credit" ? "📄 Credit" : "💵 Cash"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{p.quantity}</td>
                      <td className="px-4 py-3 text-right">
                        {formatSAR(p.price)}
                        {!isNonTax && p.priceIncludesVat && <span className="text-[10px] text-slate-400 block">inc. VAT</span>}
                      </td>
                      <td className="px-4 py-3 text-right">{formatSAR(p.amountBeforeVat)}</td>
                      <td className="px-4 py-3 text-right">
                        {isNonTax ? (
                          <span className="text-slate-400 text-xs">—</span>
                        ) : (
                          <span className="text-emerald-600">{formatSAR(p.vatAmount)}</span>
                        )}
                      </td>
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
                  <td colSpan={8} className="px-4 py-3 text-right text-slate-500">
                    {filtered.length} records
                  </td>
                  <td className="px-4 py-3 text-right">{formatSAR(totalTaxableNet + totalNonTaxable)}</td>
                  <td className="px-4 py-3 text-right text-emerald-600">{formatSAR(totalInputVat)}</td>
                  <td className="px-4 py-3 text-right">{formatSAR(grandTotal)}</td>
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
