import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLocationRateSurcharges } from "@/hooks/useLocationRateSurcharges";
import { matchSurcharge } from "@/utils/locationRateSurcharge";
import { lokationsRefusion, tillaegsRefusion, type RefusionLinjeData } from "@/lib/fm/refusionLinje";

interface LocationRefundRow {
  id: string;
  name: string | null;
  type: string | null;
  daily_rate: number | null;
  gross_daily_rate: number | null;
  refund_daily_rate: number | null;
  refund_client_id: string | null;
}

/** Visningslinje for refusion på en lokation (direkte eller via bookingens lokation). */
export function useLocationRefundLine(opts: { locationId?: string | null; bookingId?: string | null }) {
  const { data: loc } = useQuery({
    queryKey: ["location-refund-line", opts.locationId ?? null, opts.bookingId ?? null],
    queryFn: async (): Promise<LocationRefundRow | null> => {
      let locationId = opts.locationId ?? null;
      if (!locationId && opts.bookingId) {
        const { data, error } = await supabase.from("booking").select("location_id").eq("id", opts.bookingId).maybeSingle();
        if (error) throw error;
        locationId = data?.location_id ?? null;
      }
      if (!locationId) return null;
      const { data, error } = await supabase
        .from("location")
        .select("id, name, type, daily_rate, gross_daily_rate, refund_daily_rate, refund_client_id")
        .eq("id", locationId)
        .maybeSingle();
      if (error) throw error;
      return (data as LocationRefundRow | null) ?? null;
    },
    enabled: !!(opts.locationId || opts.bookingId),
  });

  const { data: surcharges } = useLocationRateSurcharges(loc?.type ?? undefined);
  const rule = matchSurcharge(loc?.name ?? null, surcharges);
  const clientId = loc?.refund_daily_rate ? loc.refund_client_id : rule?.funded_by_client_id ?? null;

  const { data: clientName } = useQuery({
    queryKey: ["client-name", clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("name").eq("id", clientId!).maybeSingle();
      if (error) throw error;
      return data?.name ?? null;
    },
    enabled: !!clientId,
  });

  if (!loc) return null;
  const toNum = (v: number | null) => (v == null ? null : Number(v));
  const direct = lokationsRefusion({
    dailyRate: toNum(loc.daily_rate),
    grossDailyRate: toNum(loc.gross_daily_rate),
    refundDailyRate: toNum(loc.refund_daily_rate),
    refundClientName: clientName ?? null,
  });
  if (direct) return direct as RefusionLinjeData;
  if (rule) {
    return tillaegsRefusion({
      dailyRate: toNum(loc.daily_rate),
      surchargePerDay: Number(rule.surcharge_per_day),
      fundedByName: clientName ?? null,
    });
  }
  return null;
}
