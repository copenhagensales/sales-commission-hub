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

    // Fetch sales with sale_items to calculate correct counts using product mapping
    // This matches the logic in MG Test / product mapping
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

    // Calculate sales by client using product mapping and counts_as_sale flag
    const salesByClient: Record<string, number> = {};
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

      // Count sale items where product is mapped AND counts_as_sale = true
      let saleItemCount = 0;
      const saleItems = (sale as any).sale_items || [];
      
      for (const item of saleItems) {
        const product = item.products;
        // Only count if product is mapped (product_id exists) AND counts_as_sale is explicitly true
        if (product && product.id && product.counts_as_sale === true) {
          const qty = item.quantity || 1;
          saleItemCount += qty;
        }
      }

      if (saleItemCount > 0) {
        salesByClient[clientName] = (salesByClient[clientName] || 0) + saleItemCount;
        totalCountedSales += saleItemCount;
      }

      // Add to recent sales
      if (recentSales.length < 10) {
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
    };

    console.log("Response prepared:", JSON.stringify({
      salesTotal: response.sales.total,
      salesByClient: response.sales.byClient,
      employeesActive: response.employees.active,
      calls: response.calls.today
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
