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

  // MIDLERTIDIG read-only: tæl dagens salg på en anden Adversus-konto (fx Eesy TM). Kun antal.
  // MIDLERTIDIG read-only (Kasper 26/10): opkaldsadgang og kontaktrate på en anden Adversus-konto. Kun aggregater, intet gemmes.
  if (url.searchParams.get("mode") === "accountcalls") {
    const integ = url.searchParams.get("integration") ?? "Eesy TM";
    const from = url.searchParams.get("from") ?? "", to = url.searchParams.get("to") ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return json(400, { error: "from/to YYYY-MM-DD" });
    const { data: di } = await svc.from("dialer_integrations").select("id").eq("name", integ).maybeSingle();
    if (!di) return json(404, { error: "Integration ikke fundet" });
    const { data: cred } = await svc.rpc("get_dialer_credentials", { p_integration_id: di.id, p_encryption_key: Deno.env.get("DB_ENCRYPTION_KEY") });
    const c = (typeof cred === "string" ? JSON.parse(cred) : cred) as Row | null;
    const u2 = s(c?.username ?? c?.user ?? c?.ADVERSUS_API_USERNAME), p2 = s(c?.password ?? c?.pass ?? c?.ADVERSUS_API_PASSWORD);
    if (!u2 || !p2) return json(500, { error: "Legitimation mangler" });
    const h2 = { Authorization: `Basic ${btoa(`${u2}:${p2}`)}`, "Content-Type": "application/json" };
    const g2 = async (path: string, base = BASE) => {
      for (let a = 0; a < 7; a++) {
        apiCalls++;
        const r = await fetch(`${base}${path}`, { headers: h2 });
        if (r.status === 429) { await r.body?.cancel(); await new Promise((x) => setTimeout(x, 4000 * (a + 1))); continue; }
        const t = await r.text(); let d: unknown = null; try { d = JSON.parse(t); } catch { d = null; }
        return { status: r.status, data: d, fejl: r.ok ? null : t.slice(0, 300) };
      }
      return { status: 429, data: null, fejl: "rate limit" };
    };
    const f0 = cphOffsetIso(from), f1 = cphOffsetIso(addDays(from, 1));
    const sf = encodeURIComponent(JSON.stringify({ startTime: { $gt: f0, $lt: f1 } }));
    const cf = encodeURIComponent(JSON.stringify({ insertedTime: { $gt: f0, $lt: f1 } }));
    const probe: Record<string, unknown> = {};
    if (url.searchParams.get("probe") !== "0") for (const [navn, path, base] of [
      ["GET /v1/sessions", `/sessions?filters=${sf}&page=1&pageSize=5`, BASE],
      ["GET /v1/cdr", `/cdr?filters=${cf}&page=1&pageSize=5`, BASE],
      ["GET /cdr (uden v1)", `/cdr?filters=${cf}&page=0&pageSize=5`, "https://api.adversus.io"],
      ["GET /v1/calls", `/calls?page=1&pageSize=5`, BASE],
      ["GET /v1/campaigns", `/campaigns`, BASE],
    ] as const) {
      const r = await g2(path, base);
      const arr = Array.isArray(r.data) ? r.data : (r.data as Row)?.sessions ?? (r.data as Row)?.cdr ?? (r.data as Row)?.campaigns ?? null;
      probe[navn] = { status: r.status, fejl: r.fejl, felter: Array.isArray(arr) && arr[0] ? Object.keys(arr[0] as Row) : null };
    }
    const cr = await g2(`/campaigns`);
    const cArr = (Array.isArray(cr.data) ? cr.data : (cr.data as Row)?.campaigns ?? []) as Row[];
    const kampagner: Record<string, string> = {};
    for (const k of cArr) kampagner[s(k.id)] = s((k.settings as Row)?.name ?? k.name);
    if (probe["GET /v1/sessions"] && (probe["GET /v1/sessions"] as Row).status !== 200) return json(200, { probe, kampagner, apiKald: apiCalls });

    const isoUge = (iso: string) => {
      const d = new Date(new Date(iso).toLocaleString("en-US", { timeZone: "Europe/Copenhagen" }));
      const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      const dn = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - dn + 3);
      const y = t.getUTCFullYear(); const f = new Date(Date.UTC(y, 0, 4));
      return `${y}-W${String(1 + Math.round(((t.getTime() - f.getTime()) / 864e5 - 3 + ((f.getUTCDay() + 6) % 7)) / 7)).padStart(2, "0")}`;
    };
    type Agg = { forsoeg: number; besvaret: number; sessions: number; sessKontakt: number; leads: Set<string>; leadsBesvaret: Set<string>; leadsKontakt: Set<string>; status: Record<string, number> };
    const KONTAKT = new Set(["success", "notInterested", "unqualified"]);
    const agg: Record<string, Agg> = {};
    const nyAgg = (): Agg => ({ forsoeg: 0, besvaret: 0, sessions: 0, sessKontakt: 0, leads: new Set(), leadsBesvaret: new Set(), leadsKontakt: new Set(), status: {} });
    const listeFelter = new Set<string>();
    let sider = 0; const afbrudt: string[] = [];
    const seenS = new Set<string>(), seenC = new Set<string>();
    const kinds = (url.searchParams.get("kind") ?? "sessions,cdr").split(",").filter((k) => k === "sessions" || k === "cdr") as ("sessions" | "cdr")[];
    const start = Date.now();
    const behandl = (kind: "sessions" | "cdr", arr: Row[]) => {
      for (const x of arr) {
        const id = s(x.id); const seen = kind === "sessions" ? seenS : seenC;
        if (!id || seen.has(id)) continue; seen.add(id);
        for (const k of Object.keys(x)) if (/list|pool/i.test(k)) listeFelter.add(`${kind}.${k}`);
        const g = agg[`${isoUge(s(x.startTime))}|${s(x.campaignId)}`] ??= nyAgg();
        const lead = s(x.leadId);
        if (kind === "cdr") {
          const svar = !!s(x.answerTime);
          g.forsoeg++; if (svar) g.besvaret++;
          if (lead) { g.leads.add(lead); if (svar) g.leadsBesvaret.add(lead); }
        } else {
          g.sessions++; inc(g.status, s(x.status) || "(tom)");
          if (KONTAKT.has(s(x.status))) g.sessKontakt++;
        }
      }
    };
    const dage: string[] = []; for (let d = from; d <= to; d = addDays(d, 1)) dage.push(d);
    const ufaerdige: string[] = [];
    for (const day of dage) for (const kind of kinds) {
      if (Date.now() - start > 120000) { ufaerdige.push(`${kind} ${day}`); continue; }
      const a0 = cphOffsetIso(day), a1 = cphOffsetIso(addDays(day, 1));
      for (let page = 1; page <= MAX_PAGES; page++) {
        const fl = encodeURIComponent(JSON.stringify({ startTime: { $gt: a0, $lt: a1 } }));
        const r = await g2(`/${kind}?filters=${fl}&page=${page}&pageSize=${PAGE_SIZE}&sortProperty=startTime&sortDirection=ASC`);
        sider++;
        if (r.status !== 200) { afbrudt.push(`${kind} ${day} side ${page}: ${r.status} ${r.fejl ?? ""}`); break; }
        const arr = (Array.isArray(r.data) ? r.data : (r.data as Row)?.[kind] ?? []) as Row[];
        behandl(kind, arr);
        if (arr.length < PAGE_SIZE) break;
      }
    }
    seenS.clear();
    const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
    const raekker = Object.entries(agg).map(([k, g]) => {
      const [uge, cid] = k.split("|");
      return { uge, kampagneId: cid, kampagne: kampagner[cid] ?? "", forsoeg: g.forsoeg, besvaret: g.besvaret, svarrate: pct(g.besvaret, g.forsoeg),
        unikkeLeads: g.leads.size, unikkeLeadsBesvaret: g.leadsBesvaret.size,
        sessions: g.sessions, sessKontakt: g.sessKontakt, kontaktrateSess: pct(g.sessKontakt, g.sessions), unikkeLeadsKontakt: g.leadsKontakt.size, status: g.status };
    }).sort((a, b) => a.uge.localeCompare(b.uge) || a.kampagneId.localeCompare(b.kampagneId));
    return json(200, { probe, from, to, sessions: Object.values(agg).reduce((n, g) => n + g.sessions, 0), cdr: seenC.size, sider, afbrudt, ufaerdige, listeFelter: [...listeFelter], raekker, apiKald: apiCalls });
  }

  if (url.searchParams.get("mode") === "salescount") {
    const integ = url.searchParams.get("integration") ?? "Eesy TM";
    const day = url.searchParams.get("day") ?? new Date().toISOString().slice(0, 10);
    const { data: di } = await svc.from("dialer_integrations").select("id").eq("name", integ).maybeSingle();
    if (!di) return json(404, { error: "Integration ikke fundet" });
    const { data: cred } = await svc.rpc("get_dialer_credentials", { p_integration_id: di.id, p_encryption_key: Deno.env.get("DB_ENCRYPTION_KEY") });
    const c = (typeof cred === "string" ? JSON.parse(cred) : cred) as Row | null;
    const u2 = s(c?.username ?? c?.user), p2 = s(c?.password ?? c?.pass);
    if (!u2 || !p2) return json(500, { error: "Legitimation mangler" });
    const h2 = { Authorization: `Basic ${btoa(`${u2}:${p2}`)}` };
    const from = cphOffsetIso(day), to = cphOffsetIso(addDays(day, 1));
    const all: Row[] = [];
    for (let page = 1; page <= 20; page++) {
      const f = encodeURIComponent(JSON.stringify({ lastModifiedTime: { $gt: from, $lt: to } }));
      const r = await fetch(`${BASE}/sales?pageSize=1000&page=${page}&filters=${f}`, { headers: h2 });
      apiCalls++;
      if (!r.ok) return json(200, { fejlStatus: r.status, side: page });
      const d = await r.json();
      const arr = (Array.isArray(d) ? d : d?.sales ?? []) as Row[];
      all.push(...arr);
      if (arr.length < 1000) break;
    }
    const { data: stork } = await svc.from("sales").select("adversus_external_id, external_sales_id").eq("source", integ).gte("sale_datetime", from).lt("sale_datetime", to);
    const storkIds = new Set<string>();
    for (const r of (stork ?? []) as Row[]) { if (r.adversus_external_id) storkIds.add(s(r.adversus_external_id)); if (r.external_sales_id) storkIds.add(s(r.external_sales_id)); }
    const prState: Record<string, number> = {}, prTime: Record<string, Record<string, number>> = {}, mangler: Record<string, number> = {};
    let produkter = 0, iDag = 0; const manglerIds: Row[] = [];
    for (const x of all) {
      const created = s(x.createdTime ?? x.closedTime);
      if (created && (created < from || created >= to)) continue;
      iDag++;
      const st = s(x.state) || "(tom)";
      inc(prState, st);
      const hr = created ? new Date(created).toLocaleString("da-DK", { timeZone: "Europe/Copenhagen", hour: "2-digit" }) : "?";
      prTime[hr] = prTime[hr] ?? {}; inc(prTime[hr], st);
      const lines = Array.isArray(x.lines) ? (x.lines as Row[]) : [];
      for (const l of lines) produkter += Number(l.quantity ?? 1) || 0;
      if (!storkIds.has(s(x.id))) { inc(mangler, `${st}|kampagne ${s(x.campaignId)}`); manglerIds.push({ id: s(x.id), state: st, closed: s(x.closedTime), modified: s(x.lastModifiedTime), ownedBy: s(x.ownedBy ?? x.createdBy) }); }
    }
    return json(200, { dag: day, adversusSalgIDag: iDag, produkter, prState, prTime, storkSalg: (stork ?? []).length, manglerIStork: mangler, manglerIds, apiKald: apiCalls });
  }
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
  if (url.searchParams.get("mode") === "calllookup") {
    // Midlertidig read-only: brugernavne, sessions pr. lead og historik-endpoint-probe. Intet gemmes.
    const ids = (url.searchParams.get("users") ?? "").split(",").filter((x) => /^\d+$/.test(x));
    const leadIds = (url.searchParams.get("leads") ?? "").split(",").filter((x) => /^\d+$/.test(x)).slice(0, 20);
    const day = url.searchParams.get("day") ?? "2026-10-19";
    const fromIso = cphOffsetIso(day), toIso = cphOffsetIso(addDays(day, 1));
    const users = await get("/users");
    const uArr = (Array.isArray(users.data) ? users.data : (users.data as Row)?.users ?? []) as Row[];
    const brugere = ids.map((id) => {
      const u = uArr.find((x) => s(x.id) === id);
      return { id, fundet: !!u, navn: u ? s(u.displayName) || s(u.name) : null, cphDomæne: u ? s(u.email).toLowerCase().endsWith(OUR_DOMAIN) : null };
    });
    const pick = (o: Row, keys: string[]) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));
    const SESS_KEYS = ["id", "leadId", "campaignId", "userId", "status", "startTime", "endTime", "sessionSeconds", "cdr"];
    const leads: Row[] = [];
    let historyProbe: Row | null = null;
    for (const lid of leadIds) {
      const r = await get(`/sessions?filters=${encodeURIComponent(JSON.stringify({ leadId: { $eq: Number(lid) } }))}&page=1&pageSize=100&sortProperty=startTime&sortDirection=ASC`);
      const arr = (Array.isArray(r.data) ? r.data : (r.data as Row)?.sessions ?? []) as Row[];
      const sessions = arr.map((x) => {
        const p = pick(x, SESS_KEYS);
        if (p.cdr && typeof p.cdr === "object") {
          const c = p.cdr as Row;
          p.cdr = pick(c, ["id", "startTime", "answerTime", "endTime", "durationSeconds", "disposition"]);
        }
        return p;
      });
      const lr = await get(`/leads/${lid}`);
      const l = (Array.isArray(lr.data) ? lr.data[0] : (lr.data as Row)?.leads ? ((lr.data as Row).leads as Row[])[0] : lr.data) as Row | undefined;
      leads.push({
        leadId: lid, sessionsStatus: r.status, sessionsFeltnavne: arr[0] ? Object.keys(arr[0]) : [],
        sessionsAlle: sessions.length,
        sessionsDag: sessions.filter((x) => s(x.startTime) >= fromIso && s(x.startTime) < toIso),
        sessionsFørDag: sessions.filter((x) => s(x.startTime) < fromIso).map((x) => ({ status: x.status, startTime: x.startTime })),
        leadStatus: lr.status, leadFeltnavne: l ? Object.keys(l) : [],
        leadNu: l ? pick(l, ["status", "campaignId", "lastUpdatedTime", "lastModifiedTime", "created", "nextContactTime", "contactAttempts", "lastContactedBy"]) : null,
      });
      if (!historyProbe) {
        historyProbe = {};
        for (const p of ["history", "activities", "changelog", "events", "statusHistory", "log"]) {
          const h = await get(`/leads/${lid}/${p}`);
          historyProbe[p] = { status: h.status, felter: h.data && typeof h.data === "object" ? Object.keys(Array.isArray(h.data) ? (h.data[0] ?? {}) : h.data) : [] };
        }
      }
      await new Promise((res) => setTimeout(res, 200));
    }
    return json(200, { dag: day, brugere, leads, historyProbe, apiKald: apiCalls });
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
