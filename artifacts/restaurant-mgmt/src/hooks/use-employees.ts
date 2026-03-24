import { useQueryClient } from "@tanstack/react-query";
import { 
  useCreateEmployee, 
  useUpdateEmployee, 
  useDeleteEmployee,
  getListEmployeesQueryKey,
  getGetDashboardSummaryQueryKey
} from "@workspace/api-client-react";

export function useEmployeeMutations() {
  const queryClient = useQueryClient();

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const create = useCreateEmployee({ mutation: { onSuccess: invalidateQueries } });
  const update = useUpdateEmployee({ mutation: { onSuccess: invalidateQueries } });
  const remove = useDeleteEmployee({ mutation: { onSuccess: invalidateQueries } });

  return { create, update, remove };
}
