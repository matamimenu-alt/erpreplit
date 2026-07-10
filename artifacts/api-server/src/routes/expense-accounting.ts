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
  // Professional hospitality chart of accounts. Re-ordered & re-grouped in
  // 2026-05 to match standard ERP structure for hotels & restaurant groups.
  // ⚠ HR_MAIN_CODE in reports.ts depends on 5-1 being HR — keep in sync.
  { code: "5-1",   name: "HR & Employee Costs",          nameAr: "تكاليف الموظفين والموارد البشرية", parentCode: "5", level: 1, sortOrder: 1, nature: null },
  { code: "5-2",   name: "Government & Legal",           nameAr: "المصروفات الحكومية والقانونية",   parentCode: "5", level: 1, sortOrder: 2, nature: null },
  { code: "5-3",   name: "Fixed Operating Costs",        nameAr: "تكاليف التشغيل الثابتة",          parentCode: "5", level: 1, sortOrder: 3, nature: null },
  { code: "5-4",   name: "Variable Operating Costs",     nameAr: "تكاليف التشغيل المتغيرة",         parentCode: "5", level: 1, sortOrder: 4, nature: null },
  { code: "5-5",   name: "Marketing & Sales",            nameAr: "التسويق والمبيعات",               parentCode: "5", level: 1, sortOrder: 5, nature: null },
  { code: "5-6",   name: "Repairs & Maintenance",        nameAr: "الإصلاح والصيانة",                parentCode: "5", level: 1, sortOrder: 6, nature: null },
  { code: "5-7",   name: "Administrative Expenses",      nameAr: "المصروفات الإدارية",              parentCode: "5", level: 1, sortOrder: 7, nature: null },

  // ── 5-1 HR & Employee Costs ─────────────────────────────────────────────
  // Payroll itself comes from the HR module; these capture allowances,
  // benefits and HR-related one-offs entered manually via Expense Ledger.
  { code: "5-1-1",  name: "Salaries & Wages",      nameAr: "الرواتب والأجور",       parentCode: "5-1", level: 2, sortOrder: 1,  nature: "fixed"    },
  { code: "5-1-2",  name: "Overtime",              nameAr: "العمل الإضافي",        parentCode: "5-1", level: 2, sortOrder: 2,  nature: "variable" },
  { code: "5-1-3",  name: "Vacation Allowances",   nameAr: "بدلات الإجازات",       parentCode: "5-1", level: 2, sortOrder: 3,  nature: "fixed"    },
  { code: "5-1-4",  name: "Air Tickets / Travel",  nameAr: "تذاكر السفر",          parentCode: "5-1", level: 2, sortOrder: 4,  nature: "variable" },
  { code: "5-1-5",  name: "Employee Meals",        nameAr: "وجبات الموظفين",       parentCode: "5-1", level: 2, sortOrder: 5,  nature: "variable" },
  { code: "5-1-6",  name: "Staff Accommodation",   nameAr: "سكن الموظفين",         parentCode: "5-1", level: 2, sortOrder: 6,  nature: "fixed"    },
  { code: "5-1-7",  name: "End of Service",        nameAr: "مكافأة نهاية الخدمة",  parentCode: "5-1", level: 2, sortOrder: 7,  nature: "fixed"    },
  { code: "5-1-8",  name: "Medical Insurance",     nameAr: "التأمين الطبي",        parentCode: "5-1", level: 2, sortOrder: 8,  nature: "fixed"    },
  { code: "5-1-9",  name: "Recruitment Costs",     nameAr: "تكاليف التوظيف",       parentCode: "5-1", level: 2, sortOrder: 9,  nature: "variable" },
  { code: "5-1-10", name: "Training",              nameAr: "التدريب",              parentCode: "5-1", level: 2, sortOrder: 10, nature: "variable" },

  // ── 5-2 Government & Legal ──────────────────────────────────────────────
  { code: "5-2-1", name: "Iqama Fees",              nameAr: "رسوم الإقامة",        parentCode: "5-2", level: 2, sortOrder: 1, nature: "fixed"    },
  { code: "5-2-2", name: "GOSI / Social Insurance", nameAr: "التأمينات الاجتماعية", parentCode: "5-2", level: 2, sortOrder: 2, nature: "fixed"    },
  { code: "5-2-3", name: "Municipality Licenses",   nameAr: "تراخيص البلدية",      parentCode: "5-2", level: 2, sortOrder: 3, nature: "fixed"    },
  { code: "5-2-4", name: "Commercial Registration", nameAr: "السجل التجاري",       parentCode: "5-2", level: 2, sortOrder: 4, nature: "fixed"    },
  { code: "5-2-5", name: "Chamber of Commerce",     nameAr: "الغرفة التجارية",     parentCode: "5-2", level: 2, sortOrder: 5, nature: "fixed"    },
  { code: "5-2-6", name: "Visa Costs",              nameAr: "رسوم التأشيرات",      parentCode: "5-2", level: 2, sortOrder: 6, nature: "variable" },
  { code: "5-2-7", name: "Passport Services",       nameAr: "خدمات الجوازات",      parentCode: "5-2", level: 2, sortOrder: 7, nature: "variable" },
  { code: "5-2-8", name: "Government Platforms",    nameAr: "المنصات الحكومية",    parentCode: "5-2", level: 2, sortOrder: 8, nature: "variable" },
  { code: "5-2-9", name: "Legal Fees",              nameAr: "الرسوم القانونية",    parentCode: "5-2", level: 2, sortOrder: 9, nature: "variable" },

  // ── 5-3 Fixed Operating Costs ──────────────────────────────────────────
  { code: "5-3-1", name: "Rent",                    nameAr: "الإيجار",             parentCode: "5-3", level: 2, sortOrder: 1, nature: "fixed" },
  { code: "5-3-2", name: "Internet",                nameAr: "الإنترنت",            parentCode: "5-3", level: 2, sortOrder: 2, nature: "fixed" },
  { code: "5-3-3", name: "Software Subscriptions",  nameAr: "اشتراكات البرامج",    parentCode: "5-3", level: 2, sortOrder: 3, nature: "fixed" },
  { code: "5-3-4", name: "Insurance",               nameAr: "التأمين",             parentCode: "5-3", level: 2, sortOrder: 4, nature: "fixed" },
  { code: "5-3-5", name: "Security Contracts",      nameAr: "عقود الأمن",          parentCode: "5-3", level: 2, sortOrder: 5, nature: "fixed" },
  { code: "5-3-6", name: "Maintenance Contracts",   nameAr: "عقود الصيانة",        parentCode: "5-3", level: 2, sortOrder: 6, nature: "fixed" },
  { code: "5-3-7", name: "Accounting Systems",      nameAr: "أنظمة المحاسبة",      parentCode: "5-3", level: 2, sortOrder: 7, nature: "fixed" },
  { code: "5-3-8", name: "POS Systems",             nameAr: "أنظمة نقاط البيع",    parentCode: "5-3", level: 2, sortOrder: 8, nature: "fixed" },

  // ── 5-4 Variable Operating Costs ───────────────────────────────────────
  { code: "5-4-1",  name: "Electricity",         nameAr: "الكهرباء",         parentCode: "5-4", level: 2, sortOrder: 1,  nature: "variable" },
  { code: "5-4-2",  name: "Water",               nameAr: "المياه",           parentCode: "5-4", level: 2, sortOrder: 2,  nature: "variable" },
  { code: "5-4-3",  name: "Gas",                 nameAr: "الغاز",            parentCode: "5-4", level: 2, sortOrder: 3,  nature: "variable" },
  { code: "5-4-4",  name: "Fuel",                nameAr: "الوقود",           parentCode: "5-4", level: 2, sortOrder: 4,  nature: "variable" },
  { code: "5-4-5",  name: "Packaging",           nameAr: "التغليف",          parentCode: "5-4", level: 2, sortOrder: 5,  nature: "variable" },
  { code: "5-4-6",  name: "Cleaning Materials",  nameAr: "مواد التنظيف",     parentCode: "5-4", level: 2, sortOrder: 6,  nature: "variable" },
  { code: "5-4-7",  name: "Laundry",             nameAr: "المغسلة",          parentCode: "5-4", level: 2, sortOrder: 7,  nature: "variable" },
  { code: "5-4-8",  name: "Kitchen Consumables", nameAr: "مستهلكات المطبخ",  parentCode: "5-4", level: 2, sortOrder: 8,  nature: "variable" },
  { code: "5-4-9",  name: "Smallwares",          nameAr: "الأدوات الصغيرة",  parentCode: "5-4", level: 2, sortOrder: 9,  nature: "variable" },
  { code: "5-4-10", name: "Delivery Expenses",   nameAr: "مصاريف التوصيل",   parentCode: "5-4", level: 2, sortOrder: 10, nature: "variable" },

  // ── 5-5 Marketing & Sales ──────────────────────────────────────────────
  { code: "5-5-1", name: "Social Media Ads",                       nameAr: "إعلانات التواصل الاجتماعي", parentCode: "5-5", level: 2, sortOrder: 1, nature: "variable" },
  { code: "5-5-2", name: "Influencer Marketing",                   nameAr: "تسويق المؤثرين",           parentCode: "5-5", level: 2, sortOrder: 2, nature: "variable" },
  { code: "5-5-3", name: "Printing",                               nameAr: "الطباعة",                  parentCode: "5-5", level: 2, sortOrder: 3, nature: "variable" },
  { code: "5-5-4", name: "Photography",                            nameAr: "التصوير",                  parentCode: "5-5", level: 2, sortOrder: 4, nature: "variable" },
  { code: "5-5-5", name: "Promotions & Discounts",                 nameAr: "العروض والخصومات",         parentCode: "5-5", level: 2, sortOrder: 5, nature: "variable" },
  { code: "5-5-6", name: "Talabat / HungerStation Commissions",    nameAr: "عمولات طلبات وهنقرستيشن",  parentCode: "5-5", level: 2, sortOrder: 6, nature: "variable" },

  // ── 5-6 Repairs & Maintenance ──────────────────────────────────────────
  { code: "5-6-1", name: "Equipment Maintenance", nameAr: "صيانة المعدات",        parentCode: "5-6", level: 2, sortOrder: 1, nature: "variable" },
  { code: "5-6-2", name: "AC Maintenance",        nameAr: "صيانة المكيفات",       parentCode: "5-6", level: 2, sortOrder: 2, nature: "variable" },
  { code: "5-6-3", name: "Plumbing",              nameAr: "السباكة",              parentCode: "5-6", level: 2, sortOrder: 3, nature: "variable" },
  { code: "5-6-4", name: "Electrical Repairs",    nameAr: "الإصلاحات الكهربائية", parentCode: "5-6", level: 2, sortOrder: 4, nature: "variable" },
  { code: "5-6-5", name: "Emergency Repairs",     nameAr: "الإصلاحات الطارئة",    parentCode: "5-6", level: 2, sortOrder: 5, nature: "variable" },

  // ── 5-7 Administrative Expenses ────────────────────────────────────────
  { code: "5-7-1", name: "Office Supplies",         nameAr: "اللوازم المكتبية",   parentCode: "5-7", level: 2, sortOrder: 1, nature: "variable" },
  { code: "5-7-2", name: "Stationery",              nameAr: "القرطاسية",          parentCode: "5-7", level: 2, sortOrder: 2, nature: "variable" },
  { code: "5-7-3", name: "Bank Charges",            nameAr: "الرسوم البنكية",     parentCode: "5-7", level: 2, sortOrder: 3, nature: "variable" },
  { code: "5-7-4", name: "Communication Expenses",  nameAr: "مصاريف الاتصالات",   parentCode: "5-7", level: 2, sortOrder: 4, nature: "variable" },
  { code: "5-7-5", name: "Courier Services",        nameAr: "خدمات البريد السريع", parentCode: "5-7", level: 2, sortOrder: 5, nature: "variable" },
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
    return res.json(cats);
  } catch (err) {
    req.log.error({ err }, "Error fetching expense categories");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/expense-categories — create user-defined category ─────────────
// Forces Fixed/Variable nature on every new leaf so P&L grouping stays
// deterministic. New code is auto-generated as <parentCode>-<next-index>.
router.post("/", async (req, res) => {
  try {
    const { name, nameAr, parentCode, nature } = req.body ?? {};
    if (!name || !nameAr || !parentCode || !nature) {
      return res.status(400).json({ error: "name, nameAr, parentCode and nature are required" });
    }
    if (nature !== "fixed" && nature !== "variable") {
      return res.status(400).json({ error: "nature must be 'fixed' or 'variable'" });
    }
    const parent = await db.select().from(expenseCategoriesTable)
      .where(eq(expenseCategoriesTable.code, String(parentCode))).limit(1);
    if (parent.length === 0) {
      return res.status(400).json({ error: `parent category '${parentCode}' not found` });
    }
    // Aggregate-vs-leaf invariant: a leaf (nature set) carries transactions
    // and must never gain children — that would orphan the parent's
    // transactions out of the Fixed-vs-Variable rollup. Force parents to be
    // aggregate nodes (nature=null).
    if (parent[0].nature !== null) {
      return res.status(400).json({
        error: `parent category '${parentCode}' is a leaf — pick an aggregate (group) category as the parent`,
      });
    }
    // Find next available sub-code under this parent
    const siblings = await db.select().from(expenseCategoriesTable)
      .where(eq(expenseCategoriesTable.parentCode, String(parentCode)));
    const usedSuffixes = siblings
      .map(s => parseInt(s.code.slice(String(parentCode).length + 1), 10))
      .filter(n => !isNaN(n));
    const nextSuffix = (usedSuffixes.length === 0 ? 0 : Math.max(...usedSuffixes)) + 1;
    const code = `${parentCode}-${nextSuffix}`;
    const sortOrder = (siblings.reduce((m, s) => Math.max(m, s.sortOrder), 0)) + 1;

    const [row] = await db.insert(expenseCategoriesTable).values({
      code,
      name:       String(name),
      nameAr:     String(nameAr),
      parentCode: String(parentCode),
      level:      parent[0].level + 1,
      sortOrder,
      isActive:   true,
      nature,
    }).returning();
    return res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Error creating expense category");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── PUT /api/expense-categories/:code — rename / change nature ──────────────
router.put("/:code", async (req, res) => {
  try {
    const code = req.params.code;
    const { name, nameAr, nature, isActive } = req.body ?? {};
    if (nature !== undefined && nature !== "fixed" && nature !== "variable") {
      return res.status(400).json({ error: "nature must be 'fixed' or 'variable'" });
    }
    // Aggregate categories (existing rows with nature=null AND children)
    // cannot become leaves — that would let users post transactions onto a
    // group node and break P&L rollup. Allow nature edits only on leaves.
    if (nature !== undefined) {
      const existing = await db.select().from(expenseCategoriesTable)
        .where(eq(expenseCategoriesTable.code, code)).limit(1);
      if (existing.length === 0) return res.status(404).json({ error: "category not found" });
      if (existing[0].nature === null) {
        return res.status(400).json({
          error: `category '${code}' is an aggregate (group) node — its Fixed/Variable nature cannot be set`,
        });
      }
    }
    const patch: Record<string, unknown> = {};
    if (name     !== undefined) patch.name     = String(name);
    if (nameAr   !== undefined) patch.nameAr   = String(nameAr);
    if (nature   !== undefined) patch.nature   = nature;
    if (isActive !== undefined) patch.isActive = Boolean(isActive);
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: "no fields to update" });
    }
    const [row] = await db.update(expenseCategoriesTable)
      .set(patch)
      .where(eq(expenseCategoriesTable.code, code))
      .returning();
    if (!row) return res.status(404).json({ error: "category not found" });
    return res.json(row);
  } catch (err) {
    req.log.error({ err }, "Error updating expense category");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── DELETE /api/expense-categories/:code — soft-delete (deactivate) ─────────
// Hard-delete would orphan transactions and break P&L. We:
//   • reject if any transactions reference the code (data-integrity)
//   • reject if any child categories exist (would orphan them)
//   • otherwise mark isActive=false so it disappears from pickers while
//     historical references remain valid.
router.delete("/:code", async (req, res) => {
  try {
    const code = req.params.code;
    const txns = await db.select({ id: expenseTransactionsTable.id })
      .from(expenseTransactionsTable)
      .where(eq(expenseTransactionsTable.categoryCode, code)).limit(1);
    if (txns.length > 0) {
      return res.status(409).json({
        error: "category has transactions",
        message: "Cannot delete — this category is used by one or more expense transactions. Reassign or delete those transactions first.",
      });
    }
    const children = await db.select({ code: expenseCategoriesTable.code })
      .from(expenseCategoriesTable)
      .where(eq(expenseCategoriesTable.parentCode, code)).limit(1);
    if (children.length > 0) {
      return res.status(409).json({
        error: "category has children",
        message: "Cannot delete — this category has sub-categories. Delete those first.",
      });
    }
    const [row] = await db.update(expenseCategoriesTable)
      .set({ isActive: false })
      .where(eq(expenseCategoriesTable.code, code))
      .returning();
    if (!row) return res.status(404).json({ error: "category not found" });
    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting expense category");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Helper: ensure category has Fixed/Variable nature ───────────────────────
// Drives P&L Fixed-vs-Variable grouping. Aggregate nodes (level 0/1) have
// nature=null and can never carry a transaction.
async function assertLeafCategory(categoryCode: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const rows = await db.select().from(expenseCategoriesTable)
    .where(eq(expenseCategoriesTable.code, categoryCode)).limit(1);
  if (rows.length === 0) {
    return { ok: false, status: 400, error: `category '${categoryCode}' not found` };
  }
  const cat = rows[0];
  if (cat.nature !== "fixed" && cat.nature !== "variable") {
    return { ok: false, status: 400, error: `category '${categoryCode}' is an aggregate node — pick a leaf category with Fixed or Variable cost type` };
  }
  return { ok: true };
}

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

    return res.json(rows.map(r => ({
      ...r,
      amount:      toNum(r.amount),
      vatRate:     toNum(r.vatRate),
      vatAmount:   toNum(r.vatAmount),
      totalAmount: toNum(r.totalAmount),
    })));
  } catch (err) {
    req.log.error({ err }, "Error fetching expense transactions");
    return res.status(500).json({ error: "Internal server error" });
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
    // Force Fixed/Variable classification — aggregate categories are rejected.
    const leaf = await assertLeafCategory(String(categoryCode));
    if (!leaf.ok) return res.status(leaf.status).json({ error: leaf.error });

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

    return res.status(201).json({
      ...row,
      amount: toNum(row.amount), vatRate: toNum(row.vatRate),
      vatAmount: toNum(row.vatAmount), totalAmount: toNum(row.totalAmount),
    });
  } catch (err) {
    req.log.error({ err }, "Error creating expense transaction");
    return res.status(500).json({ error: "Internal server error" });
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

    // Force Fixed/Variable classification on edits too.
    if (categoryCode) {
      const leaf = await assertLeafCategory(String(categoryCode));
      if (!leaf.ok) return res.status(leaf.status).json({ error: leaf.error });
    }

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
    return res.json({
      ...row,
      amount: toNum(row.amount), vatRate: toNum(row.vatRate),
      vatAmount: toNum(row.vatAmount), totalAmount: toNum(row.totalAmount),
    });
  } catch (err) {
    req.log.error({ err }, "Error updating expense transaction");
    return res.status(500).json({ error: "Internal server error" });
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
    return res.json({ success: true, id });
  } catch (err) {
    req.log.error({ err }, "Error deleting expense transaction");
    return res.status(500).json({ error: "Internal server error" });
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

    return res.json({ month: month ?? null, fromDate: fromDate ?? null, toDate: toDate ?? null, tree: build(null) });
  } catch (err) {
    req.log.error({ err }, "Error fetching expense summary");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
