import { useQuery } from "@tanstack/react-query";

export interface CelebrationTriggerData {
  employeeName: string | null;
  salesCount: number;
  commission: number;
  metricValue: number;
  salesToday: number;
  salesMonth: number;
  salesWeek: number;
  totalSales: number;
  commissionToday: number;
  commissionMonth: number;
  goalProgress: number;
  goalTarget: number;
  goalRemaining: number;
}

interface UseTvCelebrationDataParams {
  dashboardSlug: string | null;
  metric: string;
  enabled?: boolean;
}

/**
 * Hook for fetching celebration trigger data via edge function (bypasses RLS for TV boards)
 */
export function useTvCelebrationData({
  dashboardSlug,
  metric,
  enabled = true,
}: UseTvCelebrationDataParams) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["tv-celebration-data", dashboardSlug, metric],
    queryFn: async (): Promise<CelebrationTriggerData> => {
      console.log("[TvCelebrationData] Fetching via edge function:", { dashboardSlug, metric });
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/tv-dashboard-data?action=celebration-data&dashboard=${dashboardSlug}&metric=${metric}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[TvCelebrationData] Edge function error:", errorText);
        throw new Error(`Failed to fetch celebration data: ${response.status}`);
      }

      const result = await response.json();
      console.log("[TvCelebrationData] Received data:", result);
      return result;
    },
    enabled: enabled && !!dashboardSlug,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  return {
    data,
    isLoading,
    refetch,
  };
}
