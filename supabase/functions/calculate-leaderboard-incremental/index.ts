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
  crossSaleCount: number;
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

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
  d.setDate(diff);
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

// ============= FM COMMISSION MAP (Unified Pricing Service) =============
// Implements two-tier fallback: product_pricing_rules -> products.commission_dkk/revenue_dkk
// This ensures FM products (like Yousee) that don't have pricing rules still get their pricing
async function fetchFmCommissionMap(supabase: SupabaseClient): Promise<Map<string, { commission: number; price: number; source: string }>> {
  const map = new Map<string, { commission: number; price: number; source: string }>();

  // 1. Load ALL products with base prices FIRST (fallback)
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, commission_dkk, revenue_dkk");

  if (productsError) {
    console.error("[fetchFmCommissionMap] Error fetching products:", productsError);
  }

  // Set base prices from products table
  for (const product of (products || [])) {
    const key = product.name?.toLowerCase();
    if (key && (product.commission_dkk !== null || product.revenue_dkk !== null)) {
      map.set(key, {
        commission: product.commission_dkk || 0,
        price: product.revenue_dkk || 0,
        source: 'product_base',
      });
    }
  }

  console.log(`[fetchFmCommissionMap] Loaded ${map.size} products with base prices`);

  // 2. Override with active pricing rules (higher priority)
  const { data: rules, error: rulesError } = await supabase
    .from("product_pricing_rules")
    .select(`
      id,
      product:products!inner(name),
      commission_dkk,
      revenue_dkk,
      priority
    `)
    .eq("is_active", true)
    .order("priority", { ascending: false, nullsFirst: true });

  if (rulesError) {
    console.error("[fetchFmCommissionMap] Error fetching pricing rules:", rulesError);
  }

  // Track which products have been set by pricing rules
  const rulesApplied = new Set<string>();

  for (const rule of (rules || [])) {
    const productData = rule.product as any;
    const key = productData?.name?.toLowerCase();
    if (key && !rulesApplied.has(key)) {
      map.set(key, {
        commission: rule.commission_dkk || 0,
        price: rule.revenue_dkk || 0,
        source: 'pricing_rule',
      });
      rulesApplied.add(key);
    }
  }

  console.log(`[fetchFmCommissionMap] Applied ${rulesApplied.size} pricing rules. Final map size: ${map.size}`);
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
  const PAGE_SIZE = 500;
  const allFmSales: (FmSale & { registered_at: string })[] = [];
  let page = 0;
  let hasMore = true;
  
  while (hasMore) {
    // Fetch raw_payload to extract fm_seller_id and fm_product_name
    const { data, error } = await supabase
      .from("sales")
      .select("id, raw_payload, agent_name, client_campaign_id, sale_datetime")
      .eq("source", "fieldmarketing")
      .gte("sale_datetime", startStr)
      .lte("sale_datetime", endStr)
      .order("sale_datetime", { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    
    if (error) {
      console.error(`[fetchFmSalesForPeriod] Error on page ${page}:`, error);
      hasMore = false;
      continue;
    }
    
    if (data && data.length > 0) {
      // Map raw_payload fields to FmSale structure
      const mappedSales = data.map((sale: any) => {
        const rawPayload = sale.raw_payload || {};
        return {
          id: sale.id,
          product_name: rawPayload.fm_product_name || null,
          client_id: rawPayload.fm_client_id || null,
          seller_id: rawPayload.fm_seller_id || null,
          registered_at: sale.sale_datetime,
        };
      });
      allFmSales.push(...mappedSales);
      hasMore = data.length === PAGE_SIZE;
      page++;
    } else {
      hasMore = false;
    }
  }
  
  console.log(`[fetchFmSalesForPeriod] Fetched ${allFmSales.length} FM sales in ${page || 1} page(s)`);
  return allFmSales;
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
  crossSaleProductIds: Set<string>,
  productCommissionMap: Map<string, number>,
  limit: number = 30
): Promise<LeaderboardEntry[]> {
  const agentStats = new Map<string, { sales: number; crossSales: number; commission: number; agentName: string }>();
  
  // Process telesales
  for (const sale of salesWithItems) {
    const key = sale.agent_email?.toLowerCase() || sale.agent_name || "";
    if (!key) continue;
    
    const items = sale.sale_items || [];
    let saleSales = 0;
    let saleCrossSales = 0;
    let saleCommission = 0;
    
    for (const item of items) {
      // Count regular sales
      if (!item.product_id || countingProductIds.has(item.product_id)) {
        saleSales += item.quantity || 1;
      }
      // Count cross-sales separately
      if (item.product_id && crossSaleProductIds.has(item.product_id)) {
        saleCrossSales += item.quantity || 1;
      }
      const itemCommission = (item.mapped_commission && item.mapped_commission > 0)
        ? item.mapped_commission
        : (item.product_id ? (productCommissionMap.get(item.product_id) || 0) : 0) * (item.quantity || 1);
      saleCommission += itemCommission;
    }
    
    if (items.length === 0) {
      saleSales = 1;
    }
    
    const existing = agentStats.get(key) || { sales: 0, crossSales: 0, commission: 0, agentName: sale.agent_name || key };
    agentStats.set(key, {
      sales: existing.sales + saleSales,
      crossSales: existing.crossSales + saleCrossSales,
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
    
    const existing = agentStats.get(key) || { sales: 0, crossSales: 0, commission: 0, agentName: empInfo?.name || fmSale.seller_id };
    agentStats.set(key, {
      sales: existing.sales + 1,
      crossSales: existing.crossSales, // FM sales don't have cross-sales
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
    if (stats.sales === 0 && stats.crossSales === 0) continue;
    
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
      crossSaleCount: stats.crossSales,
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
    // Parse query params for force flag
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "true";
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const calculatedAt = now.toISOString();
    const currentMinute = now.getMinutes();
    
    // ============= SYNCHRONIZED REFRESH STRATEGY =============
    // All periods update every 2 minutes to match frontend polling (120s)
    // This ensures data freshness while minimizing unnecessary calculations
    const periods: { type: string; start: Date; end: Date }[] = [];
    
    // Run on even minutes (0, 2, 4, 6, ...) OR if force flag is set
    if (force || currentMinute % 2 === 0) {
      periods.push({ type: "today", start: getStartOfDay(now), end: now });
      periods.push({ type: "this_week", start: getStartOfWeek(now), end: now });
      const payroll = getPayrollPeriod(now);
      periods.push({ type: "payroll_period", start: payroll.start, end: payroll.end });
    }

    console.log(`[calculate-leaderboard-incremental] Starting... (minute=${currentMinute})`);
    console.log(`[calculate-leaderboard-incremental] Periods to update: ${periods.map(p => p.type).join(", ") || "none (skipping)"}`);
    
    // Early exit if no periods to update
    if (periods.length === 0) {
      console.log(`[calculate-leaderboard-incremental] Skipping update (odd minute)`);
      return new Response(
        JSON.stringify({
          success: true,
          leaderboards: 0,
          durationMs: Date.now() - startTime,
          timestamp: calculatedAt,
          skipped: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    periods.forEach(p => {
      console.log(`[calculate-leaderboard-incremental] ${p.type}: ${p.start.toISOString()} - ${p.end.toISOString()}`);
    });
    const earliestStart = periods.reduce((min, p) => p.start < min ? p.start : min, periods[0].start);
    const latestEnd = periods.reduce((max, p) => p.end > max ? p.end : max, periods[0].end);
    
    const [salesWithItems, fmSales, fmCommissionMap] = await Promise.all([
      fetchAllSalesWithItems(supabase, earliestStart.toISOString(), latestEnd.toISOString()),
      fetchFmSalesForPeriod(supabase, earliestStart.toISOString(), latestEnd.toISOString()),
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
    
    let crossSaleProductIds = new Set<string>();
    
    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from("products")
        .select("id, counts_as_sale, counts_as_cross_sale, commission_dkk")
        .in("id", productIds);
      
      countingProductIds = new Set(
        (products || []).filter(p => p.counts_as_sale !== false).map(p => p.id)
      );
      crossSaleProductIds = new Set(
        (products || []).filter(p => p.counts_as_cross_sale === true).map(p => p.id)
      );
      (products || []).forEach(p => productCommissionMap.set(p.id, p.commission_dkk || 0));
    }
    
    console.log(`[calculate-leaderboard-incremental] Cross-sale products: ${crossSaleProductIds.size}`);    

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
        crossSaleProductIds,
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
          crossSaleProductIds,
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
