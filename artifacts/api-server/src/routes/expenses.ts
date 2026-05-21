/**
 * LEGACY ROUTE — DEPRECATED.
 *
 * The legacy `expenses` table has been merged into the unified Expenses
 * Management module (fixed_cost_templates + expense_transactions). All rows
 * have been migrated; the table is intentionally empty.
 *
 * - GET endpoints still respond (always empty list) so any old frontend that
 *   hasn't been updated yet keeps working without crashing.
 * - WRITE endpoints (POST/PUT/DELETE) respond with 410 Gone + a helpful
 *   message pointing callers to the new endpoints. This prevents new rows
 *   from being inserted into the deprecated table and silently diverging
 *   from the unified model.
 *
 * New endpoints:
 *   • Recurring/fixed items → /api/fixed-costs/*
 *   • Transactions          → /api/expense-categories/transactions
 */
import { Router, type IRouter } from "express";

const router: IRouter = Router();

const DEPRECATION_MSG = {
  error: "Endpoint deprecated",
  message:
    "The legacy /api/expenses endpoints have been merged into the unified " +
    "Expenses Management module. Use /api/fixed-costs/* for recurring items " +
    "(rent, utilities, salaries, subscriptions, …) and " +
    "/api/expense-categories/transactions for one-off ledger entries.",
  migrationDate: "2026-05-21",
};

// GET endpoints — return empty list, keeps stale clients alive
router.get("/", (_req, res) => res.json([]));

// All write endpoints — block with 410 Gone
router.post   ("/",    (_req, res) => res.status(410).json(DEPRECATION_MSG));
router.put    ("/:id", (_req, res) => res.status(410).json(DEPRECATION_MSG));
router.delete ("/:id", (_req, res) => res.status(410).json(DEPRECATION_MSG));
router.patch  ("/:id", (_req, res) => res.status(410).json(DEPRECATION_MSG));

export default router;
