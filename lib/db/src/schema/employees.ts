import { pgTable, serial, text, numeric, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { restaurantsTable } from "./restaurants";

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id).default(1),

  // Employee Information
  name: text("name").notNull(),
  designation: text("designation").notNull().default(""),
  fullTime: boolean("full_time").notNull().default(true),
  nationality: text("nationality").notNull().default(""),
  joiningDate: text("joining_date"),

  // Salary
  salary: numeric("salary", { precision: 12, scale: 2 }).notNull().default("0"),

  // Monthly Payroll Taxes
  socialSecurity: numeric("social_security", { precision: 12, scale: 2 }).notNull().default("0"),
  laborFees: numeric("labor_fees", { precision: 12, scale: 2 }).notNull().default("0"),
  iqamaRenewalYearly: numeric("iqama_renewal_yearly", { precision: 12, scale: 2 }).notNull().default("0"),

  // Benefits (Medical and Air Ticket are stored as YEARLY amounts, divided by 12 for monthly)
  medicalInsurance: numeric("medical_insurance", { precision: 12, scale: 2 }).notNull().default("0"),
  airTicketCost: numeric("air_ticket_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  foodMeal: numeric("food_meal", { precision: 12, scale: 2 }).notNull().default("0"),

  // Legacy / kept for backward compat
  jobTitle: text("job_title").notNull().default(""),
  iqamaExpiryDate: text("iqama_expiry_date"),
  iqamaRenewalDate: text("iqama_renewal_date"),
  lastTravelDate: text("last_travel_date"),
  vacationBalance: numeric("vacation_balance", { precision: 8, scale: 1 }).notNull().default("0"),
  accommodationCost: numeric("accommodation_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  gosiInsurance: numeric("gosi_insurance", { precision: 12, scale: 2 }).notNull().default("0"),

  // Computed totals (stored for easy P&L querying)
  totalMonthlyCost: numeric("total_monthly_cost", { precision: 12, scale: 2 }).notNull().default("0"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({ id: true, createdAt: true });
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employeesTable.$inferSelect;
