import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subMonths, format, eachDayOfInterval, isWeekend } from "date-fns";

interface PreviousPeriodData {
  previousPeriodTotal: number;
  previousPeriodAtSameDay: number;
  isLoading: boolean;
  hasData: boolean;
}

/**
 * Hook to fetch commission data from the previous payroll period for comparison.
 * Calculates:
 * - previousPeriodTotal: Total commission from the entire previous period
 * - previousPeriodAtSameDay: Commission accumulated by the same working day in previous period
 */
export function usePreviousPeriodComparison(
  employeeId: string,
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  currentDaysPassed: number
): PreviousPeriodData {
  // Calculate previous period dates (subtract 1 month)
  const previousPeriodStart = subMonths(currentPeriodStart, 1);
  const previousPeriodEnd = subMonths(currentPeriodEnd, 1);

  const { data, isLoading } = useQuery({
    queryKey: [
      "previous-period-comparison",
      employeeId,
      format(previousPeriodStart, "yyyy-MM-dd"),
      format(previousPeriodEnd, "yyyy-MM-dd"),
      currentDaysPassed,
    ],
    queryFn: async () => {
      // First get the employee's agent mapping (get agent_id, then agent_name from agents table)
      const { data: mapping } = await supabase
        .from("employee_agent_mapping")
        .select("agent_id, agents(name)")
        .eq("employee_id", employeeId)
        .maybeSingle();

      const agentName = mapping?.agents?.name;
      if (!agentName) {
        return { total: 0, atSameDay: 0 };
      }

      // Get all sales with items for the previous period
      const { data: sales, error } = await supabase
        .from("sales")
        .select(`
          id,
          sale_datetime,
          sale_items (
            mapped_commission
          )
        `)
        .eq("agent_name", agentName)
        .gte("sale_datetime", format(previousPeriodStart, "yyyy-MM-dd"))
        .lte("sale_datetime", format(previousPeriodEnd, "yyyy-MM-dd") + "T23:59:59")
        .eq("status", "godkendt");

      if (error || !sales) {
        console.error("Error fetching previous period sales:", error);
        return { total: 0, atSameDay: 0 };
      }

      // Calculate working days in previous period to find the equivalent day
      const allDaysInPrevPeriod = eachDayOfInterval({
        start: previousPeriodStart,
        end: previousPeriodEnd,
      });
      
      const workingDaysInPrevPeriod = allDaysInPrevPeriod.filter(
        (day) => !isWeekend(day)
      );

      // Get the date that represents "same day" in previous period
      const sameDayDate = workingDaysInPrevPeriod[currentDaysPassed - 1];
      const sameDayDateStr = sameDayDate ? format(sameDayDate, "yyyy-MM-dd") : null;

      // Calculate totals
      let total = 0;
      let atSameDay = 0;

      for (const sale of sales) {
        const saleCommission = (sale.sale_items || []).reduce(
          (sum, item) => sum + (item.mapped_commission || 0),
          0
        );
        
        total += saleCommission;
        
        // Check if this sale was on or before the "same day" in previous period
        if (sameDayDateStr && sale.sale_datetime) {
          const saleDateStr = sale.sale_datetime.split("T")[0];
          if (saleDateStr <= sameDayDateStr) {
            atSameDay += saleCommission;
          }
        }
      }

      return { total, atSameDay };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!employeeId && currentDaysPassed > 0,
  });

  return {
    previousPeriodTotal: data?.total ?? 0,
    previousPeriodAtSameDay: data?.atSameDay ?? 0,
    isLoading,
    hasData: (data?.total ?? 0) > 0 || (data?.atSameDay ?? 0) > 0,
  };
}
