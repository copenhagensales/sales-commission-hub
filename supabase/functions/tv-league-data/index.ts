import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// In-memory cache (30s TTL)
const CACHE_TTL_MS = 30_000;
let cached: { data: any; ts: number } | null = null;

function formatName(first: string | null, last: string | null): string {
  const f = first || "";
  const l = last || "";
  if (!f && !l) return "Ukendt";
  if (!l) return f;
  return `${f} ${l.charAt(0).toUpperCase()}.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Return cache if fresh
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return new Response(JSON.stringify(cached.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Find active season
    const { data: season } = await supabase
      .from("league_seasons")
      .select("id, status, config, qualification_source_start, qualification_source_end")
      .in("status", ["qualification", "active"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!season) {
      const empty = { top3: [], divisions: [], movements: [], topLastHour: [], recentEarners: [], records: { highestProvision: 0, highestProvisionName: "", divisionAverages: [] } };
      cached = { data: empty, ts: Date.now() };
      return new Response(JSON.stringify(empty), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const playersPerDivision = season.config?.players_per_division || 14;

    // 2. Fetch all standings with employee info
    const { data: standings } = await supabase
      .from("league_qualification_standings")
      .select("employee_id, overall_rank, previous_overall_rank, projected_division, projected_rank, current_provision, deals_count")
      .eq("season_id", season.id)
      .order("overall_rank", { ascending: true });

    if (!standings || standings.length === 0) {
      const empty = { top3: [], divisions: [], movements: [], topLastHour: [], recentEarners: [], records: { highestProvision: 0, highestProvisionName: "", divisionAverages: [] } };
      cached = { data: empty, ts: Date.now() };
      return new Response(JSON.stringify(empty), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const employeeIds = standings.map((s) => s.employee_id);

    // 3. Fetch employee names + team info
    const { data: employees } = await supabase
      .from("employee_master_data")
      .select("id, first_name, last_name, team_id")
      .in("id", employeeIds);

    const empMap = new Map(
      (employees || []).map((e) => [e.id, e])
    );

    // 4. Fetch team names
    const teamIds = [...new Set((employees || []).map((e) => e.team_id).filter(Boolean))];
    const { data: teams } = teamIds.length > 0
      ? await supabase.from("teams").select("id, name").in("id", teamIds)
      : { data: [] };
    const teamMap = new Map((teams || []).map((t) => [t.id, t.name]));

    // Build enriched standings
    const enriched = standings.map((s) => {
      const emp = empMap.get(s.employee_id);
      return {
        ...s,
        name: emp ? formatName(emp.first_name, emp.last_name) : "Ukendt",
        teamName: emp?.team_id ? teamMap.get(emp.team_id) || "" : "",
      };
    });

    // === TOP 3 ===
    const top3 = enriched.slice(0, 3).map((s) => ({
      rank: s.overall_rank,
      name: s.name,
      provision: s.current_provision || 0,
      division: s.projected_division,
      teamName: s.teamName,
      employeeId: s.employee_id,
    }));

    // === DIVISIONS (top 5 per division) ===
    const divisionMap = new Map<number, typeof enriched>();
    for (const s of enriched) {
      if (!divisionMap.has(s.projected_division)) {
        divisionMap.set(s.projected_division, []);
      }
      divisionMap.get(s.projected_division)!.push(s);
    }

    const divisions = Array.from(divisionMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([divNum, players]) => {
        const sorted = players.sort(
          (a, b) => (a.projected_rank || 0) - (b.projected_rank || 0)
        );
        return {
          division: divNum,
          totalPlayers: sorted.length,
          players: sorted.slice(0, 5).map((p) => ({
            rank: p.projected_rank,
            name: p.name,
            provision: p.current_provision || 0,
            deals: p.deals_count || 0,
            zone:
              p.projected_rank <= 2
                ? "promotion"
                : p.projected_rank >= playersPerDivision - 1
                ? "relegation"
                : "safe",
          })),
        };
      });

    // === MOVEMENTS (biggest rank changes) ===
    const movers = enriched
      .filter(
        (s) =>
          s.previous_overall_rank != null &&
          s.previous_overall_rank !== s.overall_rank
      )
      .map((s) => ({
        name: s.name,
        division: s.projected_division,
        previousRank: s.previous_overall_rank!,
        currentRank: s.overall_rank,
        change: s.previous_overall_rank! - s.overall_rank,
        provision: s.current_provision || 0,
      }))
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

    const movements = {
      risers: movers.filter((m) => m.change > 0).slice(0, 5),
      fallers: movers.filter((m) => m.change < 0).slice(0, 5),
    };

    // === TOP LAST HOUR ===
    // Use get_sales_aggregates_v2 for last 60 minutes, grouped by employee
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const { data: hourlyData } = await supabase.rpc("get_sales_aggregates_v2", {
      p_start: oneHourAgo.toISOString(),
      p_end: now.toISOString(),
      p_group_by: "employee",
    });

    // Filter to only enrolled players and sort by commission
    const enrolledSet = new Set(employeeIds);
    const topLastHour = (hourlyData || [])
      .filter((r: any) => enrolledSet.has(r.group_key))
      .sort((a: any, b: any) => (b.total_commission || 0) - (a.total_commission || 0))
      .slice(0, 3)
      .map((r: any) => {
        const emp = empMap.get(r.group_key);
        return {
          name: emp ? formatName(emp.first_name, emp.last_name) : r.group_name || "Ukendt",
          provision: r.total_commission || 0,
          sales: Number(r.total_sales) || 0,
        };
      });

    // === RECENT EARNERS (300+ kr in last 15 min) ===
    const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000);
    const { data: recentData } = await supabase.rpc("get_sales_aggregates_v2", {
      p_start: fifteenMinAgo.toISOString(),
      p_end: now.toISOString(),
      p_group_by: "employee",
    });

    const recentEarners = (recentData || [])
      .filter((r: any) => enrolledSet.has(r.group_key) && (r.total_commission || 0) > 300)
      .sort((a: any, b: any) => (b.total_commission || 0) - (a.total_commission || 0))
      .map((r: any) => {
        const emp = empMap.get(r.group_key);
        return {
          name: emp ? formatName(emp.first_name, emp.last_name) : r.group_name || "Ukendt",
          provision: r.total_commission || 0,
        };
      });

    // === RECORDS ===
    const highestEntry = enriched.reduce(
      (best, s) =>
        (s.current_provision || 0) > (best.current_provision || 0) ? s : best,
      enriched[0]
    );

    const divisionAverages = Array.from(divisionMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([divNum, players]) => ({
        division: divNum,
        average:
          players.reduce((sum, p) => sum + (p.current_provision || 0), 0) /
          (players.length || 1),
        playerCount: players.length,
      }));

    const records = {
      highestProvision: highestEntry?.current_provision || 0,
      highestProvisionName: highestEntry?.name || "",
      divisionAverages,
    };

    const payload = {
      seasonId: season.id,
      seasonStatus: season.status,
      totalPlayers: standings.length,
      totalDivisions: divisionMap.size,
      top3,
      divisions,
      movements,
      topLastHour,
      recentEarners,
      records,
      updatedAt: now.toISOString(),
    };

    cached = { data: payload, ts: Date.now() };

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[tv-league-data] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
