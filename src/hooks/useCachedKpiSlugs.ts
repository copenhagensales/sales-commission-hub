import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCachedKpiSlugs() {
  return useQuery({
    queryKey: ["cached-kpi-slugs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kpi_cached_values")
        .select("kpi_slug");

      if (error) throw error;

      // Return unique slugs
      return [...new Set(data?.map((d) => d.kpi_slug) || [])];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
