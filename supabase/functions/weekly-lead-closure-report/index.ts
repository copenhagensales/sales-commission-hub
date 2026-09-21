// Ugentlig mødebook-rapport (Tryg).
//
// Læser Adversus /leads pr. kampagne (kampagnefilter — aldrig sidevis gennem
// hele basen) på begge konti og gemmer KUN aggregerede tal:
// uge, konto, kampagne, rapportlinje, sælgerreference, status, antal.
//
// Hårde regler i denne fil:
//   * Der læses kun felterne id (dedup i hukommelsen), campaignId, status,
//     lastContactedBy og updated. Intet fra masterData eller resultData.
//   * Ingen leads, lead-id'er, navne, numre eller noter gemmes eller logges.
//   * Kun emner behandlet af vores egne @copenhagensales.dk-brugere tælles.
//   * Afsluttende statusser står i public.lead_closing_statuses — ikke i kode.
//   * Rører ikke lederne-sync, adversus-webhook eller salgsdata.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireCronOrOwner, sharedCorsHeaders } from "../_shared/auth.ts";
import { createIngestionFilter } from "../_shared/ingestion-filter-runtime.ts";
import {
  buildWeeklyLeadClosureMail,
  isoWeekNumber,
  type LineTotals,
  type SellerTotals,
  type StatusTotals,
  type UnmappedCampaign,
  type WeekTotals,
} from "../_shared/weekly-lead-closure-mail.ts";

const BASE_URL = "https://api.adversus.io/v1";
const OUR_DOMAIN = "@copenhagensales.dk";
const PAGE_SIZE = 1000;
const MAX_PAGES = 400;
/** Sider pr. kørsel — holder CPU-forbruget under funktionens grænse. */
const PAGES_PER_CHUNK = 3;
const BOOKED_STATUS = "success";
const UNKNOWN_BUCKET = "ukendt";

type AccountKey = "main" | "lederne" | "enreach";

type AccountDef = {
  key: AccountKey;
  kind: "adversus" | "enreach";
  userEnv?: string;
  passEnv?: string;
};

const ACCOUNTS: AccountDef[] = [
  { key: "main", kind: "adversus", userEnv: "ADVERSUS_API_USERNAME", passEnv: "ADVERSUS_API_PASSWORD" },
  {
    key: "lederne",
    kind: "adversus",
    userEnv: "ADVERSUS_LEDERNE_API_USERNAME",
    passEnv: "ADVERSUS_LEDERNE_API_PASSWORD",
  },
  // Kanvas-kampagnerne ligger i Enreach. Emnerne hentes pr. uge og grupperes
  // på kampagnen i svaret, fordi Enreach ignorerer kampagnefilteret.
  { key: "enreach", kind: "enreach" },
];

/** Enreach-integrationen der ejer Tryg-kampagnerne. */
const ENREACH_INTEGRATION = "tryg";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...sharedCorsHeaders, "Content-Type": "application/json" },
  });

function authHeader(account: AccountDef): string {
  const user = account.userEnv ? Deno.env.get(account.userEnv) : undefined;
  const pass = account.passEnv ? Deno.env.get(account.passEnv) : undefined;
  if (!user || !pass) throw new Error(`Adversus-legitimation mangler for kontoen ${account.key}`);
  return `Basic ${btoa(`${user}:${pass}`)}`;
}

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

function safeString(v: unknown): string {
  return v === null || v === undefined ? "" : String(v).trim();
}

// ---------------------------------------------------------------------------
// Uger: mandag–søndag i dansk tid.
// ---------------------------------------------------------------------------
function copenhagenDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Copenhagen",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function mondayOf(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const offset = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** De N seneste hele uger, ældste først. Den igangværende uge indgår ikke. */
function targetWeeks(weeks: number): string[] {
  const lastFull = addDays(mondayOf(copenhagenDay(new Date().toISOString())), -7);
  const out: string[] = [];
  for (let i = weeks - 1; i >= 0; i--) out.push(addDays(lastFull, -7 * i));
  return out;
}

// ---------------------------------------------------------------------------
// Adversus
// ---------------------------------------------------------------------------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Henter fra Adversus med venlig genforsøg ved hastighedsgrænse (429) og
 * midlertidige serverfejl. Kun status logges — aldrig svarkroppen, som kan
 * indeholde lead-data.
 */
async function getJson(path: string, auth: string): Promise<unknown> {
  const delays = [1000, 3000, 7000, 15000];
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { Authorization: auth, "Content-Type": "application/json" },
    });
    if (res.ok) return await res.json();
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= delays.length) {
      throw new Error(`Adversus ${path.split("?")[0]} svarede ${res.status}`);
    }
    const header = Number(res.headers.get("retry-after"));
    await sleep(Number.isFinite(header) && header > 0 ? header * 1000 : delays[attempt]);
  }
}

/** Vores egne Adversus-brugere. E-mailen bruges kun til domænefilteret. */
async function ourUsers(auth: string): Promise<Map<string, string>> {
  const users = asArray(await getJson("/users?pageSize=1000", auth), "users", "data");
  const ours = new Map<string, string>();
  for (const u of users) {
    const email = safeString(u.email ?? u.username).toLowerCase();
    if (!email.endsWith(OUR_DOMAIN)) continue;
    const id = safeString(u.id ?? u.userId);
    if (!id) continue;
    ours.set(id, safeString(u.name ?? u.displayName) || `Adversus-bruger ${id}`);
  }
  return ours;
}

type LeadFacts = { status: string; user: string; day: string };

/**
 * Henter én kampagnes emner med kampagnefilter og sender dem videre side for
 * side. Emnerne holdes IKKE i hukommelsen efter optællingen — kun id'et bruges
 * til deduplikering, og kun for den aktuelle kampagne.
 */
async function streamCampaignPages(
  auth: string,
  campaignId: string,
  startPage: number,
  onLead: (lead: LeadFacts) => void,
): Promise<{ scanned: number; nextPage: number | null }> {
  const numeric = /^\d+$/.test(campaignId);
  const filters = JSON.stringify({
    campaignId: { $eq: numeric ? Number(campaignId) : campaignId },
  });
  let scanned = 0;
  let page = startPage;
  for (let i = 0; i < PAGES_PER_CHUNK; i++, page++) {
    if (page > MAX_PAGES) return { scanned, nextPage: null };
    const batch = asArray(
      await getJson(
        `/leads?filters=${encodeURIComponent(filters)}&pageSize=${PAGE_SIZE}&page=${page}`,
        auth,
      ),
      "leads",
      "data",
    );
    for (const lead of batch) {
      scanned++;
      onLead({
        status: safeString(lead.status),
        user: safeString(lead.lastContactedBy),
        day: copenhagenDay(safeString(lead.updated)),
      });
    }
    if (batch.length < PAGE_SIZE) return { scanned, nextPage: null };
  }
  return { scanned, nextPage: page };
}

// ---------------------------------------------------------------------------
// Enreach (Kanvas)
// ---------------------------------------------------------------------------
/** Felter der læses fra Enreach. Intet fra data/closureData. */
const ENREACH_FIELDS = ["status", "closure", "lastModifiedTime", "firstProcessedByUser"];

type EnreachAccess = { baseUrl: string; headers: Record<string, string> };

/** Legitimation til Enreach hentes krypteret fra dialer_integrations. */
async function enreachAccess(svc: SupabaseClient): Promise<EnreachAccess> {
  const { data: integration } = await svc
    .from("dialer_integrations")
    .select("id, api_url")
    .eq("name", ENREACH_INTEGRATION)
    .eq("provider", "enreach")
    .maybeSingle();
  if (!integration) throw new Error("Enreach-integrationen findes ikke");

  const { data: creds, error } = await svc.rpc("get_dialer_credentials", {
    p_integration_id: (integration as { id: string }).id,
    p_encryption_key: Deno.env.get("DB_ENCRYPTION_KEY"),
  });
  if (error || !creds) throw new Error("Kunne ikke læse Enreach-legitimation");
  const c = creds as { api_url?: string; username?: string; password?: string; api_token?: string };

  let baseUrl = safeString(c.api_url || (integration as { api_url?: string }).api_url)
    .replace(/^(Web|URL|API|Endpoint):\s*/i, "");
  if (!baseUrl) throw new Error("Enreach-adressen mangler");
  if (!/^https?:\/\//.test(baseUrl)) baseUrl = `https://${baseUrl}`;
  if (!baseUrl.endsWith("/api")) baseUrl = baseUrl.replace(/\/$/, "") + "/api";

  const auth = c.username && c.password
    ? `Basic ${btoa(`${c.username}:${c.password}`)}`
    : `Bearer ${c.api_token ?? ""}`;
  return { baseUrl, headers: { Authorization: auth, Accept: "application/json" } };
}

type EnreachFacts = { campaignId: string; closure: string; user: string; day: string };

/**
 * Henter én uges afsluttede emner fra Enreach. Kampagnefilteret ignoreres af
 * API'et, så hele ugen hentes og grupperes på kampagnen i svaret. Kun
 * afsluttede emner (AllClosedStatuses) læses, og kun de fire felter ovenfor.
 */
async function streamEnreachWeek(
  access: EnreachAccess,
  weekStart: string,
  onLead: (lead: EnreachFacts) => void,
): Promise<number> {
  const weekEnd = addDays(weekStart, 7);
  const url = `${access.baseUrl}/simpleleads?Projects=*&ModifiedFrom=${weekStart}` +
    `&ModifiedTo=${weekEnd}&AllClosedStatuses=true`;
  const delays = [1000, 3000, 7000];
  let payload: unknown = null;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: access.headers });
    if (res.ok) {
      payload = await res.json();
      break;
    }
    if (res.status < 500 || attempt >= delays.length) {
      throw new Error(`Enreach simpleleads svarede ${res.status}`);
    }
    await sleep(delays[attempt]);
  }

  const leads = asArray(payload, "Results", "results", "leads", "data");
  let scanned = 0;
  for (const lead of leads) {
    scanned++;
    // Kampagnen kan komme som streng eller som objekt. Enreach lægger
    // kampagnekoden i ét af felterne uniqueId/id/code/name.
    const campaign = lead.campaign;
    let campaignId = "";
    if (campaign && typeof campaign === "object") {
      const c = campaign as Record<string, unknown>;
      for (const k of ["uniqueId", "id", "code", "name"]) {
        const candidate = safeString(c[k]);
        if (candidate.startsWith("CAMP")) {
          campaignId = candidate;
          break;
        }
        if (!campaignId && candidate) campaignId = candidate;
      }
    } else {
      campaignId = safeString(campaign);
    }
    const userObj = (lead.firstProcessedByUser ?? lead.lastModifiedByUser) as
      | Record<string, unknown>
      | null;
    onLead({
      campaignId,
      closure: safeString(lead.closure),
      // Tryg-opsætningen har sælgerens mail i orgCode.
      user: safeString(userObj?.orgCode).toLowerCase(),
      day: copenhagenDay(safeString(lead.lastModifiedTime)),
    });
  }
  return scanned;
}

// ---------------------------------------------------------------------------
// Opsætning
// ---------------------------------------------------------------------------
interface Config {
  closing: Set<string>;
  /** Lukkede statusser der tæller i mødebook-hitraten (lukkede ja/nej). */
  hitrate: Set<string>;
  /** Lukkede statusser der vises for sig og holdes ude af hitraten. */
  excluded: { status: string; label: string }[];
  known: Map<string, string>;
  /** Kildeudfald → kanonisk status (fx Enreach "Success" → "success"). */
  alias: Map<string, string>;
  lines: string[];
  mapping: Map<string, { reportLine: string | null; name: string | null }>;
  campaignNames: Map<string, string>;
  recipients: string[];
}

function mapKey(account: string, campaignId: string) {
  return `${account}|${campaignId}`;
}

async function loadConfig(svc: SupabaseClient): Promise<Config> {
  const [statuses, lines, mapRows, trygRows, settings] = await Promise.all([
    svc
      .from("lead_closing_statuses")
      .select("status, is_closing, label_da, maps_to_status, counts_in_hitrate"),
    svc.from("weekly_lead_report_lines").select("report_line, sort_order").order("sort_order"),
    svc
      .from("weekly_lead_report_campaign_map")
      .select("account, adversus_campaign_id, adversus_campaign_name, report_line"),
    svc
      .from("adversus_campaign_mappings")
      .select("adversus_campaign_id, adversus_campaign_name, client_campaigns!inner(clients!inner(name))"),
    svc.from("weekly_lead_closure_settings").select("recipient_email, is_active").eq("is_active", true),
  ]);

  const closing = new Set<string>();
  const hitrate = new Set<string>();
  const excluded: { status: string; label: string }[] = [];
  const known = new Map<string, string>();
  const alias = new Map<string, string>();
  for (const r of (statuses.data ?? []) as Record<string, unknown>[]) {
    const status = safeString(r.status);
    const mapsTo = safeString(r.maps_to_status);
    if (mapsTo) {
      // Rækken beskriver et kildeudfald der tælles som en kanonisk status.
      alias.set(status, mapsTo);
      continue;
    }
    const label = safeString(r.label_da) || status;
    known.set(status, label);
    if (r.is_closing === true) {
      closing.add(status);
      // counts_in_hitrate styrer om statussen indgår i "lukkede ja/nej".
      if (r.counts_in_hitrate === false) excluded.push({ status, label });
      else hitrate.add(status);
    }
  }
  excluded.sort((a, b) => a.label.localeCompare(b.label, "da"));

  const mapping = new Map<string, { reportLine: string | null; name: string | null }>();
  for (const r of (mapRows.data ?? []) as Record<string, unknown>[]) {
    mapping.set(mapKey(safeString(r.account), safeString(r.adversus_campaign_id)), {
      reportLine: (r.report_line as string | null) ?? null,
      name: (r.adversus_campaign_name as string | null) ?? null,
    });
  }

  // Tryg-kampagner uden mapping skal med, så intet forsvinder stille.
  const campaignNames = new Map<string, string>();
  for (const r of (trygRows.data ?? []) as Record<string, unknown>[]) {
    const client = (r.client_campaigns as { clients?: { name?: string } } | null)?.clients?.name;
    if (client !== "Tryg") continue;
    campaignNames.set(safeString(r.adversus_campaign_id), safeString(r.adversus_campaign_name));
  }
  for (const [key, value] of mapping) {
    const campaignId = key.split("|")[1];
    if (value.name && !campaignNames.has(campaignId)) campaignNames.set(campaignId, value.name);
  }

  return {
    closing,
    hitrate,
    excluded,
    known,
    alias,
    lines: ((lines.data ?? []) as Record<string, unknown>[]).map((r) => safeString(r.report_line)),
    mapping,
    campaignNames,
    recipients: [
      ...new Set(
        ((settings.data ?? []) as { recipient_email?: string }[])
          .map((r) => safeString(r.recipient_email).trim().toLowerCase())
          .filter((mail) => mail.length > 0),
      ),
    ],
  };
}

/** Kampagner der skal scannes pr. konto. */
function campaignsFor(account: AccountKey, config: Config): { id: string; name: string | null }[] {
  const out = new Map<string, string | null>();
  for (const [key, value] of config.mapping) {
    const [acc, campaignId] = key.split("|");
    if (acc === account) out.set(campaignId, value.name);
  }
  if (account === "main") {
    for (const [campaignId, name] of config.campaignNames) {
      // Kampagner der er mappet til en anden konto scannes ikke her.
      if (config.mapping.has(mapKey("lederne", campaignId))) continue;
      if (config.mapping.has(mapKey("enreach", campaignId))) continue;
      if (!out.has(campaignId)) out.set(campaignId, name);
    }
  }
  return [...out.entries()].map(([id, name]) => ({ id, name }));
}

// ---------------------------------------------------------------------------
// Kørsel
// ---------------------------------------------------------------------------
interface RunResult {
  weeks: string[];
  accounts: { account: AccountKey; campaigns: number; leadsScanned: number; error?: string }[];
  statusBreakdown: Record<string, Record<string, number>>;
  mailQueued: boolean;
}

/** Gemmer optællinger via RPC'en der lægger tal oveni i databasen. */
async function saveCounts(
  svc: SupabaseClient,
  config: Config,
  counts: Map<string, number>,
): Promise<void> {
  if (counts.size === 0) return;
  const rows = [...counts.entries()].map(([key, lead_count]) => {
    const [week_start, acc, campaignId, user, status] = key.split("|");
    return {
      week_start,
      account: acc,
      adversus_campaign_id: campaignId,
      report_line: config.mapping.get(mapKey(acc, campaignId))?.reportLine ?? "",
      agent_reference: `${acc}:${user}`,
      status,
      lead_count,
    };
  });
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await svc.rpc("weekly_lead_closure_add", { _rows: rows.slice(i, i + 500) });
    if (error) throw new Error(`Kunne ikke gemme ugetal: ${error.message}`);
  }
}

/**
 * Én Enreach-task: ÉN kampagne + ÉN uge. API'et ignorerer kampagnefilteret,
 * så ugens svar filtreres lokalt til taskens kampagne.
 */
async function processEnreachTask(
  svc: SupabaseClient,
  config: Config,
  campaignId: string,
  weekStart: string,
): Promise<{ scanned: number; nextPage: number | null }> {
  if (!weekStart || !campaignId) return { scanned: 0, nextPage: null };

  // Nulstil kun taskens kampagne og uge, så parallelle tasks ikke påvirkes.
  await svc
    .from("weekly_lead_closure_stats")
    .delete()
    .eq("account", "enreach")
    .eq("adversus_campaign_id", campaignId)
    .eq("week_start", weekStart);

  const access = await enreachAccess(svc);
  const counts = new Map<string, number>();
  const scanned = await streamEnreachWeek(access, weekStart, (lead) => {
    if (lead.campaignId !== campaignId) return;
    if (!lead.day || mondayOf(lead.day) !== weekStart) return;
    if (!lead.user.endsWith(OUR_DOMAIN)) return; // kun vores egne sælgere
    // Kun emner der faktisk er afsluttet af en sælger tælles med. Emner uden
    // udfald ("NotSet") er stadig åbne og hører ikke i opgørelsen.
    if (!lead.closure || lead.closure === "NotSet") return;
    const status = config.alias.get(lead.closure) ?? lead.closure ?? UNKNOWN_BUCKET;
    const key = `${weekStart}|enreach|${lead.campaignId}|${lead.user}|${status}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  await saveCounts(svc, config, counts);
  // Kun tal logges — aldrig lead-data.
  return { scanned, nextPage: null };
}

/**
 * Én task: ÉN konto + ÉN kampagne + ÉN uge, op til PAGES_PER_CHUNK sider pr. kald.
 *
 * Adversus understøtter ikke datofilter på /leads (afprøvet: HTTP 400), så hele
 * kampagnens emner skal læses. Store kampagner deles derfor i sider, og jobbet
 * lægges tilbage i køen med næste sidetal. Rækkerne for kampagnen nulstilles på
 * første side, så gentagne kørsler er idempotente.
 */
async function processTask(
  svc: SupabaseClient,
  config: Config,
  job: { account: AccountKey; campaignId: string; weeks: string[]; nextPage: number },
): Promise<{ scanned: number; nextPage: number | null }> {
  const account = ACCOUNTS.find((candidate) => candidate.key === job.account);
  if (!account) throw new Error(`Ukendt konto: ${job.account}`);
  if (account.kind === "enreach") {
    return await processEnreachTask(svc, config, job.campaignId, job.weeks[0] ?? "");
  }

  const auth = authHeader(account);
  const users = await ourUsers(auth);
  const weekSet = new Set(job.weeks);
  const counts = new Map<string, number>();

  if (job.nextPage === 1) {
    // Nulstil kampagnens tal for de berørte uger, så genkørsler ikke lægger oveni.
    await svc
      .from("weekly_lead_closure_stats")
      .delete()
      .eq("account", job.account)
      .eq("adversus_campaign_id", job.campaignId)
      .in("week_start", job.weeks);
  }

  const { scanned, nextPage } = await streamCampaignPages(
    auth,
    job.campaignId,
    job.nextPage,
    (lead) => {
      if (!lead.day) return;
      const week = mondayOf(lead.day);
      if (!weekSet.has(week)) return;
      if (!users.has(lead.user)) return; // kun vores egne sælgere
      const status = lead.status || UNKNOWN_BUCKET;
      const key = `${week}|${job.account}|${job.campaignId}|${lead.user}|${status}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    },
  );

  await saveCounts(svc, config, counts);

  return { scanned, nextPage };
}

/** Navne til mailens sælgertabel. Enreach-referencer er sælgerens mail. */
async function sellerNamesForAll(svc: SupabaseClient): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const { data: employees } = await svc
    .from("employee_master_data")
    .select("full_name, work_email")
    .not("work_email", "is", null);
  for (const e of (employees ?? []) as { full_name: string | null; work_email: string | null }[]) {
    const email = safeString(e.work_email).toLowerCase();
    if (email) names.set(`enreach:${email}`, safeString(e.full_name) || email);
  }
  for (const account of ACCOUNTS) {
    if (account.kind !== "adversus") continue;
    try {
      const users = await ourUsers(authHeader(account));
      for (const [id, name] of users) names.set(`${account.key}:${id}`, name);
    } catch {
      // Mangler legitimation for en konto, vises sælgerreferencen i stedet.
    }
  }
  return names;
}

type StatRow = {
  week_start: string;
  account: string;
  adversus_campaign_id: string;
  report_line: string | null;
  agent_reference: string;
  status: string;
  lead_count: number;
};

function lineTotals(rows: StatRow[], config: Config): LineTotals[] {
  return config.lines.map((reportLine) => {
    const mine = rows.filter((r) => r.report_line === reportLine);
    const sum = (predicate: (status: string) => boolean) =>
      mine.filter((r) => predicate(r.status)).reduce((s, r) => s + r.lead_count, 0);
    const extras: Record<string, number> = {};
    for (const e of config.excluded) extras[e.status] = sum((status) => status === e.status);
    return {
      reportLine,
      closed: sum((status) => config.closing.has(status)),
      decided: sum((status) => config.hitrate.has(status)),
      booked: sum((status) => status === BOOKED_STATUS),
      extras,
    };
  });
}

function buildMail(
  weekStart: string,
  rows: StatRow[],
  previous: { weekStart: string; rows: StatRow[] }[],
  config: Config,
  sellerNames: Map<string, string>,
  notScanned: FailedTask[],
) {
  const statusKeys = [...config.closing].map((status) => ({
    status,
    label: config.known.get(status) ?? status,
  }));

  const statusRows: StatusTotals[] = config.lines.map((reportLine) => {
    const counts: Record<string, number> = {};
    for (const s of statusKeys) {
      counts[s.status] = rows
        .filter((r) => r.report_line === reportLine && r.status === s.status)
        .reduce((sum, r) => sum + r.lead_count, 0);
    }
    return { reportLine, counts };
  });

  const sellerMap = new Map<string, SellerTotals>();
  for (const r of rows) {
    const name = sellerNames.get(r.agent_reference) ?? r.agent_reference;
    const entry = sellerMap.get(name) ?? { sellerName: name, closed: 0, decided: 0, booked: 0 };
    if (config.closing.has(r.status)) entry.closed += r.lead_count;
    if (config.hitrate.has(r.status)) entry.decided += r.lead_count;
    if (r.status === BOOKED_STATUS) entry.booked += r.lead_count;
    sellerMap.set(name, entry);
  }

  const unmappedMap = new Map<string, UnmappedCampaign>();
  for (const r of rows) {
    if (r.report_line) continue;
    const key = mapKey(r.account, r.adversus_campaign_id);
    const entry = unmappedMap.get(key) ?? {
      account: r.account,
      campaignId: r.adversus_campaign_id,
      campaignName:
        config.mapping.get(key)?.name ?? config.campaignNames.get(r.adversus_campaign_id) ?? null,
      closed: 0,
      booked: 0,
    };
    if (config.closing.has(r.status)) entry.closed += r.lead_count;
    if (r.status === BOOKED_STATUS) entry.booked += r.lead_count;
    unmappedMap.set(key, entry);
  }

  const unknownMap = new Map<string, number>();
  for (const r of rows) {
    if (config.known.has(r.status)) continue;
    unknownMap.set(r.status, (unknownMap.get(r.status) ?? 0) + r.lead_count);
  }

  const previousWeeks: WeekTotals[] = previous.map((p) => ({
    weekStart: p.weekStart,
    weekNumber: isoWeekNumber(p.weekStart),
    lines: lineTotals(p.rows, config),
  }));

  return buildWeeklyLeadClosureMail({
    weekStart,
    weekNumber: isoWeekNumber(weekStart),
    lines: lineTotals(rows, config),
    statusKeys,
    excludedStatuses: config.excluded,
    statusRows,
    sellers: [...sellerMap.values()].sort((a, b) => b.closed - a.closed),
    previousWeeks,
    unknownStatuses: [...unknownMap.entries()].map(([status, count]) => ({ status, count })),
    unmapped: [...unmappedMap.values()].sort((a, b) => b.closed - a.closed),
    notScanned: notScanned.map((j) => ({
      account: j.account,
      campaignId: j.campaign_id,
      campaignName:
        config.mapping.get(mapKey(j.account, j.campaign_id))?.name ??
        config.campaignNames.get(j.campaign_id) ??
        null,
      error: j.error ?? "ukendt fejl",
    })),
  });
}

async function alreadyMailedToday(svc: SupabaseClient): Promise<boolean> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { data } = await svc
    .from("weekly_lead_closure_runs")
    .select("id")
    .eq("mail_sent", true)
    .gte("started_at", since.toISOString())
    .limit(1);
  return (data ?? []).length > 0;
}

/** GDPR: indtagsfilteret skal tillade præcis de felter vi læser — pr. kilde. */
async function assertFieldsAllowed(svc: SupabaseClient): Promise<void> {
  const sources: { integration: string; fields: string[] }[] = [
    { integration: "adversus", fields: ["status", "lastContactedBy", "updated"] },
    { integration: "enreach", fields: ENREACH_FIELDS },
  ];
  for (const source of sources) {
    const gdprFilter = await createIngestionFilter(svc, {
      integration: source.integration,
      triggeredBy: "weekly-lead-closure-report",
    });
    const sample: Record<string, unknown> = {};
    for (const f of source.fields) sample[f] = "x";
    const probe = gdprFilter.filter({ data: sample }, "lead_meta") as {
      data?: Record<string, unknown>;
    };
    const allowed = Object.keys(probe.data ?? {});
    await gdprFilter.flush();
    for (const field of source.fields) {
      if (!allowed.includes(field)) {
        throw new Error(
          `Indtagsfilteret blokerer feltet ${field} (${source.integration}) — rapporten er standset`,
        );
      }
    }
  }
}

/** Fælles tilstand for én kørsel. Selve arbejdet står i taskkøen. */
interface RunState {
  runId: string;
  weeks: string[];
  sendMail: boolean;
  /** Manuel afsendelse: mailen sendes selvom der allerede er sendt i dag. */
  forceMail: boolean;
  triggeredBy: string;
}

const MAX_ATTEMPTS = 3;

type TaskRow = {
  id: string;
  run_id: string;
  account: AccountKey;
  campaign_id: string;
  week_start: string;
  status: string;
  attempts: number;
  next_page: number;
  leads_scanned: number;
  error: string | null;
};

type FailedTask = {
  account: string;
  campaign_id: string;
  week_start: string;
  error: string | null;
};

/**
 * Sætter næste kald i gang. Kaldet afsendes og afbrydes derefter bevidst, så
 * denne kørsel kan svare med det samme uden at vente på hele køen.
 */
async function chainNext(state: RunState): Promise<void> {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/weekly-lead-closure-report`;
  const body = JSON.stringify({
    run_id: state.runId,
    weeks_list: state.weeks,
    send_mail: state.sendMail,
    force_mail: state.forceMail,
    triggered_by: state.triggeredBy,
  });
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body,
      signal: AbortSignal.timeout(3000),
    });
  } catch (e) {
    // TimeoutError er forventet: kaldet er afsendt og kører videre selv.
    if (!(e instanceof DOMException) && !(e instanceof Error && e.name === "TimeoutError")) {
      console.error("[weekly-lead-closure-report] kæde fejlede", String(e));
    }
  }
}

/** Fylder køen med én task pr. konto, kampagne og uge. */
async function enqueueTasks(
  svc: SupabaseClient,
  config: Config,
  runId: string,
  weeks: string[],
): Promise<number> {
  const tasks: Record<string, unknown>[] = [];
  for (const account of ACCOUNTS) {
    for (const campaign of campaignsFor(account.key, config)) {
      for (const week of weeks) {
        tasks.push({
          run_id: runId,
          account: account.key,
          campaign_id: campaign.id,
          week_start: week,
          week_end: addDays(week, 6),
        });
      }
    }
  }
  if (tasks.length === 0) return 0;
  const { error } = await svc.from("weekly_lead_closure_tasks").insert(tasks);
  if (error) throw new Error(`Kunne ikke oprette taskkøen: ${error.message}`);
  return tasks.length;
}

async function flushMailQueue(): Promise<void> {
  try {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/process-scheduled-emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: "{}",
      signal: AbortSignal.timeout(20000),
    });
  } catch (e) {
    // Fejler afsendelsen her, sender cron den alligevel inden for 5 minutter.
    console.error("[weekly-lead-closure-report] kunne ikke skubbe mailkøen", String(e));
  }
}

async function finishAndMail(
  svc: SupabaseClient,
  config: Config,
  state: RunState,
  failed: FailedTask[],
): Promise<{ mailQueued: boolean; statusBreakdown: Record<string, Record<string, number>> }> {
  const weeks = state.weeks;
  const { data: stored } = await svc
    .from("weekly_lead_closure_stats")
    .select("week_start, account, adversus_campaign_id, report_line, agent_reference, status, lead_count")
    .in("week_start", weeks);
  const rows = (stored ?? []) as StatRow[];

  const latest = weeks[weeks.length - 1];
  const latestRows = rows.filter((r) => r.week_start === latest);
  const previous = weeks
    .slice(Math.max(0, weeks.length - 5), weeks.length - 1)
    .reverse()
    .map((week) => ({ weekStart: week, rows: rows.filter((r) => r.week_start === week) }));

  let mailQueued = false;
  if (
    state.sendMail &&
    config.recipients.length > 0 &&
    (state.forceMail || !(await alreadyMailedToday(svc)))
  ) {
    const mail = buildMail(
      latest,
      latestRows,
      previous,
      config,
      await sellerNamesForAll(svc),
      failed,
    );
    const scheduledAt = new Date().toISOString();
    const { error } = await svc.from("scheduled_emails").insert(
      config.recipients.map((recipient) => ({
        recipient_email: recipient,
        subject: mail.subject,
        content: mail.html,
        template_key: "weekly_lead_closure_report",
        scheduled_at: scheduledAt,
        status: "pending",
      })),
    );
    if (error) throw new Error(`Kunne ikke lægge mailen i køen: ${error.message}`);
    mailQueued = true;
    // Mailkøen tømmes normalt af cron hvert 5. minut. Ved manuel afsendelse
    // skal mailen ud med det samme, så køen skubbes her.
    await flushMailQueue();
  }

  await svc
    .from("weekly_lead_closure_runs")
    .update({
      mail_sent: mailQueued,
      finished_at: new Date().toISOString(),
      error: failed.length
        ? `ikke scannet: ${failed.map((f) => `${f.account}/${f.campaign_id}`).join(", ")}`
        : null,
    })
    .eq("id", state.runId);

  const statusBreakdown: Record<string, Record<string, number>> = {};
  for (const r of latestRows) {
    const line = r.report_line ?? `Ikke mappet (${r.account}/${r.adversus_campaign_id})`;
    statusBreakdown[line] = statusBreakdown[line] ?? {};
    statusBreakdown[line][r.status] = (statusBreakdown[line][r.status] ?? 0) + r.lead_count;
  }
  return { mailQueued, statusBreakdown };
}

/** Tæller tasks i en kørsel, så køen kan afgøre om den er tom. */
async function taskSummary(
  svc: SupabaseClient,
  runId: string,
): Promise<{ pending: number; running: number; done: number; error: number; failed: FailedTask[] }> {
  const { data } = await svc
    .from("weekly_lead_closure_tasks")
    .select("account, campaign_id, week_start, status, error")
    .eq("run_id", runId);
  const rows = (data ?? []) as (FailedTask & { status: string })[];
  return {
    pending: rows.filter((r) => r.status === "pending").length,
    running: rows.filter((r) => r.status === "running").length,
    done: rows.filter((r) => r.status === "done").length,
    error: rows.filter((r) => r.status === "error").length,
    failed: rows
      .filter((r) => r.status === "error")
      .map((r) => ({
        account: r.account,
        campaign_id: r.campaign_id,
        week_start: r.week_start,
        error: r.error,
      })),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: sharedCorsHeaders });

  const auth = await requireCronOrOwner(req);
  if (auth instanceof Response) return auth;

  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  let activeRunId: string | null = null;

  try {
    const body = (await req.json().catch(() => ({}))) as {
      weeks?: number;
      weeks_list?: string[];
      run_id?: string;
      send_mail?: boolean;
      force_mail?: boolean;
      current_week?: boolean;
      triggered_by?: string;
      action?: "status";
      run_ids?: string[];
    };

    if (body.action === "status") {
      const runIds = (body.run_ids ?? []).slice(0, 20);
      const summaries = await Promise.all(
        runIds.map(async (runId) => ({ runId, ...(await taskSummary(svc, runId)) })),
      );
      return json(200, {
        summaries: summaries.map(({ failed: _failed, ...summary }) => summary),
      });
    }

    // Planen kører 05:00 og 06:00 UTC mandag, så mailen rammer 07:00 dansk tid
    // både sommer og vinter. Kun den kørsel der er kl. 7 i Danmark fortsætter.
    if (!auth.userId && !body.run_id && !body.triggered_by) {
      const hour = Number(
        new Intl.DateTimeFormat("da-DK", {
          timeZone: "Europe/Copenhagen",
          hour: "2-digit",
          hour12: false,
        }).format(new Date()),
      );
      if (hour !== 7) return json(200, { stage: "sprunget over", danskTime: hour });
    }

    const config = await loadConfig(svc);
    if (config.lines.length === 0) throw new Error("Rapportlinjerne mangler i opsætningen");
    await assertFieldsAllowed(svc);

    // current_week: den igangværende uge (mandag → i dag) i stedet for de
    // seneste hele uger. Bruges af "Send mail nu" i Stork.
    const currentWeek = [mondayOf(copenhagenDay(new Date().toISOString()))];
    const weeks = body.weeks_list ??
      (body.current_week
        ? currentWeek
        : targetWeeks(Math.max(1, Math.min(Number(body.weeks ?? 1), 12))));
    const triggeredBy = body.triggered_by ?? (auth.userId ? "manuel" : "cron");

    // ---- Start: opret kørslen, fyld køen, og sæt første kald i gang. ----
    if (!body.run_id) {
      const { data: run, error: runError } = await svc
        .from("weekly_lead_closure_runs")
        .insert({
          account: null,
          weeks_covered: weeks.length,
          triggered_by: triggeredBy,
        })
        .select("id")
        .single();
      if (runError || !run) throw new Error(`Kunne ikke oprette kørslen: ${runError?.message}`);
      const runId = (run as { id: string }).id;
      activeRunId = runId;
      const state: RunState = {
        runId,
        weeks,
        sendMail: body.send_mail !== false,
        forceMail: body.force_mail === true,
        triggeredBy,
      };
      const tasks = await enqueueTasks(svc, config, runId, weeks);
      await chainNext(state);
      return json(200, { stage: "startet", runId, weeks, tasks });
    }

    // ---- Arbejder: tag næste task, udfør den, og kald videre. ----
    const state: RunState = {
      runId: body.run_id,
      weeks,
      sendMail: body.send_mail !== false,
      forceMail: body.force_mail === true,
      triggeredBy,
    };
    activeRunId = state.runId;

    const { data: takenRaw, error: takeError } = await svc.rpc("weekly_lead_closure_take_task", {
      _run_id: state.runId,
    });
    if (takeError) throw new Error(`Kunne ikke tage næste task: ${takeError.message}`);
    const task = (takenRaw as TaskRow | null) ?? null;

    if (!task?.id) {
      const summary = await taskSummary(svc, state.runId);
      if (summary.pending > 0 || summary.running > 0) {
        // Et andet kald arbejder stadig; denne kæde stopper her.
        return json(200, { stage: "venter", ...summary, failed: undefined });
      }
      // Alle tasks er done/error: afslut kørslen én gang.
      const { data: claimed } = await svc
        .from("weekly_lead_closure_runs")
        .update({ campaigns_scanned: summary.done })
        .eq("id", state.runId)
        .is("finished_at", null)
        .select("id")
        .maybeSingle();
      if (!claimed) return json(200, { stage: "allerede afsluttet", ...summary });
      const finished = await finishAndMail(svc, config, state, summary.failed);
      return json(200, {
        stage: "færdig",
        weeks,
        tasksDone: summary.done,
        tasksError: summary.error,
        notScanned: summary.failed,
        ...finished,
      });
    }

    const taskWeeks = [task.week_start];
    try {
      const { scanned, nextPage } = await processTask(svc, config, {
        account: task.account,
        campaignId: task.campaign_id,
        weeks: taskWeeks,
        nextPage: task.next_page,
      });
      await svc
        .from("weekly_lead_closure_tasks")
        .update({
          // Flere sider: tasken tilbage i køen med næste sidetal.
          status: nextPage ? "pending" : "done",
          next_page: nextPage ?? task.next_page,
          leads_scanned: (task.leads_scanned ?? 0) + scanned,
          error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", task.id);
      const { data: runRow } = await svc
        .from("weekly_lead_closure_runs")
        .select("leads_scanned")
        .eq("id", state.runId)
        .maybeSingle();
      await svc
        .from("weekly_lead_closure_runs")
        .update({ leads_scanned: ((runRow as { leads_scanned: number } | null)?.leads_scanned ?? 0) + scanned })
        .eq("id", state.runId);
      await chainNext(state);
      return json(200, {
        stage: "kører",
        account: task.account,
        campaignId: task.campaign_id,
        weekStart: task.week_start,
        scanned,
        nextPage,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const giveUp = task.attempts >= MAX_ATTEMPTS;
      console.error(
        `[weekly-lead-closure-report] task fejlede konto=${task.account} kampagne=${task.campaign_id} uge=${task.week_start} forsøg=${task.attempts}: ${message}`,
      );
      await svc
        .from("weekly_lead_closure_tasks")
        .update({
          status: giveUp ? "error" : "pending",
          error: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", task.id);
      await chainNext(state);
      return json(200, {
        stage: giveUp ? "task opgivet" : "task forsøges igen",
        account: task.account,
        campaignId: task.campaign_id,
        weekStart: task.week_start,
        attempts: task.attempts,
      });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[weekly-lead-closure-report]", message);
    // Køen kører i baggrunden, så fejlen skrives på kørselsrækken — ellers
    // stopper rapporten uden spor.
    try {
      if (activeRunId) {
        await svc
          .from("weekly_lead_closure_runs")
          .update({ error: message, finished_at: new Date().toISOString() })
          .eq("id", activeRunId)
          .is("finished_at", null);
      }
    } catch {
      // Logning må aldrig skjule den oprindelige fejl.
    }
    return json(500, { error: message });
  }
});
