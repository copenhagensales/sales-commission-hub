import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { LocationRateSurcharge } from "@/utils/locationRateSurcharge";

/**
 * Aktive butikstillæg (merpriser) for en lokationstype.
 * Grundsatsen på lokationen berøres ikke - tillægget lægges oven på.
 */
export function useLocationRateSurcharges(locationType?: string) {
  return useQuery({
    queryKey: ["location-rate-surcharges", locationType],
    queryFn: async (): Promise<LocationRateSurcharge[]> => {
      if (!locationType) return [];
      const { data, error } = await supabase
        .from("location_rate_surcharges")
        .select("*")
        .eq("location_type", locationType)
        .eq("is_active", true)
        .order("valid_from", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        location_type: r.location_type,
        chain_match: r.chain_match,
        surcharge_per_day: Number(r.surcharge_per_day),
        funded_by_client_id: r.funded_by_client_id,
        valid_from: r.valid_from,
        valid_to: r.valid_to,
        is_active: r.is_active,
        note: r.note,
      }));
    },
    enabled: !!locationType,
  });
}
