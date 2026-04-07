import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { restaurantsTable } from "./restaurants";

export const salesTable = pgTable("sales", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id).default(1),
  date: text("date").notNull(),

  // Payment channel breakdown
  cash: numeric("cash", { precision: 12, scale: 2 }).notNull().default("0"),
  card: numeric("card", { precision: 12, scale: 2 }).notNull().default("0"),
  app1: numeric("app1", { precision: 12, scale: 2 }).notNull().default("0"),
  app2: numeric("app2", { precision: 12, scale: 2 }).notNull().default("0"),
  app3: numeric("app3", { precision: 12, scale: 2 }).notNull().default("0"),
  app4: numeric("app4", { precision: 12, scale: 2 }).notNull().default("0"),
  app5: numeric("app5", { precision: 12, scale: 2 }).notNull().default("0"),
  app6: numeric("app6", { precision: 12, scale: 2 }).notNull().default("0"),

  // VAT mode: 'exclusive' (user enters ex-VAT) or 'inclusive' (user enters incl-VAT)
  vatMode: text("vat_mode").notNull().default("exclusive"),

  // Computed/stored totals
  totalRevenue: numeric("total_revenue", { precision: 12, scale: 2 }).notNull().default("0"),
  netSales: numeric("net_sales", { precision: 12, scale: 2 }).notNull().default("0"),
  outputVat: numeric("output_vat", { precision: 12, scale: 2 }).notNull().default("0"),

  // Cash management
  openingBalance: numeric("opening_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  cashExpenses: numeric("cash_expenses", { precision: 12, scale: 2 }).notNull().default("0"),
  pettyCash: numeric("petty_cash", { precision: 12, scale: 2 }).notNull().default("0"),
  closingBalance: numeric("closing_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  expectedClosing: numeric("expected_closing", { precision: 12, scale: 2 }).notNull().default("0"),
  cashDiscrepancy: numeric("cash_discrepancy", { precision: 12, scale: 2 }).notNull().default("0"),

  // Notes
  dailyNotes: text("daily_notes"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSaleSchema = createInsertSchema(salesTable).omit({ id: true, createdAt: true });
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof salesTable.$inferSelect;
