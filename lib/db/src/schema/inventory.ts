import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { restaurantsTable } from "./restaurants";

export const inventoryTable = pgTable("inventory", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id).default(1),
  month: text("month").notNull(), // YYYY-MM
  foodInventory: numeric("food_inventory", { precision: 12, scale: 2 }).notNull().default("0"),
  beverageInventory: numeric("beverage_inventory", { precision: 12, scale: 2 }).notNull().default("0"),
  generalInventory: numeric("general_inventory", { precision: 12, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInventorySchema = createInsertSchema(inventoryTable).omit({ id: true, createdAt: true });
export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type Inventory = typeof inventoryTable.$inferSelect;
