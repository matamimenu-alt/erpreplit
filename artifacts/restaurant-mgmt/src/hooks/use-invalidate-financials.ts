import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

/**
 * Returns a function that invalidates EVERY financial report + dashboard query.
 * Use this in mutation `onSuccess` for anything that can change Revenue, COGS,
 * Operating Expenses, Payroll, Fixed Costs, Transfers, or VAT — so the P&L,
 * VAT report, and dashboard refresh live, without needing to enumerate keys.
 *
 * Match rule: queryKey[0] starts with `/api/reports/` or `/api/dashboard/`,
 * OR `/api/vat/`, which covers pl, vat, category-expense, monthly-purchase,
 * monthly-sales-summary, dashboard-summary, etc.
 */
export function useInvalidateFinancials() {
  const qc = useQueryClient();

  return useCallback(() => {
    qc.invalidateQueries({
      predicate: q => {
        const first = String(q.queryKey?.[0] ?? "");
        return (
          first.startsWith("/api/reports/") ||
          first.startsWith("/api/dashboard") ||
          first.startsWith("/api/vat/") ||
          first.startsWith("/api/pl") ||
          first.startsWith("/api/expense-categories")
        );
      },
    });
  }, [qc]);
}
