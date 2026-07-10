import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { inventoryTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { getRestaurantId } from "../lib/restaurant";

const router: IRouter = Router();

function toNum(v: unknown) { return parseFloat(String(v)) || 0; }

function toRecord(r: typeof inventoryTable.$inferSelect) {
  return {
    id: r.id,
    month: r.month,
    foodInventory: toNum(r.foodInventory),
    beverageInventory: toNum(r.beverageInventory),
    generalInventory: toNum(r.generalInventory),
    notes: r.notes ?? undefined,
    createdAt: r.createdAt.toISOString(),
  };
}

// GET /api/inventory?month=YYYY-MM
router.get("/", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const month = req.query.month as string;
    if (!month) return res.status(400).json({ error: "month query param required" });

    const [record] = await db.select().from(inventoryTable)
      .where(and(eq(inventoryTable.restaurantId, restaurantId), eq(inventoryTable.month, month)));

    if (!record) {
      return res.json({ id: 0, month, foodInventory: 0, beverageInventory: 0, generalInventory: 0, createdAt: new Date().toISOString() });
    }
    return res.json(toRecord(record));
  } catch (err) {
    req.log.error({ err }, "Error getting inventory");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/inventory — upsert
router.put("/", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const { month, foodInventory, beverageInventory, generalInventory, notes } = req.body;
    if (!month) return res.status(400).json({ error: "month required" });

    const [existing] = await db.select().from(inventoryTable)
      .where(and(eq(inventoryTable.restaurantId, restaurantId), eq(inventoryTable.month, month)));

    if (existing) {
      const [updated] = await db.update(inventoryTable)
        .set({
          foodInventory: String(Number(foodInventory || 0).toFixed(2)),
          beverageInventory: String(Number(beverageInventory || 0).toFixed(2)),
          generalInventory: String(Number(generalInventory || 0).toFixed(2)),
          notes: notes || null,
        })
        .where(eq(inventoryTable.id, existing.id))
        .returning();
      return res.json(toRecord(updated));
    }

    const [created] = await db.insert(inventoryTable)
      .values({
        restaurantId,
        month,
        foodInventory: String(Number(foodInventory || 0).toFixed(2)),
        beverageInventory: String(Number(beverageInventory || 0).toFixed(2)),
        generalInventory: String(Number(generalInventory || 0).toFixed(2)),
        notes: notes || null,
      })
      .returning();
    return res.json(toRecord(created));
  } catch (err) {
    req.log.error({ err }, "Error upserting inventory");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
