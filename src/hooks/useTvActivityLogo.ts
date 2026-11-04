import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const TV_ACTIVITY_LOGO_QUERY_KEY = ["tv-activity-hiper-logo"] as const;

/** Logo only; denied access or unavailable data leaves the text fallback intact. */
export function useTvActivityLogo() {
  return useQuery({
    queryKey: TV_ACTIVITY_LOGO_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("logo_url")
        .ilike("name", "Hiper")
        .maybeSingle();
      if (error) throw error;
      return data?.logo_url ?? null;
    },
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
}