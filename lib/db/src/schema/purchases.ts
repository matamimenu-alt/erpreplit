import { pgTable, serial, text, numeric, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { restaurantsTable } from "./restaurants";

export const purchasesTable = pgTable("purchases", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id).default(1),
  date: text("date").notNull(),
  supplierName: text("supplier_name").notNull(),
  productName: text("product_name").notNull(),
  category: text("category").notNull().default("other"),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  priceIncludesVat: boolean("price_includes_vat").notNull().default(false),
  amountBeforeVat: numeric("amount_before_vat", { precision: 12, scale: 2 }).notNull(),
  vatAmount: numeric("vat_amount", { precision: 12, scale: 2 }).notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPurchaseSchema = createInsertSchema(purchasesTable).omit({ id: true, createdAt: true });
export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;
export type Purchase = typeof purchasesTable.$inferSelect;
