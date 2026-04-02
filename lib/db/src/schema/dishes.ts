import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { restaurantsTable } from "./restaurants";

export const dishesTable = pgTable("dishes", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id).default(1),
  name: text("name").notNull(),
  category: text("category").notNull().default("Main Course"),
  wastePercentage: numeric("waste_percentage", { precision: 5, scale: 2 }).notNull().default("8"),
  targetFoodCostPct: numeric("target_food_cost_pct", { precision: 5, scale: 2 }).notNull().default("25"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dishIngredientsTable = pgTable("dish_ingredients", {
  id: serial("id").primaryKey(),
  dishId: integer("dish_id").notNull().references(() => dishesTable.id, { onDelete: "cascade" }),
  ingredientName: text("ingredient_name").notNull(),
  unit: text("unit").notNull().default("kg"),
  quantityPerDish: numeric("quantity_per_dish", { precision: 12, scale: 4 }).notNull().default("1"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pricingConfigTable = pgTable("pricing_config", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id).default(1),
  monthlyOrders: integer("monthly_orders").notNull().default(1000),
  deliveryCostPerOrder: numeric("delivery_cost_per_order", { precision: 8, scale: 2 }).notNull().default("7"),
  deliveryCommissionPct: numeric("delivery_commission_pct", { precision: 5, scale: 2 }).notNull().default("25"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDishSchema = createInsertSchema(dishesTable).omit({ id: true, createdAt: true });
export const insertDishIngredientSchema = createInsertSchema(dishIngredientsTable).omit({ id: true, createdAt: true });
export const insertPricingConfigSchema = createInsertSchema(pricingConfigTable).omit({ id: true, updatedAt: true });

export type InsertDish = z.infer<typeof insertDishSchema>;
export type Dish = typeof dishesTable.$inferSelect;
export type DishIngredient = typeof dishIngredientsTable.$inferSelect;
export type InsertDishIngredient = z.infer<typeof insertDishIngredientSchema>;
export type PricingConfig = typeof pricingConfigTable.$inferSelect;
