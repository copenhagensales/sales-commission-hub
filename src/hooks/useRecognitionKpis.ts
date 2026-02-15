import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/utils/supabasePagination";
import { startOfWeek, endOfWeek, subWeeks, format } from "date-fns";

interface RecognitionPerson {
  name: string;
  commission: number;
  team: string | null;
  date?: string;
}

interface WeekRecognition {
  topWeekly: RecognitionPerson | null;
  bestDay: RecognitionPerson | null;
}

interface RecognitionData {
  currentWeek: WeekRecognition;
  lastWeek: WeekRecognition;
}

/**
 * Fetch recognition data using central aggregates RPC with grouping.
 * Falls back to manual aggregation if RPC fails.
 */
async function fetchWeekRecognition(weekStart: Date, weekEnd: Date): Promise<WeekRecognition> {
  const startStr = weekStart.toISOString();
  const endStr = weekEnd.toISOString();

  try {
    // Try RPC with 'both' grouping (employee + date)
    const { data: rpcData, error: rpcError } = await supabase.rpc("get_sales_aggregates_v2", {
      p_start: startStr,
      p_end: endStr,
      p_group_by: "both",
    });

    if (!rpcError && rpcData && rpcData.length > 0) {
      // Aggregate by employee (weekly totals)
      const employeeTotals: Record<string, { name: string; commission: number }> = {};
      // Track best day per entry
      const dailyEntries: Array<{ name: string; commission: number; date: string }> = [];

      for (const row of rpcData) {
        // group_key format: "email|YYYY-MM-DD"
        const [email, date] = (row.group_key || "").split("|");
        const name = row.group_name || email?.split("@")[0] || "Ukendt";
        const commission = Number(row.total_commission) || 0;

        // Sum weekly totals per employee
        if (!employeeTotals[email]) {
          employeeTotals[email] = { name, commission: 0 };
        }
        employeeTotals[email].commission += commission;

        // Track daily entries for best day
        if (date && commission > 0) {
          dailyEntries.push({ name, commission, date });
        }
      }

      // Find top weekly performer
      const topWeeklyEntry = Object.values(employeeTotals)
        .filter((e) => e.commission > 0)
        .sort((a, b) => b.commission - a.commission)[0];

      const topWeekly: RecognitionPerson | null = topWeeklyEntry
        ? { name: topWeeklyEntry.name, commission: topWeeklyEntry.commission, team: null }
        : null;

      // Find best single day
      const bestDayEntry = dailyEntries.sort((a, b) => b.commission - a.commission)[0];
      const bestDay: RecognitionPerson | null = bestDayEntry
        ? { name: bestDayEntry.name, commission: bestDayEntry.commission, team: null, date: bestDayEntry.date }
        : null;

      return { topWeekly, bestDay };
    }
  } catch {
    // RPC failed, fall back to manual aggregation
  }

  // Fallback: manual aggregation
  return fetchWeekRecognitionFallback(weekStart, weekEnd);
}

/**
 * Fallback method using direct queries when RPC is unavailable.
 */
async function fetchWeekRecognitionFallback(weekStart: Date, weekEnd: Date): Promise<WeekRecognition> {
  const startStr = format(weekStart, "yyyy-MM-dd'T'00:00:00");
  const endStr = format(weekEnd, "yyyy-MM-dd'T'23:59:59");

  const saleItems = await fetchAllRows<any>(
    "sale_items",
    `id, mapped_commission,
        sales!inner(id, sale_datetime, agent_email, agent_name, status)`,
    (q) => q.gte("sales.sale_datetime", startStr)
      .lte("sales.sale_datetime", endStr)
      .eq("sales.status", "approved"),
    { orderBy: "id", ascending: true }
  );

  if (!saleItems || saleItems.length === 0) {
    return { topWeekly: null, bestDay: null };
  }

  // Get agent mappings with employee info
  const { data: agentMappings } = await supabase
    .from("employee_agent_mapping")
    .select(`
      agent_id,
      employee_id,
      agents(email, name),
      employee_master_data!inner(first_name, last_name, team_id)
    `);

  // Get teams for names
  const teamIds = [...new Set((agentMappings || [])
    .map(m => (m.employee_master_data as any)?.team_id)
    .filter(Boolean))];
  
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name")
    .in("id", teamIds);

  const teamMap = new Map(teams?.map(t => [t.id, t.name]) || []);

  // Build email -> employee info map
  const emailToEmployee = new Map<string, { name: string; team: string | null }>();
  for (const mapping of (agentMappings || [])) {
    const email = (mapping.agents as any)?.email?.toLowerCase();
    const emp = mapping.employee_master_data as any;
    if (email && emp) {
      const fullName = `${emp.first_name || ""} ${emp.last_name || ""}`.trim();
      const teamName = emp.team_id ? teamMap.get(emp.team_id) || null : null;
      emailToEmployee.set(email, { name: fullName, team: teamName });
    }
  }

  // Aggregate commission by agent email and by day
  const agentTotals: Record<string, { name: string; commission: number; team: string | null }> = {};
  const dailyTotals: Record<string, { name: string; commission: number; team: string | null; date: string }> = {};

  for (const item of saleItems) {
    const sale = item.sales as any;
    if (!sale) continue;

    const commission = item.mapped_commission || 0;
    const agentEmail = sale.agent_email?.toLowerCase() || "";
    const agentName = sale.agent_name || "Ukendt";
    const saleDate = sale.sale_datetime?.split("T")[0] || "";

    // Lookup employee info
    const empInfo = emailToEmployee.get(agentEmail);
    const displayName = empInfo?.name || agentName;
    const teamName = empInfo?.team || null;
    const agentKey = agentEmail || agentName;

    // Weekly totals per agent
    if (!agentTotals[agentKey]) {
      agentTotals[agentKey] = { name: displayName, commission: 0, team: teamName };
    }
    agentTotals[agentKey].commission += commission;

    // Daily totals per agent per day
    const dailyKey = `${agentKey}_${saleDate}`;
    if (!dailyTotals[dailyKey]) {
      dailyTotals[dailyKey] = { name: displayName, commission: 0, team: teamName, date: saleDate };
    }
    dailyTotals[dailyKey].commission += commission;
  }

  // Find top weekly performer
  const topWeeklyAgent = Object.values(agentTotals)
    .filter(a => a.commission > 0)
    .sort((a, b) => b.commission - a.commission)[0];
  
  const topWeekly: RecognitionPerson | null = topWeeklyAgent
    ? { name: topWeeklyAgent.name, commission: topWeeklyAgent.commission, team: topWeeklyAgent.team }
    : null;

  // Find best single day
  const bestDayEntry = Object.values(dailyTotals)
    .filter(d => d.commission > 0)
    .sort((a, b) => b.commission - a.commission)[0];
  
  const bestDay: RecognitionPerson | null = bestDayEntry
    ? { name: bestDayEntry.name, commission: bestDayEntry.commission, team: bestDayEntry.team, date: bestDayEntry.date }
    : null;

  return { topWeekly, bestDay };
}

export function useRecognitionKpis() {
  return useQuery({
    queryKey: ["recognition-kpis"],
    queryFn: async (): Promise<RecognitionData> => {
      const now = new Date();
      
      // Current week (Monday to Sunday)
      const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
      const currentWeekEnd = endOfWeek(now, { weekStartsOn: 1 });
      
      // Last week
      const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });

      const [currentWeek, lastWeek] = await Promise.all([
        fetchWeekRecognition(currentWeekStart, currentWeekEnd),
        fetchWeekRecognition(lastWeekStart, lastWeekEnd),
      ]);

      return { currentWeek, lastWeek };
    },
    staleTime: 60000,
    refetchInterval: 120000,
  });
}
