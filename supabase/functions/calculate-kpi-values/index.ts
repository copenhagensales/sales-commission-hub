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

interface FmSale {
  id: string;
  product_name: string | null;
  client_id: string | null;
  seller_email: string | null;
  seller_name: string | null;
}

interface FmPricingRule {
  product_name: string;
  commission_dkk: number | null;
  price_dkk: number | null;
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

// Batch fetch sale_items to avoid 1000-row limit
async function fetchAllSaleItems(
  supabase: SupabaseClient,
  saleIds: string[]
): Promise<{ sale_id: string; quantity: number; mapped_commission: number; product_id: string | null }[]> {
  if (saleIds.length === 0) return [];
  
  const BATCH_SIZE = 500;
  const allItems: { sale_id: string; quantity: number; mapped_commission: number; product_id: string | null }[] = [];
  
  for (let i = 0; i < saleIds.length; i += BATCH_SIZE) {
    const batch = saleIds.slice(i, i + BATCH_SIZE);
    const { data: items } = await supabase
      .from("sale_items")
      .select("sale_id, quantity, mapped_commission, product_id")
      .in("sale_id", batch);
    
    if (items) {
      allItems.push(...items);
    }
  }
  
  console.log(`[fetchAllSaleItems] Fetched ${allItems.length} items from ${saleIds.length} sales in ${Math.ceil(saleIds.length / BATCH_SIZE)} batches`);
  return allItems;
}

// ============= FM COMMISSION MAP HELPER =============
// Fetches product pricing rules and creates a case-insensitive map of product_name -> commission_dkk
// Prioritizes highest commission for each product
async function fetchFmCommissionMap(supabase: SupabaseClient): Promise<Map<string, { commission: number; price: number }>> {
  const { data: rules } = await supabase
    .from("product_pricing_rules")
    .select("product_name, commission_dkk, price_dkk")
    .order("commission_dkk", { ascending: false, nullsFirst: false });
  
  const map = new Map<string, { commission: number; price: number }>();
  for (const rule of (rules || []) as FmPricingRule[]) {
    const key = rule.product_name?.toLowerCase();
    if (key && !map.has(key)) {
      // First occurrence has highest commission due to ordering
      map.set(key, {
        commission: rule.commission_dkk || 0,
        price: rule.price_dkk || 0,
      });
    }
  }
  console.log(`[fetchFmCommissionMap] Loaded ${map.size} FM product pricing rules`);
  return map;
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

    // Pre-fetch FM commission map once for all calculations
    const fmCommissionMap = await fetchFmCommissionMap(supabase);

    // Calculate each KPI for each period (global scope)
    for (const kpi of (kpiDefinitions as KpiDefinition[]) || []) {
      for (const period of periods) {
        try {
          const value = await calculateKpiValue(supabase, kpi, period.start, period.end, fmCommissionMap);
          
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
            const value = await calculateClientKpiValue(supabase, kpiSlug, client.id, period.start, period.end, fmCommissionMap);
            
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
  
  // Fetch all sales data once for efficiency
  const payrollPeriodDates = getPayrollPeriod(now);
  const { data: allPeriodSales } = await supabase
    .from("sales")
    .select("id, agent_email, agent_external_id, sale_datetime, sale_items(mapped_commission, quantity, product_id)")
    .gte("sale_datetime", payrollPeriodDates.start.toISOString())
    .lte("sale_datetime", payrollPeriodDates.end.toISOString());
  
  // Fetch FM sales for employee-scoped calculations
  // Use seller_id (not seller_email) to match FM sales to employees
  const { data: allPeriodFmSales } = await supabase
    .from("fieldmarketing_sales")
    .select("id, product_name, seller_id, client_id, registered_at")
    .gte("registered_at", payrollPeriodDates.start.toISOString())
    .lte("registered_at", payrollPeriodDates.end.toISOString());
  
  console.log(`[Employee-scoped] Loaded ${(allPeriodSales || []).length} telesales, ${(allPeriodFmSales || []).length} FM sales for payroll period`);
  
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
  
  // Calculate for each active employee
  // Don't skip employees without agent mappings - they might have FM sales
  for (const emp of (activeEmployees || [])) {
    const agentData = employeeAgentMap.get(emp.id);
    const hasAgentMappings = agentData && 
      (agentData.emails.length > 0 || agentData.externalIds.length > 0);
    
    for (const period of employeePeriods) {
      // Filter telesales for this employee in this period (only if they have agent mappings)
      const empSales = hasAgentMappings ? (allPeriodSales || []).filter((sale: any) => {
        const saleDate = new Date(sale.sale_datetime);
        if (saleDate < period.start || saleDate > period.end) return false;
        
        const saleEmail = sale.agent_email?.toLowerCase();
        const saleExternalId = sale.agent_external_id;
        
        return (saleEmail && agentData!.emails.includes(saleEmail)) ||
               (saleExternalId && agentData!.externalIds.includes(saleExternalId));
      }) : [];
      
      // Filter FM sales for this employee in this period
      // Match directly on seller_id = employee.id (same logic as DailyReports)
      const empFmSales = (allPeriodFmSales || []).filter((sale: any) => {
        const saleDate = new Date(sale.registered_at);
        if (saleDate < period.start || saleDate > period.end) return false;
        
        return sale.seller_id === emp.id;
      });
      
      // Calculate sales count (telesales)
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
      
      // Add FM sales count and commission
      for (const fmSale of empFmSales) {
        salesCount += 1;
        const fmPricing = fmCommissionMap.get((fmSale as any).product_name?.toLowerCase());
        totalCommission += fmPricing?.commission || 0;
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
  
  // For each team with a goal, calculate commission including FM
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
    
    // Calculate team commission from already-fetched telesales data
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
    
    // Add FM commission for team members
    for (const fmSale of (allPeriodFmSales || [])) {
      const sellerEmail = (fmSale as any).seller_email?.toLowerCase();
      if (sellerEmail && teamAgentEmails.includes(sellerEmail)) {
        const fmPricing = fmCommissionMap.get((fmSale as any).product_name?.toLowerCase());
        teamCommission += fmPricing?.commission || 0;
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
          fmCommissionMap,
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
            fmCommissionMap,
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
            fmCommissionMap,
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

// Type for sales with nested sale_items (JOIN approach)
type SaleWithItems = {
  id: string;
  agent_email: string | null;
  agent_name: string | null;
  sale_items: { sale_id: string; quantity: number; mapped_commission: number; product_id: string | null }[];
};

// Paginated fetch for sales WITH nested sale_items using JOIN
// This avoids the .in() query limits by fetching items together with sales
async function fetchAllSalesWithItems(
  supabase: SupabaseClient,
  startStr: string,
  endStr: string,
  campaignFilter?: string[] // Optional: filter by client_campaign_id
): Promise<SaleWithItems[]> {
  const PAGE_SIZE = 500; // Smaller batches since we're fetching nested data
  const allSales: SaleWithItems[] = [];
  let page = 0;
  let hasMore = true;
  
  while (hasMore) {
    let query = supabase
      .from("sales")
      .select("id, agent_email, agent_name, sale_items(sale_id, quantity, mapped_commission, product_id)")
      .gte("sale_datetime", startStr)
      .lte("sale_datetime", endStr)
      .order("sale_datetime", { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    
    // Apply campaign filter if provided
    if (campaignFilter && campaignFilter.length > 0) {
      query = query.in("client_campaign_id", campaignFilter);
    }
    
    const { data: sales, error } = await query;
    
    if (error) {
      console.error(`[fetchAllSalesWithItems] Error on page ${page}:`, error);
      hasMore = false;
      continue;
    }
    
    if (sales && sales.length > 0) {
      // Type assertion since Supabase types might not infer nested correctly
      allSales.push(...(sales as SaleWithItems[]));
      hasMore = sales.length === PAGE_SIZE;
      page++;
    } else {
      hasMore = false;
    }
  }
  
  // Count total items fetched via the JOIN
  const totalItems = allSales.reduce((sum, s) => sum + (s.sale_items?.length || 0), 0);
  const totalCommission = allSales.reduce((sum, s) => 
    sum + (s.sale_items || []).reduce((isum, item) => isum + (item.mapped_commission || 0), 0), 0
  );
  
  console.log(`[fetchAllSalesWithItems] Fetched ${allSales.length} sales with ${totalItems} items (total mapped_commission: ${totalCommission}) in ${page} page(s)`);
  return allSales;
}

// Fetch FM sales for a date range
async function fetchFmSalesForPeriod(
  supabase: SupabaseClient,
  startStr: string,
  endStr: string,
  clientId?: string
): Promise<FmSale[]> {
  let query = supabase
    .from("fieldmarketing_sales")
    .select("id, product_name, seller_email, seller_name, client_id")
    .gte("registered_at", startStr)
    .lte("registered_at", endStr);
  
  if (clientId) {
    query = query.eq("client_id", clientId);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error("[fetchFmSalesForPeriod] Error:", error);
    return [];
  }
  
  return (data || []) as FmSale[];
}

async function calculateGlobalLeaderboard(
  supabase: SupabaseClient,
  startDate: Date,
  endDate: Date,
  employeeMap: Map<string, { id: string; name: string; avatarUrl: string | null }>,
  employeeTeamMap: Map<string, string>,
  fmCommissionMap: Map<string, { commission: number; price: number }>,
  limit: number = 30
): Promise<LeaderboardEntry[]> {
  const startStr = startDate.toISOString();
  const endStr = endDate.toISOString();

  // Get all telesales WITH their sale_items using JOIN-based paginated fetch
  const salesWithItems = await fetchAllSalesWithItems(supabase, startStr, endStr);

  // Get all FM sales for this period
  const fmSales = await fetchFmSalesForPeriod(supabase, startStr, endStr);

  if ((!salesWithItems || salesWithItems.length === 0) && fmSales.length === 0) return [];

  // Extract all sale_items from the nested data
  const saleItems = salesWithItems.flatMap(s => s.sale_items || []);
  
  // Debug: Log totals
  const totalMappedCommission = saleItems.reduce((sum, item) => sum + (item.mapped_commission || 0), 0);
  console.log(`[GlobalLeaderboard ${startStr.slice(0,10)} to ${endStr.slice(0,10)}] Telesales: ${salesWithItems.length}, FM: ${fmSales.length}, Items: ${saleItems.length}, Total mapped_commission: ${totalMappedCommission}`);

  // Get products to check counts_as_sale AND get commission_dkk for fallback
  const productIds = [...new Set((saleItems || []).map(si => si.product_id).filter(Boolean))];
  let countingProductIds = new Set<string>();
  const productCommissionMap = new Map<string, number>();
  
  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from("products")
      .select("id, counts_as_sale, commission_dkk")
      .in("id", productIds);
    
    countingProductIds = new Set(
      (products || []).filter(p => p.counts_as_sale !== false).map(p => p.id)
    );
    (products || []).forEach(p => productCommissionMap.set(p.id, p.commission_dkk || 0));
  }

  // Collect unique agent emails for mapping lookup
  const agentEmails = new Set<string>();
  for (const sale of salesWithItems) {
    if (sale.agent_email) {
      agentEmails.add(sale.agent_email.toLowerCase());
    }
  }
  for (const fmSale of fmSales) {
    if (fmSale.seller_email) {
      agentEmails.add(fmSale.seller_email.toLowerCase());
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
  
  // Process telesales
  for (const sale of salesWithItems) {
    const key = sale.agent_email?.toLowerCase() || sale.agent_name || "";
    if (!key) continue;
    
    // Use nested sale_items directly from the sale object
    const items = sale.sale_items || [];
    let saleSales = 0;
    let saleCommission = 0;
    
    for (const item of items) {
      if (!item.product_id || countingProductIds.has(item.product_id)) {
        saleSales += item.quantity || 1;
      }
      // mapped_commission already includes quantity; fallback to product.commission_dkk * quantity
      const itemCommission = (item.mapped_commission && item.mapped_commission > 0)
        ? item.mapped_commission
        : (item.product_id ? (productCommissionMap.get(item.product_id) || 0) : 0) * (item.quantity || 1);
      saleCommission += itemCommission;
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

  // Process FM sales
  for (const fmSale of fmSales) {
    const key = fmSale.seller_email?.toLowerCase() || fmSale.seller_name || "";
    if (!key) continue;
    
    const fmPricing = fmCommissionMap.get(fmSale.product_name?.toLowerCase() || "");
    const fmCommission = fmPricing?.commission || 0;
    
    const existing = agentStats.get(key) || { sales: 0, commission: 0, agentName: fmSale.seller_name || key };
    agentStats.set(key, {
      sales: existing.sales + 1,
      commission: existing.commission + fmCommission,
      agentName: existing.agentName || fmSale.seller_name || key,
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
  fmCommissionMap: Map<string, { commission: number; price: number }>,
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

  // Get all telesales WITH nested sale_items using JOIN-based paginated fetch
  const salesWithItems = await fetchAllSalesWithItems(supabase, startStr, endStr);

  // Get all FM sales for this period
  const fmSales = await fetchFmSalesForPeriod(supabase, startStr, endStr);

  // Filter telesales to team members by agent_email
  const teamSales = salesWithItems.filter(s => 
    s.agent_email && teamAgentEmails.has(s.agent_email.toLowerCase())
  );

  // Filter FM sales to team members by seller_email
  const teamFmSales = fmSales.filter(s => 
    s.seller_email && teamAgentEmails.has(s.seller_email.toLowerCase())
  );
  
  if (teamSales.length === 0 && teamFmSales.length === 0) return [];

  // Extract all sale_items from the team sales
  const saleItems = teamSales.flatMap(s => s.sale_items || []);

  // Get products to check counts_as_sale AND get commission_dkk for fallback
  const productIds = [...new Set(saleItems.map(si => si.product_id).filter(Boolean))];
  let countingProductIds = new Set<string>();
  const productCommissionMap = new Map<string, number>();
  
  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from("products")
      .select("id, counts_as_sale, commission_dkk")
      .in("id", productIds);
    
    countingProductIds = new Set(
      (products || []).filter(p => p.counts_as_sale !== false).map(p => p.id)
    );
    (products || []).forEach(p => productCommissionMap.set(p.id, p.commission_dkk || 0));
  }

  // Aggregate by agent email
  const agentStats = new Map<string, { sales: number; commission: number; agentName: string }>();
  
  // Process telesales
  for (const sale of teamSales) {
    const key = sale.agent_email?.toLowerCase() || "";
    if (!key) continue;
    
    // Use nested sale_items directly from the sale object
    const items = sale.sale_items || [];
    let saleSales = 0;
    let saleCommission = 0;
    
    for (const item of items) {
      if (!item.product_id || countingProductIds.has(item.product_id)) {
        saleSales += item.quantity || 1;
      }
      // mapped_commission already includes quantity; fallback to product.commission_dkk * quantity
      const itemCommission = (item.mapped_commission && item.mapped_commission > 0)
        ? item.mapped_commission
        : (item.product_id ? (productCommissionMap.get(item.product_id) || 0) : 0) * (item.quantity || 1);
      saleCommission += itemCommission;
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

  // Process FM sales
  for (const fmSale of teamFmSales) {
    const key = fmSale.seller_email?.toLowerCase() || "";
    if (!key) continue;
    
    const fmPricing = fmCommissionMap.get(fmSale.product_name?.toLowerCase() || "");
    const fmCommission = fmPricing?.commission || 0;
    
    const existing = agentStats.get(key) || { sales: 0, commission: 0, agentName: fmSale.seller_name || key };
    agentStats.set(key, {
      sales: existing.sales + 1,
      commission: existing.commission + fmCommission,
      agentName: existing.agentName || fmSale.seller_name || key,
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
  fmCommissionMap: Map<string, { commission: number; price: number }>,
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

  // Get all telesales for this client's campaigns WITH nested sale_items
  const salesWithItems = campaignIds.length > 0 
    ? await fetchAllSalesWithItems(supabase, startStr, endStr, campaignIds)
    : [];

  // Get FM sales for this client
  const fmSales = await fetchFmSalesForPeriod(supabase, startStr, endStr, clientId);

  if ((salesWithItems.length === 0) && (fmSales.length === 0)) return [];

  // Extract all sale_items from the sales
  const saleItems = salesWithItems.flatMap(s => s.sale_items || []);

  // Get products to check counts_as_sale AND get commission_dkk for fallback
  const productIds = [...new Set(saleItems.map(si => si.product_id).filter(Boolean))];
  let countingProductIds = new Set<string>();
  const productCommissionMap = new Map<string, number>();
  
  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from("products")
      .select("id, counts_as_sale, commission_dkk")
      .in("id", productIds);
    
    countingProductIds = new Set(
      (products || []).filter(p => p.counts_as_sale !== false).map(p => p.id)
    );
    (products || []).forEach(p => productCommissionMap.set(p.id, p.commission_dkk || 0));
  }

  // Build email -> employee mapping for this function
  const agentEmails = new Set<string>();
  for (const sale of salesWithItems) {
    if (sale.agent_email) {
      agentEmails.add(sale.agent_email.toLowerCase());
    }
  }
  for (const fmSale of fmSales) {
    if (fmSale.seller_email) {
      agentEmails.add(fmSale.seller_email.toLowerCase());
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
  
  // Process telesales
  for (const sale of salesWithItems) {
    const key = sale.agent_email?.toLowerCase() || sale.agent_name || "";
    if (!key) continue;
    
    // Use nested sale_items directly from the sale object
    const items = sale.sale_items || [];
    let saleSales = 0;
    let saleCommission = 0;
    
    for (const item of items) {
      if (!item.product_id || countingProductIds.has(item.product_id)) {
        saleSales += item.quantity || 1;
      }
      // mapped_commission already includes quantity; fallback to product.commission_dkk * quantity
      const itemCommission = (item.mapped_commission && item.mapped_commission > 0)
        ? item.mapped_commission
        : (item.product_id ? (productCommissionMap.get(item.product_id) || 0) : 0) * (item.quantity || 1);
      saleCommission += itemCommission;
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

  // Process FM sales
  for (const fmSale of fmSales) {
    const key = fmSale.seller_email?.toLowerCase() || fmSale.seller_name || "";
    if (!key) continue;
    
    const fmPricing = fmCommissionMap.get(fmSale.product_name?.toLowerCase() || "");
    const fmCommission = fmPricing?.commission || 0;
    
    const existing = agentStats.get(key) || { sales: 0, commission: 0, agentName: fmSale.seller_name || key };
    agentStats.set(key, {
      sales: existing.sales + 1,
      commission: existing.commission + fmCommission,
      agentName: existing.agentName || fmSale.seller_name || key,
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
  endDate: Date,
  fmCommissionMap: Map<string, { commission: number; price: number }>
): Promise<number> {
  const startStr = startDate.toISOString();
  const endStr = endDate.toISOString();

  switch (kpi.slug) {
    case "sales_count":
    case "antal_salg":
      return calculateSalesCount(supabase, startStr, endStr);
    
    case "total_commission":
    case "total_provision":
      return calculateTotalCommission(supabase, startStr, endStr, fmCommissionMap);
    
    case "total_revenue":
    case "total_omsætning":
      return calculateTotalRevenue(supabase, startStr, endStr, fmCommissionMap);
    
    case "total_hours":
    case "total_timer":
      return calculateTotalHours(supabase, startStr, endStr);
    
    case "active_employees":
    case "aktive_medarbejdere":
      return calculateActiveEmployees(supabase);
    
    case "staff_employees":
      return calculateStaffEmployees(supabase);
    
    case "team_count":
      return calculateTeamCount(supabase);
    
    case "position_count":
      return calculatePositionCount(supabase);
    
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
    .gte("registered_at", startStr)
    .lte("registered_at", endStr);

  return count + (fmCount || 0);
}

async function calculateTotalCommission(
  supabase: SupabaseClient,
  startStr: string,
  endStr: string,
  fmCommissionMap: Map<string, { commission: number; price: number }>
): Promise<number> {
  // Telesales commission from sale_items
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

  let telesalesCommission = saleItems.reduce((sum, item) => {
    return sum + (item.mapped_commission || 0) * (item.quantity || 1);
  }, 0);

  // FM commission from fieldmarketing_sales
  const { data: fmSales } = await supabase
    .from("fieldmarketing_sales")
    .select("product_name")
    .gte("registered_at", startStr)
    .lte("registered_at", endStr);

  let fmCommission = 0;
  for (const sale of (fmSales || [])) {
    const pricing = fmCommissionMap.get((sale as any).product_name?.toLowerCase());
    fmCommission += pricing?.commission || 0;
  }

  console.log(`[TotalCommission] Telesales: ${telesalesCommission}, FM: ${fmCommission}`);
  return telesalesCommission + fmCommission;
}

async function calculateTotalRevenue(
  supabase: SupabaseClient,
  startStr: string,
  endStr: string,
  fmCommissionMap: Map<string, { commission: number; price: number }>
): Promise<number> {
  // Telesales revenue from sale_items
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

  let telesalesRevenue = saleItems.reduce((sum, item) => {
    return sum + (item.mapped_revenue || 0) * (item.quantity || 1);
  }, 0);

  // FM revenue from fieldmarketing_sales using price_dkk
  const { data: fmSales } = await supabase
    .from("fieldmarketing_sales")
    .select("product_name")
    .gte("registered_at", startStr)
    .lte("registered_at", endStr);

  let fmRevenue = 0;
  for (const sale of (fmSales || [])) {
    const pricing = fmCommissionMap.get((sale as any).product_name?.toLowerCase());
    fmRevenue += pricing?.price || 0;
  }

  console.log(`[TotalRevenue] Telesales: ${telesalesRevenue}, FM: ${fmRevenue}`);
  return telesalesRevenue + fmRevenue;
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
    .eq("is_active", true)
    .eq("is_staff_employee", false);

  return count || 0;
}

async function calculateStaffEmployees(
  supabase: SupabaseClient
): Promise<number> {
  const { count } = await supabase
    .from("employee_master_data")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true)
    .eq("is_staff_employee", true);

  return count || 0;
}

async function calculateTeamCount(
  supabase: SupabaseClient
): Promise<number> {
  const { count } = await supabase
    .from("teams")
    .select("*", { count: "exact", head: true });

  return count || 0;
}

async function calculatePositionCount(
  supabase: SupabaseClient
): Promise<number> {
  const { count } = await supabase
    .from("job_positions")
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
  endDate: Date,
  fmCommissionMap: Map<string, { commission: number; price: number }>
): Promise<number> {
  const startStr = startDate.toISOString();
  const endStr = endDate.toISOString();

  const { data: campaigns } = await supabase
    .from("client_campaigns")
    .select("id")
    .eq("client_id", clientId);
  
  const campaignIds = (campaigns || []).map((c: { id: string }) => c.id);

  switch (kpiSlug) {
    case "sales_count":
    case "antal_salg": {
      // Telesales count
      let telesalesCount = 0;
      if (campaignIds.length > 0) {
        const { data: sales } = await supabase
          .from("sales")
          .select("id")
          .in("client_campaign_id", campaignIds)
          .gte("sale_datetime", startStr)
          .lte("sale_datetime", endStr);
        
        const saleIds = (sales || []).map((s: { id: string }) => s.id);
        if (saleIds.length > 0) {
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

          for (const item of (saleItems || []) as SaleItem[]) {
            if (!item.product_id || countingProductIds.has(item.product_id)) {
              telesalesCount += item.quantity || 1;
            }
          }
        }
      }
      
      // FM sales count for this client
      const { count: fmCount } = await supabase
        .from("fieldmarketing_sales")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId)
        .gte("registered_at", startStr)
        .lte("registered_at", endStr);
      
      return telesalesCount + (fmCount || 0);
    }

    case "total_commission":
    case "total_provision": {
      // Telesales commission
      let telesalesCommission = 0;
      if (campaignIds.length > 0) {
        const { data: sales } = await supabase
          .from("sales")
          .select("id")
          .in("client_campaign_id", campaignIds)
          .gte("sale_datetime", startStr)
          .lte("sale_datetime", endStr);
        
        const saleIds = (sales || []).map((s: { id: string }) => s.id);
        if (saleIds.length > 0) {
          const { data: saleItems } = await supabase
            .from("sale_items")
            .select("mapped_commission, quantity")
            .in("sale_id", saleIds);

          telesalesCommission = ((saleItems || []) as SaleItem[]).reduce((sum, item) => {
            return sum + (item.mapped_commission || 0) * (item.quantity || 1);
          }, 0);
        }
      }
      
      // FM commission for this client
      const { data: fmSales } = await supabase
        .from("fieldmarketing_sales")
        .select("product_name")
        .eq("client_id", clientId)
        .gte("registered_at", startStr)
        .lte("registered_at", endStr);
      
      let fmCommission = 0;
      for (const sale of (fmSales || [])) {
        const pricing = fmCommissionMap.get((sale as any).product_name?.toLowerCase());
        fmCommission += pricing?.commission || 0;
      }
      
      return telesalesCommission + fmCommission;
    }

    case "total_revenue":
    case "total_omsætning": {
      // Telesales revenue
      let telesalesRevenue = 0;
      if (campaignIds.length > 0) {
        const { data: sales } = await supabase
          .from("sales")
          .select("id")
          .in("client_campaign_id", campaignIds)
          .gte("sale_datetime", startStr)
          .lte("sale_datetime", endStr);
        
        const saleIds = (sales || []).map((s: { id: string }) => s.id);
        if (saleIds.length > 0) {
          const { data: saleItems } = await supabase
            .from("sale_items")
            .select("mapped_revenue, quantity")
            .in("sale_id", saleIds);

          telesalesRevenue = ((saleItems || []) as SaleItem[]).reduce((sum, item) => {
            return sum + (item.mapped_revenue || 0) * (item.quantity || 1);
          }, 0);
        }
      }
      
      // FM revenue for this client
      const { data: fmSales } = await supabase
        .from("fieldmarketing_sales")
        .select("product_name")
        .eq("client_id", clientId)
        .gte("registered_at", startStr)
        .lte("registered_at", endStr);
      
      let fmRevenue = 0;
      for (const sale of (fmSales || [])) {
        const pricing = fmCommissionMap.get((sale as any).product_name?.toLowerCase());
        fmRevenue += pricing?.price || 0;
      }
      
      return telesalesRevenue + fmRevenue;
    }

    case "total_hours":
    case "total_timer": {
      // Find teams associated with this client via team_clients
      const { data: teamClients } = await supabase
        .from("team_clients")
        .select("team_id")
        .eq("client_id", clientId);
      
      const teamIds = (teamClients || []).map((tc: { team_id: string }) => tc.team_id);
      
      let employeeIds: string[] = [];
      
      if (teamIds.length > 0) {
        // Get all team members for these teams
        const { data: teamMemberData } = await supabase
          .from("team_members")
          .select("employee_id")
          .in("team_id", teamIds);
        
        employeeIds = [...new Set((teamMemberData || []).map((m: { employee_id: string }) => m.employee_id))];
      }
      
      // Fallback: if no team_clients found, use agent emails from sales
      if (employeeIds.length === 0 && campaignIds.length > 0) {
        const { data: sales } = await supabase
          .from("sales")
          .select("agent_email")
          .in("client_campaign_id", campaignIds)
          .gte("sale_datetime", startStr)
          .lte("sale_datetime", endStr);
        
        const agentEmails = [...new Set((sales || []).map((s: any) => s.agent_email?.toLowerCase()).filter(Boolean))];
        
        if (agentEmails.length > 0) {
          const { data: agents } = await supabase
            .from("agents")
            .select("id, email")
            .in("email", agentEmails);
          
          const agentIds = (agents || []).map((a: any) => a.id);
          if (agentIds.length > 0) {
            const { data: agentMappings } = await supabase
              .from("employee_agent_mapping")
              .select("employee_id")
              .in("agent_id", agentIds);
            
            employeeIds = [...new Set((agentMappings || []).map((m: any) => m.employee_id))];
          }
        }
      }
      
      if (employeeIds.length === 0) return 0;
      
      // Calculate hours for these employees
      const shiftData = await fetchShiftData(supabase, startStr, endStr);
      if (!shiftData) return 0;
      
      return calculateHoursForEmployees(employeeIds, startStr, endStr, shiftData);
    }

    default:
      return 0;
  }
}
