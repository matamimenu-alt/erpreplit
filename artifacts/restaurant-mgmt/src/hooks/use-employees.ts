import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
  getListEmployeesQueryKey,
} from "@workspace/api-client-react";
import { useInvalidateFinancials } from "./use-invalidate-financials";

export function useEmployeeMutations() {
  const queryClient = useQueryClient();
  const invalidateFinancials = useInvalidateFinancials();

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
    invalidateFinancials();
  };

  const create = useCreateEmployee({ mutation: { onSuccess: invalidateQueries } });
  const update = useUpdateEmployee({ mutation: { onSuccess: invalidateQueries } });
  const remove = useDeleteEmployee({ mutation: { onSuccess: invalidateQueries } });

  return { create, update, remove };
}
