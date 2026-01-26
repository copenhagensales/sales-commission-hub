import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

async function fetchWeekRecognition(weekStart: Date, weekEnd: Date): Promise<WeekRecognition> {
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
        agent_name,
        status
      )
    `)
    .gte("sales.sale_datetime", startStr)
    .lte("sales.sale_datetime", endStr)
    .eq("sales.status", "approved");

  if (error || !saleItems || saleItems.length === 0) {
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
