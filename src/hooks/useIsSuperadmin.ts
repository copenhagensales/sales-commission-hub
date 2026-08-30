import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Superadmin er den øverste adgang til løn- og overskudstal (DB).
 *
 * Rollen ligger som DATA i tabellen `superadmins` (seedet ud fra e-mail) —
 * ikke som en hardkodet liste i koden. Databasen håndhæver adgangen med RLS,
 * så denne hook alene bruges til at vise/skjule i brugerfladen. En bruger uden
 * rollen får tomme resultater, selv hvis API'et kaldes direkte.
 *
 * Kun en superadmin kan tildele eller fjerne rollen — heller ikke en `ejer`
 * kan give sig selv adgang.
 */
export function useIsSuperadmin() {
  const { user, loading: authLoading } = useAuth();

  const query = useQuery({
    queryKey: ["is-superadmin", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("am_i_superadmin");
      if (error) return false;
      return data === true;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  return {
    isSuperadmin: query.data === true,
    isLoading: authLoading || (!!user?.id && query.isLoading),
  };
}
