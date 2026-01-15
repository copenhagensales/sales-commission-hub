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

    // Handle eesy-tm-data request (bypasses RLS for TV boards)
    if (action === "eesy-tm-data") {
      return await handleEesyTmData(supabase, corsHeaders);
    }

    // Handle tdc-erhverv-data request (bypasses RLS for TV boards)
    if (action === "tdc-erhverv-data") {
      return await handleTdcErhvervData(supabase, corsHeaders);
    }

    // Handle relatel-data request (bypasses RLS for TV boards)
    if (action === "relatel-data") {
      return await handleRelatelData(supabase, corsHeaders);
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

    // Fetch all clients with logo_url
    const { data: allClients } = await supabase
      .from("clients")
      .select("id, name, logo_url");
    
    const clientMap: Record<string, string> = Object.fromEntries(
      (allClients || []).map(c => [c.id, c.name])
    );
    const clientLogoMap: Record<string, string | null> = Object.fromEntries(
      (allClients || []).map(c => [c.name, c.logo_url])
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
    const salesByClient: Record<string, { count: number; logoUrl: string | null }> = {};
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
        if (!salesByClient[clientName]) {
          salesByClient[clientName] = { count: 0, logoUrl: clientLogoMap[clientName] || null };
        }
        salesByClient[clientName].count += saleItemCount;
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

      // Add to recent sales with commission
      if (recentSales.length < 30) {
        recentSales.push({
          id: sale.id,
          agent_name: sale.agent_name,
          sale_datetime: sale.sale_datetime,
          status: sale.status,
          client_name: clientName,
          items_count: saleItemCount,
          commission: saleCommission
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

    // Fetch team performance data for TV mode
    const teamPerformance = await fetchTeamPerformanceData(supabase, todayStr);

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
      teamPerformance,
    };

    console.log("Response prepared:", JSON.stringify({
      salesTotal: response.sales.total,
      salesByClient: response.sales.byClient,
      sellersOnBoard: response.sellersOnBoard,
      topSellersCount: response.topSellers.length,
      teamPerformanceCount: response.teamPerformance?.length || 0
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

// Fetch team performance data for TV mode
async function fetchTeamPerformanceData(supabase: any, todayStr: string) {
  const today = new Date(todayStr);
  
  // Calculate period starts
  const weekStart = getWeekStart(today);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  
  console.log(`Fetching team performance: today=${todayStr}, weekStart=${weekStart}, monthStart=${monthStart}`);

  // Get teams (exclude Stab)
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name");
  
  const filteredTeams = ((teams as any[]) || []).filter((t: any) => t.name !== "Stab");
  if (filteredTeams.length === 0) return [];

  // Get team_members for employee-team mapping
  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("employee_id, team_id");

  // Get all agents
  const { data: agents } = await supabase
    .from("agents")
    .select("id, email, name");

  // Get employee_agent_mapping
  const { data: agentMappings } = await supabase
    .from("employee_agent_mapping")
    .select("employee_id, agent_id");

  // Build agent_id -> agent data map
  const agentById: Record<string, { email: string; name: string }> = {};
  (agents || []).forEach((a: any) => {
    agentById[a.id] = { email: a.email, name: a.name };
  });

  // Get team_clients for client grouping
  const { data: teamClients } = await supabase
    .from("team_clients")
    .select("team_id, client_id, clients(name)");

  // Get sales for the month with pagination
  let salesData: any[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data: salesPage } = await supabase
      .from("sales")
      .select("id, agent_name, agent_email, sale_datetime, client_campaign_id, client_campaigns(client_id, clients(name))")
      .gte("sale_datetime", `${monthStart}T00:00:00`)
      .lte("sale_datetime", `${todayStr}T23:59:59`)
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (!salesPage || salesPage.length === 0) break;
    salesData = [...salesData, ...salesPage];
    if (salesPage.length < pageSize) break;
    page++;
  }

  // Get sale_items with products - batch in chunks
  const saleIds = salesData.map((s) => s.id);
  let saleItems: any[] = [];
  const BATCH_SIZE = 500;
  for (let i = 0; i < saleIds.length; i += BATCH_SIZE) {
    const batchIds = saleIds.slice(i, i + BATCH_SIZE);
    const { data: batchItems } = await supabase
      .from("sale_items")
      .select("sale_id, quantity, product_id, products(counts_as_sale)")
      .in("sale_id", batchIds);
    if (batchItems) {
      saleItems = [...saleItems, ...batchItems];
    }
  }

  // Map sale_items to sales
  const saleItemsBySaleId: Record<string, any[]> = {};
  saleItems.forEach((si) => {
    if (!saleItemsBySaleId[si.sale_id]) saleItemsBySaleId[si.sale_id] = [];
    saleItemsBySaleId[si.sale_id].push(si);
  });

  // Get absences for the month
  const { data: absences } = await supabase
    .from("absence_request_v2")
    .select("employee_id, type, start_date, end_date")
    .eq("status", "approved")
    .or(`start_date.lte.${todayStr},end_date.gte.${monthStart}`);

  // Build employee -> team map and count employees per team
  const employeeToTeam: Record<string, string> = {};
  const employeeCountByTeam: Record<string, number> = {};
  filteredTeams.forEach(t => { employeeCountByTeam[t.id] = 0; });
  (teamMembers || []).forEach((tm: any) => {
    employeeToTeam[tm.employee_id] = tm.team_id;
    if (employeeCountByTeam[tm.team_id] !== undefined) {
      employeeCountByTeam[tm.team_id]++;
    }
  });

  // Build team -> clients map
  const teamToClients: Record<string, Array<{ clientId: string; clientName: string }>> = {};
  (teamClients || []).forEach((tc: any) => {
    if (!teamToClients[tc.team_id]) teamToClients[tc.team_id] = [];
    if (tc.clients?.name) {
      teamToClients[tc.team_id].push({
        clientId: tc.client_id,
        clientName: tc.clients.name
      });
    }
  });

  // Build employee -> agent mapping (by email)
  const employeeToEmails = new Map<string, string[]>();
  (agentMappings || []).forEach((m: any) => {
    const agent = agentById[m.agent_id];
    if (agent?.email) {
      const emails = employeeToEmails.get(m.employee_id) || [];
      emails.push(agent.email.toLowerCase());
      employeeToEmails.set(m.employee_id, emails);
    }
  });

  // Reverse map: email -> employee_id
  const emailToEmployee = new Map<string, string>();
  employeeToEmails.forEach((emails, empId) => {
    emails.forEach(email => emailToEmployee.set(email, empId));
  });

  // Calculate sales per team for day, week, month
  const teamSales: Record<string, { day: number; week: number; month: number }> = {};
  filteredTeams.forEach(t => {
    teamSales[t.id] = { day: 0, week: 0, month: 0 };
  });

  // Process each sale - attribute to team based on CLIENT, not seller
  for (const sale of salesData) {
    // Get client from sale
    const saleClientName = (sale.client_campaigns?.clients?.name || "").toLowerCase();
    
    // Find team by client
    let teamId: string | null = null;
    for (const [tid, clients] of Object.entries(teamToClients)) {
      if (clients.some(c => c.clientName.toLowerCase() === saleClientName)) {
        teamId = tid;
        break;
      }
    }

    if (!teamId || !teamSales[teamId]) continue;

    // Count sales items
    const items = saleItemsBySaleId[sale.id] || [];
    let salesCount = 0;
    for (const item of items) {
      if (item.products?.counts_as_sale === true) {
        salesCount += item.quantity || 1;
      }
    }

    if (salesCount === 0) continue;

    // Determine period
    const saleDate = sale.sale_datetime.split('T')[0];
    
    teamSales[teamId].month += salesCount;
    if (saleDate >= weekStart) {
      teamSales[teamId].week += salesCount;
    }
    if (saleDate === todayStr) {
      teamSales[teamId].day += salesCount;
    }
  }

  // Calculate work days helper
  const countWorkDaysInOverlap = (absStart: string, absEnd: string, periodStart: string, periodEnd: string): number => {
    const overlapStart = absStart > periodStart ? absStart : periodStart;
    const overlapEnd = absEnd < periodEnd ? absEnd : periodEnd;
    if (overlapStart > overlapEnd) return 0;
    
    let count = 0;
    const current = new Date(overlapStart);
    const end = new Date(overlapEnd);
    
    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
      current.setDate(current.getDate() + 1);
    }
    return count;
  };

  // Calculate absences per team
  const teamAbsences: Record<string, { 
    sickDay: number; sickWeek: number; sickMonth: number;
    vacationDay: number; vacationWeek: number; vacationMonth: number;
  }> = {};
  filteredTeams.forEach(t => {
    teamAbsences[t.id] = { 
      sickDay: 0, sickWeek: 0, sickMonth: 0,
      vacationDay: 0, vacationWeek: 0, vacationMonth: 0
    };
  });

  (absences || []).forEach((absence: any) => {
    const teamId = employeeToTeam[absence.employee_id];
    if (!teamId || !teamAbsences[teamId]) return;

    const isSick = absence.type === "sick";
    const isVacation = absence.type === "vacation";
    if (!isSick && !isVacation) return;

    const startDate = absence.start_date;
    const endDate = absence.end_date;

    // Day
    const dayDays = countWorkDaysInOverlap(startDate, endDate, todayStr, todayStr);
    if (isSick) teamAbsences[teamId].sickDay += dayDays;
    if (isVacation) teamAbsences[teamId].vacationDay += dayDays;

    // Week
    const weekDays = countWorkDaysInOverlap(startDate, endDate, weekStart, todayStr);
    if (isSick) teamAbsences[teamId].sickWeek += weekDays;
    if (isVacation) teamAbsences[teamId].vacationWeek += weekDays;

    // Month
    const monthDays = countWorkDaysInOverlap(startDate, endDate, monthStart, todayStr);
    if (isSick) teamAbsences[teamId].sickMonth += monthDays;
    if (isVacation) teamAbsences[teamId].vacationMonth += monthDays;
  });

  // Calculate work days in periods
  const workDaysDay = (new Date(todayStr).getDay() !== 0 && new Date(todayStr).getDay() !== 6) ? 1 : 0;
  
  let workDaysWeek = 0;
  let current = new Date(weekStart);
  const endDate = new Date(todayStr);
  while (current <= endDate) {
    const dow = current.getDay();
    if (dow !== 0 && dow !== 6) workDaysWeek++;
    current.setDate(current.getDate() + 1);
  }

  let workDaysMonth = 0;
  current = new Date(monthStart);
  while (current <= endDate) {
    const dow = current.getDay();
    if (dow !== 0 && dow !== 6) workDaysMonth++;
    current.setDate(current.getDate() + 1);
  }

  // Build response
  return filteredTeams.map(t => ({
    id: t.id,
    name: t.name,
    employeeCount: employeeCountByTeam[t.id] || 0,
    sales: teamSales[t.id] || { day: 0, week: 0, month: 0 },
    sick: {
      day: teamAbsences[t.id]?.sickDay || 0,
      week: teamAbsences[t.id]?.sickWeek || 0,
      month: teamAbsences[t.id]?.sickMonth || 0,
    },
    vacation: {
      day: teamAbsences[t.id]?.vacationDay || 0,
      week: teamAbsences[t.id]?.vacationWeek || 0,
      month: teamAbsences[t.id]?.vacationMonth || 0,
    },
    workDays: {
      day: workDaysDay,
      week: workDaysWeek,
      month: workDaysMonth,
    },
  }));
}

// Helper to get week start (Monday)
function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
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

// Handle Eesy TM data request (bypasses RLS for TV boards)
async function handleEesyTmData(
  supabase: any,
  corsHeaders: Record<string, string>
) {
  console.log("[EesyTmData] Fetching data");

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  
  // Calculate week start (Monday)
  const dayOfWeek = today.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - daysToMonday);
  const weekStartStr = weekStart.toISOString().split("T")[0];
  
  // Calculate payroll period (15th to 14th)
  const currentDay = today.getDate();
  let payrollStart: Date;
  if (currentDay >= 15) {
    payrollStart = new Date(today.getFullYear(), today.getMonth(), 15);
  } else {
    payrollStart = new Date(today.getFullYear(), today.getMonth() - 1, 15);
  }
  const payrollStartStr = payrollStart.toISOString().split("T")[0];

  // Eesy client ID
  const EESY_CLIENT_ID = "81993a7b-ff24-46b8-8ffb-37a83138ddba";

  const selectFields = "id, agent_email, sale_datetime, client_campaign_id, client_campaigns!inner(client_id), sale_items(quantity, mapped_commission, products(counts_as_sale))";

  // Fetch today's sales
  const { data: salesToday } = await supabase
    .from("sales")
    .select(selectFields)
    .eq("client_campaigns.client_id", EESY_CLIENT_ID)
    .gte("sale_datetime", `${todayStr}T00:00:00`)
    .lte("sale_datetime", `${todayStr}T23:59:59`);

  // Fetch week's sales
  const { data: salesWeek } = await supabase
    .from("sales")
    .select(selectFields)
    .eq("client_campaigns.client_id", EESY_CLIENT_ID)
    .gte("sale_datetime", `${weekStartStr}T00:00:00`)
    .lte("sale_datetime", `${todayStr}T23:59:59`);

  // Fetch payroll period sales (lønperiode)
  const { data: salesMonth } = await supabase
    .from("sales")
    .select(selectFields)
    .eq("client_campaigns.client_id", EESY_CLIENT_ID)
    .gte("sale_datetime", `${payrollStartStr}T00:00:00`)
    .lte("sale_datetime", `${todayStr}T23:59:59`);

  // Collect all unique agent emails from sales for name resolution
  const allAgentEmails = new Set<string>();
  [...(salesToday || []), ...(salesWeek || []), ...(salesMonth || [])].forEach((sale: any) => {
    if (sale.agent_email) {
      allAgentEmails.add(sale.agent_email.toLowerCase());
    }
  });

  // Resolve agent emails to employee names and avatars using employee_agent_mapping
  const emailToNameMap = new Map<string, string>();
  const emailToAvatarMap = new Map<string, string>();
  
  if (allAgentEmails.size > 0) {
    // Use the same pattern as resolveAgentNames but also get avatars
    const { data: allAgents } = await supabase
      .from("agents")
      .select("id, email");
    
    if (allAgents && allAgents.length > 0) {
      const matchingAgents = (allAgents as any[]).filter(
        (a) => a.email && allAgentEmails.has(a.email.toLowerCase())
      );
      
      if (matchingAgents.length > 0) {
        const agentIds = matchingAgents.map((a) => a.id);
        const emailToAgentId = new Map<string, string>(
          matchingAgents.map((a) => [a.email.toLowerCase(), a.id])
        );
        
        const { data: mappings } = await supabase
          .from("employee_agent_mapping")
          .select("agent_id, employee_id")
          .in("agent_id", agentIds);
        
        if (mappings && mappings.length > 0) {
          const employeeIds = (mappings as any[]).map((m) => m.employee_id);
          const agentIdToEmployeeId = new Map<string, string>(
            (mappings as any[]).map((m) => [m.agent_id, m.employee_id])
          );
          
          const { data: employees } = await supabase
            .from("employee_master_data")
            .select("id, first_name, last_name, avatar_url")
            .in("id", employeeIds);
          
          if (employees) {
            const employeeIdToData = new Map<string, any>(
              (employees as any[]).map((e) => [e.id, e])
            );
            
            // Build the email -> name and email -> avatar maps
            for (const agent of matchingAgents) {
              const agentEmail = agent.email?.toLowerCase();
              if (!agentEmail) continue;
              
              const employeeId = agentIdToEmployeeId.get(agent.id);
              if (!employeeId) continue;
              
              const emp = employeeIdToData.get(employeeId);
              if (!emp) continue;
              
              const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim();
              emailToNameMap.set(agentEmail, fullName);
              if (emp.avatar_url) {
                emailToAvatarMap.set(agentEmail, emp.avatar_url);
              }
            }
          }
        }
      }
    }
  }
  
  console.log("[EesyTmData] Resolved names:", emailToNameMap.size, "agents");

  // Calculate totals and seller stats
  const calculateTotals = (sales: any[]) => {
    let totalSales = 0;
    let totalCommission = 0;
    const sellerStats: Record<string, { email: string; name: string; sales: number; commission: number; avatarUrl?: string }> = {};

    sales?.forEach((sale) => {
      const agentEmail = sale.agent_email || "Unknown";
      const emailLower = agentEmail.toLowerCase();
      
      if (!sellerStats[emailLower]) {
        const resolvedName = emailToNameMap.get(emailLower) || agentEmail.split("@")[0];
        sellerStats[emailLower] = { 
          email: agentEmail,
          name: resolvedName, 
          sales: 0, 
          commission: 0,
          avatarUrl: emailToAvatarMap.get(emailLower)
        };
      }

      sale.sale_items?.forEach((item: any) => {
        const countsAsSale = item.products?.counts_as_sale !== false;
        if (countsAsSale) {
          totalSales += Number(item.quantity) || 1;
          sellerStats[emailLower].sales += Number(item.quantity) || 1;
        }
        totalCommission += Number(item.mapped_commission) || 0;
        sellerStats[emailLower].commission += Number(item.mapped_commission) || 0;
      });
    });

    return { totalSales, totalCommission, sellerStats };
  };

  const todayData = calculateTotals(salesToday || []);
  const weekData = calculateTotals(salesWeek || []);
  const monthData = calculateTotals(salesMonth || []);

  // Convert sellerStats to sorted arrays
  const formatSellers = (stats: Record<string, { name: string; sales: number; commission: number; avatarUrl?: string }>) => {
    return Object.values(stats)
      .filter(s => s.sales > 0)
      .sort((a, b) => b.commission - a.commission);
  };

  const result = {
    salesToday: todayData.totalSales,
    salesWeek: weekData.totalSales,
    salesMonth: monthData.totalSales,
    commissionToday: todayData.totalCommission,
    commissionWeek: weekData.totalCommission,
    commissionMonth: monthData.totalCommission,
    sellersToday: formatSellers(todayData.sellerStats),
    sellersWeek: formatSellers(weekData.sellerStats),
    sellersMonth: formatSellers(monthData.sellerStats),
    topSellers: formatSellers(monthData.sellerStats).slice(0, 10),
  };

  console.log("[EesyTmData] Returning:", { salesToday: result.salesToday, salesWeek: result.salesWeek, salesMonth: result.salesMonth });

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Handle TDC Erhverv data request (bypasses RLS for TV boards)
async function handleTdcErhvervData(
  supabase: any,
  corsHeaders: Record<string, string>
) {
  console.log("[TdcErhvervData] Fetching data");

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  
  // Calculate week start (Monday)
  const dayOfWeek = today.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - daysToMonday);
  const weekStartStr = weekStart.toISOString().split("T")[0];
  
  // Calculate payroll period (15th to 14th)
  const currentDay = today.getDate();
  let payrollStart: Date;
  if (currentDay >= 15) {
    payrollStart = new Date(today.getFullYear(), today.getMonth(), 15);
  } else {
    payrollStart = new Date(today.getFullYear(), today.getMonth() - 1, 15);
  }
  const payrollStartStr = payrollStart.toISOString().split("T")[0];

  // TDC Erhverv client ID
  const TDC_ERHVERV_CLIENT_ID = "20744525-7466-4b2c-afa7-6ee09a9112b0";

  const selectFields = "id, agent_email, sale_datetime, client_campaign_id, client_campaigns!inner(client_id), sale_items(quantity, mapped_commission, products(counts_as_sale))";

  // Fetch today's sales
  const { data: salesToday } = await supabase
    .from("sales")
    .select(selectFields)
    .eq("client_campaigns.client_id", TDC_ERHVERV_CLIENT_ID)
    .gte("sale_datetime", `${todayStr}T00:00:00`)
    .lte("sale_datetime", `${todayStr}T23:59:59`);

  // Fetch week's sales
  const { data: salesWeek } = await supabase
    .from("sales")
    .select(selectFields)
    .eq("client_campaigns.client_id", TDC_ERHVERV_CLIENT_ID)
    .gte("sale_datetime", `${weekStartStr}T00:00:00`)
    .lte("sale_datetime", `${todayStr}T23:59:59`);

  // Fetch payroll period sales (lønperiode)
  const { data: salesMonth } = await supabase
    .from("sales")
    .select(selectFields)
    .eq("client_campaigns.client_id", TDC_ERHVERV_CLIENT_ID)
    .gte("sale_datetime", `${payrollStartStr}T00:00:00`)
    .lte("sale_datetime", `${todayStr}T23:59:59`);

  // Get unique agent emails from all sales
  const allAgentEmails = new Set<string>();
  [...(salesToday || []), ...(salesWeek || []), ...(salesMonth || [])].forEach((sale: any) => {
    if (sale.agent_email) {
      allAgentEmails.add(sale.agent_email.toLowerCase());
    }
  });

  // Resolve agent emails to employee names, avatars, and IDs using employee_agent_mapping
  const emailToNameMap = new Map<string, string>();
  const emailToAvatarMap = new Map<string, string>();
  const emailToIdMap = new Map<string, string>();
  let employeeIds: string[] = [];
  
  if (allAgentEmails.size > 0) {
    const { data: allAgents } = await supabase
      .from("agents")
      .select("id, email");
    
    if (allAgents && allAgents.length > 0) {
      const matchingAgents = (allAgents as any[]).filter(
        (a) => a.email && allAgentEmails.has(a.email.toLowerCase())
      );
      
      if (matchingAgents.length > 0) {
        const agentIds = matchingAgents.map((a) => a.id);
        const emailToAgentId = new Map<string, string>(
          matchingAgents.map((a) => [a.email.toLowerCase(), a.id])
        );
        
        const { data: mappings } = await supabase
          .from("employee_agent_mapping")
          .select("agent_id, employee_id")
          .in("agent_id", agentIds);
        
        if (mappings && mappings.length > 0) {
          employeeIds = (mappings as any[]).map((m) => m.employee_id);
          const agentIdToEmployeeId = new Map<string, string>(
            (mappings as any[]).map((m) => [m.agent_id, m.employee_id])
          );
          
          const { data: employees } = await supabase
            .from("employee_master_data")
            .select("id, first_name, last_name, avatar_url")
            .in("id", employeeIds);
          
          if (employees) {
            const employeeIdToData = new Map<string, any>(
              (employees as any[]).map((e) => [e.id, e])
            );
            
            // Build the email -> name, avatar, and id maps
            for (const agent of matchingAgents) {
              const agentEmail = agent.email?.toLowerCase();
              if (!agentEmail) continue;
              
              const employeeId = agentIdToEmployeeId.get(agent.id);
              if (!employeeId) continue;
              
              const emp = employeeIdToData.get(employeeId);
              if (!emp) continue;
              
              const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim();
              emailToNameMap.set(agentEmail, fullName);
              emailToIdMap.set(agentEmail, emp.id);
              if (emp.avatar_url) {
                emailToAvatarMap.set(agentEmail, emp.avatar_url);
              }
            }
          }
        }
      }
    }
  }
  
  console.log("[TdcErhvervData] Resolved names:", emailToNameMap.size, "agents, employeeIds:", employeeIds.length);

  // Fetch team memberships for these employees
  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("employee_id, team_id")
    .in("employee_id", employeeIds);

  const teamIds = [...new Set(teamMembers?.map((tm: any) => tm.team_id) || [])];

  // Fetch team shifts
  const { data: primaryShifts } = await supabase
    .from("team_standard_shifts")
    .select("id, team_id, start_time, end_time, hours_source")
    .in("team_id", teamIds)
    .eq("is_active", true);

  const { data: shiftDays } = await supabase
    .from("team_standard_shift_days")
    .select("shift_id, day_of_week, start_time, end_time")
    .in("shift_id", primaryShifts?.map((s: any) => s.id) || []);

  // Fetch timestamps for teams using 'timestamp' hours_source
  const teamsUsingTimestamps = primaryShifts?.filter((s: any) => s.hours_source === "timestamp").map((s: any) => s.team_id) || [];
  let timeStampsData: any[] = [];
  if (teamsUsingTimestamps.length > 0) {
    const employeesWithTimestampTeams = teamMembers
      ?.filter((tm: any) => teamsUsingTimestamps.includes(tm.team_id))
      .map((tm: any) => tm.employee_id) || [];

    if (employeesWithTimestampTeams.length > 0) {
      const { data: stamps } = await supabase
        .from("time_stamps")
        .select("employee_id, date, clock_in, clock_out, break_minutes")
        .in("employee_id", employeesWithTimestampTeams)
        .gte("date", payrollStartStr)
        .lte("date", todayStr);
      timeStampsData = stamps || [];
    }
  }

  // Helper function to calculate hours for a date range
  const calculateHoursForRange = (startDate: string, endDate: string) => {
    let totalHours = 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      const dayOfWeek = d.getDay();
      const adjustedDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;

      employeeIds.forEach(empId => {
        const empTeam = teamMembers?.find((tm: any) => tm.employee_id === empId);
        if (!empTeam) return;

        const empShift = primaryShifts?.find((s: any) => s.team_id === empTeam.team_id);
        if (!empShift) return;

        const hoursSource = empShift.hours_source || "shift";
        const empShiftDays = shiftDays?.filter((sd: any) => sd.shift_id === empShift.id) || [];
        const shiftForDay = empShiftDays.find((sd: any) => sd.day_of_week === adjustedDayOfWeek);

        let hours = 0;
        if (hoursSource === "timestamp") {
          const empTimestamp = timeStampsData.find((ts: any) => ts.employee_id === empId && ts.date === dateStr);
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
      });
    }
    return Math.round(totalHours * 100) / 100;
  };

  const hoursToday = calculateHoursForRange(todayStr, todayStr);
  const hoursWeek = calculateHoursForRange(weekStartStr, todayStr);
  const hoursPayroll = calculateHoursForRange(payrollStartStr, todayStr);

  // Calculate totals and seller stats
  const calculateTotals = (sales: any[]) => {
    let totalSales = 0;
    let totalCommission = 0;
    const sellerStats: Record<string, { email: string; name: string; sales: number; commission: number; avatarUrl?: string }> = {};

    sales?.forEach((sale) => {
      const agentEmail = sale.agent_email || "Unknown";
      const emailLower = agentEmail.toLowerCase();
      
      if (!sellerStats[emailLower]) {
        const resolvedName = emailToNameMap.get(emailLower) || agentEmail.split("@")[0];
        sellerStats[emailLower] = { 
          email: agentEmail,
          name: resolvedName, 
          sales: 0, 
          commission: 0,
          avatarUrl: emailToAvatarMap.get(emailLower)
        };
      }

      sale.sale_items?.forEach((item: any) => {
        const countsAsSale = item.products?.counts_as_sale !== false;
        if (countsAsSale) {
          totalSales += Number(item.quantity) || 1;
          sellerStats[emailLower].sales += Number(item.quantity) || 1;
        }
        totalCommission += Number(item.mapped_commission) || 0;
        sellerStats[emailLower].commission += Number(item.mapped_commission) || 0;
      });
    });

    return { totalSales, totalCommission, sellerStats };
  };

  const todayData = calculateTotals(salesToday || []);
  const weekData = calculateTotals(salesWeek || []);
  const monthData = calculateTotals(salesMonth || []);

  // Convert sellerStats to sorted arrays
  const formatSellers = (stats: Record<string, { name: string; sales: number; commission: number; avatarUrl?: string }>) => {
    return Object.values(stats)
      .filter(s => s.sales > 0)
      .sort((a, b) => b.commission - a.commission);
  };

  const result = {
    salesToday: todayData.totalSales,
    salesWeek: weekData.totalSales,
    salesMonth: monthData.totalSales,
    hoursToday,
    hoursWeek,
    hoursPayroll,
    commissionToday: todayData.totalCommission,
    commissionWeek: weekData.totalCommission,
    commissionMonth: monthData.totalCommission,
    sellersToday: formatSellers(todayData.sellerStats),
    sellersWeek: formatSellers(weekData.sellerStats),
    sellersMonth: formatSellers(monthData.sellerStats),
    topSellers: formatSellers(monthData.sellerStats).slice(0, 10),
  };

  console.log("[TdcErhvervData] Returning:", { salesToday: result.salesToday, salesWeek: result.salesWeek, salesMonth: result.salesMonth, hoursToday, hoursWeek, hoursPayroll });

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Handle Relatel data request (bypasses RLS for TV boards)
async function handleRelatelData(
  supabase: any,
  corsHeaders: Record<string, string>
) {
  console.log("[RelatelData] Fetching data");

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  
  // Calculate week start (Monday)
  const dayOfWeek = today.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - daysToMonday);
  const weekStartStr = weekStart.toISOString().split("T")[0];
  
  // Calculate payroll period (15th to 14th)
  const currentDay = today.getDate();
  let payrollStart: Date;
  let payrollEnd: Date;
  
  if (currentDay >= 15) {
    payrollStart = new Date(today.getFullYear(), today.getMonth(), 15);
    payrollEnd = new Date(today.getFullYear(), today.getMonth() + 1, 14);
  } else {
    payrollStart = new Date(today.getFullYear(), today.getMonth() - 1, 15);
    payrollEnd = new Date(today.getFullYear(), today.getMonth(), 14);
  }
  const payrollStartStr = payrollStart.toISOString().split("T")[0];

  // Relatel client ID (look it up or use the known ID)
  const { data: relatelClient } = await supabase
    .from("clients")
    .select("id")
    .ilike("name", "%relatel%")
    .limit(1)
    .maybeSingle();

  if (!relatelClient) {
    console.log("[RelatelData] Relatel client not found");
    return new Response(JSON.stringify({
      salesToday: 0,
      salesWeek: 0,
      salesMonth: 0,
      sellersToday: [],
      sellersWeek: [],
      sellersMonth: [],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const RELATEL_CLIENT_ID = relatelClient.id;
  console.log("[RelatelData] Found Relatel client:", RELATEL_CLIENT_ID);

  const selectFields = "id, agent_email, sale_datetime, client_campaign_id, client_campaigns!inner(client_id), sale_items(quantity, mapped_commission, products(counts_as_sale))";

  // Fetch today's sales
  const { data: salesToday } = await supabase
    .from("sales")
    .select(selectFields)
    .eq("client_campaigns.client_id", RELATEL_CLIENT_ID)
    .gte("sale_datetime", `${todayStr}T00:00:00`)
    .lte("sale_datetime", `${todayStr}T23:59:59`);

  // Fetch week's sales
  const { data: salesWeek } = await supabase
    .from("sales")
    .select(selectFields)
    .eq("client_campaigns.client_id", RELATEL_CLIENT_ID)
    .gte("sale_datetime", `${weekStartStr}T00:00:00`)
    .lte("sale_datetime", `${todayStr}T23:59:59`);

  // Fetch payroll period sales
  const { data: salesPayroll } = await supabase
    .from("sales")
    .select(selectFields)
    .eq("client_campaigns.client_id", RELATEL_CLIENT_ID)
    .gte("sale_datetime", `${payrollStartStr}T00:00:00`)
    .lte("sale_datetime", `${todayStr}T23:59:59`);

  // Calculate totals with seller breakdown
  const calculateTotals = (sales: any[]) => {
    let totalSales = 0;
    let totalCommission = 0;
    const sellerStats: Record<string, { name: string; sales: number; commission: number }> = {};

    sales?.forEach((sale) => {
      const agentEmail = sale.agent_email || "Unknown";
      if (!sellerStats[agentEmail]) {
        sellerStats[agentEmail] = { name: agentEmail.split("@")[0], sales: 0, commission: 0 };
      }

      sale.sale_items?.forEach((item: any) => {
        const countsAsSale = item.products?.counts_as_sale !== false;
        if (countsAsSale) {
          totalSales += Number(item.quantity) || 1;
          sellerStats[agentEmail].sales += Number(item.quantity) || 1;
        }
        totalCommission += Number(item.mapped_commission) || 0;
        sellerStats[agentEmail].commission += Number(item.mapped_commission) || 0;
      });
    });

    return { totalSales, totalCommission, sellerStats };
  };

  const todayData = calculateTotals(salesToday || []);
  const weekData = calculateTotals(salesWeek || []);
  const payrollData = calculateTotals(salesPayroll || []);

  // Build sorted seller arrays for each period
  const buildSellerArray = (sellerStats: Record<string, { name: string; sales: number; commission: number }>) => {
    return Object.values(sellerStats)
      .filter(s => s.sales > 0)
      .sort((a, b) => b.commission - a.commission);
  };

  const sellersToday = buildSellerArray(todayData.sellerStats);
  const sellersWeek = buildSellerArray(weekData.sellerStats);
  const sellersMonth = buildSellerArray(payrollData.sellerStats);

  // Resolve agent emails to employee names for all sellers
  const allEmails = new Set<string>();
  Object.keys(todayData.sellerStats).forEach(e => allEmails.add(e));
  Object.keys(weekData.sellerStats).forEach(e => allEmails.add(e));
  Object.keys(payrollData.sellerStats).forEach(e => allEmails.add(e));

  if (allEmails.size > 0) {
    const nameMap = await resolveAgentNames(supabase, Array.from(allEmails));
    
    // Resolve names for each period's sellers
    const resolveNames = (sellers: any[], stats: Record<string, any>) => {
      sellers.forEach((seller) => {
        const email = Object.keys(stats).find(e => stats[e].sales === seller.sales && stats[e].commission === seller.commission);
        if (email) {
          const resolvedName = nameMap.get(email.toLowerCase());
          if (resolvedName) {
            seller.name = resolvedName;
          }
        }
      });
    };
    
    resolveNames(sellersToday, todayData.sellerStats);
    resolveNames(sellersWeek, weekData.sellerStats);
    resolveNames(sellersMonth, payrollData.sellerStats);
  }

  // Get avatars for sellers
  const sellerNames = new Set<string>();
  [...sellersToday, ...sellersWeek, ...sellersMonth].forEach(s => sellerNames.add(s.name.toLowerCase()));
  
  const { data: employees } = await supabase
    .from("employee_master_data")
    .select("first_name, last_name, avatar_url")
    .eq("is_active", true);

  const avatarMap = new Map<string, string>();
  (employees || []).forEach((emp: any) => {
    const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
    if (emp.avatar_url) {
      avatarMap.set(fullName, emp.avatar_url);
    }
  });

  // Add avatar URLs to sellers
  const addAvatars = (sellers: any[]) => {
    sellers.forEach(s => {
      s.avatarUrl = avatarMap.get(s.name.toLowerCase()) || null;
    });
  };
  
  addAvatars(sellersToday);
  addAvatars(sellersWeek);
  addAvatars(sellersMonth);

  const result = {
    salesToday: todayData.totalSales,
    salesWeek: weekData.totalSales,
    salesMonth: payrollData.totalSales,
    sellersToday,
    sellersWeek,
    sellersMonth,
  };

  console.log("[RelatelData] Returning:", {
    salesToday: result.salesToday,
    salesWeek: result.salesWeek,
    salesMonth: result.salesMonth,
    sellerCounts: {
      today: sellersToday.length,
      week: sellersWeek.length,
      month: sellersMonth.length
    }
  });

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
