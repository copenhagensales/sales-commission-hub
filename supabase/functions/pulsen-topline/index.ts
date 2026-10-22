// Pulsen trin 7: toplinje. Returnerer kun aggregerede salgstal pr. Stork-team (ingen persondata).
// Tælling = pulsen_topline() = samme som kpi sales_count / get_sales_aggregates_v2 (klientens team).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Ikke logget ind" }, 401);
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u, error: uErr } = await userClient.auth.getUser();
    if (uErr || !u.user) return json({ error: "Ugyldig session" }, 401);
    const { data: emp } = await userClient.rpc("effective_employee_id");
    if (!emp) return json({ error: "Ingen medarbejder" }, 403);

    const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await service.rpc("pulsen_topline");
    if (error) throw error;
    const rows = (data ?? []) as { team_id: string | null; team_name: string | null; today: number; last_week_same_time: number; yesterday: number; last_30d: number }[];
    const sum = (k: "today" | "last_week_same_time" | "yesterday") => rows.reduce((a, r) => a + Number(r[k] ?? 0), 0);
    const teams = rows
      .filter((r) => r.team_id && Number(r.last_30d) > 0)
      .map((r) => ({ id: r.team_id, name: r.team_name, today: Number(r.today ?? 0), lastWeek: Number(r.last_week_same_time ?? 0), yesterday: Number(r.yesterday ?? 0) }))
      .sort((a, b) => b.today - a.today);
    return json({
      house: { today: sum("today"), lastWeek: sum("last_week_same_time"), yesterday: sum("yesterday") },
      teams,
      computedAt: new Date().toISOString(),
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
