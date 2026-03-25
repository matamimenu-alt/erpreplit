import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { restaurantsTable } from "./restaurants";

export const branchTransfersTable = pgTable("branch_transfers", {
  id: serial("id").primaryKey(),
  fromRestaurantId: integer("from_restaurant_id").notNull().references(() => restaurantsTable.id),
  toRestaurantId: integer("to_restaurant_id").notNull().references(() => restaurantsTable.id),
  itemName: text("item_name").notNull(),
  category: text("category").notNull(),
  subCategory: text("sub_category"),
  unit: text("unit").notNull().default("unit"),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
  referenceNumber: text("reference_number"),
  transferDate: text("transfer_date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBranchTransferSchema = createInsertSchema(branchTransfersTable).omit({ id: true, createdAt: true });
export type InsertBranchTransfer = z.infer<typeof insertBranchTransferSchema>;
export type BranchTransfer = typeof branchTransfersTable.$inferSelect;
