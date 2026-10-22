// Pulsen milepæle. Læser KUN salg/stamdata (via pulsen_milestone_candidates_v2) og skriver KUN til pulsen_milestones.
// dry_run=true (standard) skriver intet. Skrivning kun via cron-token og kun for milepæle med
// occurred_at >= pulsen_config.milestones_active_from (ingen bagudposting).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type Cand = {
  milestone_type: string; employee_id: string | null; team_id: string | null; period_key: string;
  level: number; value: number | null; previous: number | null; occurred_on: string; occurred_at: string | null; tier: number;
};
type Out = Cand & { shown_in_house: boolean; rarity: number; text: string };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const kr = (n: number | null) => `${Math.round(Number(n ?? 0)).toLocaleString("da-DK")} kr`;
const HERO = new Set(["house_record", "team_record"]);

// Normaliser til de nøgler, rarity_order kender.
export function rarityKey(c: Pick<Cand, "milestone_type" | "level" | "tier">) {
  if (c.milestone_type === "team_day_sales") return `team_step_${c.tier}`;
  if (c.milestone_type === "club") return `club_${c.level}`;
  return c.milestone_type;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const cronToken = Deno.env.get("PULSEN_CRON_TOKEN");
    const isCron = !!cronToken && req.headers.get("x-pulsen-cron-token") === cronToken;
    if (!isCron) {
      const auth = req.headers.get("Authorization") ?? "";
      if (!auth.startsWith("Bearer ")) return json({ error: "Ikke logget ind" }, 401);
      const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
      const { data: u, error: uErr } = await userClient.auth.getUser();
      if (uErr || !u.user) return json({ error: "Ugyldig session" }, 401);
      const { data: owner, error: oErr } = await userClient.rpc("effective_is_owner");
      if (oErr || owner !== true) return json({ error: "Kun ejer" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dry_run !== false;
    const days = Number.isInteger(body?.days) && body.days > 0 && body.days <= 31 ? body.days : 2;
    if (!dryRun && !isCron) return json({ error: "Skrivning kun via cron" }, 403);

    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Copenhagen" }));
    const to = typeof body?.to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.to) ? body.to : iso(today);
    const toD = new Date(`${to}T12:00:00`);
    const fromD = new Date(toD); fromD.setDate(fromD.getDate() - (days - 1));
    const from = iso(fromD);

    const { data: cfgRows, error: cfgErr } = await service.from("pulsen_config").select("key, value");
    if (cfgErr) throw cfgErr;
    const cfg = Object.fromEntries((cfgRows ?? []).map((r) => [r.key, r.value]));
    const order: string[] = cfg.rarity_order ?? [];
    const houseMax = Number(cfg.house_daily_max ?? 10);
    const teamMax = Number(cfg.team_daily_max ?? 25);
    const perPerson = Number(cfg.house_per_person_max ?? 1);
    const activeFrom = typeof cfg.milestones_active_from === "string" ? cfg.milestones_active_from : null;
    if (!dryRun && !activeFrom) return json({ error: "milestones_active_from mangler" }, 409);

    // Én type pr. kald for at holde hvert kald under statement-timeout.
    const TYPES = ["first_sale", "record_day", "record_period", "club", "streak", "team_day_sales", "team_record", "house_record"];
    const cands: Cand[] = [];
    const timings: Record<string, number> = {};
    for (const t of TYPES) {
      const t0 = Date.now();
      const { data, error } = await service.rpc("pulsen_milestone_candidates_v2", { p_from: from, p_to: to, p_types: [t] });
      timings[t] = Date.now() - t0;
      if (error) throw new Error(`${t}: ${error.message}`);
      cands.push(...((data ?? []) as Cand[]));
    }

    let list = cands.filter((c) => c.occurred_at);
    // Teamtrin: kun højeste trin pr. team pr. dag
    const topTeam = new Map<string, number>();
    for (const c of list) if (c.milestone_type === "team_day_sales") {
      const k = `${c.team_id}|${c.period_key}`; topTeam.set(k, Math.max(topTeam.get(k) ?? 0, c.level));
    }
    list = list.filter((c) => c.milestone_type !== "team_day_sales" || topTeam.get(`${c.team_id}|${c.period_key}`) === c.level);
    if (!dryRun) list = list.filter((c) => new Date(c.occurred_at!).getTime() >= new Date(activeFrom!).getTime());

    const empIds = [...new Set(list.map((c) => c.employee_id).filter(Boolean))] as string[];
    const teamIds = [...new Set(list.map((c) => c.team_id).filter(Boolean))] as string[];
    const [emps, teams] = await Promise.all([
      empIds.length ? service.from("employee_master_data").select("id, first_name, last_name").in("id", empIds) : Promise.resolve({ data: [] as { id: string; first_name: string | null; last_name: string | null }[] }),
      teamIds.length ? service.from("teams").select("id, name").in("id", teamIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);
    const empName = new Map((emps.data ?? []).map((e) => [e.id, `${e.first_name ?? ""} ${(e.last_name ?? "").charAt(0)}.`.trim()]));
    const teamName = new Map((teams.data ?? []).map((t) => [t.id, t.name]));

    // {dag} erstattes ved visning: "i dag" samme dag, ellers "torsdag 22/10".
    const text = (c: Cand) => {
      const n = empName.get(c.employee_id ?? "") ?? "Kollega";
      const tn = teamName.get(c.team_id ?? "") ?? "Teamet";
      switch (c.milestone_type) {
        case "first_sale": return `**${n}** lavede sit første salg {dag}`;
        case "record_day": return `**${n}** slog sin dagsrekord {dag}: **${kr(c.value)}** (før ${kr(c.previous)})`;
        case "record_week": return `**${n}** slog sin ugerekord: **${kr(c.value)}** (før ${kr(c.previous)})`;
        case "record_pay_period": return `**${n}** slog sin rekord for en lønperiode: **${kr(c.value)}** (før ${kr(c.previous)})`;
        case "club": return `**${n}** nåede Klub ${c.level / 1000} – **${kr(c.value)}** i provision denne lønperiode`;
        case "streak": return `**${n}** har solgt **${c.level} dage i træk**`;
        case "team_day_sales": return `**${tn}** rundede **${c.level} salg** {dag}`;
        case "team_record": return `**${tn}** satte teamrekord {dag}: **${c.value} salg** (før ${c.previous})`;
        case "house_record": return `Husrekord {dag}: **${c.value} salg** (før ${c.previous})`;
        default: return c.milestone_type;
      }
    };

    // Eksisterende rækker i perioden tæller med i grænserne (ved gentagne kørsler bevares udvælgelsen).
    const { data: existing, error: exErr } = await service.from("pulsen_milestones")
      .select("milestone_type, subject_id, period_key, level, employee_id, team_id, shown_in_house, occurred_at")
      .gte("occurred_at", `${from}T00:00:00+00:00`);
    if (exErr) throw exErr;
    const dk = (ts: string) => new Date(ts).toLocaleDateString("sv-SE", { timeZone: "Europe/Copenhagen" });
    const keyOf = (c: { milestone_type: string; period_key: string; level: number }, subject: string) => `${c.milestone_type}|${subject}|${c.period_key}|${c.level}`;
    const SENT = "00000000-0000-0000-0000-000000000000";
    const existingKeys = new Set((dryRun ? [] : existing ?? []).map((e) => keyOf(e, e.subject_id)));

    const rank = (c: Cand) => { const i = order.indexOf(rarityKey(c)); return i < 0 ? 99 : i; };
    const byDay = new Map<string, Cand[]>();
    for (const c of list) { const d = dk(c.occurred_at!); (byDay.get(d) ?? byDay.set(d, []).get(d)!).push(c); }
    const out: Out[] = [];
    for (const [day, dayList] of byDay) {
      dayList.sort((a, b) => rank(a) - rank(b) || Number(b.value ?? 0) - Number(a.value ?? 0));
      const perEmp = new Map<string, number>(); const perTeam = new Map<string, number>(); let house = 0;
      for (const e of dryRun ? [] : existing ?? []) {
        if (dk(e.occurred_at) !== day) continue;
        const tk = e.team_id ?? "none"; perTeam.set(tk, (perTeam.get(tk) ?? 0) + 1);
        if (e.shown_in_house) { house++; const ek = e.employee_id ?? `team:${e.team_id}`; perEmp.set(ek, (perEmp.get(ek) ?? 0) + 1); }
      }
      for (const c of dayList) {
        const subject = c.employee_id ?? c.team_id ?? SENT;
        if (existingKeys.has(keyOf(c, subject))) { out.push({ ...c, shown_in_house: false, rarity: 99 - rank(c), text: text(c), _existing: true } as Out); continue; }
        const tk = c.team_id ?? (c.employee_id ? `emp:${c.employee_id}` : "none");
        if (c.team_id && (perTeam.get(tk) ?? 0) >= teamMax && !HERO.has(c.milestone_type)) continue;
        perTeam.set(tk, (perTeam.get(tk) ?? 0) + 1);
        const ek = c.employee_id ?? `team:${c.team_id}`;
        const okHouse = house < houseMax && (perEmp.get(ek) ?? 0) < perPerson;
        if (okHouse) { house++; perEmp.set(ek, (perEmp.get(ek) ?? 0) + 1); }
        out.push({ ...c, shown_in_house: okHouse, rarity: 99 - rank(c), text: text(c) });
      }
    }

    if (dryRun) {
      const perDay: Record<string, { total: number; house: number; team: number; hero: number; types: Record<string, number> }> = {};
      for (const c of out) {
        const d = dk(c.occurred_at!);
        const s = (perDay[d] ??= { total: 0, house: 0, team: 0, hero: 0, types: {} });
        s.total++; c.shown_in_house ? s.house++ : s.team++;
        if (HERO.has(c.milestone_type)) s.hero++;
        s.types[rarityKey(c)] = (s.types[rarityKey(c)] ?? 0) + 1;
      }
      return json({
        dry_run: true, from, to, candidates: out.length, timings_ms: timings, per_day: perDay,
        examples: out.slice(0, 40).map((c) => ({ type: rarityKey(c), day: dk(c.occurred_at!), house: c.shown_in_house, text: c.text })),
        items: body?.include_items ? out : undefined,
      });
    }

    const rows = out.filter((c) => !(c as Out & { _existing?: boolean })._existing).map((c) => ({
      milestone_type: c.milestone_type, employee_id: c.employee_id, team_id: c.team_id, period_key: c.period_key,
      level: c.level, value: c.value ?? 0, previous: undefined, rarity: c.rarity, shown_in_house: c.shown_in_house,
      occurred_at: c.occurred_at,
      payload: { text: c.text, previous: c.previous, day: dk(c.occurred_at!), tier: c.tier },
    }));
    let written = 0;
    if (rows.length) {
      const { data, error } = await service.rpc("pulsen_upsert_milestones", { p_rows: rows });
      if (error) throw error;
      written = Number(data ?? 0);
    }
    return json({ dry_run: false, from, to, written, timings_ms: timings });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : (e as { message?: string })?.message ?? JSON.stringify(e) }, 500);
  }
});
