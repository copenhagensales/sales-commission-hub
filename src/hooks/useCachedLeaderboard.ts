import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { REFRESH_PROFILES } from "@/utils/tvMode";

export type LeaderboardPeriod = "today" | "this_week" | "this_month" | "payroll_period";
export type LeaderboardScope = { type: "global" | "client" | "team"; id?: string | null };

export interface LeaderboardEntry {
  employeeId: string;
  employeeName: string;
  displayName: string;
  avatarUrl: string | null;
  teamName: string | null;
  salesCount: number;
  crossSaleCount: number;
  commission: number;
  goalTarget: number | null;
}

/**
 * Hook to fetch cached leaderboard data from kpi_leaderboard_cache
 * Falls back to empty array if cache miss
 */
export function useCachedLeaderboard(
  period: LeaderboardPeriod,
  scope: LeaderboardScope = { type: "global" },
  options?: { enabled?: boolean; limit?: number }
) {
  const { enabled = true, limit = 20 } = options || {};
  
  return useQuery({
    queryKey: ["cached-leaderboard", period, scope.type, scope.id, limit],
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      let query = supabase
        .from("kpi_leaderboard_cache")
        .select("leaderboard_data, calculated_at")
        .eq("period_type", period)
        .eq("scope_type", scope.type);
      
      if (scope.id) {
        query = query.eq("scope_id", scope.id);
      } else {
        query = query.is("scope_id", null);
      }
      
      // Order by calculated_at desc and take the most recent one
      // This handles cases where there might be duplicate entries
      const { data, error } = await query
        .order("calculated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error("Error fetching cached leaderboard:", error);
        return [];
      }
      
      if (!data) {
        console.log(`No cached leaderboard for ${period}/${scope.type}/${scope.id || 'global'}`);
        return [];
      }
      
      // Parse the JSONB data - it comes as unknown from Supabase
      const leaderboardData = data.leaderboard_data as unknown;
      const entries = Array.isArray(leaderboardData) ? leaderboardData as LeaderboardEntry[] : [];
      
      // Apply limit
      return entries.slice(0, limit);
    },
    enabled,
    ...REFRESH_PROFILES.dashboard,
  });
}

/**
 * Hook to fetch multiple leaderboard periods at once (for dashboards showing all 3)
 */
export function useCachedLeaderboards(
  scope: LeaderboardScope = { type: "global" },
  options?: { enabled?: boolean; limit?: number }
) {
  const { enabled = true, limit = 20 } = options || {};
  
  const todayQuery = useCachedLeaderboard("today", scope, { enabled, limit });
  const weekQuery = useCachedLeaderboard("this_week", scope, { enabled, limit });
  const payrollQuery = useCachedLeaderboard("payroll_period", scope, { enabled, limit });
  
  return {
    sellersToday: todayQuery.data || [],
    sellersWeek: weekQuery.data || [],
    sellersPayroll: payrollQuery.data || [],
    isLoading: todayQuery.isLoading || weekQuery.isLoading || payrollQuery.isLoading,
    isError: todayQuery.isError || weekQuery.isError || payrollQuery.isError,
  };
}

/**
 * Format display name as "Firstname L."
 */
export function formatDisplayName(fullName: string): string {
  const parts = fullName.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  }
  return fullName;
}

/**
 * Get initials from name
 */
export function getInitials(name: string): string {
  if (!name) return "??";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}
