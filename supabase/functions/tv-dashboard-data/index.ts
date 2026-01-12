import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Use service role to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const accessCode = url.searchParams.get("code");
    const dashboard = url.searchParams.get("dashboard") || "cph-sales";
    const action = url.searchParams.get("action");
    const metric = url.searchParams.get("metric") || "sales_today";

    // Handle celebration data request (bypasses RLS for TV boards)
    if (action === "celebration-data") {
      return await handleCelebrationData(supabase, dashboard, metric, corsHeaders);
    }

    // Verify access code if provided
    if (accessCode) {
      const { data: accessData, error: accessError } = await supabase
        .from("tv_board_access")
        .select("id, dashboard_slug, is_active")
        .eq("access_code", accessCode.toUpperCase())
        .eq("is_active", true)
        .maybeSingle();

      if (accessError || !accessData) {
        return new Response(
          JSON.stringify({ error: "Invalid access code" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update access stats
      await supabase
        .from("tv_board_access")
        .update({
          last_accessed_at: new Date().toISOString(),
          access_count: (accessData as any).access_count + 1 || 1,
        })
        .eq("id", accessData.id);
    }

    // Get today's date range
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const startOfDay = `${todayStr}T00:00:00`;
    const endOfDay = `${todayStr}T23:59:59`;

    console.log(`Fetching TV dashboard data for ${dashboard}, date: ${todayStr}`);

    // Handle team-specific dashboards (tdc-erhverv, relatel, eesy-tm, etc.)
    const TEAM_DASHBOARDS: Record<string, string> = {
      "tdc-erhverv": "TDC Erhverv",
      "relatel": "Relatel",
      "eesy-tm": "Eesy TM",
      "fieldmarketing": "Fieldmarketing",
      "united": "United",
      "tryg": "Tryg",
      "ase": "ASE",
    };

    if (TEAM_DASHBOARDS[dashboard]) {
      return await handleTeamDashboard(supabase, dashboard, TEAM_DASHBOARDS[dashboard], todayStr, startOfDay, endOfDay, corsHeaders);
    }

    // Default: CPH Sales dashboard logic
    // Fetch sales with sale_items to calculate correct counts using product mapping
    const { data: salesWithItems, error: salesError } = await supabase
      .from("sales")
      .select(`
        id, 
        agent_name, 
        sale_datetime, 
        status, 
        client_campaign_id,
        dialer_campaign_id,
        sale_items (
          id,
          quantity,
          product_id,
          mapped_commission,
          products (
            id,
            name,
            counts_as_sale,
            client_campaign_id
          )
        )
      `)
      .gte("sale_datetime", startOfDay)
      .lte("sale_datetime", endOfDay)
      .order("sale_datetime", { ascending: false });

    if (salesError) {
      console.error("Sales error:", salesError);
    }

    const sales = salesWithItems || [];
    console.log(`Found ${sales.length} sales with items`);

    // Fetch all clients
    const { data: allClients } = await supabase
      .from("clients")
      .select("id, name");
    
    const clientMap: Record<string, string> = Object.fromEntries(
      (allClients || []).map(c => [c.id, c.name])
    );

    // Fetch campaign mappings (adversus -> client_campaign)
    const { data: campaignMappings } = await supabase
      .from("adversus_campaign_mappings")
      .select("adversus_campaign_id, client_campaign_id");
    
    const adversusToCampaignMap: Record<string, string> = Object.fromEntries(
      (campaignMappings || []).filter(m => m.client_campaign_id).map(m => [m.adversus_campaign_id, m.client_campaign_id!])
    );

    // Fetch client campaigns
    const { data: clientCampaigns } = await supabase
      .from("client_campaigns")
      .select("id, name, client_id");
    
    const campaignToClientMap: Record<string, string> = Object.fromEntries(
      (clientCampaigns || []).map(c => [c.id, c.client_id])
    );

    // Calculate sales by client and track seller commission
    const salesByClient: Record<string, number> = {};
    const sellerCommission: Record<string, { commission: number; name: string }> = {};
    const sellersWithSales = new Set<string>();
    let totalCountedSales = 0;
    const recentSales: any[] = [];

    for (const sale of sales) {
      // Determine client from sale
      let clientId: string | null = null;
      let clientName = "Ukendt";

      // Try getting client from sale's client_campaign_id
      if (sale.client_campaign_id) {
        clientId = campaignToClientMap[sale.client_campaign_id] || null;
      }
      
      // Fallback: try dialer_campaign_id -> adversus_campaign_mappings -> client_campaign -> client
      if (!clientId && sale.dialer_campaign_id) {
        const mappedCampaignId = adversusToCampaignMap[sale.dialer_campaign_id];
        if (mappedCampaignId) {
          clientId = campaignToClientMap[mappedCampaignId] || null;
        }
      }

      if (clientId) {
        clientName = clientMap[clientId] || "Ukendt";
      }

      // Count sale items and track commission
      let saleItemCount = 0;
      let saleCommission = 0;
      const saleItems = (sale as any).sale_items || [];
      
      for (const item of saleItems) {
        const product = item.products;
        // Only count if product is mapped (product_id exists) AND counts_as_sale is explicitly true
        if (product && product.id && product.counts_as_sale === true) {
          const qty = item.quantity || 1;
          saleItemCount += qty;
        }
        // Sum commission (mapped_commission already includes quantity)
        saleCommission += item.mapped_commission || 0;
      }

      if (saleItemCount > 0) {
        salesByClient[clientName] = (salesByClient[clientName] || 0) + saleItemCount;
        totalCountedSales += saleItemCount;
        
        // Track seller
        if (sale.agent_name) {
          const lowerName = sale.agent_name.toLowerCase();
          sellersWithSales.add(lowerName);
          
          if (!sellerCommission[lowerName]) {
            sellerCommission[lowerName] = { commission: 0, name: sale.agent_name };
          }
          sellerCommission[lowerName].commission += saleCommission;
        }
      }

      // Add to recent sales
      if (recentSales.length < 15) {
        recentSales.push({
          id: sale.id,
          agent_name: sale.agent_name,
          sale_datetime: sale.sale_datetime,
          status: sale.status,
          client_name: clientName,
          items_count: saleItemCount
        });
      }
    }

    console.log(`Sales by client:`, salesByClient);
    console.log(`Total counted sales: ${totalCountedSales}`);
    console.log(`Sellers on board: ${sellersWithSales.size}`);

    // Resolve agent names to employee names for top sellers
    const agentEmails = Object.keys(sellerCommission);
    let nameMap = new Map<string, string>();
    
    if (agentEmails.length > 0) {
      nameMap = await resolveAgentNames(supabase, agentEmails);
    }

    // Build top 20 sellers list with resolved names
    const topSellers = Object.entries(sellerCommission)
      .map(([email, data]) => ({
        name: nameMap.get(email) || data.name,
        commission: data.commission,
      }))
      .sort((a, b) => b.commission - a.commission)
      .slice(0, 20)
      .map((seller, index) => ({ ...seller, rank: index + 1 }));

    console.log(`Top sellers:`, topSellers.slice(0, 5));

    // Fetch employee counts
    const { count: activeEmployees } = await supabase
      .from("employee_master_data")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("is_staff_employee", false);

    const { count: staffEmployees } = await supabase
      .from("employee_master_data")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("is_staff_employee", true);

    // Fetch today's calls
    const { count: todayCalls } = await supabase
      .from("dialer_calls")
      .select("*", { count: "exact", head: true })
      .gte("start_time", startOfDay)
      .lte("start_time", endOfDay);

    const confirmedSales = sales.filter((s: any) => s.status === "confirmed").length;
    const pendingSales = sales.filter((s: any) => s.status === "pending").length;

    const response = {
      date: todayStr,
      timestamp: new Date().toISOString(),
      sales: {
        total: totalCountedSales,
        confirmed: confirmedSales,
        pending: pendingSales,
        byClient: salesByClient,
        recent: recentSales,
      },
      employees: {
        active: activeEmployees || 0,
        staff: staffEmployees || 0,
      },
      calls: {
        today: todayCalls || 0,
      },
      sellersOnBoard: sellersWithSales.size,
      topSellers,
    };

    console.log("Response prepared:", JSON.stringify({
      salesTotal: response.sales.total,
      salesByClient: response.sales.byClient,
      sellersOnBoard: response.sellersOnBoard,
      topSellersCount: response.topSellers.length
    }));

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper function to resolve agent email to display name
async function resolveAgentNames(
  supabase: any,
  agentEmails: string[]
): Promise<Map<string, string>> {
  const nameMap = new Map<string, string>();
  
  if (agentEmails.length === 0) return nameMap;
  
  // Normalize emails to lowercase for consistent matching
  const lowerEmails = agentEmails.map(e => e.toLowerCase());
  const uniqueLowerEmails = [...new Set(lowerEmails)];
  
  // Get all agents and filter case-insensitively (agents table might have different casing)
  const { data: allAgents } = await supabase
    .from("agents")
    .select("id, email");
  
  if (!allAgents || allAgents.length === 0) return nameMap;
  
  // Filter agents that match our emails (case-insensitive)
  const matchingAgents = (allAgents as any[]).filter(
    (a) => a.email && uniqueLowerEmails.includes(a.email.toLowerCase())
  );
  
  if (matchingAgents.length === 0) return nameMap;
  
  const agentIds = matchingAgents.map((a) => a.id);
  const emailToAgentId = new Map<string, string>(
    matchingAgents.map((a) => [a.email.toLowerCase(), a.id])
  );
  
  // Get employee mappings
  const { data: mappings } = await supabase
    .from("employee_agent_mapping")
    .select("agent_id, employee_id")
    .in("agent_id", agentIds);
  
  if (!mappings || mappings.length === 0) return nameMap;
  
  const employeeIds = (mappings as any[]).map((m) => m.employee_id);
  const agentIdToEmployeeId = new Map<string, string>(
    (mappings as any[]).map((m) => [m.agent_id, m.employee_id])
  );
  
  // Get employee names from master data (first_name + last_name, no full_name column)
  const { data: employees } = await supabase
    .from("employee_master_data")
    .select("id, first_name, last_name")
    .in("id", employeeIds);
  
  if (!employees) return nameMap;
  
  const employeeIdToName = new Map<string, string>(
    (employees as any[]).map((e) => [e.id, `${e.first_name || ''} ${e.last_name || ''}`.trim()])
  );
  
  // Build the final email -> name map
  for (const email of agentEmails) {
    const agentId = emailToAgentId.get(email.toLowerCase());
    if (agentId) {
      const employeeId = agentIdToEmployeeId.get(agentId);
      if (employeeId) {
        const name = employeeIdToName.get(employeeId);
        if (name) {
          nameMap.set(email.toLowerCase(), name);
        }
      }
    }
  }
  
  return nameMap;
}

// Handle team-specific dashboards
async function handleTeamDashboard(
  supabase: any, 
  teamSlug: string, 
  teamName: string, 
  todayStr: string, 
  startOfDay: string, 
  endOfDay: string,
  corsHeaders: Record<string, string>
) {
  console.log(`Fetching team dashboard data for ${teamSlug} (${teamName})`);

  // Find the team
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id, name")
    .ilike("name", `%${teamName}%`)
    .maybeSingle();

  if (teamError) {
    console.error("Team error:", teamError);
  }

  // Get associated clients via team_clients
  const clientIds: string[] = [];
  const clients: any[] = [];

  if (team) {
    const { data: teamClients } = await supabase
      .from("team_clients")
      .select(`client_id, clients (id, name, logo_url)`)
      .eq("team_id", team.id);

    if (teamClients) {
      for (const tc of teamClients) {
        if (tc.clients) {
          clients.push(tc.clients);
          clientIds.push(tc.clients.id);
        }
      }
    }
  }

  console.log(`Found ${clients.length} clients for team ${teamName}`);

  // Get all campaigns for these clients
  const { data: campaigns } = await supabase
    .from("client_campaigns")
    .select("id, client_id")
    .in("client_id", clientIds.length > 0 ? clientIds : ['none']);

  const campaignIds = (campaigns || []).map((c: any) => c.id);
  const campaignToClient = new Map((campaigns || []).map((c: any) => [c.id, c.client_id]));

  // Get month start
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Fetch sales for these campaigns
  const { data: sales } = await supabase
    .from("sales")
    .select(`
      id, agent_name, sale_datetime, client_campaign_id,
      sale_items (
        quantity,
        product_id,
        products (counts_as_sale, commission_dkk)
      )
    `)
    .in("client_campaign_id", campaignIds.length > 0 ? campaignIds : ['none'])
    .gte("sale_datetime", monthStart)
    .order("sale_datetime", { ascending: false });

  // Collect all unique agent emails to resolve names
  const allEmails = (sales || []).map((s: any) => s.agent_name).filter((n: any): n is string => typeof n === 'string' && n.length > 0);
  const uniqueEmails: string[] = Array.from(new Set(allEmails));
  const agentNameMap = await resolveAgentNames(supabase, uniqueEmails);
  
  console.log(`Resolved ${agentNameMap.size} agent names from ${uniqueEmails.length} unique emails`);

  // Calculate stats by client
  const clientStatsMap: Record<string, { salesToday: number; salesThisMonth: number }> = {};
  clientIds.forEach(id => clientStatsMap[id] = { salesToday: 0, salesThisMonth: 0 });

  // Calculate top sellers - separate for today and month (keyed by resolved name)
  const todaySellerStats: Record<string, { sales: number; commission: number; clientId: string }> = {};
  const monthSellerStats: Record<string, { sales: number; commission: number; clientId: string }> = {};

  // Track recent sales
  const recentSalesList: any[] = [];

  for (const sale of sales || []) {
    const saleClientId = campaignToClient.get(sale.client_campaign_id) as string | undefined;
    if (!saleClientId) continue;

    // Count only items where counts_as_sale !== false
    let validSales = 0;
    let commission = 0;
    for (const item of (sale as any).sale_items || []) {
      if (item.products?.counts_as_sale !== false) {
        const qty = Number(item.quantity) || 1;
        validSales += qty;
        commission += (item.products?.commission_dkk || 0) * qty;
      }
    }

    if (validSales > 0 && clientStatsMap[saleClientId]) {
      clientStatsMap[saleClientId].salesThisMonth += validSales;
      
      // Resolve agent name from email
      const agentEmail = sale.agent_name || "";
      const resolvedName = agentNameMap.get(agentEmail.toLowerCase()) || agentEmail || "Ukendt";
      
      // Track month seller stats (all sales this month)
      if (!monthSellerStats[resolvedName]) {
        monthSellerStats[resolvedName] = { sales: 0, commission: 0, clientId: saleClientId };
      }
      monthSellerStats[resolvedName].sales += validSales;
      monthSellerStats[resolvedName].commission += commission;
      
      if (sale.sale_datetime >= startOfDay) {
        clientStatsMap[saleClientId].salesToday += validSales;
        
        // Track today seller stats
        if (!todaySellerStats[resolvedName]) {
          todaySellerStats[resolvedName] = { sales: 0, commission: 0, clientId: saleClientId };
        }
        todaySellerStats[resolvedName].sales += validSales;
        todaySellerStats[resolvedName].commission += commission;
      }
      
      // Add to recent sales (limit to 10 most recent)
      if (recentSalesList.length < 10) {
        recentSalesList.push({
          id: sale.id,
          agentName: resolvedName,
          saleDateTime: sale.sale_datetime,
          commission,
          sales: validSales,
        });
      }
    }
  }

  // Build client stats array
  const clientStatsArray = clients
    .map((client: any) => ({
      clientId: client.id,
      clientName: client.name,
      logoUrl: client.logo_url,
      salesToday: clientStatsMap[client.id]?.salesToday || 0,
      salesThisMonth: clientStatsMap[client.id]?.salesThisMonth || 0,
    }))
    .sort((a: any, b: any) => b.salesThisMonth - a.salesThisMonth);

  // Build top sellers arrays (today and month separately)
  const topSellersToday = Object.entries(todaySellerStats)
    .map(([name, stats]) => ({
      name,
      sales: stats.sales,
      commission: stats.commission,
      clientId: stats.clientId,
    }))
    .sort((a, b) => b.commission - a.commission)
    .slice(0, 10);

  const topSellersMonth = Object.entries(monthSellerStats)
    .map(([name, stats]) => ({
      name,
      sales: stats.sales,
      commission: stats.commission,
      clientId: stats.clientId,
    }))
    .sort((a, b) => b.commission - a.commission)
    .slice(0, 15);

  // Calculate totals
  const totalSalesToday = Object.values(clientStatsMap).reduce((sum, s) => sum + s.salesToday, 0);
  const totalSalesThisMonth = Object.values(clientStatsMap).reduce((sum, s) => sum + s.salesThisMonth, 0);

  const response = {
    date: todayStr,
    timestamp: new Date().toISOString(),
    dashboardType: "team",
    teamSlug,
    teamName: team?.name || teamName,
    clients: clientStatsArray,
    topSellers: topSellersToday, // Keep for backward compatibility
    topSellersToday,
    topSellersMonth,
    recentSales: recentSalesList,
    totals: {
      salesToday: totalSalesToday,
      salesThisMonth: totalSalesThisMonth,
    },
  };

  console.log(`Team dashboard response: ${totalSalesToday} sales today, ${totalSalesThisMonth} this month, ${topSellersToday.length} today sellers, ${topSellersMonth.length} month sellers`);

  return new Response(JSON.stringify(response), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Handle celebration data requests (used by TV boards that need to bypass RLS)
async function handleCelebrationData(
  supabase: any,
  dashboardSlug: string,
  metric: string,
  corsHeaders: Record<string, string>
) {
  console.log(`[CelebrationData] Fetching for dashboard: ${dashboardSlug}, metric: ${metric}`);
  
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
  const weekStart = getWeekStart(today);

  // Map dashboard slugs to client IDs
  const clientIdMap: Record<string, string> = {
    "tdc-erhverv": "20744525-7466-4b2c-afa7-6ee09a9112b0",
    "tdc-erhverv-goals": "20744525-7466-4b2c-afa7-6ee09a9112b0",
    "tryg": "516a3f67-ea6d-4ef0-929d-e3224cc16e22",
    "relatel": "0ff8476d-16d8-4150-aee9-48ac90ec962d",
    "ase": "53eb9c4a-91b0-44a9-9ee7-a87d87cc3e0f",
    "codan": "789f7e51-d3c8-42c6-b461-b45ea20d1e1f",
    "fieldmarketing": "9a92ea4c-6404-4b58-be08-065e7552d552",
    "fieldmarketing-goals": "9a92ea4c-6404-4b58-be08-065e7552d552",
    "eesy-tm": "81993a7b-ff24-46b8-8ffb-37a83138ddba",
  };

  const clientId = clientIdMap[dashboardSlug] || null;
  console.log(`[CelebrationData] Client ID for ${dashboardSlug}: ${clientId}`);

  // Build queries
  const selectFields = clientId
    ? "id, agent_email, sale_datetime, client_campaign_id, client_campaigns!inner(client_id), sale_items(quantity, mapped_commission, products(counts_as_sale))"
    : "id, agent_email, sale_datetime, sale_items(quantity, mapped_commission, products(counts_as_sale))";

  // Fetch today's sales
  let salesTodayQuery = supabase
    .from("sales")
    .select(selectFields)
    .gte("sale_datetime", `${todayStr}T00:00:00`)
    .lte("sale_datetime", `${todayStr}T23:59:59`);

  // Fetch month's sales
  let salesMonthQuery = supabase
    .from("sales")
    .select(selectFields)
    .gte("sale_datetime", `${monthStart}T00:00:00`)
    .lte("sale_datetime", `${todayStr}T23:59:59`);

  // Fetch week's sales
  let salesWeekQuery = supabase
    .from("sales")
    .select(selectFields)
    .gte("sale_datetime", `${weekStart}T00:00:00`)
    .lte("sale_datetime", `${todayStr}T23:59:59`);

  // Apply client filter if needed
  if (clientId) {
    salesTodayQuery = salesTodayQuery.eq("client_campaigns.client_id", clientId);
    salesMonthQuery = salesMonthQuery.eq("client_campaigns.client_id", clientId);
    salesWeekQuery = salesWeekQuery.eq("client_campaigns.client_id", clientId);
  }

  const [todayRes, monthRes, weekRes] = await Promise.all([
    salesTodayQuery,
    salesMonthQuery,
    salesWeekQuery,
  ]);

  console.log(`[CelebrationData] Query results: today=${todayRes.data?.length || 0}, month=${monthRes.data?.length || 0}, week=${weekRes.data?.length || 0}`);

  // Calculate totals
  const calculateSalesAndCommission = (sales: any[]) => {
    let totalSales = 0;
    let totalCommission = 0;
    const employeeSales: Record<string, { name: string; sales: number; commission: number }> = {};

    sales?.forEach((sale) => {
      const agentEmail = sale.agent_email || "Unknown";
      if (!employeeSales[agentEmail]) {
        employeeSales[agentEmail] = { name: agentEmail.split("@")[0], sales: 0, commission: 0 };
      }
      
      sale.sale_items?.forEach((item: any) => {
        const countsAsSale = item.products?.counts_as_sale !== false;
        if (countsAsSale) {
          totalSales += Number(item.quantity) || 1;
          employeeSales[agentEmail].sales += Number(item.quantity) || 1;
        }
        totalCommission += Number(item.mapped_commission) || 0;
        employeeSales[agentEmail].commission += Number(item.mapped_commission) || 0;
      });
    });

    return { totalSales, totalCommission, employeeSales };
  };

  const todayData = calculateSalesAndCommission(todayRes.data || []);
  const monthData = calculateSalesAndCommission(monthRes.data || []);
  const weekData = calculateSalesAndCommission(weekRes.data || []);

  // Find top performer today
  let topEmployeeName: string | null = null;
  let topSales = 0;
  
  // Resolve agent names to employee names
  const agentEmails = Object.keys(todayData.employeeSales);
  if (agentEmails.length > 0) {
    const nameMap = await resolveAgentNames(supabase, agentEmails);
    
    Object.entries(todayData.employeeSales).forEach(([email, empData]) => {
      const resolvedName = nameMap.get(email.toLowerCase()) || empData.name;
      if (empData.sales > topSales) {
        topSales = empData.sales;
        topEmployeeName = resolvedName;
      }
    });
  }

  // Fetch goal data if relevant
  let goalProgress = 0;
  let goalTarget = 0;
  let goalRemaining = 0;

  if (clientId && (metric.includes("goal") || dashboardSlug?.includes("goals"))) {
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    
    const { data: goalData } = await supabase
      .from("client_monthly_goals")
      .select("sales_target")
      .eq("client_id", clientId)
      .eq("month", currentMonth)
      .eq("year", currentYear)
      .single();

    if (goalData) {
      goalTarget = goalData.sales_target || 0;
      goalRemaining = Math.max(0, goalTarget - monthData.totalCommission);
      goalProgress = goalTarget > 0 ? Math.round((monthData.totalCommission / goalTarget) * 100) : 0;
    }
  }

  // Get the specific metric value
  const getMetricValue = (metricKey: string): number => {
    switch (metricKey) {
      case "sales_today": return todayData.totalSales;
      case "sales_month": return monthData.totalSales;
      case "sales_week": return weekData.totalSales;
      case "total_sales": return monthData.totalSales;
      case "commission_today": return todayData.totalCommission;
      case "commission_month": return monthData.totalCommission;
      case "goal_progress": return goalProgress;
      case "goal_target": return goalTarget;
      case "goal_remaining": return goalRemaining;
      default: return todayData.totalSales;
    }
  };

  const result = {
    employeeName: topEmployeeName,
    salesCount: todayData.totalSales,
    commission: todayData.totalCommission,
    metricValue: getMetricValue(metric),
    salesToday: todayData.totalSales,
    salesMonth: monthData.totalSales,
    salesWeek: weekData.totalSales,
    totalSales: monthData.totalSales,
    commissionToday: todayData.totalCommission,
    commissionMonth: monthData.totalCommission,
    goalProgress,
    goalTarget,
    goalRemaining,
  };

  console.log(`[CelebrationData] Returning:`, result);

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Helper to get week start (Monday)
function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}
