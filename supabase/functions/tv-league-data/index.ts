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
      .select("id, status, config, qualification_source_start, qualification_source_end, start_date")
      .in("status", ["qualification", "active"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!season) {
      const empty = { top3: [], divisions: [], movements: [], topLastHour: [], recentEarners: [], records: { highestProvision: 0, highestProvisionName: "", divisionAverages: [] }, prizeLeaders: null, seasonStatus: "none" };
      cached = { data: empty, ts: Date.now() };
      return new Response(JSON.stringify(empty), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isActive = season.status === "active";
    const playersPerDivision = season.config?.players_per_division || 14;

    // 2. Fetch qualification standings (always needed for divisions/movements)
    const { data: standings } = await supabase
      .from("league_qualification_standings")
      .select("employee_id, overall_rank, previous_overall_rank, projected_division, projected_rank, current_provision, deals_count")
      .eq("season_id", season.id)
      .order("overall_rank", { ascending: true });

    if (!standings || standings.length === 0) {
      const empty = { top3: [], divisions: [], movements: [], topLastHour: [], recentEarners: [], records: { highestProvision: 0, highestProvisionName: "", divisionAverages: [] }, prizeLeaders: null, seasonStatus: season.status };
      cached = { data: empty, ts: Date.now() };
      return new Response(JSON.stringify(empty), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const employeeIds = standings.map((s) => s.employee_id);

    // 3. Fetch employee names + team info
    const { data: employees } = await supabase
      .from("employee_master_data")
      .select("id, first_name, last_name, team_id, employment_start_date")
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

    // === TOP 3 (season-aware) ===
    let top3: any[];
    if (isActive) {
      // Fetch from league_season_standings sorted by total_points
      const { data: seasonStandings } = await supabase
        .from("league_season_standings")
        .select("employee_id, total_points, current_division, overall_rank")
        .eq("season_id", season.id)
        .order("overall_rank", { ascending: true })
        .limit(3);

      top3 = (seasonStandings || []).map((s, i) => {
        const emp = empMap.get(s.employee_id);
        return {
          rank: i + 1,
          name: emp ? formatName(emp.first_name, emp.last_name) : "Ukendt",
          provision: s.total_points || 0,
          division: s.current_division,
          teamName: emp?.team_id ? teamMap.get(emp.team_id) || "" : "",
          employeeId: s.employee_id,
        };
      });
    } else {
      // Qualification: top 3 by current_provision
      top3 = enriched.slice(0, 3).map((s) => ({
        rank: s.overall_rank,
        name: s.name,
        provision: s.current_provision || 0,
        division: s.projected_division,
        teamName: s.teamName,
        employeeId: s.employee_id,
      }));
    }

    // === DIVISIONS (top 5 per division) ===
    const divisionMap = new Map<number, typeof enriched>();
    for (const s of enriched) {
      if (!divisionMap.has(s.projected_division)) {
        divisionMap.set(s.projected_division, []);
      }
      divisionMap.get(s.projected_division)!.push(s);
    }

    const totalDivisionsCount = divisionMap.size;
    const divisions = Array.from(divisionMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([divNum, players]) => {
        const sorted = players.sort(
          (a, b) => (a.projected_rank || 0) - (b.projected_rank || 0)
        );
        const isTopDivision = divNum === 1;
        const isBottomDivision = divNum === totalDivisionsCount;
        return {
          division: divNum,
          totalPlayers: sorted.length,
          players: sorted.map((p) => {
            const rank = p.projected_rank;
            let zone = "safe";
            if (rank <= 3) {
              zone = isTopDivision ? "top" : "promotion";
            } else if (rank <= 5 && !isTopDivision) {
              zone = "playoff";
            } else if (rank >= playersPerDivision - 3 && rank <= playersPerDivision - 2) {
              zone = "playoff";
            } else if (rank >= playersPerDivision - 1 && !isBottomDivision) {
              zone = "relegation";
            }
            return {
              rank,
              name: p.name,
              provision: p.current_provision || 0,
              deals: p.deals_count || 0,
              rankChange: p.previous_overall_rank != null ? p.previous_overall_rank - p.overall_rank : 0,
              zone,
            };
          }),
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
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const { data: hourlyData } = await supabase.rpc("get_sales_aggregates_v2", {
      p_start: oneHourAgo.toISOString(),
      p_end: now.toISOString(),
      p_group_by: "employee",
    });

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

    // === PRIZE LEADERS (qualification + active) ===
    let prizeLeaders: any = null;

    if (isActive) {
      // Best Round: top player by points_earned across all rounds
      const { data: bestRoundData } = await supabase
        .from("league_round_standings")
        .select("employee_id, points_earned, round_id")
        .eq("season_id", season.id)
        .order("points_earned", { ascending: false })
        .limit(1)
        .maybeSingle();

      let bestRound: any = null;
      if (bestRoundData) {
        const emp = empMap.get(bestRoundData.employee_id);
        const { data: roundInfo } = await supabase
          .from("league_rounds")
          .select("round_number")
          .eq("id", bestRoundData.round_id)
          .maybeSingle();
        bestRound = {
          name: emp ? formatName(emp.first_name, emp.last_name) : "Ukendt",
          employeeId: bestRoundData.employee_id,
          points: bestRoundData.points_earned,
          label: roundInfo ? `${Math.round(bestRoundData.points_earned)} pt i runde ${roundInfo.round_number}` : `${Math.round(bestRoundData.points_earned)} pt`,
        };
      }

      // Talent: employee with employment_start_date < 90 days before season start, with highest total_points
      let talent: any = null;
      const seasonStartDate = season.start_date;
      if (seasonStartDate) {
        const seasonStart = new Date(seasonStartDate);
        const talentCutoff = new Date(seasonStart.getTime() - 90 * 24 * 60 * 60 * 1000);

        const { data: seasonStandingsAll } = await supabase
          .from("league_season_standings")
          .select("employee_id, total_points, overall_rank")
          .eq("season_id", season.id)
          .gt("total_points", 0)
          .order("total_points", { ascending: false });

        if (seasonStandingsAll) {
          for (const ss of seasonStandingsAll) {
            const emp = empMap.get(ss.employee_id);
            if (emp?.employment_start_date) {
              const startDate = new Date(emp.employment_start_date);
              if (startDate > talentCutoff) {
                talent = {
                  name: formatName(emp.first_name, emp.last_name),
                  employeeId: ss.employee_id,
                  points: ss.total_points,
                  label: `${Math.round(ss.total_points)} pt · #${ss.overall_rank}`,
                };
                break;
              }
            }
          }
        }
      }

      // Comeback: biggest improvement from round 1 rank to current overall_rank
      let comeback: any = null;
      const { data: round1 } = await supabase
        .from("league_rounds")
        .select("id")
        .eq("season_id", season.id)
        .eq("round_number", 1)
        .maybeSingle();

      if (round1) {
        const { data: round1Standings } = await supabase
          .from("league_round_standings")
          .select("employee_id, rank_in_division, division")
          .eq("round_id", round1.id);

        const { data: currentSeasonStandings } = await supabase
          .from("league_season_standings")
          .select("employee_id, overall_rank")
          .eq("season_id", season.id);

        if (round1Standings && currentSeasonStandings) {
          const r1Map = new Map(
            round1Standings.map((r) => [r.employee_id, (r.division - 1) * playersPerDivision + r.rank_in_division])
          );
          const currentMap = new Map(
            currentSeasonStandings.map((r) => [r.employee_id, r.overall_rank])
          );

          let bestImprovement = 0;
          let bestEmployee: any = null;

          for (const [empId, r1Rank] of r1Map) {
            const currentRank = currentMap.get(empId);
            if (currentRank != null) {
              const improvement = r1Rank - currentRank;
              if (improvement > bestImprovement) {
                bestImprovement = improvement;
                bestEmployee = empId;
              }
            }
          }

          if (bestEmployee && bestImprovement > 0) {
            const emp = empMap.get(bestEmployee);
            comeback = {
              name: emp ? formatName(emp.first_name, emp.last_name) : "Ukendt",
              employeeId: bestEmployee,
              improvement: bestImprovement,
              label: `+${bestImprovement} pladser`,
            };
          }
        }
      }

      prizeLeaders = { bestRound, talent, comeback };
    } else {
      // Qualification: use provision-based data
      // Best Round (kval) = highest current_provision
      let bestRound: any = null;
      if (enriched.length > 0) {
        const topProvider = enriched.reduce((best, s) =>
          (s.current_provision || 0) > (best.current_provision || 0) ? s : best,
          enriched[0]
        );
        if ((topProvider.current_provision || 0) > 0) {
          bestRound = {
            name: topProvider.name,
            employeeId: topProvider.employee_id,
            points: topProvider.current_provision,
            label: `${Math.round(topProvider.current_provision).toLocaleString("da-DK")} kr`,
          };
        }
      }

      // Comeback (kval) = biggest rank improvement
      let comeback: any = null;
      const bestMover = enriched
        .filter((s) => s.previous_overall_rank != null && s.previous_overall_rank > s.overall_rank)
        .sort((a, b) => (b.previous_overall_rank! - b.overall_rank) - (a.previous_overall_rank! - a.overall_rank))[0];
      if (bestMover) {
        const improvement = bestMover.previous_overall_rank! - bestMover.overall_rank;
        comeback = {
          name: bestMover.name,
          employeeId: bestMover.employee_id,
          improvement,
          label: `+${improvement} pladser`,
        };
      }

      prizeLeaders = { bestRound, talent: null, comeback };
    }

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
      prizeLeaders,
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
