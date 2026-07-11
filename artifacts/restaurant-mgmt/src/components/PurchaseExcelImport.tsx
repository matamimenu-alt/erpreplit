import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useCreatePurchaseBatch } from "@workspace/api-client-react";
import { PURCHASE_CATEGORIES } from "@/lib/categories";
import { formatSAR } from "@/lib/format";
import {
  parseSheet, norm, type ParseResult, type MappedRow, type RowStatus, type Canonical,
} from "@/lib/purchase-excel-import";
import {
  FileSpreadsheet, Upload, X, Check, AlertTriangle, Loader2, Info, ChevronDown,
} from "lucide-react";

const MAP_KEY = "purchaseImport.categoryMap.v1";
type Phase = "upload" | "preview" | "importing" | "done";

function loadOverrides(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(MAP_KEY) || "{}"); } catch { return {}; }
}
function saveOverride(rawNorm: string, slug: string) {
  const m = loadOverrides();
  m[rawNorm] = slug;
  localStorage.setItem(MAP_KEY, JSON.stringify(m));
}

const FIELD_LABEL: Record<Canonical, string> = {
  date: "Date", supplierName: "Supplier", productName: "Product", category: "Category",
  unit: "Unit", quantity: "Qty", price: "Unit price", priceIncludesVat: "Incl. VAT",
  invoiceType: "Invoice type", paymentType: "Payment", invoiceId: "Invoice ID",
  netAmount: "Net amount", vat: "VAT", total: "Total", notes: "Notes",
};

const STATUS_STYLE: Record<RowStatus, string> = {
  valid: "bg-emerald-50", review: "bg-amber-50", warning: "bg-yellow-50", error: "bg-red-50",
};

export function PurchaseExcelImport({
  open, onClose, onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("upload");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [rows, setRows] = useState<MappedRow[]>([]);
  const [filter, setFilter] = useState<RowStatus | "all">("all");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ imported: number; skipped: number; invoices: number }>({ imported: 0, skipped: 0, invoices: 0 });
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const createBatch = useCreatePurchaseBatch();

  function reset() {
    setPhase("upload"); setFileName(""); setParsed(null); setRows([]);
    setFilter("all"); setProgress(0); setError("");
    if (fileRef.current) fileRef.current.value = "";
  }
  function close() { reset(); onClose(); }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError("");
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) { setError("لا توجد ورقة بيانات / no sheet found"); return; }
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: true });
      const res = parseSheet(aoa, loadOverrides());
      if (res.rows.length === 0) { setError("لا توجد صفوف / no data rows"); return; }
      setParsed(res);
      setRows(res.rows);
      setPhase("preview");
    } catch {
      setError("تعذّرت قراءة الملف — تأكد أنه Excel/CSV صالح / could not read the file");
    }
  }

  const counts = useMemo(() => {
    const c: Record<RowStatus, number> = { valid: 0, review: 0, warning: 0, error: 0 };
    rows.forEach((r) => c[r.status]++);
    return c;
  }, [rows]);

  // Re-classify a row after an inline category edit; remember the mapping so
  // every other row with the same raw category (and future imports) auto-apply.
  function setRowCategory(i: number, slug: string) {
    const target = rows[i];
    if (target.categoryRaw) saveOverride(norm(target.categoryRaw), slug);
    setRows((rs) =>
      rs.map((r) => {
        if (r.categoryRaw && target.categoryRaw && norm(r.categoryRaw) === norm(target.categoryRaw)) {
          const status: RowStatus =
            !r.date || !r.productName || r.quantity <= 0 ? "error" : r.issues.filter((x) => !x.includes("unknown category")).length ? "warning" : "valid";
          return { ...r, category: slug, categoryMethod: "exact", status, issues: r.issues.filter((x) => !x.includes("unknown category")) };
        }
        return r;
      }),
    );
  }

  const visible = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  async function doImport() {
    setPhase("importing");
    setProgress(0);
    // Importable = has a category slug and no hard error. Group by invoice key.
    const ok = rows.filter((r) => r.category && r.status !== "error");
    const skipped = rows.length - ok.length;
    const groups = new Map<string, MappedRow[]>();
    for (const r of ok) {
      const key = [r.date, r.supplierName, r.invoiceType, r.paymentType, r.priceIncludesVat, r.invoiceId].join("|");
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
    }
    let imported = 0;
    let done = 0;
    for (const [, g] of groups) {
      try {
        await createBatch.mutateAsync({
          data: {
            date: g[0].date,
            supplierName: g[0].supplierName || "",
            invoiceType: g[0].invoiceType,
            priceIncludesVat: g[0].priceIncludesVat,
            paymentType: g[0].paymentType,
            invoiceId: g[0].invoiceId || undefined,
            notes: g[0].notes || undefined,
            items: g.map((r) => ({
              productName: r.productName,
              category: r.category as never,
              unit: r.unit || "unit",
              quantity: r.quantity,
              price: r.price,
              notes: r.notes || undefined,
            })),
          },
        });
        imported += g.length;
      } catch {
        /* keep going — never fail the whole import for one invoice */
      }
      done++;
      setProgress(Math.round((done / groups.size) * 100));
    }
    setResult({ imported, skipped, invoices: groups.size });
    setPhase("done");
    if (imported > 0) onDone?.();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-stretch md:items-center justify-center md:p-4">
      <div className="bg-white w-full md:max-w-6xl md:rounded-2xl shadow-xl flex flex-col max-h-screen md:max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold">استيراد مشتريات من Excel / Import Purchases from Excel</h2>
            {parsed && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {parsed.template === "old-erp" ? "Old ERP export" : parsed.template === "current" ? "Current template" : "Auto-mapped"}
              </span>
            )}
          </div>
          <button onClick={close} className="p-2 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {phase === "upload" && (
            <div className="p-8 flex flex-col items-center justify-center gap-4 flex-1 text-center">
              <p className="text-sm text-slate-600 max-w-lg">
                ارفع أي ملف مشتريات Excel/CSV — القالب الحالي أو تصدير النظام القديم. يتم الكشف التلقائي عن الصيغة ومطابقة التصنيفات والموردين تلقائياً. لا حاجة لتعديل الملف.
                <br />
                Upload any purchases Excel/CSV — current template or old-ERP export. The format, columns, and categories are matched automatically. No need to edit the file.
              </p>
              <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-5 py-3 bg-primary text-white rounded-xl hover:-translate-y-0.5 transition-all">
                <Upload className="w-4 h-4" /> رفع ملف / Upload file
              </button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="hidden" />
              {error && <p className="text-sm text-red-600 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> {error}</p>}
            </div>
          )}

          {phase === "preview" && parsed && (
            <>
              {/* Column mapping summary */}
              <div className="px-4 py-2 border-b bg-slate-50 text-xs text-slate-600 flex items-center gap-2 flex-wrap shrink-0">
                <Info className="w-3.5 h-3.5" />
                <span className="font-semibold">الأعمدة المكتشفة / Detected columns:</span>
                {parsed.detectedFields.map((f) => (
                  <span key={f} className="px-1.5 py-0.5 rounded bg-white border">{FIELD_LABEL[f]}</span>
                ))}
              </div>
              {/* Status filter tabs */}
              <div className="px-4 py-2 border-b flex gap-2 flex-wrap shrink-0 text-xs">
                {([
                  ["all", `الكل / All ${rows.length}`, "bg-slate-200 text-slate-700"],
                  ["valid", `صالح / Valid ${counts.valid}`, "bg-emerald-100 text-emerald-700"],
                  ["review", `يحتاج مراجعة / Review ${counts.review}`, "bg-amber-100 text-amber-700"],
                  ["warning", `تحذيرات / Warnings ${counts.warning}`, "bg-yellow-100 text-yellow-700"],
                  ["error", `أخطاء / Errors ${counts.error}`, "bg-red-100 text-red-700"],
                ] as const).map(([k, lbl, cls]) => (
                  <button key={k} onClick={() => setFilter(k)} className={`px-2.5 py-1 rounded-full font-semibold ${filter === k ? "ring-2 ring-primary " : ""}${cls}`}>
                    {lbl}
                  </button>
                ))}
              </div>
              {/* Rows */}
              <div className="flex-1 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr className="text-left text-slate-500">
                      <th className="px-2 py-2">#</th>
                      <th className="px-2 py-2">Date</th>
                      <th className="px-2 py-2">Supplier</th>
                      <th className="px-2 py-2">Product</th>
                      <th className="px-2 py-2">Category</th>
                      <th className="px-2 py-2">Qty</th>
                      <th className="px-2 py-2">Price</th>
                      <th className="px-2 py-2">VAT</th>
                      <th className="px-2 py-2">Total</th>
                      <th className="px-2 py-2">Type</th>
                      <th className="px-2 py-2">Pay</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {visible.slice(0, 600).map((r) => {
                      const gi = rows.indexOf(r);
                      return (
                        <tr key={r.index} className={STATUS_STYLE[r.status]}>
                          <td className="px-2 py-1.5 text-slate-400">{r.index}</td>
                          <td className="px-2 py-1.5">{r.date || <span className="text-red-500">—</span>}</td>
                          <td className="px-2 py-1.5 max-w-[110px] truncate" title={r.supplierName}>{r.supplierName}</td>
                          <td className="px-2 py-1.5 max-w-[130px] truncate" title={r.productName}>{r.productName || <span className="text-red-500">—</span>}</td>
                          <td className="px-2 py-1.5">
                            {r.category ? (
                              <span title={`${r.categoryRaw} → ${r.category}`} className="inline-flex items-center gap-1">
                                {r.category}
                                {r.categoryMethod === "fuzzy" && <span className="text-[9px] text-amber-600">~</span>}
                              </span>
                            ) : (
                              <select
                                value=""
                                onChange={(e) => e.target.value && setRowCategory(gi, e.target.value)}
                                className="border rounded px-1 py-0.5 text-[11px] bg-red-50 border-red-300"
                              >
                                <option value="">اختر / map "{r.categoryRaw}"…</option>
                                {PURCHASE_CATEGORIES.map((c) => (
                                  <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="px-2 py-1.5">{r.quantity}</td>
                          <td className="px-2 py-1.5">{r.price}</td>
                          <td className="px-2 py-1.5">{r.computedVat}</td>
                          <td className="px-2 py-1.5 font-medium">{r.computedTotal}</td>
                          <td className="px-2 py-1.5">{r.invoiceType}</td>
                          <td className="px-2 py-1.5">{r.paymentType}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {visible.length > 600 && (
                  <p className="text-center text-xs text-slate-400 py-2">
                    عرض أول 600 من {visible.length} / showing first 600 of {visible.length} (all will be imported)
                  </p>
                )}
              </div>
            </>
          )}

          {phase === "importing" && (
            <div className="p-12 flex flex-col items-center justify-center gap-3 flex-1">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-slate-600">جارٍ الاستيراد / Importing… {progress}%</p>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden w-64">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {phase === "done" && (
            <div className="p-12 flex flex-col items-center justify-center gap-3 flex-1 text-center">
              <Check className="w-10 h-10 text-emerald-600" />
              <p className="text-lg font-bold">تم الاستيراد / Import complete</p>
              <p className="text-sm text-slate-600">
                {result.imported} سطر في {result.invoices} فاتورة / {result.imported} lines across {result.invoices} invoices
                {result.skipped > 0 && <> · {result.skipped} skipped</>}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {phase === "preview" && (
          <div className="flex items-center justify-between gap-2 p-4 border-t bg-slate-50 shrink-0">
            <p className="text-xs text-slate-500">
              سيتم استيراد {counts.valid + counts.warning}
              {counts.review > 0 && <> · {counts.review} بحاجة تصنيف</>}
              {counts.error > 0 && <> · {counts.error} خطأ (تُتجاهل)</>}
            </p>
            <div className="flex gap-2">
              <button onClick={reset} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl text-sm">ملف آخر / Another</button>
              <button
                onClick={doImport}
                disabled={counts.valid + counts.warning === 0}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 text-sm"
              >
                <Check className="w-4 h-4" /> استيراد / Import ({counts.valid + counts.warning + counts.review})
              </button>
            </div>
          </div>
        )}
        {phase === "done" && (
          <div className="flex justify-end p-4 border-t bg-slate-50 shrink-0">
            <button onClick={close} className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm">تم / Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
