import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface LoginEvent {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string | null;
  logged_in_at: string;
  ip_address: string | null;
  user_agent: string | null;
  session_id: string | null;
}

interface LoginStats {
  user_email: string;
  user_name: string | null;
  login_count: number;
  last_login: string;
}

export function useLoginLog() {
  // Fetch recent login events (last 24 hours)
  const { data: recentLogins, isLoading: isLoadingRecent, refetch: refetchRecent } = useQuery({
    queryKey: ["login-events-recent"],
    queryFn: async () => {
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const { data, error } = await supabase
        .from("login_events")
        .select("*")
        .gte("logged_in_at", twentyFourHoursAgo.toISOString())
        .order("logged_in_at", { ascending: false });

      if (error) throw error;
      return data as LoginEvent[];
    },
  });

  // Fetch all login events for stats
  const { data: allLogins, isLoading: isLoadingAll } = useQuery({
    queryKey: ["login-events-all"],
    queryFn: async () => {
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const { data, error } = await supabase
        .from("login_events")
        .select("*")
        .gte("logged_in_at", twentyFourHoursAgo.toISOString());

      if (error) throw error;
      return data as LoginEvent[];
    },
  });

  // Calculate stats per user
  const loginStats: LoginStats[] = allLogins
    ? Object.values(
        allLogins.reduce((acc, event) => {
          if (!acc[event.user_email]) {
            acc[event.user_email] = {
              user_email: event.user_email,
              user_name: event.user_name,
              login_count: 0,
              last_login: event.logged_in_at,
            };
          }
          acc[event.user_email].login_count += 1;
          if (new Date(event.logged_in_at) > new Date(acc[event.user_email].last_login)) {
            acc[event.user_email].last_login = event.logged_in_at;
          }
          return acc;
        }, {} as Record<string, LoginStats>)
      ).sort((a, b) => b.login_count - a.login_count)
    : [];

  // Get unique active users (logged in within last 24 hours)
  const activeUsers = loginStats.length;

  return {
    recentLogins: recentLogins || [],
    loginStats,
    activeUsers,
    isLoading: isLoadingRecent || isLoadingAll,
    refetch: refetchRecent,
  };
}
