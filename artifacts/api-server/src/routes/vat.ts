import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { salesTable, purchasesTable, branchTransfersTable } from "@workspace/db/schema";
import { eq, or } from "drizzle-orm";
import { getRestaurantId } from "../lib/restaurant";

const router: IRouter = Router();

function toNum(v: unknown) { return parseFloat(String(v)) || 0; }
function f2(n: number)     { return +n.toFixed(2); }

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
    // Rule: VAT TRAVELS WITH THE GOODS — it is not copied.
    //   Sending branch  → Input VAT is REDUCED by the VAT portion that left with the goods
    //   Receiving branch → Input VAT is INCREASED by the VAT portion received with the goods
    // Only INTERNAL transfers (toRestaurantId is set) carry VAT — external/warehouse transfers don't
    let allTransfers = await db.select().from(branchTransfersTable)
      .where(or(
        eq(branchTransfersTable.fromRestaurantId, restaurantId),
        eq(branchTransfersTable.toRestaurantId, restaurantId),
      ));
    if (month) allTransfers = allTransfers.filter(t => t.transferDate.startsWith(month));

    // Transfers OUT to another internal branch — VAT leaves this branch
    const outTransfers = allTransfers.filter(
      t => t.fromRestaurantId === restaurantId && t.toRestaurantId !== null
    );
    const vatTransferredOut      = outTransfers.reduce((s, t) => s + toNum(t.vatAmount), 0);
    const netAmountTransferredOut = outTransfers.reduce((s, t) => s + toNum(t.quantity) * toNum(t.unitPrice), 0);

    // Transfers IN from another branch — VAT arrives at this branch
    const inTransfers = allTransfers.filter(t => t.toRestaurantId === restaurantId);
    const vatReceivedIn          = inTransfers.reduce((s, t) => s + toNum(t.vatAmount), 0);
    const netAmountReceivedIn    = inTransfers.reduce((s, t) => s + toNum(t.quantity) * toNum(t.unitPrice), 0);

    // Adjusted input VAT after inter-branch VAT allocation
    const adjustedInputVat = inputVatRaw - vatTransferredOut + vatReceivedIn;

    // Net VAT payable / reclaimable
    const vatPayable = f2(outputVat - adjustedInputVat);

    res.json({
      month: month ?? "all",

      // ── Output VAT (from sales) ──
      totalSales:     f2(totalSales),
      outputVat:      f2(outputVat),

      // ── Input VAT (from purchases — before transfer adjustment) ──
      totalPurchases: f2(totalPurchases),
      inputVat:       f2(inputVatRaw),         // raw from purchase invoices

      // ── Inter-Branch Transfer VAT Allocation ──
      // Sending side: VAT that left with transferred goods (reduces this branch's input VAT)
      vatTransferredOut:       f2(vatTransferredOut),
      netAmountTransferredOut: f2(netAmountTransferredOut),
      transfersOutCount:       outTransfers.length,

      // Receiving side: VAT that arrived with received goods (increases this branch's input VAT)
      vatReceivedIn:           f2(vatReceivedIn),
      netAmountReceivedIn:     f2(netAmountReceivedIn),
      transfersInCount:        inTransfers.length,

      // Net VAT impact from transfers (positive = net gain, negative = net loss)
      netTransferVatImpact:    f2(vatReceivedIn - vatTransferredOut),

      // ── Adjusted Input VAT (after transfer allocation) ──
      adjustedInputVat:        f2(adjustedInputVat),

      // ── Net VAT Payable (using ADJUSTED input VAT) ──
      vatPayable,

      // ── Breakdown for ZATCA filing ──
      zatca: {
        box1_taxableSupplies:     f2(totalSales),       // Standard rated supplies
        box2_outputVat:           f2(outputVat),         // VAT on sales (15%)
        box3_taxablePurchases:    f2(totalPurchases),    // Standard rated purchases
        box4_inputVatGross:       f2(inputVatRaw),       // Input VAT before transfers
        box4_vatTransferredOut:   f2(-vatTransferredOut), // Deduct: VAT that left branch
        box4_vatReceivedIn:       f2(vatReceivedIn),     // Add: VAT that arrived at branch
        box4_inputVatNet:         f2(adjustedInputVat),  // Net input VAT after allocation
        box5_vatPayable:          vatPayable,             // Net VAT to pay / reclaim
      },
    });
  } catch (err) {
    req.log.error({ err }, "Error getting VAT report");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
