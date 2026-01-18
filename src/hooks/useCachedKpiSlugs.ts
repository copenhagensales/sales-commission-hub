import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCachedKpiSlugs() {
  return useQuery({
    queryKey: ["cached-kpi-slugs"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_distinct_cached_kpi_slugs");

      if (error) throw error;

      return data?.map((d) => d.kpi_slug) || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
