import { Router } from "express";
import { db } from "@workspace/db";
import { restaurantsTable } from "@workspace/db/schema";
import { eq, ne } from "drizzle-orm";

const router = Router();

const SEED_RESTAURANTS = [
  { name: "Asad Al-Hamra",  nameAr: "أسد الحمراء",  brandName: "Asad Al-Hamra", branchCode: "AAH-01", city: "Riyadh",  status: "active" },
  { name: "Sabah Al-El",    nameAr: "صباح العل",     brandName: "Sabah Al-El",   branchCode: "SAE-01", city: "Riyadh",  status: "active" },
  { name: "Chicken Bar",    nameAr: "تشيكن بار",     brandName: "Chicken Bar",   branchCode: "CHB-01", city: "Jeddah",  status: "active" },
];

export async function seedRestaurants() {
  const existing = await db.select().from(restaurantsTable);
  if (existing.length > 0) return;
  for (const r of SEED_RESTAURANTS) {
    await db.insert(restaurantsTable).values(r);
  }
}

// ── GET /api/restaurants — list active+inactive (exclude archived) by default ──
router.get("/", async (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === "true";
    let rows = await db.select().from(restaurantsTable);
    if (!includeArchived) {
      rows = rows.filter(r => r.status !== "archived");
    }
    rows.sort((a, b) => a.id - b.id);
    return res.json(rows);
  } catch (err) {
    req.log?.error({ err });
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/restaurants — create new branch ──────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { name, nameAr, brandName, branchCode, city, address, phone, taxNumber, status } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "name is required" });
    const [row] = await db.insert(restaurantsTable).values({
      name: name.trim(),
      nameAr: nameAr || null,
      brandName: brandName || null,
      branchCode: branchCode || null,
      city: city || null,
      address: address || null,
      phone: phone || null,
      taxNumber: taxNumber || null,
      status: status ?? "active",
    }).returning();
    return res.status(201).json(row);
  } catch (err) {
    req.log?.error({ err });
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /api/restaurants/:id — update branch ───────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "invalid id" });
    const { name, nameAr, brandName, branchCode, city, address, phone, taxNumber, status } = req.body;
    const [row] = await db.update(restaurantsTable)
      .set({
        ...(name       !== undefined && { name: name.trim() }),
        ...(nameAr     !== undefined && { nameAr }),
        ...(brandName  !== undefined && { brandName }),
        ...(branchCode !== undefined && { branchCode }),
        ...(city       !== undefined && { city }),
        ...(address    !== undefined && { address }),
        ...(phone      !== undefined && { phone }),
        ...(taxNumber  !== undefined && { taxNumber }),
        ...(status     !== undefined && { status }),
      })
      .where(eq(restaurantsTable.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "not found" });
    return res.json(row);
  } catch (err) {
    req.log?.error({ err });
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── PATCH /api/restaurants/:id/status — set status ────────────────────────────
router.patch("/:id/status", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "invalid id" });
    const { status } = req.body;
    if (!["active", "inactive", "archived"].includes(status)) {
      return res.status(400).json({ error: "invalid status" });
    }
    const [row] = await db.update(restaurantsTable)
      .set({ status })
      .where(eq(restaurantsTable.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "not found" });
    return res.json(row);
  } catch (err) {
    req.log?.error({ err });
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── DELETE /api/restaurants/:id — soft delete (archive) ───────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "invalid id" });
    const [row] = await db.update(restaurantsTable)
      .set({ status: "archived" })
      .where(eq(restaurantsTable.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "not found" });
    return res.json({ success: true, id });
  } catch (err) {
    req.log?.error({ err });
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/restaurants/group/summary — consolidated KPIs across all active branches
router.get("/group/summary", async (req, res) => {
  try {
    const month = req.query.month as string | undefined;
    const { salesTable, purchasesTable, employeesTable } = await import("@workspace/db/schema");
    const { computeVatSummary } = await import("../lib/vat-engine");

    const activeRestaurants = await db.select().from(restaurantsTable)
      .where(ne(restaurantsTable.status, "archived"));

    const results = await Promise.all(activeRestaurants.map(async (r) => {
      let sales = await db.select().from(salesTable).where(eq(salesTable.restaurantId, r.id));
      let purchases = await db.select().from(purchasesTable).where(eq(purchasesTable.restaurantId, r.id));
      const employees = await db.select().from(employeesTable).where(eq(employeesTable.restaurantId, r.id));

      if (month) {
        sales     = sales.filter(s => s.date.startsWith(month));
        purchases = purchases.filter(p => p.date.startsWith(month));
      }

      const toNum = (v: unknown) => parseFloat(String(v)) || 0;
      const revenue   = sales.reduce((s, r) => s + toNum(r.netSales), 0);
      const purchases_ = purchases.reduce((s, p) => s + toNum(p.amountBeforeVat), 0);
      const salaries  = employees.reduce((s, e) => s + toNum(e.totalMonthlyCost), 0);
      // Legacy `expenses` table deprecated — Expenses Management module is the source.
      const fixed     = 0;

      // VAT — UNIFIED via lib/vat-engine.ts (same engine as /vat/report, P&L,
      // dashboard). Exposed here for cross-referencing the Zakat & VAT module
      // ONLY — Net Profit must NOT subtract VAT (accounting rule: VAT is a
      // pass-through liability, P&L lines are already Net/VAT-exclusive).
      const vat = await computeVatSummary({ restaurantId: r.id, month: month ?? null });
      const outputVat = vat.outputVat;
      const inputVat  = vat.inputVatRaw;
      const vatPayable = vat.netVatPayable;
      const profit = revenue - purchases_ - salaries - fixed;     // VAT-exclusive net profit

      return {
        restaurantId:   r.id,
        restaurantName: r.name,
        brandName:      r.brandName ?? r.name,
        city:           r.city ?? "",
        status:         r.status,
        branchCode:     r.branchCode ?? "",
        revenue:        +revenue.toFixed(2),
        purchases:      +purchases_.toFixed(2),
        salaries:       +salaries.toFixed(2),
        fixedExpenses:  +fixed.toFixed(2),
        outputVat:      +outputVat.toFixed(2),
        inputVat:       +inputVat.toFixed(2),
        adjustedInputVat: vat.adjustedInputVat,
        vatPayable:     +vatPayable.toFixed(2),
        profit:         +profit.toFixed(2),
      };
    }));

    const totalRevenue  = results.reduce((s, r) => s + r.revenue, 0);
    // Group total expenses — VAT-exclusive (matches P&L rule: VAT is not an expense).
    const totalExpenses = results.reduce((s, r) => s + r.purchases + r.salaries + r.fixedExpenses, 0);
    const totalProfit   = results.reduce((s, r) => s + r.profit, 0);

    const sorted = [...results].sort((a, b) => b.profit - a.profit);
    const best   = sorted[0] ?? null;
    const worst  = sorted[sorted.length - 1] ?? null;

    return res.json({
      month:          month ?? "all",
      totalRevenue:   +totalRevenue.toFixed(2),
      totalExpenses:  +totalExpenses.toFixed(2),
      totalProfit:    +totalProfit.toFixed(2),
      bestBranch:     best,
      worstBranch:    worst,
      branches:       results,
    });
  } catch (err) {
    req.log?.error({ err });
    return res.status(500).json({ error: "Internal server error" });
  }
});

export { router as restaurantsRouter };
