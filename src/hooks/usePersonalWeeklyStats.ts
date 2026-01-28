import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, endOfWeek, subWeeks, subDays, format, isWeekend, isToday } from "date-fns";
import { da } from "date-fns/locale";

export interface PersonalWeekStats {
  weekTotal: number;
  bestDay: {
    date: string;
    commission: number;
  } | null;
}

export interface DailyCommissionEntry {
  date: string;           // "2026-01-28"
  dayName: string;        // "Tir"
  commission: number;     // 2350
  isToday: boolean;
  isWeekend: boolean;
}

export interface PersonalWeeklyData {
  currentWeek: PersonalWeekStats;
  lastWeek: PersonalWeekStats;
  dailyBreakdown: DailyCommissionEntry[];
}

async function fetchPersonalWeekStats(
  agentEmails: string[],
  weekStart: Date,
  weekEnd: Date
): Promise<PersonalWeekStats> {
  if (agentEmails.length === 0) {
    return { weekTotal: 0, bestDay: null };
  }

  const startStr = format(weekStart, "yyyy-MM-dd'T'00:00:00");
  const endStr = format(weekEnd, "yyyy-MM-dd'T'23:59:59");

  // Fetch sale_items with sales data for the period
  // Note: status filter removed as sales default to null (implicitly approved)
  // Only explicitly rejected sales should be excluded
  const { data: saleItems, error } = await supabase
    .from("sale_items")
    .select(`
      id,
      mapped_commission,
      sales!inner(
        id,
        sale_datetime,
        agent_email,
        status
      )
    `)
    .gte("sales.sale_datetime", startStr)
    .lte("sales.sale_datetime", endStr)
    .in("sales.agent_email", agentEmails)
    .neq("sales.status", "rejected"); // Only exclude explicitly rejected sales

  if (error || !saleItems || saleItems.length === 0) {
    return { weekTotal: 0, bestDay: null };
  }

  // Aggregate by day
  const dailyTotals: Record<string, number> = {};
  let weekTotal = 0;

  for (const item of saleItems) {
    const sale = item.sales as any;
    if (!sale) continue;

    const commission = item.mapped_commission || 0;
    const saleDate = sale.sale_datetime?.split("T")[0] || "";

    weekTotal += commission;

    if (saleDate) {
      dailyTotals[saleDate] = (dailyTotals[saleDate] || 0) + commission;
    }
  }

  // Find best day
  const bestDayEntry = Object.entries(dailyTotals)
    .filter(([_, commission]) => commission > 0)
    .sort(([, a], [, b]) => b - a)[0];

  const bestDay = bestDayEntry
    ? { date: bestDayEntry[0], commission: bestDayEntry[1] }
    : null;

  return { weekTotal, bestDay };
}

export function usePersonalWeeklyStats(employeeId: string | null | undefined) {
  return useQuery({
    queryKey: ["personal-weekly-stats", employeeId],
    queryFn: async (): Promise<PersonalWeeklyData> => {
      if (!employeeId) {
        return {
          currentWeek: { weekTotal: 0, bestDay: null },
          lastWeek: { weekTotal: 0, bestDay: null },
          dailyBreakdown: [],
        };
      }

      // Step 1: Get agent IDs for this employee
      const { data: mappings, error: mappingError } = await supabase
        .from("employee_agent_mapping")
        .select("agent_id")
        .eq("employee_id", employeeId);

      if (mappingError || !mappings || mappings.length === 0) {
        return {
          currentWeek: { weekTotal: 0, bestDay: null },
          lastWeek: { weekTotal: 0, bestDay: null },
          dailyBreakdown: [],
        };
      }

      const agentIds = mappings.map((m) => m.agent_id);

      // Step 2: Get agent emails
      const { data: agents, error: agentError } = await supabase
        .from("agents")
        .select("email")
        .in("id", agentIds);

      if (agentError || !agents || agents.length === 0) {
        return {
          currentWeek: { weekTotal: 0, bestDay: null },
          lastWeek: { weekTotal: 0, bestDay: null },
          dailyBreakdown: [],
        };
      }

      const agentEmails = agents
        .map((a) => a.email?.toLowerCase())
        .filter((email): email is string => !!email);

      if (agentEmails.length === 0) {
        return {
          currentWeek: { weekTotal: 0, bestDay: null },
          lastWeek: { weekTotal: 0, bestDay: null },
          dailyBreakdown: [],
        };
      }

      // Step 3: Calculate week boundaries
      const now = new Date();
      const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
      const currentWeekEnd = endOfWeek(now, { weekStartsOn: 1 });
      const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });

      // Step 4: Calculate 14-day range for daily breakdown (to get 10 workdays)
      const fourteenDaysAgo = subDays(now, 13); // 14 days including today

      // Step 5: Fetch stats for both weeks and daily breakdown in parallel
      const [currentWeek, lastWeek, dailyBreakdown] = await Promise.all([
        fetchPersonalWeekStats(agentEmails, currentWeekStart, currentWeekEnd),
        fetchPersonalWeekStats(agentEmails, lastWeekStart, lastWeekEnd),
        fetchDailyBreakdown(agentEmails, fourteenDaysAgo, now),
      ]);

      return { currentWeek, lastWeek, dailyBreakdown };
    },
    enabled: !!employeeId,
    staleTime: 60000,
    refetchInterval: 120000,
  });
}

async function fetchDailyBreakdown(
  agentEmails: string[],
  startDate: Date,
  endDate: Date
): Promise<DailyCommissionEntry[]> {
  if (agentEmails.length === 0) {
    return [];
  }

  const startStr = format(startDate, "yyyy-MM-dd'T'00:00:00");
  const endStr = format(endDate, "yyyy-MM-dd'T'23:59:59");

  const { data: saleItems, error } = await supabase
    .from("sale_items")
    .select(`
      id,
      mapped_commission,
      sales!inner(
        id,
        sale_datetime,
        agent_email,
        status
      )
    `)
    .gte("sales.sale_datetime", startStr)
    .lte("sales.sale_datetime", endStr)
    .in("sales.agent_email", agentEmails)
    .neq("sales.status", "rejected");

  // Build daily totals map
  const dailyTotals: Record<string, number> = {};

  if (saleItems && !error) {
    for (const item of saleItems) {
      const sale = item.sales as any;
      if (!sale) continue;

      const commission = item.mapped_commission || 0;
      const saleDate = sale.sale_datetime?.split("T")[0] || "";

      if (saleDate) {
        dailyTotals[saleDate] = (dailyTotals[saleDate] || 0) + commission;
      }
    }
  }

  // Generate entries for each day in the range
  const entries: DailyCommissionEntry[] = [];
  const today = new Date();
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = format(d, "yyyy-MM-dd");
    const dayDate = new Date(d);
    
    entries.push({
      date: dateStr,
      dayName: format(dayDate, "EEE", { locale: da }).charAt(0).toUpperCase() + 
               format(dayDate, "EEE", { locale: da }).slice(1, 3),
      commission: dailyTotals[dateStr] || 0,
      isToday: isToday(dayDate),
      isWeekend: isWeekend(dayDate),
    });
  }

  return entries;
}
