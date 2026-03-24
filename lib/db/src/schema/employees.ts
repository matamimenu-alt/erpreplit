import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  jobTitle: text("job_title").notNull(),
  salary: numeric("salary", { precision: 12, scale: 2 }).notNull(),
  iqamaExpiryDate: text("iqama_expiry_date"),
  iqamaRenewalDate: text("iqama_renewal_date"),
  lastTravelDate: text("last_travel_date"),
  vacationBalance: numeric("vacation_balance", { precision: 8, scale: 1 }).notNull().default("0"),
  accommodationCost: numeric("accommodation_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  medicalInsurance: numeric("medical_insurance", { precision: 12, scale: 2 }).notNull().default("0"),
  gosiInsurance: numeric("gosi_insurance", { precision: 12, scale: 2 }).notNull().default("0"),
  airTicketCost: numeric("air_ticket_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  totalMonthlyCost: numeric("total_monthly_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({ id: true, createdAt: true });
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employeesTable.$inferSelect;
