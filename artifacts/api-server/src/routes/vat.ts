import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  salesTable,
  purchasesTable,
  branchTransfersTable,
  fixedCostTemplatesTable,
  fixedCostMonthlyValuesTable,
} from "@workspace/db/schema";
import { eq, or, and } from "drizzle-orm";
import { getRestaurantId } from "../lib/restaurant";

const router: IRouter = Router();

function toNum(v: unknown) { return parseFloat(String(v)) || 0; }
function f2(n: number)     { return +n.toFixed(2); }

// VAT helper for fixed costs
function computeFixedVat(amount: number, vatType: string, vatRate: number) {
  const rate = (vatRate || 15) / 100;
  if (!vatType || vatType === "none" || amount === 0) return 0;
  if (vatType === "included") return +(amount - amount / (1 + rate)).toFixed(2);
  return +(amount * rate).toFixed(2);
}

// ─── GET /api/vat/report ──────────────────────────────────────────────────────
router.get("/report", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const month = req.query.month as string | undefined;

    // ── Sales & Purchases ────────────────────────────────────────────────────
    let salesRecords = await db.select().from(salesTable)
      .where(eq(salesTable.restaurantId, restaurantId))
      .orderBy(salesTable.date);
    let purchaseRecords = await db.select().from(purchasesTable)
      .where(eq(purchasesTable.restaurantId, restaurantId))
      .orderBy(purchasesTable.date);

    if (month) {
      salesRecords    = salesRecords.filter(r => r.date.startsWith(month));
      purchaseRecords = purchaseRecords.filter(r => r.date.startsWith(month));
    }

    const totalSales    = salesRecords.reduce((s, r) => s + toNum(r.totalSales), 0);
    const outputVat     = salesRecords.reduce((s, r) => s + toNum(r.outputVat), 0);
    const totalPurchases = purchaseRecords.reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const inputVatRaw   = purchaseRecords.reduce((s, r) => s + toNum(r.vatAmount), 0);

    // ── Inter-Branch Transfer VAT ─────────────────────────────────────────────
    let allTransfers = await db.select().from(branchTransfersTable)
      .where(or(
        eq(branchTransfersTable.fromRestaurantId, restaurantId),
        eq(branchTransfersTable.toRestaurantId, restaurantId),
      ));
    if (month) allTransfers = allTransfers.filter(t => t.transferDate.startsWith(month));

    const outTransfers = allTransfers.filter(
      t => t.fromRestaurantId === restaurantId && t.toRestaurantId !== null
    );
    const vatTransferredOut      = outTransfers.reduce((s, t) => s + toNum(t.vatAmount), 0);
    const netAmountTransferredOut = outTransfers.reduce((s, t) => s + toNum(t.quantity) * toNum(t.unitPrice), 0);

    const inTransfers = allTransfers.filter(t => t.toRestaurantId === restaurantId);
    const vatReceivedIn          = inTransfers.reduce((s, t) => s + toNum(t.vatAmount), 0);
    const netAmountReceivedIn    = inTransfers.reduce((s, t) => s + toNum(t.quantity) * toNum(t.unitPrice), 0);

    // ── Fixed Costs Input VAT ─────────────────────────────────────────────────
    // VAT paid on fixed cost invoices (rent, utilities, subscriptions, etc.) is
    // reclaimable input VAT under ZATCA rules when supported by a valid tax invoice.
    const fcTemplates = await db.select().from(fixedCostTemplatesTable)
      .where(and(
        eq(fixedCostTemplatesTable.restaurantId, restaurantId),
        eq(fixedCostTemplatesTable.isActive, true),
      ));

    let fixedCostInputVat = 0;
    if (fcTemplates.some(t => t.vatType !== "none")) {
      const fcOverrides = month
        ? await db.select().from(fixedCostMonthlyValuesTable)
            .where(and(
              eq(fixedCostMonthlyValuesTable.restaurantId, restaurantId),
              eq(fixedCostMonthlyValuesTable.month, month),
            ))
        : [];
      const overrideMap = new Map(fcOverrides.map(o => [o.templateId, toNum(o.amount)]));
      for (const t of fcTemplates) {
        if (t.category === "staff-salaries") continue; // salaries are not VAT-eligible
        const enteredAmt = overrideMap.has(t.id) ? overrideMap.get(t.id)! : toNum(t.defaultAmount);
        fixedCostInputVat += computeFixedVat(enteredAmt, t.vatType ?? "none", toNum(t.vatRate ?? "15.00"));
      }
      fixedCostInputVat = +fixedCostInputVat.toFixed(2);
    }

    // ── Adjusted Input VAT ───────────────────────────────────────────────────
    // inputVatRaw         = VAT from purchase invoices
    // - vatTransferredOut = VAT that left with goods sent to other branches
    // + vatReceivedIn     = VAT that arrived with goods from other branches
    // + fixedCostInputVat = VAT on rent, utilities, subscriptions, etc.
    const adjustedInputVat = inputVatRaw - vatTransferredOut + vatReceivedIn + fixedCostInputVat;

    const vatPayable = f2(outputVat - adjustedInputVat);

    res.json({
      month: month ?? "all",

      // ── Output VAT (from sales) ──
      totalSales:     f2(totalSales),
      outputVat:      f2(outputVat),

      // ── Input VAT (from purchases — before adjustments) ──
      totalPurchases: f2(totalPurchases),
      inputVat:       f2(inputVatRaw),          // raw from purchase invoices

      // ── Fixed Costs Input VAT ──
      fixedCostInputVat: f2(fixedCostInputVat), // VAT on rent/utilities/subscriptions

      // ── Inter-Branch Transfer VAT Allocation ──
      vatTransferredOut:       f2(vatTransferredOut),
      netAmountTransferredOut: f2(netAmountTransferredOut),
      transfersOutCount:       outTransfers.length,

      vatReceivedIn:           f2(vatReceivedIn),
      netAmountReceivedIn:     f2(netAmountReceivedIn),
      transfersInCount:        inTransfers.length,

      netTransferVatImpact:    f2(vatReceivedIn - vatTransferredOut),

      // ── Adjusted Input VAT (after all adjustments) ──
      adjustedInputVat:        f2(adjustedInputVat),

      // ── Net VAT Payable ──
      vatPayable,

      // ── Breakdown for ZATCA filing ──
      zatca: {
        box1_taxableSupplies:     f2(totalSales),
        box2_outputVat:           f2(outputVat),
        box3_taxablePurchases:    f2(totalPurchases),
        box4_inputVatGross:       f2(inputVatRaw),
        box4_fixedCostInputVat:   f2(fixedCostInputVat),
        box4_vatTransferredOut:   f2(-vatTransferredOut),
        box4_vatReceivedIn:       f2(vatReceivedIn),
        box4_inputVatNet:         f2(adjustedInputVat),
        box5_vatPayable:          vatPayable,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Error getting VAT report");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
