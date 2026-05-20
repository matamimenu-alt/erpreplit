/**
 * Expense Accounting Routes
 * Full expense category tree (5-x-x) + VAT-aware transactions + reports
 * Does NOT touch purchases, inventory, suppliers or existing fixed-costs tables.
 */
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  expenseCategoriesTable,
  expenseTransactionsTable,
} from "@workspace/db/schema";
import { eq, and, gte, lte, desc, asc, isNull, sql } from "drizzle-orm";
import { getRestaurantId } from "../lib/restaurant";

const router: IRouter = Router();
function toNum(v: unknown) { return parseFloat(String(v)) || 0; }
function fmt(v: number) { return String(v.toFixed(2)); }

// ─── Category seed data ───────────────────────────────────────────────────────
// Nature: 'fixed' = recurring/predictable (rent, salaries, insurance, gov fees);
//         'variable' = volume-dependent (cleaning supplies, fuel, marketing, …);
//         null only for non-leaf aggregate rows (root + main categories).
type Nature = "fixed" | "variable" | null;

const CATEGORY_SEED: Array<{
  code: string; name: string; nameAr: string;
  parentCode: string | null; level: number; sortOrder: number;
  nature: Nature;
}> = [
  // Root
  { code: "5",     name: "Expenses",                     nameAr: "المصروفات",               parentCode: null, level: 0, sortOrder: 0, nature: null },

  // ── Main categories (aggregate — nature derived from children) ───────────
  { code: "5-1",   name: "Operational Expenses",         nameAr: "المصروفات التشغيلية",       parentCode: "5",   level: 1, sortOrder: 1, nature: null },
  { code: "5-2",   name: "Human Resources Expenses",     nameAr: "مصروفات الموارد البشرية",    parentCode: "5",   level: 1, sortOrder: 2, nature: null },
  { code: "5-3",   name: "Government Fees",              nameAr: "المصروفات الحكومية",         parentCode: "5",   level: 1, sortOrder: 3, nature: null },
  { code: "5-4",   name: "Administrative Expenses",      nameAr: "المصروفات الإدارية",         parentCode: "5",   level: 1, sortOrder: 4, nature: null },
  { code: "5-5",   name: "Financial Expenses",           nameAr: "المصروفات المالية",          parentCode: "5",   level: 1, sortOrder: 5, nature: null },
  { code: "5-6",   name: "Transport & Vehicles",         nameAr: "النقل والمركبات",            parentCode: "5",   level: 1, sortOrder: 6, nature: null },
  { code: "5-7",   name: "Rent",                         nameAr: "الإيجارات",                  parentCode: "5",   level: 1, sortOrder: 7, nature: null },
  { code: "5-8",   name: "Other Expenses",               nameAr: "مصروفات أخرى",               parentCode: "5",   level: 1, sortOrder: 8, nature: null },

  // ── 5-1 Operational — mostly volume-dependent ───────────────────────────
  { code: "5-1-1", name: "Cleaning",                     nameAr: "نظافة",                     parentCode: "5-1", level: 2, sortOrder: 1, nature: "variable" },
  { code: "5-1-2", name: "Fuel",                         nameAr: "محروقات",                   parentCode: "5-1", level: 2, sortOrder: 2, nature: "variable" },
  { code: "5-1-3", name: "Electricity, Water & Telecom", nameAr: "كهرباء ومياه واتصالات",      parentCode: "5-1", level: 2, sortOrder: 3, nature: "fixed"    },
  { code: "5-1-4", name: "Maintenance & Repair",         nameAr: "صيانة وإصلاح",               parentCode: "5-1", level: 2, sortOrder: 4, nature: "variable" },
  { code: "5-1-5", name: "Consumable Tools & Supplies",  nameAr: "أدوات ولوازم مستهلكة",       parentCode: "5-1", level: 2, sortOrder: 5, nature: "variable" },
  { code: "5-1-6", name: "Marketing & Advertising",      nameAr: "دعاية وإعلان",               parentCode: "5-1", level: 2, sortOrder: 6, nature: "variable" },

  // ── 5-2 HR — all fixed (recurring payroll) ───────────────────────────────
  { code: "5-2-1", name: "Salaries",                     nameAr: "رواتب",                     parentCode: "5-2", level: 2, sortOrder: 1, nature: "fixed"    },
  { code: "5-2-2", name: "Housing Allowance",            nameAr: "بدل سكن",                   parentCode: "5-2", level: 2, sortOrder: 2, nature: "fixed"    },
  { code: "5-2-3", name: "Staff Accommodation",          nameAr: "سكن موظفين",                parentCode: "5-2", level: 2, sortOrder: 3, nature: "fixed"    },
  { code: "5-2-4", name: "Medical Insurance",            nameAr: "تأمين طبي",                 parentCode: "5-2", level: 2, sortOrder: 4, nature: "fixed"    },
  { code: "5-2-5", name: "Social Insurance (GOSI)",      nameAr: "تأمينات اجتماعية",           parentCode: "5-2", level: 2, sortOrder: 5, nature: "fixed"    },
  { code: "5-2-6", name: "End-of-Service Benefits",      nameAr: "مكافأة نهاية خدمة",         parentCode: "5-2", level: 2, sortOrder: 6, nature: "fixed"    },
  { code: "5-2-7", name: "Vacation Salaries",            nameAr: "رواتب إجازات",               parentCode: "5-2", level: 2, sortOrder: 7, nature: "fixed"    },

  // ── 5-3 Government — recurring renewals = fixed ─────────────────────────
  { code: "5-3-1", name: "Labor Office Fees",            nameAr: "رسوم مكتب العمل",           parentCode: "5-3", level: 2, sortOrder: 1, nature: "fixed"    },
  { code: "5-3-2", name: "Passport Fees",                nameAr: "رسوم الجوازات",              parentCode: "5-3", level: 2, sortOrder: 2, nature: "fixed"    },
  { code: "5-3-3", name: "Sponsorship Transfer",         nameAr: "نقل كفالة",                 parentCode: "5-3", level: 2, sortOrder: 3, nature: "variable" },
  { code: "5-3-4", name: "Other Government Fees",        nameAr: "رسوم حكومية أخرى",          parentCode: "5-3", level: 2, sortOrder: 4, nature: "variable" },

  // ── 5-4 Administrative ──────────────────────────────────────────────────
  { code: "5-4-1", name: "Stationery & Printing",        nameAr: "قرطاسية ومطبوعات",          parentCode: "5-4", level: 2, sortOrder: 1, nature: "variable" },
  { code: "5-4-2", name: "Computers & IT Equipment",     nameAr: "حاسب آلي",                  parentCode: "5-4", level: 2, sortOrder: 2, nature: "variable" },
  { code: "5-4-3", name: "Consulting Fees",              nameAr: "استشارات إدارية",            parentCode: "5-4", level: 2, sortOrder: 3, nature: "variable" },
  { code: "5-4-4", name: "Accounting Adjustments",       nameAr: "تسويات محاسبية",             parentCode: "5-4", level: 2, sortOrder: 4, nature: "variable" },

  // ── 5-5 Financial ───────────────────────────────────────────────────────
  { code: "5-5-1", name: "Bank Charges",                 nameAr: "رسوم بنكية",                parentCode: "5-5", level: 2, sortOrder: 1, nature: "variable" },
  { code: "5-5-2", name: "Allowed Discounts",            nameAr: "خصومات مسموح بها",          parentCode: "5-5", level: 2, sortOrder: 2, nature: "variable" },

  // ── 5-6 Transport ───────────────────────────────────────────────────────
  { code: "5-6-1", name: "Vehicle Insurance",            nameAr: "تأمين سيارات",              parentCode: "5-6", level: 2, sortOrder: 1, nature: "fixed"    },
  { code: "5-6-2", name: "Vehicle Maintenance",          nameAr: "صيانة سيارات",              parentCode: "5-6", level: 2, sortOrder: 2, nature: "variable" },
  { code: "5-6-3", name: "Travel & Transportation",      nameAr: "سفر وانتقالات",             parentCode: "5-6", level: 2, sortOrder: 3, nature: "variable" },

  // ── 5-7 Rent — all fixed by definition ──────────────────────────────────
  { code: "5-7-1", name: "Branch Rent",                  nameAr: "إيجارات الفروع",            parentCode: "5-7", level: 2, sortOrder: 1, nature: "fixed"    },
  { code: "5-7-2", name: "Staff Housing Rent",           nameAr: "سكن العاملين",              parentCode: "5-7", level: 2, sortOrder: 2, nature: "fixed"    },

  // ── 5-8 Other ───────────────────────────────────────────────────────────
  { code: "5-8-1", name: "Donations",                    nameAr: "تبرعات",                    parentCode: "5-8", level: 2, sortOrder: 1, nature: "variable" },
  { code: "5-8-2", name: "Losses & Miscellaneous",       nameAr: "خسائر ومصاريف متنوعة",      parentCode: "5-8", level: 2, sortOrder: 2, nature: "variable" },
];

// ─── Seed + backfill categories on startup ────────────────────────────────────
// Runs every startup (cheap). New installs insert the full tree; existing
// installs get their `nature` column backfilled where it is currently NULL.
export async function seedExpenseCategories() {
  const existing = await db.select({ code: expenseCategoriesTable.code }).from(expenseCategoriesTable);
  const haveCodes = new Set(existing.map(e => e.code));
  for (const cat of CATEGORY_SEED) {
    if (!haveCodes.has(cat.code)) {
      await db.insert(expenseCategoriesTable).values(cat).onConflictDoNothing();
    } else if (cat.nature !== null) {
      // Backfill nature on existing seeded rows only when NULL — never
      // overwrite a user-customised value.
      await db.update(expenseCategoriesTable)
        .set({ nature: cat.nature })
        .where(and(
          eq(expenseCategoriesTable.code, cat.code),
          isNull(expenseCategoriesTable.nature),
        ));
    }
  }
}

// ─── GET /api/expense-categories ─────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const cats = await db.select().from(expenseCategoriesTable)
      .where(eq(expenseCategoriesTable.isActive, true))
      .orderBy(asc(expenseCategoriesTable.sortOrder));
    res.json(cats);
  } catch (err) {
    req.log.error({ err }, "Error fetching expense categories");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/expense-transactions ───────────────────────────────────────────
router.get("/transactions", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const { month, fromDate, toDate, categoryCode, costCenter } = req.query as Record<string, string>;

    let rows = await db.select().from(expenseTransactionsTable)
      .where(eq(expenseTransactionsTable.restaurantId, restaurantId))
      .orderBy(desc(expenseTransactionsTable.date));

    if (month)        rows = rows.filter(r => r.month === month);
    if (fromDate)     rows = rows.filter(r => r.date >= fromDate);
    if (toDate)       rows = rows.filter(r => r.date <= toDate);
    if (categoryCode) rows = rows.filter(r => r.categoryCode === categoryCode || r.categoryCode.startsWith(categoryCode + "-"));
    if (costCenter)   rows = rows.filter(r => r.costCenter === costCenter);

    res.json(rows.map(r => ({
      ...r,
      amount:      toNum(r.amount),
      vatRate:     toNum(r.vatRate),
      vatAmount:   toNum(r.vatAmount),
      totalAmount: toNum(r.totalAmount),
    })));
  } catch (err) {
    req.log.error({ err }, "Error fetching expense transactions");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── VAT computation ──────────────────────────────────────────────────────────
// vatType: 'none'     → no VAT (exempt / غير خاضع)
//          'included' → amount already includes VAT (شامل الضريبة) — extract from total
//          'excluded' → amount is net (يُضاف فوق السعر) — add VAT on top
// 'amount' param is what the user typed: net for 'excluded'/'none', total for 'included'.
function computeVat(inputAmount: number, vatType: string, rate: number) {
  const r = (rate || 15) / 100;
  if (!vatType || vatType === "none" || inputAmount === 0) {
    return { net: +inputAmount.toFixed(2), vat: 0, total: +inputAmount.toFixed(2) };
  }
  if (vatType === "included") {
    const net = +(inputAmount / (1 + r)).toFixed(2);
    return { net, vat: +(inputAmount - net).toFixed(2), total: +inputAmount.toFixed(2) };
  }
  // excluded / add-on-top
  const vat = +(inputAmount * r).toFixed(2);
  return { net: +inputAmount.toFixed(2), vat, total: +(inputAmount + vat).toFixed(2) };
}

function normalizeVatType(req: { vatType?: unknown; isVatApplicable?: unknown }): string {
  const t = String(req.vatType ?? "").toLowerCase();
  if (t === "none" || t === "included" || t === "excluded") return t;
  // Backward compat: legacy clients only send isVatApplicable
  return req.isVatApplicable ? "excluded" : "none";
}

// ─── POST /api/expense-transactions ──────────────────────────────────────────
router.post("/transactions", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const {
      date, categoryCode, description, descriptionAr,
      amount, vatRate, costCenter, referenceNo, notes,
    } = req.body;

    if (!date || !categoryCode || !description || amount === undefined) {
      return res.status(400).json({ error: "date, categoryCode, description, amount are required" });
    }

    const vatType = normalizeVatType(req.body);
    const applicable = vatType !== "none";
    const rate = applicable ? toNum(vatRate ?? 15) : 0;
    const { net, vat, total } = computeVat(toNum(amount), vatType, rate);
    const month = String(date).substring(0, 7);

    const [row] = await db.insert(expenseTransactionsTable).values({
      restaurantId,
      date:            String(date),
      month,
      categoryCode:    String(categoryCode),
      description:     String(description),
      descriptionAr:   descriptionAr ? String(descriptionAr) : null,
      amount:          fmt(net),
      isVatApplicable: applicable,
      vatType,
      vatRate:         fmt(rate),
      vatAmount:       fmt(vat),
      totalAmount:     fmt(total),
      costCenter:      costCenter ? String(costCenter) : null,
      referenceNo:     referenceNo ? String(referenceNo) : null,
      notes:           notes ? String(notes) : null,
    }).returning();

    res.status(201).json({
      ...row,
      amount: toNum(row.amount), vatRate: toNum(row.vatRate),
      vatAmount: toNum(row.vatAmount), totalAmount: toNum(row.totalAmount),
    });
  } catch (err) {
    req.log.error({ err }, "Error creating expense transaction");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── PUT /api/expense-transactions/:id ───────────────────────────────────────
router.put("/transactions/:id", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const id = parseInt(req.params.id);
    const {
      date, categoryCode, description, descriptionAr,
      amount, vatRate, costCenter, referenceNo, notes,
    } = req.body;

    const vatType = normalizeVatType(req.body);
    const applicable = vatType !== "none";
    const rate = applicable ? toNum(vatRate ?? 15) : 0;
    const { net, vat, total } = computeVat(toNum(amount), vatType, rate);
    const month = String(date).substring(0, 7);

    const [row] = await db.update(expenseTransactionsTable)
      .set({
        date: String(date), month, categoryCode: String(categoryCode),
        description: String(description),
        descriptionAr: descriptionAr ? String(descriptionAr) : null,
        amount: fmt(net), isVatApplicable: applicable, vatType,
        vatRate: fmt(rate), vatAmount: fmt(vat), totalAmount: fmt(total),
        costCenter: costCenter ? String(costCenter) : null,
        referenceNo: referenceNo ? String(referenceNo) : null,
        notes: notes ? String(notes) : null,
        updatedAt: new Date(),
      })
      .where(and(eq(expenseTransactionsTable.id, id), eq(expenseTransactionsTable.restaurantId, restaurantId)))
      .returning();

    if (!row) return res.status(404).json({ error: "Not found" });
    res.json({
      ...row,
      amount: toNum(row.amount), vatRate: toNum(row.vatRate),
      vatAmount: toNum(row.vatAmount), totalAmount: toNum(row.totalAmount),
    });
  } catch (err) {
    req.log.error({ err }, "Error updating expense transaction");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── DELETE /api/expense-transactions/:id ────────────────────────────────────
router.delete("/transactions/:id", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const id = parseInt(req.params.id);
    const [row] = await db.delete(expenseTransactionsTable)
      .where(and(eq(expenseTransactionsTable.id, id), eq(expenseTransactionsTable.restaurantId, restaurantId)))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json({ success: true, id });
  } catch (err) {
    req.log.error({ err }, "Error deleting expense transaction");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/expense-categories/summary ─────────────────────────────────────
// Returns totals grouped by category tree for a given month / date range
router.get("/summary", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const { month, fromDate, toDate } = req.query as Record<string, string>;

    let rows = await db.select().from(expenseTransactionsTable)
      .where(eq(expenseTransactionsTable.restaurantId, restaurantId));

    if (month)    rows = rows.filter(r => r.month === month);
    if (fromDate) rows = rows.filter(r => r.date >= fromDate);
    if (toDate)   rows = rows.filter(r => r.date <= toDate);

    // Fetch full category tree
    const cats = await db.select().from(expenseCategoriesTable)
      .where(eq(expenseCategoriesTable.isActive, true))
      .orderBy(asc(expenseCategoriesTable.sortOrder));

    // Aggregate by category code
    const totals: Record<string, { net: number; vat: number; total: number; count: number }> = {};
    for (const r of rows) {
      const code = r.categoryCode;
      if (!totals[code]) totals[code] = { net: 0, vat: 0, total: 0, count: 0 };
      totals[code].net   += toNum(r.amount);
      totals[code].vat   += toNum(r.vatAmount);
      totals[code].total += toNum(r.totalAmount);
      totals[code].count++;

      // Roll up to parent levels
      const parts = code.split("-");
      for (let i = parts.length - 1; i >= 1; i--) {
        const parentCode = parts.slice(0, i).join("-");
        if (!totals[parentCode]) totals[parentCode] = { net: 0, vat: 0, total: 0, count: 0 };
        totals[parentCode].net   += toNum(r.amount);
        totals[parentCode].vat   += toNum(r.vatAmount);
        totals[parentCode].total += toNum(r.totalAmount);
        totals[parentCode].count++;
      }
    }

    // Build tree output
    const build = (parentCode: string | null): unknown[] =>
      cats
        .filter(c => c.parentCode === parentCode)
        .map(c => ({
          code:     c.code,
          name:     c.name,
          nameAr:   c.nameAr,
          level:    c.level,
          net:      +(totals[c.code]?.net   ?? 0).toFixed(2),
          vat:      +(totals[c.code]?.vat   ?? 0).toFixed(2),
          total:    +(totals[c.code]?.total ?? 0).toFixed(2),
          count:    totals[c.code]?.count ?? 0,
          children: build(c.code),
        }));

    res.json({ month: month ?? null, fromDate: fromDate ?? null, toDate: toDate ?? null, tree: build(null) });
  } catch (err) {
    req.log.error({ err }, "Error fetching expense summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
