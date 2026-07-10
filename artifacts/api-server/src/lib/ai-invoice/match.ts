import { db } from "@workspace/db";
import { suppliersTable, purchasesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export type SupplierMatch = {
  exists: boolean;
  supplierId: number | null;
  matchedName: string | null;
};

export type ProductMatch = {
  exists: boolean;
  matchedName: string | null;
  category: string | null;
  unit: string | null;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, " ").trim();

/** Find an existing supplier for this restaurant whose name matches (fuzzy). */
export async function matchSupplier(restaurantId: number, name: string | null): Promise<SupplierMatch> {
  if (!name) return { exists: false, supplierId: null, matchedName: null };
  const suppliers = await db.select().from(suppliersTable).where(eq(suppliersTable.restaurantId, restaurantId));
  const target = norm(name);
  const hit = suppliers.find((s) => {
    const sn = norm(s.name);
    return sn === target || sn.includes(target) || target.includes(sn);
  });
  return hit
    ? { exists: true, supplierId: hit.id, matchedName: hit.name }
    : { exists: false, supplierId: null, matchedName: null };
}

/**
 * Match extracted item names against products already seen in this restaurant's
 * purchase history, so known products auto-select and unknown ones surface as
 * "New Product". Returns the latest category/unit for a matched product.
 */
export async function buildProductMatcher(restaurantId: number) {
  const rows = await db
    .select({
      productName: purchasesTable.productName,
      category: purchasesTable.category,
      unit: purchasesTable.unit,
      date: purchasesTable.date,
    })
    .from(purchasesTable)
    .where(eq(purchasesTable.restaurantId, restaurantId));

  // Latest row per normalized product name.
  const byName = new Map<string, { name: string; category: string; unit: string; date: string }>();
  for (const r of rows) {
    if (!r.productName) continue;
    const key = norm(r.productName);
    const prev = byName.get(key);
    if (!prev || r.date > prev.date) {
      byName.set(key, { name: r.productName, category: r.category, unit: r.unit, date: r.date });
    }
  }

  return (name: string | null): ProductMatch => {
    if (!name) return { exists: false, matchedName: null, category: null, unit: null };
    const target = norm(name);
    let hit = byName.get(target);
    if (!hit) {
      for (const [k, v] of byName) {
        if (k.includes(target) || target.includes(k)) { hit = v; break; }
      }
    }
    return hit
      ? { exists: true, matchedName: hit.name, category: hit.category, unit: hit.unit }
      : { exists: false, matchedName: null, category: null, unit: null };
  };
}
