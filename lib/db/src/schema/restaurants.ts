import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const RESTAURANT_STATUS = ["active", "inactive", "archived"] as const;
export type RestaurantStatus = typeof RESTAURANT_STATUS[number];

export const restaurantsTable = pgTable("restaurants", {
  id:          serial("id").primaryKey(),
  name:        text("name").notNull(),
  nameAr:      text("name_ar"),
  brandName:   text("brand_name"),
  branchCode:  text("branch_code"),
  city:        text("city"),
  address:     text("address"),
  phone:       text("phone"),
  taxNumber:   text("tax_number"),
  status:      text("status").notNull().default("active"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

export const insertRestaurantSchema = createInsertSchema(restaurantsTable)
  .omit({ id: true, createdAt: true })
  .extend({ status: z.enum(RESTAURANT_STATUS).optional() });

export const updateRestaurantSchema = insertRestaurantSchema.partial();

export type InsertRestaurant = z.infer<typeof insertRestaurantSchema>;
export type UpdateRestaurant = z.infer<typeof updateRestaurantSchema>;
export type Restaurant      = typeof restaurantsTable.$inferSelect;
