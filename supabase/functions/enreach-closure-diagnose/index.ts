// READ-ONLY diagnose af Enreach-afsluttede emner (Kanvas-tallet i Tryg-rapporten).
// Returnerer KUN aggregerede tal. Ingen lead-id'er, navne, numre, mails eller
// noter gemmes, logges eller returneres. Intet skrives til databasen.
import { requireCronOrOwner, sharedCorsHeaders } from "../_shared/auth.ts";

const OUR_DOMAIN = "@copenhagensales.dk";
const FOCUS = "CAMP18850S3064";
const WEEK = "2026-09-28";
const WIDE_FROM = "2026-09-27";
const WIDE_TO = "2026-10-06";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...sharedCorsHeaders, "Content-Type": "application/json" },
  });

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

function asArray(data: unknown, ...keys: string[]): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    for (const k of keys) {
      const v = (data as Record<string, unknown>)[k];
      if (Array.isArray(v)) return v as Record<string, unknown>[];
    }
  }
  return [];
}

function cphDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Copenhagen", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}
function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const inWeek = (day: string) => !!day && day >= WEEK && day < addDays(WEEK, 7);

function campaignOf(lead: Record<string, unknown>): string {
  const c = lead.campaign;
  if (c && typeof c === "object") {
    let id = "";
    for (const k of ["uniqueId", "id", "code", "name"]) {
      const v = s((c as Record<string, unknown>)[k]);
      if (v.startsWith("CAMP")) return v;
      if (!id && v) id = v;
    }
    return id;
  }
  return s(c);
}

/** Kun formen på tidsstemplet (fx "YYYY-MM-DDTHH:mm:ss.fffZ") — ingen værdi. */
function tsShape(ts: string): string {
  return ts.replace(/\d/g, "9");
}

const inc = (o: Record<string, number>, k: string, n = 1) => { o[k] = (o[k] ?? 0) + n; };

async function access(svc: any) {
  const { data: integration } = await svc.from("dialer_integrations").select("id, api_url")
    .eq("name", "tryg").eq("provider", "enreach").maybeSingle();
  if (!integration) throw new Error("Enreach-integrationen findes ikke");
  const { data: c, error } = await svc.rpc("get_dialer_credentials", {
    p_integration_id: integration.id, p_encryption_key: Deno.env.get("DB_ENCRYPTION_KEY"),
  });
  if (error || !c) throw new Error("Kunne ikke læse Enreach-legitimation");
  let baseUrl = s(c.api_url || integration.api_url).replace(/^(Web|URL|API|Endpoint):\s*/i, "");
  if (!/^https?:\/\//.test(baseUrl)) baseUrl = `https://${baseUrl}`;
  if (!baseUrl.endsWith("/api")) baseUrl = baseUrl.replace(/\/$/, "") + "/api";
  const auth = c.username && c.password
    ? `Basic ${btoa(`${c.username}:${c.password}`)}` : `Bearer ${c.api_token ?? ""}`;
  return { baseUrl, headers: { Authorization: auth, Accept: "application/json" } };
}

async function fetchWindow(a: { baseUrl: string; headers: Record<string, string> }, from: string, to: string) {
  const url = `${a.baseUrl}/simpleleads?Projects=*&ModifiedFrom=${from}&ModifiedTo=${to}&AllClosedStatuses=true`;
  const res = await fetch(url, { headers: a.headers });
  if (!res.ok) throw new Error(`Enreach simpleleads svarede ${res.status}`);
  const respHeaders: Record<string, string> = {};
  for (const [k, v] of res.headers) {
    if (/page|total|count|more|next|link|range|limit/i.test(k)) respHeaders[k] = v;
  }
  const payload = await res.json();
  const topKeys = payload && typeof payload === "object" && !Array.isArray(payload)
    ? Object.keys(payload) : [];
  const paging: Record<string, unknown> = {};
  if (topKeys.length) {
    for (const k of topKeys) {
      const v = (payload as Record<string, unknown>)[k];
      if (!Array.isArray(v) && (typeof v !== "object" || v === null)) paging[k] = v;
    }
  }
  return {
    leads: asArray(payload, "Results", "results", "leads", "data"),
    meta: { isArray: Array.isArray(payload), topLevelKeys: topKeys, scalarTopLevel: paging, pagingHeaders: respHeaders },
  };
}

function analyse(leads: Record<string, unknown>[], wide: boolean) {
  const perCampaign: Record<string, number> = {};
  const perCampaignWeekCph: Record<string, number> = {};
  const statusClosure: Record<string, number> = {};
  const userReason: Record<string, number> = {};
  const otherDomains: Record<string, number> = {};
  const userSource: Record<string, number> = {};
  const tsShapes: Record<string, number> = {};
  const dayDist: Record<string, number> = {};
  const ids = new Set<string>();
  let dupes = 0;
  const f = {
    total: 0, depleted: 0, depletedInWeek: 0,
    outsideWeekCph: 0, emptyTs: 0,
    inWeekCph: 0, notSetOrEmptyClosure_inWeek_nonMcr: 0,
    userFiltered_inWeek_nonMcr: 0, counted_likeReport: 0,
    allInWeekCph_noFilters: 0, inWeekCph_mondayBefore02: 0,
    lastModifiedByDiffersDomain: 0,
  };
  for (const lead of leads) {
    const id = s(lead.id ?? lead.uniqueId);
    if (id) { if (ids.has(id)) dupes++; else ids.add(id); }
    const camp = campaignOf(lead) || "(tom)";
    inc(perCampaign, camp);
    const ts = s(lead.lastModifiedTime);
    const day = cphDay(ts);
    if (inWeek(day)) inc(perCampaignWeekCph, camp);
    if (camp !== FOCUS) continue;
    f.total++;
    inc(tsShapes, tsShape(ts));
    inc(dayDist, day || "(ugyldig)");
    const status = s(lead.status), closure = s(lead.closure);
    inc(statusClosure, `${status || "(tom)"} × ${closure || "(tom)"}`);
    if (!ts || !day) f.emptyTs++;
    const iw = inWeek(day);
    if (iw) {
      f.inWeekCph++; f.allInWeekCph_noFilters++;
      // mandag 00–02 dansk tid = før rapportens UTC-start (ModifiedFrom=2026-09-28 tolket som UTC)
      const d = new Date(ts);
      if (day === WEEK && d.getTime() < Date.parse(`${WEEK}T00:00:00Z`)) f.inWeekCph_mondayBefore02++;
    } else f.outsideWeekCph++;
    if (status === "Depleted") { f.depleted++; if (iw) { f.depletedInWeek++; f.counted_likeReport++; } continue; }
    if (!iw) continue;
    const first = lead.firstProcessedByUser as Record<string, unknown> | null | undefined;
    const last = lead.lastModifiedByUser as Record<string, unknown> | null | undefined;
    const u = first ?? last;
    inc(userSource, first ? "firstProcessedByUser" : last ? "lastModifiedByUser" : "ingen");
    const org = s(u?.orgCode).toLowerCase();
    const lastOrg = s(last?.orgCode).toLowerCase();
    if (first && lastOrg && lastOrg.endsWith(OUR_DOMAIN) !== org.endsWith(OUR_DOMAIN)) f.lastModifiedByDiffersDomain++;
    if (!org.endsWith(OUR_DOMAIN)) {
      f.userFiltered_inWeek_nonMcr++;
      if (!u) inc(userReason, "bruger mangler helt");
      else if (!org) inc(userReason, "orgCode tom");
      else {
        inc(userReason, "anden domæne");
        const at = org.lastIndexOf("@");
        inc(otherDomains, at >= 0 ? org.slice(at) : "(intet @ — ikke mail)");
      }
      continue;
    }
    if (!closure || closure === "NotSet") { f.notSetOrEmptyClosure_inWeek_nonMcr++; continue; }
    f.counted_likeReport++;
  }
  return {
    window: wide ? `${WIDE_FROM} → ${WIDE_TO}` : `${WEEK} → ${addDays(WEEK, 7)}`,
    leadsInResponse: leads.length, uniqueIds: ids.size, duplicateIds: dupes,
    perCampaign, perCampaignInWeek40Cph: perCampaignWeekCph,
    focus: { campaign: FOCUS, ...f, statusClosure, userFilterReasons: userReason, otherDomains, userSource, timestampShapes: tsShapes, cphDayDistribution: dayDist },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: sharedCorsHeaders });
  const auth = await requireCronOrOwner(req);
  if (auth instanceof Response) return auth;
  try {
    const a = await access(auth.svc);
    const rep = await fetchWindow(a, WEEK, addDays(WEEK, 7));
    const wide = await fetchWindow(a, WIDE_FROM, WIDE_TO);
    const r = analyse(rep.leads, false);
    const w = analyse(wide.leads, true);
    const round = (n: number) => n > 0 && (n % 1000 === 0 || n % 500 === 0 || [100, 250, 5000, 10000].includes(n));
    return json(200, {
      reportWindow: { ...r, meta: rep.meta, looksTruncated: round(rep.leads.length) },
      wideWindow: { ...w, meta: wide.meta, looksTruncated: round(wide.leads.length) },
      gap: {
        focusInWeek40Cph_wide: w.focus.inWeekCph,
        focusInWeek40Cph_report: r.focus.inWeekCph,
        missingFromReportWindow: w.focus.inWeekCph - r.focus.inWeekCph,
      },
    });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "Ukendt fejl" });
  }
});
