import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { salesTable, purchasesTable } from "@workspace/db/schema";

const router: IRouter = Router();

function toNum(v: unknown) {
  return parseFloat(String(v));
}

// GET /api/vat/report
router.get("/report", async (req, res) => {
  try {
    const month = req.query.month as string | undefined;

    let salesRecords = await db.select().from(salesTable).orderBy(salesTable.date);
    let purchaseRecords = await db.select().from(purchasesTable).orderBy(purchasesTable.date);

    if (month) {
      salesRecords = salesRecords.filter((r) => r.date.startsWith(month));
      purchaseRecords = purchaseRecords.filter((r) => r.date.startsWith(month));
    }

    const totalSales = salesRecords.reduce((s, r) => s + toNum(r.totalSales), 0);
    const outputVat = salesRecords.reduce((s, r) => s + toNum(r.outputVat), 0);
    const totalPurchases = purchaseRecords.reduce((s, r) => s + toNum(r.amountBeforeVat), 0);
    const inputVat = purchaseRecords.reduce((s, r) => s + toNum(r.vatAmount), 0);
    const vatPayable = outputVat - inputVat;

    res.json({
      month: month ?? "all",
      totalSales: +totalSales.toFixed(2),
      outputVat: +outputVat.toFixed(2),
      totalPurchases: +totalPurchases.toFixed(2),
      inputVat: +inputVat.toFixed(2),
      vatPayable: +vatPayable.toFixed(2),
    });
  } catch (err) {
    req.log.error({ err }, "Error getting VAT report");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
