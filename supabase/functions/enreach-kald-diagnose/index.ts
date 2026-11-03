// READ-ONLY diagnose for leverance B (Enreach/HeroBase på kaldsvejen, fase0/samtaler/b1-enreach-kaldsdata-krav.md).
// Måler KUN metadata mod HeroBase' API for én konto: statuskoder, feltnavne/-typer, antal, fordeling af lukkede værdisæt,
// id-formater (præfiks/længde), rate-limit-headers og om Projects=-filteret respekteres. Ingen numre, navne, e-mails, id'er
// eller URL'er gemmes, logges eller returneres. Intet skrives til databasen.
// Kald: GET ?integration=tryg&dag=YYYY-MM-DD&time=10[&kampagne=CAMP…] (x-cron-secret eller ejer).
import { requireCronOrOwner, sharedCorsHeaders } from "../_shared/auth.ts";
import { feltTrae, fordeling } from "../_shared/felttrae.ts";

const MAKS_KALD = 14;
const PAUSE_MS = 300;
type Row = Record<string, unknown>;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...sharedCorsHeaders, "Content-Type": "application/json" } });
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
const plusDag = (dag: string, n: number) => { const d = new Date(`${dag}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/** Form af en id-værdi uden at afsløre den: præfiks af bogstaver + længde + om den ligner en e-mail. */
const idForm = (v: unknown): string => { const t = s(v); if (!t) return "tom"; if (t.includes("@")) return `email(${t.split("@")[1]?.length ?? 0})`; const m = t.match(/^[A-Za-z]+/); return `${m ? m[0] : (/^\d+$/.test(t) ? "tal" : "andet")}:len${t.length}`; };
const former = (rows: Row[], hent: (r: Row) => unknown, maks = 6): Record<string, number> => { const ud: Record<string, number> = {}; for (const r of rows) { const f = idForm(hent(r)); ud[f] = (ud[f] ?? 0) + 1; } return Object.fromEntries(Object.entries(ud).sort((a, b) => b[1] - a[1]).slice(0, maks)); };
const get1 = (o: unknown, keys: string[]): unknown => { if (!o || typeof o !== "object") return undefined; const r = o as Row; for (const k of keys) { if (r[k] !== undefined && r[k] !== null && r[k] !== "") return r[k]; const lk = k.toLowerCase(); for (const ok of Object.keys(r)) if (ok.toLowerCase() === lk && r[ok] !== undefined && r[ok] !== null && r[ok] !== "") return r[ok]; } return undefined; };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: sharedCorsHeaders });
  const auth = await requireCronOrOwner(req);
  if (auth instanceof Response) return auth;
  const svc = auth.svc;
  const url = new URL(req.url);
  const navn = url.searchParams.get("integration") ?? "tryg";
  const dag = url.searchParams.get("dag") ?? new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const time = Math.min(22, Math.max(0, Number(url.searchParams.get("time") ?? 10)));
  const kampagneParam = s(url.searchParams.get("kampagne"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dag)) return json(400, { error: "dag skal være YYYY-MM-DD" });

  const { data: di } = await svc.from("dialer_integrations").select("id, name, provider, api_url, calls_org_codes").eq("name", navn).maybeSingle();
  if (!di || di.provider !== "enreach") return json(404, { error: "Enreach-integration ikke fundet" });
  const { data: cred } = await svc.rpc("get_dialer_credentials", { p_integration_id: di.id, p_encryption_key: Deno.env.get("DB_ENCRYPTION_KEY") });
  const c = (typeof cred === "string" ? JSON.parse(cred) : cred) as Row | null;
  const user = s(c?.username), pass = s(c?.password), token = s(c?.api_token);
  let authHeader = "";
  if (user && pass) authHeader = `Basic ${btoa(`${user}:${pass}`)}`;
  else if (token) authHeader = token.includes(":") ? `Basic ${btoa(token)}` : `Bearer ${token}`;
  if (!authHeader) return json(500, { error: "Legitimation mangler" });
  let base = s(di.api_url) || s(c?.api_url) || "https://wshero01.herobase.com/api";
  if (!base.startsWith("http")) base = "https://" + base;
  base = base.replace(/\/$/, ""); if (!base.endsWith("/api")) base += "/api";
  const headers = { Authorization: authHeader, Accept: "application/json" };
  const orgCodes: string[] = Array.isArray(di.calls_org_codes) && di.calls_org_codes.length ? di.calls_org_codes.map(s) : [s(c?.org_code) || "Salg"];

  let apiKald = 0; const rl: Row = {};
  const get = async (path: string): Promise<{ status: number; data: unknown; besked: string | null; ms: number }> => {
    if (apiKald >= MAKS_KALD) return { status: 0, data: null, besked: "loft nået", ms: 0 };
    apiKald++; await new Promise((r) => setTimeout(r, PAUSE_MS));
    const t0 = Date.now();
    const ctl = new AbortController(); const tmo = setTimeout(() => ctl.abort(), 60_000);
    try {
      const res = await fetch(`${base}${path}`, { headers, signal: ctl.signal });
      for (const h of ["x-rate-limit-limit", "x-rate-limit-remaining", "x-rate-limit-reset", "retry-after"]) { const v = res.headers.get(h); if (v) rl[h] = v; }
      const text = await res.text(); let data: unknown = null; try { data = JSON.parse(text); } catch { data = null; }
      const besked = res.status >= 400 ? `${res.status} ${path.split("?")[0]}: ${text.replace(/[0-9]/g, "9").slice(0, 160)}` : null;
      return { status: res.status, data, besked, ms: Date.now() - t0 };
    } catch (e) { return { status: 0, data: null, besked: `fejl: ${e instanceof Error ? e.message : String(e)}`.slice(0, 160), ms: Date.now() - t0 }; }
    finally { clearTimeout(tmo); }
  };
  const liste = (d: unknown): Row[] => (Array.isArray(d) ? d : ((d as Row)?.Results ?? (d as Row)?.results ?? (d as Row)?.Leads ?? (d as Row)?.leads ?? [])) as Row[];
  const ud: Row = { integration: navn, host: new URL(base).host, dag, time, org_codes_antal: orgCodes.length, raadata_gemt: false };
  let trin = "start";
  try {

  trin = "kvote";
  // 1) Kvote
  const lim = await get("/myaccount/request/limits"); const cnt = await get("/myaccount/request/counts");
  ud.kvote = { limits: { status: lim.status, felter: feltTrae(lim.data, 2), vaerdier: lim.status === 200 && lim.data && typeof lim.data === "object" ? lim.data : null }, counts: { status: cnt.status, felter: feltTrae(cnt.data, 2), vaerdier: cnt.status === 200 && cnt.data && typeof cnt.data === "object" ? cnt.data : null } };

  trin = "users";
  // 2) Brugere (til sælger-alias)
  const us = await get("/users?Limit=2000"); const users = liste(us.data);
  ud.users = { status: us.status, besked: us.besked, antal: users.length, felter: users[0] ? feltTrae(users[0], 1) : null,
    med_email: users.filter((u) => s(get1(u, ["email", "Email"])).includes("@")).length,
    orgcode_former: former(users, (u) => get1(u, ["orgCode", "OrgCode"])),
    email_domaener: fordeling(users.map((u) => ({ d: s(get1(u, ["email", "Email"])).split("@")[1] ?? "" })), "d", 12),
    orgcode_form_x_domaene: fordeling(users.map((u) => ({ d: `${idForm(get1(u, ["orgCode", "OrgCode"])).replace(/len\d+/, "")}→${(s(get1(u, ["email", "Email"])).split("@")[1] ?? "").toLowerCase()}` })), "d", 16) };
  const orgDom = new Map<string, string>(); for (const u of users) { const o = s(get1(u, ["orgCode", "OrgCode"])); if (o) orgDom.set(o.toLowerCase(), (s(get1(u, ["email", "Email"])).split("@")[1] ?? "").toLowerCase()); }
  const domaeneAf = (org: unknown): string => { const o = s(org).toLowerCase(); if (!o) return "tom"; if (o.includes("@")) return o.split("@")[1]; return orgDom.get(o) ?? "ukendt_bruger"; };

  trin = "projects";
  // 3) Projekter
  const pr = await get("/projects"); const projs = liste(pr.data);
  ud.projects = { status: pr.status, antal: projs.length, felter: projs[0] ? feltTrae(projs[0], 1) : null, id_former: former(projs, (p) => get1(p, ["uniqueId", "UniqueId", "id", "Id"])) };

  trin = "leads";
  // 4) Emner/sessions i vinduet (dag → dag+1), ufiltreret
  const erAse = navn.toLowerCase() === "ase";
  const leadsEp = (projects: string) => erAse
    ? `/leads?SearchName=cphsales2&ModifiedFrom=${dag}&ModifiedTo=${plusDag(dag, 1)}&Include=data,campaign,lastModifiedByUser,firstProcessedByUser`
    : `/simpleleads?Projects=${encodeURIComponent(projects)}&ModifiedFrom=${dag}&ModifiedTo=${plusDag(dag, 1)}&AllClosedStatuses=true`;
  const le = await get(`${leadsEp("*")}&skip=0&take=200`); const leads = liste(le.data);
  const kampId = (l: Row) => get1(get1(l, ["campaign", "Campaign"]), ["uniqueId", "UniqueId", "code", "Code"]);
  const agentOrg = (l: Row) => get1(get1(l, ["firstProcessedByUser", "FirstProcessedByUser"]), ["orgCode", "OrgCode"]) ?? get1(get1(l, ["lastModifiedByUser", "LastModifiedByUser"]), ["orgCode", "OrgCode"]);
  ud.leads = { status: le.status, besked: le.besked, ms: le.ms, antal: leads.length, felter: leads[0] ? feltTrae(leads[0], 2) : null,
    closure: fordeling(leads.map((l) => ({ c: s(get1(l, ["closure", "Closure"])) })), "c"),
    status_felt: fordeling(leads.map((l) => ({ c: s(get1(l, ["status", "Status", "leadStatus", "LeadStatus"])) })), "c"),
    kampagner_distinkte: new Set(leads.map((l) => s(kampId(l)))).size, kampagne_id_former: former(leads, kampId),
    agent_former: former(leads, agentOrg), agenter_distinkte: new Set(leads.map((l) => s(agentOrg(l)))).size,
    har_telefonfelt: leads[0] ? Object.keys(leads[0]).some((k) => /phone|telefon|number/i.test(k)) : null,
    agent_domaene: fordeling(leads.map((l) => ({ d: domaeneAf(agentOrg(l)) })), "d", 12),
    kampagne_antal_pr_kode: fordeling(leads.map((l) => ({ k: s(get1(get1(l, ["campaign", "Campaign"]), ["code", "Code"])) })), "k", 20) };

  // 5) Projects=-filter: respekteres det? (kun for /simpleleads-konti)
  const testKamp = kampagneParam || s(leads.map((l) => s(kampId(l))).find((x) => x));
  if (testKamp && !erAse) {
    const lf = await get(`${leadsEp(testKamp)}&skip=0&take=200`); const fl = liste(lf.data);
    const retur = new Set(fl.map((l) => s(kampId(l))));
    ud.projects_filter = { status: lf.status, besked: lf.besked, anmodet_form: idForm(testKamp), antal_filtreret: fl.length, kampagner_retur: retur.size,
      alle_inden_for: fl.length > 0 ? [...retur].every((x) => x === testKamp) : null, forventet_fra_ufiltreret: leads.filter((l) => s(kampId(l)) === testKamp).length };
    const lc = await get(`/simpleleads?Projects=*&Campaigns=${encodeURIComponent(testKamp)}&ModifiedFrom=${dag}&ModifiedTo=${plusDag(dag, 1)}&AllClosedStatuses=true&skip=0&take=200`); const cl = liste(lc.data);
    const returC = new Set(cl.map((l) => s(kampId(l))));
    ud.campaigns_filter = { status: lc.status, besked: lc.besked, antal_filtreret: cl.length, kampagner_retur: returC.size, alle_inden_for: cl.length > 0 ? [...returC].every((x) => x === testKamp) : null, forventet_fra_ufiltreret: leads.filter((l) => s(kampId(l)) === testKamp).length };
  } else ud.projects_filter = { sprunget_over: erAse ? "ASE bruger /leads?SearchName" : "ingen kampagne i vinduet" };

  trin = "calls";
  // 6) CDR: /calls i ét 2-timers vindue pr. orgCode (maks 2)
  const cdr: Row[] = [];
  for (const org of orgCodes.slice(0, 2)) {
    const ca = await get(`/calls?OrgCode=${encodeURIComponent(org)}&StartTime=${encodeURIComponent(`${dag}T${String(time).padStart(2, "0")}:00:00Z`)}&TimeSpan=PT2H&Limit=5000`);
    const calls = liste(ca.data);
    cdr.push({ org_form: idForm(org), status: ca.status, besked: ca.besked, ms: ca.ms, antal: calls.length, felter: calls[0] ? feltTrae(calls[0], 2) : null,
      udfald: fordeling(calls.map((r) => ({ u: s(get1(r, ["endCause", "EndCause", "Result", "result"])) })), "u"),
      forbundet: fordeling(calls.map((r) => ({ f: s(get1(r, ["connected", "Connected", "IsAnswered"])) })), "f"),
      kampagne_id_former: former(calls, (r) => get1(get1(r, ["campaign", "Campaign"]), ["uniqueId", "UniqueId"]) ?? get1(r, ["CampaignId"])),
      bruger_id_former: former(calls, (r) => get1(get1(r, ["user", "User"]), ["uniqueId", "UniqueId"]) ?? get1(r, ["UserId", "userId"])),
      bruger_orgcode_former: former(calls, (r) => get1(get1(r, ["user", "User"]), ["orgCode", "OrgCode"])),
      kald_id_former: former(calls, (r) => get1(r, ["uniqueId", "UniqueId", "Id", "id", "CallId"])),
      lead_id_former: former(calls, (r) => get1(r, ["uniqueLeadId", "LeadUniqueId", "LeadId"])),
      kampagner_distinkte: new Set(calls.map((r) => s(get1(get1(r, ["campaign", "Campaign"]), ["uniqueId", "UniqueId"])))).size,
      kampagne_antal_pr_kode: fordeling(calls.map((r) => ({ k: s(get1(get1(r, ["campaign", "Campaign"]), ["code", "Code"])) })), "k", 20),
      agent_domaene: fordeling(calls.map((r) => ({ d: domaeneAf(get1(get1(r, ["user", "User"]), ["orgCode", "OrgCode"])) })), "d", 12),
      campaignType: fordeling(calls.map((r) => ({ t: s(get1(r, ["campaignType"])) })), "t"), incoming: fordeling(calls.map((r) => ({ i: s(get1(r, ["incoming"])) })), "i") });
  }
  ud.calls = cdr;

  trin = "hooks";
  // 7) Hooks (B3): findes der hooks, og hvad siger /hooks/meta og /hooks/{id}/example om formatet?
  const hk = await get("/hooks"); const hooks = liste(hk.data);
  ud.hooks = { status: hk.status, besked: hk.besked, antal: hooks.length, felter: hooks[0] ? feltTrae(hooks[0], 1) : null,
    liste: hooks.slice(0, 10).map((h) => ({ leadStatus: s(get1(h, ["LeadStatus", "leadStatus"])), format: s(get1(h, ["Format", "format"])), method: s(get1(h, ["Method", "method"])),
      har_campaignCode: !!s(get1(h, ["CampaignCode", "campaignCode"])), url_host: (() => { try { return new URL(s(get1(h, ["UrlTemplate", "urlTemplate", "Url", "url"]))).host; } catch { return "ugyldig/tom"; } })(),
      contentTemplate_noegler: (() => { const t = s(get1(h, ["ContentTemplate", "contentTemplate"])); try { return Object.keys(JSON.parse(t)); } catch { return t ? ["(ikke JSON)"] : []; } })() })) };
  const hostAf = (h: Row) => { try { return new URL(s(get1(h, ["UrlTemplate", "urlTemplate", "Url", "url"]))).host; } catch { return ""; } };
  const egne = hooks.filter((h) => /supabase\.co|copenhagensales|stork/i.test(hostAf(h)));
  ud.hooks_egne = egne.slice(0, 10).map((h) => ({ id_form: idForm(get1(h, ["id", "Id"])), aktiv: get1(h, ["isActive", "IsActive"]) ?? null, leadStatus: s(get1(h, ["LeadStatus", "leadStatus"])), method: s(get1(h, ["Method", "method"])), standardTemplate: s(get1(h, ["standardTemplateName"])),
    campaignCode_form: idForm(get1(h, ["CampaignCode", "campaignCode"])), url_host: hostAf(h), url_sti_form: (() => { try { return new URL(s(get1(h, ["UrlTemplate", "urlTemplate"]))).pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, "<uuid>"); } catch { return ""; } })(),
    placeholders: Array.from(new Set((s(get1(h, ["ContentTemplate", "contentTemplate"])).match(/\{[A-Za-z_.]+\}/g) ?? []))).slice(0, 30), headers_noegler: (() => { const t = s(get1(h, ["headers", "Headers"])); try { return Object.keys(JSON.parse(t)); } catch { return t ? ["(tekst)"] : []; } })() }));
  ud.hooks_hosts = fordeling(hooks.map((h) => ({ h: hostAf(h) })), "h", 8);
  const hm = await get("/hooks/meta");
  ud.hooks_meta = { status: hm.status, besked: hm.besked, vaerdier: hm.data && typeof hm.data === "object" ? hm.data : feltTrae(hm.data, 3) };
  const foersteHookId = s(get1(hooks[0] ?? {}, ["id", "Id", "uniqueId", "UniqueId"]));
  if (foersteHookId) { const ex = await get(`/hooks/${encodeURIComponent(foersteHookId)}/example`); ud.hooks_example = { status: ex.status, besked: ex.besked, felter: feltTrae(ex.data, 3) }; }

  } catch (e) { ud.fejl = { trin, besked: (e instanceof Error ? `${e.name}: ${e.message}` : String(e)).replace(/[0-9]{6,}/g, "9…").slice(0, 300) }; }
  ud.rate_limit_headers = rl; ud.api_kald = apiKald;
  return json(200, ud);
});
