import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  fixedCostTemplatesTable,
  fixedCostMonthlyValuesTable,
  monthlyClosingStatusTable,
  expenseAuditLogsTable,
} from "@workspace/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { getRestaurantId } from "../lib/restaurant";

const router: IRouter = Router();

function toNum(v: unknown) {
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

function fmtAmt(v: number) {
  return String(v.toFixed(2));
}

// Helper: get effective amount for a template in a given month
async function getEffectiveAmount(templateId: number, restaurantId: number, month: string) {
  const [override] = await db
    .select()
    .from(fixedCostMonthlyValuesTable)
    .where(and(
      eq(fixedCostMonthlyValuesTable.templateId, templateId),
      eq(fixedCostMonthlyValuesTable.month, month),
    ));
  return override ?? null;
}

// Helper: is month locked?
async function isMonthLocked(restaurantId: number, month: string): Promise<boolean> {
  const [status] = await db
    .select()
    .from(monthlyClosingStatusTable)
    .where(and(
      eq(monthlyClosingStatusTable.restaurantId, restaurantId),
      eq(monthlyClosingStatusTable.month, month),
    ));
  return status?.isLocked ?? false;
}

// Helper: write audit log
async function writeAudit(data: {
  restaurantId: number;
  templateId?: number;
  templateName?: string;
  month?: string;
  action: string;
  oldAmount?: number | null;
  newAmount?: number | null;
  changedBy?: string;
  notes?: string;
}) {
  await db.insert(expenseAuditLogsTable).values({
    restaurantId: data.restaurantId,
    templateId: data.templateId ?? null,
    templateName: data.templateName ?? null,
    month: data.month ?? null,
    action: data.action,
    oldAmount: data.oldAmount != null ? fmtAmt(data.oldAmount) : null,
    newAmount: data.newAmount != null ? fmtAmt(data.newAmount) : null,
    changedBy: data.changedBy ?? "admin",
    notes: data.notes ?? null,
  });
}

// ─── TEMPLATES ───────────────────────────────────────────────────────────────

// GET /api/fixed-costs/templates
router.get("/templates", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const templates = await db
      .select()
      .from(fixedCostTemplatesTable)
      .where(eq(fixedCostTemplatesTable.restaurantId, restaurantId))
      .orderBy(fixedCostTemplatesTable.sortOrder, fixedCostTemplatesTable.id);
    res.json(templates.map(t => ({
      id: t.id,
      category: t.category,
      name: t.name,
      defaultAmount: toNum(t.defaultAmount),
      notes: t.notes ?? undefined,
      isActive: t.isActive,
      sortOrder: t.sortOrder,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Error listing fixed cost templates");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/fixed-costs/templates
router.post("/templates", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const { category, name, defaultAmount, notes, sortOrder } = req.body;
    const [t] = await db
      .insert(fixedCostTemplatesTable)
      .values({
        restaurantId,
        category,
        name,
        defaultAmount: fmtAmt(Number(defaultAmount) || 0),
        notes: notes || null,
        sortOrder: sortOrder ?? 0,
      })
      .returning();
    await writeAudit({
      restaurantId,
      templateId: t.id,
      templateName: t.name,
      action: "create_template",
      newAmount: toNum(t.defaultAmount),
    });
    res.status(201).json({
      id: t.id, category: t.category, name: t.name,
      defaultAmount: toNum(t.defaultAmount), notes: t.notes ?? undefined,
      isActive: t.isActive, sortOrder: t.sortOrder,
      createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error creating fixed cost template");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/fixed-costs/templates/:id
router.put("/templates/:id", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const id = parseInt(req.params.id);
    const { category, name, defaultAmount, notes, isActive, sortOrder } = req.body;

    const [existing] = await db
      .select()
      .from(fixedCostTemplatesTable)
      .where(and(eq(fixedCostTemplatesTable.id, id), eq(fixedCostTemplatesTable.restaurantId, restaurantId)));
    if (!existing) return res.status(404).json({ error: "Not found" });

    const oldAmt = toNum(existing.defaultAmount);
    const newAmt = Number(defaultAmount) ?? oldAmt;

    const [t] = await db
      .update(fixedCostTemplatesTable)
      .set({
        category: category ?? existing.category,
        name: name ?? existing.name,
        defaultAmount: fmtAmt(newAmt),
        notes: notes !== undefined ? (notes || null) : existing.notes,
        isActive: isActive !== undefined ? isActive : existing.isActive,
        sortOrder: sortOrder !== undefined ? sortOrder : existing.sortOrder,
        updatedAt: new Date(),
      })
      .where(and(eq(fixedCostTemplatesTable.id, id), eq(fixedCostTemplatesTable.restaurantId, restaurantId)))
      .returning();

    if (Math.abs(oldAmt - newAmt) > 0.001) {
      await writeAudit({
        restaurantId, templateId: t.id, templateName: t.name,
        action: "update_default", oldAmount: oldAmt, newAmount: newAmt,
      });
    }

    res.json({
      id: t.id, category: t.category, name: t.name,
      defaultAmount: toNum(t.defaultAmount), notes: t.notes ?? undefined,
      isActive: t.isActive, sortOrder: t.sortOrder,
      createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error updating fixed cost template");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/fixed-costs/templates/:id
router.delete("/templates/:id", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const id = parseInt(req.params.id);
    const [existing] = await db
      .select()
      .from(fixedCostTemplatesTable)
      .where(and(eq(fixedCostTemplatesTable.id, id), eq(fixedCostTemplatesTable.restaurantId, restaurantId)));
    if (!existing) return res.status(404).json({ error: "Not found" });
    await writeAudit({
      restaurantId, templateId: id, templateName: existing.name,
      action: "delete_template", oldAmount: toNum(existing.defaultAmount),
    });
    await db.delete(fixedCostTemplatesTable)
      .where(and(eq(fixedCostTemplatesTable.id, id), eq(fixedCostTemplatesTable.restaurantId, restaurantId)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting fixed cost template");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── MONTHLY VALUES ───────────────────────────────────────────────────────────

// GET /api/fixed-costs/monthly?month=YYYY-MM
router.get("/monthly", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const month = req.query.month as string;
    if (!month) return res.status(400).json({ error: "month param required" });

    const templates = await db
      .select()
      .from(fixedCostTemplatesTable)
      .where(and(eq(fixedCostTemplatesTable.restaurantId, restaurantId), eq(fixedCostTemplatesTable.isActive, true)))
      .orderBy(fixedCostTemplatesTable.sortOrder, fixedCostTemplatesTable.id);

    const overrides = await db
      .select()
      .from(fixedCostMonthlyValuesTable)
      .where(and(
        eq(fixedCostMonthlyValuesTable.restaurantId, restaurantId),
        eq(fixedCostMonthlyValuesTable.month, month),
      ));

    const [closingStatus] = await db
      .select()
      .from(monthlyClosingStatusTable)
      .where(and(
        eq(monthlyClosingStatusTable.restaurantId, restaurantId),
        eq(monthlyClosingStatusTable.month, month),
      ));

    const overrideMap = new Map(overrides.map(o => [o.templateId, o]));

    const items = templates.map(t => {
      const override = overrideMap.get(t.id);
      const defaultAmt = toNum(t.defaultAmount);
      const effectiveAmt = override ? toNum(override.amount) : defaultAmt;
      return {
        templateId: t.id,
        category: t.category,
        name: t.name,
        defaultAmount: defaultAmt,
        overrideAmount: override ? toNum(override.amount) : null,
        effectiveAmount: effectiveAmt,
        hasOverride: !!override,
        overrideNotes: override?.notes ?? null,
        overrideId: override?.id ?? null,
        notes: t.notes ?? null,
      };
    });

    res.json({
      month,
      isLocked: closingStatus?.isLocked ?? false,
      lockedBy: closingStatus?.lockedBy ?? null,
      lockedAt: closingStatus?.lockedAt?.toISOString() ?? null,
      total: +items.reduce((s, i) => s + i.effectiveAmount, 0).toFixed(2),
      items,
    });
  } catch (err) {
    req.log.error({ err }, "Error getting monthly fixed costs");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/fixed-costs/monthly — set/update override for a month
router.post("/monthly", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const { templateId, month, amount, notes, changedBy } = req.body;
    if (!templateId || !month) return res.status(400).json({ error: "templateId and month required" });

    const locked = await isMonthLocked(restaurantId, month);
    if (locked) return res.status(403).json({ error: "Month is locked — unlock it first." });

    const [template] = await db
      .select()
      .from(fixedCostTemplatesTable)
      .where(and(eq(fixedCostTemplatesTable.id, templateId), eq(fixedCostTemplatesTable.restaurantId, restaurantId)));
    if (!template) return res.status(404).json({ error: "Template not found" });

    const existing = await getEffectiveAmount(templateId, restaurantId, month);
    const oldAmt = existing ? toNum(existing.amount) : toNum(template.defaultAmount);
    const newAmt = Number(amount);

    // Upsert
    let record;
    if (existing) {
      [record] = await db
        .update(fixedCostMonthlyValuesTable)
        .set({ amount: fmtAmt(newAmt), notes: notes || null, createdBy: changedBy || "admin" })
        .where(and(
          eq(fixedCostMonthlyValuesTable.templateId, templateId),
          eq(fixedCostMonthlyValuesTable.month, month),
        ))
        .returning();
    } else {
      [record] = await db
        .insert(fixedCostMonthlyValuesTable)
        .values({ templateId, restaurantId, month, amount: fmtAmt(newAmt), notes: notes || null, createdBy: changedBy || "admin" })
        .returning();
    }

    await writeAudit({
      restaurantId, templateId, templateName: template.name, month,
      action: existing ? "update_override" : "set_override",
      oldAmount: oldAmt, newAmount: newAmt,
      changedBy: changedBy || "admin", notes,
    });

    res.json({
      id: record.id,
      templateId: record.templateId,
      month: record.month,
      amount: toNum(record.amount),
      notes: record.notes ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Error setting monthly override");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/fixed-costs/monthly/:templateId?month=YYYY-MM — remove override
router.delete("/monthly/:templateId", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const templateId = parseInt(req.params.templateId);
    const month = req.query.month as string;
    if (!month) return res.status(400).json({ error: "month query param required" });

    const locked = await isMonthLocked(restaurantId, month);
    if (locked) return res.status(403).json({ error: "Month is locked" });

    const [existing] = await db
      .select()
      .from(fixedCostMonthlyValuesTable)
      .where(and(
        eq(fixedCostMonthlyValuesTable.templateId, templateId),
        eq(fixedCostMonthlyValuesTable.month, month),
      ));
    if (!existing) return res.status(404).json({ error: "Override not found" });

    const [template] = await db
      .select()
      .from(fixedCostTemplatesTable)
      .where(eq(fixedCostTemplatesTable.id, templateId));

    await writeAudit({
      restaurantId, templateId, templateName: template?.name, month,
      action: "remove_override", oldAmount: toNum(existing.amount),
      newAmount: toNum(template?.defaultAmount ?? "0"),
    });

    await db.delete(fixedCostMonthlyValuesTable)
      .where(and(
        eq(fixedCostMonthlyValuesTable.templateId, templateId),
        eq(fixedCostMonthlyValuesTable.month, month),
      ));

    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error removing monthly override");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── HISTORY (for charts) ─────────────────────────────────────────────────────

// GET /api/fixed-costs/history?months=6
router.get("/history", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const numMonths = parseInt((req.query.months as string) ?? "6");

    // Build list of months (past N months including current)
    const months: string[] = [];
    const now = new Date();
    for (let i = numMonths - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    const templates = await db
      .select()
      .from(fixedCostTemplatesTable)
      .where(and(eq(fixedCostTemplatesTable.restaurantId, restaurantId), eq(fixedCostTemplatesTable.isActive, true)))
      .orderBy(fixedCostTemplatesTable.sortOrder);

    const allOverrides = await db
      .select()
      .from(fixedCostMonthlyValuesTable)
      .where(and(
        eq(fixedCostMonthlyValuesTable.restaurantId, restaurantId),
        inArray(fixedCostMonthlyValuesTable.month, months),
      ));

    const closingStatuses = await db
      .select()
      .from(monthlyClosingStatusTable)
      .where(and(
        eq(monthlyClosingStatusTable.restaurantId, restaurantId),
        inArray(monthlyClosingStatusTable.month, months),
      ));

    const overrideIndex = new Map<string, Map<number, number>>();
    for (const o of allOverrides) {
      if (!overrideIndex.has(o.month)) overrideIndex.set(o.month, new Map());
      overrideIndex.get(o.month)!.set(o.templateId, toNum(o.amount));
    }

    const lockIndex = new Map(closingStatuses.map(c => [c.month, c.isLocked]));

    const result = months.map(month => {
      const overrideMap = overrideIndex.get(month) ?? new Map<number, number>();
      const breakdown: Record<string, number> = {};
      let total = 0;
      const items = templates.map(t => {
        const amt = overrideMap.has(t.id) ? overrideMap.get(t.id)! : toNum(t.defaultAmount);
        breakdown[t.category] = (breakdown[t.category] ?? 0) + amt;
        total += amt;
        return { templateId: t.id, name: t.name, category: t.category, amount: +amt.toFixed(2), hasOverride: overrideMap.has(t.id) };
      });
      return {
        month,
        isLocked: lockIndex.get(month) ?? false,
        total: +total.toFixed(2),
        breakdown: Object.fromEntries(Object.entries(breakdown).map(([k, v]) => [k, +v.toFixed(2)])),
        items,
      };
    });

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error getting fixed cost history");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── CLOSING STATUS ───────────────────────────────────────────────────────────

// POST /api/fixed-costs/close-month
router.post("/close-month", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const { month, lockedBy, notes } = req.body;
    if (!month) return res.status(400).json({ error: "month required" });

    const [existing] = await db
      .select()
      .from(monthlyClosingStatusTable)
      .where(and(eq(monthlyClosingStatusTable.restaurantId, restaurantId), eq(monthlyClosingStatusTable.month, month)));

    if (existing) {
      await db.update(monthlyClosingStatusTable)
        .set({ isLocked: true, lockedBy: lockedBy || "admin", lockedAt: new Date(), notes: notes || null })
        .where(and(eq(monthlyClosingStatusTable.restaurantId, restaurantId), eq(monthlyClosingStatusTable.month, month)));
    } else {
      await db.insert(monthlyClosingStatusTable)
        .values({ restaurantId, month, isLocked: true, lockedBy: lockedBy || "admin", lockedAt: new Date(), notes: notes || null });
    }

    await writeAudit({
      restaurantId, month,
      action: "lock_month",
      changedBy: lockedBy || "admin",
      notes: notes || `Month ${month} locked`,
    });

    res.json({ month, isLocked: true });
  } catch (err) {
    req.log.error({ err }, "Error closing month");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/fixed-costs/unlock-month
router.post("/unlock-month", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const { month, unlockedBy, notes } = req.body;
    if (!month) return res.status(400).json({ error: "month required" });

    await db.update(monthlyClosingStatusTable)
      .set({ isLocked: false, lockedBy: null, lockedAt: null, notes: notes || null })
      .where(and(eq(monthlyClosingStatusTable.restaurantId, restaurantId), eq(monthlyClosingStatusTable.month, month)));

    await writeAudit({
      restaurantId, month,
      action: "unlock_month",
      changedBy: unlockedBy || "admin",
      notes: notes || `Month ${month} unlocked`,
    });

    res.json({ month, isLocked: false });
  } catch (err) {
    req.log.error({ err }, "Error unlocking month");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── AUDIT LOG ────────────────────────────────────────────────────────────────

// GET /api/fixed-costs/audit-log?limit=50
router.get("/audit-log", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const limit = parseInt((req.query.limit as string) ?? "100");
    const logs = await db
      .select()
      .from(expenseAuditLogsTable)
      .where(eq(expenseAuditLogsTable.restaurantId, restaurantId))
      .orderBy(desc(expenseAuditLogsTable.changedAt))
      .limit(limit);

    res.json(logs.map(l => ({
      id: l.id,
      templateId: l.templateId ?? null,
      templateName: l.templateName ?? null,
      month: l.month ?? null,
      action: l.action,
      oldAmount: l.oldAmount != null ? toNum(l.oldAmount) : null,
      newAmount: l.newAmount != null ? toNum(l.newAmount) : null,
      changedBy: l.changedBy ?? "admin",
      changedAt: l.changedAt.toISOString(),
      notes: l.notes ?? null,
    })));
  } catch (err) {
    req.log.error({ err }, "Error fetching audit log");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/fixed-costs/effective-total?month=YYYY-MM (for P&L integration)
router.get("/effective-total", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const month = req.query.month as string | undefined;

    const templates = await db
      .select()
      .from(fixedCostTemplatesTable)
      .where(and(eq(fixedCostTemplatesTable.restaurantId, restaurantId), eq(fixedCostTemplatesTable.isActive, true)));

    if (!month || templates.length === 0) {
      const total = templates.reduce((s, t) => s + toNum(t.defaultAmount), 0);
      const breakdown: Record<string, number> = {};
      for (const t of templates) {
        breakdown[t.category] = (breakdown[t.category] ?? 0) + toNum(t.defaultAmount);
      }
      return res.json({ total: +total.toFixed(2), breakdown, byTemplate: templates.map(t => ({ id: t.id, name: t.name, category: t.category, amount: toNum(t.defaultAmount) })) });
    }

    const overrides = await db
      .select()
      .from(fixedCostMonthlyValuesTable)
      .where(and(
        eq(fixedCostMonthlyValuesTable.restaurantId, restaurantId),
        eq(fixedCostMonthlyValuesTable.month, month),
      ));

    const overrideMap = new Map(overrides.map(o => [o.templateId, toNum(o.amount)]));
    let total = 0;
    const breakdown: Record<string, number> = {};
    const byTemplate = templates.map(t => {
      const amt = overrideMap.has(t.id) ? overrideMap.get(t.id)! : toNum(t.defaultAmount);
      breakdown[t.category] = (breakdown[t.category] ?? 0) + amt;
      total += amt;
      return { id: t.id, name: t.name, category: t.category, amount: +amt.toFixed(2) };
    });

    res.json({ total: +total.toFixed(2), breakdown: Object.fromEntries(Object.entries(breakdown).map(([k, v]) => [k, +v.toFixed(2)])), byTemplate });
  } catch (err) {
    req.log.error({ err }, "Error getting effective total");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
