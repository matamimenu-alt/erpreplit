import { useRef, useState } from "react";
import { Upload, Download, X, Check, AlertTriangle, FileSpreadsheet, Loader2 } from "lucide-react";
import { parseSpreadsheet, downloadTemplate, type ParsedRow, type TemplateColumn } from "@/lib/import-file";

/**
 * Describes how to import one module's rows. Generic over the create payload `T`.
 * `parseRow` maps a raw spreadsheet row to either a validated payload or an error.
 */
export type ImportSpec<T> = {
  /** Dialog title (Arabic primary). */
  title: string;
  /** Header columns for the downloadable template + expected file headers. */
  templateColumns: TemplateColumn[];
  /** Template file name (without extension). */
  templateName: string;
  /** Validate + map a raw row. Return `{ value }` when valid or `{ error }` when not. */
  parseRow: (row: ParsedRow, index: number) => { value?: T; error?: string };
  /** Short human summary of a valid row, shown in the preview table. */
  summarize: (value: T) => string;
  /** Persist one validated row (usually a create mutation's mutateAsync). */
  submit: (value: T) => Promise<unknown>;
};

type Preview<T> = {
  index: number;
  raw: ParsedRow;
  value?: T;
  error?: string;
};

type Phase = "idle" | "preview" | "importing" | "done";

export function ImportButton<T>({
  spec,
  onDone,
  label = "استيراد / Import",
  className,
}: {
  spec: ImportSpec<T>;
  onDone?: () => void;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Preview<T>[]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ ok: number; failed: { index: number; error: string }[] }>({ ok: 0, failed: [] });
  const [parseError, setParseError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const validRows = rows.filter((r) => r.value !== undefined && !r.error);
  const invalidRows = rows.filter((r) => r.error);

  function reset() {
    setPhase("idle");
    setFileName("");
    setRows([]);
    setProgress(0);
    setResult({ ok: 0, failed: [] });
    setParseError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function close() {
    setOpen(false);
    reset();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError("");
    try {
      const parsed = await parseSpreadsheet(file);
      if (parsed.length === 0) {
        setParseError("الملف فارغ أو لا يحتوي صفوفاً. / File is empty or has no rows.");
        return;
      }
      const mapped = parsed.map((raw, i) => {
        const res = spec.parseRow(raw, i);
        return { index: i, raw, value: res.value, error: res.error };
      });
      setRows(mapped);
      setPhase("preview");
    } catch (err) {
      setParseError(
        "تعذّرت قراءة الملف. تأكد أنه Excel أو CSV صحيح. / Could not read the file — make sure it is a valid Excel or CSV.",
      );
    }
  }

  async function confirmImport() {
    setPhase("importing");
    setProgress(0);
    let ok = 0;
    const failed: { index: number; error: string }[] = [];
    for (let i = 0; i < validRows.length; i++) {
      const r = validRows[i];
      try {
        await spec.submit(r.value as T);
        ok++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "فشل الحفظ / save failed";
        failed.push({ index: r.index, error: msg });
      }
      setProgress(i + 1);
    }
    setResult({ ok, failed });
    setPhase("done");
    if (ok > 0) onDone?.();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          className ??
          "flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-xl hover:bg-sky-700 text-sm"
        }
      >
        <Upload className="w-4 h-4" /> {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-sky-600" />
                <h2 className="text-lg font-bold">{spec.title}</h2>
              </div>
              <button onClick={close} className="p-2 hover:bg-slate-100 rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto">
              {/* Idle: pick file */}
              {phase === "idle" && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">
                    ارفع ملف Excel (.xlsx) أو CSV. حمّل القالب لمعرفة الأعمدة المطلوبة.
                    <br />
                    Upload an Excel (.xlsx) or CSV file. Download the template to see the required columns.
                  </p>
                  <button
                    onClick={() => downloadTemplate(spec.templateColumns, spec.templateName)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 text-sm"
                  >
                    <Download className="w-4 h-4" /> تنزيل القالب / Download template
                  </button>
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={onFile}
                      className="block mx-auto text-sm"
                    />
                    {fileName && <p className="text-xs text-slate-500 mt-2">{fileName}</p>}
                  </div>
                  {parseError && (
                    <p className="text-sm text-red-600 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" /> {parseError}
                    </p>
                  )}
                </div>
              )}

              {/* Preview */}
              {phase === "preview" && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-3 text-sm">
                    <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700">
                      صالح / Valid: {validRows.length}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-red-100 text-red-700">
                      خطأ / Invalid: {invalidRows.length}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600">
                      إجمالي / Total: {rows.length}
                    </span>
                  </div>
                  <div className="border rounded-xl overflow-auto max-h-[45vh]">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-slate-500">#</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-500">الحالة / Status</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-500">السطر / Row</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {rows.map((r) => (
                          <tr key={r.index} className={r.error ? "bg-red-50" : ""}>
                            <td className="px-3 py-2 text-slate-400">{r.index + 2}</td>
                            <td className="px-3 py-2">
                              {r.error ? (
                                <span className="inline-flex items-center gap-1 text-red-600">
                                  <AlertTriangle className="w-3.5 h-3.5" /> {r.error}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-emerald-600">
                                  <Check className="w-3.5 h-3.5" /> صالح
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-slate-600">
                              {r.value ? spec.summarize(r.value) : Object.values(r.raw).slice(0, 4).join(" · ")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {invalidRows.length > 0 && (
                    <p className="text-xs text-amber-600">
                      الصفوف غير الصالحة سيتم تجاهلها. / Invalid rows will be skipped.
                    </p>
                  )}
                </div>
              )}

              {/* Importing */}
              {phase === "importing" && (
                <div className="py-8 text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-sky-600 mx-auto animate-spin" />
                  <p className="text-sm text-slate-600">
                    جارٍ الاستيراد / Importing… {progress} / {validRows.length}
                  </p>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden max-w-sm mx-auto">
                    <div
                      className="h-full bg-sky-600 transition-all"
                      style={{ width: `${validRows.length ? (progress / validRows.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Done */}
              {phase === "done" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <Check className="w-5 h-5" />
                    <span className="font-semibold">
                      تم استيراد {result.ok} صف / Imported {result.ok} rows
                    </span>
                  </div>
                  {result.failed.length > 0 && (
                    <div className="border border-red-200 rounded-xl p-3 bg-red-50 max-h-[35vh] overflow-auto">
                      <p className="text-sm font-semibold text-red-700 mb-2">
                        فشل {result.failed.length} صف / {result.failed.length} rows failed:
                      </p>
                      <ul className="text-xs text-red-600 space-y-1">
                        {result.failed.map((f) => (
                          <li key={f.index}>
                            السطر / Row {f.index + 2}: {f.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 p-4 border-t bg-slate-50">
              {phase === "preview" && (
                <>
                  <button onClick={reset} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl text-sm">
                    ملف آخر / Another file
                  </button>
                  <button
                    onClick={confirmImport}
                    disabled={validRows.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 text-sm"
                  >
                    <Check className="w-4 h-4" /> تأكيد الاستيراد ({validRows.length}) / Confirm
                  </button>
                </>
              )}
              {(phase === "idle" || phase === "done") && (
                <button onClick={close} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 text-sm">
                  إغلاق / Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
