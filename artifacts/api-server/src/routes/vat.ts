/**
 * VAT / ZATCA Report — thin presentation layer over the unified VAT engine.
 *
 * ALL number crunching lives in `lib/vat-engine.ts` so that this endpoint,
 * the P&L endpoint, the dashboard, and the diagnostics route can never drift.
 */
import { Router, type IRouter } from "express";
import { getRestaurantId } from "../lib/restaurant";
import { computeVatSummary } from "../lib/vat-engine";

const router: IRouter = Router();
const f2 = (n: number) => +n.toFixed(2);

// ─── GET /api/vat/report ──────────────────────────────────────────────────────
router.get("/report", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const month = (req.query.month as string | undefined) ?? null;

    const v = await computeVatSummary({ restaurantId, month });

    // Sanity drift check (engine outputs are pre-rounded; this catches any
    // future divergence between the breakdown rows and the scalar totals).
    const sumBy = (st: string, k: "vatAmount" | "taxableAmount") =>
      f2(v.breakdown.filter(b => b.sourceType === st).reduce((s, b) => s + b[k], 0));
    const breakdownTotals = {
      purchases:     { vat: sumBy("purchase",       "vatAmount"), net: sumBy("purchase",       "taxableAmount") },
      expenseLedger: { vat: sumBy("expense-ledger", "vatAmount"), net: sumBy("expense-ledger", "taxableAmount") },
      fixedCosts:    { vat: sumBy("fixed-cost",     "vatAmount"), net: sumBy("fixed-cost",     "taxableAmount") },
    };
    const drift = {
      purchases:     Math.abs(breakdownTotals.purchases.vat     - v.inputVatRaw),
      expenseLedger: Math.abs(breakdownTotals.expenseLedger.vat - v.expenseLedgerInputVat),
      fixedCosts:    Math.abs(breakdownTotals.fixedCosts.vat    - v.fixedCostInputVat),
    };
    if (drift.purchases > 0.01 || drift.expenseLedger > 0.01 || drift.fixedCosts > 0.01) {
      req.log.warn({ drift, breakdownTotals, v: v.debug.components },
        "VAT breakdown totals drift from scalar sums");
    }

    res.json({
      month: month ?? "all",

      // ── Output VAT (from sales) ──
      totalSales: v.totalSales,
      outputVat:  v.outputVat,

      // ── Input VAT (from purchases — before adjustments) ──
      totalPurchases: v.totalPurchases,
      inputVat:       v.inputVatRaw,

      // ── Fixed Costs Input VAT ──
      fixedCostInputVat: v.fixedCostInputVat,

      // ── Expense Ledger Input VAT (Operating Expenses) ──
      expenseLedgerNet:      v.expenseLedgerNet,
      expenseLedgerInputVat: v.expenseLedgerInputVat,

      // ── Comprehensive summary ──
      totalTaxableSales:    v.totalSales,
      totalOutputVat:       v.outputVat,
      totalTaxableExpenses: v.totalTaxableExpenses,
      totalInputVat:        v.adjustedInputVat,
      finalVatDue:          v.netVatPayable,

      // ── Inter-Branch Transfer VAT Allocation ──
      vatTransferredOut:       v.vatTransferredOut,
      netAmountTransferredOut: v.netAmountTransferredOut,
      transfersOutCount:       v.transfersOutCount,
      vatReceivedIn:           v.vatReceivedIn,
      netAmountReceivedIn:     v.netAmountReceivedIn,
      transfersInCount:        v.transfersInCount,
      netTransferVatImpact:    f2(v.vatReceivedIn - v.vatTransferredOut),

      // ── Adjusted Input VAT (after all adjustments) ──
      adjustedInputVat:        v.adjustedInputVat,

      // ── Net VAT Payable ──
      vatPayable:              v.netVatPayable,

      // ── Per-source breakdown + audit ──
      breakdown:       v.breakdown,
      breakdownTotals,
      excluded:        v.excluded,

      // ── Debug (formula + components — same on every endpoint) ──
      debug: v.debug,

      // ── Breakdown for ZATCA filing ──
      zatca: {
        box1_taxableSupplies:     v.totalSales,
        box2_outputVat:           v.outputVat,
        box3_taxablePurchases:    v.totalPurchases,
        box4_inputVatGross:       v.inputVatRaw,
        box4_fixedCostInputVat:   v.fixedCostInputVat,
        box4_vatTransferredOut:   f2(-v.vatTransferredOut),
        box4_vatReceivedIn:       v.vatReceivedIn,
        box4_inputVatNet:         v.adjustedInputVat,
        box5_vatPayable:          v.netVatPayable,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Error getting VAT report");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
