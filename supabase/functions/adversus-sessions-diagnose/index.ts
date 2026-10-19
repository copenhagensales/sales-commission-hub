// READ-ONLY diagnose af Adversus sessions-historik (main-konto) for Tryg-kampagner.
// Returnerer KUN aggregerede tal. Ingen lead-id'er, numre, navne eller noter
// gemmes, logges eller returneres. Intet skrives til databasen.
import { requireCronOrOwner, sharedCorsHeaders } from "../_shared/auth.ts";

const BASE = "https://api.adversus.io/v1";
const OUR_DOMAIN = "@copenhagensales.dk";
const CLOSED = new Set(["success", "notInterested", "unqualified", "invalid"]);
const DEFAULT_WEEKS = ["2026-03-02", "2026-09-14", "2026-09-28"];
const PAGE_SIZE = 1000;
const MAX_PAGES = 60;
const LEAD_SAMPLE = 25;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...sharedCorsHeaders, "Content-Type": "application/json" },
  });

type Row = Record<string, unknown>;
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
const inc = (o: Record<string, number>, k: string, n = 1) => { o[k] = (o[k] ?? 0) + n; };

function cphOffsetIso(day: string): string {
  // midnat dansk tid for 'day' som UTC-ISO
  const probe = new Date(`${day}T12:00:00Z`);
  const local = new Date(probe.toLocaleString("en-US", { timeZone: "Europe/Copenhagen" }));
  const offH = Math.round((local.getTime() - probe.getTime()) / 3600000);
  return new Date(Date.parse(`${day}T00:00:00Z`) - offH * 3600000).toISOString();
}
function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// deno-lint-ignore no-explicit-any -- service-klient fra requireCronOrOwner (3rd party)
async function main(req: Request, svc: any) {
  const user = Deno.env.get("ADVERSUS_API_USERNAME");
  const pass = Deno.env.get("ADVERSUS_API_PASSWORD");
  if (!user || !pass) return json(500, { error: "Main-kontoens Adversus-legitimation mangler" });
  const headers = { Authorization: `Basic ${btoa(`${user}:${pass}`)}`, "Content-Type": "application/json" };
  let apiCalls = 0;
  const get = async (path: string): Promise<{ status: number; data: unknown }> => {
    for (let attempt = 0; attempt < 4; attempt++) {
      apiCalls++;
      const res = await fetch(`${BASE}${path}`, { headers });
      if (res.status === 429) { await new Promise((r) => setTimeout(r, 2000 * (attempt + 1))); continue; }
      const text = await res.text();
      let data: unknown = null;
      try { data = JSON.parse(text); } catch { data = null; }
      return { status: res.status, data };
    }
    return { status: 429, data: null };
  };

  const url = new URL(req.url);
  if (url.searchParams.get("mode") === "backfill") {
    // Engangskørsel uge 1–29 2026 (main). Pr. (kampagne, uge): slet main-rækker, indsæt nye.
    // Eneste mode der skriver: weekly_lead_closure_stats, kun aggregerede tal.
    const ALLOWED = ["80333","109837","104520","109839","104835","109840","104837","109841","87918","109838","87912"];
    const MIN_WEEK = "2025-12-29", MAX_WEEK = "2026-07-13";
    const cid = url.searchParams.get("campaign") ?? "";
    const wf = url.searchParams.get("from") ?? "", wt = url.searchParams.get("to") ?? "";
    if (!ALLOWED.includes(cid)) return json(400, { error: "Kampagne uden for omfang" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(wf) || !/^\d{4}-\d{2}-\d{2}$/.test(wt) || wf < MIN_WEEK || wt > MAX_WEEK) return json(400, { error: "Uger uden for omfang" });
    if (new Date(`${wf}T00:00:00Z`).getUTCDay() !== 1) return json(400, { error: "from skal være mandag" });
    const { data: mapRow } = await svc.from("weekly_lead_report_campaign_map").select("report_line").eq("account", "main").eq("adversus_campaign_id", cid).maybeSingle();
    const reportLine = s(mapRow?.report_line);
    const us = await get("/users?pageSize=1000");
    const ua = (Array.isArray(us.data) ? us.data : (us.data as Row)?.users ?? []) as Row[];
    const ours = new Set(ua.filter((u) => s(u.email ?? u.username).toLowerCase().endsWith(OUR_DOMAIN)).map((u) => s(u.id)));
    // Brugere slettet i Adversus findes kun i Storks agentliste og salgsregistret.
    const { data: ag } = await svc.from("agents").select("external_adversus_id, external_dialer_id, email").eq("source", "adversus");
    for (const a of (ag ?? []) as Row[]) {
      if (!s(a.email).toLowerCase().endsWith(OUR_DOMAIN)) continue;
      for (const k of [s(a.external_adversus_id), s(a.external_dialer_id)]) if (k) ours.add(k);
    }
    for (let from = 0; ; from += 1000) {
      const { data: sx, error: se } = await svc.from("sales").select("agent_external_id")
        .eq("integration_type", "adversus").ilike("agent_email", `%${OUR_DOMAIN}`).not("agent_external_id", "is", null)
        .gte("sale_datetime", "2025-06-01").order("id").range(from, from + 999);
      if (se) return json(500, { error: "Kunne ikke læse salgsregistrets agent-id'er" });
      for (const r of (sx ?? []) as Row[]) { const k = s(r.agent_external_id); if (k) ours.add(k); }
      if (!sx || sx.length < 1000) break;
    }
    if (ours.size === 0) return json(500, { error: "Ingen brugere hentet — afbryder" });
    const out: Row[] = [];
    for (let week = wf; week <= wt; week = addDays(week, 7)) {
      const fromIso = cphOffsetIso(week), toIso = cphOffsetIso(addDays(week, 7));
      const all: Row[] = []; const seen = new Set<string>(); let failed: number | null = null;
      for (let page = 1; page <= 200; page++) {
        const filter = { campaignId: { $eq: Number(cid) }, startTime: { $gt: fromIso, $lt: toIso } };
        const r = await get(`/sessions?filters=${encodeURIComponent(JSON.stringify(filter))}&page=${page}&pageSize=${PAGE_SIZE}&sortProperty=startTime&sortDirection=ASC`);
        if (r.status !== 200) { failed = r.status; break; }
        const arr = (Array.isArray(r.data) ? r.data : (r.data as Row)?.sessions ?? []) as Row[];
        for (const x of arr) { const id = s(x.id); if (id && !seen.has(id) && s(x.campaignId) === cid) { seen.add(id); all.push(x); } }
        if (arr.length < PAGE_SIZE) break;
        if (page === 200) failed = -1;
      }
      if (failed !== null) return json(502, { error: `Hentning fejlede uge ${week} (status ${failed}) — intet gemt for denne uge`, færdige: out });
      const latest = new Map<string, Row>();
      for (const x of all) {
        if (!CLOSED.has(s(x.status))) continue;
        const lead = s(x.leadId); if (!lead) continue;
        const t = s(x.endTime) || s(x.startTime); const prev = latest.get(lead);
        if (!prev || t > (s(prev.endTime) || s(prev.startTime))) latest.set(lead, x);
      }
      const counts: Record<string, number> = {}; let andre = 0;
      for (const x of latest.values()) {
        const uid = s(x.userId);
        const ref = !uid || uid === "0" ? "main:system" : ours.has(uid) ? `main:${uid}` : null;
        if (!ref) { andre++; continue; }
        inc(counts, `${ref}|${s(x.status)}`);
      }
      const rows = Object.entries(counts).map(([k, n]) => {
        const [agent_reference, status] = k.split("|");
        return { week_start: week, account: "main", adversus_campaign_id: cid, report_line: reportLine, agent_reference, status, invalid_reason: "", lead_count: n };
      });
      const del = await svc.from("weekly_lead_closure_stats").delete().eq("account", "main").eq("adversus_campaign_id", cid).eq("week_start", week).select("lead_count");
      if (del.error) return json(500, { error: `Sletning fejlede uge ${week}`, færdige: out });
      if (rows.length) {
        const { error } = await svc.rpc("weekly_lead_closure_add", { _rows: rows });
        if (error) return json(500, { error: `Indsættelse fejlede uge ${week}: ${error.message}`, færdige: out });
      }
      const byStatus: Record<string, number> = {};
      for (const [k, n] of Object.entries(counts)) inc(byStatus, k.split("|")[1], n);
      out.push({ uge: week, sessions: all.length, slettedeRækker: (del.data ?? []).length, indsatteRækker: rows.length, prStatus: byStatus, andreBrugere: andre });
    }
    return json(200, { kampagne: cid, egne: ours.size, uger: out, apiKald: apiCalls });
  }
  if (url.searchParams.get("mode") === "probe") {
    const cid = url.searchParams.get("campaign") ?? "80333";
    const out: Row[] = [];
    for (const m of (url.searchParams.get("months") ?? "").split(",").filter((x) => /^\d{4}-\d{2}$/.test(x))) {
      const from = `${m}-01T00:00:00Z`;
      const [y, mo] = m.split("-").map(Number);
      const to = new Date(Date.UTC(y, mo, 1)).toISOString();
      const r = await get(`/sessions?filters=${encodeURIComponent(JSON.stringify({ campaignId: { $eq: Number(cid) }, startTime: { $gt: from, $lt: to } }))}&page=1&pageSize=1&sortProperty=startTime&sortDirection=ASC`);
      const a = (Array.isArray(r.data) ? r.data : (r.data as Row)?.sessions ?? []) as Row[];
      out.push({ måned: m, status: r.status, harData: a.length > 0, førsteDato: a[0] ? s(a[0].startTime).slice(0, 10) : null });
    }
    return json(200, { kampagne: cid, probe: out, apiKald: apiCalls });
  }
  const campaignId = url.searchParams.get("campaign") ?? "80333";
  const weeks = (url.searchParams.get("weeks")?.split(",") ?? DEFAULT_WEEKS).filter((w) => /^\d{4}-\d{2}-\d{2}$/.test(w));

  // Brugerdomæner (kun til klassifikation, intet returneres pr. bruger)
  const users = await get("/users");
  const userArr = (Array.isArray(users.data) ? users.data : (users.data as Row)?.users ?? []) as Row[];
  const ourUser = new Map<string, boolean>();
  for (const u of userArr) ourUser.set(s(u.id), s(u.email).toLowerCase().endsWith(OUR_DOMAIN));

  const fetchSessions = async (fromIso: string, toIso: string, sortDir = "ASC", maxPages = MAX_PAGES) => {
    const all: Row[] = [];
    const seen = new Set<string>();
    let pages = 0, lastPageSize = 0, errorStatus: number | null = null, campaignFilterRespected = true;
    for (let page = 1; page <= maxPages; page++) {
      const filter = { campaignId: { $eq: Number(campaignId) }, startTime: { $gt: fromIso, $lt: toIso } };
      const r = await get(`/sessions?filters=${encodeURIComponent(JSON.stringify(filter))}&page=${page}&pageSize=${PAGE_SIZE}&sortProperty=startTime&sortDirection=${sortDir}`);
      pages++;
      if (r.status !== 200) { errorStatus = r.status; break; }
      const arr = (Array.isArray(r.data) ? r.data : (r.data as Row)?.sessions ?? []) as Row[];
      lastPageSize = arr.length;
      for (const x of arr) {
        const id = s(x.id);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        if (s(x.campaignId) !== campaignId) { campaignFilterRespected = false; continue; }
        all.push(x);
      }
      if (arr.length < PAGE_SIZE) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    return { all, pages, lastPageSize, errorStatus, campaignFilterRespected, hitPageCap: lastPageSize === PAGE_SIZE && pages >= maxPages };
  };

  const results: Row[] = [];
  for (const week of weeks) {
    const fromIso = cphOffsetIso(week);
    const toIso = cphOffsetIso(addDays(week, 7));
    const r = await fetchSessions(fromIso, toIso);
    const byStatus: Record<string, number> = {};
    const latestClosed = new Map<string, Row>();
    for (const x of r.all) {
      inc(byStatus, s(x.status) || "(tom)");
      if (!CLOSED.has(s(x.status))) continue;
      const lead = s(x.leadId);
      if (!lead) continue;
      const t = s(x.endTime) || s(x.startTime);
      const prev = latestClosed.get(lead);
      if (!prev || t > (s(prev.endTime) || s(prev.startTime))) latestClosed.set(lead, x);
    }
    const distinct: Record<string, number> = {};
    const byActor: Record<string, Record<string, number>> = { copenhagensales: {}, andenBruger: {}, udenBruger: {} };
    for (const x of latestClosed.values()) {
      const st = s(x.status);
      inc(distinct, st);
      const uid = s(x.userId);
      const bucket = !uid || uid === "0" ? "udenBruger" : ourUser.get(uid) ? "copenhagensales" : "andenBruger";
      inc(byActor[bucket], st);
    }
    // Stikprøve: findes emnerne stadig? (kun antal returneres)
    const leads = [...latestClosed.keys()].slice(0, LEAD_SAMPLE);
    const leadCheck = { stikprøve: leads.length, findes: 0, findesIkke: 0, andenKampagne: 0, fejl: 0 };
    for (const id of leads) {
      const lr = await get(`/leads/${id}`);
      if (lr.status === 404) { leadCheck.findesIkke++; continue; }
      if (lr.status !== 200) { leadCheck.fejl++; continue; }
      const l = (Array.isArray(lr.data) ? lr.data[0] : (lr.data as Row)?.leads ? ((lr.data as Row).leads as Row[])[0] : lr.data) as Row | undefined;
      if (!l) { leadCheck.findesIkke++; continue; }
      leadCheck.findes++;
      if (s(l.campaignId) && s(l.campaignId) !== campaignId) leadCheck.andenKampagne++;
      await new Promise((res) => setTimeout(res, 150));
    }
    results.push({
      uge: week, fra: fromIso, til: toIso,
      sessionsIAlt: r.all.length, sessionsPrStatus: byStatus,
      distinkteLukkedeEmner: [...latestClosed.values()].length, distinktePrStatus: distinct,
      prUdfører: byActor,
      paginering: { sider: r.pages, sidsteSideStørrelse: r.lastPageSize, ramteSideloft: r.hitPageCap, fejlStatus: r.errorStatus, kampagnefilterRespekteret: r.campaignFilterRespected },
      emneOpslag: leadCheck,
    });
  }

  // Tidligste session for kampagnen
  const earliest = await get(`/sessions?filters=${encodeURIComponent(JSON.stringify({ campaignId: { $eq: Number(campaignId) } }))}&page=1&pageSize=1&sortProperty=startTime&sortDirection=ASC`);
  const eArr = (Array.isArray(earliest.data) ? earliest.data : (earliest.data as Row)?.sessions ?? []) as Row[];
  const earliestDate = eArr[0] ? s(eArr[0].startTime).slice(0, 10) : null;

  return json(200, { kampagne: campaignId, brugereKendt: userArr.length, tidligsteSessionDato: earliestDate, tidligsteStatus: earliest.status, apiKald: apiCalls, uger: results });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: sharedCorsHeaders });
  const auth = await requireCronOrOwner(req);
  if (auth instanceof Response) return auth;
  try {
    return await main(req, auth.svc);
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "Ukendt fejl" });
  }
});
