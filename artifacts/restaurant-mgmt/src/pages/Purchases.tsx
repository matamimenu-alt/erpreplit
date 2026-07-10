import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useListPurchases, useCreatePurchaseBatch, useGetPurchaseProductSuggestions, useListBranchTransfers, useListSuppliers, useGetSupplierProducts } from "@workspace/api-client-react";
import type { SupplierProduct, PurchaseCategory } from "@workspace/api-client-react";
import { usePurchasesMutations } from "@/hooks/use-purchases";
import { PageHeader } from "@/components/ui/PageHeader";
import { useLanguage } from "@/i18n/LanguageContext";
import { PrintButton } from "@/components/ui/PrintButton";
import { formatSAR, formatDate, formatMonth } from "@/lib/format";
import { exportToExcel } from "@/lib/export-excel";
import { PURCHASE_CATEGORY_GROUPS, getCategoryMeta, getGroupForCategory } from "@/lib/categories";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, Pencil, Search, X, FileSpreadsheet, Receipt, Tag, PackagePlus, ChevronRight, Banknote, CreditCard, BookOpen, BarChart3, ChevronDown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListPurchasesQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetVatReportQueryKey,
  getGetPLReportQueryKey,
  getGetMonthlyPurchaseReportQueryKey,
  getGetCategoryExpenseReportQueryKey,
} from "@workspace/api-client-react";

// ─── Types ────────────────────────────────────────────────────────────────────

const UNITS = ["unit", "kg", "g", "liter", "ml", "piece", "box", "carton", "bottle", "can", "pack", "sack", "bag"];

interface InvoiceItem {
  localId: string;
  productName: string;
  mainGroupKey: string;
  category: string;
  unit: string;
  quantity: number;
  price: number;
}

type InvoiceType = "tax" | "non-tax";
type PaymentType = "cash" | "card" | "credit";

const VAT_RATE = 0.15;
const today = new Date().toISOString().split("T")[0];

function calcItem(qty: number, price: number, priceIncludesVat: boolean, invoiceType: InvoiceType) {
  const gross = qty * price;
  if (invoiceType === "non-tax") return { net: +gross.toFixed(2), vat: 0, total: +gross.toFixed(2) };
  if (priceIncludesVat) {
    const net = gross / (1 + VAT_RATE);
    const vat = gross - net;
    return { net: +net.toFixed(2), vat: +vat.toFixed(2), total: +gross.toFixed(2) };
  }
  const vat = gross * VAT_RATE;
  return { net: +gross.toFixed(2), vat: +vat.toFixed(2), total: +(gross + vat).toFixed(2) };
}

function newLocalId() {
  return Math.random().toString(36).slice(2, 9);
}

// ─── Product Autocomplete Combobox ───────────────────────────────────────────

interface ProductSuggestion {
  productName: string;
  category: string;
  unit?: string;
  lastPrice: number;
}

function ProductCombobox({
  value,
  onChange,
  onSelect,
  onAfterSelect,
  onEnter,
  placeholder,
  inputRef: externalRef,
  currentItems = [],
  editingLocalId,
  supplierProducts,
}: {
  value: string;
  onChange: (val: string) => void;
  onSelect: (s: ProductSuggestion) => void;
  onAfterSelect?: () => void;
  onEnter?: () => void;
  placeholder?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  currentItems?: { productName: string; localId: string }[];
  editingLocalId?: string | null;
  supplierProducts?: SupplierProduct[];
}) {
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const internalRef = useRef<HTMLInputElement>(null);
  const ref = (externalRef ?? internalRef) as React.RefObject<HTMLInputElement>;
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: allProducts } = useGetPurchaseProductSuggestions();

  // When supplier is selected, use their catalog; otherwise fall back to purchase history
  const safeProducts = useMemo(() => {
    if (supplierProducts && supplierProducts.length > 0) {
      return supplierProducts.map(p => ({
        productName: p.productName,
        category: p.category,
        unit: p.unit,
        lastPrice: p.currentPrice,
      }));
    }
    return (allProducts ?? []).filter(p => !!p.productName).map(p => ({
      productName: p.productName,
      category: p.category,
      unit: undefined,
      lastPrice: p.lastPrice,
    }));
  }, [supplierProducts, allProducts]);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return safeProducts.slice(0, 12);
    return safeProducts
      .filter(p => p.productName.toLowerCase().includes(q))
      .slice(0, 15);
  }, [value, safeProducts]);

  const exactMatch = filtered.find(p => p.productName.toLowerCase() === value.trim().toLowerCase());
  const showAddNew = value.trim().length > 1 && !exactMatch;
  const totalOptions = filtered.length + (showAddNew ? 1 : 0);

  // Duplicate check — same product already in this invoice (not the item being edited)
  // Matches if the typed value equals OR is a substring of an existing item name (case-insensitive)
  const duplicateItem = value.trim().length > 1 ? currentItems.find(
    i => i.localId !== editingLocalId &&
         i.productName.toLowerCase() === value.trim().toLowerCase()
  ) : undefined;
  // Also warn when the typed partial matches a name already in the invoice
  const partialDuplicate = value.trim().length > 2 ? currentItems.find(
    i => i.localId !== editingLocalId &&
         i.productName.toLowerCase().includes(value.trim().toLowerCase()) &&
         i.productName.toLowerCase() !== value.trim().toLowerCase()
  ) : undefined;

  useEffect(() => { setHighlightIdx(-1); }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        ref.current && !ref.current.contains(e.target as Node)
      ) { setOpen(false); }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectSuggestion(s: ProductSuggestion) {
    onSelect(s);
    setOpen(false);
    setHighlightIdx(-1);
    setTimeout(() => onAfterSelect?.(), 0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Tab") {
      setOpen(false);
      return; // let Tab propagate normally for focus navigation
    }
    if (!open) {
      if (e.key === "ArrowDown") { setOpen(true); setHighlightIdx(0); e.preventDefault(); return; }
      if (e.key === "Enter") { e.preventDefault(); onEnter?.(); return; }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx(i => Math.min(i + 1, totalOptions - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIdx >= 0 && highlightIdx < filtered.length) {
        selectSuggestion(filtered[highlightIdx]);
      } else if (highlightIdx === filtered.length && showAddNew) {
        setOpen(false);
        setTimeout(() => onAfterSelect?.(), 0);
      } else {
        setOpen(false);
        onEnter?.();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIdx >= 0 && dropdownRef.current) {
      const el = dropdownRef.current.children[highlightIdx] as HTMLElement;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIdx]);

  return (
    <div className="relative">
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary text-sm bg-white"
      />

      {/* Duplicate warning — exact match */}
      {duplicateItem && (
        <p className="text-xs text-amber-600 mt-1">
          ⚠️ <strong>{duplicateItem.productName}</strong> is already on line {currentItems.findIndex(i => i.localId === duplicateItem.localId) + 1} of this invoice. Consider editing that line instead.
        </p>
      )}
      {/* Partial duplicate hint — possible match */}
      {!duplicateItem && partialDuplicate && (
        <p className="text-xs text-amber-500 mt-1">
          💡 Similar to <strong>"{partialDuplicate.productName}"</strong> already on line {currentItems.findIndex(i => i.localId === partialDuplicate.localId) + 1}. Did you mean that?
        </p>
      )}

      {/* Dropdown */}
      {open && totalOptions > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 z-[100] bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-60 overflow-y-auto"
        >
          {filtered.map((p, idx) => {
            const isExact = p.productName.toLowerCase() === value.trim().toLowerCase();
            const meta = getCategoryMeta(p.category);
            return (
              <button
                key={p.productName}
                type="button"
                onMouseDown={() => selectSuggestion(p)}
                onMouseEnter={() => setHighlightIdx(idx)}
                className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 text-sm transition-colors border-b border-slate-50 last:border-0
                  ${highlightIdx === idx ? "bg-primary/10" : "hover:bg-slate-50"}
                  ${isExact ? "bg-green-50" : ""}`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {isExact ? (
                    <span className="text-green-600 text-xs shrink-0">✓</span>
                  ) : (
                    <span className="text-slate-300 text-xs shrink-0">↩</span>
                  )}
                  <span className="font-medium truncate">{p.productName}</span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${meta.badge}`}>
                    {meta.label}
                  </span>
                  <span className="text-slate-500 text-xs font-mono">{formatSAR(p.lastPrice)}</span>
                </span>
              </button>
            );
          })}

          {showAddNew && (
            <button
              type="button"
              onMouseDown={() => setOpen(false)}
              onMouseEnter={() => setHighlightIdx(filtered.length)}
              className={`w-full text-left px-3 py-2.5 flex items-center gap-2 text-sm border-t border-slate-100
                ${highlightIdx === filtered.length ? "bg-primary/10" : "hover:bg-slate-50"}`}
            >
              <Plus className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-primary font-medium">
                Add <span className="font-bold">"{value.trim()}"</span> as new item
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Multi-Item Invoice Modal ─────────────────────────────────────────────────

function PurchaseInvoiceModal({
  open,
  onClose,
  onSaved,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (invoiceId: string, invoiceType: InvoiceType, date: string, supplier: string, payment: PaymentType, vatInclusion: boolean, items: InvoiceItem[]) => void;
  isPending: boolean;
}) {
  // Invoice-level state
  const [invoiceType, setInvoiceType] = useState<InvoiceType>("tax");
  const [date, setDate] = useState(today);
  const [supplier, setSupplier] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [payment, setPayment] = useState<PaymentType>("cash");
  const [priceIncludesVat, setPriceIncludesVat] = useState(false);
  const [invoiceNotes, setInvoiceNotes] = useState("");

  // Load suppliers + products for selected supplier
  const { data: allSuppliers = [] } = useListSuppliers();
  const { data: selectedSupplierProducts = [] } = useGetSupplierProducts(
    selectedSupplierId ?? 0,
    { query: { enabled: selectedSupplierId != null } }
  );

  // Items list
  const [items, setItems] = useState<InvoiceItem[]>([]);

  // Add / Edit item form
  const defaultAddForm = {
    productName: "",
    mainGroupKey: PURCHASE_CATEGORY_GROUPS[0].key,
    category: PURCHASE_CATEGORY_GROUPS[0].subcategories[0].value,
    unit: "unit" as string,
    quantity: "" as number | "",
    price: "" as number | "",
  };
  const [addForm, setAddForm] = useState({ ...defaultAddForm });
  const [editingLocalId, setEditingLocalId] = useState<string | null>(null);
  const [addError, setAddError] = useState("");

  const productNameRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setInvoiceType("tax");
      setDate(today);
      setSupplier("");
      setSelectedSupplierId(null);
      setPayment("cash");
      setPriceIncludesVat(false);
      setInvoiceNotes("");
      setItems([]);
      setAddForm({ ...defaultAddForm });
      setEditingLocalId(null);
      setAddError("");
      setTimeout(() => productNameRef.current?.focus(), 100);
    }
  }, [open]);

  const activeAddGroup = PURCHASE_CATEGORY_GROUPS.find(g => g.key === addForm.mainGroupKey) ?? PURCHASE_CATEGORY_GROUPS[0];

  function handleAddGroupChange(key: string) {
    const grp = PURCHASE_CATEGORY_GROUPS.find(g => g.key === key);
    setAddForm(f => ({
      ...f,
      mainGroupKey: key,
      category: grp?.subcategories[0].value ?? f.category,
    }));
  }

  function validateAddForm() {
    if (!addForm.productName.trim()) { setAddError("Product name is required."); return false; }
    if (!addForm.quantity || Number(addForm.quantity) <= 0) { setAddError("Quantity must be > 0."); return false; }
    if (addForm.price === "" || Number(addForm.price) < 0) { setAddError("Price must be ≥ 0."); return false; }
    setAddError("");
    return true;
  }

  function handleAddItem() {
    if (!validateAddForm()) return;
    const item: InvoiceItem = {
      localId: editingLocalId ?? newLocalId(),
      productName: addForm.productName.trim(),
      mainGroupKey: addForm.mainGroupKey,
      category: addForm.category,
      unit: addForm.unit || "unit",
      quantity: Number(addForm.quantity),
      price: Number(addForm.price),
    };
    if (editingLocalId) {
      setItems(prev => prev.map(i => i.localId === editingLocalId ? item : i));
      setEditingLocalId(null);
    } else {
      setItems(prev => [...prev, item]);
    }
    setAddForm({ ...defaultAddForm });
    setTimeout(() => productNameRef.current?.focus(), 50);
  }

  function handleEditItem(item: InvoiceItem) {
    setAddForm({
      productName: item.productName,
      mainGroupKey: item.mainGroupKey,
      category: item.category,
      unit: item.unit || "unit",
      quantity: item.quantity,
      price: item.price,
    });
    setEditingLocalId(item.localId);
    productNameRef.current?.focus();
  }

  function handleCancelEdit() {
    setEditingLocalId(null);
    setAddForm({ ...defaultAddForm });
    setAddError("");
  }

  function handleProductSelect(s: ProductSuggestion) {
    const grp = getGroupForCategory(s.category);
    setAddForm(f => ({
      ...f,
      productName: s.productName,
      mainGroupKey: grp?.key ?? PURCHASE_CATEGORY_GROUPS[0].key,
      category: s.category,
      unit: s.unit || f.unit || "unit",
      price: s.lastPrice,
    }));
    setAddError("");
  }

  function handleDeleteItem(localId: string) {
    setItems(prev => prev.filter(i => i.localId !== localId));
    if (editingLocalId === localId) { setEditingLocalId(null); setAddForm({ ...defaultAddForm }); }
  }

  function handleSave() {
    if (items.length === 0) { setAddError("Add at least one item to the invoice."); return; }
    onSaved(crypto.randomUUID(), invoiceType, date, supplier, payment, priceIncludesVat, items);
  }

  // Computed totals
  const subtotal = items.reduce((s, item) => {
    const { net } = calcItem(item.quantity, item.price, priceIncludesVat, invoiceType);
    return s + net;
  }, 0);
  const totalVat = items.reduce((s, item) => {
    const { vat } = calcItem(item.quantity, item.price, priceIncludesVat, invoiceType);
    return s + vat;
  }, 0);
  const grandTotal = items.reduce((s, item) => {
    const { total } = calcItem(item.quantity, item.price, priceIncludesVat, invoiceType);
    return s + total;
  }, 0);

  // Preview of current add-form item
  const addPreview = calcItem(
    Number(addForm.quantity) || 0,
    Number(addForm.price) || 0,
    priceIncludesVat,
    invoiceType
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">

        {/* ── Modal Header ── */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-slate-50 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <PackagePlus className="w-5 h-5 text-primary" />
              New Multi-Item Invoice
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">فاتورة متعددة الأصناف — Add all items, then save at once</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* ── Invoice Header Fields ── */}
          <div className="px-6 py-4 border-b bg-slate-50/50">
            {/* Invoice Type */}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Invoice Type / نوع الفاتورة</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setInvoiceType("tax")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm transition-all ${invoiceType === "tax" ? "border-primary bg-primary/5 text-primary font-semibold" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
                >
                  <Receipt className="w-4 h-4" /> Tax Invoice — فاتورة ضريبية
                </button>
                <button
                  type="button"
                  onClick={() => setInvoiceType("non-tax")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm transition-all ${invoiceType === "non-tax" ? "border-amber-500 bg-amber-50 text-amber-700 font-semibold" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
                >
                  <Tag className="w-4 h-4" /> Non-Tax — بدون ضريبة
                </button>
                {invoiceType === "tax" && (
                  <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white cursor-pointer text-sm text-slate-600 hover:border-slate-300">
                    <input
                      type="checkbox"
                      checked={priceIncludesVat}
                      onChange={e => setPriceIncludesVat(e.target.checked)}
                      className="w-3.5 h-3.5 accent-primary"
                    />
                    Price includes 15% VAT
                  </label>
                )}
              </div>
            </div>

            {/* Date + Supplier + Payment */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Date / التاريخ</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Supplier / المورد</label>
                <select
                  value={selectedSupplierId ?? ""}
                  onChange={e => {
                    const val = e.target.value;
                    if (!val) {
                      setSelectedSupplierId(null);
                      setSupplier("");
                      setAddForm(f => ({ ...f, productName: "", price: "" as unknown as number }));
                    } else {
                      const s = allSuppliers.find(s => s.id === parseInt(val));
                      setSelectedSupplierId(parseInt(val));
                      setSupplier(s?.name ?? "");
                      setAddForm(f => ({ ...f, productName: "" }));
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary bg-white text-sm"
                >
                  <option value="">— No supplier / بدون مورد —</option>
                  {allSuppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {selectedSupplierId && selectedSupplierProducts.length > 0 && (
                  <p className="text-[10px] text-emerald-600 mt-0.5 font-medium">
                    ✓ {selectedSupplierProducts.length} products linked — select from the list below
                  </p>
                )}
                {selectedSupplierId && selectedSupplierProducts.length === 0 && (
                  <p className="text-[10px] text-amber-500 mt-0.5">
                    ⚠️ No catalog products for this supplier yet — add them in the Suppliers page
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Payment / طريقة الدفع</label>
                <select
                  value={payment}
                  onChange={e => setPayment(e.target.value as PaymentType)}
                  className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary bg-white text-sm"
                >
                  <option value="cash">💵 Cash</option>
                  <option value="card">💳 Card / Bank Transfer</option>
                  <option value="credit">📄 Credit / On Account</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Items Table ── */}
          <div className="px-6 py-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-700">
                Invoice Items / أصناف الفاتورة
                {items.length > 0 && <span className="ml-2 text-xs font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full">{items.length} items</span>}
              </h3>
            </div>

            {items.length > 0 ? (
              <div className="border rounded-xl overflow-hidden mb-3">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Product / المنتج</th>
                      <th className="px-3 py-2 text-left">Category / الفئة</th>
                      <th className="px-3 py-2 text-center">Unit</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Unit Price</th>
                      <th className="px-3 py-2 text-right">Net</th>
                      {invoiceType === "tax" && <th className="px-3 py-2 text-right">VAT</th>}
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2 w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((item, idx) => {
                      const calc = calcItem(item.quantity, item.price, priceIncludesVat, invoiceType);
                      const meta = getCategoryMeta(item.category);
                      const isEditing = editingLocalId === item.localId;
                      return (
                        <tr key={item.localId} className={`transition-colors ${isEditing ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                          <td className="px-3 py-2.5 text-slate-400 text-xs">{idx + 1}</td>
                          <td className="px-3 py-2.5 font-medium text-slate-800">
                            {isEditing && <span className="text-xs text-blue-600 mr-1">✏️</span>}
                            {item.productName}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${meta.badge}`}>
                              {meta.label}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center text-slate-500 text-xs">{item.unit || "unit"}</td>
                          <td className="px-3 py-2.5 text-right text-slate-600">{item.quantity}</td>
                          <td className="px-3 py-2.5 text-right text-slate-600">{formatSAR(item.price)}</td>
                          <td className="px-3 py-2.5 text-right">{formatSAR(calc.net)}</td>
                          {invoiceType === "tax" && (
                            <td className="px-3 py-2.5 text-right text-emerald-600 text-xs">{formatSAR(calc.vat)}</td>
                          )}
                          <td className="px-3 py-2.5 text-right font-semibold">{formatSAR(calc.total)}</td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex gap-1 justify-end">
                              <button
                                type="button"
                                onClick={() => handleEditItem(item)}
                                className="text-primary p-1 hover:bg-primary/10 rounded-lg"
                                title="Edit item"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item.localId)}
                                className="text-rose-500 p-1 hover:bg-rose-50 rounded-lg"
                                title="Delete item"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-200 rounded-xl py-6 text-center text-slate-400 text-sm mb-3">
                No items yet — use the form below to add items to this invoice
                <p className="text-xs mt-1 text-slate-300">لا توجد أصناف — استخدم النموذج أدناه لإضافة أصناف</p>
              </div>
            )}

            {/* ── Add Item Form ── */}
            <div className={`rounded-xl border-2 p-4 ${editingLocalId ? "border-blue-300 bg-blue-50" : "border-primary/30 bg-primary/5"}`}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-700">
                  {editingLocalId ? "✏️ Edit Item / تعديل الصنف" : "➕ Add Item / إضافة صنف"}
                </h4>
                {editingLocalId && (
                  <button type="button" onClick={handleCancelEdit} className="text-xs text-slate-500 hover:text-slate-700 underline">
                    Cancel Edit
                  </button>
                )}
              </div>

              {/* Row 1: Product Name — Smart Autocomplete */}
              <div className="mb-2">
                <label className="block text-xs text-slate-500 mb-1">
                  Product / Item Name — اسم المنتج *
                  {selectedSupplierId && selectedSupplierProducts.length > 0 ? (
                    <span className="ml-2 text-emerald-600 font-medium">
                      🔗 Showing {selectedSupplierProducts.length} products from selected supplier
                    </span>
                  ) : (
                    <span className="ml-2 text-slate-400 font-normal">(type to search, ↑↓ to navigate, Enter to select)</span>
                  )}
                </label>
                <ProductCombobox
                  value={addForm.productName}
                  onChange={val => setAddForm(f => ({ ...f, productName: val }))}
                  onSelect={handleProductSelect}
                  onAfterSelect={() => { qtyRef.current?.focus(); qtyRef.current?.select(); }}
                  onEnter={handleAddItem}
                  placeholder={
                    selectedSupplierId && selectedSupplierProducts.length > 0
                      ? `Search ${selectedSupplierProducts.length} products from ${supplier}...`
                      : "e.g. Chicken Breast, Mineral Water... — ابحث أو أدخل اسم الصنف"
                  }
                  inputRef={productNameRef}
                  currentItems={items}
                  editingLocalId={editingLocalId}
                  supplierProducts={selectedSupplierId ? selectedSupplierProducts : undefined}
                />
              </div>

              {/* Row 2: Category Selection (compact) */}
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Main Category / الفئة الرئيسية</label>
                  <select
                    value={addForm.mainGroupKey}
                    onChange={e => handleAddGroupChange(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary bg-white text-sm"
                  >
                    {PURCHASE_CATEGORY_GROUPS.map(g => (
                      <option key={g.key} value={g.key}>{g.label} — {g.labelAr}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Subcategory / الفئة الفرعية</label>
                  <select
                    value={addForm.category}
                    onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary bg-white text-sm"
                  >
                    {activeAddGroup.subcategories.map(s => (
                      <option key={s.value} value={s.value}>{s.label} — {s.labelAr}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 3: Qty + Unit + Price + Preview + Add button */}
              <div className="flex items-end gap-2">
                <div className="w-24">
                  <label className="block text-xs text-slate-500 mb-1">Qty / الكمية</label>
                  <input
                    ref={qtyRef}
                    type="number"
                    step="0.001"
                    min="0"
                    value={addForm.quantity}
                    onChange={e => setAddForm(f => ({ ...f, quantity: e.target.value === "" ? "" : Number(e.target.value) }))}
                    placeholder="0"
                    className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary text-sm bg-white"
                  />
                </div>
                <div className="w-28">
                  <label className="block text-xs text-slate-500 mb-1">Unit / الوحدة</label>
                  <select
                    value={addForm.unit}
                    onChange={e => setAddForm(f => ({ ...f, unit: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary text-sm bg-white"
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="w-32">
                  <label className="block text-xs text-slate-500 mb-1">Unit Price (SAR)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={addForm.price}
                    onChange={e => setAddForm(f => ({ ...f, price: e.target.value === "" ? "" : Number(e.target.value) }))}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary text-sm bg-white"
                    onKeyDown={e => e.key === "Enter" && handleAddItem()}
                  />
                </div>

                {/* Live preview */}
                {Number(addForm.quantity) > 0 && Number(addForm.price) > 0 && (
                  <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-white border rounded-xl text-xs text-slate-600">
                    <span className="text-slate-400">Net:</span>
                    <span className="font-semibold">{formatSAR(addPreview.net)}</span>
                    {invoiceType === "tax" && (
                      <>
                        <span className="text-slate-300">|</span>
                        <span className="text-slate-400">VAT:</span>
                        <span className="text-emerald-600 font-semibold">{formatSAR(addPreview.vat)}</span>
                      </>
                    )}
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-400">Total:</span>
                    <span className="font-bold text-slate-800">{formatSAR(addPreview.total)}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleAddItem}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                    editingLocalId
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : "bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/25"
                  }`}
                >
                  {editingLocalId ? <><Pencil className="w-3.5 h-3.5" /> Update Item</> : <><Plus className="w-3.5 h-3.5" /> Add Item</>}
                </button>
              </div>

              {addError && <p className="text-xs text-rose-600 mt-2">⚠️ {addError}</p>}
              <p className="text-[10px] text-slate-400 mt-1.5">Tip: Press Enter in any field to add the item quickly. / اضغط Enter لإضافة الصنف بسرعة.</p>
            </div>
          </div>
        </div>

        {/* ── Invoice Totals + Actions ── */}
        <div className="px-6 py-4 border-t bg-slate-50 rounded-b-2xl">
          <div className="flex items-center justify-between">
            {/* Totals */}
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-xs text-slate-400">Subtotal</p>
                <p className="font-semibold text-slate-700 text-sm">{formatSAR(subtotal)}</p>
              </div>
              {invoiceType === "tax" && (
                <>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                  <div className="text-center">
                    <p className="text-xs text-slate-400">VAT (15%)</p>
                    <p className="font-semibold text-emerald-600 text-sm">{formatSAR(totalVat)}</p>
                  </div>
                </>
              )}
              <ChevronRight className="w-4 h-4 text-slate-300" />
              <div className="text-center">
                <p className="text-xs text-slate-400">Grand Total</p>
                <p className="font-bold text-lg text-slate-900">{formatSAR(grandTotal)}</p>
              </div>
              {items.length > 0 && (
                <span className="text-xs text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">{items.length} items</span>
              )}
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-200 rounded-xl text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending || items.length === 0}
                className="px-6 py-2 bg-primary text-white rounded-xl shadow-md disabled:opacity-60 font-semibold text-sm flex items-center gap-2"
              >
                {isPending ? "Saving..." : <><Receipt className="w-4 h-4" /> Save Invoice ({items.length} items)</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Single-Item Edit Modal (for editing existing items) ──────────────────────

const editSchema = z.object({
  date: z.string().min(1, "Required"),
  supplierName: z.string().optional(),
  productName: z.string().min(1, "Required"),
  category: z.string().min(1, "Required"),
  unit: z.string().default("unit"),
  quantity: z.coerce.number().min(0.001),
  price: z.coerce.number().min(0),
  invoiceType: z.enum(["tax", "non-tax"]).default("tax"),
  priceIncludesVat: z.boolean(),
  paymentType: z.enum(["cash", "card", "credit"]).default("cash"),
  notes: z.string().optional(),
});
type EditForm = z.infer<typeof editSchema>;

function PurchaseEditModal({
  open,
  defaultValues,
  onClose,
  onSubmit,
  isPending,
}: {
  open: boolean;
  defaultValues: EditForm;
  onClose: () => void;
  onSubmit: (data: EditForm) => void;
  isPending: boolean;
}) {
  const form = useForm<EditForm>({ resolver: zodResolver(editSchema), defaultValues });
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

  const invoiceType = useWatch({ control: form.control, name: "invoiceType" });
  const qty = useWatch({ control: form.control, name: "quantity" });
  const price = useWatch({ control: form.control, name: "price" });
  const vatIncluded = useWatch({ control: form.control, name: "priceIncludesVat" });
  const isTax = invoiceType !== "non-tax";
  const preview = calcItem(Number(qty) || 0, Number(price) || 0, Boolean(vatIncluded), invoiceType as InvoiceType);
  const activeGroup = PURCHASE_CATEGORY_GROUPS.find(g => g.key === selectedGroupKey) ?? PURCHASE_CATEGORY_GROUPS[0];

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 max-h-[90vh] flex flex-col">
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Edit Purchase Item</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={form.handleSubmit(onSubmit)} className="p-5 space-y-3 overflow-y-auto flex-1">
          {/* Invoice Type */}
          <div className="grid grid-cols-2 gap-2">
            <label className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer ${invoiceType === "tax" ? "border-primary bg-primary/5" : "border-slate-200"}`}>
              <input type="radio" value="tax" {...form.register("invoiceType")} className="sr-only" />
              <Receipt className={`w-4 h-4 ${invoiceType === "tax" ? "text-primary" : "text-slate-400"}`} />
              <div><p className="text-sm font-semibold">Tax Invoice</p><p className="text-xs text-slate-500">VAT 15%</p></div>
            </label>
            <label className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer ${invoiceType === "non-tax" ? "border-amber-500 bg-amber-50" : "border-slate-200"}`}>
              <input type="radio" value="non-tax" {...form.register("invoiceType")} className="sr-only" />
              <Tag className={`w-4 h-4 ${invoiceType === "non-tax" ? "text-amber-600" : "text-slate-400"}`} />
              <div><p className="text-sm font-semibold">Non-Tax</p><p className="text-xs text-slate-500">No VAT</p></div>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
              <input type="date" {...form.register("date")} className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Supplier</label>
              <input {...form.register("supplierName")} className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Product Name *</label>
            <input {...form.register("productName")} className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary text-sm" />
          </div>
          {/* Category */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Main Category</label>
              <select
                value={selectedGroupKey}
                onChange={e => {
                  setSelectedGroupKey(e.target.value);
                  const grp = PURCHASE_CATEGORY_GROUPS.find(g => g.key === e.target.value);
                  if (grp) form.setValue("category", grp.subcategories[0].value, { shouldValidate: true });
                }}
                className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary bg-white text-sm"
              >
                {PURCHASE_CATEGORY_GROUPS.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Subcategory</label>
              <select
                {...form.register("category")}
                value={currentCategory}
                className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary bg-white text-sm"
              >
                {activeGroup.subcategories.map(s => <option key={s.value} value={s.value}>{s.label} — {s.labelAr}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Quantity *</label>
              <input type="number" step="0.001" min="0" {...form.register("quantity")} className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Unit / الوحدة</label>
              <select {...form.register("unit")} className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary bg-white text-sm">
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Unit Price (SAR) *</label>
              <input type="number" step="0.01" min="0" {...form.register("price")} className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary text-sm" />
            </div>
          </div>
          {isTax && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" {...form.register("priceIncludesVat")} className="accent-primary" />
              Price already includes 15% VAT
            </label>
          )}
          <div className={`grid gap-2 p-3 rounded-xl text-sm border ${isTax ? "grid-cols-3 bg-emerald-50 border-emerald-200" : "grid-cols-2 bg-amber-50 border-amber-200"}`}>
            <div className="text-center"><p className="text-xs text-slate-500">Net</p><p className="font-bold">{formatSAR(preview.net)}</p></div>
            {isTax && <div className="text-center border-x border-emerald-200"><p className="text-xs text-slate-500">VAT (15%)</p><p className="font-bold text-emerald-700">{formatSAR(preview.vat)}</p></div>}
            <div className="text-center"><p className="text-xs text-slate-500">Total</p><p className="font-bold">{formatSAR(preview.total)}</p></div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Payment Type</label>
            <select {...form.register("paymentType")} className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary bg-white text-sm">
              <option value="cash">💵 Cash</option>
              <option value="card">💳 Card / Bank Transfer</option>
              <option value="credit">📄 Credit / On Account</option>
            </select>
          </div>
          <div className="pt-3 flex justify-end gap-3 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
            <button type="submit" disabled={isPending} className="px-5 py-2 bg-primary text-white rounded-xl disabled:opacity-60 text-sm font-semibold">
              {isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Purchases Page ───────────────────────────────────────────────────────────

export default function Purchases() {
  const { t } = useLanguage();
  const [month, setMonth] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [invoiceFilter, setInvoiceFilter] = useState<"" | "tax" | "non-tax">("");
  const [paymentFilter, setPaymentFilter] = useState<"" | "cash" | "card" | "credit">("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<{ id: number; data: EditForm } | null>(null);

  const queryClient = useQueryClient();
  const { data: purchases, isLoading } = useListPurchases(month ? { month } : undefined);
  const { update, remove } = usePurchasesMutations();
  const batchCreate = useCreatePurchaseBatch();

  // ── Unique suppliers extracted from purchase records ─────────────────────────
  const uniqueSuppliers = useMemo(() => {
    const names = new Set((purchases ?? []).map(p => p.supplierName).filter(Boolean) as string[]);
    return Array.from(names).sort();
  }, [purchases]);

  // ── Branch Transfers — fetch to calculate internal cost adjustments ──────────
  const { data: allTransfers = [] } = useListBranchTransfers({});
  const { transfersIn, transfersOut, transfersInCost, transfersOutCost, netTransferCost } = useMemo(() => {
    const filtered = month
      ? allTransfers.filter(t => t.transferDate.startsWith(month))
      : allTransfers;
    const inn = filtered.filter(t => t.toRestaurantId != null && !t.destinationName);
    const out = filtered.filter(t => t.fromRestaurantId != null && t.toRestaurantId != null && !t.destinationName);
    const inCost  = inn.reduce((s, t) => s + t.quantity * t.unitPrice, 0);
    const outCost = out.reduce((s, t) => s + t.quantity * t.unitPrice, 0);
    return {
      transfersIn:  inn,
      transfersOut: out,
      transfersInCost:  inCost,
      transfersOutCost: outCost,
      netTransferCost:  inCost - outCost,
    };
  }, [allTransfers, month]);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getListPurchasesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetVatReportQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetPLReportQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetMonthlyPurchaseReportQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetCategoryExpenseReportQueryKey() });
  }, [queryClient]);

  // ── Client-side filtering (all combined) ─────────────────────────────────────
  const filtered = (purchases ?? []).filter((p) => {
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (searchQuery && !p.productName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (invoiceFilter && p.invoiceType !== invoiceFilter) return false;
    if (paymentFilter && p.paymentType !== paymentFilter) return false;
    if (supplierFilter && !(p.supplierName ?? "").toLowerCase().includes(supplierFilter.toLowerCase())) return false;
    if (dateFrom && p.date < dateFrom) return false;
    if (dateTo && p.date > dateTo) return false;
    return true;
  });

  // ── Payment-type KPI totals ──────────────────────────────────────────────────
  const cashTotal   = filtered.filter(p => p.paymentType === "cash").reduce((s, p) => s + p.totalAmount, 0);
  const cardTotal   = filtered.filter(p => p.paymentType === "card").reduce((s, p) => s + p.totalAmount, 0);
  const creditTotal = filtered.filter(p => p.paymentType === "credit").reduce((s, p) => s + p.totalAmount, 0);
  const cashCount   = filtered.filter(p => p.paymentType === "cash").length;
  const cardCount   = filtered.filter(p => p.paymentType === "card").length;
  const creditCount = filtered.filter(p => p.paymentType === "credit").length;

  // Summary stats
  const taxable    = filtered.filter(p => p.invoiceType !== "non-tax");
  const nonTaxable = filtered.filter(p => p.invoiceType === "non-tax");
  const totalTaxableNet   = taxable.reduce((s, p) => s + p.amountBeforeVat, 0);
  const totalInputVat     = taxable.reduce((s, p) => s + p.vatAmount, 0);
  const totalTaxableGross = taxable.reduce((s, p) => s + p.totalAmount, 0);
  const totalNonTaxable   = nonTaxable.reduce((s, p) => s + p.totalAmount, 0);
  const grandTotal        = filtered.reduce((s, p) => s + p.totalAmount, 0);

  function handleBatchSave(
    invoiceId: string,
    invoiceType: InvoiceType,
    date: string,
    supplier: string,
    payment: PaymentType,
    vatInclusion: boolean,
    items: InvoiceItem[]
  ) {
    batchCreate.mutate(
      {
        data: {
          invoiceId,
          date,
          supplierName: supplier,
          invoiceType,
          priceIncludesVat: vatInclusion,
          paymentType: payment as "cash" | "card" | "credit",
          items: items.map(i => ({
            productName: i.productName,
            category: i.category as Parameters<typeof batchCreate.mutate>[0]["data"]["items"][0]["category"],
            unit: i.unit || "unit",
            quantity: i.quantity,
            price: i.price,
          })),
        },
      },
      {
        onSuccess: () => {
          setAddOpen(false);
          invalidateAll();
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : "Failed to save invoice. Please try again.";
          alert(`⚠️ Save failed: ${msg}`);
        },
      }
    );
  }

  function handleEdit(data: EditForm) {
    if (!editRecord) return;
    update.mutate(
      { id: editRecord.id, data: { ...data, supplierName: data.supplierName || "", category: data.category as PurchaseCategory } },
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
        unit: (p as { unit?: string }).unit || "unit",
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
      "Invoice ID": p.invoiceId || "",
      Product: p.productName,
      Category: getCategoryMeta(p.category).label,
      Supplier: p.supplierName || "",
      Unit: (p as { unit?: string }).unit || "unit",
      Quantity: p.quantity,
      "Unit Price (SAR)": p.price,
      "Net Amount (SAR)": p.amountBeforeVat,
      "VAT (SAR)": p.vatAmount,
      "Total (SAR)": p.totalAmount,
      Payment: p.paymentType,
      Notes: p.notes || "",
    }));
    exportToExcel(rows, `purchases-${month || "all"}`);
  }

  const hasActiveFilters = !!(categoryFilter || searchQuery || month || invoiceFilter || paymentFilter || supplierFilter || dateFrom || dateTo);

  return (
    <div>
      <PageHeader
        title={t("pages.purchasesPageTitle")}
        description={t("pages.purchasesDesc")}
        action={
          <div className="flex gap-2 flex-wrap items-center">
            <div className="no-print flex gap-2 flex-wrap">
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
                <PackagePlus className="w-4 h-4" /> Add Invoice
              </button>
            </div>
            <PrintButton />
          </div>
        }
      />

      {/* ── Payment-type KPI Cards (always visible) ─────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {/* Cash */}
        <button
          onClick={() => setPaymentFilter(paymentFilter === "cash" ? "" : "cash")}
          className={`rounded-2xl p-4 text-left transition-all border-2 ${paymentFilter === "cash" ? "border-emerald-500 bg-emerald-50 shadow-md" : "border-transparent bg-white shadow-sm hover:shadow-md border border-slate-200"}`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Banknote className="w-4 h-4 text-emerald-700" />
            </div>
            {paymentFilter === "cash" && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">ACTIVE</span>}
          </div>
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Cash Purchases</p>
          <p className="text-xl font-extrabold text-slate-900 tabular-nums mt-0.5">{formatSAR(cashTotal)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{cashCount} {cashCount === 1 ? "record" : "records"}</p>
        </button>
        {/* Card */}
        <button
          onClick={() => setPaymentFilter(paymentFilter === "card" ? "" : "card")}
          className={`rounded-2xl p-4 text-left transition-all border-2 ${paymentFilter === "card" ? "border-blue-500 bg-blue-50 shadow-md" : "border-transparent bg-white shadow-sm hover:shadow-md border border-slate-200"}`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-blue-700" />
            </div>
            {paymentFilter === "card" && <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">ACTIVE</span>}
          </div>
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Card / POS</p>
          <p className="text-xl font-extrabold text-slate-900 tabular-nums mt-0.5">{formatSAR(cardTotal)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{cardCount} {cardCount === 1 ? "record" : "records"}</p>
        </button>
        {/* Credit A/P */}
        <button
          onClick={() => setPaymentFilter(paymentFilter === "credit" ? "" : "credit")}
          className={`rounded-2xl p-4 text-left transition-all border-2 ${paymentFilter === "credit" ? "border-amber-500 bg-amber-50 shadow-md" : "border-transparent bg-white shadow-sm hover:shadow-md border border-slate-200"}`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-amber-700" />
            </div>
            {paymentFilter === "credit" && <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">ACTIVE</span>}
          </div>
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Credit (A/P)</p>
          <p className="text-xl font-extrabold text-slate-900 tabular-nums mt-0.5">{formatSAR(creditTotal)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{creditCount} {creditCount === 1 ? "record" : "records"}</p>
        </button>
        {/* Grand Total */}
        <div className="rounded-2xl p-4 bg-slate-900 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-slate-300" />
            </div>
            {hasActiveFilters && <span className="text-[10px] text-slate-400">filtered</span>}
          </div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Purchases</p>
          <p className="text-xl font-extrabold tabular-nums mt-0.5">{formatSAR(grandTotal)}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{filtered.length} {filtered.length === 1 ? "record" : "records"}</p>
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────────── */}
      <div className="bg-white border rounded-2xl shadow-sm p-4 mb-4 space-y-3">
        {/* Row 1: Date range + Month quick-pick */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 font-medium whitespace-nowrap">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setMonth(""); }}
              className="px-3 py-2 border rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 font-medium whitespace-nowrap">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setMonth(""); }}
              className="px-3 py-2 border rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <span className="text-slate-300 text-xs font-medium hidden sm:inline">or</span>
          <input
            type="month"
            value={month}
            onChange={(e) => { setMonth(e.target.value); setDateFrom(""); setDateTo(""); }}
            className="px-3 py-2 border rounded-xl shadow-sm outline-none text-sm"
            title="Quick month filter"
          />
          {hasActiveFilters && (
            <button
              onClick={() => { setCategoryFilter(""); setSearchQuery(""); setMonth(""); setInvoiceFilter(""); setPaymentFilter(""); setSupplierFilter(""); setDateFrom(""); setDateTo(""); }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-rose-500 hover:text-rose-700 border border-rose-200 hover:border-rose-400 rounded-xl transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Clear all
            </button>
          )}
        </div>
        {/* Row 2: Search + Supplier + Category + Invoice + Payment */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-44">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product / item..."
              className="w-full pl-9 pr-3 py-2 border rounded-xl shadow-sm outline-none text-sm focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {/* Supplier dropdown */}
          <div className="relative min-w-40">
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="w-full appearance-none px-3 py-2 border rounded-xl shadow-sm outline-none text-sm bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 pr-8"
            >
              <option value="">All Suppliers</option>
              {uniqueSuppliers.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border rounded-xl shadow-sm outline-none text-sm bg-white focus:border-primary focus:ring-2 focus:ring-primary/20"
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
            className="px-3 py-2 border rounded-xl shadow-sm outline-none text-sm bg-white focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All Invoice Types</option>
            <option value="tax">🧾 Tax Invoice</option>
            <option value="non-tax">🏷️ Non-Tax Invoice</option>
          </select>
          {/* Payment type toggle buttons */}
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {([
              { v: "" as const, label: "All" },
              { v: "cash" as const, label: "💵 Cash" },
              { v: "card" as const, label: "💳 Card" },
              { v: "credit" as const, label: "📄 Credit" },
            ]).map(opt => (
              <button
                key={opt.v}
                onClick={() => setPaymentFilter(opt.v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${paymentFilter === opt.v ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-800"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* VAT Summary Bar */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="bg-slate-50 border rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-slate-500 mb-0.5">Taxable Net</p>
            <p className="font-bold text-slate-800 text-sm">{formatSAR(totalTaxableNet)}</p>
            <p className="text-[10px] text-slate-400">{taxable.length} tax items</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-slate-500 mb-0.5">Input VAT (Reclaimable)</p>
            <p className="font-bold text-emerald-700 text-sm">{formatSAR(totalInputVat)}</p>
            <p className="text-[10px] text-slate-400">from {taxable.length} tax invoices</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-slate-500 mb-0.5">Non-Taxable Total</p>
            <p className="font-bold text-amber-700 text-sm">{formatSAR(totalNonTaxable)}</p>
            <p className="text-[10px] text-slate-400">{nonTaxable.length} non-tax items</p>
          </div>
          <div className="bg-slate-100 border rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-slate-500 mb-0.5">Taxable Total (incl. VAT)</p>
            <p className="font-bold text-slate-800 text-sm">{formatSAR(totalTaxableGross)}</p>
            <p className="text-[10px] text-slate-400">gross amount</p>
          </div>
        </div>
      )}

      {/* Internal Transfer Cost Adjustments */}
      {(transfersInCost > 0 || transfersOutCost > 0) && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700">Internal Transfer Cost Adjustments</span>
            <span className="text-[10px] text-blue-500 bg-blue-100 rounded-full px-2 py-0.5">Affects P&amp;L · Manual Price Only</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {transfersInCost > 0 && (
              <div className="bg-white border border-blue-200 rounded-lg px-4 py-3">
                <p className="text-xs text-slate-500 mb-0.5">Received from Other Branches</p>
                <p className="font-bold text-blue-700 text-sm">+{formatSAR(transfersInCost)}</p>
                <p className="text-[10px] text-slate-400">{transfersIn.length} transfer{transfersIn.length !== 1 ? "s" : ""} · Added to COGS</p>
              </div>
            )}
            {transfersOutCost > 0 && (
              <div className="bg-white border border-rose-200 rounded-lg px-4 py-3">
                <p className="text-xs text-slate-500 mb-0.5">Sent to Other Branches</p>
                <p className="font-bold text-rose-600 text-sm">−{formatSAR(transfersOutCost)}</p>
                <p className="text-[10px] text-slate-400">{transfersOut.length} transfer{transfersOut.length !== 1 ? "s" : ""} · Deducted from COGS</p>
              </div>
            )}
            <div className={`rounded-lg px-4 py-3 ${netTransferCost >= 0 ? "bg-blue-700" : "bg-slate-700"}`}>
              <p className="text-xs text-blue-100 mb-0.5">Net Transfer Impact</p>
              <p className="font-bold text-white text-sm">{netTransferCost >= 0 ? "+" : ""}{formatSAR(netTransferCost)}</p>
              <p className="text-[10px] text-blue-200">Effective Purchases: {formatSAR(grandTotal + netTransferCost)}</p>
            </div>
          </div>
          <p className="text-[10px] text-blue-600 mt-2">
            ⓘ These transfers use manually entered prices. They adjust Cost of Sales (COGS) in both the source and destination branch P&amp;L.{month ? "" : " Showing all-time transfers — select a month to filter."}
          </p>
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
                    {hasActiveFilters ? "No records match your filters" : "No purchases found. Click \"Add Invoice\" to get started."}
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
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 whitespace-nowrap">🏷️ No VAT</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 whitespace-nowrap">🧾 Tax</span>
                        )}
                        {p.invoiceId && (
                          <span className="block text-[9px] text-slate-400 mt-0.5 font-mono" title={p.invoiceId}>
                            #{p.invoiceId.slice(0, 8)}…
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
                        {isNonTax ? <span className="text-slate-400 text-xs">—</span> : <span className="text-emerald-600">{formatSAR(p.vatAmount)}</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-bold">{formatSAR(p.totalAmount)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => openEdit(p)} className="text-primary p-1.5 hover:bg-primary/10 rounded-lg" title="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => remove.mutate({ id: p.id })} className="text-rose-500 p-1.5 hover:bg-rose-50 rounded-lg" title="Delete">
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
                  <td colSpan={8} className="px-4 py-3 text-right text-slate-500">{filtered.length} records</td>
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

      {/* Add Multi-Item Invoice Modal */}
      <PurchaseInvoiceModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={handleBatchSave}
        isPending={batchCreate.isPending}
      />

      {/* Edit Single Item Modal */}
      {editRecord && (
        <PurchaseEditModal
          open={!!editRecord}
          defaultValues={editRecord.data}
          onClose={() => setEditRecord(null)}
          onSubmit={handleEdit}
          isPending={update.isPending}
        />
      )}
    </div>
  );
}
