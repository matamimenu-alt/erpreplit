import { useState, useMemo } from "react";
import {
  useListSuppliers,
  useGetSupplierProducts,
  useCreateSupplierProduct,
  useUpdateSupplierProduct,
  useDeleteSupplierProduct,
  useListPurchases,
} from "@workspace/api-client-react";
import type { SupplierProduct, Purchase } from "@workspace/api-client-react";
import { useSupplierMutations } from "@/hooks/use-suppliers";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrintButton } from "@/components/ui/PrintButton";
import { formatSAR } from "@/lib/format";
import { PURCHASE_CATEGORY_GROUPS, getCategoryMeta, getGroupForCategory } from "@/lib/categories";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Plus, Trash2, Building2, Phone, Mail, User,
  ChevronDown, ChevronUp, Package, Pencil, X,
  ShoppingCart, TrendingUp, ArrowRight,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetSupplierProductsQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

const UNITS = ["unit", "kg", "g", "liter", "ml", "piece", "box", "carton", "bottle", "can", "pack", "sack", "bag"];

const supplierSchema = z.object({
  name: z.string().min(1, "Required"),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
});
type SupplierFormValues = z.infer<typeof supplierSchema>;

function getLastMonth(): string {
  const now = new Date();
  const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const m = now.getMonth() === 0 ? 12 : now.getMonth();
  return `${y}-${String(m).padStart(2, "0")}`;
}

function getLastMonthLabel(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return d.toLocaleString("en-US", { month: "long", year: "numeric" });
}

// ─── Supplier Products Panel ──────────────────────────────────────────────────

function SupplierProductsPanel({ supplierId, supplierName }: { supplierId: number; supplierName: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: products = [], isLoading } = useGetSupplierProducts(supplierId);
  const createProduct = useCreateSupplierProduct();
  const updateProduct = useUpdateSupplierProduct();
  const deleteProduct = useDeleteSupplierProduct();

  const lastMonth = getLastMonth();
  const { data: allPurchases = [] } = useListPurchases({ params: { month: lastMonth } });

  const lastMonthPurchases = useMemo(() => {
    const q = supplierName.toLowerCase().trim();
    return allPurchases.filter(p => p.supplierName.toLowerCase().trim() === q);
  }, [allPurchases, supplierName]);

  // Aggregate by product name — keep latest price, sum qty
  const aggregated = useMemo(() => {
    const map = new Map<string, { productName: string; unit: string; category: string; totalQty: number; lastPrice: number; totalAmount: number; rows: Purchase[] }>();
    for (const p of lastMonthPurchases) {
      const key = p.productName.toLowerCase();
      if (map.has(key)) {
        const e = map.get(key)!;
        e.totalQty += p.quantity;
        e.totalAmount += p.amountBeforeVat;
        e.rows.push(p);
        if (p.date > e.rows[0].date) e.lastPrice = p.price;
      } else {
        map.set(key, {
          productName: p.productName,
          unit: p.unit,
          category: p.category,
          totalQty: p.quantity,
          lastPrice: p.price,
          totalAmount: p.amountBeforeVat,
          rows: [p],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [lastMonthPurchases]);

  const [activeTab, setActiveTab] = useState<"catalog" | "lastmonth">("catalog");
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SupplierProduct | null>(null);

  const defaultForm = {
    productName: "",
    mainGroupKey: PURCHASE_CATEGORY_GROUPS[0].key,
    category: PURCHASE_CATEGORY_GROUPS[0].subcategories[0].value,
    unit: "unit",
    currentPrice: "",
  };
  const [form, setForm] = useState({ ...defaultForm });
  const [formError, setFormError] = useState("");

  const activeGroup = PURCHASE_CATEGORY_GROUPS.find(g => g.key === form.mainGroupKey) ?? PURCHASE_CATEGORY_GROUPS[0];

  function handleGroupChange(key: string) {
    const grp = PURCHASE_CATEGORY_GROUPS.find(g => g.key === key);
    setForm(f => ({ ...f, mainGroupKey: key, category: grp?.subcategories[0].value ?? f.category }));
  }

  function openAdd(prefill?: { productName: string; unit: string; category: string; price: number }) {
    setEditingProduct(null);
    if (prefill) {
      const grp = getGroupForCategory(prefill.category);
      setForm({
        productName: prefill.productName,
        mainGroupKey: grp?.key ?? PURCHASE_CATEGORY_GROUPS[0].key,
        category: prefill.category,
        unit: prefill.unit,
        currentPrice: String(prefill.price),
      });
    } else {
      setForm({ ...defaultForm });
    }
    setFormError("");
    setShowForm(true);
    setActiveTab("catalog");
  }

  function openEdit(p: SupplierProduct) {
    const grp = getGroupForCategory(p.category);
    setEditingProduct(p);
    setForm({
      productName: p.productName,
      mainGroupKey: grp?.key ?? PURCHASE_CATEGORY_GROUPS[0].key,
      category: p.category,
      unit: p.unit,
      currentPrice: String(p.currentPrice),
    });
    setFormError("");
    setShowForm(true);
    setActiveTab("catalog");
  }

  function cancelForm() {
    setShowForm(false);
    setEditingProduct(null);
    setForm({ ...defaultForm });
    setFormError("");
  }

  async function handleSave() {
    if (!form.productName.trim()) { setFormError("Product name is required."); return; }
    const price = parseFloat(form.currentPrice);
    if (isNaN(price) || price < 0) { setFormError("Price must be ≥ 0."); return; }
    setFormError("");
    try {
      if (editingProduct) {
        await updateProduct.mutateAsync({
          id: editingProduct.id,
          data: {
            supplierId,
            productName: form.productName.trim(),
            category: form.category,
            unit: form.unit,
            previousPrice: editingProduct.currentPrice,
            currentPrice: price,
          },
        });
        toast({ title: "Product updated" });
      } else {
        await createProduct.mutateAsync({
          data: {
            supplierId,
            productName: form.productName.trim(),
            category: form.category,
            unit: form.unit,
            currentPrice: price,
          },
        });
        toast({ title: "Product added to catalog" });
      }
      queryClient.invalidateQueries({ queryKey: getGetSupplierProductsQueryKey(supplierId) });
      cancelForm();
    } catch {
      toast({ title: "Failed to save product", variant: "destructive" });
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteProduct.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetSupplierProductsQueryKey(supplierId) });
      toast({ title: "Product removed" });
    } catch {
      toast({ title: "Failed to remove product", variant: "destructive" });
    }
  }

  async function handleUpdatePriceFromPurchase(p: SupplierProduct, newPrice: number) {
    try {
      await updateProduct.mutateAsync({
        id: p.id,
        data: {
          supplierId,
          productName: p.productName,
          category: p.category,
          unit: p.unit,
          previousPrice: p.currentPrice,
          currentPrice: newPrice,
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetSupplierProductsQueryKey(supplierId) });
      toast({ title: `Price updated → ${formatSAR(newPrice)}` });
    } catch {
      toast({ title: "Failed to update price", variant: "destructive" });
    }
  }

  return (
    <div className="border-t pt-4 mt-4">
      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-slate-100 rounded-xl p-1">
        <button
          onClick={() => setActiveTab("catalog")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === "catalog"
              ? "bg-white text-primary shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          Catalog
          {products.length > 0 && (
            <span className="bg-primary/10 text-primary px-1.5 rounded-full text-[10px]">{products.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("lastmonth")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === "lastmonth"
              ? "bg-white text-amber-600 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          Last Month
          {aggregated.length > 0 && (
            <span className="bg-amber-100 text-amber-700 px-1.5 rounded-full text-[10px]">{aggregated.length}</span>
          )}
        </button>
      </div>

      {/* ── CATALOG TAB ── */}
      {activeTab === "catalog" && (
        <>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-500">Manage this supplier's product catalog</span>
            {!showForm && (
              <button
                onClick={() => openAdd()}
                className="flex items-center gap-1 text-xs px-3 py-1.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-3 h-3" /> Add Product
              </button>
            )}
          </div>

          {/* Add / Edit Form */}
          {showForm && (
            <div className="bg-slate-50 border rounded-xl p-4 mb-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-600">
                  {editingProduct ? "✏️ Edit Product" : "➕ Add Product"}
                </p>
                <button onClick={cancelForm} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">Product Name *</label>
                <input
                  value={form.productName}
                  onChange={e => setForm(f => ({ ...f, productName: e.target.value }))}
                  placeholder="e.g. Chicken Breast..."
                  className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-primary bg-white"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Main Category</label>
                  <select
                    value={form.mainGroupKey}
                    onChange={e => handleGroupChange(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-primary bg-white"
                  >
                    {PURCHASE_CATEGORY_GROUPS.map(g => (
                      <option key={g.key} value={g.key}>{g.label} — {g.labelAr}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Sub-category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-primary bg-white"
                  >
                    {activeGroup.subcategories.map(s => (
                      <option key={s.value} value={s.value}>{s.label} — {s.labelAr}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Unit</label>
                  <select
                    value={form.unit}
                    onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-primary bg-white"
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Unit Price (SAR) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.currentPrice}
                    onChange={e => setForm(f => ({ ...f, currentPrice: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-primary bg-white"
                    onKeyDown={e => e.key === "Enter" && handleSave()}
                  />
                </div>
              </div>

              {formError && <p className="text-xs text-rose-600">⚠️ {formError}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={cancelForm}
                  className="flex-1 py-2 text-sm font-medium text-slate-600 border rounded-xl hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={createProduct.isPending || updateProduct.isPending}
                  className="flex-1 py-2 text-sm font-semibold bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-60 transition-colors"
                >
                  {editingProduct ? "Update" : "Add Product"}
                </button>
              </div>
            </div>
          )}

          {/* Products List */}
          {isLoading ? (
            <p className="text-xs text-slate-400 text-center py-2">Loading...</p>
          ) : products.length === 0 ? (
            <div className="text-center py-4 text-slate-400 border border-dashed rounded-xl">
              <Package className="w-6 h-6 mx-auto mb-1 opacity-40" />
              <p className="text-xs">No products yet. Add products to link them to this supplier.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {products.map(p => {
                const meta = getCategoryMeta(p.category);
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-3 py-2 bg-white border rounded-xl group hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${meta.badge}`}>
                        {meta.label}
                      </span>
                      <span className="text-sm font-medium text-slate-800 truncate">{p.productName}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">{p.unit}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="text-sm font-bold text-slate-900">{formatSAR(p.currentPrice)}</span>
                        {p.previousPrice != null && p.previousPrice !== p.currentPrice && (
                          <p className="text-[10px] text-slate-400 line-through">{formatSAR(p.previousPrice)}</p>
                        )}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(p)}
                          className="p-1 text-primary hover:bg-primary/10 rounded-lg"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg"
                          title="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── LAST MONTH TAB ── */}
      {activeTab === "lastmonth" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-500">
              Purchases from <span className="font-semibold text-slate-700">{getLastMonthLabel()}</span>
            </p>
            {lastMonthPurchases.length > 0 && (
              <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
                {formatSAR(lastMonthPurchases.reduce((s, p) => s + p.amountBeforeVat, 0))} total
              </span>
            )}
          </div>

          {aggregated.length === 0 ? (
            <div className="text-center py-6 text-slate-400 border border-dashed rounded-xl">
              <ShoppingCart className="w-6 h-6 mx-auto mb-1 opacity-40" />
              <p className="text-xs">No purchases from this supplier last month.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {aggregated.map(item => {
                const catalogMatch = products.find(
                  p => p.productName.toLowerCase().trim() === item.productName.toLowerCase().trim()
                );
                const priceChanged = catalogMatch && Math.abs(catalogMatch.currentPrice - item.lastPrice) > 0.001;
                const meta = getCategoryMeta(item.category);

                return (
                  <div
                    key={item.productName}
                    className="bg-white border rounded-xl p-3 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${meta.badge}`}>
                            {meta.label}
                          </span>
                          <span className="text-sm font-semibold text-slate-800">{item.productName}</span>
                          <span className="text-[10px] text-slate-400">{item.unit}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          <span>Qty: <strong className="text-slate-700">{item.totalQty.toFixed(2)}</strong></span>
                          <span>Last price: <strong className="text-slate-700">{formatSAR(item.lastPrice)}</strong></span>
                          <span>Total: <strong className="text-slate-700">{formatSAR(item.totalAmount)}</strong></span>
                        </div>

                        {/* Price change indicator */}
                        {priceChanged && catalogMatch && (
                          <div className="flex items-center gap-1 mt-1.5 text-[10px] text-amber-700 bg-amber-50 rounded-lg px-2 py-1 w-fit">
                            <TrendingUp className="w-3 h-3" />
                            Catalog: {formatSAR(catalogMatch.currentPrice)}
                            <ArrowRight className="w-2.5 h-2.5" />
                            Purchase: {formatSAR(item.lastPrice)}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="shrink-0 flex flex-col gap-1.5">
                        {catalogMatch ? (
                          <>
                            {priceChanged && (
                              <button
                                onClick={() => handleUpdatePriceFromPurchase(catalogMatch, item.lastPrice)}
                                disabled={updateProduct.isPending}
                                className="text-[10px] px-2.5 py-1 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-60 transition-colors font-semibold whitespace-nowrap"
                              >
                                Update Price
                              </button>
                            )}
                            <button
                              onClick={() => openEdit(catalogMatch)}
                              className="text-[10px] px-2.5 py-1 border text-slate-600 rounded-lg hover:bg-slate-50 transition-colors font-medium whitespace-nowrap"
                            >
                              Edit in Catalog
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => openAdd({
                              productName: item.productName,
                              unit: item.unit,
                              category: item.category,
                              price: item.lastPrice,
                            })}
                            className="text-[10px] px-2.5 py-1 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-semibold whitespace-nowrap"
                          >
                            + Add to Catalog
                          </button>
                        )}

                        {catalogMatch && (
                          <span className="text-[10px] text-emerald-600 text-center font-medium">✓ In catalog</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Supplier Card ────────────────────────────────────────────────────────────

function SupplierCard({ s, onDelete }: { s: { id: number; name: string; contactPerson?: string; phone?: string; email?: string }; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const { data: products = [] } = useGetSupplierProducts(s.id);

  return (
    <div className="bg-white rounded-2xl shadow-sm border hover:shadow-md transition-shadow">
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="w-11 h-11 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <button
            onClick={onDelete}
            className="text-slate-300 hover:text-rose-500 transition-colors p-1"
            title="Delete supplier"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <h3 className="font-bold text-lg text-slate-900 mb-1 leading-tight">{s.name}</h3>

        <div className="space-y-1.5 text-sm text-slate-600 mt-3">
          {s.contactPerson && (
            <div className="flex items-center gap-2"><User className="w-3.5 h-3.5 text-slate-400 shrink-0" />{s.contactPerson}</div>
          )}
          {s.phone && (
            <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />{s.phone}</div>
          )}
          {s.email && (
            <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />{s.email}</div>
          )}
        </div>

        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-4 w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-sm"
        >
          <span className="flex items-center gap-2 text-slate-700 font-medium">
            <Package className="w-4 h-4 text-primary" />
            {products.length > 0 ? (
              <span>{products.length} product{products.length !== 1 ? "s" : ""} in catalog</span>
            ) : (
              <span className="text-slate-400">No products yet</span>
            )}
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
      </div>

      {expanded && (
        <div className="px-5 pb-5">
          <SupplierProductsPanel supplierId={s.id} supplierName={s.name} />
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Suppliers() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { data: suppliers = [], isLoading } = useListSuppliers();
  const { createSupplier, removeSupplier } = useSupplierMutations();

  const form = useForm<SupplierFormValues>({ resolver: zodResolver(supplierSchema) });

  return (
    <div>
      <PageHeader
        title="Supplier Directory"
        description="Manage vendors, contact info, and their product catalogs."
        action={
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setIsDialogOpen(true)}
              className="no-print flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl shadow-lg hover:-translate-y-0.5 transition-all"
            >
              <Plus className="w-4 h-4" /> Add Supplier
            </button>
            <PrintButton />
          </div>
        }
      />

      {suppliers.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          <div className="bg-white border rounded-2xl px-4 py-3">
            <p className="text-[11px] text-slate-500 uppercase font-semibold tracking-wider mb-1">Total Suppliers</p>
            <p className="text-2xl font-extrabold text-slate-900">{suppliers.length}</p>
          </div>
          <div className="bg-white border rounded-2xl px-4 py-3">
            <p className="text-[11px] text-slate-500 uppercase font-semibold tracking-wider mb-1">With Products</p>
            <p className="text-2xl font-extrabold text-primary">{suppliers.length}</p>
            <p className="text-[10px] text-slate-400">expand a card to manage</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 col-span-2 md:col-span-1">
            <p className="text-[11px] text-slate-500 uppercase font-semibold tracking-wider mb-1">How it works</p>
            <p className="text-xs text-slate-600">Expand a supplier → view last month's purchases → add to catalog or update prices.</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-slate-400 py-8 text-center">Loading suppliers...</p>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-16 text-slate-400 border-2 border-dashed rounded-2xl">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-slate-600">No suppliers yet</p>
          <p className="text-sm mt-1">Add your first supplier to get started.</p>
          <button
            onClick={() => setIsDialogOpen(true)}
            className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl mx-auto hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Add First Supplier
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {suppliers.map(s => (
            <SupplierCard key={s.id} s={s} onDelete={() => removeSupplier.mutate({ id: s.id })} />
          ))}
        </div>
      )}

      {isDialogOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold">Add Supplier</h2>
              <button onClick={() => { setIsDialogOpen(false); form.reset(); }} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form
              onSubmit={form.handleSubmit(d => createSupplier.mutate(
                { data: d },
                { onSuccess: () => { setIsDialogOpen(false); form.reset(); } }
              ))}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-1">Company Name * / اسم الشركة</label>
                <input {...form.register("name")} className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary" autoFocus />
                {form.formState.errors.name && <p className="text-xs text-rose-500 mt-1">{form.formState.errors.name.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Contact Person / جهة الاتصال</label>
                <input {...form.register("contactPerson")} className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone / الهاتف</label>
                <input {...form.register("phone")} className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email / البريد الإلكتروني</label>
                <input {...form.register("email")} type="email" className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary" />
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={() => { setIsDialogOpen(false); form.reset(); }} className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-xl">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSupplier.isPending}
                  className="px-6 py-2 bg-primary text-white rounded-xl shadow-md disabled:opacity-60 font-semibold"
                >
                  {createSupplier.isPending ? "Saving..." : "Add Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
