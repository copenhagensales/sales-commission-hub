import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FIBER_BOARD_POINTS, FIBER_PRODUCT_IDS } from "@/config/fiberBoardPoints";
import { isTvMode } from "@/utils/tvMode";

export interface FiberEmployeeStats {
  points: number;
  commission: number;
  name?: string;
  avatarUrl?: string | null;
}

export type FiberStatsMap = Record<string, FiberEmployeeStats>;

/**
 * Aggregerer fiber-point og fiber-provision pr. sælger for en given periode.
 * `sales` har ingen employee_id — vi resolver `agent_email` via
 * `employee_agent_mapping` (samme mønster som useSalesAggregatesExtended,
 * så nøglen matcher cached leaderboard).
 *
 * TV-mode: kaldes via `tv-dashboard-data` edge function (service role,
 * bypass RLS) — anon-brugere kan ikke læse sale_items direkte.
 */
export function useFiberBoardStats(
  periodStart: Date,
  periodEnd: Date,
  enabled: boolean = true,
) {
  const startIso = periodStart.toISOString();
  const endIso = periodEnd.toISOString();
  const tv = isTvMode();

  return useQuery<FiberStatsMap>({
    queryKey: ["fiber-board-stats", startIso, endIso, tv ? "tv" : "auth"],
    enabled,
    staleTime: 60_000,
    refetchInterval: 120_000,
    queryFn: async () => {
      if (tv) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const res = await fetch(
          `${supabaseUrl}/functions/v1/tv-dashboard-data?action=fiber-board-stats&start=${encodeURIComponent(
            startIso,
          )}&end=${encodeURIComponent(endIso)}`,
        );
        if (!res.ok) throw new Error(`fiber-board-stats TV fetch failed: ${res.status}`);
        return (await res.json()) as FiberStatsMap;
      }

      const [itemsResult, mappingResult] = await Promise.all([
        (async () => {
          const rows: any[] = [];
          const pageSize = 1000;
          let from = 0;
          while (true) {
            const { data, error } = await supabase
              .from("sale_items")
              .select(
                "product_id, quantity, mapped_commission, is_cancelled, sales!inner(agent_email, sale_datetime)",
              )
              .in("product_id", FIBER_PRODUCT_IDS)
              .gte("sales.sale_datetime", startIso)
              .lt("sales.sale_datetime", endIso)
              .range(from, from + pageSize - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            rows.push(...data);
            if (data.length < pageSize) break;
            from += pageSize;
          }
          return rows;
        })(),
        supabase
          .from("employee_agent_mapping")
          .select("employee_id, agents!inner(email)")
          .then((r) => r.data || []),
      ]);

      // email (lowercased) -> employee_id
      const emailToEmployeeId: Record<string, string> = {};
      for (const m of mappingResult as any[]) {
        const email = m.agents?.email?.toLowerCase();
        if (email && m.employee_id) emailToEmployeeId[email] = m.employee_id;
      }

      const result: FiberStatsMap = {};
      const emailByKey: Record<string, string> = {};

      for (const row of itemsResult) {
        if (row.is_cancelled) continue;
        const rawEmail: string | undefined = row.sales?.agent_email;
        if (!rawEmail) continue;
        const email = rawEmail.toLowerCase();
        const key = emailToEmployeeId[email] || email;
        emailByKey[key] = email;

        const qty = Number(row.quantity ?? 0);
        const commission = Number(row.mapped_commission ?? 0);
        const pointsPerUnit = FIBER_BOARD_POINTS[row.product_id] ?? 0;

        const entry = result[key] ?? { points: 0, commission: 0 };
        entry.points += pointsPerUnit * qty;
        entry.commission += commission;
        result[key] = entry;
      }

      // Lookup navn/avatar for employee-id nøgler
      const uuidKeys = Object.keys(result).filter((k) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k),
      );
      if (uuidKeys.length > 0) {
        const { data: employees } = await supabase
          .from("employee_master_data")
          .select("id, first_name, last_name, avatar_url")
          .in("id", uuidKeys);
        for (const emp of employees || []) {
          const entry = result[emp.id];
          if (!entry) continue;
          entry.name = `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim();
          entry.avatarUrl = emp.avatar_url;
        }
      }

      // Fallback-navn for email-nøgler (ingen mapping)
      for (const [key, entry] of Object.entries(result)) {
        if (entry.name) continue;
        const email = emailByKey[key] || key;
        entry.name = email.split("@")[0];
      }

      return result;
    },
  });
}
