import type { InvoiceProvider, InvoiceFileInput, InvoiceExtraction } from "./types";

/**
 * Deterministic offline provider used when no AI credentials are configured
 * (local dev, CI, self-hosting without a key). It returns a plausible,
 * arithmetically-consistent sample so the full review → save flow can be
 * exercised end-to-end without calling an external service.
 */
export class MockInvoiceProvider implements InvoiceProvider {
  readonly id = "mock";

  async extract(_input: InvoiceFileInput): Promise<InvoiceExtraction> {
    const f = <T,>(value: T | null, confidence: number) => ({ value, confidence });
    const items = [
      { name: "Chicken Breast", qty: 10, unit: "kg", price: 15 },
      { name: "Mineral Water", qty: 5, unit: "carton", price: 20 },
    ].map((i) => {
      const base = i.qty * i.price;
      const vat = +(base * 0.15).toFixed(2);
      return {
        name: f(i.name, 82),
        quantity: f(i.qty, 95),
        unit: f(i.unit, 88),
        unitPrice: f(i.price, 93),
        discount: f(0, 99),
        vat: f(vat, 90),
        lineTotal: f(+(base + vat).toFixed(2), 91),
      };
    });
    const subtotal = 10 * 15 + 5 * 20;
    const vat = +(subtotal * 0.15).toFixed(2);
    return {
      supplierName: f("Almarai", 97),
      invoiceNumber: f("INV-2026-0042", 96),
      invoiceDate: f("2026-07-01", 94),
      currency: f("SAR", 99),
      vatNumber: f("300000000000003", 88),
      subtotal: f(subtotal, 92),
      vat: f(vat, 92),
      discount: f(0, 99),
      grandTotal: f(+(subtotal + vat).toFixed(2), 93),
      paymentMethod: f("cash", 80),
      items,
    };
  }
}
