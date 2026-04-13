import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePrecomputedKpis, getKpiValue } from "./usePrecomputedKpi";
import { format, eachDayOfInterval, isBefore, startOfDay, differenceInMinutes } from "date-fns";

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
 * Parse standard_start_time format like "8.00-16.30" to get hours per day
 */
function parseStandardHoursPerDay(standardStartTime: string | null): number {
  if (!standardStartTime) return 8; // Default 8 hours
  
  const match = standardStartTime.match(/(\d+)\.(\d+)-(\d+)\.(\d+)/);
  if (!match) return 8;
  
  const startHour = parseInt(match[1]) + parseInt(match[2]) / 60;
  const endHour = parseInt(match[3]) + parseInt(match[4]) / 60;
  
  return Math.max(0, endHour - startHour);
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

  // Direct calculation of hours from timestamps, shifts, or standard work hours
  const { data: directHoursData, isLoading: isLoadingDirectHours } = useQuery({
    queryKey: ["direct-hours-calculation", employeeId, format(periodStart, "yyyy-MM-dd"), format(periodEnd, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!employeeId) return { hours: 0, workDays: 0 };

      const today = startOfDay(new Date());
      const effectiveEnd = isBefore(today, periodEnd) ? today : periodEnd;

      // Strategy 1: Get hours from timestamps (actual punched time)
      const { data: timestamps, error: tsError } = await supabase
        .from("time_stamps")
        .select("clock_in, clock_out, client_id")
        .eq("employee_id", employeeId)
        .gte("clock_in", periodStart.toISOString())
        .lte("clock_in", effectiveEnd.toISOString())
        .not("clock_out", "is", null);

      if (!tsError && timestamps && timestamps.length > 0) {
        const uniqueDays = new Set<string>();
        let totalMinutes = 0;

        timestamps.forEach((ts) => {
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

        if (uniqueDays.size > 0) {
          return { 
            hours: Math.round((totalMinutes / 60) * 100) / 100,
            workDays: uniqueDays.size 
          };
        }
      }

      // Strategy 2: Get hours from shift table (planned shifts)
      const { data: shifts, error: shiftError } = await supabase
        .from("shift")
        .select("date, start_time, end_time")
        .eq("employee_id", employeeId)
        .gte("date", format(periodStart, "yyyy-MM-dd"))
        .lte("date", format(effectiveEnd, "yyyy-MM-dd"));

      if (!shiftError && shifts && shifts.length > 0) {
        const uniqueDays = new Set<string>();
        let totalMinutes = 0;

        shifts.forEach((shift) => {
          if (shift.start_time && shift.end_time) {
            // Parse time strings like "08:00" or "16:30"
            const [startH, startM] = shift.start_time.split(":").map(Number);
            const [endH, endM] = shift.end_time.split(":").map(Number);
            const minutes = (endH * 60 + endM) - (startH * 60 + startM);
            if (minutes > 0) {
              totalMinutes += minutes;
              uniqueDays.add(shift.date);
            }
          }
        });

        if (uniqueDays.size > 0) {
          return { 
            hours: Math.round((totalMinutes / 60) * 100) / 100,
            workDays: uniqueDays.size 
          };
        }
      }

      // Strategy 3: Use standard work hours from employee profile
      const { data: employeeData } = await supabase
        .from("employee_master_data")
        .select("standard_start_time")
        .eq("id", employeeId)
        .maybeSingle();

      const hoursPerDay = parseStandardHoursPerDay(employeeData?.standard_start_time);
      
      // Count all days that could have a shift (shift-aware, no weekday fallback)
      // Since we're in the fallback (no timestamps/shifts), use all days as approximation
      const allDays = eachDayOfInterval({ start: periodStart, end: effectiveEnd });
      const dayCount = allDays.length;
      
      return { 
        hours: Math.round(dayCount * hoursPerDay * 100) / 100,
        workDays: dayCount 
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
