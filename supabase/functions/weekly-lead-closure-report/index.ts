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

type AccountKey = "main" | "lederne";

const ACCOUNTS: { key: AccountKey; userEnv: string; passEnv: string }[] = [
  { key: "main", userEnv: "ADVERSUS_API_USERNAME", passEnv: "ADVERSUS_API_PASSWORD" },
  { key: "lederne", userEnv: "ADVERSUS_LEDERNE_API_USERNAME", passEnv: "ADVERSUS_LEDERNE_API_PASSWORD" },
];

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...sharedCorsHeaders, "Content-Type": "application/json" },
  });

function authHeader(account: { userEnv: string; passEnv: string; key: string }): string {
  const user = Deno.env.get(account.userEnv);
  const pass = Deno.env.get(account.passEnv);
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
// Opsætning
// ---------------------------------------------------------------------------
interface Config {
  closing: Set<string>;
  known: Map<string, string>;
  lines: string[];
  mapping: Map<string, { reportLine: string | null; name: string | null }>;
  campaignNames: Map<string, string>;
  recipient: string | null;
}

function mapKey(account: string, campaignId: string) {
  return `${account}|${campaignId}`;
}

async function loadConfig(svc: SupabaseClient): Promise<Config> {
  const [statuses, lines, mapRows, trygRows, settings] = await Promise.all([
    svc.from("lead_closing_statuses").select("status, is_closing, label_da"),
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
  const known = new Map<string, string>();
  for (const r of (statuses.data ?? []) as Record<string, unknown>[]) {
    const status = safeString(r.status);
    known.set(status, safeString(r.label_da) || status);
    if (r.is_closing === true) closing.add(status);
  }

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
    known,
    lines: ((lines.data ?? []) as Record<string, unknown>[]).map((r) => safeString(r.report_line)),
    mapping,
    campaignNames,
    recipient: ((settings.data ?? [])[0] as { recipient_email?: string } | undefined)?.recipient_email ?? null,
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
      // Kampagner der er mappet til den anden konto scannes ikke her.
      if (config.mapping.has(mapKey("lederne", campaignId))) continue;
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

/**
 * Én arbejdsbid: op til PAGES_PER_CHUNK sider af ÉN kampagne.
 *
 * Adversus understøtter ikke datofilter på /leads (afprøvet: HTTP 400), så hele
 * kampagnens emner skal læses. Det overskrider funktionens CPU-grænse i én
 * kørsel, og derfor arbejder jobbet i bidder der kæder sig selv videre.
 * Tallene lægges sammen i databasen via weekly_lead_closure_add, og rækkerne
 * for kampagnen nulstilles ved sidste side, så gentagne kørsler er idempotente.
 */
async function processChunk(
  svc: SupabaseClient,
  config: Config,
  chunk: { weeks: string[]; account: AccountKey; campaignIndex: number; page: number },
): Promise<{ scanned: number; nextPage: number | null; campaignCount: number }> {
  const account = ACCOUNTS.find((a) => a.key === chunk.account)!;
  const campaigns = campaignsFor(chunk.account, config);
  const campaign = campaigns[chunk.campaignIndex];
  if (!campaign) return { scanned: 0, nextPage: null, campaignCount: campaigns.length };

  const auth = authHeader(account);
  const users = await ourUsers(auth);
  const weekSet = new Set(chunk.weeks);
  const counts = new Map<string, number>();

  if (chunk.page === 1) {
    // Nulstil kampagnens tal for de berørte uger, så genkørsler ikke lægger oveni.
    await svc
      .from("weekly_lead_closure_stats")
      .delete()
      .eq("account", chunk.account)
      .eq("adversus_campaign_id", campaign.id)
      .in("week_start", chunk.weeks);
  }

  const { scanned, nextPage } = await streamCampaignPages(
    auth,
    campaign.id,
    chunk.page,
    (lead) => {
      if (!lead.day) return;
      const week = mondayOf(lead.day);
      if (!weekSet.has(week)) return;
      if (!users.has(lead.user)) return; // kun vores egne sælgere
      const status = lead.status || UNKNOWN_BUCKET;
      const key = `${week}|${chunk.account}|${campaign.id}|${lead.user}|${status}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    },
  );

  if (counts.size > 0) {
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

  return { scanned, nextPage, campaignCount: campaigns.length };
}

/** Navne på vores Adversus-brugere, kun til mailens sælgertabel. */
async function sellerNamesForAll(): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  for (const account of ACCOUNTS) {
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
    return {
      reportLine,
      closed: mine.filter((r) => config.closing.has(r.status)).reduce((s, r) => s + r.lead_count, 0),
      booked: mine.filter((r) => r.status === BOOKED_STATUS).reduce((s, r) => s + r.lead_count, 0),
    };
  });
}

function buildMail(
  weekStart: string,
  rows: StatRow[],
  previous: { weekStart: string; rows: StatRow[] }[],
  config: Config,
  sellerNames: Map<string, string>,
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
    const entry = sellerMap.get(name) ?? { sellerName: name, closed: 0, booked: 0 };
    if (config.closing.has(r.status)) entry.closed += r.lead_count;
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
    statusRows,
    sellers: [...sellerMap.values()].sort((a, b) => b.closed - a.closed),
    previousWeeks,
    unknownStatuses: [...unknownMap.entries()].map(([status, count]) => ({ status, count })),
    unmapped: [...unmappedMap.values()].sort((a, b) => b.closed - a.closed),
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

/** GDPR: indtagsfilteret skal tillade de tre felter vi læser. */
async function assertFieldsAllowed(svc: SupabaseClient): Promise<void> {
  const gdprFilter = await createIngestionFilter(svc, {
    integration: "adversus",
    triggeredBy: "weekly-lead-closure-report",
  });
  const probe = gdprFilter.filter(
    { data: { status: "x", lastContactedBy: "x", updated: "x" } },
    "lead_meta",
  ) as { data?: Record<string, unknown> };
  const allowed = Object.keys(probe.data ?? {});
  await gdprFilter.flush();
  for (const field of ["status", "lastContactedBy", "updated"]) {
    if (!allowed.includes(field)) {
      throw new Error(`Indtagsfilteret blokerer feltet ${field} — rapporten er standset`);
    }
  }
}

interface ChunkState {
  weeks: string[];
  account: AccountKey;
  campaignIndex: number;
  page: number;
  sendMail: boolean;
  triggeredBy: string;
}

/**
 * Sætter næste bid i gang. Kaldet afsendes og afbrydes derefter bevidst, så
 * denne kørsel kan svare med det samme uden at vente på hele kæden. Svaret fra
 * den næste bid bruges ikke — kæden logger selv i weekly_lead_closure_runs.
 */
async function chainNext(state: ChunkState): Promise<void> {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/weekly-lead-closure-report`;
  const body = JSON.stringify({
    weeks_list: state.weeks,
    account: state.account,
    campaign_index: state.campaignIndex,
    page: state.page,
    send_mail: state.sendMail,
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
    // TimeoutError er forventet: bidden er afsendt og kører videre selv.
    if (!(e instanceof DOMException) && !(e instanceof Error && e.name === "TimeoutError")) {
      console.error("[weekly-lead-closure-report] kæde fejlede", String(e));
    }
  }
}

async function finishAndMail(
  svc: SupabaseClient,
  config: Config,
  state: ChunkState,
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
  if (state.sendMail && config.recipient && !(await alreadyMailedToday(svc))) {
    const mail = buildMail(latest, latestRows, previous, config, await sellerNamesForAll());
    const { error } = await svc.from("scheduled_emails").insert({
      recipient_email: config.recipient,
      subject: mail.subject,
      content: mail.html,
      template_key: "weekly_lead_closure_report",
      scheduled_at: new Date().toISOString(),
      status: "pending",
    });
    if (error) throw new Error(`Kunne ikke lægge mailen i køen: ${error.message}`);
    mailQueued = true;
  }

  await svc.from("weekly_lead_closure_runs").insert({
    account: null,
    weeks_covered: weeks.length,
    mail_sent: mailQueued,
    triggered_by: state.triggeredBy,
    finished_at: new Date().toISOString(),
  });

  const statusBreakdown: Record<string, Record<string, number>> = {};
  for (const r of latestRows) {
    const line = r.report_line ?? `Ikke mappet (${r.account}/${r.adversus_campaign_id})`;
    statusBreakdown[line] = statusBreakdown[line] ?? {};
    statusBreakdown[line][r.status] = (statusBreakdown[line][r.status] ?? 0) + r.lead_count;
  }
  return { mailQueued, statusBreakdown };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: sharedCorsHeaders });

  const auth = await requireCronOrOwner(req);
  if (auth instanceof Response) return auth;

  try {
    const body = (await req.json().catch(() => ({}))) as {
      weeks?: number;
      weeks_list?: string[];
      account?: AccountKey;
      campaign_index?: number;
      page?: number;
      send_mail?: boolean;
      triggered_by?: string;
    };
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const config = await loadConfig(svc);
    if (config.lines.length === 0) throw new Error("Rapportlinjerne mangler i opsætningen");
    await assertFieldsAllowed(svc);

    const state: ChunkState = {
      weeks: body.weeks_list ?? targetWeeks(Math.max(1, Math.min(Number(body.weeks ?? 1), 12))),
      account: body.account ?? "main",
      campaignIndex: body.campaign_index ?? 0,
      page: body.page ?? 1,
      sendMail: body.send_mail !== false,
      triggeredBy: body.triggered_by ?? (auth.userId ? "manuel" : "cron"),
    };

    // Start på en ny kæde: log kørslen, så den kan følges i Stork.
    if (!body.account) {
      await svc.from("weekly_lead_closure_runs").insert({
        account: state.account,
        weeks_covered: state.weeks.length,
        triggered_by: state.triggeredBy,
      });
    }

    const chunk = await processChunk(svc, config, state);

    // Løbende logning på kontoens seneste kørselsrække — kun tal, ingen lead-data.
    const { data: openRun } = await svc
      .from("weekly_lead_closure_runs")
      .select("id, campaigns_scanned, leads_scanned")
      .eq("account", state.account)
      .is("finished_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (openRun) {
      const row = openRun as { id: string; campaigns_scanned: number | null; leads_scanned: number | null };
      await svc
        .from("weekly_lead_closure_runs")
        .update({
          leads_scanned: (row.leads_scanned ?? 0) + chunk.scanned,
          campaigns_scanned: (row.campaigns_scanned ?? 0) + (chunk.nextPage ? 0 : 1),
          finished_at:
            !chunk.nextPage && state.campaignIndex + 1 >= chunk.campaignCount
              ? new Date().toISOString()
              : null,
        })
        .eq("id", row.id);
    }

    // Næste bid: flere sider → samme kampagne, ellers næste kampagne, ellers
    // næste konto, ellers færdig (mail).
    if (chunk.nextPage) {
      await chainNext({ ...state, page: chunk.nextPage });
      return json(200, { stage: "kører", account: state.account, page: chunk.nextPage });
    }
    if (state.campaignIndex + 1 < chunk.campaignCount) {
      await chainNext({ ...state, campaignIndex: state.campaignIndex + 1, page: 1 });
      return json(200, {
        stage: "kører",
        account: state.account,
        nextCampaignIndex: state.campaignIndex + 1,
        scanned: chunk.scanned,
      });
    }
    const nextAccountIndex = ACCOUNTS.findIndex((a) => a.key === state.account) + 1;
    if (nextAccountIndex < ACCOUNTS.length) {
      const nextAccount = ACCOUNTS[nextAccountIndex].key;
      await chainNext({ ...state, account: nextAccount, campaignIndex: 0, page: 1 });
      await svc.from("weekly_lead_closure_runs").insert({
        account: nextAccount,
        weeks_covered: state.weeks.length,
        triggered_by: state.triggeredBy,
      });
      return json(200, { stage: "kører", nextAccount });
    }

    const finished = await finishAndMail(svc, config, state);
    return json(200, { stage: "færdig", weeks: state.weeks, ...finished });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[weekly-lead-closure-report]", message);
    // Kæden kører i baggrunden, så fejlen skrives på kørselsrækken — ellers
    // stopper rapporten uden spor.
    try {
      const svc = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { autoRefreshToken: false, persistSession: false } },
      );
      const { data: openRun } = await svc
        .from("weekly_lead_closure_runs")
        .select("id")
        .is("finished_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (openRun) {
        await svc
          .from("weekly_lead_closure_runs")
          .update({ error: message, finished_at: new Date().toISOString() })
          .eq("id", (openRun as { id: string }).id);
      }
    } catch {
      // Logning må aldrig skjule den oprindelige fejl.
    }
    return json(500, { error: message });
  }
});
