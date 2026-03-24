import { useQueryClient } from "@tanstack/react-query";
import { 
  useCreatePurchase, 
  useUpdatePurchase, 
  useDeletePurchase,
  getListPurchasesQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetVatReportQueryKey
} from "@workspace/api-client-react";

export function usePurchasesMutations() {
  const queryClient = useQueryClient();

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: getListPurchasesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetVatReportQueryKey() });
  };

  const create = useCreatePurchase({ mutation: { onSuccess: invalidateQueries } });
  const update = useUpdatePurchase({ mutation: { onSuccess: invalidateQueries } });
  const remove = useDeletePurchase({ mutation: { onSuccess: invalidateQueries } });

  return { create, update, remove };
}
