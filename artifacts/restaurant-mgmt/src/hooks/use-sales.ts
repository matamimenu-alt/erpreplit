import { useQueryClient } from "@tanstack/react-query";
import { 
  useCreateSale, 
  useUpdateSale, 
  useDeleteSale,
  getListSalesQueryKey,
  getGetMonthlySalesSummaryQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetVatReportQueryKey
} from "@workspace/api-client-react";

export function useSalesMutations() {
  const queryClient = useQueryClient();

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: getListSalesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetMonthlySalesSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetVatReportQueryKey() });
  };

  const create = useCreateSale({ mutation: { onSuccess: invalidateQueries } });
  const update = useUpdateSale({ mutation: { onSuccess: invalidateQueries } });
  const remove = useDeleteSale({ mutation: { onSuccess: invalidateQueries } });

  return { create, update, remove };
}
