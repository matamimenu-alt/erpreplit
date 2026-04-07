import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { restaurantsTable } from "./restaurants";

export const salesAppConfigTable = pgTable("sales_app_config", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id).default(1),
  app1Name: text("app1_name").notNull().default("HungerStation"),
  app2Name: text("app2_name").notNull().default("Jahez"),
  app3Name: text("app3_name").notNull().default("Noon Food"),
  app4Name: text("app4_name").notNull().default("Talabat"),
  app5Name: text("app5_name").notNull().default("App 5"),
  app6Name: text("app6_name").notNull().default("App 6"),
  defaultVatMode: text("default_vat_mode").notNull().default("exclusive"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSalesAppConfigSchema = createInsertSchema(salesAppConfigTable).omit({ id: true, updatedAt: true });
export type InsertSalesAppConfig = z.infer<typeof insertSalesAppConfigSchema>;
export type SalesAppConfig = typeof salesAppConfigTable.$inferSelect;
