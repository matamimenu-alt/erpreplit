import { useEffect, useMemo, useRef, useState } from "react";
import {
  useExtractAiInvoice,
  useGetAiInvoiceSettings,
  useUpdateAiInvoiceSettings,
  useCreatePurchaseBatch,
  useCreateSupplier,
} from "@workspace/api-client-react";
import type {
  AiInvoiceExtractResponse,
  AiInvoiceSettings,
  PurchaseCategory,
} from "@workspace/api-client-react";
import { prepareInvoiceFile, type PreparedFile } from "@/lib/image-compress";
import { PURCHASE_CATEGORIES } from "@/lib/categories";
import { formatSAR } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import {
  Sparkles, Upload, Camera, X, ZoomIn, ZoomOut, RotateCw, Loader2,
  Check, AlertTriangle, Settings2, FileText,
} from "lucide-react";

type Phase = "upload" | "extracting" | "review" | "saving" | "done";
const num = (v: number | null | undefined) => (typeof v === "number" && isFinite(v) ? v : 0);
const DEFAULT_CATEGORY = (PURCHASE_CATEGORIES[0]?.value ?? "others-misc") as PurchaseCategory;

type Row = {
  name: string;
  category: PurchaseCategory;
  unit: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  vat: number;
  lineTotal: number;
  productExists: boolean;
  nameConfidence: number;
};

type Header = {
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  currency: string;
  vatNumber: string;
  subtotal: number;
  vat: number;
  discount: number;
  grandTotal: number;
  paymentMethod: string;
  invoiceType: "tax" | "non-tax";
  priceIncludesVat: boolean;
};

function mapPayment(raw: string): "cash" | "card" | "credit" {
  const s = (raw || "").toLowerCase();
  if (/credit|آجل|اجل|ذمم/.test(s)) return "credit";
  if (/card|شبكة|شبكه|visa|mada|مدى/.test(s)) return "card";
  return "cash";
}

/** Confidence chip — highlighted red when below the review threshold. */
function Conf({ v, threshold }: { v: number; threshold: number }) {
  const low = v < threshold;
  return (
    <span
      title={low ? "Low confidence — please verify" : "Confidence"}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
        low ? "bg-red-100 text-red-700 ring-1 ring-red-300" : "bg-emerald-100 text-emerald-700"
      }`}
    >
      {low && <AlertTriangle className="w-2.5 h-2.5" />}
      {v}%
    </span>
  );
}

export function AiInvoiceImport({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("upload");
  const [prepared, setPrepared] = useState<PreparedFile | null>(null);
  const [result, setResult] = useState<AiInvoiceExtractResponse | null>(null);
  const [header, setHeader] = useState<Header | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [zoom, setZoom] = useState(1);
  const [rotate, setRotate] = useState(0);
  const [error, setError] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const { data: settings } = useGetAiInvoiceSettings<AiInvoiceSettings>();
  const threshold = settings?.confidenceThreshold ?? 85;

  const extract = useExtractAiInvoice();
  const createBatch = useCreatePurchaseBatch();
  const createSupplier = useCreateSupplier();

  function reset() {
    setPhase("upload");
    setPrepared(null);
    setResult(null);
    setHeader(null);
    setRows([]);
    setZoom(1);
    setRotate(0);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  }
  function close() {
    reset();
    onClose();
  }

  // Build editable state once extraction returns.
  useEffect(() => {
    if (!result) return;
    const e = result.extraction;
    setHeader({
      supplierName: e.supplierName.value ?? "",
      invoiceNumber: e.invoiceNumber.value ?? "",
      invoiceDate: /^\d{4}-\d{2}-\d{2}$/.test(e.invoiceDate.value ?? "")
        ? (e.invoiceDate.value as string)
        : new Date().toISOString().slice(0, 10),
      currency: e.currency.value ?? "SAR",
      vatNumber: e.vatNumber.value ?? "",
      subtotal: num(e.subtotal.value),
      vat: num(e.vat.value),
      discount: num(e.discount.value),
      grandTotal: num(e.grandTotal.value),
      paymentMethod: e.paymentMethod.value ?? "cash",
      invoiceType: "tax",
      priceIncludesVat: false,
    });
    setRows(
      e.items.map((it) => {
        const matchedCat = it.match.category as PurchaseCategory | null;
        const inList = PURCHASE_CATEGORIES.some((c) => c.value === matchedCat);
        return {
          name: it.name.value ?? "",
          category: inList && matchedCat ? matchedCat : DEFAULT_CATEGORY,
          unit: it.match.unit ?? it.unit.value ?? "unit",
          quantity: num(it.quantity.value),
          unitPrice: num(it.unitPrice.value),
          discount: num(it.discount.value),
          vat: num(it.vat.value),
          lineTotal: num(it.lineTotal.value),
          productExists: it.match.exists,
          nameConfidence: it.name.confidence,
        };
      }),
    );
    setPhase("review");
  }, [result]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setPhase("extracting");
    try {
      const p = await prepareInvoiceFile(file);
      setPrepared(p);
      const res = await extract.mutateAsync({ data: { fileBase64: p.base64, mimeType: p.mimeType } });
      setResult(res as AiInvoiceExtractResponse);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Extraction failed. Please try another photo or PDF.",
      );
      setPhase("upload");
    }
  }

  function setH<K extends keyof Header>(k: K, v: Header[K]) {
    setHeader((h) => (h ? { ...h, [k]: v } : h));
  }
  function setRow(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function save() {
    if (!header) return;
    const items = rows
      .filter((r) => r.name.trim() && r.quantity > 0)
      .map((r) => ({
        productName: r.name.trim(),
        category: r.category,
        unit: r.unit || "unit",
        quantity: r.quantity,
        price: r.unitPrice,
      }));
    if (items.length === 0) {
      toast({ title: "No valid line items to save", variant: "destructive" });
      return;
    }
    setPhase("saving");
    try {
      // Best-effort: register a new supplier in the directory.
      if (header.supplierName && settings?.autoCreateSupplier && !result?.supplierMatch.exists) {
        await createSupplier.mutateAsync({ data: { name: header.supplierName } }).catch(() => {});
      }
      await createBatch.mutateAsync({
        data: {
          date: header.invoiceDate,
          supplierName: header.supplierName || "",
          invoiceType: header.invoiceType,
          priceIncludesVat: header.priceIncludesVat,
          paymentType: mapPayment(header.paymentMethod),
          notes: `Imported via AI${header.invoiceNumber ? ` · Invoice ${header.invoiceNumber}` : ""}`,
          items,
        },
      });
      setPhase("done");
      toast({ title: `تم استيراد الفاتورة / Invoice imported (${items.length} items)` });
      onSaved?.();
    } catch (err) {
      setPhase("review");
      toast({
        title: err instanceof Error ? err.message : "Failed to save invoice",
        variant: "destructive",
      });
    }
  }

  const warnings = result?.validation.warnings ?? [];
  const supplierExists = result?.supplierMatch.exists ?? false;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-stretch md:items-center justify-center md:p-4">
      <div className="bg-white w-full md:max-w-6xl md:rounded-2xl shadow-xl flex flex-col max-h-screen md:max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">استيراد فاتورة بالذكاء الاصطناعي / AI Invoice Import</h2>
            {result && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                {result.provider}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowSettings((s) => !s)} className="p-2 hover:bg-slate-100 rounded-xl" title="Settings">
              <Settings2 className="w-5 h-5" />
            </button>
            <button onClick={close} className="p-2 hover:bg-slate-100 rounded-xl">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {showSettings && <SettingsPanel />}

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          {phase === "upload" && (
            <div className="p-8 flex flex-col items-center justify-center gap-4 h-full text-center">
              <p className="text-sm text-slate-600 max-w-md">
                ارفع صورة أو PDF للفاتورة، أو التقط صورة بالكاميرا. يدعم العربية والإنجليزية.
                <br />
                Upload a photo/PDF of the invoice, or take a picture. Arabic &amp; English supported.
              </p>
              <div className="flex gap-3 flex-wrap justify-center">
                <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-5 py-3 bg-primary text-white rounded-xl hover:-translate-y-0.5 transition-all">
                  <Upload className="w-4 h-4" /> رفع ملف / Upload file
                </button>
                <button onClick={() => cameraRef.current?.click()} className="flex items-center gap-2 px-5 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200">
                  <Camera className="w-4 h-4" /> كاميرا / Camera
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={onFile} className="hidden" />
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
              {error && (
                <p className="text-sm text-red-600 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> {error}
                </p>
              )}
            </div>
          )}

          {phase === "extracting" && (
            <div className="p-12 flex flex-col items-center justify-center gap-3 h-full">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-slate-600">جارٍ قراءة الفاتورة / Reading the invoice…</p>
            </div>
          )}

          {(phase === "review" || phase === "saving" || phase === "done") && header && (
            <div className="grid md:grid-cols-2 h-full overflow-hidden">
              {/* Preview */}
              <div className="bg-slate-900 relative overflow-auto hidden md:block">
                <div className="sticky top-0 z-10 flex gap-1 p-2 bg-slate-800/80">
                  <button onClick={() => setZoom((z) => Math.min(4, z + 0.25))} className="p-1.5 bg-slate-700 text-white rounded-lg" title="Zoom in"><ZoomIn className="w-4 h-4" /></button>
                  <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="p-1.5 bg-slate-700 text-white rounded-lg" title="Zoom out"><ZoomOut className="w-4 h-4" /></button>
                  <button onClick={() => setRotate((r) => (r + 90) % 360)} className="p-1.5 bg-slate-700 text-white rounded-lg" title="Rotate"><RotateCw className="w-4 h-4" /></button>
                </div>
                <div className="p-4 min-h-full flex items-start justify-center">
                  {prepared?.mimeType === "application/pdf" ? (
                    <iframe title="invoice" src={prepared.dataUrl} className="w-full h-[70vh] bg-white rounded" />
                  ) : prepared ? (
                    <img
                      src={prepared.dataUrl}
                      alt="invoice"
                      style={{ transform: `scale(${zoom}) rotate(${rotate}deg)`, transformOrigin: "top center" }}
                      className="max-w-full transition-transform"
                    />
                  ) : (
                    <FileText className="w-16 h-16 text-slate-600" />
                  )}
                </div>
              </div>

              {/* Extracted data — editable */}
              <div className="overflow-y-auto p-4 space-y-4">
                {warnings.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-1">
                    <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> تحقق من الأرقام / Check these numbers
                    </p>
                    {warnings.map((w, i) => (
                      <p key={i} className="text-xs text-amber-700">• {w.message}</p>
                    ))}
                  </div>
                )}

                {/* Supplier */}
                <Field label="المورد / Supplier" conf={result?.extraction.supplierName.confidence} threshold={threshold}>
                  <div className="flex items-center gap-2">
                    <input value={header.supplierName} onChange={(e) => setH("supplierName", e.target.value)} className="flex-1 px-3 py-2 border rounded-xl text-sm outline-none focus:border-primary" />
                    <span className={`text-[10px] px-2 py-1 rounded-full whitespace-nowrap ${supplierExists ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {supplierExists ? "موجود / Existing" : "جديد / New"}
                    </span>
                  </div>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="رقم الفاتورة / Invoice #" conf={result?.extraction.invoiceNumber.confidence} threshold={threshold}>
                    <input value={header.invoiceNumber} onChange={(e) => setH("invoiceNumber", e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-primary" />
                  </Field>
                  <Field label="التاريخ / Date" conf={result?.extraction.invoiceDate.confidence} threshold={threshold}>
                    <input type="date" value={header.invoiceDate} onChange={(e) => setH("invoiceDate", e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-primary" />
                  </Field>
                  <Field label="الرقم الضريبي / VAT No." conf={result?.extraction.vatNumber.confidence} threshold={threshold}>
                    <input value={header.vatNumber} onChange={(e) => setH("vatNumber", e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-primary" />
                  </Field>
                  <Field label="طريقة الدفع / Payment" conf={result?.extraction.paymentMethod.confidence} threshold={threshold}>
                    <input value={header.paymentMethod} onChange={(e) => setH("paymentMethod", e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-primary" />
                  </Field>
                </div>

                {/* VAT treatment (drives how the purchase computes VAT) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">نوع الفاتورة / Invoice type</label>
                    <select value={header.invoiceType} onChange={(e) => setH("invoiceType", e.target.value as Header["invoiceType"])} className="w-full px-3 py-2 border rounded-xl text-sm outline-none">
                      <option value="tax">ضريبية / Tax</option>
                      <option value="non-tax">غير ضريبية / Non-tax</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 mt-6 text-sm">
                    <input type="checkbox" checked={header.priceIncludesVat} onChange={(e) => setH("priceIncludesVat", e.target.checked)} />
                    السعر شامل الضريبة / Price incl. VAT
                  </label>
                </div>

                {/* Items */}
                <div>
                  <p className="text-sm font-semibold mb-2">الأصناف / Items ({rows.length})</p>
                  <div className="space-y-2">
                    {rows.map((r, i) => (
                      <div key={i} className="border rounded-xl p-2.5 space-y-2 bg-slate-50/50">
                        <div className="flex items-center gap-2">
                          <input value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} placeholder="اسم الصنف / Product" className="flex-1 px-2 py-1.5 border rounded-lg text-sm outline-none focus:border-primary" />
                          <Conf v={r.nameConfidence} threshold={threshold} />
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap ${r.productExists ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {r.productExists ? "موجود" : "جديد"}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <select value={r.category} onChange={(e) => setRow(i, { category: e.target.value as PurchaseCategory })} className="px-2 py-1.5 border rounded-lg text-xs outline-none col-span-2">
                            {PURCHASE_CATEGORIES.map((c) => (
                              <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                          </select>
                          <input value={r.unit} onChange={(e) => setRow(i, { unit: e.target.value })} placeholder="unit" className="px-2 py-1.5 border rounded-lg text-xs outline-none" />
                          <NumIn v={r.quantity} onChange={(v) => setRow(i, { quantity: v })} ph="Qty" />
                          <NumIn v={r.unitPrice} onChange={(v) => setRow(i, { unitPrice: v })} ph="Price" />
                          <NumIn v={r.discount} onChange={(v) => setRow(i, { discount: v })} ph="Disc" />
                          <NumIn v={r.vat} onChange={(v) => setRow(i, { vat: v })} ph="VAT" />
                          <NumIn v={r.lineTotal} onChange={(v) => setRow(i, { lineTotal: v })} ph="Total" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals */}
                <div className="grid grid-cols-2 gap-3 border-t pt-3">
                  <Field label="الإجمالي قبل الضريبة / Subtotal" conf={result?.extraction.subtotal.confidence} threshold={threshold}>
                    <NumIn v={header.subtotal} onChange={(v) => setH("subtotal", v)} ph="0.00" />
                  </Field>
                  <Field label="الضريبة / VAT" conf={result?.extraction.vat.confidence} threshold={threshold}>
                    <NumIn v={header.vat} onChange={(v) => setH("vat", v)} ph="0.00" />
                  </Field>
                  <Field label="الخصم / Discount" conf={result?.extraction.discount.confidence} threshold={threshold}>
                    <NumIn v={header.discount} onChange={(v) => setH("discount", v)} ph="0.00" />
                  </Field>
                  <Field label="الإجمالي / Grand total" conf={result?.extraction.grandTotal.confidence} threshold={threshold}>
                    <NumIn v={header.grandTotal} onChange={(v) => setH("grandTotal", v)} ph="0.00" />
                  </Field>
                </div>
                <p className="text-xs text-slate-400 text-right">{formatSAR(header.grandTotal)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {(phase === "review" || phase === "saving") && (
          <div className="flex justify-end gap-2 p-4 border-t bg-slate-50 shrink-0">
            <button onClick={close} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl text-sm">إلغاء / Cancel</button>
            <button onClick={save} disabled={phase === "saving"} className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 text-sm">
              {phase === "saving" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              حفظ الفاتورة / Save invoice
            </button>
          </div>
        )}
        {phase === "done" && (
          <div className="flex justify-end gap-2 p-4 border-t bg-slate-50 shrink-0">
            <button onClick={close} className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm">تم / Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, conf, threshold, children }: { label: string; conf?: number; threshold: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-slate-500">{label}</label>
        {conf !== undefined && <Conf v={conf} threshold={threshold} />}
      </div>
      {children}
    </div>
  );
}

function NumIn({ v, onChange, ph }: { v: number; onChange: (n: number) => void; ph?: string }) {
  return (
    <input
      type="number"
      step="0.01"
      value={Number.isFinite(v) ? v : 0}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      placeholder={ph}
      className="w-full px-2 py-1.5 border rounded-lg text-xs outline-none focus:border-primary"
    />
  );
}

/** Inline settings for enabling/disabling AI and tuning the confidence bar. */
function SettingsPanel() {
  const { data } = useGetAiInvoiceSettings<AiInvoiceSettings>();
  const update = useUpdateAiInvoiceSettings();
  const [local, setLocal] = useState<AiInvoiceSettings | null>(null);
  useEffect(() => { if (data) setLocal(data); }, [data]);
  if (!local) return null;
  const set = (patch: Partial<AiInvoiceSettings>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    update.mutate({ data: next });
  };
  return (
    <div className="border-b bg-slate-50 p-4 grid md:grid-cols-4 gap-3 text-sm">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={local.ocrEnabled} onChange={(e) => set({ ocrEnabled: e.target.checked })} />
        تفعيل الذكاء / AI OCR
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={local.autoCreateSupplier} onChange={(e) => set({ autoCreateSupplier: e.target.checked })} />
        إنشاء مورّد تلقائي
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={local.autoCreateProduct} onChange={(e) => set({ autoCreateProduct: e.target.checked })} />
        إنشاء صنف تلقائي
      </label>
      <label className="flex items-center gap-2">
        حد الثقة / Threshold
        <input type="number" min={0} max={100} value={local.confidenceThreshold} onChange={(e) => set({ confidenceThreshold: parseInt(e.target.value, 10) || 85 })} className="w-16 px-2 py-1 border rounded-lg" />
      </label>
    </div>
  );
}
