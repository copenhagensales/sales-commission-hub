import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useLocationRateSurcharges } from "@/hooks/useLocationRateSurcharges";
import { COOP_DIREKTE_TYPE } from "@/lib/fm/coopDirekte";
import {
  buildDirectRefunds,
  COOP_LOCATION_TYPE,
  type DirectRefundBooking,
  type DirectRefundLine,
} from "@/lib/fm/directRefunds";

/**
 * "Coop direkte"-lokationer til refusionsdelen af Coop-rapporten.
 * Kun aktiv for lokationstypen "Coop butik".
 */
export function useDirectRefunds(locationType: string | undefined, periodStart: Date, periodEnd: Date) {
  const { data: rules } = useLocationRateSurcharges(COOP_LOCATION_TYPE);
  const enabled = locationType === COOP_LOCATION_TYPE && !!rules;
  return useQuery({
    queryKey: [
      "supplier-direct-refunds",
      locationType,
      format(periodStart, "yyyy-MM-dd"),
      format(periodEnd, "yyyy-MM-dd"),
      rules?.map((r) => `${r.id}:${r.surcharge_per_day}`).join(","),
    ],
    queryFn: async (): Promise<DirectRefundLine[]> => {
      const { data, error } = await supabase
        .from("booking")
        .select("id, start_date, end_date, booked_days, status, client_id, location!inner(id, name, type, daily_rate)")
        .eq("status", "confirmed")
        .eq("location.type", COOP_DIREKTE_TYPE)
        .lte("start_date", format(periodEnd, "yyyy-MM-dd"))
        .gte("end_date", format(periodStart, "yyyy-MM-dd"));
      if (error) throw error;
      const bookings = (data ?? []) as unknown as DirectRefundBooking[];
      const clientIds = [
        ...new Set((rules ?? []).map((r) => r.funded_by_client_id).filter((v): v is string => !!v)),
      ];
      const names: Record<string, string> = {};
      if (clientIds.length) {
        const { data: clients, error: cErr } = await supabase.from("clients").select("id, name").in("id", clientIds);
        if (cErr) throw cErr;
        for (const c of clients ?? []) names[c.id] = c.name;
      }
      return buildDirectRefunds(bookings, periodStart, periodEnd, rules, names);
    },
    enabled,
  });
}
