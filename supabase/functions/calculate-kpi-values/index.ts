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

interface EmployeeShift {
  hours: number | null;
  date: string;
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
    const clientScopedKpis = ["sales_count", "total_commission", "total_revenue", "antal_salg", "total_provision"];
    
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

    // ============= LEADERBOARD CACHE CALCULATION =============
    console.log("Calculating global leaderboards...");
    
    // Fetch employee data for leaderboards
    const { data: employees } = await supabase
      .from("employee_master_data")
      .select("id, first_name, last_name, avatar_url")
      .eq("is_active", true);
    
    const employeeMap = new Map<string, { id: string; name: string; avatarUrl: string | null }>();
    (employees || []).forEach(emp => {
      const fullName = `${emp.first_name} ${emp.last_name}`;
      employeeMap.set(fullName.toLowerCase(), {
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
      .select("id, name")
      .eq("is_active", true);
    
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

  // Get all sales with agent info
  const { data: sales } = await supabase
    .from("sales")
    .select("id, agent_name")
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

  // Aggregate by agent
  const agentStats = new Map<string, { sales: number; commission: number }>();
  
  for (const sale of sales) {
    if (!sale.agent_name) continue;
    
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
    
    const existing = agentStats.get(sale.agent_name) || { sales: 0, commission: 0 };
    agentStats.set(sale.agent_name, {
      sales: existing.sales + saleSales,
      commission: existing.commission + saleCommission,
    });
  }

  // Convert to leaderboard entries and sort
  const entries: LeaderboardEntry[] = [];
  
  for (const [agentName, stats] of agentStats) {
    if (stats.sales === 0) continue;
    
    const empInfo = employeeMap.get(agentName.toLowerCase());
    const employeeId = empInfo?.id || "";
    const teamName = employeeId ? employeeTeamMap.get(employeeId) || null : null;
    
    entries.push({
      employeeId,
      employeeName: empInfo?.name || agentName,
      displayName: formatDisplayName(empInfo?.name || agentName),
      avatarUrl: empInfo?.avatarUrl || null,
      teamName,
      salesCount: stats.sales,
      commission: stats.commission,
      goalTarget: null, // Could be added later
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
  
  const teamEmployeeIds = teamMemberData.map(tm => tm.employee_id);
  
  // Get employee names for matching
  const { data: teamEmployees } = await supabase
    .from("employee_master_data")
    .select("id, first_name, last_name, avatar_url")
    .in("id", teamEmployeeIds);
  
  const teamEmployeeNames = new Set(
    (teamEmployees || []).map(e => `${e.first_name} ${e.last_name}`.toLowerCase())
  );

  // Get all sales with agent info
  const { data: sales } = await supabase
    .from("sales")
    .select("id, agent_name")
    .gte("sale_datetime", startStr)
    .lte("sale_datetime", endStr);

  if (!sales || sales.length === 0) return [];

  // Filter to team members only
  const teamSales = sales.filter(s => 
    s.agent_name && teamEmployeeNames.has(s.agent_name.toLowerCase())
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

  // Aggregate by agent
  const agentStats = new Map<string, { sales: number; commission: number }>();
  
  for (const sale of teamSales) {
    if (!sale.agent_name) continue;
    
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
    
    const existing = agentStats.get(sale.agent_name) || { sales: 0, commission: 0 };
    agentStats.set(sale.agent_name, {
      sales: existing.sales + saleSales,
      commission: existing.commission + saleCommission,
    });
  }

  // Convert to leaderboard entries
  const entries: LeaderboardEntry[] = [];
  
  for (const [agentName, stats] of agentStats) {
    if (stats.sales === 0) continue;
    
    const empInfo = employeeMap.get(agentName.toLowerCase());
    
    entries.push({
      employeeId: empInfo?.id || "",
      employeeName: empInfo?.name || agentName,
      displayName: formatDisplayName(empInfo?.name || agentName),
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

  // Get all sales for this client's campaigns
  const { data: sales } = await supabase
    .from("sales")
    .select("id, agent_name")
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

  // Aggregate by agent
  const agentStats = new Map<string, { sales: number; commission: number }>();
  
  for (const sale of sales) {
    if (!sale.agent_name) continue;
    
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
    
    const existing = agentStats.get(sale.agent_name) || { sales: 0, commission: 0 };
    agentStats.set(sale.agent_name, {
      sales: existing.sales + saleSales,
      commission: existing.commission + saleCommission,
    });
  }

  // Convert to leaderboard entries and sort
  const entries: LeaderboardEntry[] = [];
  
  for (const [agentName, stats] of agentStats) {
    if (stats.sales === 0) continue;
    
    const empInfo = employeeMap.get(agentName.toLowerCase());
    const employeeId = empInfo?.id || "";
    const teamName = employeeId ? employeeTeamMap.get(employeeId) || null : null;
    
    entries.push({
      employeeId,
      employeeName: empInfo?.name || agentName,
      displayName: formatDisplayName(empInfo?.name || agentName),
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

async function calculateTotalHours(
  supabase: SupabaseClient,
  startStr: string,
  endStr: string
): Promise<number> {
  const { data, error } = await supabase
    .from("employee_shifts")
    .select("hours, date")
    .gte("date", startStr.split("T")[0])
    .lte("date", endStr.split("T")[0]);

  if (error) {
    console.error("Error fetching shifts:", error);
    return 0;
  }

  const shifts = (data || []) as EmployeeShift[];

  return shifts.reduce((sum, shift) => sum + (shift.hours || 0), 0);
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

    default:
      return 0;
  }
}
