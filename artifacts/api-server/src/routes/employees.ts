import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { employeesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { getRestaurantId } from "../lib/restaurant";

const router: IRouter = Router();

function toNum(v: unknown) {
  return parseFloat(String(v));
}

function calcTotalMonthlyCost(
  salary: number,
  accommodation: number,
  medical: number,
  gosi: number,
  airTicket: number
) {
  return +(salary + accommodation + medical + gosi + airTicket / 12).toFixed(2);
}

function toRecord(r: typeof employeesTable.$inferSelect) {
  return {
    id: r.id,
    name: r.name,
    jobTitle: r.jobTitle,
    salary: toNum(r.salary),
    iqamaExpiryDate: r.iqamaExpiryDate ?? undefined,
    iqamaRenewalDate: r.iqamaRenewalDate ?? undefined,
    lastTravelDate: r.lastTravelDate ?? undefined,
    vacationBalance: toNum(r.vacationBalance),
    accommodationCost: toNum(r.accommodationCost),
    medicalInsurance: toNum(r.medicalInsurance),
    gosiInsurance: toNum(r.gosiInsurance),
    airTicketCost: toNum(r.airTicketCost),
    totalMonthlyCost: toNum(r.totalMonthlyCost),
    createdAt: r.createdAt.toISOString(),
  };
}

// GET /api/employees
router.get("/", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const records = await db.select().from(employeesTable)
      .where(eq(employeesTable.restaurantId, restaurantId))
      .orderBy(employeesTable.name);
    res.json(records.map(toRecord));
  } catch (err) {
    req.log.error({ err }, "Error listing employees");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/employees
router.post("/", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const {
      name, jobTitle, salary, iqamaExpiryDate, iqamaRenewalDate,
      lastTravelDate, vacationBalance, accommodationCost, medicalInsurance,
      gosiInsurance, airTicketCost
    } = req.body;
    const totalMonthlyCost = calcTotalMonthlyCost(
      Number(salary), Number(accommodationCost), Number(medicalInsurance),
      Number(gosiInsurance), Number(airTicketCost)
    );
    const [record] = await db
      .insert(employeesTable)
      .values({
        restaurantId,
        name, jobTitle,
        salary: String(Number(salary).toFixed(2)),
        iqamaExpiryDate: iqamaExpiryDate || null,
        iqamaRenewalDate: iqamaRenewalDate || null,
        lastTravelDate: lastTravelDate || null,
        vacationBalance: String(Number(vacationBalance || 0).toFixed(1)),
        accommodationCost: String(Number(accommodationCost || 0).toFixed(2)),
        medicalInsurance: String(Number(medicalInsurance || 0).toFixed(2)),
        gosiInsurance: String(Number(gosiInsurance || 0).toFixed(2)),
        airTicketCost: String(Number(airTicketCost || 0).toFixed(2)),
        totalMonthlyCost: String(totalMonthlyCost),
      })
      .returning();
    res.status(201).json(toRecord(record));
  } catch (err) {
    req.log.error({ err }, "Error creating employee");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/employees/:id
router.put("/:id", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const id = parseInt(req.params.id);
    const {
      name, jobTitle, salary, iqamaExpiryDate, iqamaRenewalDate,
      lastTravelDate, vacationBalance, accommodationCost, medicalInsurance,
      gosiInsurance, airTicketCost
    } = req.body;
    const totalMonthlyCost = calcTotalMonthlyCost(
      Number(salary), Number(accommodationCost), Number(medicalInsurance),
      Number(gosiInsurance), Number(airTicketCost)
    );
    const [record] = await db
      .update(employeesTable)
      .set({
        name, jobTitle,
        salary: String(Number(salary).toFixed(2)),
        iqamaExpiryDate: iqamaExpiryDate || null,
        iqamaRenewalDate: iqamaRenewalDate || null,
        lastTravelDate: lastTravelDate || null,
        vacationBalance: String(Number(vacationBalance || 0).toFixed(1)),
        accommodationCost: String(Number(accommodationCost || 0).toFixed(2)),
        medicalInsurance: String(Number(medicalInsurance || 0).toFixed(2)),
        gosiInsurance: String(Number(gosiInsurance || 0).toFixed(2)),
        airTicketCost: String(Number(airTicketCost || 0).toFixed(2)),
        totalMonthlyCost: String(totalMonthlyCost),
      })
      .where(and(eq(employeesTable.id, id), eq(employeesTable.restaurantId, restaurantId)))
      .returning();
    if (!record) return res.status(404).json({ error: "Not found" });
    res.json(toRecord(record));
  } catch (err) {
    req.log.error({ err }, "Error updating employee");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/employees/:id
router.delete("/:id", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const id = parseInt(req.params.id);
    await db.delete(employeesTable).where(and(eq(employeesTable.id, id), eq(employeesTable.restaurantId, restaurantId)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting employee");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
