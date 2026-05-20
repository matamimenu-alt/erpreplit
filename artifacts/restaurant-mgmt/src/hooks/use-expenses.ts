import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateExpense,
  useUpdateExpense,
  useDeleteExpense,
  getListExpensesQueryKey,
} from "@workspace/api-client-react";
import { useInvalidateFinancials } from "./use-invalidate-financials";

export function useExpenseMutations() {
  const queryClient = useQueryClient();
  const invalidateFinancials = useInvalidateFinancials();

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: getListExpensesQueryKey() });
    invalidateFinancials();
  };

  const create = useCreateExpense({ mutation: { onSuccess: invalidateQueries } });
  const update = useUpdateExpense({ mutation: { onSuccess: invalidateQueries } });
  const remove = useDeleteExpense({ mutation: { onSuccess: invalidateQueries } });

  return { create, update, remove };
}
