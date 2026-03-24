import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { employeesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { getRestaurantId } from "../lib/restaurant";

const router: IRouter = Router();

function toNum(v: unknown) {
  return parseFloat(String(v ?? "0")) || 0;
}

/** Calculate number of months from joining date to now */
function calcMonths(joiningDate: string | null | undefined): number {
  if (!joiningDate) return 0;
  const joined = new Date(joiningDate);
  const now = new Date();
  const months = (now.getFullYear() - joined.getFullYear()) * 12 + (now.getMonth() - joined.getMonth());
  return Math.max(0, months);
}

/** All payroll computations from raw inputs */
function calcPayroll(data: {
  salary: number;
  socialSecurity: number;
  laborFees: number;
  iqamaRenewalYearly: number;
  medicalInsurance: number;  // yearly
  airTicketCost: number;     // yearly
  foodMeal: number;          // monthly
}) {
  const { salary, socialSecurity, laborFees, iqamaRenewalYearly, medicalInsurance, airTicketCost, foodMeal } = data;

  // Monthly equivalents
  const monthlyIqamaRenewal = +(iqamaRenewalYearly / 12).toFixed(2);
  const monthlyMedical = +(medicalInsurance / 12).toFixed(2);
  const monthlyAirTicket = +(airTicketCost / 12).toFixed(2);
  const monthlyIndemnity = +(salary / 12).toFixed(2);               // End-of-service provision
  const monthlyVacation = +((salary / 30 * 21) / 12).toFixed(2);   // Annual leave provision

  // Total Payroll Taxes = GOSI/Social Security + Labor Fees + Monthly Iqama
  const totalPayrollTaxes = +(socialSecurity + laborFees + monthlyIqamaRenewal).toFixed(2);

  // Total Employee Benefits = Medical + Indemnity + Air Ticket + Annual Vacation + Food Meal (all monthly)
  const totalEmployeesBenefits = +(monthlyMedical + monthlyIndemnity + monthlyAirTicket + monthlyVacation + foodMeal).toFixed(2);

  // Total Labor Cost = Basic Salary + Total Payroll Taxes + Total Employee Benefits
  const totalMonthlyCost = +(salary + totalPayrollTaxes + totalEmployeesBenefits).toFixed(2);

  return {
    monthlyIqamaRenewal,
    monthlyMedical,
    monthlyAirTicket,
    monthlyIndemnity,
    monthlyVacation,
    totalPayrollTaxes,
    totalEmployeesBenefits,
    totalMonthlyCost,
  };
}

function toRecord(r: typeof employeesTable.$inferSelect) {
  const salary = toNum(r.salary);
  const socialSecurity = toNum(r.socialSecurity);
  const laborFees = toNum(r.laborFees);
  const iqamaRenewalYearly = toNum(r.iqamaRenewalYearly);
  const medicalInsurance = toNum(r.medicalInsurance);
  const airTicketCost = toNum(r.airTicketCost);
  const foodMeal = toNum(r.foodMeal);

  const computed = calcPayroll({
    salary, socialSecurity, laborFees, iqamaRenewalYearly, medicalInsurance, airTicketCost, foodMeal,
  });

  return {
    id: r.id,
    name: r.name,
    designation: r.designation || r.jobTitle || "",
    fullTime: r.fullTime,
    nationality: r.nationality || "",
    joiningDate: r.joiningDate ?? undefined,
    numberOfMonths: calcMonths(r.joiningDate),
    salary,
    socialSecurity,
    laborFees,
    iqamaRenewalYearly,
    medicalInsurance,
    airTicketCost,
    foodMeal,
    ...computed,
    iqamaExpiryDate: r.iqamaExpiryDate ?? undefined,
    iqamaRenewalDate: r.iqamaRenewalDate ?? undefined,
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
      name, designation, fullTime, nationality, joiningDate,
      salary, socialSecurity, laborFees, iqamaRenewalYearly,
      medicalInsurance, airTicketCost, foodMeal,
      iqamaExpiryDate, iqamaRenewalDate,
    } = req.body;

    const computed = calcPayroll({
      salary: Number(salary) || 0,
      socialSecurity: Number(socialSecurity) || 0,
      laborFees: Number(laborFees) || 0,
      iqamaRenewalYearly: Number(iqamaRenewalYearly) || 0,
      medicalInsurance: Number(medicalInsurance) || 0,
      airTicketCost: Number(airTicketCost) || 0,
      foodMeal: Number(foodMeal) || 0,
    });

    const [record] = await db
      .insert(employeesTable)
      .values({
        restaurantId,
        name,
        designation: designation || "",
        jobTitle: designation || "",
        fullTime: fullTime !== false,
        nationality: nationality || "",
        joiningDate: joiningDate || null,
        salary: String(Number(salary || 0).toFixed(2)),
        socialSecurity: String(Number(socialSecurity || 0).toFixed(2)),
        laborFees: String(Number(laborFees || 0).toFixed(2)),
        iqamaRenewalYearly: String(Number(iqamaRenewalYearly || 0).toFixed(2)),
        medicalInsurance: String(Number(medicalInsurance || 0).toFixed(2)),
        airTicketCost: String(Number(airTicketCost || 0).toFixed(2)),
        foodMeal: String(Number(foodMeal || 0).toFixed(2)),
        iqamaExpiryDate: iqamaExpiryDate || null,
        iqamaRenewalDate: iqamaRenewalDate || null,
        totalMonthlyCost: String(computed.totalMonthlyCost),
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
      name, designation, fullTime, nationality, joiningDate,
      salary, socialSecurity, laborFees, iqamaRenewalYearly,
      medicalInsurance, airTicketCost, foodMeal,
      iqamaExpiryDate, iqamaRenewalDate,
    } = req.body;

    const computed = calcPayroll({
      salary: Number(salary) || 0,
      socialSecurity: Number(socialSecurity) || 0,
      laborFees: Number(laborFees) || 0,
      iqamaRenewalYearly: Number(iqamaRenewalYearly) || 0,
      medicalInsurance: Number(medicalInsurance) || 0,
      airTicketCost: Number(airTicketCost) || 0,
      foodMeal: Number(foodMeal) || 0,
    });

    const [record] = await db
      .update(employeesTable)
      .set({
        name,
        designation: designation || "",
        jobTitle: designation || "",
        fullTime: fullTime !== false,
        nationality: nationality || "",
        joiningDate: joiningDate || null,
        salary: String(Number(salary || 0).toFixed(2)),
        socialSecurity: String(Number(socialSecurity || 0).toFixed(2)),
        laborFees: String(Number(laborFees || 0).toFixed(2)),
        iqamaRenewalYearly: String(Number(iqamaRenewalYearly || 0).toFixed(2)),
        medicalInsurance: String(Number(medicalInsurance || 0).toFixed(2)),
        airTicketCost: String(Number(airTicketCost) || 0).toFixed(2),
        foodMeal: String(Number(foodMeal || 0).toFixed(2)),
        iqamaExpiryDate: iqamaExpiryDate || null,
        iqamaRenewalDate: iqamaRenewalDate || null,
        totalMonthlyCost: String(computed.totalMonthlyCost),
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
    await db.delete(employeesTable)
      .where(and(eq(employeesTable.id, id), eq(employeesTable.restaurantId, restaurantId)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting employee");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
