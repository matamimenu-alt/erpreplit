import type { InvoiceExtraction } from "./types";

export type ValidationWarning = {
  code: string;
  message: string;
  severity: "warning" | "error";
};

/**
 * Arithmetic sanity checks over the extracted numbers. These catch OCR/AI
 * mistakes (a misread digit, a dropped line) that the model itself won't flag,
 * because we deliberately told it not to "fix" totals. Tolerances absorb
 * rounding noise.
 */
export function validateExtraction(e: InvoiceExtraction): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const n = (v: number | null) => (typeof v === "number" && isFinite(v) ? v : 0);
  const TOL = 0.5; // SAR tolerance for rounding

  const subtotal = n(e.subtotal.value);
  const vat = n(e.vat.value);
  const discount = n(e.discount.value);
  const grand = n(e.grandTotal.value);

  // Sum of line net (qty*price - line discount) should track the subtotal.
  const lineNetSum = e.items.reduce(
    (s, it) => s + (n(it.quantity.value) * n(it.unitPrice.value) - n(it.discount.value)),
    0,
  );
  if (subtotal > 0 && Math.abs(lineNetSum - subtotal) > Math.max(TOL, subtotal * 0.02)) {
    warnings.push({
      code: "subtotal_mismatch",
      message: `Line items sum to ${lineNetSum.toFixed(2)} but the invoice subtotal is ${subtotal.toFixed(2)}.`,
      severity: "warning",
    });
  }

  // subtotal + vat - discount should equal the grand total.
  if (grand > 0) {
    const expected = subtotal + vat - discount;
    if (Math.abs(expected - grand) > Math.max(TOL, grand * 0.02)) {
      warnings.push({
        code: "grand_total_mismatch",
        message: `Subtotal + VAT − discount = ${expected.toFixed(2)}, but the grand total reads ${grand.toFixed(2)}.`,
        severity: "warning",
      });
    }
  }

  // Per-line: qty*price - discount + vat vs line total.
  e.items.forEach((it, i) => {
    const expected = n(it.quantity.value) * n(it.unitPrice.value) - n(it.discount.value) + n(it.vat.value);
    const line = n(it.lineTotal.value);
    if (line > 0 && Math.abs(expected - line) > Math.max(TOL, line * 0.02)) {
      warnings.push({
        code: "line_total_mismatch",
        message: `Item ${i + 1} (${it.name.value ?? "?"}): computed ${expected.toFixed(2)} ≠ stated line total ${line.toFixed(2)}.`,
        severity: "warning",
      });
    }
  });

  return warnings;
}
