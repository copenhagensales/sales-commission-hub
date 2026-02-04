import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============= TYPES =============
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

interface FmSale {
  id: string;
  product_name: string | null;
  client_id: string | null;
  seller_id: string | null;
}

type SaleWithItems = {
  id: string;
  agent_email: string | null;
  agent_external_id: string | null;
  agent_name: string | null;
  sale_datetime: string;
  client_campaign_id: string | null;
  sale_items: { sale_id: string; quantity: number; mapped_commission: number; product_id: string | null }[];
};

// ============= DATE HELPERS =============
function getStartOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
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

function formatDisplayName(fullName: string): string {
  const parts = fullName.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  }
  return fullName;
}

// ============= FM COMMISSION MAP =============
async function fetchFmCommissionMap(supabase: SupabaseClient): Promise<Map<string, { commission: number; price: number }>> {
  const { data: rules } = await supabase
    .from("product_pricing_rules")
    .select(`
      product:products!inner(name),
      commission_dkk,
      revenue_dkk
    `)
    .eq("is_active", true)
    .order("commission_dkk", { ascending: false, nullsFirst: false });
  
  const map = new Map<string, { commission: number; price: number }>();
  for (const rule of (rules || [])) {
    const productData = rule.product as any;
    const key = productData?.name?.toLowerCase();
    if (key && !map.has(key)) {
      map.set(key, {
        commission: rule.commission_dkk || 0,
        price: rule.revenue_dkk || 0,
      });
    }
  }
  return map;
}

// ============= DATA FETCH HELPERS =============
async function fetchAllSalesWithItems(
  supabase: SupabaseClient,
  startStr: string,
  endStr: string
): Promise<SaleWithItems[]> {
  const PAGE_SIZE = 500;
  const allSales: SaleWithItems[] = [];
  let page = 0;
  let hasMore = true;
  
  while (hasMore) {
    const { data: sales, error } = await supabase
      .from("sales")
      .select("id, agent_email, agent_external_id, agent_name, sale_datetime, client_campaign_id, sale_items(sale_id, quantity, mapped_commission, product_id)")
      .gte("sale_datetime", startStr)
      .lte("sale_datetime", endStr)
      .order("sale_datetime", { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    
    if (error) {
      console.error(`[fetchAllSalesWithItems] Error on page ${page}:`, error);
      hasMore = false;
      continue;
    }
    
    if (sales && sales.length > 0) {
      allSales.push(...(sales as SaleWithItems[]));
      hasMore = sales.length === PAGE_SIZE;
      page++;
    } else {
      hasMore = false;
    }
  }
  
  console.log(`[fetchAllSalesWithItems] Fetched ${allSales.length} sales in ${page || 1} page(s)`);
  return allSales;
}

async function fetchFmSalesForPeriod(
  supabase: SupabaseClient,
  startStr: string,
  endStr: string
): Promise<(FmSale & { registered_at: string })[]> {
  const { data, error } = await supabase
    .from("fieldmarketing_sales")
    .select("id, product_name, seller_id, client_id, registered_at")
    .gte("registered_at", startStr)
    .lte("registered_at", endStr);
  
  if (error) {
    console.error("[fetchFmSalesForPeriod] Error:", error);
    return [];
  }
  
  return (data || []) as (FmSale & { registered_at: string })[];
}

// ============= LEADERBOARD CALCULATION =============
async function calculateLeaderboard(
  supabase: SupabaseClient,
  salesWithItems: SaleWithItems[],
  fmSales: FmSale[],
  employeeMap: Map<string, { id: string; name: string; avatarUrl: string | null }>,
  employeeTeamMap: Map<string, string>,
  fmCommissionMap: Map<string, { commission: number; price: number }>,
  emailToEmployeeId: Map<string, string>,
  countingProductIds: Set<string>,
  productCommissionMap: Map<string, number>,
  limit: number = 30
): Promise<LeaderboardEntry[]> {
  const agentStats = new Map<string, { sales: number; commission: number; agentName: string }>();
  
  // Process telesales
  for (const sale of salesWithItems) {
    const key = sale.agent_email?.toLowerCase() || sale.agent_name || "";
    if (!key) continue;
    
    const items = sale.sale_items || [];
    let saleSales = 0;
    let saleCommission = 0;
    
    for (const item of items) {
      if (!item.product_id || countingProductIds.has(item.product_id)) {
        saleSales += item.quantity || 1;
      }
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
    if (!fmSale.seller_id) continue;
    
    const fmPricing = fmCommissionMap.get(fmSale.product_name?.toLowerCase() || "");
    const fmCommission = fmPricing?.commission || 0;
    
    const empInfo = employeeMap.get(fmSale.seller_id);
    const key = empInfo?.name?.toLowerCase() || fmSale.seller_id;
    
    const existing = agentStats.get(key) || { sales: 0, commission: 0, agentName: empInfo?.name || fmSale.seller_id };
    agentStats.set(key, {
      sales: existing.sales + 1,
      commission: existing.commission + fmCommission,
      agentName: existing.agentName,
    });
    
    if (!emailToEmployeeId.has(key)) {
      emailToEmployeeId.set(key, fmSale.seller_id);
    }
  }

  // Convert to leaderboard entries
  const entries: LeaderboardEntry[] = [];
  
  for (const [agentKey, stats] of agentStats) {
    if (stats.sales === 0) continue;
    
    const employeeId = emailToEmployeeId.get(agentKey) || "";
    const empInfo = employeeId ? employeeMap.get(employeeId) : null;
    const teamName = employeeId ? employeeTeamMap.get(employeeId) || null : null;
    
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
  
  entries.sort((a, b) => b.commission - a.commission);
  
  return entries.slice(0, limit);
}

// ============= MAIN FUNCTION =============
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const calculatedAt = now.toISOString();
    
    // Only calculate "today" and "payroll_period" leaderboards (most critical for dashboards)
    const periods = [
      { type: "today", start: getStartOfDay(now), end: now },
      { type: "payroll_period", ...getPayrollPeriod(now) },
    ];

    console.log(`[calculate-leaderboard-incremental] Starting...`);
    console.log(`[calculate-leaderboard-incremental] Today: ${periods[0].start.toISOString()} - ${periods[0].end.toISOString()}`);
    console.log(`[calculate-leaderboard-incremental] Payroll: ${periods[1].start.toISOString()} - ${periods[1].end.toISOString()}`);

    // ============= FETCH CORE DATA =============
    // Fetch all sales for payroll period (covers both periods)
    const payrollStart = periods[1].start.toISOString();
    const payrollEnd = periods[1].end.toISOString();
    
    const [salesWithItems, fmSales, fmCommissionMap] = await Promise.all([
      fetchAllSalesWithItems(supabase, payrollStart, payrollEnd),
      fetchFmSalesForPeriod(supabase, payrollStart, payrollEnd),
      fetchFmCommissionMap(supabase),
    ]);

    console.log(`[calculate-leaderboard-incremental] Loaded ${salesWithItems.length} telesales, ${fmSales.length} FM sales`);

    // ============= FETCH EMPLOYEE DATA =============
    const { data: employees } = await supabase
      .from("employee_master_data")
      .select("id, first_name, last_name, avatar_url")
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

    // ============= BUILD AGENT MAPPINGS =============
    const { data: agents } = await supabase.from("agents").select("id, email");
    
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

    // ============= FETCH PRODUCT DATA =============
    const productIds = [...new Set(
      salesWithItems.flatMap(s => (s.sale_items || []).map(si => si.product_id).filter(Boolean))
    )] as string[];
    
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

    // ============= FETCH CLIENTS & CAMPAIGNS =============
    const { data: clients } = await supabase.from("clients").select("id, name");
    const clientList = (clients || []) as { id: string; name: string }[];

    const { data: campaigns } = await supabase
      .from("client_campaigns")
      .select("id, client_id");
    
    const campaignToClientMap = new Map<string, string>();
    for (const campaign of (campaigns || [])) {
      campaignToClientMap.set(campaign.id, campaign.client_id);
    }

    // ============= CALCULATE LEADERBOARDS =============
    const leaderboardCaches: LeaderboardCache[] = [];

    for (const period of periods) {
      // Filter sales for this period
      const periodSales = salesWithItems.filter(s => {
        const saleDate = new Date(s.sale_datetime);
        return saleDate >= period.start && saleDate <= period.end;
      });
      
      const periodFmSales = fmSales.filter(s => {
        const saleDate = new Date(s.registered_at);
        return saleDate >= period.start && saleDate <= period.end;
      });

      // ============= GLOBAL LEADERBOARD =============
      const globalLeaderboard = await calculateLeaderboard(
        supabase,
        periodSales,
        periodFmSales,
        employeeMap,
        employeeTeamMap,
        fmCommissionMap,
        new Map(emailToEmployeeId),
        countingProductIds,
        productCommissionMap,
        30
      );

      leaderboardCaches.push({
        period_type: period.type,
        scope_type: "global",
        scope_id: null,
        leaderboard_data: globalLeaderboard,
        calculated_at: calculatedAt,
      });

      console.log(`[calculate-leaderboard-incremental] Global ${period.type}: ${globalLeaderboard.length} entries`);

      // ============= CLIENT-SCOPED LEADERBOARDS =============
      for (const client of clientList) {
        // Filter sales for this client
        const clientSales = periodSales.filter(s => {
          const clientId = s.client_campaign_id ? campaignToClientMap.get(s.client_campaign_id) : null;
          return clientId === client.id;
        });

        const clientFmSales = periodFmSales.filter(s => s.client_id === client.id);

        if (clientSales.length === 0 && clientFmSales.length === 0) {
          // Still create empty leaderboard entry
          leaderboardCaches.push({
            period_type: period.type,
            scope_type: "client",
            scope_id: client.id,
            leaderboard_data: [],
            calculated_at: calculatedAt,
          });
          continue;
        }

        const clientLeaderboard = await calculateLeaderboard(
          supabase,
          clientSales,
          clientFmSales,
          employeeMap,
          employeeTeamMap,
          fmCommissionMap,
          new Map(emailToEmployeeId),
          countingProductIds,
          productCommissionMap,
          30
        );

        leaderboardCaches.push({
          period_type: period.type,
          scope_type: "client",
          scope_id: client.id,
          leaderboard_data: clientLeaderboard,
          calculated_at: calculatedAt,
        });

        if (clientLeaderboard.length > 0) {
          console.log(`[calculate-leaderboard-incremental] Client ${client.name} ${period.type}: ${clientLeaderboard.length} entries`);
        }
      }
    }

    // ============= UPSERT LEADERBOARDS =============
    if (leaderboardCaches.length > 0) {
      const { error: upsertError } = await supabase
        .from("kpi_leaderboard_cache")
        .upsert(leaderboardCaches, { onConflict: "period_type,scope_type,scope_id" });

      if (upsertError) {
        console.error("[calculate-leaderboard-incremental] Error upserting:", upsertError);
        throw upsertError;
      }
    }

    const durationMs = Date.now() - startTime;
    console.log(`[calculate-leaderboard-incremental] Completed in ${durationMs}ms. Updated ${leaderboardCaches.length} leaderboards.`);

    return new Response(
      JSON.stringify({
        success: true,
        leaderboards: leaderboardCaches.length,
        durationMs,
        timestamp: calculatedAt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[calculate-leaderboard-incremental] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message, durationMs: Date.now() - startTime }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
