import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subMonths, format, eachDayOfInterval } from "date-fns";
import { useSalesAggregatesExtended } from "./useSalesAggregatesExtended";

interface PreviousPeriodData {
  previousPeriodTotal: number;
  previousPeriodAtSameDay: number;
  isLoading: boolean;
  hasData: boolean;
}

/**
 * Hook to fetch commission data from the previous payroll period for comparison.
 * Uses the central sales aggregation hook for consistent data fetching.
 * 
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

  // Fetch agent emails for this employee
  const { data: agentEmails } = useQuery({
    queryKey: ["employee-agent-emails-comparison", employeeId],
    queryFn: async () => {
      const { data: mappings } = await supabase
        .from("employee_agent_mapping")
        .select("agent_id, agents(email)")
        .eq("employee_id", employeeId);

      const emails = mappings
        ?.map(m => (m.agents as any)?.email)
        .filter(Boolean) as string[] || [];

      if (emails.length > 0) return emails;

      // Fallback: use work_email from employee_master_data
      const { data: emp } = await supabase
        .from("employee_master_data" as any)
        .select("work_email")
        .eq("id", employeeId)
        .maybeSingle();

      const workEmail = (emp as any)?.work_email;
      return workEmail ? [workEmail] : [];
    },
    enabled: !!employeeId,
    staleTime: 5 * 60 * 1000,
  });

  // Use central aggregation hook
  const { data: aggregates, isLoading } = useSalesAggregatesExtended({
    periodStart: previousPeriodStart,
    periodEnd: previousPeriodEnd,
    agentEmails,
    groupBy: ['date'],
    enabled: !!employeeId && !!agentEmails && agentEmails.length > 0 && currentDaysPassed > 0,
  });

  // Calculate working days in previous period to find the equivalent day
  const allDaysInPrevPeriod = eachDayOfInterval({
    start: previousPeriodStart,
    end: previousPeriodEnd,
  });
  
  // Use all days in previous period (shift-aware: no weekend filter)
  // The currentDaysPassed already comes from the shift-aware hook
  const workingDaysInPrevPeriod = allDaysInPrevPeriod;

  // Get the date that represents "same day" in previous period
  const sameDayDate = workingDaysInPrevPeriod[currentDaysPassed - 1];
  const sameDayDateStr = sameDayDate ? format(sameDayDate, "yyyy-MM-dd") : null;

  // Calculate totals from aggregated data
  let total = 0;
  let atSameDay = 0;

  if (aggregates?.byDate) {
    for (const [dateStr, data] of Object.entries(aggregates.byDate)) {
      total += data.commission;
      
      // Check if this date was on or before the "same day" in previous period
      if (sameDayDateStr && dateStr <= sameDayDateStr) {
        atSameDay += data.commission;
      }
    }
  }

  return {
    previousPeriodTotal: total,
    previousPeriodAtSameDay: atSameDay,
    isLoading,
    hasData: total > 0 || atSameDay > 0,
  };
}
