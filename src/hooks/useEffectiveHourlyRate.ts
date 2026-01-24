import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePrecomputedKpis, getKpiValue } from "./usePrecomputedKpi";
import { format, eachDayOfInterval, isWeekend, isBefore, startOfDay } from "date-fns";

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

  // Count work days with actual hours from timestamps/shifts
  const { data: workDaysData, isLoading: isLoadingWorkDays } = useQuery({
    queryKey: ["work-days-with-hours", employeeId, format(periodStart, "yyyy-MM-dd"), format(periodEnd, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!employeeId) return 0;

      const today = startOfDay(new Date());
      const effectiveEnd = isBefore(today, periodEnd) ? today : periodEnd;

      // Get days with timestamps (actual work)
      const { data: timestamps, error: tsError } = await supabase
        .from("time_stamps")
        .select("clock_in")
        .eq("employee_id", employeeId)
        .gte("clock_in", periodStart.toISOString())
        .lte("clock_in", effectiveEnd.toISOString())
        .not("clock_out", "is", null);

      if (tsError) {
        console.error("Error fetching timestamps for work days:", tsError);
      }

      // Count unique days with timestamps
      const uniqueDays = new Set<string>();
      timestamps?.forEach((ts) => {
        if (ts.clock_in) {
          uniqueDays.add(format(new Date(ts.clock_in), "yyyy-MM-dd"));
        }
      });

      // If we have timestamps, use that count
      if (uniqueDays.size > 0) {
        return uniqueDays.size;
      }

      // Fallback: count weekdays from start to today (excluding weekends)
      const allDays = eachDayOfInterval({ start: periodStart, end: effectiveEnd });
      const workDays = allDays.filter(day => !isWeekend(day)).length;
      return workDays;
    },
    enabled: !!employeeId,
    staleTime: 60000, // 1 minute
  });

  const breakDeductionPerDay = breakDeductionKpi ?? 1;
  const totalHours = getKpiValue(kpis?.live_sales_hours, 0);
  const totalCommission = getKpiValue(kpis?.total_commission, 0);
  const workDays = workDaysData ?? 0;
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
    isLoading: isLoadingBreak || isLoadingKpis || isLoadingWorkDays,
  };
}
