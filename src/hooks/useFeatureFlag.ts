import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useFeatureFlag(key: string): boolean {
  const { data } = useQuery({
    queryKey: ["feature-flag", key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_flags")
        .select("enabled")
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      return data?.enabled ?? false;
    },
    staleTime: 60_000, // Cache for 1 min
    refetchOnWindowFocus: false,
  });

  return data ?? false;
}
