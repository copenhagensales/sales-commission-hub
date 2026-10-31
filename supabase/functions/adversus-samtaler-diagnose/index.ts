// READ-ONLY F0.1-diagnose for samtaleprojektet (fase0/samtaler/plan-v2.md §5 F0.1).
// Måler KUN metadata mod Adversus' API: statuskoder, feltnavne/-typer, antal, fordeling af lukkede værdisæt,
// om download-links er udfyldt, om /calls/{id}/recording svarer 307 (redirectet FØLGES IKKE), timestamp-filterets
// semantik og paginering. Ingen numre, navne, id'er, URL'er eller lyd gemmes, logges eller returneres.
// Intet skrives til databasen. Kald: GET ?integration=Lovablecph&dag=YYYY-MM-DD&vindue=30 (x-cron-secret eller ejer).
import { requireCronOrOwner, sharedCorsHeaders } from "../_shared/auth.ts";
import { feltTrae, fordeling } from "../_shared/felttrae.ts";
import { cphIso, senesteHverdag, udledTimestampSemantik } from "./analyse.ts";
import { hentCallsV1, mapCallEntry } from "../integration-engine/adapters/adversus-calls.ts";
import { budgetNoegle, lavAdversusBudget } from "../_shared/adversus-budget.ts";

const BASE = "https://api.adversus.io/v1";
const MAKS_KALD = 30;  // prober ≤ 14 + sammenligning ≤ 12 + genforsøg
const MAKS_KALD_SAMMENLIGN = 12; // sammenligning: op til 12 sider à 1000 kald
const HENT_MAKS_BYTES = 65536; // hente-test: kun de første 64 KB læses og kasseres – ingen lagring, ingen afspilning
const PAUSE_MS = 700;

type Row = Record<string, unknown>;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...sharedCorsHeaders, "Content-Type": "application/json" } });
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: sharedCorsHeaders });
  const auth = await requireCronOrOwner(req);
  if (auth instanceof Response) return auth;
  const svc = auth.svc;
  const url = new URL(req.url);
  const integrationNavn = url.searchParams.get("integration") ?? "Lovablecph";
  const dag = url.searchParams.get("dag") ?? senesteHverdag();
  const vindue = Math.min(120, Math.max(5, Number(url.searchParams.get("vindue") ?? 30)));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dag)) return json(400, { error: "dag skal være YYYY-MM-DD" });

  const { data: di } = await svc.from("dialer_integrations").select("id, provider").eq("name", integrationNavn).maybeSingle();
  if (!di || di.provider !== "adversus") return json(404, { error: "Adversus-integration ikke fundet" });
  const { data: cred } = await svc.rpc("get_dialer_credentials", { p_integration_id: di.id, p_encryption_key: Deno.env.get("DB_ENCRYPTION_KEY") });
  const c = (typeof cred === "string" ? JSON.parse(cred) : cred) as Row | null;
  const user = s(c?.username ?? c?.user), pass = s(c?.password ?? c?.pass);
  if (!user || !pass) return json(500, { error: "Legitimation mangler" });
  const headers = { Authorization: `Basic ${btoa(`${user}:${pass}`)}`, Accept: "application/json" };
  const budget = lavAdversusBudget(svc, await budgetNoegle(user), "diagnose");  // samme kvote som drift – også ét request kan være det tredje samtidige

  let apiKald = 0, rateLimit = 0;
  const get = async (path: string, redirect: RequestRedirect = "follow"): Promise<{ status: number; data: unknown; location: string | null }> => {
    if (apiKald >= MAKS_KALD) return { status: 0, data: null, location: null };
    for (let a = 0; a < 3; a++) {
      apiKald++;
      await new Promise((r) => setTimeout(r, PAUSE_MS));
      const lease = await budget.reserver(1);
      let res: Response;
      try { res = await fetch(`${BASE}${path}`, { headers, redirect }); if (redirect !== "manual") { const t = await res.text(); res = new Response(t, { status: res.status, headers: res.headers }); } }
      finally { await budget.frigiv(lease); }
      if (res.status === 429) { rateLimit++; await res.body?.cancel(); await new Promise((r) => setTimeout(r, 3000 * (a + 1))); continue; }
      const location = res.headers.get("location");
      if (redirect === "manual") { await res.body?.cancel(); return { status: res.status, data: null, location }; }
      const text = await res.text(); let data: unknown = null; try { data = JSON.parse(text); } catch { data = null; }
      return { status: res.status, data, location: null };
    }
    return { status: 429, data: null, location: null };
  };
  const liste = (d: unknown, n: string): Row[] => (Array.isArray(d) ? d : (d as Row)?.[n] ?? []) as Row[];
  const meta = (d: unknown): string[] => { const m = (d as Row)?.meta; return m && typeof m === "object" ? feltTrae(m, 1) : []; };
  const t1 = cphIso(dag, 10), t2 = cphIso(dag, 10, vindue), t3 = cphIso(dag, 12);
  const filt = (o: unknown) => encodeURIComponent(JSON.stringify(o));
  const ud: Row = { integration: integrationNavn, dag, vindue_min: vindue, raadata_gemt: false };

  // 1) /recordings – NYESTE (uploadet inden for 'dag' + 2 døgn; listen er ellers ældst-først), feltnavne, download udfyldt?, klip, host for download-link (kun domæne)
  const rFra = cphIso(dag, 0);
  const r1 = await get(`/recordings?pageSize=20&includeMeta=true&filters=${filt({ timestamp: { $gt: rFra } })}`);
  const recs = liste(r1.data, "recordings");
  const host = (u: unknown) => { try { return s(u) ? new URL(s(u)).host : null; } catch { return "(ugyldig)"; } };
  ud.recordings = {
    status: r1.status, antal: recs.length, felter: recs[0] ? feltTrae(recs[0]) : null, meta: meta(r1.data),
    download_udfyldt: recs.filter((r) => s((r.recording as Row)?.download)).length,
    download_hosts: Array.from(new Set(recs.map((r) => host((r.recording as Row)?.download)).filter(Boolean))),
    med_klip: recs.filter((r) => Array.isArray(r.clips) && r.clips.length > 0).length,
    upload_til_kald_min: (() => { const d = recs.map((r) => Date.parse(s(r.timestamp)) - Date.parse(s((r.cdr as Row)?.timestamp))).filter((x) => Number.isFinite(x)); return d.length ? Math.round(Math.max(...d) / 60000) : null; })(),
  };
  // 7) kobling: recordings.cdr.id ↔ dialer_calls.external_id og /calls.id ↔ dialer_calls.external_id (kun antal)
  const cdrIds = recs.map((r) => s((r.cdr as Row)?.id)).filter(Boolean);
  if (cdrIds.length > 0) {
    const { count } = await svc.from("dialer_calls").select("id", { count: "exact", head: true }).eq("integration_id", di.id).in("external_id", cdrIds);
    ud.kobling_recordings = { optagelser: cdrIds.length, fundet_i_dialer_calls: count ?? 0 };
  }
  // 2) /calls i vinduet (start-filter) – felter, fordeling af lukkede værdisæt
  const r2 = await get(`/calls?pageSize=100&includeMeta=true&filters=${filt({ start: { $gt: t1, $lt: t2 } })}`);
  const calls = liste(r2.data, "calls");
  ud.calls_start = { status: r2.status, antal: calls.length, felter: calls[0] ? feltTrae(calls[0]) : null, meta: meta(r2.data), disposition: fordeling(calls, "disposition"), origin: fordeling(calls, "origin"), anonymous: fordeling(calls, "anonymous"), med_recording_link: calls.filter((c) => s((c.links as Row)?.recording)).length };
  const callIds = calls.slice(0, 50).map((c) => s(c.id)).filter(Boolean);
  if (callIds.length > 0) {
    const { count } = await svc.from("dialer_calls").select("id", { count: "exact", head: true }).eq("integration_id", di.id).in("external_id", callIds);
    ud.kobling_calls = { kald: callIds.length, fundet_i_dialer_calls: count ?? 0 };
  }
  // 3) timestamp-filterets semantik: lukket vindue OG åbent vindue ($gt alene) – ligger de returnerede kalds start/end efter t1?
  const r3 = await get(`/calls?pageSize=100&filters=${filt({ timestamp: { $gt: t1, $lt: t2 } })}`);
  const tcalls = liste(r3.data, "calls");
  const r3b = await get(`/calls?pageSize=50&sortProperty=start&filters=${filt({ timestamp: { $gt: t1 } })}`);
  const tcalls2 = liste(r3b.data, "calls");
  const starts = tcalls2.map((c) => Date.parse(s(c.start))).filter((x) => Number.isFinite(x));
  ud.calls_timestamp = { lukket_vindue: { status: r3.status, ...udledTimestampSemantik(tcalls as { start?: unknown; end?: unknown }[], t1, t2) },
    aabent_vindue: { status: r3b.status, antal: tcalls2.length, start_min_efter_t1: starts.length ? Math.min(...starts) >= Date.parse(t1) : null, start_spaend_timer: starts.length ? Math.round((Math.max(...starts) - Math.min(...starts)) / 3600000) : null } };
  // 4) paginering: stor pageSize over 2 timer
  const r4 = await get(`/calls?pageSize=2000&includeMeta=true&filters=${filt({ start: { $gt: t1, $lt: t3 } })}`);
  ud.paginering = { status: r4.status, antal_returneret: liste(r4.data, "calls").length, meta: meta(r4.data) };
  // 5) /calls/{id}/recording – 307 og Location-host, redirect følges IKKE: både for recordings.cdr.id og for et /calls-id med links.recording
  const linkProbe = async (id: string) => { const r5 = await get(`/calls/${encodeURIComponent(id)}/recording`, "manual"); return { status: r5.status, location_findes: !!r5.location, location_host: host(r5.location) }; };
  if (cdrIds[0]) ud.recording_link_fra_recordings = await linkProbe(cdrIds[0]);
  const medLink = calls.find((c) => s((c.links as Row)?.recording));
  if (medLink) ud.recording_link_fra_calls = { links_recording_sti_type: s((medLink.links as Row)?.recording).startsWith("http") ? "absolut" : "relativ", ...(await linkProbe(s(medLink.id))) };
  // 5b) hente-test (?hent=1, Mathias 31/10 »kan vi hente tidligere kald som test«): følg 307 for den NYESTE optagelse og hent de første bytes
  //     UDEN Adversus-login (beviser at linket er credential-frit), læs filsignatur/størrelse/varighedsestimat og kassér. Intet gemmes.
  if (url.searchParams.get("hent") === "1" && cdrIds[0]) {
    const r = await get(`/calls/${encodeURIComponent(cdrIds[0])}/recording`, "manual");
    if (r.location) {
      const t0 = Date.now();
      const res = await fetch(r.location, { headers: { Range: `bytes=0-${HENT_MAKS_BYTES - 1}` } }); // ingen Authorization
      const buf = new Uint8Array(await res.arrayBuffer());
      const sig = buf.length >= 4 ? String.fromCharCode(buf[0], buf[1], buf[2], buf[3]) : "";
      const format = sig.startsWith("ID3") || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) ? "mp3" : sig === "RIFF" ? "wav" : sig === "OggS" ? "ogg" : sig === "fLaC" ? "flac" : "ukendt";
      const total = Number(res.headers.get("content-range")?.split("/")[1] ?? res.headers.get("content-length") ?? 0);
      ud.hente_test = { status: res.status, uden_login: true, range_accepteret: res.status === 206, content_type: res.headers.get("content-type"), bytes_laest: buf.length, filstoerrelse_bytes: total || null, format, ms: Date.now() - t0, gemt: false };
    } else ud.hente_test = { status: r.status, location_findes: false };
  }
  // 5c) sammenligning /cdr (dialer_calls i dag) vs. /v1/calls for hele 'dag' (F1a-port: duration_seconds/status identiske). Kun antal – intet gemmes.
  if (url.searchParams.get("sammenlign") === "1") {
    const naesteDag = new Date(`${dag}T00:00:00Z`); naesteDag.setUTCDate(naesteDag.getUTCDate() + 1);
    const dagFra = cphIso(dag, 0), dagTil = cphIso(naesteDag.toISOString().slice(0, 10), 0);  // DST-sikkert dagsvindue
    let kald = 0;
    const getSammenlign = async (sti: string) => { if (kald++ >= MAKS_KALD_SAMMENLIGN) throw new Error("sammenligning: sideloft nået"); const r = await get(sti); if (r.status !== 200) throw new Error(`sammenligning: HTTP ${r.status}`); return r.data; };
    const { entries, sider, total, komplet } = await hentCallsV1(getSammenlign, dagFra, dagTil, { maksSider: MAKS_KALD_SAMMENLIGN });
    const nye = new Map(entries.map((e) => [s(e.id), mapCallEntry(e, integrationNavn)]));
    const alleRows: Row[] = [];
    for (let fra = 0; ; fra += 1000) {  // pagineret DB-udtræk (PostgREST-loft)
      const { data: rows, error: rowsErr } = await svc.from("dialer_calls").select("external_id, duration_seconds, total_duration_seconds, status, start_time").eq("integration_id", di.id).gte("start_time", dagFra).lt("start_time", dagTil).order("start_time", { ascending: true }).range(fra, fra + 999);
      if (rowsErr) throw rowsErr;
      alleRows.push(...((rows ?? []) as Row[]));
      if (!rows || rows.length < 1000) break;
    }
    const gamle = new Map(alleRows.map((r) => [s(r.external_id), r]));
    let faelles = 0, varighedEns = 0, totalEns = 0, statusEns = 0, startEns = 0; const statusAfvig: Record<string, number> = {};
    for (const [id, n] of nye) {
      const g = gamle.get(id); if (!g) continue; faelles++;
      if (Number(g.duration_seconds) === n.durationSeconds) varighedEns++;
      if (Number(g.total_duration_seconds) === n.totalDurationSeconds) totalEns++;
      if (s(g.status) === n.status) statusEns++; else { const k = `${s(g.status)}→${n.status}`; statusAfvig[k] = (statusAfvig[k] ?? 0) + 1; }
      if (Math.abs(Date.parse(s(g.start_time)) - Date.parse(n.startTime)) < 1000) startEns++;
    }
    ud.sammenligning = { dag, komplet, calls_v1: nye.size, sider, total, dialer_calls_cdr: gamle.size, faelles, kun_i_calls_v1: nye.size - faelles, kun_i_dialer_calls: gamle.size - faelles, varighed_ens: varighedEns, total_ens: totalEns, status_ens: statusEns, start_ens: startEns, status_afvigelser: statusAfvig };
  }
  // 6) /sessions
  const r6 = await get(`/sessions?pageSize=1`);
  ud.sessions = { status: r6.status, felter: liste(r6.data, "sessions")[0] ? feltTrae(liste(r6.data, "sessions")[0], 2) : null };
  ud.api = { kald: apiKald, rate_limit_svar: rateLimit, rate_limit_headers: "Adversus sender ingen (målt tidligere)" };
  return json(200, ud);
});
