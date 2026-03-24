import { useQueryClient } from "@tanstack/react-query";
import { 
  useCreatePurchase, 
  useUpdatePurchase, 
  useDeletePurchase,
  getListPurchasesQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetVatReportQueryKey,
  getGetPLReportQueryKey,
  getGetMonthlyPurchaseReportQueryKey,
  getGetCategoryExpenseReportQueryKey,
} from "@workspace/api-client-react";

export function usePurchasesMutations() {
  const queryClient = useQueryClient();

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: getListPurchasesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetVatReportQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetPLReportQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetMonthlyPurchaseReportQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetCategoryExpenseReportQueryKey() });
  };

  const create = useCreatePurchase({ mutation: { onSuccess: invalidateQueries } });
  const update = useUpdatePurchase({ mutation: { onSuccess: invalidateQueries } });
  const remove = useDeletePurchase({ mutation: { onSuccess: invalidateQueries } });

  return { create, update, remove };
}
