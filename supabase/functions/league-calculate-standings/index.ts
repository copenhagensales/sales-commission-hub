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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let { seasonId } = await req.json().catch(() => ({}));

    // Auto-detect active season if no seasonId provided (for cron jobs)
    if (!seasonId) {
      console.log("[league-calculate-standings] No seasonId provided, auto-detecting active season...");
      const { data: activeSeason, error: detectError } = await supabase
        .from("league_seasons")
        .select("id, status")
        .in("status", ["qualification", "active"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (detectError || !activeSeason) {
        console.log("[league-calculate-standings] No active/qualification season found, skipping.");
        return new Response(
          JSON.stringify({ success: true, message: "No active season found, nothing to calculate" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      seasonId = activeSeason.id;
      console.log(`[league-calculate-standings] Auto-detected season: ${seasonId} (status: ${activeSeason.status})`);
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
    const sourceEndRaw = season.qualification_source_end;
    // Ensure we include the full end day by using < next day
    const sourceEndDate = new Date(sourceEndRaw);
    sourceEndDate.setDate(sourceEndDate.getDate() + 1);
    const sourceEndExclusive = sourceEndDate.toISOString().slice(0, 10);
    const playersPerDivision = season.config?.players_per_division || 14;

    console.log(`[league-calculate-standings] Qualification period: ${sourceStart} to ${sourceEndExclusive} (exclusive)`);

    // 2. Get all active enrollments (exclude spectators)
    const { data: enrollments, error: enrollError } = await supabase
      .from("league_enrollments")
      .select("employee_id")
      .eq("season_id", seasonId)
      .eq("is_active", true)
      .eq("is_spectator", false);

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
    const { data: agentMappings, error: mappingError } = await supabase
      .from("employee_agent_mapping")
      .select("employee_id, agent_id")
      .in("employee_id", employeeIds);

    if (mappingError) {
      console.error("[league-calculate-standings] Failed to fetch agent mappings:", mappingError);
    }

    const agentIds = (agentMappings || []).map((m) => m.agent_id).filter(Boolean);
    const { data: agents, error: agentsError } = await supabase
      .from("agents")
      .select("id, email")
      .in("id", agentIds);

    if (agentsError) {
      console.error("[league-calculate-standings] Failed to fetch agents:", agentsError);
    }

    // Build employee -> agent emails map (multi-email support)
    const employeeToAgentEmails: Record<string, string[]> = {};
    for (const mapping of agentMappings || []) {
      const agent = (agents || []).find((a) => a.id === mapping.agent_id);
      if (agent?.email) {
        const email = agent.email.toLowerCase();
        if (!employeeToAgentEmails[mapping.employee_id]) {
          employeeToAgentEmails[mapping.employee_id] = [];
        }
        if (!employeeToAgentEmails[mapping.employee_id].includes(email)) {
          employeeToAgentEmails[mapping.employee_id].push(email);
        }
      }
    }

    // Fallback: work_email/private_email from employee_master_data
    const { data: empData, error: empError } = await supabase
      .from("employee_master_data")
      .select("id, work_email, private_email")
      .in("id", employeeIds);

    if (empError) {
      console.error("[league-calculate-standings] Failed to fetch employees:", empError);
    }

    for (const emp of empData || []) {
      if (!employeeToAgentEmails[emp.id]) {
        employeeToAgentEmails[emp.id] = [];
      }
      if (emp.work_email && !employeeToAgentEmails[emp.id].includes(emp.work_email.toLowerCase())) {
        employeeToAgentEmails[emp.id].push(emp.work_email.toLowerCase());
      }
      if (emp.private_email && !employeeToAgentEmails[emp.id].includes(emp.private_email.toLowerCase())) {
        employeeToAgentEmails[emp.id].push(emp.private_email.toLowerCase());
      }
    }

    console.log(`[league-calculate-standings] Found email mappings for ${Object.keys(employeeToAgentEmails).length} employees (multi-email)`);

    // 4. Fetch TM sales in qualification period (exclude FM — those are matched separately)
    // Paginate to avoid the 1000 row limit
    let allTmSales: any[] = [];
    const SALES_PAGE_SIZE = 1000;
    let salesOffset = 0;
    let hasMoreSales = true;

    while (hasMoreSales) {
      const { data: salesBatch, error: salesError } = await supabase
        .from("sales")
        .select("id, agent_email")
        .neq("source", "fieldmarketing")
        .gte("sale_datetime", sourceStart)
        .lt("sale_datetime", sourceEndExclusive)
        .range(salesOffset, salesOffset + SALES_PAGE_SIZE - 1);

      if (salesError) {
        console.error("[league-calculate-standings] Failed to fetch TM sales:", salesError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch sales", details: salesError }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (salesBatch && salesBatch.length > 0) {
        allTmSales = [...allTmSales, ...salesBatch];
        salesOffset += salesBatch.length;
        hasMoreSales = salesBatch.length === SALES_PAGE_SIZE;
      } else {
        hasMoreSales = false;
      }
    }

    console.log(`[league-calculate-standings] Found ${allTmSales.length} TM sales in period`);

    // 4b. Fetch FM sales separately — matched by raw_payload->>'fm_seller_id'
    let allFmSales: any[] = [];
    let fmOffset = 0;
    let hasMoreFm = true;

    while (hasMoreFm) {
      const { data: fmBatch, error: fmError } = await supabase
        .from("sales")
        .select("id, raw_payload")
        .eq("source", "fieldmarketing")
        .gte("sale_datetime", sourceStart)
        .lt("sale_datetime", sourceEndExclusive)
        .range(fmOffset, fmOffset + SALES_PAGE_SIZE - 1);

      if (fmError) {
        console.error("[league-calculate-standings] Failed to fetch FM sales:", fmError);
        break;
      }

      if (fmBatch && fmBatch.length > 0) {
        allFmSales = [...allFmSales, ...fmBatch];
        fmOffset += fmBatch.length;
        hasMoreFm = fmBatch.length === SALES_PAGE_SIZE;
      } else {
        hasMoreFm = false;
      }
    }

    console.log(`[league-calculate-standings] Found ${allFmSales.length} FM sales in period`);

    // 5. Build email -> sale_ids map for TM sales
    const emailToSaleIds: Record<string, string[]> = {};
    for (const sale of allTmSales) {
      const email = sale.agent_email?.toLowerCase();
      if (email) {
        if (!emailToSaleIds[email]) {
          emailToSaleIds[email] = [];
        }
        emailToSaleIds[email].push(sale.id);
      }
    }

    // 5b. Build employee_id -> FM sale_ids map
    const employeeToFmSaleIds: Record<string, string[]> = {};
    for (const sale of allFmSales) {
      const fmSellerId = sale.raw_payload?.fm_seller_id;
      if (fmSellerId) {
        if (!employeeToFmSaleIds[fmSellerId]) {
          employeeToFmSaleIds[fmSellerId] = [];
        }
        employeeToFmSaleIds[fmSellerId].push(sale.id);
      }
    }

    // 6. Get sale_items with mapped_commission for ALL sales (TM + FM)
    const allSaleIds = [...allTmSales.map((s) => s.id), ...allFmSales.map((s) => s.id)];
    const saleToCommission: Record<string, number> = {};

    if (allSaleIds.length > 0) {
      const BATCH_SIZE = 100;
      
      for (let i = 0; i < allSaleIds.length; i += BATCH_SIZE) {
        const batchIds = allSaleIds.slice(i, i + BATCH_SIZE);
        const { data: batchItems, error: batchError } = await supabase
          .from("sale_items")
          .select("sale_id, mapped_commission")
          .in("sale_id", batchIds);
        
        if (batchError) {
          console.error(`[league-calculate-standings] Failed to fetch sale_items batch ${i}-${i + BATCH_SIZE}:`, batchError);
        } else if (batchItems) {
          for (const item of batchItems) {
            saleToCommission[item.sale_id] = (saleToCommission[item.sale_id] || 0) + (Number(item.mapped_commission) || 0);
          }
        }
      }
      
      console.log(`[league-calculate-standings] Fetched commissions for ${Object.keys(saleToCommission).length} sales`);
    }

    // Build email -> commission/deals for TM
    const saleItemsMap: Record<string, { total_commission: number; deals_count: number }> = {};
    for (const [email, saleIds] of Object.entries(emailToSaleIds)) {
      let totalCommission = 0;
      let dealsCount = 0;
      for (const saleId of saleIds) {
        totalCommission += saleToCommission[saleId] || 0;
        dealsCount += 1;
      }
      saleItemsMap[email] = { total_commission: totalCommission, deals_count: dealsCount };
    }

    console.log(`[league-calculate-standings] Stats: ${Object.keys(saleItemsMap).length} TM sellers, ${Object.keys(employeeToFmSaleIds).length} FM sellers`);

    // 7. Calculate standings for each employee (TM via email + FM via fm_seller_id)
    const standingsData: StandingResult[] = [];

    for (const employeeId of employeeIds) {
      const agentEmails = employeeToAgentEmails[employeeId] || [];
      let currentProvision = 0;
      let dealsCount = 0;

      // TM sales via agent_email
      for (const email of agentEmails) {
        if (saleItemsMap[email]) {
          currentProvision += saleItemsMap[email].total_commission;
          dealsCount += saleItemsMap[email].deals_count;
        }
      }

      // FM sales via fm_seller_id (directly matched to employee_id)
      const fmSaleIds = employeeToFmSaleIds[employeeId] || [];
      for (const saleId of fmSaleIds) {
        currentProvision += saleToCommission[saleId] || 0;
        dealsCount += 1;
      }

      if (currentProvision > 0 || dealsCount > 0) {
        console.log(`[league-calculate-standings] Employee ${employeeId}: ${currentProvision} kr, ${dealsCount} deals (TM emails: ${agentEmails.join(', ') || 'none'}, FM sales: ${fmSaleIds.length})`);
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

    console.log(`[league-calculate-standings] Total standings to save: ${standingsData.length}`);

    // 8. Sort by provision (highest first) and calculate ranks
    standingsData.sort((a, b) => b.current_provision - a.current_provision);

    for (let i = 0; i < standingsData.length; i++) {
      const s = standingsData[i];
      s.overall_rank = i + 1;
      s.projected_division = Math.floor(i / playersPerDivision) + 1;
      s.projected_rank = (i % playersPerDivision) + 1;
    }

    // 9. Get previous ranks for tracking movement (only rotate on day change)
    const { data: existingStandings } = await supabase
      .from("league_qualification_standings")
      .select("employee_id, overall_rank, previous_overall_rank, last_calculated_at")
      .eq("season_id", seasonId);

    const existingMap: Record<string, { overall_rank: number; previous_overall_rank: number | null; last_calculated_at: string | null }> = {};
    for (const existing of existingStandings || []) {
      existingMap[existing.employee_id] = {
        overall_rank: existing.overall_rank,
        previous_overall_rank: existing.previous_overall_rank,
        last_calculated_at: existing.last_calculated_at,
      };
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    // 10. Upsert standings — only rotate previous_overall_rank on day change
    const upsertData = standingsData.map((s) => {
      const prev = existingMap[s.employee_id];
      let previousRank: number | null = null;

      if (prev) {
        const lastCalcDay = prev.last_calculated_at ? prev.last_calculated_at.slice(0, 10) : null;
        if (lastCalcDay && lastCalcDay < todayStr) {
          // New day: snapshot the old overall_rank as "start of day" rank
          previousRank = prev.overall_rank;
        } else {
          // Same day: keep existing previous_overall_rank so intraday movement is visible
          previousRank = prev.previous_overall_rank;
        }
      }

      return {
        season_id: seasonId,
        employee_id: s.employee_id,
        current_provision: s.current_provision,
        deals_count: s.deals_count,
        overall_rank: s.overall_rank,
        projected_division: s.projected_division,
        projected_rank: s.projected_rank,
        previous_overall_rank: previousRank,
        last_calculated_at: new Date().toISOString(),
      };
    });

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

    // 11. Delete standings for unenrolled players
    const { data: inactiveEnrollments } = await supabase
      .from("league_enrollments")
      .select("employee_id")
      .eq("season_id", seasonId)
      .eq("is_active", false);

    if (inactiveEnrollments && inactiveEnrollments.length > 0) {
      const inactiveIds = inactiveEnrollments.map((e) => e.employee_id);
      const { error: deleteError } = await supabase
        .from("league_qualification_standings")
        .delete()
        .eq("season_id", seasonId)
        .in("employee_id", inactiveIds);

      if (deleteError) {
        console.error("[league-calculate-standings] Failed to delete inactive standings:", deleteError);
      } else {
        console.log(`[league-calculate-standings] Deleted standings for ${inactiveIds.length} unenrolled players`);
      }
    }

    console.log(`[league-calculate-standings] Successfully updated ${upsertData.length} standings`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Updated standings for ${upsertData.length} players`,
        standings: standingsData.slice(0, 10),
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
