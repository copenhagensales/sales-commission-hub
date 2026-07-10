import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FIBER_SALE_PRODUCT_IDS } from "@/config/fiberBoardPoints";

/**
 * Tæller antal fiber-salg (sum af quantity) for en periode.
 * Ekskluderer Lead Provi-varianter — kun Lukket/Fuldt HAP+VOK.
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
      let total = 0;
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("sale_items")
          .select("quantity, is_cancelled, sales!inner(sale_datetime)")
          .in("product_id", FIBER_SALE_PRODUCT_IDS)
          .gte("sales.sale_datetime", startIso)
          .lt("sales.sale_datetime", endIso)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const row of data as any[]) {
          if (row.is_cancelled) continue;
          total += Number(row.quantity ?? 0);
        }
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return total;
    },
  });
}
