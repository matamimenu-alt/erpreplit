import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { aiInvoiceSettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getRestaurantId } from "../lib/restaurant";
import { getInvoiceProvider } from "../lib/ai-invoice/provider";
import { validateExtraction } from "../lib/ai-invoice/validate";
import { matchSupplier, buildProductMatcher } from "../lib/ai-invoice/match";

const router: IRouter = Router();

// ── Settings ────────────────────────────────────────────────────────────────
async function getOrCreateSettings(restaurantId: number) {
  const [existing] = await db
    .select()
    .from(aiInvoiceSettingsTable)
    .where(eq(aiInvoiceSettingsTable.restaurantId, restaurantId));
  if (existing) return existing;
  const [created] = await db.insert(aiInvoiceSettingsTable).values({ restaurantId }).returning();
  return created;
}

function toSettings(s: typeof aiInvoiceSettingsTable.$inferSelect) {
  return {
    ocrEnabled: s.ocrEnabled,
    autoCreateSupplier: s.autoCreateSupplier,
    autoCreateProduct: s.autoCreateProduct,
    confidenceThreshold: s.confidenceThreshold,
    provider: s.provider,
  };
}

router.get("/settings", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const s = await getOrCreateSettings(restaurantId);
    return res.json(toSettings(s));
  } catch (err) {
    req.log.error({ err }, "Error getting AI invoice settings");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/settings", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    await getOrCreateSettings(restaurantId);
    const { ocrEnabled, autoCreateSupplier, autoCreateProduct, confidenceThreshold, provider } = req.body ?? {};
    const [updated] = await db
      .update(aiInvoiceSettingsTable)
      .set({
        ...(ocrEnabled !== undefined && { ocrEnabled: !!ocrEnabled }),
        ...(autoCreateSupplier !== undefined && { autoCreateSupplier: !!autoCreateSupplier }),
        ...(autoCreateProduct !== undefined && { autoCreateProduct: !!autoCreateProduct }),
        ...(confidenceThreshold !== undefined && {
          confidenceThreshold: Math.max(0, Math.min(100, parseInt(String(confidenceThreshold), 10) || 85)),
        }),
        ...(provider !== undefined && { provider: String(provider) }),
        updatedAt: new Date(),
      })
      .where(eq(aiInvoiceSettingsTable.restaurantId, restaurantId))
      .returning();
    return res.json(toSettings(updated));
  } catch (err) {
    req.log.error({ err }, "Error updating AI invoice settings");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Extract ─────────────────────────────────────────────────────────────────
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]);

// POST /api/ai-invoice/extract — { fileBase64, mimeType }
// Runs OCR+AI extraction, validates arithmetic, matches supplier & products.
// NEVER persists anything — the client reviews and then saves via /purchases.
router.post("/extract", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const settings = await getOrCreateSettings(restaurantId);
    if (!settings.ocrEnabled) {
      return res.status(403).json({ error: "AI invoice OCR is disabled in settings" });
    }

    const { fileBase64, mimeType } = req.body ?? {};
    if (!fileBase64 || typeof fileBase64 !== "string") {
      return res.status(400).json({ error: "fileBase64 is required" });
    }
    if (!ALLOWED.has(String(mimeType))) {
      return res.status(400).json({ error: `Unsupported mimeType. Allowed: ${[...ALLOWED].join(", ")}` });
    }

    const provider = getInvoiceProvider(settings.provider);
    let extraction;
    try {
      extraction = await provider.extract({ base64: fileBase64, mimeType });
    } catch (err) {
      req.log.error({ err }, "AI extraction failed");
      return res.status(502).json({ error: "AI extraction failed. Check the file or try again." });
    }

    const warnings = validateExtraction(extraction);
    const supplier = await matchSupplier(restaurantId, extraction.supplierName.value);
    const matchProduct = await buildProductMatcher(restaurantId);
    const items = extraction.items.map((it) => ({ ...it, match: matchProduct(it.name.value) }));

    return res.json({
      provider: provider.id,
      extraction: { ...extraction, items },
      supplierMatch: supplier,
      validation: { warnings },
    });
  } catch (err) {
    req.log.error({ err }, "Error extracting AI invoice");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
