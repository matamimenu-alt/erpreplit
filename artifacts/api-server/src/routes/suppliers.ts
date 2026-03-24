import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { suppliersTable, supplierProductsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { getRestaurantId } from "../lib/restaurant";

const router: IRouter = Router();

function toNum(v: unknown) {
  if (v == null) return null;
  return parseFloat(String(v));
}

function toSupplier(r: typeof suppliersTable.$inferSelect) {
  return {
    id: r.id,
    name: r.name,
    contactPerson: r.contactPerson ?? undefined,
    phone: r.phone ?? undefined,
    email: r.email ?? undefined,
    createdAt: r.createdAt.toISOString(),
  };
}

function toProduct(r: typeof supplierProductsTable.$inferSelect, supplierName: string) {
  const prev = toNum(r.previousPrice);
  const curr = toNum(r.currentPrice)!;
  const diff = prev != null ? +(curr - prev).toFixed(2) : 0;
  const pct = prev != null && prev !== 0 ? +((diff / prev) * 100).toFixed(2) : 0;
  return {
    id: r.id,
    supplierId: r.supplierId,
    supplierName,
    productName: r.productName,
    previousPrice: prev ?? undefined,
    currentPrice: curr,
    priceDifference: diff,
    priceChangePercent: pct,
    updatedAt: r.updatedAt.toISOString(),
  };
}

// GET /api/suppliers
router.get("/", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const records = await db.select().from(suppliersTable)
      .where(eq(suppliersTable.restaurantId, restaurantId))
      .orderBy(suppliersTable.name);
    res.json(records.map(toSupplier));
  } catch (err) {
    req.log.error({ err }, "Error listing suppliers");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/suppliers
router.post("/", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const { name, contactPerson, phone, email } = req.body;
    const [record] = await db
      .insert(suppliersTable)
      .values({ restaurantId, name, contactPerson, phone, email })
      .returning();
    res.status(201).json(toSupplier(record));
  } catch (err) {
    req.log.error({ err }, "Error creating supplier");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/suppliers/:id
router.put("/:id", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const id = parseInt(req.params.id);
    const { name, contactPerson, phone, email } = req.body;
    const [record] = await db
      .update(suppliersTable)
      .set({ name, contactPerson, phone, email })
      .where(and(eq(suppliersTable.id, id), eq(suppliersTable.restaurantId, restaurantId)))
      .returning();
    if (!record) return res.status(404).json({ error: "Not found" });
    res.json(toSupplier(record));
  } catch (err) {
    req.log.error({ err }, "Error updating supplier");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/suppliers/:id
router.delete("/:id", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const id = parseInt(req.params.id);
    await db.delete(supplierProductsTable).where(eq(supplierProductsTable.supplierId, id));
    await db.delete(suppliersTable).where(and(eq(suppliersTable.id, id), eq(suppliersTable.restaurantId, restaurantId)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting supplier");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/suppliers/price-comparison
router.get("/price-comparison", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const suppliers = await db.select().from(suppliersTable)
      .where(eq(suppliersTable.restaurantId, restaurantId));
    const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));
    const supplierIds = suppliers.map((s) => s.id);
    const products = await db.select().from(supplierProductsTable).orderBy(supplierProductsTable.productName);
    const filtered = products.filter((p) => p.supplierId != null && supplierIds.includes(p.supplierId));
    const result = filtered.map((p) => {
      const prev = toNum(p.previousPrice);
      const curr = toNum(p.currentPrice)!;
      const diff = prev != null ? +(curr - prev).toFixed(2) : 0;
      const pct = prev != null && prev !== 0 ? +((diff / prev) * 100).toFixed(2) : 0;
      return {
        supplierId: p.supplierId,
        supplierName: supplierMap.get(p.supplierId!) ?? "Unknown",
        productName: p.productName,
        previousPrice: prev ?? undefined,
        currentPrice: curr,
        priceDifference: diff,
        priceChangePercent: pct,
        trend: diff > 0 ? "up" : diff < 0 ? "down" : "stable",
      };
    });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error getting price comparison");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/supplier-products
router.get("/products", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const suppliers = await db.select().from(suppliersTable)
      .where(eq(suppliersTable.restaurantId, restaurantId));
    const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));
    const supplierIds = suppliers.map((s) => s.id);
    const products = await db.select().from(supplierProductsTable).orderBy(supplierProductsTable.productName);
    const filtered = products.filter((p) => p.supplierId != null && supplierIds.includes(p.supplierId));
    res.json(filtered.map((p) => toProduct(p, supplierMap.get(p.supplierId!) ?? "Unknown")));
  } catch (err) {
    req.log.error({ err }, "Error listing supplier products");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/supplier-products
router.post("/products", async (req, res) => {
  try {
    const { supplierId, productName, previousPrice, currentPrice } = req.body;
    const supplier = await db.select().from(suppliersTable).where(eq(suppliersTable.id, Number(supplierId))).limit(1);
    const [record] = await db
      .insert(supplierProductsTable)
      .values({
        supplierId: Number(supplierId),
        productName,
        previousPrice: previousPrice != null ? String(Number(previousPrice).toFixed(2)) : null,
        currentPrice: String(Number(currentPrice).toFixed(2)),
      })
      .returning();
    const supplierName = supplier[0]?.name ?? "Unknown";
    res.status(201).json(toProduct(record, supplierName));
  } catch (err) {
    req.log.error({ err }, "Error creating supplier product");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/supplier-products/:id
router.put("/products/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { supplierId, productName, previousPrice, currentPrice } = req.body;
    const [existing] = await db
      .select()
      .from(supplierProductsTable)
      .where(eq(supplierProductsTable.id, id))
      .limit(1);
    const newPrev = previousPrice != null ? String(Number(previousPrice).toFixed(2)) : (existing?.currentPrice ?? null);
    const [record] = await db
      .update(supplierProductsTable)
      .set({
        supplierId: Number(supplierId),
        productName,
        previousPrice: newPrev,
        currentPrice: String(Number(currentPrice).toFixed(2)),
      })
      .where(eq(supplierProductsTable.id, id))
      .returning();
    if (!record) return res.status(404).json({ error: "Not found" });
    const supplier = await db.select().from(suppliersTable).where(eq(suppliersTable.id, Number(supplierId))).limit(1);
    res.json(toProduct(record, supplier[0]?.name ?? "Unknown"));
  } catch (err) {
    req.log.error({ err }, "Error updating supplier product");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/supplier-products/:id
router.delete("/products/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(supplierProductsTable).where(eq(supplierProductsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting supplier product");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
