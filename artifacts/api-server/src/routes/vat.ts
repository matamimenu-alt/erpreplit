import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  salesTable,
  purchasesTable,
  branchTransfersTable,
  fixedCostTemplatesTable,
  fixedCostMonthlyValuesTable,
  expenseTransactionsTable,
} from "@workspace/db/schema";
import { eq, or, and, gte, lte } from "drizzle-orm";
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

    // ── Breakdown collector (per-source line items for audit/display) ─────────
    type BreakdownRow = {
      sourceType: "purchase" | "fixed-cost" | "expense-ledger";
      sourceId: string;
      label: string;
      date: string;
      vatType: string;          // 'none' | 'included' | 'excluded'
      vatRate: number;
      taxableAmount: number;    // net (pre-VAT) base
      vatAmount: number;
      status: "taxable" | "exempt" | "excluded";
      reason?: string;          // when status != "taxable"
    };
    const breakdown: BreakdownRow[] = [];

    // — Purchases breakdown —
    for (const p of purchaseRecords) {
      const vat = toNum(p.vatAmount);
      const net = toNum(p.amountBeforeVat);
      breakdown.push({
        sourceType: "purchase",
        sourceId:   String(p.id),
        label:      `Purchase #${p.id}${p.invoiceNumber ? " · " + p.invoiceNumber : ""}`,
        date:       p.date,
        vatType:    p.priceIncludesVat ? "included" : (vat > 0 ? "excluded" : "none"),
        vatRate:    net > 0 ? +((vat / net) * 100).toFixed(2) : 0,
        taxableAmount: f2(net),
        vatAmount:     f2(vat),
        status:     vat > 0 ? "taxable" : (p.invoiceType === "non-tax" ? "exempt" : "exempt"),
        reason:     vat > 0 ? undefined : (p.invoiceType === "non-tax" ? "non-tax invoice" : "no VAT recorded"),
      });
    }

    // ── Expense Ledger Input VAT (Operating Expenses) ─────────────────────────
    // VAT paid on operating expenses recorded in the expense ledger
    // (e.g. cleaning, marketing, maintenance). Auto-generated entries originating
    // from purchases/fixed-costs/payroll are excluded to prevent double counting,
    // since those sources are already aggregated independently.
    let expenseRows = await db.select().from(expenseTransactionsTable)
      .where(eq(expenseTransactionsTable.restaurantId, restaurantId));
    if (month) expenseRows = expenseRows.filter(r => r.month === month);

    const manualExpenses = expenseRows.filter(r => !r.isAutoGenerated);
    const expenseLedgerNet      = manualExpenses.reduce((s, r) => s + toNum(r.amount), 0);
    const expenseLedgerInputVat = manualExpenses.reduce((s, r) => s + toNum(r.vatAmount), 0);
    // Only VAT-eligible rows contribute to the "taxable expenses" base.
    // Exempt rows (vatType="none") still appear in the operating-expense total but
    // must NOT inflate the taxable-base aggregation used for ZATCA reporting.
    // A row contributes to the taxable base iff it actually produced input VAT.
    // Using vatAmount>0 keeps this correct for legacy rows where vatType defaults
    // to "none" but isVatApplicable was true and VAT was recorded.
    const expenseLedgerTaxableNet = manualExpenses
      .filter(r => toNum(r.vatAmount) > 0)
      .reduce((s, r) => s + toNum(r.amount), 0);

    // — Expense Ledger breakdown (manual entries only; auto entries are excluded
    //   to avoid double-counting and listed in `excluded`) —
    for (const e of manualExpenses) {
      const vat = toNum(e.vatAmount);
      const net = toNum(e.amount);
      breakdown.push({
        sourceType:    "expense-ledger",
        sourceId:      String(e.id),
        label:         `${e.categoryCode} · ${e.description}`,
        date:          e.date,
        vatType:       e.vatType ?? "none",
        vatRate:       toNum(e.vatRate),
        taxableAmount: f2(net),
        vatAmount:     f2(vat),
        status:        vat > 0 ? "taxable" : "exempt",
        reason:        vat > 0 ? undefined : (e.vatType === "none" ? "VAT type: none" : "no VAT recorded"),
      });
    }
    // Auto-generated rows are skipped in totals but surfaced for audit
    const autoExpenses = expenseRows.filter(r => r.isAutoGenerated);

    // ── Fixed Costs Input VAT ─────────────────────────────────────────────────
    // VAT paid on fixed cost invoices (rent, utilities, subscriptions, etc.) is
    // reclaimable input VAT under ZATCA rules when supported by a valid tax invoice.
    const fcTemplates = await db.select().from(fixedCostTemplatesTable)
      .where(and(
        eq(fixedCostTemplatesTable.restaurantId, restaurantId),
        eq(fixedCostTemplatesTable.isActive, true),
      ));

    let fixedCostInputVat = 0;
    let fixedCostTaxableNet = 0;
    const fcOverrides = month
      ? await db.select().from(fixedCostMonthlyValuesTable)
          .where(and(
            eq(fixedCostMonthlyValuesTable.restaurantId, restaurantId),
            eq(fixedCostMonthlyValuesTable.month, month),
          ))
      : [];
    const overrideMap = new Map(fcOverrides.map(o => [o.templateId, toNum(o.amount)]));
    for (const t of fcTemplates) {
      const enteredAmt = overrideMap.has(t.id) ? overrideMap.get(t.id)! : toNum(t.defaultAmount);
      const vatType = t.vatType ?? "none";
      const vatRate = toNum(t.vatRate ?? "15.00");
      // Salaries are the only category excluded from VAT scope (matches prior
      // behaviour and ZATCA treatment). Other categories are evaluated purely
      // on their vatType / amount.
      const isSalary = t.category === "staff-salaries";
      const isVatEligible = !isSalary && vatType !== "none" && enteredAmt > 0;

      let net = enteredAmt;
      let vat = 0;
      if (isVatEligible) {
        vat = computeFixedVat(enteredAmt, vatType, vatRate);
        const rate = (vatRate || 15) / 100;
        net = vatType === "included" ? enteredAmt / (1 + rate) : enteredAmt;
        fixedCostInputVat   += vat;
        fixedCostTaxableNet += net;
      }

      breakdown.push({
        sourceType:    "fixed-cost",
        sourceId:      String(t.id),
        label:         `${t.category} · ${t.name}`,
        date:          month ?? "—",
        vatType,
        vatRate,
        taxableAmount: f2(net),
        vatAmount:     f2(vat),
        status:        isVatEligible ? "taxable" : (isSalary ? "excluded" : "exempt"),
        reason:        isSalary             ? "category: staff salaries (out of VAT scope)"
                     : vatType === "none"   ? "VAT type: none"
                     : enteredAmt === 0     ? "no amount this period"
                     : undefined,
      });
    }
    fixedCostInputVat   = +fixedCostInputVat.toFixed(2);
    fixedCostTaxableNet = +fixedCostTaxableNet.toFixed(2);

    // ── Adjusted Input VAT ───────────────────────────────────────────────────
    // inputVatRaw             = VAT from purchase invoices
    // - vatTransferredOut     = VAT that left with goods sent to other branches
    // + vatReceivedIn         = VAT that arrived with goods from other branches
    // + fixedCostInputVat     = VAT on rent, utilities, subscriptions, etc.
    // + expenseLedgerInputVat = VAT on operating expenses (cleaning, marketing, …)
    const adjustedInputVat =
      inputVatRaw - vatTransferredOut + vatReceivedIn + fixedCostInputVat + expenseLedgerInputVat;

    const vatPayable = f2(outputVat - adjustedInputVat);

    // ── Comprehensive summary (for the report header) ────────────────────────
    // Total taxable expenses = net pre-VAT base of everything that produced input VAT
    //   (purchases, operating-expense ledger entries with VAT, VAT-eligible fixed costs).
    // Branch transfers are NOT included (they net to zero across the group).
    const totalTaxableExpenses = totalPurchases + expenseLedgerTaxableNet + fixedCostTaxableNet;
    const totalInputVat        = adjustedInputVat;

    // ── Excluded-entry audit list (for transparency in the report UI) ────────
    // Each row in `excluded` is *intentionally* skipped from Input VAT, with a
    // human-readable reason. This lets accountants verify nothing was dropped
    // silently. Auto-generated expense rows are listed here (skipped to avoid
    // double-counting against their original source).
    const excluded = autoExpenses.map(e => ({
      sourceType: "expense-ledger" as const,
      sourceId:   String(e.id),
      label:      `${e.categoryCode} · ${e.description}`,
      date:       e.date,
      amount:     f2(toNum(e.totalAmount)),
      reason:     `auto-generated from ${e.sourceType ?? "source"} (already counted)`,
    }));

    // Sort breakdown: source, then status (taxable first), then date
    const statusRank = { taxable: 0, exempt: 1, excluded: 2 } as const;
    breakdown.sort((a, b) =>
      a.sourceType.localeCompare(b.sourceType) ||
      statusRank[a.status] - statusRank[b.status] ||
      a.date.localeCompare(b.date),
    );

    // Sanity totals (mirror the scalar VAT fields exactly so the breakdown
    // table reconciles with `inputVat`, `expenseLedgerInputVat`, and
    // `fixedCostInputVat`). We sum ALL rows of each source — including
    // negative adjustments / credit notes — not just status==="taxable".
    const sumBy = (st: BreakdownRow["sourceType"], k: "vatAmount" | "taxableAmount") =>
      f2(breakdown.filter(b => b.sourceType === st).reduce((s, b) => s + b[k], 0));
    const breakdownTotals = {
      purchases:     { vat: sumBy("purchase",       "vatAmount"), net: sumBy("purchase",       "taxableAmount") },
      expenseLedger: { vat: sumBy("expense-ledger", "vatAmount"), net: sumBy("expense-ledger", "taxableAmount") },
      fixedCosts:    { vat: sumBy("fixed-cost",     "vatAmount"), net: sumBy("fixed-cost",     "taxableAmount") },
    };

    // Reconciliation guard: log a warning if breakdown drifts from scalars
    // (e.g. data anomaly or future code change). Off-by-0.01 tolerated for f2.
    const drift = {
      purchases:     Math.abs(breakdownTotals.purchases.vat     - f2(inputVatRaw)),
      expenseLedger: Math.abs(breakdownTotals.expenseLedger.vat - f2(expenseLedgerInputVat)),
      fixedCosts:    Math.abs(breakdownTotals.fixedCosts.vat    - f2(fixedCostInputVat)),
    };
    if (drift.purchases > 0.01 || drift.expenseLedger > 0.01 || drift.fixedCosts > 0.01) {
      req.log.warn({ drift, breakdownTotals, inputVatRaw, expenseLedgerInputVat, fixedCostInputVat },
        "VAT breakdown totals drift from scalar sums");
    }

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

      // ── Expense Ledger Input VAT (Operating Expenses) ──
      expenseLedgerNet:      f2(expenseLedgerNet),
      expenseLedgerInputVat: f2(expenseLedgerInputVat),

      // ── Comprehensive summary ──
      totalTaxableSales:    f2(totalSales),
      totalOutputVat:       f2(outputVat),
      totalTaxableExpenses: f2(totalTaxableExpenses),
      totalInputVat:        f2(totalInputVat),
      finalVatDue:          vatPayable,

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

      // ── Per-source breakdown (Purchases / Fixed Costs / Expense Ledger) ──
      // Each row carries: sourceType, label, date, vatType, vatRate,
      // taxableAmount (net), vatAmount, status (taxable|exempt|excluded), reason.
      breakdown,
      breakdownTotals,

      // ── Audit list: entries intentionally NOT counted (with reason) ──
      excluded,

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
