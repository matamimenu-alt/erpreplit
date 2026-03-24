import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { restaurantsTable } from "./restaurants";

export const salesTable = pgTable("sales", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id).default(1),
  date: text("date").notNull(),
  foodSales: numeric("food_sales", { precision: 12, scale: 2 }).notNull(),
  beverageSales: numeric("beverage_sales", { precision: 12, scale: 2 }).notNull(),
  totalSales: numeric("total_sales", { precision: 12, scale: 2 }).notNull(),
  outputVat: numeric("output_vat", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSaleSchema = createInsertSchema(salesTable).omit({ id: true, createdAt: true });
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof salesTable.$inferSelect;
