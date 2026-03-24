import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { restaurantsTable } from "./restaurants";

export const suppliersTable = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id).default(1),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const supplierProductsTable = pgTable("supplier_products", {
  id: serial("id").primaryKey(),
  supplierId: serial("supplier_id").references(() => suppliersTable.id),
  productName: text("product_name").notNull(),
  previousPrice: numeric("previous_price", { precision: 12, scale: 2 }),
  currentPrice: numeric("current_price", { precision: 12, scale: 2 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSupplierSchema = createInsertSchema(suppliersTable).omit({ id: true, createdAt: true });
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliersTable.$inferSelect;

export const insertSupplierProductSchema = createInsertSchema(supplierProductsTable).omit({ id: true, updatedAt: true });
export type InsertSupplierProduct = z.infer<typeof insertSupplierProductSchema>;
export type SupplierProduct = typeof supplierProductsTable.$inferSelect;
