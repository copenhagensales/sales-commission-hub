import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StandingResult {
  employee_id: string;
  current_provision: number;
  deals_count: number;
  overall_rank: number;
  projected_division: number;
  projected_rank: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { seasonId } = await req.json();

    if (!seasonId) {
      return new Response(
        JSON.stringify({ error: "seasonId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[league-calculate-standings] Starting calculation for season: ${seasonId}`);

    // 1. Get season with dates
    const { data: season, error: seasonError } = await supabase
      .from("league_seasons")
      .select("*")
      .eq("id", seasonId)
      .single();

    if (seasonError || !season) {
      console.error("[league-calculate-standings] Season not found:", seasonError);
      return new Response(
        JSON.stringify({ error: "Season not found", details: seasonError }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sourceStart = season.qualification_source_start;
    const sourceEnd = season.qualification_source_end;
    const playersPerDivision = season.config?.players_per_division || 10;

    console.log(`[league-calculate-standings] Qualification period: ${sourceStart} to ${sourceEnd}`);
    console.log(`[league-calculate-standings] Players per division: ${playersPerDivision}`);

    // 2. Get all active enrollments
    const { data: enrollments, error: enrollError } = await supabase
      .from("league_enrollments")
      .select("employee_id")
      .eq("season_id", seasonId)
      .eq("is_active", true);

    if (enrollError) {
      console.error("[league-calculate-standings] Failed to fetch enrollments:", enrollError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch enrollments", details: enrollError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!enrollments || enrollments.length === 0) {
      console.log("[league-calculate-standings] No enrollments found");
      return new Response(
        JSON.stringify({ success: true, message: "No enrollments to process", standings: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const employeeIds = enrollments.map((e) => e.employee_id);
    console.log(`[league-calculate-standings] Processing ${employeeIds.length} enrolled players`);

    // 3. Get employee -> agent email mappings
    // First, get employee_agent_mapping
    const { data: agentMappings, error: mappingError } = await supabase
      .from("employee_agent_mapping")
      .select("employee_id, agent_id")
      .in("employee_id", employeeIds);

    if (mappingError) {
      console.error("[league-calculate-standings] Failed to fetch agent mappings:", mappingError);
    }

    // Get agent emails
    const agentIds = (agentMappings || []).map((m) => m.agent_id).filter(Boolean);
    const { data: agents, error: agentsError } = await supabase
      .from("agents")
      .select("id, email")
      .in("id", agentIds);

    if (agentsError) {
      console.error("[league-calculate-standings] Failed to fetch agents:", agentsError);
    }

    // Build employee -> agent email map
    const employeeToAgentEmail: Record<string, string> = {};
    for (const mapping of agentMappings || []) {
      const agent = (agents || []).find((a) => a.id === mapping.agent_id);
      if (agent?.email) {
        employeeToAgentEmail[mapping.employee_id] = agent.email.toLowerCase();
      }
    }

    // Also get work_email directly from employee_master_data as fallback
    const { data: employees, error: empError } = await supabase
      .from("employee_master_data")
      .select("id, work_email, private_email")
      .in("id", employeeIds);

    if (empError) {
      console.error("[league-calculate-standings] Failed to fetch employees:", empError);
    }

    // Add work_email as fallback if no agent mapping
    for (const emp of employees || []) {
      if (!employeeToAgentEmail[emp.id] && emp.work_email) {
        employeeToAgentEmail[emp.id] = emp.work_email.toLowerCase();
      }
      // Also try private_email
      if (!employeeToAgentEmail[emp.id] && emp.private_email) {
        employeeToAgentEmail[emp.id] = emp.private_email.toLowerCase();
      }
    }

    console.log(`[league-calculate-standings] Found email mappings for ${Object.keys(employeeToAgentEmail).length} employees`);

    // 4. Get all sales in the qualification period
    const { data: sales, error: salesError } = await supabase
      .from("sales")
      .select("id, agent_email")
      .gte("sale_datetime", sourceStart)
      .lte("sale_datetime", sourceEnd);

    if (salesError) {
      console.error("[league-calculate-standings] Failed to fetch sales:", salesError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch sales", details: salesError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[league-calculate-standings] Found ${sales?.length || 0} sales in period`);

    // Build email -> sale_ids map
    const emailToSaleIds: Record<string, string[]> = {};
    for (const sale of sales || []) {
      const email = sale.agent_email?.toLowerCase();
      if (email) {
        if (!emailToSaleIds[email]) {
          emailToSaleIds[email] = [];
        }
        emailToSaleIds[email].push(sale.id);
      }
    }

    // 5. Get sale_items with mapped_commission for all sales
    const allSaleIds = (sales || []).map((s) => s.id);
    let saleItemsMap: Record<string, { total_commission: number; deals_count: number }> = {};

    if (allSaleIds.length > 0) {
      // Batch fetch sale_items
      const { data: saleItems, error: itemsError } = await supabase
        .from("sale_items")
        .select("sale_id, mapped_commission")
        .in("sale_id", allSaleIds);

      if (itemsError) {
        console.error("[league-calculate-standings] Failed to fetch sale_items:", itemsError);
      }

      // Group by sale_id
      const saleToCommission: Record<string, number> = {};
      for (const item of saleItems || []) {
        if (!saleToCommission[item.sale_id]) {
          saleToCommission[item.sale_id] = 0;
        }
        // mapped_commission already includes quantity multiplier per business rules
        saleToCommission[item.sale_id] += item.mapped_commission || 0;
      }

      // Map email -> commission/deals
      for (const [email, saleIds] of Object.entries(emailToSaleIds)) {
        let totalCommission = 0;
        let dealsCount = 0;
        for (const saleId of saleIds) {
          totalCommission += saleToCommission[saleId] || 0;
          dealsCount += 1;
        }
        saleItemsMap[email] = { total_commission: totalCommission, deals_count: dealsCount };
      }
    }

    // 6. Calculate standings for each employee
    const standingsData: StandingResult[] = [];

    for (const employeeId of employeeIds) {
      const agentEmail = employeeToAgentEmail[employeeId];
      let currentProvision = 0;
      let dealsCount = 0;

      if (agentEmail && saleItemsMap[agentEmail]) {
        currentProvision = saleItemsMap[agentEmail].total_commission;
        dealsCount = saleItemsMap[agentEmail].deals_count;
      }

      standingsData.push({
        employee_id: employeeId,
        current_provision: currentProvision,
        deals_count: dealsCount,
        overall_rank: 0,
        projected_division: 1,
        projected_rank: 1,
      });
    }

    // 7. Sort by provision (highest first) and calculate ranks
    standingsData.sort((a, b) => b.current_provision - a.current_provision);

    for (let i = 0; i < standingsData.length; i++) {
      const s = standingsData[i];
      s.overall_rank = i + 1;
      s.projected_division = Math.floor(i / playersPerDivision) + 1;
      s.projected_rank = (i % playersPerDivision) + 1;
    }

    console.log(`[league-calculate-standings] Calculated standings for ${standingsData.length} players`);

    // 8. Get previous ranks for tracking movement
    const { data: existingStandings } = await supabase
      .from("league_qualification_standings")
      .select("employee_id, overall_rank")
      .eq("season_id", seasonId);

    const previousRankMap: Record<string, number> = {};
    for (const existing of existingStandings || []) {
      previousRankMap[existing.employee_id] = existing.overall_rank;
    }

    // 9. Upsert standings
    const upsertData = standingsData.map((s) => ({
      season_id: seasonId,
      employee_id: s.employee_id,
      current_provision: s.current_provision,
      deals_count: s.deals_count,
      overall_rank: s.overall_rank,
      projected_division: s.projected_division,
      projected_rank: s.projected_rank,
      previous_overall_rank: previousRankMap[s.employee_id] ?? null,
      last_calculated_at: new Date().toISOString(),
    }));

    const { error: upsertError } = await supabase
      .from("league_qualification_standings")
      .upsert(upsertData, { onConflict: "season_id,employee_id" });

    if (upsertError) {
      console.error("[league-calculate-standings] Failed to upsert standings:", upsertError);
      return new Response(
        JSON.stringify({ error: "Failed to save standings", details: upsertError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[league-calculate-standings] Successfully updated ${upsertData.length} standings`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Updated standings for ${upsertData.length} players`,
        standings: standingsData.slice(0, 10), // Return top 10 for preview
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[league-calculate-standings] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
