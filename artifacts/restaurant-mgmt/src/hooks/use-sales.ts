import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateSale,
  useUpdateSale,
  useDeleteSale,
  getListSalesQueryKey,
} from "@workspace/api-client-react";
import { useInvalidateFinancials } from "./use-invalidate-financials";

export function useSalesMutations() {
  const queryClient = useQueryClient();
  const invalidateFinancials = useInvalidateFinancials();

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: getListSalesQueryKey() });
    invalidateFinancials(); // P&L, VAT, dashboard, monthly summaries — all live
  };

  const create = useCreateSale({ mutation: { onSuccess: invalidateQueries } });
  const update = useUpdateSale({ mutation: { onSuccess: invalidateQueries } });
  const remove = useDeleteSale({ mutation: { onSuccess: invalidateQueries } });

  return { create, update, remove };
}
