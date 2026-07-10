import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FIBER_BOARD_POINTS, FIBER_PRODUCT_IDS } from "@/config/fiberBoardPoints";

export interface FiberEmployeeStats {
  points: number;
  commission: number;
}

export type FiberStatsMap = Record<string, FiberEmployeeStats>;

/**
 * Aggregerer fiber-point og fiber-provision pr. sælger for en given periode.
 * `sales` har ingen employee_id — vi resolver `agent_email` via
 * `employee_agent_mapping` (samme mønster som useSalesAggregatesExtended,
 * så nøglen matcher cached leaderboard).
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
      for (const row of itemsResult) {
        if (row.is_cancelled) continue;
        const rawEmail: string | undefined = row.sales?.agent_email;
        if (!rawEmail) continue;
        const email = rawEmail.toLowerCase();
        const key = emailToEmployeeId[email] || email;

        const qty = Number(row.quantity ?? 0);
        const commission = Number(row.mapped_commission ?? 0);
        const pointsPerUnit = FIBER_BOARD_POINTS[row.product_id] ?? 0;

        const entry = result[key] ?? { points: 0, commission: 0 };
        entry.points += pointsPerUnit * qty;
        entry.commission += commission;
        result[key] = entry;
      }

      return result;
    },
  });
}
