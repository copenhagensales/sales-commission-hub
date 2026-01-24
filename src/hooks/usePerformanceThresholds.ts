import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PerformanceThresholds {
  flying: number;   // >= dette = "Flyver!"
  ahead: number;    // >= dette = "Foran plan"  
  close: number;    // >= dette = "Tæt på"
  // Under close = "Hent ind"
}

export const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  flying: 120,
  ahead: 100,
  close: 90,
};

export function usePerformanceThresholds() {
  return useQuery({
    queryKey: ["performance-thresholds"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kpi_definitions")
        .select("example_value")
        .eq("slug", "relative_performance_thresholds")
        .eq("is_active", true)
        .maybeSingle();

      if (error || !data?.example_value) {
        return DEFAULT_THRESHOLDS;
      }

      try {
        return JSON.parse(data.example_value) as PerformanceThresholds;
      } catch {
        return DEFAULT_THRESHOLDS;
      }
    },
    staleTime: 1000 * 60 * 60, // Cache 1 time
  });
}
