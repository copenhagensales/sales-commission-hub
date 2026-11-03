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
  hasLegacyCoopRefund,
} from "@/lib/fm/directRefunds";

/**
 * Refusion til den selvstændige "Coop direkte"-rapport, aldrig Coop butik.
 */
export function useDirectRefunds(locationType: string | undefined, periodStart: Date, periodEnd: Date) {
  const { data: rules } = useLocationRateSurcharges(COOP_LOCATION_TYPE);
  const enabled = locationType === COOP_DIREKTE_TYPE && !!rules;
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

/** Ingen ny godkendelse oven i en tidligere Coop-opkrævning. Kun metadata. */
export function useLegacyDirectRefundConflict(enabled: boolean, periodStart: Date, periodEnd: Date) {
  const start = format(periodStart, "yyyy-MM-dd");
  const end = format(periodEnd, "yyyy-MM-dd");
  return useQuery({
    queryKey: ["supplier-report", "legacy-direct-refund", start, end],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("supplier_invoice_reports")
        .select("location_type, period_start, period_end, status, direct_refund_amount")
        .eq("location_type", COOP_LOCATION_TYPE).in("status", ["approved", "sent"])
        .gt("direct_refund_amount", 0).lte("period_start", end).gte("period_end", start);
      if (error) throw error;
      return hasLegacyCoopRefund(data ?? [], start, end);
    },
  });
}
