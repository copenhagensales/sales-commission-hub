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

    // Fetch today's sales
    const { data: salesData, error: salesError } = await supabase
      .from("sales")
      .select("id, agent_name, sale_datetime, status, client_campaign_id")
      .gte("sale_datetime", startOfDay)
      .lte("sale_datetime", endOfDay)
      .order("sale_datetime", { ascending: false });

    if (salesError) {
      console.error("Sales error:", salesError);
    }

    const sales = salesData || [];
    console.log(`Found ${sales.length} sales`);

    // Fetch campaign and client names
    const campaignIds = [...new Set(sales.map(s => s.client_campaign_id).filter(Boolean))] as string[];
    let salesWithClients = sales;

    if (campaignIds.length > 0) {
      const { data: campaigns } = await supabase
        .from("client_campaigns")
        .select("id, name, client_id")
        .in("id", campaignIds);

      const clientIds = [...new Set((campaigns || []).map(c => c.client_id).filter(Boolean))];
      let clientMap: Record<string, string> = {};

      if (clientIds.length > 0) {
        const { data: clients } = await supabase
          .from("clients")
          .select("id, name")
          .in("id", clientIds);
        clientMap = Object.fromEntries((clients || []).map(c => [c.id, c.name]));
      }

      const campaignClientMap = Object.fromEntries(
        (campaigns || []).map(c => [c.id, clientMap[c.client_id] || "Ukendt"])
      );

      salesWithClients = sales.map(s => ({
        ...s,
        client_name: s.client_campaign_id ? campaignClientMap[s.client_campaign_id] || "Ukendt" : "Ukendt"
      }));
    }

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

    // Calculate sales by client
    const salesByClient = salesWithClients.reduce((acc: Record<string, number>, sale: any) => {
      const clientName = sale.client_name || "Ukendt";
      acc[clientName] = (acc[clientName] || 0) + 1;
      return acc;
    }, {});

    const confirmedSales = salesWithClients.filter((s: any) => s.status === "confirmed").length;
    const pendingSales = salesWithClients.filter((s: any) => s.status === "pending").length;

    const response = {
      date: todayStr,
      timestamp: new Date().toISOString(),
      sales: {
        total: salesWithClients.length,
        confirmed: confirmedSales,
        pending: pendingSales,
        byClient: salesByClient,
        recent: salesWithClients.slice(0, 10),
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
      salesCount: response.sales.total,
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
