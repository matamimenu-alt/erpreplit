import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export function useReportData<T>(endpoint: string, params?: Record<string, string | number | null | undefined>, enabled = true) {
  const searchParams = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== "") searchParams.set(key, String(value));
    }
  }
  const qs = searchParams.toString();
  const url = `/api/reports/${endpoint}${qs ? `?${qs}` : ""}`;

  return useQuery<T>({
    queryKey: [url],
    queryFn: () => customFetch<T>(url),
    enabled,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
