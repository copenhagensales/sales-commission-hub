// READ-ONLY F0.1-diagnose for samtaleprojektet (fase0/samtaler/plan-v2.md §5 F0.1).
// Måler KUN metadata mod Adversus' API: statuskoder, feltnavne/-typer, antal, fordeling af lukkede værdisæt,
// om download-links er udfyldt, om /calls/{id}/recording svarer 307 (redirectet FØLGES IKKE), timestamp-filterets
// semantik og paginering. Ingen numre, navne, id'er, URL'er eller lyd gemmes, logges eller returneres.
// Intet skrives til databasen. Kald: GET ?integration=Lovablecph&dag=YYYY-MM-DD&vindue=30 (x-cron-secret eller ejer).
import { requireCronOrOwner, sharedCorsHeaders } from "../_shared/auth.ts";
import { feltTrae, fordeling } from "../_shared/felttrae.ts";
import { cphIso, senesteHverdag, udledTimestampSemantik } from "./analyse.ts";

const BASE = "https://api.adversus.io/v1";
const MAKS_KALD = 12;
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

  let apiKald = 0, rateLimit = 0;
  const get = async (path: string, redirect: RequestRedirect = "follow"): Promise<{ status: number; data: unknown; location: string | null }> => {
    if (apiKald >= MAKS_KALD) return { status: 0, data: null, location: null };
    for (let a = 0; a < 3; a++) {
      apiKald++;
      await new Promise((r) => setTimeout(r, PAUSE_MS));
      const res = await fetch(`${BASE}${path}`, { headers, redirect });
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

  // 1) /recordings – feltnavne, download udfyldt?, klip
  const r1 = await get(`/recordings?pageSize=20&includeMeta=true`);
  const recs = liste(r1.data, "recordings");
  ud.recordings = {
    status: r1.status, antal: recs.length, felter: recs[0] ? feltTrae(recs[0]) : null, meta: meta(r1.data),
    download_udfyldt: recs.filter((r) => s((r.recording as Row)?.download)).length,
    med_klip: recs.filter((r) => Array.isArray(r.clips) && r.clips.length > 0).length,
  };
  // 7) kobling cdr.id ↔ dialer_calls.external_id (kun antal)
  const cdrIds = recs.map((r) => s((r.cdr as Row)?.id)).filter(Boolean);
  if (cdrIds.length > 0) {
    const { count } = await svc.from("dialer_calls").select("id", { count: "exact", head: true }).eq("integration_id", di.id).in("external_id", cdrIds);
    ud.kobling = { optagelser: cdrIds.length, fundet_i_dialer_calls: count ?? 0 };
  }
  // 2) /calls i vinduet (start-filter) – felter, fordeling af lukkede værdisæt
  const r2 = await get(`/calls?pageSize=100&includeMeta=true&filters=${filt({ start: { $gt: t1, $lt: t2 } })}`);
  const calls = liste(r2.data, "calls");
  ud.calls_start = { status: r2.status, antal: calls.length, felter: calls[0] ? feltTrae(calls[0]) : null, meta: meta(r2.data), disposition: fordeling(calls, "disposition"), origin: fordeling(calls, "origin"), anonymous: fordeling(calls, "anonymous") };
  // 3) timestamp-filterets semantik
  const r3 = await get(`/calls?pageSize=100&filters=${filt({ timestamp: { $gt: t1, $lt: t2 } })}`);
  const tcalls = liste(r3.data, "calls");
  ud.calls_timestamp = { status: r3.status, ...udledTimestampSemantik(tcalls as { start?: unknown; end?: unknown }[], t1, t2) };
  // 4) paginering: stor pageSize over 2 timer
  const r4 = await get(`/calls?pageSize=2000&includeMeta=true&filters=${filt({ start: { $gt: t1, $lt: t3 } })}`);
  ud.paginering = { status: r4.status, antal_returneret: liste(r4.data, "calls").length, meta: meta(r4.data) };
  // 5) /calls/{id}/recording – 307 og Location-host, redirect følges IKKE
  if (cdrIds[0]) {
    const r5 = await get(`/calls/${encodeURIComponent(cdrIds[0])}/recording`, "manual");
    let host: string | null = null; try { host = r5.location ? new URL(r5.location).host : null; } catch { host = "(ugyldig)"; }
    ud.recording_link = { status: r5.status, location_findes: !!r5.location, location_host: host };
  }
  // 6) /sessions
  const r6 = await get(`/sessions?pageSize=1`);
  ud.sessions = { status: r6.status, felter: liste(r6.data, "sessions")[0] ? feltTrae(liste(r6.data, "sessions")[0], 2) : null };
  ud.api = { kald: apiKald, rate_limit_svar: rateLimit, rate_limit_headers: "Adversus sender ingen (målt tidligere)" };
  return json(200, ud);
});
