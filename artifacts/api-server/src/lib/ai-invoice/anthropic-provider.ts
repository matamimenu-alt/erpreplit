import Anthropic from "@anthropic-ai/sdk";
import type { InvoiceProvider, InvoiceFileInput, InvoiceExtraction, Field } from "./types";

/**
 * Anthropic (Claude) vision provider. A single multimodal request performs OCR
 * *and* semantic understanding of the invoice — the model reads the pixels and
 * returns structured, per-field data with confidence scores, rather than
 * relying on raw OCR text alone. Handles Arabic, English, and mixed invoices.
 */

const MODEL = "claude-opus-4-8";

// Structured-output schema: the model must return exactly this shape.
const fieldSchema = (valueType: "string" | "number") => ({
  type: "object",
  additionalProperties: false,
  properties: {
    value: { type: [valueType, "null"] },
    confidence: { type: "number" },
  },
  required: ["value", "confidence"],
});

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    supplierName: fieldSchema("string"),
    invoiceNumber: fieldSchema("string"),
    invoiceDate: fieldSchema("string"),
    currency: fieldSchema("string"),
    vatNumber: fieldSchema("string"),
    subtotal: fieldSchema("number"),
    vat: fieldSchema("number"),
    discount: fieldSchema("number"),
    grandTotal: fieldSchema("number"),
    paymentMethod: fieldSchema("string"),
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: fieldSchema("string"),
          quantity: fieldSchema("number"),
          unit: fieldSchema("string"),
          unitPrice: fieldSchema("number"),
          discount: fieldSchema("number"),
          vat: fieldSchema("number"),
          lineTotal: fieldSchema("number"),
        },
        required: ["name", "quantity", "unit", "unitPrice", "discount", "vat", "lineTotal"],
      },
    },
  },
  required: [
    "supplierName", "invoiceNumber", "invoiceDate", "currency", "vatNumber",
    "subtotal", "vat", "discount", "grandTotal", "paymentMethod", "items",
  ],
} as const;

const SYSTEM = `You are an expert accounting assistant that reads supplier purchase invoices for a restaurant business in Saudi Arabia. Invoices may be in Arabic, English, or a mix of both, and may be photos, scans, or PDFs of varying quality.

Extract the invoice's meaning — do not merely transcribe OCR text. For every field, return the value and a confidence score from 0 to 100 reflecting how certain you are. Use null for any value that is genuinely absent from the document (do not guess).

Rules:
- Dates: normalize to ISO format YYYY-MM-DD when possible.
- Numbers: return plain numbers with no currency symbols or thousands separators.
- currency: the ISO code if identifiable (e.g. SAR), else the symbol/word as written.
- vatNumber: the supplier's VAT/tax registration number if present.
- Per line item: name, quantity, unit, unit price, per-line discount, per-line VAT amount, and line total.
- Do NOT compute or "fix" totals — report what the document states, even if the arithmetic looks inconsistent. A separate validation step checks the maths.`;

export class AnthropicInvoiceProvider implements InvoiceProvider {
  readonly id = "anthropic";
  private client: Anthropic;

  constructor(apiKey?: string) {
    // Falls back to ANTHROPIC_API_KEY / profile resolution when apiKey is omitted.
    this.client = apiKey ? new Anthropic({ apiKey }) : new Anthropic();
  }

  async extract(input: InvoiceFileInput): Promise<InvoiceExtraction> {
    const isPdf = input.mimeType === "application/pdf";
    const mediaBlock = isPdf
      ? {
          type: "document" as const,
          source: { type: "base64" as const, media_type: "application/pdf" as const, data: input.base64 },
        }
      : {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: input.mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
            data: input.base64,
          },
        };

    // Built as a plain object and cast: the installed SDK's request types
    // predate `thinking: adaptive` / `output_config` (structured outputs), but
    // these are ordinary request-body fields that Opus 4.8 accepts at runtime.
    const params = {
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: { type: "json_schema", name: "invoice_extraction", schema: extractionSchema },
      },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            mediaBlock,
            { type: "text", text: "Extract this supplier invoice into the required structured schema." },
          ],
        },
      ],
    };
    const response = await this.client.messages.create(
      params as unknown as Anthropic.MessageCreateParamsNonStreaming,
    );

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("AI provider returned no structured content");
    }
    const parsed = JSON.parse(textBlock.text) as InvoiceExtraction;
    return normalize(parsed);
  }
}

/** Clamp confidences to 0–100 and coerce numeric fields defensively. */
function normalize(e: InvoiceExtraction): InvoiceExtraction {
  const f = <T,>(x: Field<T>): Field<T> => ({
    value: x?.value ?? null,
    confidence: Math.max(0, Math.min(100, Math.round(Number(x?.confidence ?? 0)))),
  });
  return {
    supplierName: f(e.supplierName),
    invoiceNumber: f(e.invoiceNumber),
    invoiceDate: f(e.invoiceDate),
    currency: f(e.currency),
    vatNumber: f(e.vatNumber),
    subtotal: f(e.subtotal),
    vat: f(e.vat),
    discount: f(e.discount),
    grandTotal: f(e.grandTotal),
    paymentMethod: f(e.paymentMethod),
    items: (e.items ?? []).map((it) => ({
      name: f(it.name),
      quantity: f(it.quantity),
      unit: f(it.unit),
      unitPrice: f(it.unitPrice),
      discount: f(it.discount),
      vat: f(it.vat),
      lineTotal: f(it.lineTotal),
    })),
  };
}
