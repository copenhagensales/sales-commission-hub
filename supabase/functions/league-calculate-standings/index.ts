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

    // 3. Fetch provision/deals per employee via RPC (single source of truth)
    const standingsData: StandingResult[] = [];
    const BATCH_SIZE = 10;

    // Use sourceEndRaw with end-of-day to match dagsrapporter
    const rpcEnd = sourceEndRaw + "T23:59:59";

    for (let i = 0; i < employeeIds.length; i += BATCH_SIZE) {
      const batch = employeeIds.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (employeeId) => {
          const { data, error } = await supabase.rpc("get_sales_aggregates_v2", {
            p_start: sourceStart,
            p_end: rpcEnd,
            p_employee_id: employeeId,
            p_group_by: "none",
          });

          if (error) {
            console.error(`[league-calculate-standings] RPC error for ${employeeId}:`, error);
          }

          const row = data?.[0];
          return {
            employee_id: employeeId,
            current_provision: Number(row?.total_commission) || 0,
            deals_count: Number(row?.total_sales) || 0,
            overall_rank: 0,
            projected_division: 1,
            projected_rank: 1,
          };
        })
      );
      standingsData.push(...results);
    }

    console.log(`[league-calculate-standings] Fetched aggregates for ${standingsData.length} players via RPC`);

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
