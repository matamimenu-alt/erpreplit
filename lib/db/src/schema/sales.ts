import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { restaurantsTable } from "./restaurants";

export const salesTable = pgTable("sales", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id).default(1),
  date: text("date").notNull(),

  // Channel breakdown — Food & Beverage per channel
  dineInFood: numeric("dine_in_food", { precision: 12, scale: 2 }).notNull().default("0"),
  dineInBeverage: numeric("dine_in_beverage", { precision: 12, scale: 2 }).notNull().default("0"),
  takeawayFood: numeric("takeaway_food", { precision: 12, scale: 2 }).notNull().default("0"),
  takeawayBeverage: numeric("takeaway_beverage", { precision: 12, scale: 2 }).notNull().default("0"),
  deliveryFood: numeric("delivery_food", { precision: 12, scale: 2 }).notNull().default("0"),
  deliveryBeverage: numeric("delivery_beverage", { precision: 12, scale: 2 }).notNull().default("0"),
  appSalesFood: numeric("app_sales_food", { precision: 12, scale: 2 }).notNull().default("0"),
  appSalesBeverage: numeric("app_sales_beverage", { precision: 12, scale: 2 }).notNull().default("0"),

  // Computed totals (stored for easy querying)
  foodSales: numeric("food_sales", { precision: 12, scale: 2 }).notNull().default("0"),
  beverageSales: numeric("beverage_sales", { precision: 12, scale: 2 }).notNull().default("0"),
  totalSales: numeric("total_sales", { precision: 12, scale: 2 }).notNull().default("0"),
  outputVat: numeric("output_vat", { precision: 12, scale: 2 }).notNull().default("0"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSaleSchema = createInsertSchema(salesTable).omit({ id: true, createdAt: true });
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof salesTable.$inferSelect;
