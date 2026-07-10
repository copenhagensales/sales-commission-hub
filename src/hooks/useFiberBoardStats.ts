import { useQuery } from "@tanstack/react-query";

export interface FiberEmployeeStats {
  points: number;
  commission: number;
  name?: string;
  avatarUrl?: string | null;
}

export type FiberStatsMap = Record<string, FiberEmployeeStats>;

/**
 * Aggregerer fiber-point og fiber-provision pr. sælger for en given periode.
 *
 * Kalder altid `tv-dashboard-data` edge function (service role) — både i
 * TV-mode og auth-mode. RLS på `sale_items` skjuler andre sælgeres rækker
 * for almindelige sælgere, så direkte klient-læsning giver 0 for alle
 * undtagen den indloggede bruger. Edge functionen bypasser RLS og returnerer
 * aggregater for alle sælgere — hooksne bruges kun når `fiberBoard === true`
 * (kun TDC Erhverv-dashboardet).
 */
export function useFiberBoardStats(
  periodStart: Date,
  periodEnd: Date,
  enabled: boolean = true,
) {
  const startIso = periodStart.toISOString();
  const endIso = periodEnd.toISOString();

  return useQuery<FiberStatsMap>({
    queryKey: ["fiber-board-stats", startIso, endIso],
    enabled,
    staleTime: 60_000,
    refetchInterval: 120_000,
    queryFn: async () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(
        `${supabaseUrl}/functions/v1/tv-dashboard-data?action=fiber-board-stats&start=${encodeURIComponent(
          startIso,
        )}&end=${encodeURIComponent(endIso)}`,
      );
      if (!res.ok) throw new Error(`fiber-board-stats fetch failed: ${res.status}`);
      return (await res.json()) as FiberStatsMap;
    },
  });
}
