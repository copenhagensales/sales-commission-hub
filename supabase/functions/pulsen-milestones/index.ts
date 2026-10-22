// Pulsen trin 6: milepæle. Læser KUN salg/stamdata (via pulsen_milestone_candidates) og skriver KUN til pulsen_milestones.
// Tør-tilstand (dry_run=true, standard) skriver intet og returnerer en rapport. Kun ejer eller cron-token.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type Cand = {
  milestone_type: string; employee_id: string | null; team_id: string | null; period_key: string;
  level: number; value: number | null; previous: number | null; occurred_on: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const kr = (n: number | null) => `${Math.round(Number(n ?? 0)).toLocaleString("da-DK")} kr`;

// Normaliser til de typer, rarity_order kender.
function rarityKey(c: Cand) {
  if (c.milestone_type === "team_day_sales") return c.level >= 100 ? "team_day_sales_100plus" : "team_day_sales_50";
  return c.milestone_type;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Adgang: cron-token eller indlogget ejer
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
    const dryRun = body?.dry_run !== false; // standard: tør
    const days = Number.isInteger(body?.days) && body.days > 0 && body.days <= 31 ? body.days : 1;
    if (!dryRun && !isCron) return json({ error: "Skrivning kun via cron" }, 403);

    const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Copenhagen" }));
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const to = iso(today);
    const fromD = new Date(today); fromD.setDate(fromD.getDate() - (days - 1));
    const from = iso(fromD);

    // Én type pr. kald (sekventielt) for at holde hvert kald under databasens statement-timeout.
    const TYPES = ["first_sale", "record_day", "record_period", "club", "streak", "team_day_sales", "house_record"];
    const cands: Cand[] = [];
    const timings: Record<string, number> = {};
    for (const t of TYPES) {
      const t0 = Date.now();
      const { data, error } = await service.rpc("pulsen_milestone_candidates", { p_from: from, p_to: to, p_types: [t] });
      timings[t] = Date.now() - t0;
      if (error) throw new Error(`${t}: ${error.message}`);
      cands.push(...((data ?? []) as Cand[]));
    }
    const { data: cfgRows, error: cfgErr } = await service.from("pulsen_config").select("key, value");
    if (cfgErr) throw cfgErr;
    const cfg = Object.fromEntries((cfgRows ?? []).map((r) => [r.key, r.value]));
    const order: string[] = cfg.rarity_order ?? [];
    const houseMax = Number(cfg.house_daily_max ?? 10);
    const teamMax = Number(cfg.team_daily_max ?? 25);
    const perPerson = Number(cfg.house_per_person_max ?? 1);

    let list = (cands ?? []) as Cand[];
    // Teamfejring: kun højeste niveau pr. team pr. dag
    const topTeam = new Map<string, number>();
    for (const c of list) if (c.milestone_type === "team_day_sales") {
      const k = `${c.team_id}|${c.period_key}`; topTeam.set(k, Math.max(topTeam.get(k) ?? 0, c.level));
    }
    list = list.filter((c) => c.milestone_type !== "team_day_sales" || topTeam.get(`${c.team_id}|${c.period_key}`) === c.level);

    // Navne
    const empIds = [...new Set(list.map((c) => c.employee_id).filter(Boolean))] as string[];
    const teamIds = [...new Set(list.map((c) => c.team_id).filter(Boolean))] as string[];
    const [emps, teams] = await Promise.all([
      empIds.length ? service.from("employee_master_data").select("id, first_name, last_name, job_title").in("id", empIds) : { data: [] },
      teamIds.length ? service.from("teams").select("id, name").in("id", teamIds) : { data: [] },
    ]);
    const empName = new Map((emps.data ?? []).map((e: any) => [e.id, `${e.first_name ?? ""} ${(e.last_name ?? "").charAt(0)}.`.trim()]));
    const teamName = new Map((teams.data ?? []).map((t: any) => [t.id, t.name]));

    const text = (c: Cand) => {
      const n = empName.get(c.employee_id ?? "") ?? "Kollega";
      switch (c.milestone_type) {
        case "first_sale": return `**${n}** har lavet sit første salg`;
        case "record_day": return `**${n}** slog sin dagsrekord: **${kr(c.value)}** (før ${kr(c.previous)})`;
        case "record_week": return `**${n}** slog sin ugerekord: **${kr(c.value)}** (før ${kr(c.previous)})`;
        case "record_pay_period": return `**${n}** slog sin rekord for en lønperiode: **${kr(c.value)}** (før ${kr(c.previous)})`;
        case "club": return `**${n}** nåede Klub ${c.level / 1000} – **${kr(c.level)}** i provision denne lønperiode`;
        case "streak": return `**${n}** har solgt **${c.level} dage i træk**`;
        case "team_day_sales": return `**${teamName.get(c.team_id ?? "") ?? "Teamet"}** har rundet **${c.level} salg** i dag`;
        case "house_record": return `Husrekord: **${c.value} salg** på én dag (før ${c.previous})`;
        default: return c.milestone_type;
      }
    };

    // Huset-udvælgelse pr. dag: sjældenhed, maks. 1 pr. person, maks. house_daily_max; team-loft team_daily_max
    const rank = (c: Cand) => { const i = order.indexOf(rarityKey(c)); return i < 0 ? 99 : i; };
    const byDay = new Map<string, Cand[]>();
    for (const c of list) (byDay.get(c.occurred_on) ?? byDay.set(c.occurred_on, []).get(c.occurred_on)!).push(c);
    const out: (Cand & { shown_in_house: boolean; rarity: number; text: string })[] = [];
    for (const [, dayList] of byDay) {
      dayList.sort((a, b) => rank(a) - rank(b) || Number(b.value ?? 0) - Number(a.value ?? 0));
      const perEmp = new Map<string, number>(); const perTeam = new Map<string, number>(); let house = 0;
      for (const c of dayList) {
        const tk = c.team_id ?? "none";
        if ((perTeam.get(tk) ?? 0) >= teamMax && c.milestone_type !== "house_record") continue;
        perTeam.set(tk, (perTeam.get(tk) ?? 0) + 1);
        const ek = c.employee_id ?? `team:${c.team_id}`;
        const okHouse = house < houseMax && (perEmp.get(ek) ?? 0) < perPerson;
        if (okHouse) { house++; perEmp.set(ek, (perEmp.get(ek) ?? 0) + 1); }
        out.push({ ...c, shown_in_house: okHouse, rarity: 99 - rank(c), text: text(c) });
      }
    }

    if (dryRun) {
      const perTypeDay: Record<string, Record<string, { total: number; house: number; team: number }>> = {};
      for (const c of out) {
        const t = rarityKey(c);
        const slot = ((perTypeDay[c.occurred_on] ??= {})[t] ??= { total: 0, house: 0, team: 0 });
        slot.total++; c.shown_in_house ? slot.house++ : slot.team++;
      }
      return json({
        dry_run: true, from, to, candidates: out.length, timings_ms: timings,
        per_day_type: perTypeDay,
        examples: out.slice(0, 40).map((c) => ({ type: c.milestone_type, day: c.occurred_on, house: c.shown_in_house, text: c.text })),
        // Kun til visning i lokal test; ingen skrivning
        items: body?.include_items ? out : undefined,
      });
    }

    // Skrivning er ikke aktiveret endnu (afventer godkendelse af tør-kørslen og cron).
    // Ved aktivering: upsert via RPC, fordi den unikke nøgle er et udtryksindeks.
    return json({ error: "Skrivning er ikke aktiveret" }, 409);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : (e as { message?: string })?.message ?? JSON.stringify(e) }, 500);
  }
});
