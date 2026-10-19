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

async function main(req: Request) {
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
    return await main(req);
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "Ukendt fejl" });
  }
});
