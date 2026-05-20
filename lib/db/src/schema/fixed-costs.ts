import { pgTable, serial, text, numeric, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";

export const fixedCostTemplatesTable = pgTable("fixed_cost_templates", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id).default(1),
  category: text("category").notNull(), // "staff-salaries"|"owner-drawings"|"apps-subscriptions"|"rent"|"utilities"|"other-fixed"
  name: text("name").notNull(),
  defaultAmount: numeric("default_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  vatType: text("vat_type").notNull().default("none"),
  vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).notNull().default("15.00"),
  // Expense nature — Fixed vs Variable. Defaults to 'fixed' because this
  // table is the legacy "fixed costs" table, but the field is overridable
  // for templates whose actual behaviour is variable (e.g. variable utilities).
  nature: text("nature").notNull().default("fixed"),    // 'fixed' | 'variable'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const fixedCostMonthlyValuesTable = pgTable("fixed_cost_monthly_values", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").notNull().references(() => fixedCostTemplatesTable.id, { onDelete: "cascade" }),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id).default(1),
  month: text("month").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  notes: text("notes"),
  createdBy: text("created_by").default("admin"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const monthlyClosingStatusTable = pgTable("monthly_closing_status", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id).default(1),
  month: text("month").notNull(),
  isLocked: boolean("is_locked").notNull().default(false),
  lockedBy: text("locked_by"),
  lockedAt: timestamp("locked_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const expenseAuditLogsTable = pgTable("expense_audit_logs", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id).default(1),
  templateId: integer("template_id").references(() => fixedCostTemplatesTable.id),
  templateName: text("template_name"),
  month: text("month"),
  action: text("action").notNull(),
  oldAmount: numeric("old_amount", { precision: 12, scale: 2 }),
  newAmount: numeric("new_amount", { precision: 12, scale: 2 }),
  changedBy: text("changed_by").default("admin"),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
  notes: text("notes"),
});

export type FixedCostTemplate = typeof fixedCostTemplatesTable.$inferSelect;
export type FixedCostMonthlyValue = typeof fixedCostMonthlyValuesTable.$inferSelect;
export type MonthlyClosingStatus = typeof monthlyClosingStatusTable.$inferSelect;
export type ExpenseAuditLog = typeof expenseAuditLogsTable.$inferSelect;
