import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface WeeklyMetrics {
  id: string;
  week_start_date: string;
  tiktok_followers: number;
  tiktok_views: number;
  tiktok_likes: number;
  insta_followers: number;
  insta_views: number;
  insta_likes: number;
}

export function useSomeMetrics(weekStartDate: string, previousWeekStartDate?: string) {
  const queryClient = useQueryClient();

  const { data: currentMetrics, isLoading: isLoadingCurrent } = useQuery({
    queryKey: ["some-metrics", weekStartDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("some_weekly_metrics")
        .select("*")
        .eq("week_start_date", weekStartDate)
        .maybeSingle();
      
      if (error) throw error;
      return data as WeeklyMetrics | null;
    },
  });

  const { data: previousMetrics, isLoading: isLoadingPrevious } = useQuery({
    queryKey: ["some-metrics", previousWeekStartDate],
    queryFn: async () => {
      if (!previousWeekStartDate) return null;
      const { data, error } = await supabase
        .from("some_weekly_metrics")
        .select("*")
        .eq("week_start_date", previousWeekStartDate)
        .maybeSingle();
      
      if (error) throw error;
      return data as WeeklyMetrics | null;
    },
    enabled: !!previousWeekStartDate,
  });

  const { data: historicalMetrics = [], isLoading: isLoadingHistory } = useQuery({
    queryKey: ["some-metrics-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("some_weekly_metrics")
        .select("*")
        .order("week_start_date", { ascending: true });
      
      if (error) throw error;
      return data as WeeklyMetrics[];
    },
  });

  const upsertMetrics = useMutation({
    mutationFn: async (metrics: Omit<WeeklyMetrics, "id">) => {
      const { data, error } = await supabase
        .from("some_weekly_metrics")
        .upsert(
          { ...metrics },
          { onConflict: "week_start_date" }
        )
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["some-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["some-metrics-history"] });
      toast.success("Metrics gemt");
    },
    onError: () => {
      toast.error("Kunne ikke gemme metrics");
    },
  });

  return {
    currentMetrics,
    previousMetrics,
    historicalMetrics,
    isLoading: isLoadingCurrent || isLoadingHistory || isLoadingPrevious,
    upsertMetrics: upsertMetrics.mutate,
  };
}
