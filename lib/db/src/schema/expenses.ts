import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { restaurantsTable } from "./restaurants";

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id).default(1),
  category: text("category").notNull().default("fixed"), // "fixed" | "app-commission"
  name: text("name").notNull(),
  monthlyCost: numeric("monthly_cost", { precision: 12, scale: 2 }).notNull(),
  notes: text("notes"),
  contractStartDate: text("contract_start_date"),
  contractEndDate: text("contract_end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertExpenseSchema = createInsertSchema(expensesTable).omit({ id: true, createdAt: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expensesTable.$inferSelect;
