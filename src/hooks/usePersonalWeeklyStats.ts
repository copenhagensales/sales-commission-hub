import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, endOfWeek, subWeeks, format } from "date-fns";

export interface PersonalWeekStats {
  weekTotal: number;
  bestDay: {
    date: string;
    commission: number;
  } | null;
}

export interface PersonalWeeklyData {
  currentWeek: PersonalWeekStats;
  lastWeek: PersonalWeekStats;
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
    .eq("sales.status", "approved")
    .in("sales.agent_email", agentEmails);

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
        };
      }

      const agentEmails = agents
        .map((a) => a.email?.toLowerCase())
        .filter((email): email is string => !!email);

      if (agentEmails.length === 0) {
        return {
          currentWeek: { weekTotal: 0, bestDay: null },
          lastWeek: { weekTotal: 0, bestDay: null },
        };
      }

      // Step 3: Calculate week boundaries
      const now = new Date();
      const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
      const currentWeekEnd = endOfWeek(now, { weekStartsOn: 1 });
      const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });

      // Step 4: Fetch stats for both weeks in parallel
      const [currentWeek, lastWeek] = await Promise.all([
        fetchPersonalWeekStats(agentEmails, currentWeekStart, currentWeekEnd),
        fetchPersonalWeekStats(agentEmails, lastWeekStart, lastWeekEnd),
      ]);

      return { currentWeek, lastWeek };
    },
    enabled: !!employeeId,
    staleTime: 60000,
    refetchInterval: 120000,
  });
}
