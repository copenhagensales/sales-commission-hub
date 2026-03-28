import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPayrollPeriod, getStartOfDay, getStartOfMonth, getStartOfWeek } from "../_shared/date-helpers.ts";

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

// FM interfaces removed – FM sales now use sale_items via trigger

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
  
  return allItems;
}

// Generic batched .in() query helper – avoids PostgREST URL length limit
async function queryInBatches<T>(
  supabase: SupabaseClient,
  table: string,
  filterColumn: string,
  ids: string[],
  selectColumns: string,
  batchSize = 200
): Promise<T[]> {
  if (ids.length === 0) return [];
  const results: T[] = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from(table)
      .select(selectColumns)
      .in(filterColumn, batch);
    if (error) {
      console.error(`[queryInBatches] ${table} error:`, error.message);
      continue;
    }
    if (data) results.push(...(data as T[]));
  }
  return results;
}

// Paginated sales ID fetch – avoids 1000-row default limit
async function fetchAllSaleIds(
  supabase: SupabaseClient,
  campaignIds: string[],
  startStr: string,
  endStr: string
): Promise<string[]> {
  if (campaignIds.length === 0) return [];
  const allIds: string[] = [];
  const PAGE = 1000;
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from("sales")
      .select("id")
      .in("client_campaign_id", campaignIds)
      .or("validation_status.neq.rejected,validation_status.is.null")
      .gte("sale_datetime", startStr)
      .lte("sale_datetime", endStr)
      .range(offset, offset + PAGE - 1);
    if (!data || data.length === 0) break;
    allIds.push(...data.map((s: { id: string }) => s.id));
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return allIds;
}

// Type for employee KPI sales (simpler than leaderboard)
type EmployeeKpiSale = {
  id: string;
  agent_email: string | null;
  agent_external_id: string | null;
  sale_datetime: string;
  sale_items: { mapped_commission: number; quantity: number; product_id: string | null }[];
};

// Paginated fetch for employee KPI calculations - avoids 1000-row limit
async function fetchAllSalesWithItemsForEmployeeKpi(
  supabase: SupabaseClient,
  startStr: string,
  endStr: string
): Promise<EmployeeKpiSale[]> {
  const PAGE_SIZE = 500;
  const allSales: EmployeeKpiSale[] = [];
  let page = 0;
  let hasMore = true;
  
  while (hasMore) {
    const { data: sales, error } = await supabase
      .from("sales")
      .select("id, agent_email, agent_external_id, sale_datetime, sale_items(mapped_commission, quantity, product_id)")
      .or("validation_status.neq.rejected,validation_status.is.null")
      .gte("sale_datetime", startStr)
      .lte("sale_datetime", endStr)
      .order("sale_datetime", { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    
    if (error) {
      console.error(`[fetchAllSalesWithItemsForEmployeeKpi] Error on page ${page}:`, error);
      hasMore = false;
      continue;
    }
    
    if (sales && sales.length > 0) {
      allSales.push(...(sales as EmployeeKpiSale[]));
      hasMore = sales.length === PAGE_SIZE;
      page++;
    } else {
      hasMore = false;
    }
  }
  
  return allSales;
}

// fetchFmCommissionMap removed – FM sales now use sale_items via trigger

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

// Helper to upsert a batch of cached values immediately
async function saveKpiValuesBatch(supabase: SupabaseClient, values: CachedValue[], label: string): Promise<void> {
  if (values.length === 0) return;
  const { error } = await supabase
    .from("kpi_cached_values")
    .upsert(values, { onConflict: "kpi_slug,period_type,scope_type,scope_id" });
  if (error) {
    console.error(`[Progressive Save - ${label}] Error:`, error);
  } else {
    console.log(`[Progressive Save - ${label}] Saved ${values.length} values`);
  }
}

async function initializeActiveSeasonData(supabase: SupabaseClient, seasonId: string, startDate: string, config: any) {
  try {
    const playersPerDivision = config?.players_per_division || 10;

    // 1. Copy qualification standings → season standings
    const { data: qualStandings } = await supabase
      .from("league_qualification_standings")
      .select("employee_id, projected_division, projected_rank")
      .eq("season_id", seasonId)
      .order("overall_rank", { ascending: true });

    if (!qualStandings || qualStandings.length === 0) {
      console.log("[season-init] No qualification standings to copy");
      return;
    }

    const seasonStandings = qualStandings.map((q, i) => ({
      season_id: seasonId,
      employee_id: q.employee_id,
      current_division: q.projected_division,
      total_points: 0,
      total_provision: 0,
      rounds_played: 0,
      overall_rank: i + 1,
      division_rank: q.projected_rank,
      previous_division: null,
      updated_at: new Date().toISOString(),
    }));

    const { error: ssError } = await supabase
      .from("league_season_standings")
      .upsert(seasonStandings, { onConflict: "season_id,employee_id" });

    if (ssError) {
      console.error("[season-init] Failed to create season standings:", ssError);
      return;
    }
    console.log(`[season-init] Created ${seasonStandings.length} season standings`);

    // 2. Create first round
    const roundStart = new Date(startDate);
    const roundEnd = new Date(roundStart);
    roundEnd.setDate(roundEnd.getDate() + 7);

    const { error: roundError } = await supabase
      .from("league_rounds")
      .insert({
        season_id: seasonId,
        round_number: 1,
        start_date: roundStart.toISOString(),
        end_date: roundEnd.toISOString(),
        status: "active",
      });

    if (roundError) {
      console.error("[season-init] Failed to create first round:", roundError);
    } else {
      console.log("[season-init] Created first round");
    }
  } catch (err) {
    console.error("[season-init] Error:", err);
  }
}

async function triggerLeagueRoundProcessing(supabase: SupabaseClient) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const response = await fetch(`${supabaseUrl}/functions/v1/league-process-round`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({}),
    });

    const result = await response.json();
    console.log("[league-round-trigger] Result:", JSON.stringify(result));
  } catch (err) {
    console.error("[league-round-trigger] Error:", err);
  }
}

async function autoTransitionSeasonStatuses(supabase: SupabaseClient) {
  try {
    const { data: seasons, error } = await supabase
      .from("league_seasons")
      .select("id, status, qualification_start_at, qualification_end_at, start_date, end_date, season_number, config")
      .not("status", "eq", "completed");

    if (error || !seasons?.length) return;

    const now = new Date();
    let transitions = 0;
    let needsRoundProcessing = false;

    for (const season of seasons) {
      let newStatus: string | null = null;

      if (season.status === "draft" && season.qualification_start_at && season.qualification_end_at) {
        if (new Date(season.qualification_start_at) <= now && new Date(season.qualification_end_at) > now) {
          newStatus = "qualification";
        }
      }

      if (season.status === "qualification" && season.start_date && season.end_date) {
        if (new Date(season.start_date) <= now && new Date(season.end_date) > now) {
          newStatus = "active";
        }
      }

      if (season.status === "active" && season.end_date) {
        if (new Date(season.end_date) < now) {
          newStatus = "completed";
        }
      }

      if (newStatus) {
        const isActive = newStatus === "active";

        // Deactivate other seasons when activating one
        if (isActive) {
          await supabase
            .from("league_seasons")
            .update({ is_active: false })
            .neq("id", season.id);
        }

        await supabase
          .from("league_seasons")
          .update({
            status: newStatus,
            is_active: isActive,
            ...(newStatus === "completed" ? { is_active: false } : {}),
          })
          .eq("id", season.id);

        console.log(`[auto-transition] Season S${season.season_number}: ${season.status} → ${newStatus}`);
        transitions++;

        // Initialize season data when transitioning to active
        if (newStatus === "active") {
          await initializeActiveSeasonData(supabase, season.id, season.start_date, season.config);
        }
      }

      // If active season exists, trigger round processing
      if (season.status === "active" || newStatus === "active") {
        needsRoundProcessing = true;
      }
    }

    if (transitions > 0) {
      console.log(`[auto-transition] ${transitions} season(s) transitioned`);
    }

    // Process rounds for active seasons
    if (needsRoundProcessing) {
      await triggerLeagueRoundProcessing(supabase);
    }
  } catch (err) {
    console.error("[auto-transition] Error:", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse chunk parameter for split execution
    let chunk: string | null = null;
    try {
      const body = await req.json();
      chunk = body?.chunk || null;
    } catch {
      // No body or invalid JSON - run everything (backward compatible)
    }

    const validChunks = ["kpis", "leaderboards"];
    if (chunk && !validChunks.includes(chunk)) {
      return new Response(
        JSON.stringify({ error: `Invalid chunk: ${chunk}. Valid: ${validChunks.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const runKpis = !chunk || chunk === "kpis";
    const runLeaderboards = !chunk || chunk === "leaderboards";

    console.log(`[calculate-kpi-values] Starting with chunk=${chunk || "all"} (kpis=${runKpis}, leaderboards=${runLeaderboards})`);

    // Auto-transition season statuses based on dates
    await autoTransitionSeasonStatuses(supabase);

    const now = new Date();
    const periods = [
      { type: "today", start: getStartOfDay(now), end: now },
      { type: "this_week", start: getStartOfWeek(now), end: now },
      { type: "this_month", start: getStartOfMonth(now), end: now },
      { type: "payroll_period", ...getPayrollPeriod(now) },
    ];

    const calculatedAt = now.toISOString();
    let totalKpisSaved = 0;
    let totalLeaderboardsSaved = 0;

    // Fetch clients (needed for both KPIs and leaderboards)
    const { data: clients } = await supabase
      .from("clients")
      .select("id, name");
    
    const clientList = (clients || []) as { id: string; name: string }[];

    // FM commission map no longer needed – FM sales use sale_items via trigger

  if (runKpis) {
    // Fetch all active KPI definitions
    const { data: kpiDefinitions, error: kpiError } = await supabase
      .from("kpi_definitions")
      .select("id, slug, name, sql_query, calculation_formula, category, is_active")
      .eq("is_active", true);

    if (kpiError) {
      console.error("Error fetching KPI definitions:", kpiError);
      throw kpiError;
    }

    // ============= GLOBAL KPIs =============
    console.log("Calculating global KPIs...");
    const globalKpis: CachedValue[] = [];
    for (const kpi of (kpiDefinitions as KpiDefinition[]) || []) {
      for (const period of periods) {
        try {
          const value = await calculateKpiValue(supabase, kpi, period.start, period.end);
          
          globalKpis.push({
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
    // SAVE GLOBAL KPIs IMMEDIATELY
    await saveKpiValuesBatch(supabase, globalKpis, "Global KPIs");
    totalKpisSaved += globalKpis.length;

    // ============= CLIENT-SCOPED KPIs =============
    console.log("Calculating client-scoped KPIs...");
    const clientScopedKpis = ["sales_count", "total_commission", "total_revenue", "total_hours", "antal_salg", "total_provision"];
    
    for (const client of clientList) {
      const clientKpis: CachedValue[] = [];
      for (const period of periods) {
        for (const kpiSlug of clientScopedKpis) {
          try {
            const value = await calculateClientKpiValue(supabase, kpiSlug, client.id, period.start, period.end);
            
            clientKpis.push({
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
      // SAVE PER CLIENT to ensure each client's data is persisted
      await saveKpiValuesBatch(supabase, clientKpis, `Client ${client.name}`);
      totalKpisSaved += clientKpis.length;
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
  
  // Fetch all sales data once for efficiency - using paginated fetch to avoid 1000-row limit
  const payrollPeriodDates = getPayrollPeriod(now);
  const allPeriodSales = await fetchAllSalesWithItemsForEmployeeKpi(
    supabase,
    payrollPeriodDates.start.toISOString(),
    payrollPeriodDates.end.toISOString()
  );
  
  // FM sales are now included via sale_items trigger – no separate FM fetch needed
  
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
  const employeeKpis: CachedValue[] = [];
  for (const emp of (activeEmployees || [])) {
    const agentData = employeeAgentMap.get(emp.id);
    const hasAgentMappings = agentData && 
      (agentData.emails.length > 0 || agentData.externalIds.length > 0);
    
    for (const period of employeePeriods) {
      const empSales = hasAgentMappings ? (allPeriodSales || []).filter((sale: any) => {
        const saleDate = new Date(sale.sale_datetime);
        if (saleDate < period.start || saleDate > period.end) return false;
        
        const saleEmail = sale.agent_email?.toLowerCase();
        const saleExternalId = sale.agent_external_id;
        
        return (saleEmail && agentData!.emails.includes(saleEmail)) ||
               (saleExternalId && agentData!.externalIds.includes(saleExternalId));
      }) : [];
      
      // FM sales are included via sale_items trigger – no separate FM processing needed
      
      let salesCount = 0;
      let totalCommission = 0;
      
      for (const sale of empSales) {
        for (const item of (sale.sale_items || [])) {
          const productId = (item as any).product_id;
          if (!productId || allCountingProductIds.has(productId)) {
            salesCount += (item as any).quantity || 1;
          }
          totalCommission += (item as any).mapped_commission || 0;
        }
        if (!sale.sale_items || sale.sale_items.length === 0) {
          salesCount += 1;
        }
      }
      
      employeeKpis.push({
        kpi_slug: "sales_count",
        period_type: period.type,
        scope_type: "employee",
        scope_id: emp.id,
        value: salesCount,
        formatted_value: salesCount.toString(),
        calculated_at: calculatedAt,
      });
      
      employeeKpis.push({
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
  
  // SAVE EMPLOYEE KPIs IMMEDIATELY
  await saveKpiValuesBatch(supabase, employeeKpis, "Employee KPIs");
  totalKpisSaved += employeeKpis.length;

  // ============= TEAM-SCOPED COMMISSION =============
  console.log("Calculating team-scoped commission for goals...");
  
  const payrollStart = payrollPeriodDates.start.toISOString().split("T")[0];
  const payrollEnd = payrollPeriodDates.end.toISOString().split("T")[0];
  
  const { data: teamGoals } = await supabase
    .from("team_sales_goals")
    .select("team_id, target_amount, teams(id, name)")
    .eq("period_start", payrollStart)
    .eq("period_end", payrollEnd);
  
  const teamKpis: CachedValue[] = [];
  for (const goal of (teamGoals || [])) {
    const teamId = goal.team_id;
    
    const { data: teamMemberData } = await supabase
      .from("team_members")
      .select("employee_id")
      .eq("team_id", teamId);
    
    const memberIds = (teamMemberData || []).map((m: any) => m.employee_id);
    if (memberIds.length === 0) continue;
    
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
    
    let teamCommission = 0;
    
    for (const sale of (allPeriodSales || [])) {
      const saleEmail = (sale as any).agent_email?.toLowerCase();
      const saleExternalId = (sale as any).agent_external_id;
      
      const isTeamSale = (saleEmail && teamAgentEmails.includes(saleEmail)) ||
                         (saleExternalId && teamExternalIds.includes(saleExternalId));
      
      if (isTeamSale) {
        for (const item of ((sale as any).sale_items || [])) {
          teamCommission += (item.mapped_commission || 0);
        }
      }
    }
    
    // FM sales are included via sale_items trigger – no separate FM processing needed
    
    teamKpis.push({
      kpi_slug: "total_commission",
      period_type: "payroll_period",
      scope_type: "team",
      scope_id: teamId,
      value: teamCommission,
      formatted_value: formatValue(teamCommission, "commission"),
      calculated_at: calculatedAt,
    });
  }
  
  // SAVE TEAM KPIs IMMEDIATELY
  await saveKpiValuesBatch(supabase, teamKpis, "Team KPIs");
  totalKpisSaved += teamKpis.length;

  // ============= LIGA POSITION KPIs =============
  console.log("Calculating liga position KPIs...");

  const { data: activeSeason } = await supabase
    .from("league_seasons")
    .select("id, status")
    .in("status", ["qualification", "active"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeSeason) {
    const { data: standings } = await supabase
      .from("league_qualification_standings")
      .select("employee_id, overall_rank, projected_division, projected_rank, current_provision, deals_count")
      .eq("season_id", activeSeason.id);

    const ligaKpis: CachedValue[] = [];
    for (const standing of (standings || [])) {
      ligaKpis.push({
        kpi_slug: "liga_position",
        period_type: "current",
        scope_type: "employee",
        scope_id: standing.employee_id,
        value: standing.overall_rank,
        formatted_value: `#${standing.overall_rank}`,
        calculated_at: calculatedAt,
      });

      ligaKpis.push({
        kpi_slug: "liga_division",
        period_type: "current",
        scope_type: "employee",
        scope_id: standing.employee_id,
        value: standing.projected_division,
        formatted_value: standing.projected_division === 1 
          ? "Salgsligaen" 
          : `${standing.projected_division}. division`,
        calculated_at: calculatedAt,
      });

      ligaKpis.push({
        kpi_slug: "liga_division_rank",
        period_type: "current",
        scope_type: "employee",
        scope_id: standing.employee_id,
        value: standing.projected_rank,
        formatted_value: `#${standing.projected_rank}`,
        calculated_at: calculatedAt,
      });

      ligaKpis.push({
        kpi_slug: "liga_provision",
        period_type: "current",
        scope_type: "employee",
        scope_id: standing.employee_id,
        value: standing.current_provision || 0,
        formatted_value: formatValue(standing.current_provision || 0, "commission"),
        calculated_at: calculatedAt,
      });
    }

    // SAVE LIGA KPIs IMMEDIATELY
    await saveKpiValuesBatch(supabase, ligaKpis, "Liga KPIs");
    totalKpisSaved += ligaKpis.length;
    console.log(`Cached liga KPIs for ${(standings || []).length} enrolled employees`);
  } else {
    console.log("No active league season found - skipping liga KPIs");
  }

  } // end if (runKpis)

  if (runLeaderboards) {
    // ============= LEADERBOARD CACHE CALCULATION =============
    console.log("Calculating global leaderboards...");
    
    const leaderboardCaches: LeaderboardCache[] = [];

    // Fetch employee data for leaderboards
    const { data: employees } = await supabase
      .from("employee_master_data")
      .select("id, first_name, last_name, avatar_url, work_email")
      .eq("is_active", true);
    
    const employeeMap = new Map<string, { id: string; name: string; avatarUrl: string | null }>();
    (employees || []).forEach(emp => {
      const fullName = `${emp.first_name} ${emp.last_name}`;
      employeeMap.set(emp.id, {
        id: emp.id,
        name: fullName,
        avatarUrl: emp.avatar_url,
      });
    });
    
    // Build work_email -> employee_id fallback map
    const workEmailToEmployeeId = new Map<string, string>();
    (employees || []).forEach(emp => {
      if ((emp as any).work_email) {
        workEmailToEmployeeId.set((emp as any).work_email.toLowerCase(), emp.id);
      }
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
    
    // Calculate global leaderboards for each period and SAVE IMMEDIATELY
    const globalLeaderboards: LeaderboardCache[] = [];
    for (const period of periods) {
      try {
        const leaderboard = await calculateGlobalLeaderboard(
          supabase,
          period.start,
          period.end,
          employeeMap,
          employeeTeamMap,
          30,
          workEmailToEmployeeId
        );
        
        globalLeaderboards.push({
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
    
    // SAVE GLOBAL LEADERBOARDS IMMEDIATELY
    if (globalLeaderboards.length > 0) {
      const { error: globalError } = await supabase
        .from("kpi_leaderboard_cache")
        .upsert(globalLeaderboards, { onConflict: "period_type,scope_type,scope_id" });
      if (globalError) console.error("Error saving global leaderboards:", globalError);
      else console.log(`Saved ${globalLeaderboards.length} global leaderboards`);
      leaderboardCaches.push(...globalLeaderboards);
    }
    
    // Fetch teams for team-scoped leaderboards
    const { data: teams } = await supabase
      .from("teams")
      .select("id, name");
    
    // Calculate team-scoped leaderboards
    const teamLeaderboards: LeaderboardCache[] = [];
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
            20
          );
          
          teamLeaderboards.push({
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
    
    // SAVE ALL TEAM LEADERBOARDS
    if (teamLeaderboards.length > 0) {
      const { error: teamError } = await supabase
        .from("kpi_leaderboard_cache")
        .upsert(teamLeaderboards, { onConflict: "period_type,scope_type,scope_id" });
      if (teamError) console.error("Error saving team leaderboards:", teamError);
      else console.log(`Saved ${teamLeaderboards.length} team leaderboards`);
      leaderboardCaches.push(...teamLeaderboards);
    }

    // ============= CLIENT-SCOPED LEADERBOARD CACHE CALCULATION =============
    console.log("Calculating client-scoped leaderboards...");
    
    const clientLeaderboards: LeaderboardCache[] = [];
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
            30
          );
          
          clientLeaderboards.push({
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
    
    // SAVE ALL CLIENT LEADERBOARDS 
    if (clientLeaderboards.length > 0) {
      const { error: clientError } = await supabase
        .from("kpi_leaderboard_cache")
        .upsert(clientLeaderboards, { onConflict: "period_type,scope_type,scope_id" });
      if (clientError) console.error("Error saving client leaderboards:", clientError);
      else console.log(`Saved ${clientLeaderboards.length} client leaderboards`);
      leaderboardCaches.push(...clientLeaderboards);
    }

    totalLeaderboardsSaved = leaderboardCaches.length;
  } // end if (runLeaderboards)

    console.log(`Successfully calculated ${totalKpisSaved} KPI values and ${totalLeaderboardsSaved} leaderboards (chunk=${chunk || "all"})`);

    return new Response(
      JSON.stringify({
        success: true,
        chunk: chunk || "all",
        kpis_saved: totalKpisSaved,
        leaderboards_saved: totalLeaderboardsSaved,
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
  agent_external_id: string | null;
  agent_name: string | null;
  sale_datetime: string;
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
      .select("id, agent_email, agent_external_id, agent_name, sale_datetime, sale_items(sale_id, quantity, mapped_commission, product_id)")
      .or("validation_status.neq.rejected,validation_status.is.null")
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

// fetchFmSalesForPeriod removed – FM sales now use sale_items via trigger

async function calculateGlobalLeaderboard(
  supabase: SupabaseClient,
  startDate: Date,
  endDate: Date,
  employeeMap: Map<string, { id: string; name: string; avatarUrl: string | null }>,
  employeeTeamMap: Map<string, string>,
  limit: number = 30,
  workEmailToEmployeeId?: Map<string, string>
): Promise<LeaderboardEntry[]> {
  const startStr = startDate.toISOString();
  const endStr = endDate.toISOString();

  // Get all telesales WITH their sale_items using JOIN-based paginated fetch
  const salesWithItems = await fetchAllSalesWithItems(supabase, startStr, endStr);

  if (!salesWithItems || salesWithItems.length === 0) return [];

  // Extract all sale_items from the nested data
  const saleItems = salesWithItems.flatMap(s => s.sale_items || []);
  
  // Debug: Log totals
  const totalMappedCommission = saleItems.reduce((sum, item) => sum + (item.mapped_commission || 0), 0);
  console.log(`[GlobalLeaderboard ${startStr.slice(0,10)} to ${endStr.slice(0,10)}] Sales: ${salesWithItems.length}, Items: ${saleItems.length}, Total mapped_commission: ${totalMappedCommission}`);

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
  // FM sales use seller_id directly - no need to add to agentEmails lookup
  // We'll handle FM sales by direct employee ID matching below

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

  // FM sales are included via sale_items trigger – no separate FM processing needed

  // Convert to leaderboard entries using proper employee mapping
  const entries: LeaderboardEntry[] = [];
  
  for (const [agentKey, stats] of agentStats) {
    if (stats.sales === 0) continue;
    
    // Try to find employee via email -> agent -> mapping -> employee, fallback to work_email
    const employeeId = emailToEmployeeId.get(agentKey) || (workEmailToEmployeeId ? workEmailToEmployeeId.get(agentKey) : "") || "";
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

  // Add work_email fallback for team members

  // Get work_emails for team members to use as fallback for agent matching
  const { data: teamEmpEmails } = await supabase
    .from("employee_master_data")
    .select("id, work_email")
    .in("id", [...teamEmployeeIds]);
  
  for (const emp of (teamEmpEmails || [])) {
    if (emp.work_email) {
      const email = emp.work_email.toLowerCase();
      if (!emailToEmployeeId.has(email)) {
        emailToEmployeeId.set(email, emp.id);
        teamAgentEmails.add(email);
      }
    }
  }

  // Get all telesales WITH nested sale_items using JOIN-based paginated fetch
  const salesWithItems = await fetchAllSalesWithItems(supabase, startStr, endStr);

  // Filter sales to team members by agent_email
  const teamSales = salesWithItems.filter(s => 
    s.agent_email && teamAgentEmails.has(s.agent_email.toLowerCase())
  );
  
  if (teamSales.length === 0) return [];

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

  // FM sales are included via sale_items trigger – no separate FM processing needed

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

  // Get all telesales for this client's campaigns WITH nested sale_items
  const salesWithItems = campaignIds.length > 0 
    ? await fetchAllSalesWithItems(supabase, startStr, endStr, campaignIds)
    : [];

  if (salesWithItems.length === 0) return [];

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
  // FM sales use seller_id directly - no need to add to agentEmails lookup
  // We'll handle FM sales by direct employee ID matching below

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

  // FM sales are included via sale_items trigger – no separate FM processing needed

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
    .select("quantity, product_id, sale_id, sales!inner(validation_status)")
    .or("validation_status.neq.rejected,validation_status.is.null", { foreignTable: "sales" })
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

  // FM sales are included via sale_items trigger – no separate FM count needed
  return count;
}

async function calculateTotalCommission(
  supabase: SupabaseClient,
  startStr: string,
  endStr: string
): Promise<number> {
  // Telesales commission from sale_items
  const { data, error } = await supabase
    .from("sale_items")
    .select("mapped_commission, quantity, sales!inner(validation_status)")
    .or("validation_status.neq.rejected,validation_status.is.null", { foreignTable: "sales" })
    .gte("created_at", startStr)
    .lte("created_at", endStr);

  if (error) {
    console.error("Error fetching commission:", error);
    return 0;
  }

  const saleItems = (data || []) as SaleItem[];

  let telesalesCommission = saleItems.reduce((sum, item) => {
    return sum + (item.mapped_commission || 0);
  }, 0);

  // FM sales are included via sale_items trigger – no separate FM commission needed
  return telesalesCommission;
}

async function calculateTotalRevenue(
  supabase: SupabaseClient,
  startStr: string,
  endStr: string
): Promise<number> {
  // Telesales revenue from sale_items
  const { data, error } = await supabase
    .from("sale_items")
    .select("mapped_revenue, quantity, sales!inner(validation_status)")
    .or("validation_status.neq.rejected,validation_status.is.null", { foreignTable: "sales" })
    .gte("created_at", startStr)
    .lte("created_at", endStr);

  if (error) {
    console.error("Error fetching revenue:", error);
    return 0;
  }

  const saleItems = (data || []) as SaleItem[];

  let telesalesRevenue = saleItems.reduce((sum, item) => {
    return sum + (item.mapped_revenue || 0);
  }, 0);

  // FM sales are included via sale_items trigger – no separate FM revenue needed
  return telesalesRevenue;
}

// Shared shift data cache for performance (fetched once per execution)
// OPTIMIZED: Cache structure and timestamps separately to avoid refetching for each date range
let shiftConfigCache: {
  teamMembers: TeamMemberShift[];
  primaryShifts: TeamStandardShift[];
  shiftDays: ShiftDay[];
} | null = null;

let timestampCache: {
  data: TimeStampRecord[];
  startDate: string;
  endDate: string;
} | null = null;

async function fetchShiftData(
  supabase: SupabaseClient,
  startStr: string,
  endStr: string
): Promise<{
  teamMembers: TeamMemberShift[];
  primaryShifts: TeamStandardShift[];
  shiftDays: ShiftDay[];
  timeStampsData: TimeStampRecord[];
  startDate: string;
  endDate: string;
} | null> {
  // Fetch static shift configuration ONCE (team members, shifts, shift days don't change per date range)
  if (!shiftConfigCache) {
    console.log("[HoursCalc] Fetching shift configuration data (one-time)...");
    
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
      .in("team_id", teamIds.length > 0 ? teamIds : ['no-teams'])
      .eq("is_active", true);
    
    const primaryShifts = (shiftsData || []) as TeamStandardShift[];
    
    // Fetch shift days for all shifts
    const shiftIds = primaryShifts.map(s => s.id);
    const { data: daysData } = await supabase
      .from("team_standard_shift_days")
      .select("shift_id, day_of_week, start_time, end_time")
      .in("shift_id", shiftIds.length > 0 ? shiftIds : ['no-shifts']);
    
    const shiftDays = (daysData || []) as ShiftDay[];
    
    shiftConfigCache = { teamMembers, primaryShifts, shiftDays };
    console.log(`[HoursCalc] Loaded ${teamMembers.length} team members, ${primaryShifts.length} shifts, ${shiftDays.length} shift days`);
  }
  
  // Fetch timestamps only if needed and date range differs or extends beyond cached range
  let timeStampsData: TimeStampRecord[] = [];
  const teamsUsingTimestamps = shiftConfigCache.primaryShifts
    .filter(s => s.hours_source === "timestamp")
    .map(s => s.team_id);
  
  if (teamsUsingTimestamps.length > 0) {
    // Check if we need to fetch timestamps (new range or no cache)
    const needsFetch = !timestampCache || 
      new Date(startStr) < new Date(timestampCache.startDate) ||
      new Date(endStr) > new Date(timestampCache.endDate);
    
    if (needsFetch) {
      // Determine the widest range we might need (payroll period is typically widest)
      const fetchStart = timestampCache && new Date(startStr) >= new Date(timestampCache.startDate) 
        ? timestampCache.startDate 
        : startStr;
      const fetchEnd = timestampCache && new Date(endStr) <= new Date(timestampCache.endDate)
        ? timestampCache.endDate
        : endStr;
      
      const employeesWithTimestampTeams = shiftConfigCache.teamMembers
        .filter(tm => teamsUsingTimestamps.includes(tm.team_id))
        .map(tm => tm.employee_id);
      
      if (employeesWithTimestampTeams.length > 0) {
        console.log(`[HoursCalc] Fetching timestamps for ${employeesWithTimestampTeams.length} employees...`);
        const { data: stamps } = await supabase
          .from("time_stamps")
          .select("employee_id, clock_in, clock_out, break_minutes")
          .in("employee_id", employeesWithTimestampTeams)
          .gte("clock_in", fetchStart)
          .lte("clock_in", fetchEnd);
        
        timestampCache = {
          data: (stamps || []) as TimeStampRecord[],
          startDate: fetchStart,
          endDate: fetchEnd
        };
      }
    }
    
    // Filter cached timestamps to requested range
    if (timestampCache) {
      timeStampsData = timestampCache.data.filter(ts => {
        if (!ts.clock_in) return false;
        const tsDate = new Date(ts.clock_in);
        return tsDate >= new Date(startStr) && tsDate <= new Date(endStr);
      });
    }
  }
  
  return { 
    ...shiftConfigCache, 
    timeStampsData, 
    startDate: startStr, 
    endDate: endStr 
  };
}

// Type for the shift data returned by fetchShiftData
type ShiftDataResult = {
  teamMembers: TeamMemberShift[];
  primaryShifts: TeamStandardShift[];
  shiftDays: ShiftDay[];
  timeStampsData: TimeStampRecord[];
  startDate: string;
  endDate: string;
};

function calculateHoursForEmployees(
  employeeIds: string[],
  startStr: string,
  endStr: string,
  shiftData: ShiftDataResult
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
      const empTeam = teamMembers.find((tm: TeamMemberShift) => tm.employee_id === empId);
      if (!empTeam) continue;
      
      const empShift = primaryShifts.find((s: TeamStandardShift) => s.team_id === empTeam.team_id);
      if (!empShift) continue;
      
      const hoursSource = empShift.hours_source || "shift";
      const empShiftDays = shiftDays.filter((sd: ShiftDay) => sd.shift_id === empShift.id);
      const shiftForDay = empShiftDays.find((sd: ShiftDay) => sd.day_of_week === adjustedDayOfWeek);
      
      let hours = 0;
      if (hoursSource === "timestamp") {
        const empTimestamp = timeStampsData.find((ts: TimeStampRecord) => ts.employee_id === empId && ts.date === dateStr);
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
  // Count currently active non-staff employees
  const { count: activeCount } = await supabase
    .from("employee_master_data")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true)
    .eq("is_staff_employee", false);

  // Also count inactive employees who have sales data in the current payroll period
  const now = new Date();
  const { start: payrollStart } = getPayrollPeriod(now);

  const { data: inactiveWithSales } = await supabase
    .from("employee_master_data")
    .select("id")
    .eq("is_active", false)
    .eq("is_staff_employee", false);

  if (!inactiveWithSales || inactiveWithSales.length === 0) {
    return activeCount || 0;
  }

  // Check which inactive employees have sales via their agent mappings
  const inactiveIds = inactiveWithSales.map(e => e.id);
  const { data: mappings } = await supabase
    .from("employee_agent_mapping")
    .select("employee_id, agents(email)")
    .in("employee_id", inactiveIds);

  if (!mappings || mappings.length === 0) {
    return activeCount || 0;
  }

  const emails = mappings
    .map(m => (m.agents as any)?.email?.toLowerCase())
    .filter(Boolean);

  if (emails.length === 0) {
    return activeCount || 0;
  }

  // Count distinct inactive employees with sales in the payroll period
  const { data: salesData } = await supabase
    .from("sales")
    .select("agent_email")
    .in("agent_email", emails)
    .gte("sale_datetime", payrollStart.toISOString())
    .or("validation_status.neq.rejected,validation_status.is.null");

  const uniqueEmails = new Set(
    (salesData || []).map(s => s.agent_email?.toLowerCase()).filter(Boolean)
  );

  // Map back to employee IDs to count unique employees
  const emailToEmpId = new Map<string, string>();
  for (const m of mappings) {
    const email = (m.agents as any)?.email?.toLowerCase();
    if (email) emailToEmpId.set(email, m.employee_id);
  }

  const inactiveWithData = new Set<string>();
  for (const email of uniqueEmails) {
    const empId = emailToEmpId.get(email as string);
    if (empId) inactiveWithData.add(empId);
  }

  return (activeCount || 0) + inactiveWithData.size;
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
  endDate: Date
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
      // Telesales count (using paginated + batched helpers)
      let telesalesCount = 0;
      if (campaignIds.length > 0) {
        const saleIds = await fetchAllSaleIds(supabase, campaignIds, startStr, endStr);
        if (saleIds.length > 0) {
          const saleItems = await queryInBatches<{quantity: number|null; product_id: string|null}>(
            supabase, "sale_items", "sale_id", saleIds, "quantity, product_id"
          );

          const productIds = [...new Set(saleItems.map((si) => si.product_id).filter(Boolean))] as string[];
          
          let countingProductIds = new Set<string>();
          if (productIds.length > 0) {
            const products = await queryInBatches<Product>(
              supabase, "products", "id", productIds, "id, counts_as_sale"
            );
            countingProductIds = new Set(
              products.filter(p => p.counts_as_sale !== false).map(p => p.id)
            );
          }

          for (const item of saleItems as SaleItem[]) {
            if (!item.product_id || countingProductIds.has(item.product_id)) {
              telesalesCount += item.quantity || 1;
            }
          }
        }
      }
      
      // FM sales are now included via sale_items (campaign-linked),
      // so no separate FM count is needed.
      return telesalesCount;
    }

    case "total_commission":
    case "total_provision": {
      // Telesales commission (using paginated + batched helpers)
      let telesalesCommission = 0;
      if (campaignIds.length > 0) {
        const saleIds = await fetchAllSaleIds(supabase, campaignIds, startStr, endStr);
        if (saleIds.length > 0) {
          const saleItems = await queryInBatches<SaleItem>(
            supabase, "sale_items", "sale_id", saleIds, "mapped_commission, quantity"
          );

          telesalesCommission = saleItems.reduce((sum, item) => {
            return sum + (item.mapped_commission || 0);
          }, 0);
        }
      }
      
      // FM commission is now included via sale_items.mapped_commission,
      // so no separate FM calculation is needed.
      return telesalesCommission;
    }

    case "total_revenue":
    case "total_omsætning": {
      // Telesales revenue (using paginated + batched helpers)
      let telesalesRevenue = 0;
      if (campaignIds.length > 0) {
        const saleIds = await fetchAllSaleIds(supabase, campaignIds, startStr, endStr);
        if (saleIds.length > 0) {
          const saleItems = await queryInBatches<SaleItem>(
            supabase, "sale_items", "sale_id", saleIds, "mapped_revenue, quantity"
          );

          telesalesRevenue = saleItems.reduce((sum, item) => {
            return sum + (item.mapped_revenue || 0);
          }, 0);
        }
      }
      
      // FM revenue is now included via sale_items.mapped_revenue,
      // so no separate FM calculation is needed.
      return telesalesRevenue;
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
