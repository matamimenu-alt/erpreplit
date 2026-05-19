import { Router, type IRouter } from "express";
import healthRouter from "./health";
import salesRouter from "./sales";
import purchasesRouter from "./purchases";
import suppliersRouter from "./suppliers";
import employeesRouter from "./employees";
import expensesRouter from "./expenses";
import inventoryRouter from "./inventory";
import stockRouter from "./stock";
import vatRouter from "./vat";
import dashboardRouter from "./dashboard";
import reportsRouter from "./reports";
import { restaurantsRouter, seedRestaurants } from "./restaurants";
import dishesRouter from "./dishes";
import fixedCostsRouter from "./fixed-costs";
import expenseAccountingRouter, { seedExpenseCategories } from "./expense-accounting";
import expenseIntegrationsRouter from "./expense-integrations";

const router: IRouter = Router();

seedRestaurants().catch(console.error);
seedExpenseCategories().catch(console.error);

router.use(healthRouter);
router.use("/restaurants", restaurantsRouter);
router.use("/sales", salesRouter);
router.use("/purchases", purchasesRouter);
router.use("/suppliers", suppliersRouter);
router.use("/supplier-products", suppliersRouter);
router.use("/employees", employeesRouter);
router.use("/expenses", expensesRouter);
router.use("/inventory", inventoryRouter);
router.use("/stock", stockRouter);
router.use("/vat", vatRouter);
router.use("/dashboard", dashboardRouter);
router.use("/reports", reportsRouter);
router.use("/dishes", dishesRouter);
router.use("/fixed-costs", fixedCostsRouter);
router.use("/expense-categories", expenseAccountingRouter);
router.use("/expense-integrations", expenseIntegrationsRouter);

export default router;
