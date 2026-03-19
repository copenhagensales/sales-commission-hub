import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches today's provision for all given employee IDs using the central
 * get_sales_aggregates_v2 RPC grouped by employee.
 */
export function useLeagueTodayProvision(employeeIds: string[] | undefined) {
  return useQuery({
    queryKey: ["league-today-provision", employeeIds?.length],
    staleTime: 60_000,
    refetchInterval: 120_000,
    queryFn: async (): Promise<Record<string, number>> => {
      if (!employeeIds || employeeIds.length === 0) return {};

      // Today in Europe/Copenhagen
      const now = new Date();
      const copenhagenDate = new Date(
        now.toLocaleString("en-US", { timeZone: "Europe/Copenhagen" })
      );
      const yyyy = copenhagenDate.getFullYear();
      const mm = String(copenhagenDate.getMonth() + 1).padStart(2, "0");
      const dd = String(copenhagenDate.getDate()).padStart(2, "0");
      const todayStart = `${yyyy}-${mm}-${dd}T00:00:00+00:00`;
      const todayEnd = `${yyyy}-${mm}-${dd}T23:59:59+00:00`;

      const { data, error } = await supabase.rpc("get_sales_aggregates_v2", {
        p_start: todayStart,
        p_end: todayEnd,
        p_group_by: "employee",
      });

      if (error) throw error;

      const map: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        if (row.group_key) {
          map[row.group_key] = Number(row.total_commission) || 0;
        }
      });
      return map;
    },
    enabled: !!employeeIds && employeeIds.length > 0,
  });
}
