import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  buildDirectRefunds,
  COOP_LOCATION_TYPE,
  type DirectRefundBooking,
  type DirectRefundLine,
} from "@/lib/fm/directRefunds";

/**
 * Direkte afregnede kæde-lokationer til refusionsdelen af Coop-rapporten.
 * Kun aktiv for lokationstypen "Coop butik".
 */
export function useDirectRefunds(locationType: string | undefined, periodStart: Date, periodEnd: Date) {
  const enabled = locationType === COOP_LOCATION_TYPE;
  return useQuery({
    queryKey: [
      "supplier-direct-refunds",
      locationType,
      format(periodStart, "yyyy-MM-dd"),
      format(periodEnd, "yyyy-MM-dd"),
    ],
    queryFn: async (): Promise<DirectRefundLine[]> => {
      const { data, error } = await supabase
        .from("booking")
        .select(
          "id, start_date, end_date, booked_days, status, client_id, location!inner(id, name, type, chain, daily_rate, refund_daily_rate, refund_client_id)"
        )
        .eq("status", "confirmed")
        .not("location.chain", "is", null)
        .gt("location.refund_daily_rate", 0)
        .neq("location.type", COOP_LOCATION_TYPE)
        .lte("start_date", format(periodEnd, "yyyy-MM-dd"))
        .gte("end_date", format(periodStart, "yyyy-MM-dd"));
      if (error) throw error;
      const bookings = (data ?? []) as unknown as DirectRefundBooking[];
      const clientIds = [
        ...new Set(bookings.map((b) => b.location?.refund_client_id).filter((v): v is string => !!v)),
      ];
      const names: Record<string, string> = {};
      if (clientIds.length) {
        const { data: clients, error: cErr } = await supabase
          .from("clients")
          .select("id, name")
          .in("id", clientIds);
        if (cErr) throw cErr;
        for (const c of clients ?? []) names[c.id] = c.name;
      }
      return buildDirectRefunds(bookings, periodStart, periodEnd, names);
    },
    enabled,
  });
}
