import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { dishesTable, dishIngredientsTable, pricingConfigTable, purchasesTable, fixedCostTemplatesTable, fixedCostMonthlyValuesTable, employeesTable } from "@workspace/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { getRestaurantId } from "../lib/restaurant";

const router: IRouter = Router();

function toNum(v: unknown): number {
  return parseFloat(String(v)) || 0;
}

function toPsychological(price: number): number {
  if (price <= 0) return 0;
  const base = Math.ceil(price);
  const candidate = base - 0.1;
  return candidate >= price ? +candidate.toFixed(2) : +(base + 0.9).toFixed(2);
}

async function getOrCreateConfig(restaurantId: number) {
  const existing = await db.select().from(pricingConfigTable).where(eq(pricingConfigTable.restaurantId, restaurantId)).limit(1);
  if (existing.length > 0) return existing[0];
  const created = await db.insert(pricingConfigTable).values({ restaurantId }).returning();
  return created[0];
}

async function computePricing(restaurantId: number) {
  // Fixed costs come from the unified Expenses Management module
  // (fixed_cost_templates + per-month overrides). Salaries are counted via the
  // payroll/employees module, so we EXCLUDE the 'staff-salaries' template
  // category here to avoid double-counting.
  const [config, fixedTemplates, fixedOverrides, employees] = await Promise.all([
    getOrCreateConfig(restaurantId),
    db.select().from(fixedCostTemplatesTable).where(and(
      eq(fixedCostTemplatesTable.restaurantId, restaurantId),
      eq(fixedCostTemplatesTable.isActive, true),
    )),
    db.select().from(fixedCostMonthlyValuesTable).where(eq(fixedCostMonthlyValuesTable.restaurantId, restaurantId)),
    db.select().from(employeesTable).where(eq(employeesTable.restaurantId, restaurantId)),
  ]);

  // For pricing we use the template's default monthly amount (representative
  // recurring cost). If you need month-specific pricing, swap to the override
  // for the current month here.
  const totalExpenses = fixedTemplates
    .filter(t => t.category !== "staff-salaries")
    .reduce((s, t) => s + toNum(t.defaultAmount), 0);
  void fixedOverrides; // reserved for future per-month pricing
  const totalSalaries = employees.reduce((s, e) => s + toNum(e.totalMonthlyCost), 0);
  const totalFixedCosts = totalExpenses + totalSalaries;
  const monthlyOrders = config.monthlyOrders || 1000;
  const fixedCostPerDish = totalFixedCosts / monthlyOrders;
  const deliveryCostPerOrder = toNum(config.deliveryCostPerOrder);
  const deliveryCommissionPct = toNum(config.deliveryCommissionPct);

  // Get latest unit price per product from purchases for this restaurant
  const purchaseRows = await db
    .select({
      productName: purchasesTable.productName,
      unitPrice: sql<string>`(${purchasesTable.amountBeforeVat} / NULLIF(${purchasesTable.quantity}, 0))`,
      date: purchasesTable.date,
    })
    .from(purchasesTable)
    .where(eq(purchasesTable.restaurantId, restaurantId))
    .orderBy(desc(purchasesTable.date));

  // Build map: productName (lowercase) → latest unit price
  const priceMap = new Map<string, number>();
  for (const row of purchaseRows) {
    const key = row.productName.toLowerCase().trim();
    if (!priceMap.has(key)) {
      priceMap.set(key, toNum(row.unitPrice));
    }
  }

  // Get all dishes with their ingredients
  const dishes = await db.select().from(dishesTable).where(eq(dishesTable.restaurantId, restaurantId));
  const ingredients = dishes.length > 0
    ? await db.select().from(dishIngredientsTable).where(
        sql`${dishIngredientsTable.dishId} IN (${sql.join(dishes.map(d => sql`${d.id}`), sql`, `)})`
      )
    : [];

  const ingByDish = new Map<number, typeof ingredients>();
  for (const ing of ingredients) {
    if (!ingByDish.has(ing.dishId)) ingByDish.set(ing.dishId, []);
    ingByDish.get(ing.dishId)!.push(ing);
  }

  return {
    config: {
      monthlyOrders: config.monthlyOrders,
      deliveryCostPerOrder: deliveryCostPerOrder,
      deliveryCommissionPct: deliveryCommissionPct,
    },
    fixedCostSummary: {
      totalExpenses: +totalExpenses.toFixed(2),
      totalSalaries: +totalSalaries.toFixed(2),
      totalFixedCosts: +totalFixedCosts.toFixed(2),
      fixedCostPerDish: +fixedCostPerDish.toFixed(4),
    },
    dishes: dishes.map(dish => {
      const dishIngredients = ingByDish.get(dish.id) ?? [];
      const wastePercentage = toNum(dish.wastePercentage);
      const targetFoodCostPct = toNum(dish.targetFoodCostPct);

      const ingredientBreakdown = dishIngredients.map(ing => {
        const key = ing.ingredientName.toLowerCase().trim();
        const unitPrice = priceMap.get(key) ?? 0;
        const cost = toNum(ing.quantityPerDish) * unitPrice;
        return {
          id: ing.id,
          ingredientName: ing.ingredientName,
          unit: ing.unit,
          quantityPerDish: toNum(ing.quantityPerDish),
          unitPrice: +unitPrice.toFixed(4),
          cost: +cost.toFixed(4),
          found: priceMap.has(key),
        };
      });

      const ingredientCost = ingredientBreakdown.reduce((s, i) => s + i.cost, 0);
      const wasteCost = ingredientCost * (wastePercentage / 100);
      const totalIngredientCost = ingredientCost + wasteCost;
      const finalDishCost = totalIngredientCost + fixedCostPerDish + deliveryCostPerOrder;

      const suggestedDineInPrice = targetFoodCostPct > 0 ? finalDishCost / (targetFoodCostPct / 100) : 0;
      const deliveryAppPrice = (1 - deliveryCommissionPct / 100) > 0
        ? suggestedDineInPrice / (1 - deliveryCommissionPct / 100)
        : suggestedDineInPrice;

      const foodCostPct = suggestedDineInPrice > 0 ? (finalDishCost / suggestedDineInPrice) * 100 : 0;
      const profitMarginPct = 100 - foodCostPct;

      return {
        id: dish.id,
        name: dish.name,
        category: dish.category,
        wastePercentage,
        targetFoodCostPct,
        notes: dish.notes,
        ingredients: ingredientBreakdown,
        pricing: {
          ingredientCost: +ingredientCost.toFixed(2),
          wasteCost: +wasteCost.toFixed(2),
          totalIngredientCost: +totalIngredientCost.toFixed(2),
          fixedCostAllocation: +fixedCostPerDish.toFixed(2),
          deliveryCostAllocation: +deliveryCostPerOrder.toFixed(2),
          finalDishCost: +finalDishCost.toFixed(2),
          suggestedDineInPrice: +suggestedDineInPrice.toFixed(2),
          deliveryAppPrice: +deliveryAppPrice.toFixed(2),
          psychologicalDineInPrice: toPsychological(suggestedDineInPrice),
          psychologicalDeliveryPrice: toPsychological(deliveryAppPrice),
          foodCostPct: +foodCostPct.toFixed(2),
          profitMarginPct: +profitMarginPct.toFixed(2),
        },
      };
    }),
  };
}

// GET /api/dishes/pricing — full pricing breakdown
router.get("/pricing", async (req, res) => {
  const restaurantId = getRestaurantId(req);
  const result = await computePricing(restaurantId);
  return res.json(result);
});

// GET /api/dishes/config
router.get("/config", async (req, res) => {
  const restaurantId = getRestaurantId(req);
  const config = await getOrCreateConfig(restaurantId);
  return res.json({
    monthlyOrders: config.monthlyOrders,
    deliveryCostPerOrder: toNum(config.deliveryCostPerOrder),
    deliveryCommissionPct: toNum(config.deliveryCommissionPct),
  });
});

// PUT /api/dishes/config
router.put("/config", async (req, res) => {
  const restaurantId = getRestaurantId(req);
  const { monthlyOrders, deliveryCostPerOrder, deliveryCommissionPct } = req.body;
  const existing = await getOrCreateConfig(restaurantId);
  const updated = await db
    .update(pricingConfigTable)
    .set({
      ...(monthlyOrders !== undefined && { monthlyOrders: +monthlyOrders }),
      ...(deliveryCostPerOrder !== undefined && { deliveryCostPerOrder: String(deliveryCostPerOrder) }),
      ...(deliveryCommissionPct !== undefined && { deliveryCommissionPct: String(deliveryCommissionPct) }),
      updatedAt: new Date(),
    })
    .where(eq(pricingConfigTable.id, existing.id))
    .returning();
  return res.json({
    monthlyOrders: updated[0].monthlyOrders,
    deliveryCostPerOrder: toNum(updated[0].deliveryCostPerOrder),
    deliveryCommissionPct: toNum(updated[0].deliveryCommissionPct),
  });
});

// GET /api/dishes — list all dishes (without full pricing)
router.get("/", async (req, res) => {
  const restaurantId = getRestaurantId(req);
  const dishes = await db.select().from(dishesTable).where(eq(dishesTable.restaurantId, restaurantId));
  const ingredients = dishes.length > 0
    ? await db.select().from(dishIngredientsTable).where(
        sql`${dishIngredientsTable.dishId} IN (${sql.join(dishes.map(d => sql`${d.id}`), sql`, `)})`
      )
    : [];

  const ingByDish = new Map<number, typeof ingredients>();
  for (const ing of ingredients) {
    if (!ingByDish.has(ing.dishId)) ingByDish.set(ing.dishId, []);
    ingByDish.get(ing.dishId)!.push(ing);
  }

  return res.json(dishes.map(d => ({
    id: d.id,
    name: d.name,
    category: d.category,
    wastePercentage: toNum(d.wastePercentage),
    targetFoodCostPct: toNum(d.targetFoodCostPct),
    notes: d.notes,
    createdAt: d.createdAt.toISOString(),
    ingredients: (ingByDish.get(d.id) ?? []).map(i => ({
      id: i.id,
      ingredientName: i.ingredientName,
      unit: i.unit,
      quantityPerDish: toNum(i.quantityPerDish),
    })),
  })));
});

// POST /api/dishes
router.post("/", async (req, res) => {
  const restaurantId = getRestaurantId(req);
  const { name, category, wastePercentage, targetFoodCostPct, notes, ingredients } = req.body;
  const [dish] = await db.insert(dishesTable).values({
    restaurantId,
    name,
    category: category || "Main Course",
    wastePercentage: String(wastePercentage ?? 8),
    targetFoodCostPct: String(targetFoodCostPct ?? 25),
    notes: notes || null,
  }).returning();

  if (ingredients?.length) {
    await db.insert(dishIngredientsTable).values(
      ingredients.map((i: { ingredientName: string; unit: string; quantityPerDish: number }) => ({
        dishId: dish.id,
        ingredientName: i.ingredientName,
        unit: i.unit || "kg",
        quantityPerDish: String(i.quantityPerDish),
      }))
    );
  }

  return res.status(201).json({ id: dish.id, name: dish.name });
});

// PUT /api/dishes/:id
router.put("/:id", async (req, res) => {
  const restaurantId = getRestaurantId(req);
  const id = +req.params.id;
  const { name, category, wastePercentage, targetFoodCostPct, notes, ingredients } = req.body;

  const [dish] = await db
    .update(dishesTable)
    .set({
      ...(name !== undefined && { name }),
      ...(category !== undefined && { category }),
      ...(wastePercentage !== undefined && { wastePercentage: String(wastePercentage) }),
      ...(targetFoodCostPct !== undefined && { targetFoodCostPct: String(targetFoodCostPct) }),
      ...(notes !== undefined && { notes: notes || null }),
    })
    .where(and(eq(dishesTable.id, id), eq(dishesTable.restaurantId, restaurantId)))
    .returning();

  if (!dish) return res.status(404).json({ error: "Dish not found" });

  if (ingredients !== undefined) {
    await db.delete(dishIngredientsTable).where(eq(dishIngredientsTable.dishId, id));
    if (ingredients.length > 0) {
      await db.insert(dishIngredientsTable).values(
        ingredients.map((i: { ingredientName: string; unit: string; quantityPerDish: number }) => ({
          dishId: id,
          ingredientName: i.ingredientName,
          unit: i.unit || "kg",
          quantityPerDish: String(i.quantityPerDish),
        }))
      );
    }
  }

  return res.json({ id: dish.id, name: dish.name });
});

// DELETE /api/dishes/:id
router.delete("/:id", async (req, res) => {
  const restaurantId = getRestaurantId(req);
  const id = +req.params.id;
  await db.delete(dishesTable).where(and(eq(dishesTable.id, id), eq(dishesTable.restaurantId, restaurantId)));
  return res.json({ success: true });
});

// GET /api/dishes/products — list available products from purchases (for ingredient autocomplete)
router.get("/products", async (req, res) => {
  const restaurantId = getRestaurantId(req);
  const rows = await db
    .selectDistinct({ productName: purchasesTable.productName })
    .from(purchasesTable)
    .where(eq(purchasesTable.restaurantId, restaurantId));
  return res.json(rows.map(r => r.productName));
});

export default router;
