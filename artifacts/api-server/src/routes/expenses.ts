import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { expensesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { getRestaurantId } from "../lib/restaurant";

const router: IRouter = Router();

function toNum(v: unknown) {
  return parseFloat(String(v));
}

function toRecord(r: typeof expensesTable.$inferSelect) {
  return {
    id: r.id,
    name: r.name,
    monthlyCost: toNum(r.monthlyCost),
    contractStartDate: r.contractStartDate ?? undefined,
    contractEndDate: r.contractEndDate ?? undefined,
    createdAt: r.createdAt.toISOString(),
  };
}

// GET /api/expenses
router.get("/", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const records = await db.select().from(expensesTable)
      .where(eq(expensesTable.restaurantId, restaurantId))
      .orderBy(expensesTable.name);
    res.json(records.map(toRecord));
  } catch (err) {
    req.log.error({ err }, "Error listing expenses");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/expenses
router.post("/", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const { name, monthlyCost, contractStartDate, contractEndDate } = req.body;
    const [record] = await db
      .insert(expensesTable)
      .values({
        restaurantId,
        name,
        monthlyCost: String(Number(monthlyCost).toFixed(2)),
        contractStartDate: contractStartDate || null,
        contractEndDate: contractEndDate || null,
      })
      .returning();
    res.status(201).json(toRecord(record));
  } catch (err) {
    req.log.error({ err }, "Error creating expense");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/expenses/:id
router.put("/:id", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const id = parseInt(req.params.id);
    const { name, monthlyCost, contractStartDate, contractEndDate } = req.body;
    const [record] = await db
      .update(expensesTable)
      .set({
        name,
        monthlyCost: String(Number(monthlyCost).toFixed(2)),
        contractStartDate: contractStartDate || null,
        contractEndDate: contractEndDate || null,
      })
      .where(and(eq(expensesTable.id, id), eq(expensesTable.restaurantId, restaurantId)))
      .returning();
    if (!record) return res.status(404).json({ error: "Not found" });
    res.json(toRecord(record));
  } catch (err) {
    req.log.error({ err }, "Error updating expense");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/expenses/:id
router.delete("/:id", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const id = parseInt(req.params.id);
    await db.delete(expensesTable).where(and(eq(expensesTable.id, id), eq(expensesTable.restaurantId, restaurantId)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting expense");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
