import { pgTable, serial, integer, boolean, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";

/**
 * Per-restaurant configuration for the AI Invoice Import feature.
 * One row per restaurant; created lazily with defaults on first read.
 */
export const aiInvoiceSettingsTable = pgTable("ai_invoice_settings", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id).default(1),
  // Master switch for the OCR/AI extraction step.
  ocrEnabled: boolean("ocr_enabled").notNull().default(true),
  // Allow the review screen to create a supplier that doesn't exist yet.
  autoCreateSupplier: boolean("auto_create_supplier").notNull().default(true),
  // Allow the review screen to create products that don't exist yet.
  autoCreateProduct: boolean("auto_create_product").notNull().default(true),
  // Fields whose confidence is below this threshold are highlighted for review.
  confidenceThreshold: integer("confidence_threshold").notNull().default(85),
  // Which extraction provider to use. "auto" resolves to the configured
  // provider at runtime (Anthropic when a key is present, else the mock).
  provider: text("provider").notNull().default("auto"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AiInvoiceSettings = typeof aiInvoiceSettingsTable.$inferSelect;
