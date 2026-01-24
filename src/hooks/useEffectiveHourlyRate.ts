import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePrecomputedKpis, getKpiValue } from "./usePrecomputedKpi";
import { format, eachDayOfInterval, isWeekend, isBefore, startOfDay, differenceInMinutes } from "date-fns";

interface EffectiveHourlyRateResult {
  hourlyRate: number;
  totalHours: number;
  effectiveHours: number;
  totalBreakHours: number;
  workDays: number;
  breakDeductionPerDay: number;
  totalCommission: number;
  isLoading: boolean;
}

/**
 * Hook to calculate the effective hourly rate for an employee.
 * Uses KPI definitions for break deduction and cached KPIs for hours/commission.
 * Falls back to direct calculation if cached hours are not available.
 * 
 * Formula: total_commission / (live_sales_hours - (work_days × break_deduction_per_day))
 */
export function useEffectiveHourlyRate(
  employeeId: string | null,
  periodStart: Date,
  periodEnd: Date
): EffectiveHourlyRateResult {
  // Fetch break deduction per day from kpi_definitions
  const { data: breakDeductionKpi, isLoading: isLoadingBreak } = useQuery({
    queryKey: ["kpi-break-deduction"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kpi_definitions")
        .select("example_value")
        .eq("slug", "break_deduction_per_day")
        .maybeSingle();
      
      if (error) {
        console.warn("Could not fetch break_deduction_per_day KPI, using default 1:", error.message);
        return 1;
      }
      // Default to 1 hour break deduction if no KPI definition exists
      return parseFloat(data?.example_value || "1");
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  // Fetch precomputed KPIs for hours and commission
  const { data: kpis, isLoading: isLoadingKpis } = usePrecomputedKpis(
    ["live_sales_hours", "total_commission"],
    "payroll_period",
    "employee",
    employeeId
  );

  // Direct calculation of hours from timestamps as fallback
  const { data: directHoursData, isLoading: isLoadingDirectHours } = useQuery({
    queryKey: ["direct-hours-calculation", employeeId, format(periodStart, "yyyy-MM-dd"), format(periodEnd, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!employeeId) return { hours: 0, workDays: 0 };

      const today = startOfDay(new Date());
      const effectiveEnd = isBefore(today, periodEnd) ? today : periodEnd;

      // Get all timestamps with clock_in and clock_out
      const { data: timestamps, error } = await supabase
        .from("time_stamps")
        .select("clock_in, clock_out")
        .eq("employee_id", employeeId)
        .gte("clock_in", periodStart.toISOString())
        .lte("clock_in", effectiveEnd.toISOString())
        .not("clock_out", "is", null);

      if (error) {
        console.error("Error fetching timestamps for hours calculation:", error);
        return { hours: 0, workDays: 0 };
      }

      // Calculate total hours and unique work days
      const uniqueDays = new Set<string>();
      let totalMinutes = 0;

      timestamps?.forEach((ts) => {
        if (ts.clock_in && ts.clock_out) {
          const clockIn = new Date(ts.clock_in);
          const clockOut = new Date(ts.clock_out);
          const minutes = differenceInMinutes(clockOut, clockIn);
          if (minutes > 0) {
            totalMinutes += minutes;
            uniqueDays.add(format(clockIn, "yyyy-MM-dd"));
          }
        }
      });

      // If no timestamps, fall back to counting weekdays
      if (uniqueDays.size === 0) {
        const allDays = eachDayOfInterval({ start: periodStart, end: effectiveEnd });
        const weekdays = allDays.filter(day => !isWeekend(day)).length;
        return { hours: 0, workDays: weekdays };
      }

      return { 
        hours: Math.round((totalMinutes / 60) * 100) / 100, // Round to 2 decimals
        workDays: uniqueDays.size 
      };
    },
    enabled: !!employeeId,
    staleTime: 60000, // 1 minute
  });

  const breakDeductionPerDay = breakDeductionKpi ?? 1;
  
  // Use cached KPI if available, otherwise use direct calculation
  const cachedHours = getKpiValue(kpis?.live_sales_hours, 0);
  const totalHours = cachedHours > 0 ? cachedHours : (directHoursData?.hours ?? 0);
  
  const totalCommission = getKpiValue(kpis?.total_commission, 0);
  const workDays = directHoursData?.workDays ?? 0;
  const totalBreakHours = workDays * breakDeductionPerDay;
  const effectiveHours = Math.max(0, totalHours - totalBreakHours);
  const hourlyRate = effectiveHours > 0 ? totalCommission / effectiveHours : 0;

  return {
    hourlyRate,
    totalHours,
    effectiveHours,
    totalBreakHours,
    workDays,
    breakDeductionPerDay,
    totalCommission,
    isLoading: isLoadingBreak || isLoadingKpis || isLoadingDirectHours,
  };
}
