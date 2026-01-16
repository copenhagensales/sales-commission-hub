import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface KpiDefinition {
  id: string;
  slug: string;
  name: string;
  sql_query: string | null;
  calculation_formula: string | null;
  category: string;
  is_active: boolean;
}

interface CachedValue {
  kpi_slug: string;
  period_type: string;
  scope_type: string;
  scope_id: string | null;
  value: number;
  formatted_value: string;
  calculated_at: string;
}

interface SaleItem {
  quantity: number | null;
  product_id: string | null;
  sale_id: string | null;
  mapped_commission?: number | null;
  mapped_revenue?: number | null;
  created_at?: string;
}

interface Product {
  id: string;
  counts_as_sale: boolean | null;
}

interface FieldmarketingSale {
  revenue: number | null;
}

interface TeamMemberShift {
  employee_id: string;
  team_id: string;
}

interface TeamStandardShift {
  id: string;
  team_id: string;
  start_time: string;
  end_time: string;
  hours_source: string | null;
}

interface ShiftDay {
  shift_id: string;
  day_of_week: number;
  start_time: string | null;
  end_time: string | null;
}

interface TimeStampRecord {
  employee_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  break_minutes: number | null;
}

interface LeaderboardEntry {
  employeeId: string;
  employeeName: string;
  displayName: string;
  avatarUrl: string | null;
  teamName: string | null;
  salesCount: number;
  commission: number;
  goalTarget: number | null;
}

interface LeaderboardCache {
  period_type: string;
  scope_type: string;
  scope_id: string | null;
  leaderboard_data: LeaderboardEntry[];
  calculated_at: string;
}

// Date helpers
function getStartOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getStartOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getPayrollPeriod(date: Date): { start: Date; end: Date } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  if (day >= 15) {
    return {
      start: new Date(year, month, 15),
      end: new Date(year, month + 1, 14, 23, 59, 59),
    };
  } else {
    return {
      start: new Date(year, month - 1, 15),
      end: new Date(year, month, 14, 23, 59, 59),
    };
  }
}

function formatValue(value: number, category: string): string {
  if (category === "revenue" || category === "commission" || category === "økonomi") {
    return new Intl.NumberFormat("da-DK", {
      style: "currency",
      currency: "DKK",
      maximumFractionDigits: 0,
    }).format(value);
  }
  if (category === "conversion" || category === "percentage") {
    return `${value.toFixed(1)}%`;
  }
  if (category === "hours" || category === "tid") {
    return `${value.toFixed(1)} t`;
  }
  return new Intl.NumberFormat("da-DK").format(value);
}

function formatDisplayName(fullName: string): string {
  const parts = fullName.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  }
  return fullName;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const periods = [
      { type: "today", start: getStartOfDay(now), end: now },
      { type: "this_week", start: getStartOfWeek(now), end: now },
      { type: "this_month", start: getStartOfMonth(now), end: now },
      { type: "payroll_period", ...getPayrollPeriod(now) },
    ];

    // Fetch all active KPI definitions
    const { data: kpiDefinitions, error: kpiError } = await supabase
      .from("kpi_definitions")
      .select("id, slug, name, sql_query, calculation_formula, category, is_active")
      .eq("is_active", true);

    if (kpiError) {
      console.error("Error fetching KPI definitions:", kpiError);
      throw kpiError;
    }

    const cachedValues: CachedValue[] = [];
    const leaderboardCaches: LeaderboardCache[] = [];
    const calculatedAt = now.toISOString();

    // Fetch clients for client-scoped KPIs
    const { data: clients } = await supabase
      .from("clients")
      .select("id, name");
    
    const clientList = (clients || []) as { id: string; name: string }[];

    // Calculate each KPI for each period (global scope)
    for (const kpi of (kpiDefinitions as KpiDefinition[]) || []) {
      for (const period of periods) {
        try {
          const value = await calculateKpiValue(supabase, kpi, period.start, period.end);
          
          cachedValues.push({
            kpi_slug: kpi.slug,
            period_type: period.type,
            scope_type: "global",
            scope_id: null,
            value,
            formatted_value: formatValue(value, kpi.category),
            calculated_at: calculatedAt,
          });
        } catch (err) {
          console.error(`Error calculating ${kpi.slug} for ${period.type}:`, err);
        }
      }
    }

    // Calculate client-scoped KPIs for key metrics
    const clientScopedKpis = ["sales_count", "total_commission", "total_revenue", "total_hours", "antal_salg", "total_provision"];
    
    for (const client of clientList) {
      for (const period of periods) {
        for (const kpiSlug of clientScopedKpis) {
          try {
            const value = await calculateClientKpiValue(supabase, kpiSlug, client.id, period.start, period.end);
            
            cachedValues.push({
              kpi_slug: kpiSlug,
              period_type: period.type,
              scope_type: "client",
              scope_id: client.id,
              value,
              formatted_value: formatValue(value, kpiSlug.includes("commission") || kpiSlug.includes("revenue") ? "revenue" : "count"),
              calculated_at: calculatedAt,
            });
          } catch (err) {
            console.error(`Error calculating ${kpiSlug} for client ${client.id} ${period.type}:`, err);
        }
      }
    }
  }

  // ============= EMPLOYEE-SCOPED KPIs =============
  console.log("Calculating employee-scoped KPIs...");
  
  // Get active employees with agent mappings
  const { data: activeEmployees } = await supabase
    .from("employee_master_data")
    .select("id, first_name, last_name")
    .eq("is_active", true);
  
  // Get all agent mappings
  const { data: allAgentMappings } = await supabase
    .from("employee_agent_mapping")
    .select("employee_id, agent_id, agents(email, external_dialer_id)");
  
  // Build employee -> agent identifiers map
  const employeeAgentMap = new Map<string, { emails: string[]; externalIds: string[] }>();
  for (const mapping of (allAgentMappings || [])) {
    const empId = mapping.employee_id;
    const email = (mapping.agents as any)?.email?.toLowerCase();
    const externalId = (mapping.agents as any)?.external_dialer_id;
    
    if (!employeeAgentMap.has(empId)) {
      employeeAgentMap.set(empId, { emails: [], externalIds: [] });
    }
    const current = employeeAgentMap.get(empId)!;
    if (email) current.emails.push(email);
    if (externalId) current.externalIds.push(externalId);
  }
  
  // Only calculate for payroll_period and today (most used)
  const employeePeriods = periods.filter(p => p.type === "payroll_period" || p.type === "today");
  const employeeScopedKpis = ["sales_count", "total_commission"];
  
  // Fetch all sales data once for efficiency
  const payrollPeriodDates = getPayrollPeriod(now);
  const { data: allPeriodSales } = await supabase
    .from("sales")
    .select("id, agent_email, agent_external_id, sale_datetime, sale_items(mapped_commission, quantity, product_id)")
    .gte("sale_datetime", payrollPeriodDates.start.toISOString())
    .lte("sale_datetime", payrollPeriodDates.end.toISOString());
  
  // Fetch products for counts_as_sale check
  const allProductIds = [...new Set((allPeriodSales || []).flatMap((s: any) => 
    (s.sale_items || []).map((si: any) => si.product_id).filter(Boolean)
  ))];
  
  let allCountingProductIds = new Set<string>();
  if (allProductIds.length > 0) {
    const { data: allProducts } = await supabase
      .from("products")
      .select("id, counts_as_sale")
      .in("id", allProductIds);
    
    allCountingProductIds = new Set(
      (allProducts || []).filter((p: Product) => p.counts_as_sale !== false).map((p: Product) => p.id)
    );
  }
  
  // Calculate for each active employee with mappings
  for (const emp of (activeEmployees || [])) {
    const agentData = employeeAgentMap.get(emp.id);
    if (!agentData || (agentData.emails.length === 0 && agentData.externalIds.length === 0)) {
      continue; // Skip employees without agent mappings
    }
    
    for (const period of employeePeriods) {
      // Filter sales for this employee in this period
      const empSales = (allPeriodSales || []).filter((sale: any) => {
        const saleDate = new Date(sale.sale_datetime);
        if (saleDate < period.start || saleDate > period.end) return false;
        
        const saleEmail = sale.agent_email?.toLowerCase();
        const saleExternalId = sale.agent_external_id;
        
        return (saleEmail && agentData.emails.includes(saleEmail)) ||
               (saleExternalId && agentData.externalIds.includes(saleExternalId));
      });
      
      // Calculate sales count
      let salesCount = 0;
      let totalCommission = 0;
      
      for (const sale of empSales) {
        for (const item of (sale.sale_items || [])) {
          const productId = (item as any).product_id;
          if (!productId || allCountingProductIds.has(productId)) {
            salesCount += (item as any).quantity || 1;
          }
          totalCommission += ((item as any).mapped_commission || 0) * ((item as any).quantity || 1);
        }
        // If no items, count as 1 sale
        if (!sale.sale_items || sale.sale_items.length === 0) {
          salesCount += 1;
        }
      }
      
      // Add sales_count
      cachedValues.push({
        kpi_slug: "sales_count",
        period_type: period.type,
        scope_type: "employee",
        scope_id: emp.id,
        value: salesCount,
        formatted_value: salesCount.toString(),
        calculated_at: calculatedAt,
      });
      
      // Add total_commission
      cachedValues.push({
        kpi_slug: "total_commission",
        period_type: period.type,
        scope_type: "employee",
        scope_id: emp.id,
        value: totalCommission,
        formatted_value: formatValue(totalCommission, "commission"),
        calculated_at: calculatedAt,
      });
    }
  }
  
  console.log(`Calculated employee-scoped KPIs for ${(activeEmployees || []).length} employees`);

  // ============= TEAM-SCOPED COMMISSION =============
  console.log("Calculating team-scoped commission for goals...");
  
  // Fetch teams with active goals for payroll period
  const payrollStart = payrollPeriodDates.start.toISOString().split("T")[0];
  const payrollEnd = payrollPeriodDates.end.toISOString().split("T")[0];
  
  const { data: teamGoals } = await supabase
    .from("team_sales_goals")
    .select("team_id, target_amount, teams(id, name)")
    .eq("period_start", payrollStart)
    .eq("period_end", payrollEnd);
  
  // For each team with a goal, calculate commission
  for (const goal of (teamGoals || [])) {
    const teamId = goal.team_id;
    
    // Get team members
    const { data: teamMemberData } = await supabase
      .from("team_members")
      .select("employee_id")
      .eq("team_id", teamId);
    
    const memberIds = (teamMemberData || []).map((m: any) => m.employee_id);
    if (memberIds.length === 0) continue;
    
    // Get agent mappings for team members
    const teamAgentEmails: string[] = [];
    const teamExternalIds: string[] = [];
    
    for (const memberId of memberIds) {
      const agentData = employeeAgentMap.get(memberId);
      if (agentData) {
        teamAgentEmails.push(...agentData.emails);
        teamExternalIds.push(...agentData.externalIds);
      }
    }
    
    if (teamAgentEmails.length === 0 && teamExternalIds.length === 0) continue;
    
    // Calculate team commission from already-fetched sales data
    let teamCommission = 0;
    
    for (const sale of (allPeriodSales || [])) {
      const saleEmail = (sale as any).agent_email?.toLowerCase();
      const saleExternalId = (sale as any).agent_external_id;
      
      const isTeamSale = (saleEmail && teamAgentEmails.includes(saleEmail)) ||
                         (saleExternalId && teamExternalIds.includes(saleExternalId));
      
      if (isTeamSale) {
        for (const item of ((sale as any).sale_items || [])) {
          teamCommission += (item.mapped_commission || 0) * (item.quantity || 1);
        }
      }
    }
    
    // Cache team commission for payroll_period
    cachedValues.push({
      kpi_slug: "total_commission",
      period_type: "payroll_period",
      scope_type: "team",
      scope_id: teamId,
      value: teamCommission,
      formatted_value: formatValue(teamCommission, "commission"),
      calculated_at: calculatedAt,
    });
  }
  
  console.log(`Calculated team-scoped commission for ${(teamGoals || []).length} teams with goals`);

    // ============= LEADERBOARD CACHE CALCULATION =============
    console.log("Calculating global leaderboards...");
    
    // Fetch employee data for leaderboards
    const { data: employees } = await supabase
      .from("employee_master_data")
      .select("id, first_name, last_name, avatar_url")
      .eq("is_active", true);
    
    // Use employee ID as key for reliable lookups (not name which may not match agent_name)
    const employeeMap = new Map<string, { id: string; name: string; avatarUrl: string | null }>();
    (employees || []).forEach(emp => {
      const fullName = `${emp.first_name} ${emp.last_name}`;
      employeeMap.set(emp.id, {
        id: emp.id,
        name: fullName,
        avatarUrl: emp.avatar_url,
      });
    });
    
    // Fetch team memberships
    const { data: teamMembers } = await supabase
      .from("team_members")
      .select("employee_id, teams(id, name)");
    
    const employeeTeamMap = new Map<string, string>();
    (teamMembers || []).forEach(tm => {
      const teamName = (tm.teams as any)?.name;
      if (teamName && tm.employee_id) {
        employeeTeamMap.set(tm.employee_id, teamName);
      }
    });
    
    // Calculate global leaderboards for each period
    for (const period of periods) {
      try {
        const leaderboard = await calculateGlobalLeaderboard(
          supabase,
          period.start,
          period.end,
          employeeMap,
          employeeTeamMap,
          30 // Top 30
        );
        
        leaderboardCaches.push({
          period_type: period.type,
          scope_type: "global",
          scope_id: null,
          leaderboard_data: leaderboard,
          calculated_at: calculatedAt,
        });
        
        console.log(`Calculated global leaderboard for ${period.type}: ${leaderboard.length} entries`);
      } catch (err) {
        console.error(`Error calculating global leaderboard for ${period.type}:`, err);
      }
    }
    
    // Fetch teams for team-scoped leaderboards
    const { data: teams } = await supabase
      .from("teams")
      .select("id, name");
    
    // Calculate team-scoped leaderboards
    for (const team of (teams || []) as { id: string; name: string }[]) {
      for (const period of periods) {
        try {
          const leaderboard = await calculateTeamLeaderboard(
            supabase,
            team.id,
            period.start,
            period.end,
            employeeMap,
            team.name,
            20 // Top 20 per team
          );
          
          leaderboardCaches.push({
            period_type: period.type,
            scope_type: "team",
            scope_id: team.id,
            leaderboard_data: leaderboard,
            calculated_at: calculatedAt,
          });
        } catch (err) {
          console.error(`Error calculating team leaderboard for ${team.name} ${period.type}:`, err);
        }
      }
    }

    // ============= CLIENT-SCOPED LEADERBOARD CACHE CALCULATION =============
    console.log("Calculating client-scoped leaderboards...");
    
    for (const client of clientList) {
      for (const period of periods) {
        try {
          const leaderboard = await calculateClientLeaderboard(
            supabase,
            client.id,
            period.start,
            period.end,
            employeeMap,
            employeeTeamMap,
            30 // Top 30 per client
          );
          
          leaderboardCaches.push({
            period_type: period.type,
            scope_type: "client",
            scope_id: client.id,
            leaderboard_data: leaderboard,
            calculated_at: calculatedAt,
          });
          
          if (leaderboard.length > 0) {
            console.log(`Calculated client leaderboard for ${client.name} ${period.type}: ${leaderboard.length} entries`);
          }
        } catch (err) {
          console.error(`Error calculating client leaderboard for ${client.name} ${period.type}:`, err);
        }
      }
    }

    // Upsert all cached KPI values
    if (cachedValues.length > 0) {
      const { error: upsertError } = await supabase
        .from("kpi_cached_values")
        .upsert(cachedValues, {
          onConflict: "kpi_slug,period_type,scope_type,scope_id",
        });

      if (upsertError) {
        console.error("Error upserting cached values:", upsertError);
        throw upsertError;
      }
    }

    // Upsert all leaderboard caches
    if (leaderboardCaches.length > 0) {
      const { error: leaderboardError } = await supabase
        .from("kpi_leaderboard_cache")
        .upsert(leaderboardCaches, {
          onConflict: "period_type,scope_type,scope_id",
        });

      if (leaderboardError) {
        console.error("Error upserting leaderboard caches:", leaderboardError);
        throw leaderboardError;
      }
    }

    console.log(`Successfully calculated ${cachedValues.length} KPI values and ${leaderboardCaches.length} leaderboards`);

    return new Response(
      JSON.stringify({
        success: true,
        calculated: cachedValues.length,
        leaderboards: leaderboardCaches.length,
        timestamp: calculatedAt,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in calculate-kpi-values:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// ============= LEADERBOARD CALCULATION FUNCTIONS =============

async function calculateGlobalLeaderboard(
  supabase: SupabaseClient,
  startDate: Date,
  endDate: Date,
  employeeMap: Map<string, { id: string; name: string; avatarUrl: string | null }>,
  employeeTeamMap: Map<string, string>,
  limit: number = 30
): Promise<LeaderboardEntry[]> {
  const startStr = startDate.toISOString();
  const endStr = endDate.toISOString();

  // Get all sales with agent_email for proper matching
  const { data: sales } = await supabase
    .from("sales")
    .select("id, agent_email, agent_name")
    .gte("sale_datetime", startStr)
    .lte("sale_datetime", endStr);

  if (!sales || sales.length === 0) return [];

  const saleIds = sales.map(s => s.id);
  
  // Get sale items with commission
  const { data: saleItems } = await supabase
    .from("sale_items")
    .select("sale_id, quantity, mapped_commission, product_id")
    .in("sale_id", saleIds);

  // Get products to check counts_as_sale
  const productIds = [...new Set((saleItems || []).map(si => si.product_id).filter(Boolean))];
  let countingProductIds = new Set<string>();
  
  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from("products")
      .select("id, counts_as_sale")
      .in("id", productIds);
    
    countingProductIds = new Set(
      (products || []).filter(p => p.counts_as_sale !== false).map(p => p.id)
    );
  }

  // Collect unique agent emails for mapping lookup
  const agentEmails = new Set<string>();
  for (const sale of sales) {
    if (sale.agent_email) {
      agentEmails.add(sale.agent_email.toLowerCase());
    }
  }

  // Get agents by email
  const { data: agents } = await supabase
    .from("agents")
    .select("id, email");
  
  const emailToAgentId = new Map<string, string>();
  for (const agent of (agents || [])) {
    if (agent.email) {
      emailToAgentId.set(agent.email.toLowerCase(), agent.id);
    }
  }

  // Get employee_agent_mapping to link agents to employees
  const { data: agentMappings } = await supabase
    .from("employee_agent_mapping")
    .select("agent_id, employee_id");
  
  const agentIdToEmployeeId = new Map<string, string>();
  for (const mapping of (agentMappings || [])) {
    agentIdToEmployeeId.set(mapping.agent_id, mapping.employee_id);
  }

  // Build email -> employee lookup
  const emailToEmployeeId = new Map<string, string>();
  for (const [email, agentId] of emailToAgentId) {
    const employeeId = agentIdToEmployeeId.get(agentId);
    if (employeeId) {
      emailToEmployeeId.set(email, employeeId);
    }
  }

  // Aggregate by agent email (use email as key for proper aggregation)
  const agentStats = new Map<string, { sales: number; commission: number; agentName: string }>();
  
  for (const sale of sales) {
    const key = sale.agent_email?.toLowerCase() || sale.agent_name || "";
    if (!key) continue;
    
    const items = (saleItems || []).filter(si => si.sale_id === sale.id);
    let saleSales = 0;
    let saleCommission = 0;
    
    for (const item of items) {
      if (!item.product_id || countingProductIds.has(item.product_id)) {
        saleSales += item.quantity || 1;
      }
      saleCommission += (item.mapped_commission || 0) * (item.quantity || 1);
    }
    
    // If no items, count as 1 sale
    if (items.length === 0) {
      saleSales = 1;
    }
    
    const existing = agentStats.get(key) || { sales: 0, commission: 0, agentName: sale.agent_name || key };
    agentStats.set(key, {
      sales: existing.sales + saleSales,
      commission: existing.commission + saleCommission,
      agentName: existing.agentName,
    });
  }

  // Convert to leaderboard entries using proper employee mapping
  const entries: LeaderboardEntry[] = [];
  
  for (const [agentKey, stats] of agentStats) {
    if (stats.sales === 0) continue;
    
    // Try to find employee via email -> agent -> mapping -> employee
    const employeeId = emailToEmployeeId.get(agentKey) || "";
    const empInfo = employeeId ? employeeMap.get(employeeId) : null;
    const teamName = employeeId ? employeeTeamMap.get(employeeId) || null : null;
    
    // Use employee name if found, otherwise fallback to agent_name or email
    const displayNameSource = empInfo?.name || stats.agentName || agentKey;
    
    entries.push({
      employeeId,
      employeeName: empInfo?.name || stats.agentName || agentKey,
      displayName: formatDisplayName(displayNameSource),
      avatarUrl: empInfo?.avatarUrl || null,
      teamName,
      salesCount: stats.sales,
      commission: stats.commission,
      goalTarget: null,
    });
  }
  
  // Sort by commission descending
  entries.sort((a, b) => b.commission - a.commission);
  
  return entries.slice(0, limit);
}

async function calculateTeamLeaderboard(
  supabase: SupabaseClient,
  teamId: string,
  startDate: Date,
  endDate: Date,
  employeeMap: Map<string, { id: string; name: string; avatarUrl: string | null }>,
  teamName: string,
  limit: number = 20
): Promise<LeaderboardEntry[]> {
  const startStr = startDate.toISOString();
  const endStr = endDate.toISOString();

  // Get team member employee IDs
  const { data: teamMemberData } = await supabase
    .from("team_members")
    .select("employee_id")
    .eq("team_id", teamId);
  
  if (!teamMemberData || teamMemberData.length === 0) return [];
  
  const teamEmployeeIds = new Set(teamMemberData.map(tm => tm.employee_id));
  
  // Get agent mappings for team members
  const { data: agentMappings } = await supabase
    .from("employee_agent_mapping")
    .select("employee_id, agent_id, agents(id, email)");
  
  // Build set of agent emails that belong to team members
  const teamAgentEmails = new Set<string>();
  const emailToEmployeeId = new Map<string, string>();
  
  for (const mapping of (agentMappings || [])) {
    if (teamEmployeeIds.has(mapping.employee_id)) {
      const email = (mapping.agents as any)?.email?.toLowerCase();
      if (email) {
        teamAgentEmails.add(email);
        emailToEmployeeId.set(email, mapping.employee_id);
      }
    }
  }

  // Get all sales with agent_email
  const { data: sales } = await supabase
    .from("sales")
    .select("id, agent_email, agent_name")
    .gte("sale_datetime", startStr)
    .lte("sale_datetime", endStr);

  if (!sales || sales.length === 0) return [];

  // Filter to team members by agent_email
  const teamSales = sales.filter(s => 
    s.agent_email && teamAgentEmails.has(s.agent_email.toLowerCase())
  );
  
  if (teamSales.length === 0) return [];

  const saleIds = teamSales.map(s => s.id);
  
  // Get sale items with commission
  const { data: saleItems } = await supabase
    .from("sale_items")
    .select("sale_id, quantity, mapped_commission, product_id")
    .in("sale_id", saleIds);

  // Get products to check counts_as_sale
  const productIds = [...new Set((saleItems || []).map(si => si.product_id).filter(Boolean))];
  let countingProductIds = new Set<string>();
  
  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from("products")
      .select("id, counts_as_sale")
      .in("id", productIds);
    
    countingProductIds = new Set(
      (products || []).filter(p => p.counts_as_sale !== false).map(p => p.id)
    );
  }

  // Aggregate by agent email
  const agentStats = new Map<string, { sales: number; commission: number; agentName: string }>();
  
  for (const sale of teamSales) {
    const key = sale.agent_email?.toLowerCase() || "";
    if (!key) continue;
    
    const items = (saleItems || []).filter(si => si.sale_id === sale.id);
    let saleSales = 0;
    let saleCommission = 0;
    
    for (const item of items) {
      if (!item.product_id || countingProductIds.has(item.product_id)) {
        saleSales += item.quantity || 1;
      }
      saleCommission += (item.mapped_commission || 0) * (item.quantity || 1);
    }
    
    if (items.length === 0) {
      saleSales = 1;
    }
    
    const existing = agentStats.get(key) || { sales: 0, commission: 0, agentName: sale.agent_name || key };
    agentStats.set(key, {
      sales: existing.sales + saleSales,
      commission: existing.commission + saleCommission,
      agentName: existing.agentName,
    });
  }

  // Convert to leaderboard entries
  const entries: LeaderboardEntry[] = [];
  
  for (const [agentEmail, stats] of agentStats) {
    if (stats.sales === 0) continue;
    
    const employeeId = emailToEmployeeId.get(agentEmail) || "";
    const empInfo = employeeId ? employeeMap.get(employeeId) : null;
    
    entries.push({
      employeeId,
      employeeName: empInfo?.name || stats.agentName || agentEmail,
      displayName: formatDisplayName(empInfo?.name || stats.agentName || agentEmail),
      avatarUrl: empInfo?.avatarUrl || null,
      teamName,
      salesCount: stats.sales,
      commission: stats.commission,
      goalTarget: null,
    });
  }
  
  entries.sort((a, b) => b.commission - a.commission);
  
  return entries.slice(0, limit);
}

// ============= CLIENT-SCOPED LEADERBOARD CALCULATION =============

async function calculateClientLeaderboard(
  supabase: SupabaseClient,
  clientId: string,
  startDate: Date,
  endDate: Date,
  employeeMap: Map<string, { id: string; name: string; avatarUrl: string | null }>,
  employeeTeamMap: Map<string, string>,
  limit: number = 30
): Promise<LeaderboardEntry[]> {
  const startStr = startDate.toISOString();
  const endStr = endDate.toISOString();

  // Get campaigns for this client
  const { data: campaigns } = await supabase
    .from("client_campaigns")
    .select("id")
    .eq("client_id", clientId);
  
  const campaignIds = (campaigns || []).map((c: { id: string }) => c.id);
  if (campaignIds.length === 0) return [];

  // Get all sales for this client's campaigns with agent_email
  const { data: sales } = await supabase
    .from("sales")
    .select("id, agent_email, agent_name")
    .in("client_campaign_id", campaignIds)
    .gte("sale_datetime", startStr)
    .lte("sale_datetime", endStr);

  if (!sales || sales.length === 0) return [];

  const saleIds = sales.map(s => s.id);
  
  // Get sale items with commission
  const { data: saleItems } = await supabase
    .from("sale_items")
    .select("sale_id, quantity, mapped_commission, product_id")
    .in("sale_id", saleIds);

  // Get products to check counts_as_sale
  const productIds = [...new Set((saleItems || []).map(si => si.product_id).filter(Boolean))];
  let countingProductIds = new Set<string>();
  
  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from("products")
      .select("id, counts_as_sale")
      .in("id", productIds);
    
    countingProductIds = new Set(
      (products || []).filter(p => p.counts_as_sale !== false).map(p => p.id)
    );
  }

  // Build email -> employee mapping for this function
  const agentEmails = new Set<string>();
  for (const sale of sales) {
    if (sale.agent_email) {
      agentEmails.add(sale.agent_email.toLowerCase());
    }
  }

  const { data: agents } = await supabase
    .from("agents")
    .select("id, email");
  
  const emailToAgentId = new Map<string, string>();
  for (const agent of (agents || [])) {
    if (agent.email) {
      emailToAgentId.set(agent.email.toLowerCase(), agent.id);
    }
  }

  const { data: agentMappings } = await supabase
    .from("employee_agent_mapping")
    .select("agent_id, employee_id");
  
  const agentIdToEmployeeId = new Map<string, string>();
  for (const mapping of (agentMappings || [])) {
    agentIdToEmployeeId.set(mapping.agent_id, mapping.employee_id);
  }

  const emailToEmployeeId = new Map<string, string>();
  for (const [email, agentId] of emailToAgentId) {
    const employeeId = agentIdToEmployeeId.get(agentId);
    if (employeeId) {
      emailToEmployeeId.set(email, employeeId);
    }
  }

  // Aggregate by agent email
  const agentStats = new Map<string, { sales: number; commission: number; agentName: string }>();
  
  for (const sale of sales) {
    const key = sale.agent_email?.toLowerCase() || sale.agent_name || "";
    if (!key) continue;
    
    const items = (saleItems || []).filter(si => si.sale_id === sale.id);
    let saleSales = 0;
    let saleCommission = 0;
    
    for (const item of items) {
      if (!item.product_id || countingProductIds.has(item.product_id)) {
        saleSales += item.quantity || 1;
      }
      saleCommission += (item.mapped_commission || 0) * (item.quantity || 1);
    }
    
    if (items.length === 0) {
      saleSales = 1;
    }
    
    const existing = agentStats.get(key) || { sales: 0, commission: 0, agentName: sale.agent_name || key };
    agentStats.set(key, {
      sales: existing.sales + saleSales,
      commission: existing.commission + saleCommission,
      agentName: existing.agentName,
    });
  }

  // Convert to leaderboard entries
  const entries: LeaderboardEntry[] = [];
  
  for (const [agentKey, stats] of agentStats) {
    if (stats.sales === 0) continue;
    
    const employeeId = emailToEmployeeId.get(agentKey) || "";
    const empInfo = employeeId ? employeeMap.get(employeeId) : null;
    const teamName = employeeId ? employeeTeamMap.get(employeeId) || null : null;
    
    entries.push({
      employeeId,
      employeeName: empInfo?.name || stats.agentName || agentKey,
      displayName: formatDisplayName(empInfo?.name || stats.agentName || agentKey),
      avatarUrl: empInfo?.avatarUrl || null,
      teamName,
      salesCount: stats.sales,
      commission: stats.commission,
      goalTarget: null,
    });
  }
  
  // Sort by commission descending
  entries.sort((a, b) => b.commission - a.commission);
  
  return entries.slice(0, limit);
}

// ============= ORIGINAL KPI CALCULATION FUNCTIONS =============

async function calculateKpiValue(
  supabase: SupabaseClient,
  kpi: KpiDefinition,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const startStr = startDate.toISOString();
  const endStr = endDate.toISOString();

  switch (kpi.slug) {
    case "sales_count":
    case "antal_salg":
      return calculateSalesCount(supabase, startStr, endStr);
    
    case "total_commission":
    case "total_provision":
      return calculateTotalCommission(supabase, startStr, endStr);
    
    case "total_revenue":
    case "total_omsætning":
      return calculateTotalRevenue(supabase, startStr, endStr);
    
    case "total_hours":
    case "total_timer":
      return calculateTotalHours(supabase, startStr, endStr);
    
    case "active_employees":
    case "aktive_medarbejdere":
      return calculateActiveEmployees(supabase);
    
    case "sales_per_hour":
    case "salg_per_time":
      const sales = await calculateSalesCount(supabase, startStr, endStr);
      const hours = await calculateTotalHours(supabase, startStr, endStr);
      return hours > 0 ? sales / hours : 0;
    
    default:
      if (kpi.calculation_formula) {
        return evaluateFormula(supabase, kpi.calculation_formula, startStr, endStr);
      }
      return 0;
  }
}

async function calculateSalesCount(
  supabase: SupabaseClient,
  startStr: string,
  endStr: string
): Promise<number> {
  const { data, error: siError } = await supabase
    .from("sale_items")
    .select("quantity, product_id, sale_id")
    .gte("created_at", startStr)
    .lte("created_at", endStr);

  if (siError) {
    console.error("Error fetching sale_items:", siError);
    return 0;
  }

  const saleItems = (data || []) as SaleItem[];

  const productIds = [...new Set(saleItems.map(si => si.product_id).filter(Boolean))] as string[];
  
  let countingProductIds = new Set<string>();
  if (productIds.length > 0) {
    const { data: productsData } = await supabase
      .from("products")
      .select("id, counts_as_sale")
      .in("id", productIds);
    
    const products = (productsData || []) as Product[];
    countingProductIds = new Set(
      products
        .filter(p => p.counts_as_sale !== false)
        .map(p => p.id)
    );
  }

  let count = 0;
  for (const item of saleItems) {
    if (!item.product_id || countingProductIds.has(item.product_id)) {
      count += item.quantity || 1;
    }
  }

  const { count: fmCount } = await supabase
    .from("fieldmarketing_sales")
    .select("*", { count: "exact", head: true })
    .gte("sale_date", startStr.split("T")[0])
    .lte("sale_date", endStr.split("T")[0]);

  return count + (fmCount || 0);
}

async function calculateTotalCommission(
  supabase: SupabaseClient,
  startStr: string,
  endStr: string
): Promise<number> {
  const { data, error } = await supabase
    .from("sale_items")
    .select("mapped_commission, quantity")
    .gte("created_at", startStr)
    .lte("created_at", endStr);

  if (error) {
    console.error("Error fetching commission:", error);
    return 0;
  }

  const saleItems = (data || []) as SaleItem[];

  return saleItems.reduce((sum, item) => {
    return sum + (item.mapped_commission || 0) * (item.quantity || 1);
  }, 0);
}

async function calculateTotalRevenue(
  supabase: SupabaseClient,
  startStr: string,
  endStr: string
): Promise<number> {
  const { data, error } = await supabase
    .from("sale_items")
    .select("mapped_revenue, quantity")
    .gte("created_at", startStr)
    .lte("created_at", endStr);

  if (error) {
    console.error("Error fetching revenue:", error);
    return 0;
  }

  const saleItems = (data || []) as SaleItem[];

  let total = saleItems.reduce((sum, item) => {
    return sum + (item.mapped_revenue || 0) * (item.quantity || 1);
  }, 0);

  const { data: fmData } = await supabase
    .from("fieldmarketing_sales")
    .select("revenue")
    .gte("sale_date", startStr.split("T")[0])
    .lte("sale_date", endStr.split("T")[0]);

  const fmSales = (fmData || []) as FieldmarketingSale[];
  total += fmSales.reduce((sum, s) => sum + (s.revenue || 0), 0);

  return total;
}

// Shared shift data cache for performance (fetched once per execution)
let shiftDataCache: {
  teamMembers: TeamMemberShift[];
  primaryShifts: TeamStandardShift[];
  shiftDays: ShiftDay[];
  timeStampsData: TimeStampRecord[];
  startDate: string;
  endDate: string;
} | null = null;

async function fetchShiftData(
  supabase: SupabaseClient,
  startStr: string,
  endStr: string
): Promise<typeof shiftDataCache> {
  // Return cached data if available and date range matches
  if (shiftDataCache && shiftDataCache.startDate === startStr && shiftDataCache.endDate === endStr) {
    return shiftDataCache;
  }

  console.log("[HoursCalc] Fetching shift configuration data...");
  
  // Fetch team members
  const { data: teamMembersData } = await supabase
    .from("team_members")
    .select("employee_id, team_id");
  
  const teamMembers = (teamMembersData || []) as TeamMemberShift[];
  const teamIds = [...new Set(teamMembers.map(tm => tm.team_id))];
  
  // Fetch primary shifts for all teams
  const { data: shiftsData } = await supabase
    .from("team_standard_shifts")
    .select("id, team_id, start_time, end_time, hours_source")
    .in("team_id", teamIds)
    .eq("is_active", true);
  
  const primaryShifts = (shiftsData || []) as TeamStandardShift[];
  
  // Fetch shift days for all shifts
  const { data: daysData } = await supabase
    .from("team_standard_shift_days")
    .select("shift_id, day_of_week, start_time, end_time")
    .in("shift_id", primaryShifts.map(s => s.id));
  
  const shiftDays = (daysData || []) as ShiftDay[];
  
  // Fetch timestamps for teams using 'timestamp' hours_source
  const teamsUsingTimestamps = primaryShifts
    .filter(s => s.hours_source === "timestamp")
    .map(s => s.team_id);
  
  let timeStampsData: TimeStampRecord[] = [];
  if (teamsUsingTimestamps.length > 0) {
    const employeesWithTimestampTeams = teamMembers
      .filter(tm => teamsUsingTimestamps.includes(tm.team_id))
      .map(tm => tm.employee_id);
    
    if (employeesWithTimestampTeams.length > 0) {
      const { data: stamps } = await supabase
        .from("time_stamps")
        .select("employee_id, clock_in, clock_out, break_minutes")
        .in("employee_id", employeesWithTimestampTeams)
        .gte("clock_in", startStr)
        .lte("clock_in", endStr);
      
      timeStampsData = (stamps || []) as TimeStampRecord[];
    }
  }
  
  shiftDataCache = { teamMembers, primaryShifts, shiftDays, timeStampsData, startDate: startStr, endDate: endStr };
  console.log(`[HoursCalc] Loaded ${teamMembers.length} team members, ${primaryShifts.length} shifts, ${shiftDays.length} shift days`);
  
  return shiftDataCache;
}

function calculateHoursForEmployees(
  employeeIds: string[],
  startStr: string,
  endStr: string,
  shiftData: NonNullable<typeof shiftDataCache>
): number {
  const { teamMembers, primaryShifts, shiftDays, timeStampsData } = shiftData;
  
  let totalHours = 0;
  const start = new Date(startStr.split("T")[0]);
  const end = new Date(endStr.split("T")[0]);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0];
    const dayOfWeek = d.getDay();
    const adjustedDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
    
    for (const empId of employeeIds) {
      const empTeam = teamMembers.find(tm => tm.employee_id === empId);
      if (!empTeam) continue;
      
      const empShift = primaryShifts.find(s => s.team_id === empTeam.team_id);
      if (!empShift) continue;
      
      const hoursSource = empShift.hours_source || "shift";
      const empShiftDays = shiftDays.filter(sd => sd.shift_id === empShift.id);
      const shiftForDay = empShiftDays.find(sd => sd.day_of_week === adjustedDayOfWeek);
      
      let hours = 0;
      if (hoursSource === "timestamp") {
        const empTimestamp = timeStampsData.find(ts => ts.employee_id === empId && ts.date === dateStr);
        if (empTimestamp?.clock_in && empTimestamp?.clock_out) {
          const [inH, inM] = empTimestamp.clock_in.split(":").map(Number);
          const [outH, outM] = empTimestamp.clock_out.split(":").map(Number);
          const rawHours = outH + outM / 60 - (inH + inM / 60);
          const breakMins = empTimestamp.break_minutes || 0;
          hours = Math.max(0, rawHours - breakMins / 60);
        }
      } else {
        if (shiftForDay?.start_time && shiftForDay?.end_time) {
          const [startH, startM] = shiftForDay.start_time.split(":").map(Number);
          const [endH, endM] = shiftForDay.end_time.split(":").map(Number);
          const rawHours = endH + endM / 60 - (startH + startM / 60);
          const breakMinutes = rawHours > 6 ? 30 : 0;
          hours = rawHours - breakMinutes / 60;
        }
      }
      totalHours += hours;
    }
  }
  
  return Math.round(totalHours * 100) / 100;
}

async function calculateTotalHours(
  supabase: SupabaseClient,
  startStr: string,
  endStr: string
): Promise<number> {
  const shiftData = await fetchShiftData(supabase, startStr, endStr);
  if (!shiftData) return 0;
  
  // Get all employee IDs
  const allEmployeeIds = [...new Set(shiftData.teamMembers.map(tm => tm.employee_id))];
  
  return calculateHoursForEmployees(allEmployeeIds, startStr, endStr, shiftData);
}

async function calculateActiveEmployees(
  supabase: SupabaseClient
): Promise<number> {
  const { count } = await supabase
    .from("employee_master_data")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  return count || 0;
}

async function evaluateFormula(
  supabase: SupabaseClient,
  formula: string,
  _startStr: string,
  _endStr: string
): Promise<number> {
  let evalFormula = formula;
  
  const tokenMatches = formula.match(/\{([^}]+)\}/g) || [];
  
  for (const token of tokenMatches) {
    const slug = token.replace(/[{}]/g, "");
    
    const { data: cached } = await supabase
      .from("kpi_cached_values")
      .select("value")
      .eq("kpi_slug", slug)
      .eq("scope_type", "global")
      .is("scope_id", null)
      .single();
    
    const cachedData = cached as { value: number } | null;
    const value = cachedData?.value || 0;
    evalFormula = evalFormula.replace(token, value.toString());
  }
  
  try {
    const result = new Function(`return ${evalFormula}`)();
    return typeof result === "number" && isFinite(result) ? result : 0;
  } catch {
    console.error("Error evaluating formula:", evalFormula);
    return 0;
  }
}

// Client-scoped KPI calculation
async function calculateClientKpiValue(
  supabase: SupabaseClient,
  kpiSlug: string,
  clientId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const startStr = startDate.toISOString();
  const endStr = endDate.toISOString();

  const { data: campaigns } = await supabase
    .from("client_campaigns")
    .select("id")
    .eq("client_id", clientId);
  
  const campaignIds = (campaigns || []).map((c: { id: string }) => c.id);
  
  if (campaignIds.length === 0) {
    return 0;
  }

  switch (kpiSlug) {
    case "sales_count":
    case "antal_salg": {
      const { data: sales } = await supabase
        .from("sales")
        .select("id")
        .in("client_campaign_id", campaignIds)
        .gte("sale_datetime", startStr)
        .lte("sale_datetime", endStr);
      
      const saleIds = (sales || []).map((s: { id: string }) => s.id);
      if (saleIds.length === 0) return 0;

      const { data: saleItems } = await supabase
        .from("sale_items")
        .select("quantity, product_id")
        .in("sale_id", saleIds);

      const productIds = [...new Set((saleItems || []).map((si: any) => si.product_id).filter(Boolean))] as string[];
      
      let countingProductIds = new Set<string>();
      if (productIds.length > 0) {
        const { data: productsData } = await supabase
          .from("products")
          .select("id, counts_as_sale")
          .in("id", productIds);
        
        const products = (productsData || []) as Product[];
        countingProductIds = new Set(
          products.filter(p => p.counts_as_sale !== false).map(p => p.id)
        );
      }

      let count = 0;
      for (const item of (saleItems || []) as SaleItem[]) {
        if (!item.product_id || countingProductIds.has(item.product_id)) {
          count += item.quantity || 1;
        }
      }
      return count;
    }

    case "total_commission":
    case "total_provision": {
      const { data: sales } = await supabase
        .from("sales")
        .select("id")
        .in("client_campaign_id", campaignIds)
        .gte("sale_datetime", startStr)
        .lte("sale_datetime", endStr);
      
      const saleIds = (sales || []).map((s: { id: string }) => s.id);
      if (saleIds.length === 0) return 0;

      const { data: saleItems } = await supabase
        .from("sale_items")
        .select("mapped_commission, quantity")
        .in("sale_id", saleIds);

      return ((saleItems || []) as SaleItem[]).reduce((sum, item) => {
        return sum + (item.mapped_commission || 0) * (item.quantity || 1);
      }, 0);
    }

    case "total_revenue":
    case "total_omsætning": {
      const { data: sales } = await supabase
        .from("sales")
        .select("id")
        .in("client_campaign_id", campaignIds)
        .gte("sale_datetime", startStr)
        .lte("sale_datetime", endStr);
      
      const saleIds = (sales || []).map((s: { id: string }) => s.id);
      if (saleIds.length === 0) return 0;

      const { data: saleItems } = await supabase
        .from("sale_items")
        .select("mapped_revenue, quantity")
        .in("sale_id", saleIds);

      return ((saleItems || []) as SaleItem[]).reduce((sum, item) => {
        return sum + (item.mapped_revenue || 0) * (item.quantity || 1);
      }, 0);
    }

    case "total_hours":
    case "total_timer": {
      // Find all agent emails with sales for this client
      const { data: sales } = await supabase
        .from("sales")
        .select("agent_email")
        .in("client_campaign_id", campaignIds)
        .gte("sale_datetime", startStr)
        .lte("sale_datetime", endStr);
      
      const agentEmails = [...new Set((sales || []).map((s: any) => s.agent_email?.toLowerCase()).filter(Boolean))];
      
      if (agentEmails.length === 0) return 0;
      
      // Get agent IDs from emails
      const { data: agents } = await supabase
        .from("agents")
        .select("id, email")
        .in("email", agentEmails);
      
      const agentIds = (agents || []).map((a: any) => a.id);
      if (agentIds.length === 0) return 0;
      
      // Map agent IDs to employee IDs
      const { data: agentMappings } = await supabase
        .from("employee_agent_mapping")
        .select("employee_id")
        .in("agent_id", agentIds);
      
      const employeeIds = [...new Set((agentMappings || []).map((m: any) => m.employee_id))];
      if (employeeIds.length === 0) return 0;
      
      // Calculate hours for these specific employees
      const shiftData = await fetchShiftData(supabase, startStr, endStr);
      if (!shiftData) return 0;
      
      return calculateHoursForEmployees(employeeIds, startStr, endStr, shiftData);
    }

    default:
      return 0;
  }
}
