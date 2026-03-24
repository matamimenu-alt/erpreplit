import { useQueryClient } from "@tanstack/react-query";
import { 
  useCreateExpense, 
  useUpdateExpense, 
  useDeleteExpense,
  getListExpensesQueryKey,
  getGetDashboardSummaryQueryKey
} from "@workspace/api-client-react";

export function useExpenseMutations() {
  const queryClient = useQueryClient();

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: getListExpensesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const create = useCreateExpense({ mutation: { onSuccess: invalidateQueries } });
  const update = useUpdateExpense({ mutation: { onSuccess: invalidateQueries } });
  const remove = useDeleteExpense({ mutation: { onSuccess: invalidateQueries } });

  return { create, update, remove };
}
