/**
 * Provider-agnostic contract for AI invoice extraction.
 *
 * Business logic (validation, supplier/product matching, the review screen,
 * the final save into purchases) depends only on these types — never on a
 * concrete provider. To add a new AI provider, implement `InvoiceProvider`
 * and register it in `provider.ts`; nothing else changes.
 */

/** A single extracted value plus the model's confidence (0–100). */
export type Field<T> = {
  value: T | null;
  confidence: number; // 0..100
};

export type ExtractedItem = {
  name: Field<string>;
  quantity: Field<number>;
  unit: Field<string>;
  unitPrice: Field<number>;
  discount: Field<number>;
  vat: Field<number>;
  lineTotal: Field<number>;
};

/** The raw, model-produced invoice understanding — before any DB matching. */
export type InvoiceExtraction = {
  supplierName: Field<string>;
  invoiceNumber: Field<string>;
  invoiceDate: Field<string>; // ISO YYYY-MM-DD when the model can normalize it
  currency: Field<string>;
  vatNumber: Field<string>;
  subtotal: Field<number>;
  vat: Field<number>;
  discount: Field<number>;
  grandTotal: Field<number>;
  paymentMethod: Field<string>;
  items: ExtractedItem[];
};

export type InvoiceFileInput = {
  /** Raw base64 (no data: prefix). */
  base64: string;
  /** e.g. image/jpeg, image/png, image/webp, application/pdf. */
  mimeType: string;
};

export interface InvoiceProvider {
  /** Stable identifier surfaced to the client (e.g. "anthropic", "mock"). */
  readonly id: string;
  extract(input: InvoiceFileInput): Promise<InvoiceExtraction>;
}
