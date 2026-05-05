import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SeasonConfig {
  players_per_division?: number;
  round_end_hour?: number;
  round_multipliers?: number[];
}

const DEFAULT_ROUND_MULTIPLIERS = [1, 1.2, 1.4, 1.6, 1.8, 2.0];

/**
 * New point formula:
 * basePoints = max(0, (totalDivisions - division) * 20 - (rank - 1) * 5)
 * finalPoints = Math.round(basePoints * roundMultiplier)
 */
function calculatePoints(
  division: number,
  rankInDivision: number,
  totalDivisions: number,
  roundMultiplier: number
): number {
  const basePoints = Math.max(0, (totalDivisions - division + 1) * 20 - (rankInDivision - 1) * 5);
  return Math.round(basePoints * roundMultiplier);
}

/**
 * Round windows are stored as proper UTC timestamps representing
 * Copenhagen-local boundaries (Mon 00:00 -> Sun 23:59:59 CPH time).
 * We pass them through unchanged so the aggregates RPC sees the exact window.
 */
function passthrough(raw: string): string {
  return raw;
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
    const playersPerDivision = config.players_per_division || 14;
    const roundMultipliers = config.round_multipliers || DEFAULT_ROUND_MULTIPLIERS;

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

    const roundNumber = expiredRound.round_number;
    const multiplier = roundMultipliers[Math.min(roundNumber - 1, roundMultipliers.length - 1)] || 1;
    console.log(`[league-process-round] Processing round ${roundNumber} with multiplier ×${multiplier}`);

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

    const employeeIds = seasonStandings.map(s => s.employee_id);

    // --- Use get_sales_aggregates_v2 RPC (single source of truth) ---
    const roundStart = toStartOfDay(expiredRound.start_date);
    const roundEnd = toEndOfDay(expiredRound.end_date);

    console.log(`[league-process-round] Round period: ${roundStart} to ${roundEnd}`);

    const { data: rpcData, error: rpcError } = await supabase.rpc("get_sales_aggregates_v2", {
      p_start: roundStart,
      p_end: roundEnd,
      p_group_by: "employee",
      p_team_id: null,
      p_employee_id: null,
      p_client_id: null,
      p_agent_emails: null,
    });

    if (rpcError) {
      console.error("[league-process-round] RPC error:", rpcError);
      return new Response(
        JSON.stringify({ error: "RPC failed", details: rpcError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build employee_id -> { provision, deals } from RPC
    const rpcMap: Record<string, { provision: number; deals: number }> = {};
    for (const row of rpcData || []) {
      rpcMap[row.group_key] = {
        provision: Number(row.total_commission) || 0,
        deals: Number(row.total_sales) || 0,
      };
    }

    console.log(`[league-process-round] RPC returned ${(rpcData || []).length} employee groups`);

    // Build provision per employee
    const employeeProvision: Record<string, { provision: number; deals: number }> = {};
    for (const empId of employeeIds) {
      employeeProvision[empId] = rpcMap[empId] || { provision: 0, deals: 0 };
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
        const points = calculatePoints(div, rank, totalDivisions, multiplier);
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

    // --- Promotion/Relegation (top 3 promote, #12-14 relegate) ---
    const isTopDiv = (d: number) => d === divisions[0];
    const isBottomDiv = (d: number) => d === divisions[divisions.length - 1];

    for (const result of results) {
      if (result.rank <= 3 && !isTopDiv(result.division)) {
        result.movement = "promoted";
        result.newDivision = result.division - 1;
      }
      if (result.rank >= playersPerDivision - 2 && !isBottomDiv(result.division)) {
        result.movement = "relegated";
        result.newDivision = result.division + 1;
      }
    }

    // --- Playoffs: #4-5 in lower div vs #10-11 in upper div ---
    for (let i = 0; i < divisions.length - 1; i++) {
      const upperDiv = divisions[i];
      const lowerDiv = divisions[i + 1];
      
      const playoff11 = results.find(r => r.division === upperDiv && r.rank === playersPerDivision - 3);
      const playoff4 = results.find(r => r.division === lowerDiv && r.rank === 4);

      if (playoff11 && playoff4) {
        if (playoff4.provision > playoff11.provision) {
          playoff4.movement = "playoff_won";
          playoff4.newDivision = upperDiv;
          playoff11.movement = "playoff_lost";
          playoff11.newDivision = lowerDiv;
        } else {
          playoff11.movement = "playoff_won";
          playoff4.movement = "playoff_lost";
        }
      }

      const playoff10 = results.find(r => r.division === upperDiv && r.rank === playersPerDivision - 4);
      const playoff5 = results.find(r => r.division === lowerDiv && r.rank === 5);

      if (playoff10 && playoff5) {
        if (playoff5.provision > playoff10.provision) {
          playoff5.movement = "playoff_won";
          playoff5.newDivision = upperDiv;
          playoff10.movement = "playoff_lost";
          playoff10.newDivision = lowerDiv;
        } else {
          playoff10.movement = "playoff_won";
          playoff5.movement = "playoff_lost";
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

    // Antal planlagte runder = antal multipliers i config (fallback til 6).
    // Forretningsregel: spillet kører N runder uanset om sidste runde overlapper sæsonens end_date med få dage.
    const totalPlannedRounds = roundMultipliers.length || 6;
    const shouldCreateNext = nextRoundNumber <= totalPlannedRounds;

    if (shouldCreateNext) {
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

    console.log(`[league-process-round] Round ${roundNumber} completed: ${results.length} players, ${promoted} promoted, ${relegated} relegated, multiplier ×${multiplier}`);

    return new Response(
      JSON.stringify({
        success: true,
        round: roundNumber,
        multiplier,
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
