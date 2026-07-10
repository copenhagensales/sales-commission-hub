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
 * Læser `sale_items` (ekskl. annullerede) joinet med `sales.sale_datetime`.
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
      const result: FiberStatsMap = {};
      const pageSize = 1000;
      let from = 0;

      while (true) {
        const { data, error } = await supabase
          .from("sale_items")
          .select(
            "product_id, quantity, mapped_commission, is_cancelled, sales!inner(employee_id, sale_datetime)",
          )
          .in("product_id", FIBER_PRODUCT_IDS)
          .gte("sales.sale_datetime", startIso)
          .lt("sales.sale_datetime", endIso)
          .range(from, from + pageSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        for (const row of data as any[]) {
          if (row.is_cancelled) continue;
          const employeeId: string | null = row.sales?.employee_id ?? null;
          if (!employeeId) continue;
          const productId: string = row.product_id;
          const qty = Number(row.quantity ?? 0);
          const commission = Number(row.mapped_commission ?? 0);
          const pointsPerUnit = FIBER_BOARD_POINTS[productId] ?? 0;

          const entry = result[employeeId] ?? { points: 0, commission: 0 };
          entry.points += pointsPerUnit * qty;
          entry.commission += commission;
          result[employeeId] = entry;
        }

        if (data.length < pageSize) break;
        from += pageSize;
      }

      return result;
    },
  });
}
