import { Router } from "express";
import { db } from "@workspace/db";
import { restaurantsTable } from "@workspace/db/schema";

const router = Router();

const SEED_RESTAURANTS = [
  { id: 1, name: "Asad Al-Hamra", nameAr: "أسد الحمراء" },
  { id: 2, name: "Sabah Al-El", nameAr: "صباح العل" },
  { id: 3, name: "Chicken Bar", nameAr: "تشيكن بار" },
];

export async function seedRestaurants() {
  const existing = await db.select().from(restaurantsTable);
  if (existing.length > 0) return; // already seeded, skip
  for (const r of SEED_RESTAURANTS) {
    await db.insert(restaurantsTable).values({ name: r.name, nameAr: r.nameAr });
  }
}

router.get("/", async (req, res) => {
  const restaurants = await db.select().from(restaurantsTable);
  res.json(restaurants);
});

export { router as restaurantsRouter };
