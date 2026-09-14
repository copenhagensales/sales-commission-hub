import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { setDisplayNameOverrides } from "@/lib/displayNameOverrides";

/**
 * Henter de få medarbejdere der har et manuelt kort visningsnavn
 * (fx "William S." i stedet for den automatiske forkortelse).
 * Resultatet lægges i en modul-cache, som formatteringsfunktionerne slår op i.
 */
export function useDisplayNameOverrides() {
  return useQuery({
    queryKey: ["display-name-overrides"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_display_name_overrides");
      if (error) throw error;
      const rows = (data ?? []) as { full_name: string | null; display_name_short: string | null }[];
      setDisplayNameOverrides(rows);
      return rows;
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
