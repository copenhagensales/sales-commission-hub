import { useEmployeeSalesEmails } from "./useEmployeeSalesEmails";
import { startOfMonth, startOfWeek, endOfWeek, format, startOfDay } from "date-fns";
import { useSalesAggregatesExtended, type AggregateData } from "./useSalesAggregatesExtended";

interface PersonalSalesStats {
  periodTotal: number;
  periodSales: number;
  todayTotal: number;
  todaySales: number;
  weekTotal: number;
  weekSales: number;
  monthTotal: number;
  monthSales: number;
  byDate: Record<string, AggregateData>;
  isLoading: boolean;
}

/**
 * Wrapper hook for personal sales stats used in MyProfile and SalesGoalTracker.
 * Fetches commission/sales data for a specific employee.
 */
export function usePersonalSalesStats(
  employeeId: string,
  periodStart?: Date,
  periodEnd?: Date
): PersonalSalesStats {
  const today = startOfDay(new Date());
  const monthStart = startOfMonth(today);
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  // Fetch agent emails for this employee (mapping, else work email)
  const { data: agentEmails } = useEmployeeSalesEmails(employeeId);

  // Use the central aggregation hook for the full period
  const effectiveStart = periodStart || monthStart;
  const effectiveEnd = periodEnd || today;

  const { data: aggregates, isLoading } = useSalesAggregatesExtended({
    periodStart: effectiveStart,
    periodEnd: effectiveEnd,
    agentEmails,
    groupBy: ['date'],
    enabled: !!employeeId && !!agentEmails && agentEmails.length > 0,
  });

  // Calculate period-specific totals from date aggregates
  const todayStr = format(today, "yyyy-MM-dd");
  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const monthStartStr = format(monthStart, "yyyy-MM-dd");

  let periodTotal = 0;
  let periodSales = 0;
  let todayTotal = 0;
  let todaySales = 0;
  let weekTotal = 0;
  let weekSales = 0;
  let monthTotal = 0;
  let monthSales = 0;

  if (aggregates?.byDate) {
    for (const [dateStr, data] of Object.entries(aggregates.byDate)) {
      // Period totals
      periodTotal += data.commission;
      periodSales += data.sales;

      // Today
      if (dateStr === todayStr) {
        todayTotal = data.commission;
        todaySales = data.sales;
      }

      // Week
      if (dateStr >= weekStartStr) {
        weekTotal += data.commission;
        weekSales += data.sales;
      }

      // Month
      if (dateStr >= monthStartStr) {
        monthTotal += data.commission;
        monthSales += data.sales;
      }
    }
  }

  return {
    periodTotal,
    periodSales,
    todayTotal,
    todaySales,
    weekTotal,
    weekSales,
    monthTotal,
    monthSales,
    byDate: aggregates?.byDate || {},
    isLoading,
  };
}
