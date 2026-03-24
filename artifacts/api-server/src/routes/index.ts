import { Router, type IRouter } from "express";
import healthRouter from "./health";
import salesRouter from "./sales";
import purchasesRouter from "./purchases";
import suppliersRouter from "./suppliers";
import employeesRouter from "./employees";
import expensesRouter from "./expenses";
import vatRouter from "./vat";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/sales", salesRouter);
router.use("/purchases", purchasesRouter);
router.use("/suppliers", suppliersRouter);
router.use("/supplier-products", suppliersRouter);
router.use("/employees", employeesRouter);
router.use("/expenses", expensesRouter);
router.use("/vat", vatRouter);
router.use("/dashboard", dashboardRouter);

export default router;
