import * as XLSX from "xlsx";

/** A raw imported row: header → trimmed string cell value. */
export type ParsedRow = Record<string, string>;

/**
 * Parse an Excel (.xlsx/.xls) or CSV file into string-keyed row objects.
 * SheetJS auto-detects the format, so both paths share one implementation.
 * The first sheet's first row is treated as the header.
 */
export async function parseSpreadsheet(file: File): Promise<ParsedRow[]> {
  const buf = await file.arrayBuffer();
  // cellDates:true → real date cells become JS Date objects (not locale-formatted
  // strings like "8/3/26"), so we can normalize them to ISO ourselves.
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const firstSheetName = wb.SheetNames[0];
  const sheet = firstSheetName ? wb.Sheets[firstSheetName] : undefined;
  if (!sheet) return [];
  // raw:true keeps Date objects and numbers as-is so we control every coercion.
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: true,
  });
  return rows.map((r) => {
    const out: ParsedRow = {};
    for (const [k, v] of Object.entries(r)) {
      out[String(k).trim()] = normalizeCell(v);
    }
    return out;
  });
}

/** Convert a raw cell to a trimmed string, formatting Date cells as YYYY-MM-DD. */
function normalizeCell(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(v).trim();
}

export type TemplateColumn = { key: string; example?: string | number };

/** Download an .xlsx template: one header row plus a single example row. */
export function downloadTemplate(columns: TemplateColumn[], filename: string) {
  const header = columns.map((c) => c.key);
  const example = columns.map((c) => c.example ?? "");
  const ws = XLSX.utils.aoa_to_sheet([header, example]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ── Cell coercion helpers ───────────────────────────────────────────────────

/** Parse a numeric cell; returns `fallback` for blank/invalid input. */
export function parseNum(v: string | undefined, fallback = 0): number {
  if (v == null || v === "") return fallback;
  const n = parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

/** Parse a boolean cell. Accepts true/1/yes/y and Arabic نعم (else false). */
export function parseBool(v: string | undefined): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "y" || s === "نعم";
}

/** True when a cell holds a valid ISO date (YYYY-MM-DD). */
export function isIsoDate(v: string | undefined): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "").trim());
}
