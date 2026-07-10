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

/** Simplified payroll: net = basic + overtime - deductions - absences */
function calcNetSalary(data: {
  salary: number;
  overtime: number;
  deductions: number;
  absences: number;
}): number {
  return +(data.salary + data.overtime - data.deductions - data.absences).toFixed(2);
}

function toRecord(r: typeof employeesTable.$inferSelect) {
  const salary = toNum(r.salary);
  const overtime = toNum(r.overtime);
  const deductions = toNum(r.deductions);
  const absences = toNum(r.absences);
  const netSalary = calcNetSalary({ salary, overtime, deductions, absences });

  return {
    id: r.id,
    name: r.name,
    designation: r.designation || r.jobTitle || "",
    fullTime: r.fullTime,
    nationality: r.nationality || "",
    joiningDate: r.joiningDate ?? undefined,
    numberOfMonths: calcMonths(r.joiningDate),
    salary,
    overtime,
    deductions,
    absences,
    netSalary,
    totalMonthlyCost: netSalary,
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
    return res.json(records.map(toRecord));
  } catch (err) {
    req.log.error({ err }, "Error listing employees");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/employees
router.post("/", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const {
      name, designation, fullTime, nationality, joiningDate,
      salary, overtime, deductions, absences,
      iqamaExpiryDate, iqamaRenewalDate,
    } = req.body;

    const net = calcNetSalary({
      salary: Number(salary) || 0,
      overtime: Number(overtime) || 0,
      deductions: Number(deductions) || 0,
      absences: Number(absences) || 0,
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
        overtime: String(Number(overtime || 0).toFixed(2)),
        deductions: String(Number(deductions || 0).toFixed(2)),
        absences: String(Number(absences || 0).toFixed(2)),
        iqamaExpiryDate: iqamaExpiryDate || null,
        iqamaRenewalDate: iqamaRenewalDate || null,
        totalMonthlyCost: String(net),
      })
      .returning();
    return res.status(201).json(toRecord(record));
  } catch (err) {
    req.log.error({ err }, "Error creating employee");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/employees/:id
router.put("/:id", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const id = parseInt(req.params.id);
    const {
      name, designation, fullTime, nationality, joiningDate,
      salary, overtime, deductions, absences,
      iqamaExpiryDate, iqamaRenewalDate,
    } = req.body;

    const net = calcNetSalary({
      salary: Number(salary) || 0,
      overtime: Number(overtime) || 0,
      deductions: Number(deductions) || 0,
      absences: Number(absences) || 0,
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
        overtime: String(Number(overtime || 0).toFixed(2)),
        deductions: String(Number(deductions || 0).toFixed(2)),
        absences: String(Number(absences || 0).toFixed(2)),
        iqamaExpiryDate: iqamaExpiryDate || null,
        iqamaRenewalDate: iqamaRenewalDate || null,
        totalMonthlyCost: String(net),
      })
      .where(and(eq(employeesTable.id, id), eq(employeesTable.restaurantId, restaurantId)))
      .returning();

    if (!record) return res.status(404).json({ error: "Not found" });
    return res.json(toRecord(record));
  } catch (err) {
    req.log.error({ err }, "Error updating employee");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/employees/:id
router.delete("/:id", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const id = parseInt(req.params.id);
    await db.delete(employeesTable)
      .where(and(eq(employeesTable.id, id), eq(employeesTable.restaurantId, restaurantId)));
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting employee");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
