import { useQueryClient } from "@tanstack/react-query";
import {
  useCreatePurchase,
  useUpdatePurchase,
  useDeletePurchase,
  getListPurchasesQueryKey,
} from "@workspace/api-client-react";
import { useInvalidateFinancials } from "./use-invalidate-financials";

export function usePurchasesMutations() {
  const queryClient = useQueryClient();
  const invalidateFinancials = useInvalidateFinancials();

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: getListPurchasesQueryKey() });
    invalidateFinancials();
  };

  const create = useCreatePurchase({ mutation: { onSuccess: invalidateQueries } });
  const update = useUpdatePurchase({ mutation: { onSuccess: invalidateQueries } });
  const remove = useDeletePurchase({ mutation: { onSuccess: invalidateQueries } });

  return { create, update, remove };
}
