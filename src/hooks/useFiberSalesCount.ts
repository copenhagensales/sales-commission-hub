import { useQuery } from "@tanstack/react-query";

/**
 * Tæller antal fiber-salg (sum af quantity) for en periode.
 * Ekskluderer Lead Provi-varianter — kun Lukket/Fuldt HAP+VOK.
 *
 * Kalder altid `tv-dashboard-data` edge function (service role) — både i
 * TV-mode og auth-mode. RLS på `sale_items` skjuler andre sælgeres rækker
 * for almindelige sælgere.
 */
export function useFiberSalesCount(
  periodStart: Date,
  periodEnd: Date,
  enabled: boolean = true,
) {
  const startIso = periodStart.toISOString();
  const endIso = periodEnd.toISOString();

  return useQuery<number>({
    queryKey: ["fiber-sales-count", startIso, endIso],
    enabled,
    staleTime: 60_000,
    refetchInterval: 120_000,
    queryFn: async () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(
        `${supabaseUrl}/functions/v1/tv-dashboard-data?action=fiber-sales-count&start=${encodeURIComponent(
          startIso,
        )}&end=${encodeURIComponent(endIso)}`,
      );
      if (!res.ok) throw new Error(`fiber-sales-count fetch failed: ${res.status}`);
      const json = await res.json();
      return Number(json?.count ?? 0);
    },
  });
}
