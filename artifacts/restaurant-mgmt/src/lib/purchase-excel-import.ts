import { PURCHASE_CATEGORIES } from "./categories";

/**
 * Format-agnostic purchase-Excel importer.
 *
 * Handles BOTH the current template (slug categories, `tax`, `false`) and the
 * old-ERP export (different column names/order, display-name categories,
 * "Tax Invoice", extra Net/VAT/Total/Notes columns) — plus anything in between —
 * without the user editing the file. Detects the template, maps columns by a
 * normalized alias dictionary, and smart-matches category / unit / invoice type
 * / payment by slug, English label, Arabic label, legacy alias, and fuzzy match.
 */

// ── Normalization ────────────────────────────────────────────────────────────
/** Aggressive normalization: lowercase, strip Arabic diacritics, unify alef/ya/ta,
 *  drop punctuation, collapse whitespace. Used for both headers and cell values. */
export function norm(s: unknown): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[ً-ْٰ]/g, "") // Arabic diacritics
    .replace(/[أإآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9؀-ۿ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Category matching (fixes "unknown categories") ───────────────────────────
const CATEGORY_INDEX = (() => {
  const idx = new Map<string, string>();
  for (const c of PURCHASE_CATEGORIES) {
    idx.set(norm(c.value), c.value);
    idx.set(norm(c.label), c.value);
    idx.set(norm(c.labelAr), c.value);
    idx.set(norm(c.groupLabel), c.value); // group label → first sub in group (best-effort)
    idx.set(norm(c.groupLabelAr), c.value);
  }
  // Legacy / common aliases seen in older exports.
  const legacy: Record<string, string> = {
    food: "food-poultry", "food meat": "food-poultry", meat: "food-poultry", poultry: "food-poultry",
    vegetables: "food-vegetables", fruits: "food-vegetables", produce: "food-vegetables",
    dairy: "food-dairy", milk: "food-dairy",
    spices: "food-spices", seasoning: "food-spices",
    oils: "food-supplies", grocery: "food-supplies",
    beverage: "bev-juices", juice: "bev-juices",
    water: "bev-water", "soft drinks": "bev-soft", soda: "bev-soft",
    cleaning: "gen-cleaning", kitchen: "gen-kitchen", cashier: "gen-cashier",
    packaging: "gen-packaging", paper: "gen-packaging",
    fuel: "fuel-gas", gas: "fuel-gas", charcoal: "fuel-charcoal",
    electricity: "fuel-utilities", utilities: "fuel-utilities",
    maintenance: "maint-services", repair: "maint-services",
    internet: "it-internet", phone: "it-phones", communication: "it-internet",
    marketing: "mkt-campaigns", advertising: "mkt-campaigns",
    other: "others-misc", others: "others-misc", misc: "others-misc", miscellaneous: "others-misc",
  };
  for (const [k, v] of Object.entries(legacy)) idx.set(norm(k), v);
  return idx;
})();

export type CategoryResult = { slug: string | null; method: "exact" | "fuzzy" | "none" };

export function matchCategory(raw: unknown): CategoryResult {
  const n = norm(raw);
  if (!n) return { slug: null, method: "none" };
  const exact = CATEGORY_INDEX.get(n);
  if (exact) return { slug: exact, method: "exact" };
  // Fuzzy: substring either direction against known keys.
  for (const [key, slug] of CATEGORY_INDEX) {
    if (key.length >= 3 && (key.includes(n) || n.includes(key))) return { slug, method: "fuzzy" };
  }
  // Token overlap.
  const toks = new Set(n.split(" ").filter((t) => t.length > 2));
  let best: { slug: string; score: number } | null = null;
  for (const [key, slug] of CATEGORY_INDEX) {
    const kt = key.split(" ");
    const score = kt.filter((t) => toks.has(t)).length;
    if (score > 0 && (!best || score > best.score)) best = { slug, score };
  }
  return best ? { slug: best.slug, method: "fuzzy" } : { slug: null, method: "none" };
}

// ── Invoice type & payment matching ──────────────────────────────────────────
export function matchInvoiceType(raw: unknown): "tax" | "non-tax" {
  const n = norm(raw);
  if (/non\s*tax|simplif|مبسط|غير\s*ضريب/.test(n)) return "non-tax";
  if (/tax|ضريب|vat/.test(n)) return "tax";
  return "tax";
}

export function matchPayment(raw: unknown): "cash" | "card" | "credit" {
  const n = norm(raw);
  if (/credit|اجل|ذمم|دين|آجل/.test(n)) return "credit";
  if (/card|شبكه|شبكة|mada|مدي|مدى|visa|master|بطاق/.test(n)) return "card";
  if (/cash|نقد/.test(n)) return "cash";
  return "cash";
}

// ── Column detection (order-independent, bilingual, alias-based) ──────────────
export type Canonical =
  | "date" | "supplierName" | "productName" | "category" | "unit"
  | "quantity" | "price" | "priceIncludesVat" | "invoiceType" | "paymentType"
  | "invoiceId" | "netAmount" | "vat" | "total" | "notes";

const ALIASES: Record<Canonical, string[]> = {
  date: ["date", "التاريخ", "تاريخ"],
  supplierName: ["suppliername", "supplier", "vendor", "المورد", "اسم المورد", "المورّد"],
  productName: ["productname", "product", "item", "description", "الصنف", "المنتج", "اسم الصنف", "اسم المنتج", "البيان"],
  category: ["category", "cat", "التصنيف", "الفئة", "فئة", "تصنيف"],
  unit: ["unit", "uom", "الوحدة", "وحدة"],
  quantity: ["quantity", "qty", "الكمية", "كمية", "العدد"],
  price: ["price", "unit price", "unit price sar", "unitprice", "rate", "السعر", "سعر الوحدة", "سعر"],
  priceIncludesVat: ["priceincludesvat", "price includes vat", "incl vat", "vat inclusive", "شامل الضريبة"],
  invoiceType: ["invoicetype", "invoice type", "type", "نوع الفاتورة", "نوع"],
  paymentType: ["paymenttype", "payment", "payment method", "payment type", "طريقة الدفع", "الدفع", "السداد"],
  invoiceId: ["invoiceid", "invoice id", "invoice no", "invoice number", "invoice", "رقم الفاتورة", "الفاتورة"],
  netAmount: ["netamount", "net amount", "net amount sar", "net", "amount before vat", "الصافي", "المبلغ قبل الضريبة", "قبل الضريبة"],
  vat: ["vat", "vat sar", "tax amount", "الضريبة", "ضريبة القيمة المضافة", "ضريبه"],
  total: ["total", "total sar", "grand total", "amount", "الاجمالي", "المجموع", "الإجمالي"],
  notes: ["notes", "note", "remarks", "ملاحظات", "ملاحظه"],
};

const ALIAS_INDEX = (() => {
  const idx = new Map<string, Canonical>();
  for (const [canon, list] of Object.entries(ALIASES) as [Canonical, string[]][]) {
    for (const a of list) idx.set(norm(a), canon);
  }
  return idx;
})();

export type ColumnMap = Partial<Record<Canonical, number>>;

/** Map header cells → canonical field indices. Order-independent. */
export function detectColumns(headers: unknown[]): ColumnMap {
  const map: ColumnMap = {};
  headers.forEach((h, i) => {
    const n = norm(h);
    let canon = ALIAS_INDEX.get(n);
    if (!canon) {
      // Loose contains-match for headers with extra words/units.
      for (const [key, c] of ALIAS_INDEX) {
        if (key.length >= 3 && (n === key || n.includes(key) || key.includes(n))) { canon = c; break; }
      }
    }
    if (canon && map[canon] === undefined) map[canon] = i;
  });
  return map;
}

export type Template = "current" | "old-erp" | "custom";
export function detectTemplate(cols: ColumnMap): Template {
  if (cols.netAmount !== undefined || cols.invoiceId !== undefined || cols.total !== undefined) return "old-erp";
  if (cols.priceIncludesVat !== undefined && cols.supplierName !== undefined) return "current";
  return "custom";
}

// ── Row mapping ──────────────────────────────────────────────────────────────
export type RowStatus = "valid" | "review" | "warning" | "error";

export type MappedRow = {
  index: number; // 1-based row number in the sheet (excluding header)
  date: string;
  supplierName: string;
  productName: string;
  categoryRaw: string;
  category: string; // resolved slug (may be "" when unmatched → review)
  categoryMethod: "exact" | "fuzzy" | "none";
  unit: string;
  quantity: number;
  price: number; // net unit price
  priceIncludesVat: boolean;
  invoiceType: "tax" | "non-tax";
  paymentType: "cash" | "card" | "credit";
  invoiceId: string;
  notes: string;
  computedVat: number;
  computedTotal: number;
  status: RowStatus;
  issues: string[];
};

const toNum = (v: unknown) => {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const n = parseFloat(String(v ?? "").replace(/[,\s]/g, ""));
  return isFinite(n) ? n : 0;
};
const parseBool = (v: unknown) => {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "نعم";
};
const isoDate = (v: unknown): string => {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  const s = String(v ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Map one raw sheet row (array) into a purchase line, applying all matchers and
 * classifying the result. `overrides` supplies remembered category mappings
 * (normalized-raw → slug) so previously-resolved unknowns auto-apply.
 */
export function mapRow(
  row: unknown[],
  cols: ColumnMap,
  index: number,
  overrides: Record<string, string> = {},
): MappedRow {
  const get = (c: Canonical) => (cols[c] !== undefined ? row[cols[c] as number] : undefined);
  const issues: string[] = [];

  const date = isoDate(get("date"));
  const supplierName = String(get("supplierName") ?? "").trim();
  const productName = String(get("productName") ?? "").trim();
  const categoryRaw = String(get("category") ?? "").trim();
  const unit = String(get("unit") ?? "").trim() || "unit";
  const quantity = toNum(get("quantity")) || (get("quantity") === undefined ? 1 : 0);

  // Net unit price. When the file carries an explicit Net Amount column
  // (old-ERP exports), that is authoritative — the "Unit Price" column there is
  // unreliable (sometimes gross). Deriving net÷qty and letting the tax engine
  // add 15% reproduces the file's own VAT/Total exactly. Otherwise use the
  // unit-price column (current template), falling back to total÷qty.
  let price: number;
  if (cols.netAmount !== undefined && toNum(get("netAmount")) > 0) {
    price = toNum(get("netAmount")) / (quantity || 1);
  } else {
    price = toNum(get("price"));
    if (!price && cols.total !== undefined) {
      const t = toNum(get("total"));
      // A bare total with no net → treat as VAT-inclusive unit price.
      if (t > 0) price = t / (quantity || 1);
    }
  }

  // priceIncludesVat column sometimes holds a boolean flag, sometimes a gross
  // amount (old exports). Only treat 0/1/true/false as a flag; a larger number
  // is a mislabeled total, so keep net price and let VAT be computed.
  const pivRaw = get("priceIncludesVat");
  const pivNum = typeof pivRaw === "number" ? pivRaw : parseFloat(String(pivRaw));
  const priceIncludesVat = pivRaw !== undefined && (pivRaw === true || pivRaw === false || String(pivRaw).toLowerCase() === "true" || String(pivRaw).toLowerCase() === "false")
    ? parseBool(pivRaw)
    : !isFinite(pivNum) ? false : false;

  const invoiceType = matchInvoiceType(get("invoiceType"));
  const paymentType = matchPayment(get("paymentType"));
  const invoiceId = String(get("invoiceId") ?? "").trim();
  const notes = String(get("notes") ?? "").trim();

  // Category resolution: remembered override → matcher.
  const overrideSlug = overrides[norm(categoryRaw)];
  const cat = overrideSlug ? { slug: overrideSlug, method: "exact" as const } : matchCategory(categoryRaw);

  // Validation.
  if (!date) issues.push("تاريخ غير صالح / invalid or missing date");
  if (!productName) issues.push("اسم الصنف مفقود / missing product name");
  if (quantity <= 0) issues.push("الكمية يجب أن تكون أكبر من صفر / quantity must be > 0");
  if (price < 0) issues.push("سعر غير صالح / invalid price");
  if (!cat.slug) issues.push(`تصنيف غير معروف / unknown category: "${categoryRaw}"`);

  const netLine = quantity * price;
  const computedVat = invoiceType === "tax" ? +(netLine * (priceIncludesVat ? 0 : 0.15)).toFixed(2) : 0;
  const computedTotal = +(priceIncludesVat ? netLine : netLine + computedVat).toFixed(2);

  // Optional cross-check against a stated total column.
  if (cols.total !== undefined) {
    const stated = toNum(get("total"));
    if (stated > 0 && Math.abs(stated - computedTotal) > Math.max(0.5, stated * 0.02)) {
      issues.push(`الإجمالي المحسوب ${computedTotal} ≠ ${stated} / total mismatch`);
    }
  }

  let status: RowStatus = "valid";
  const hardError = !date || !productName || quantity <= 0 || price < 0;
  if (hardError) status = "error";
  else if (!cat.slug) status = "review";
  else if (issues.length) status = "warning";

  return {
    index, date, supplierName, productName, categoryRaw,
    category: cat.slug ?? "", categoryMethod: cat.method,
    unit, quantity, price, priceIncludesVat, invoiceType, paymentType,
    invoiceId, notes, computedVat, computedTotal, status, issues,
  };
}

export type ParseResult = {
  template: Template;
  columns: ColumnMap;
  detectedFields: Canonical[];
  rows: MappedRow[];
};

/** Parse a full sheet (array-of-arrays, first row = header). */
export function parseSheet(aoa: unknown[][], overrides: Record<string, string> = {}): ParseResult {
  const header = aoa[0] ?? [];
  const columns = detectColumns(header);
  const rows: MappedRow[] = [];
  for (let i = 1; i < aoa.length; i++) {
    const r = aoa[i];
    if (!r || r.every((c) => c === "" || c == null)) continue; // skip blank rows
    rows.push(mapRow(r, columns, i, overrides));
  }
  return {
    template: detectTemplate(columns),
    columns,
    detectedFields: Object.keys(columns) as Canonical[],
    rows,
  };
}
