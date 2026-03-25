import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { restaurantsTable } from "./restaurants";

export const stockMovementsTable = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id).default(1),
  itemName: text("item_name").notNull(),
  category: text("category").notNull(),
  subCategory: text("sub_category"),
  unit: text("unit").notNull().default("unit"),
  // movementType: purchase | opening | consumption | transfer-in | transfer-out | adjustment
  movementType: text("movement_type").notNull(),
  // positive = stock in (purchase, transfer-in, adjustment+, opening)
  // negative = stock out (consumption, transfer-out, adjustment-)
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
  totalValue: numeric("total_value", { precision: 12, scale: 2 }).notNull().default("0"),
  movementDate: text("movement_date").notNull(),
  referenceType: text("reference_type"), // purchase | transfer | manual
  referenceId: integer("reference_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStockMovementSchema = createInsertSchema(stockMovementsTable).omit({ id: true, createdAt: true });
export type InsertStockMovement = z.infer<typeof insertStockMovementSchema>;
export type StockMovement = typeof stockMovementsTable.$inferSelect;
