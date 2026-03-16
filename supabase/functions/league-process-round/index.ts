import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SeasonConfig {
  players_per_division?: number;
  round_end_hour?: number;
}

/**
 * Division-First Ranking point formula:
 * points = (totalDivisions - division) * playersPerDivision + (playersPerDivision - rank + 1)
 * 
 * Guarantees #10 in Div N always scores higher than #1 in Div N+1
 */
function calculatePoints(
  division: number,
  rankInDivision: number,
  totalDivisions: number,
  playersPerDivision: number
): number {
  return (totalDivisions - division) * playersPerDivision + (playersPerDivision - rankInDivision + 1);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let seasonId: string | null = null;
    try {
      const body = await req.json();
      seasonId = body?.seasonId || null;
    } catch { /* no body */ }

    // Find active season if not provided
    if (!seasonId) {
      const { data: activeSeason } = await supabase
        .from("league_seasons")
        .select("id")
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      
      if (!activeSeason) {
        return new Response(
          JSON.stringify({ success: true, message: "No active season" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      seasonId = activeSeason.id;
    }

    console.log(`[league-process-round] Processing season: ${seasonId}`);

    // Get season details
    const { data: season, error: seasonError } = await supabase
      .from("league_seasons")
      .select("*")
      .eq("id", seasonId)
      .single();

    if (seasonError || !season) {
      return new Response(
        JSON.stringify({ error: "Season not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (season.status !== "active") {
      return new Response(
        JSON.stringify({ success: true, message: "Season is not active" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config: SeasonConfig = season.config || {};
    const playersPerDivision = config.players_per_division || 10;

    // Find current round that needs processing (active/pending + end_date < now)
    const now = new Date().toISOString();
    const { data: expiredRound } = await supabase
      .from("league_rounds")
      .select("*")
      .eq("season_id", seasonId)
      .in("status", ["active", "pending"])
      .lt("end_date", now)
      .order("round_number", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!expiredRound) {
      // Check if there's an active round still running
      const { data: activeRound } = await supabase
        .from("league_rounds")
        .select("id, round_number, end_date")
        .eq("season_id", seasonId)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (activeRound) {
        console.log(`[league-process-round] Round ${activeRound.round_number} still active until ${activeRound.end_date}`);
      }
      
      return new Response(
        JSON.stringify({ success: true, message: "No expired rounds to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[league-process-round] Processing round ${expiredRound.round_number}`);

    // Get all season standings (current divisions)
    const { data: seasonStandings, error: standingsError } = await supabase
      .from("league_season_standings")
      .select("*")
      .eq("season_id", seasonId);

    if (standingsError || !seasonStandings || seasonStandings.length === 0) {
      console.error("[league-process-round] No season standings found");
      return new Response(
        JSON.stringify({ error: "No season standings found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Fetch weekly provision for all players ---
    const employeeIds = seasonStandings.map(s => s.employee_id);
    
    // Get employee -> agent email mappings
    const { data: agentMappings } = await supabase
      .from("employee_agent_mapping")
      .select("employee_id, agent_id")
      .in("employee_id", employeeIds);

    const agentIds = (agentMappings || []).map(m => m.agent_id).filter(Boolean);
    const { data: agents } = await supabase
      .from("agents")
      .select("id, email")
      .in("id", agentIds.length > 0 ? agentIds : ["__none__"]);

    const employeeToEmail: Record<string, string> = {};
    for (const mapping of agentMappings || []) {
      const agent = (agents || []).find(a => a.id === mapping.agent_id);
      if (agent?.email) employeeToEmail[mapping.employee_id] = agent.email.toLowerCase();
    }

    // Fallback emails
    const { data: empData } = await supabase
      .from("employee_master_data")
      .select("id, work_email, private_email")
      .in("id", employeeIds);

    for (const emp of empData || []) {
      if (!employeeToEmail[emp.id] && emp.work_email) employeeToEmail[emp.id] = emp.work_email.toLowerCase();
      if (!employeeToEmail[emp.id] && emp.private_email) employeeToEmail[emp.id] = emp.private_email.toLowerCase();
    }

    // Fetch sales in round period
    const roundStart = expiredRound.start_date;
    const roundEnd = expiredRound.end_date;
    
    let allSales: any[] = [];
    const PAGE = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: batch } = await supabase
        .from("sales")
        .select("id, agent_email")
        .or("validation_status.neq.rejected,validation_status.is.null")
        .gte("sale_datetime", roundStart)
        .lte("sale_datetime", roundEnd)
        .range(offset, offset + PAGE - 1);

      if (batch && batch.length > 0) {
        allSales = [...allSales, ...batch];
        offset += batch.length;
        hasMore = batch.length === PAGE;
      } else {
        hasMore = false;
      }
    }

    // Build email -> sale commission map
    const emailToSaleIds: Record<string, string[]> = {};
    for (const sale of allSales) {
      const email = sale.agent_email?.toLowerCase();
      if (email) {
        if (!emailToSaleIds[email]) emailToSaleIds[email] = [];
        emailToSaleIds[email].push(sale.id);
      }
    }

    const allSaleIds = allSales.map(s => s.id);
    const saleToCommission: Record<string, number> = {};

    if (allSaleIds.length > 0) {
      const BATCH = 100;
      for (let i = 0; i < allSaleIds.length; i += BATCH) {
        const batchIds = allSaleIds.slice(i, i + BATCH);
        const { data: items } = await supabase
          .from("sale_items")
          .select("sale_id, mapped_commission")
          .in("sale_id", batchIds);
        
        for (const item of items || []) {
          saleToCommission[item.sale_id] = (saleToCommission[item.sale_id] || 0) + (Number(item.mapped_commission) || 0);
        }
      }
    }

    // Calculate provision per employee
    const employeeProvision: Record<string, { provision: number; deals: number }> = {};
    for (const empId of employeeIds) {
      const email = employeeToEmail[empId];
      let provision = 0;
      let deals = 0;
      if (email && emailToSaleIds[email]) {
        for (const saleId of emailToSaleIds[email]) {
          provision += saleToCommission[saleId] || 0;
          deals++;
        }
      }
      employeeProvision[empId] = { provision, deals };
    }

    // --- Group players by division and rank within ---
    const divisionGroups: Record<number, { empId: string; provision: number; deals: number }[]> = {};
    for (const standing of seasonStandings) {
      const div = standing.current_division;
      if (!divisionGroups[div]) divisionGroups[div] = [];
      divisionGroups[div].push({
        empId: standing.employee_id,
        provision: employeeProvision[standing.employee_id]?.provision || 0,
        deals: employeeProvision[standing.employee_id]?.deals || 0,
      });
    }

    // Sort each division by provision (highest first)
    for (const div of Object.keys(divisionGroups)) {
      divisionGroups[Number(div)].sort((a, b) => b.provision - a.provision);
    }

    const divisions = Object.keys(divisionGroups).map(Number).sort((a, b) => a - b);
    const totalDivisions = divisions.length;

    // --- Calculate points and determine movements ---
    interface RoundResult {
      empId: string;
      division: number;
      rank: number;
      provision: number;
      deals: number;
      points: number;
      movement: string;
      newDivision: number;
    }

    const results: RoundResult[] = [];
    
    for (const div of divisions) {
      const players = divisionGroups[div];
      for (let i = 0; i < players.length; i++) {
        const rank = i + 1;
        const points = calculatePoints(div, rank, totalDivisions, playersPerDivision);
        results.push({
          empId: players[i].empId,
          division: div,
          rank,
          provision: players[i].provision,
          deals: players[i].deals,
          points,
          movement: "none",
          newDivision: div,
        });
      }
    }

    // --- Promotion/Relegation ---
    const isTopDiv = (d: number) => d === divisions[0];
    const isBottomDiv = (d: number) => d === divisions[divisions.length - 1];

    for (const result of results) {
      // Top 2 promote (except top division)
      if (result.rank <= 2 && !isTopDiv(result.division)) {
        result.movement = "promoted";
        result.newDivision = result.division - 1;
      }
      // Bottom 2 relegate (except bottom division)
      if (result.rank >= playersPerDivision - 1 && !isBottomDiv(result.division)) {
        result.movement = "relegated";
        result.newDivision = result.division + 1;
      }
    }

    // --- Playoffs: #3 in lower div vs #8 in upper div ---
    for (let i = 0; i < divisions.length - 1; i++) {
      const upperDiv = divisions[i];
      const lowerDiv = divisions[i + 1];
      
      const playoff8 = results.find(r => r.division === upperDiv && r.rank === playersPerDivision - 2);
      const playoff3 = results.find(r => r.division === lowerDiv && r.rank === 3);

      if (playoff8 && playoff3) {
        // Higher provision wins the playoff
        if (playoff3.provision > playoff8.provision) {
          // #3 from lower wins → promotes
          playoff3.movement = "playoff_won";
          playoff3.newDivision = upperDiv;
          playoff8.movement = "playoff_lost";
          playoff8.newDivision = lowerDiv;
        } else {
          // #8 from upper stays
          playoff8.movement = "playoff_won";
          playoff3.movement = "playoff_lost";
        }
      }
    }

    // --- Get previous cumulative points ---
    const prevPointsMap: Record<string, number> = {};
    for (const s of seasonStandings) {
      prevPointsMap[s.employee_id] = Number(s.total_points) || 0;
    }

    // --- Save round standings ---
    const roundStandingsData = results.map(r => ({
      round_id: expiredRound.id,
      season_id: seasonId,
      employee_id: r.empId,
      division: r.division,
      rank_in_division: r.rank,
      weekly_provision: r.provision,
      weekly_deals: r.deals,
      points_earned: r.points,
      cumulative_points: (prevPointsMap[r.empId] || 0) + r.points,
      movement: r.movement,
    }));

    const { error: roundInsertError } = await supabase
      .from("league_round_standings")
      .upsert(roundStandingsData, { onConflict: "round_id,employee_id" });

    if (roundInsertError) {
      console.error("[league-process-round] Failed to insert round standings:", roundInsertError);
      return new Response(
        JSON.stringify({ error: "Failed to save round standings", details: roundInsertError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Update season standings ---
    const seasonUpdates = results.map(r => ({
      season_id: seasonId!,
      employee_id: r.empId,
      current_division: r.newDivision,
      total_points: (prevPointsMap[r.empId] || 0) + r.points,
      total_provision: (seasonStandings.find(s => s.employee_id === r.empId)?.total_provision || 0) + r.provision,
      rounds_played: (seasonStandings.find(s => s.employee_id === r.empId)?.rounds_played || 0) + 1,
      previous_division: r.division,
      updated_at: new Date().toISOString(),
    }));

    // Calculate overall ranks by total_points
    seasonUpdates.sort((a, b) => Number(b.total_points) - Number(a.total_points));
    seasonUpdates.forEach((s, i) => {
      (s as any).overall_rank = i + 1;
    });

    // Calculate division ranks
    const divGrouped: Record<number, typeof seasonUpdates> = {};
    for (const s of seasonUpdates) {
      if (!divGrouped[s.current_division]) divGrouped[s.current_division] = [];
      divGrouped[s.current_division].push(s);
    }
    for (const div of Object.values(divGrouped)) {
      div.sort((a, b) => Number(b.total_points) - Number(a.total_points));
      div.forEach((s, i) => {
        (s as any).division_rank = i + 1;
      });
    }

    const { error: seasonUpdateError } = await supabase
      .from("league_season_standings")
      .upsert(seasonUpdates, { onConflict: "season_id,employee_id" });

    if (seasonUpdateError) {
      console.error("[league-process-round] Failed to update season standings:", seasonUpdateError);
    }

    // --- Mark round completed ---
    await supabase
      .from("league_rounds")
      .update({ status: "completed" })
      .eq("id", expiredRound.id);

    // --- Create next round ---
    const nextRoundNumber = expiredRound.round_number + 1;
    const nextStart = new Date(expiredRound.end_date);
    const nextEnd = new Date(nextStart);
    nextEnd.setDate(nextEnd.getDate() + 7);

    // Don't create if past season end
    if (!season.end_date || nextEnd <= new Date(season.end_date)) {
      const { error: nextRoundError } = await supabase
        .from("league_rounds")
        .insert({
          season_id: seasonId,
          round_number: nextRoundNumber,
          start_date: nextStart.toISOString(),
          end_date: nextEnd.toISOString(),
          status: "active",
        });

      if (nextRoundError) {
        console.error("[league-process-round] Failed to create next round:", nextRoundError);
      } else {
        console.log(`[league-process-round] Created round ${nextRoundNumber}`);
      }
    } else {
      console.log(`[league-process-round] Season ends before next round, not creating`);
    }

    const promoted = results.filter(r => r.movement === "promoted" || r.movement === "playoff_won").length;
    const relegated = results.filter(r => r.movement === "relegated" || r.movement === "playoff_lost").length;

    console.log(`[league-process-round] Round ${expiredRound.round_number} completed: ${results.length} players, ${promoted} promoted, ${relegated} relegated`);

    return new Response(
      JSON.stringify({
        success: true,
        round: expiredRound.round_number,
        players: results.length,
        promoted,
        relegated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[league-process-round] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
