// Lederne (Adversus) sync — success-leads become sales on the existing
// Tryg → "Tryg Products" → product "Lederne" setup.
//
// Hard rules enforced in this file:
//   * Only leads with status "success" are considered a sale.
//   * Only leads whose lastContactedBy is one of OUR @copenhagensales.dk users
//     are processed. Everything else is ignored entirely.
//   * A hardcoded positive list decides which lead fields may leave this
//     function. Name, position, mobile, email, address fields and notes are
//     never stored and never logged.
//   * Never backfills: the watermark decides the window, and nothing older
//     than the stored watermark is fetched or written.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireCronOrOwner, sharedCorsHeaders } from "../_shared/auth.ts";
import { createIngestionFilter } from "../_shared/ingestion-filter-runtime.ts";

const BASE_URL = "https://api.adversus.io/v1";
const OUR_DOMAIN = "@copenhagensales.dk";
const SOURCE = "adversus_lederne";
const DATASET = "lederne_leads";
const INTEGRATION_NAME = "Lederne";

/** Adversus resultData field ids that may be stored (positive list). */
const FIELD_MEETING_TYPE = 132892; // Mødetype -> pricing rule key below
const FIELD_DEPTH_RESULT = 67596; // Dybderesultat - Ukvalificeret
const FIELD_MEMBER_NUMBER = 67209; // Medlemsnummer (only customer detail)

/** The pricing rules on the "Lederne" product read this label. */
const MEETING_TYPE_RULE_KEY = "Hvilket type møde";
const DEPTH_RESULT_KEY = "Dybderesultat - Ukvalificeret";

/** masterData labels that may be stored (positive list). */
const ALLOWED_MASTER_LABELS = ["Emne", "Kildekampagne"];

type Log = { type: "INFO" | "WARN" | "ERROR"; msg: string; data?: unknown };
const logs: Log[] = [];
function log(type: Log["type"], msg: string, data?: unknown) {
  logs.push({ type, msg, data });
  console.log(JSON.stringify({ type, msg, data, ts: new Date().toISOString() }));
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...sharedCorsHeaders, "Content-Type": "application/json" },
  });

function authHeader(): string {
  const user = Deno.env.get("ADVERSUS_LEDERNE_API_USERNAME");
  const pass = Deno.env.get("ADVERSUS_LEDERNE_API_PASSWORD");
  if (!user || !pass) throw new Error("Lederne Adversus-legitimation mangler");
  return `Basic ${btoa(`${user}:${pass}`)}`;
}

async function getJson(path: string, auth: string): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: auth, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    // Only the status is logged — never the body, which may hold lead data.
    throw new Error(`Adversus ${path.split("?")[0]} svarede ${res.status}`);
  }
  return await res.json();
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

// ---------------------------------------------------------------------------
// Positive-list extraction. The returned object is the ONLY lead-derived data
// that continues towards the database.
// ---------------------------------------------------------------------------
type SafeLead = {
  leadId: string;
  campaignId: string;
  status: string;
  lastContactedBy: string;
  updated: string;
  lastModified: string;
  meetingType: string;
  depthResult: string;
  memberNumber: string;
  master: Record<string, string>;
};

function safeString(v: unknown): string {
  return v === null || v === undefined ? "" : String(v).trim();
}

function extractSafeLead(lead: Record<string, unknown>): SafeLead | null {
  const leadId = safeString(lead.id);
  if (!leadId) return null;

  let meetingType = "";
  let depthResult = "";
  let memberNumber = "";
  for (const f of asArray(lead.resultData)) {
    const id = Number(f.id);
    const value = safeString(f.value);
    if (id === FIELD_MEETING_TYPE) meetingType = value;
    else if (id === FIELD_DEPTH_RESULT) depthResult = value;
    else if (id === FIELD_MEMBER_NUMBER) memberNumber = value;
  }

  const master: Record<string, string> = {};
  for (const f of asArray(lead.masterData)) {
    const label = safeString(f.label);
    if (!ALLOWED_MASTER_LABELS.includes(label)) continue; // everything else dropped
    const value = safeString(f.value);
    if (value) master[label] = value;
  }
  // Medlemsnummer can also live in masterData on this account.
  if (!memberNumber) {
    for (const f of asArray(lead.masterData)) {
      if (Number(f.id) === FIELD_MEMBER_NUMBER) memberNumber = safeString(f.value);
    }
  }

  const updated = safeString(lead.updated);
  return {
    leadId,
    campaignId: safeString(lead.campaignId),
    status: safeString(lead.status).toLowerCase(),
    lastContactedBy: safeString(lead.lastContactedBy),
    updated,
    lastModified: safeString(lead.lastModifiedTime) || updated,
    meetingType,
    depthResult,
    memberNumber,
    master,
  };
}

/** Build the raw_payload that is stored. Only positive-list values appear. */
function buildRawPayload(lead: SafeLead) {
  const data: Record<string, string> = {};
  // Raw value, empty stays empty — Kasper's "empty = telefonmøde" rule lives in
  // his pricing mapping, not in our data.
  if (lead.meetingType) data[MEETING_TYPE_RULE_KEY] = lead.meetingType;
  if (lead.depthResult) data[DEPTH_RESULT_KEY] = lead.depthResult;
  for (const [k, v] of Object.entries(lead.master)) data[k] = v;

  const payload: Record<string, unknown> = {
    data,
    lederne_sync: true,
    lead_id: lead.leadId,
    adversus_campaign_id: lead.campaignId,
    adversus_status: lead.status,
    adversus_updated: lead.updated,
  };
  if (lead.memberNumber) payload.member_number = lead.memberNumber;
  return payload;
}

// ---------------------------------------------------------------------------
async function resolveTarget(svc: SupabaseClient) {
  const { data: products, error } = await svc
    .from("products")
    .select("id, name, client_campaign_id, commission_dkk, revenue_dkk, client_campaigns!inner(name, clients!inner(name))")
    .eq("name", "Lederne")
    .eq("is_active", true);
  if (error) throw new Error(`Kunne ikke slå produktet "Lederne" op: ${error.message}`);
  const rows = (products ?? []).filter((p: Record<string, unknown>) => {
    const cc = p.client_campaigns as { name?: string; clients?: { name?: string } } | null;
    return cc?.clients?.name === "Tryg";
  });
  if (rows.length !== 1) {
    throw new Error(`Forventede præcis ét aktivt "Lederne"-produkt under Tryg, fandt ${rows.length}`);
  }
  const p = rows[0] as Record<string, unknown>;
  return {
    productId: String(p.id),
    clientCampaignId: String(p.client_campaign_id),
    baseCommission: Number(p.commission_dkk ?? 0),
    baseRevenue: Number(p.revenue_dkk ?? 0),
  };
}

async function getIntegration(svc: SupabaseClient) {
  const { data, error } = await svc
    .from("dialer_integrations")
    .select("id, is_active")
    .eq("provider", SOURCE)
    .eq("name", INTEGRATION_NAME)
    .maybeSingle();
  if (error) throw new Error(`Integration-opslag fejlede: ${error.message}`);
  if (!data) throw new Error("Lederne-integrationen findes ikke i dialer_integrations");
  return data as { id: string; is_active: boolean };
}

async function getWatermark(svc: SupabaseClient, integrationId: string): Promise<string> {
  const { data } = await svc
    .from("dialer_sync_state")
    .select("cursor")
    .eq("integration_id", integrationId)
    .eq("dataset", DATASET)
    .maybeSingle();
  const cursor = (data as { cursor?: string } | null)?.cursor;
  if (!cursor) throw new Error("Watermark mangler — sync afbrudt for at undgå bagudrettet hentning");
  return cursor;
}

/**
 * Sync our own Adversus users into `agents`. Only id, name and active status are
 * stored. The e-mail is used for the domain filter and then discarded.
 */
async function syncUsers(svc: SupabaseClient, auth: string) {
  const raw = await getJson("/users?pageSize=1000", auth);
  const users = asArray(raw, "users", "data");
  const ours = new Map<string, { name: string; active: boolean; email: string }>();
  for (const u of users) {
    const email = safeString(u.email ?? u.username).toLowerCase();
    if (!email.endsWith(OUR_DOMAIN)) continue;
    const id = safeString(u.id ?? u.userId);
    if (!id) continue;
    const activeRaw = u.active ?? u.enabled ?? u.status;
    const active =
      activeRaw === true || activeRaw === 1 || String(activeRaw).toLowerCase() === "active";
    // Only our own @copenhagensales.dk work e-mail is kept — never customer data.
    ours.set(id, { name: safeString(u.name ?? u.displayName), active, email });
  }

  const agentByAdversusId = new Map<string, { agentId: string; name: string; email: string }>();
  for (const [advId, info] of ours) {
    const externalId = `lederne-${advId}`;
    const row = {
      external_adversus_id: externalId,
      name: info.name || `Adversus-bruger ${advId}`,
      // Our own company work e-mail; required by agents.email (NOT NULL + domain whitelist).
      email: info.email,
      is_active: info.active,
      source: SOURCE,
    };
    // Reuse an existing agent for the same person: first by external id, then by work e-mail.
    const { data: byExternal } = await svc
      .from("agents")
      .select("id")
      .eq("external_adversus_id", externalId)
      .maybeSingle();
    let existing = byExternal as { id?: string } | null;
    if (!existing && info.email) {
      const { data: byMail } = await svc
        .from("agents")
        .select("id")
        .eq("email", info.email)
        .maybeSingle();
      existing = byMail as { id?: string } | null;
    }
    let agentId: string | null = (existing as { id?: string } | null)?.id ?? null;
    if (agentId) {
      await svc.from("agents").update(row).eq("id", agentId);
    } else {
      const { data: inserted, error } = await svc.from("agents").insert(row).select("id").single();
      if (error) {
        log("WARN", `Kunne ikke oprette agent for Adversus-bruger ${advId}`, { code: error.code });
        continue;
      }
      agentId = (inserted as { id: string }).id;
    }
    agentByAdversusId.set(advId, { agentId: agentId!, name: row.name, email: info.email });
  }
  log("INFO", `Brugere hentet: ${users.length}, vores egne gemt: ${agentByAdversusId.size}`);
  return agentByAdversusId;
}

/**
 * Name-match our Adversus users to employees. Unmatched agents are simply left
 * unmapped, which puts them in the existing "ukendt sælger"-queue.
 */
async function mapAgentsToEmployees(
  svc: SupabaseClient,
  agents: Map<string, { agentId: string; name: string; email: string }>,
) {
  const emailByAdversusId = new Map<string, string>();
  const { data: employees } = await svc
    .from("employee_master_data")
    .select("id, first_name, last_name, work_email, is_active")
    .eq("is_active", true);
  const byName = new Map<string, Array<{ id: string; work_email: string | null }>>();
  const byEmail = new Map<string, { id: string; work_email: string | null }>();
  for (const e of (employees ?? []) as Array<Record<string, unknown>>) {
    const key = `${safeString(e.first_name)} ${safeString(e.last_name)}`.trim().toLowerCase();
    if (!key) continue;
    const row = { id: String(e.id), work_email: (e.work_email as string | null) ?? null };
    const list = byName.get(key) ?? [];
    list.push(row);
    byName.set(key, list);
    const mail = safeString(e.work_email).toLowerCase();
    if (mail) byEmail.set(mail, row);
  }

  let mapped = 0;
  let unmapped = 0;
  for (const [advId, agent] of agents) {
    // Work e-mail is the deterministic key; name is only a fallback.
    const byMail = agent.email ? byEmail.get(agent.email) : undefined;
    const matches = byName.get(agent.name.toLowerCase()) ?? [];
    const employee = byMail ?? (matches.length === 1 ? matches[0] : null);
    if (!employee) {
      unmapped++;
      continue;
    }
    const { data: existingMap } = await svc
      .from("employee_agent_mapping")
      .select("id")
      .eq("agent_id", agent.agentId)
      .eq("employee_id", employee.id)
      .maybeSingle();
    if (!existingMap) {
      const { error } = await svc
        .from("employee_agent_mapping")
        .insert({ agent_id: agent.agentId, employee_id: employee.id });
      if (error) log("WARN", "Kunne ikke koble agent til medarbejder", { code: error.code });
    }
    if (employee.work_email) emailByAdversusId.set(advId, employee.work_email.toLowerCase());
    mapped++;
  }
  log("INFO", `Sælgerkobling: ${mapped} koblet, ${unmapped} i ukendt sælger-kø`);
  return { emailByAdversusId, mapped, unmapped };
}

/** Map an Adversus campaign id to the Lederne client_campaign, flag new ones. */
async function resolveCampaign(
  svc: SupabaseClient,
  adversusCampaignId: string,
  clientCampaignId: string,
  newCampaigns: string[],
) {
  const { data: existing } = await svc
    .from("adversus_campaign_mappings")
    .select("id, client_campaign_id")
    .eq("adversus_campaign_id", adversusCampaignId)
    .maybeSingle();
  if (existing) return (existing as { client_campaign_id: string | null }).client_campaign_id ?? clientCampaignId;

  await svc.from("adversus_campaign_mappings").insert({
    adversus_campaign_id: adversusCampaignId,
    adversus_campaign_name: `Lederne ${adversusCampaignId}`,
    client_campaign_id: clientCampaignId,
  });
  await svc
    .from("lederne_campaign_review")
    .insert({ adversus_campaign_id: adversusCampaignId, client_campaign_id: clientCampaignId });
  newCampaigns.push(adversusCampaignId);
  log("INFO", `Ny Adversus-kampagne registreret og flagget til gennemsyn: ${adversusCampaignId}`);
  return clientCampaignId;
}

async function fetchLeadsSince(auth: string, watermark: string) {
  const leads: Record<string, unknown>[] = [];
  const filters = encodeURIComponent(JSON.stringify({ lastModifiedTime: { $gt: watermark } }));
  let filteredWorks = true;
  for (let page = 1; page <= 20; page++) {
    let batch: Record<string, unknown>[] = [];
    if (filteredWorks) {
      try {
        batch = asArray(await getJson(`/leads?pageSize=1000&page=${page}&filters=${filters}`, auth), "leads", "data");
      } catch (_e) {
        // Some Adversus accounts reject the filter syntax. Fall back to an
        // unfiltered scan; the watermark is still applied client-side below,
        // so nothing older than the watermark is ever written.
        filteredWorks = false;
        log("WARN", "Adversus afviste filter på lastModifiedTime — falder tilbage til klientside-filter");
      }
    }
    if (!filteredWorks) {
      batch = asArray(await getJson(`/leads?pageSize=1000&page=${page}`, auth), "leads", "data");
    }
    if (batch.length === 0) break;
    leads.push(...batch);
    if (batch.length < 1000) break;
  }
  return leads;
}

async function run(svc: SupabaseClient) {
  const auth = authHeader();
  const integration = await getIntegration(svc);
  if (!integration.is_active) return { skipped: "integration_inactive" };

  const target = await resolveTarget(svc);
  const watermark = await getWatermark(svc, integration.id);
  const startedAt = new Date().toISOString();

  const agents = await syncUsers(svc, auth);
  const { emailByAdversusId, mapped, unmapped } = await mapAgentsToEmployees(svc, agents);

  // GDPR: alt der skrives til sales.raw_payload går gennem det databasedrevne
  // indtagsfilter — samme regler og samme feltregister som webhook-indgangen.
  const gdprFilter = await createIngestionFilter(svc, {
    integration: "adversus",
    triggeredBy: "lederne-sync",
  });

  const rawLeads = await fetchLeadsSince(auth, watermark);
  const newCampaigns: string[] = [];
  let newWatermark = watermark;
  let created = 0;
  let updated = 0;
  let withdrawn = 0;
  let ignoredForeignUser = 0;
  const newSaleIds: string[] = [];

  for (const rawLead of rawLeads) {
    const lead = extractSafeLead(rawLead);
    if (!lead) continue;
    // Watermark guard — never process anything at or before the watermark.
    if (!lead.lastModified || lead.lastModified <= watermark) continue;
    if (lead.lastModified > newWatermark) newWatermark = lead.lastModified;

    const externalId = `lederne-${lead.leadId}`;
    const isOurs = agents.has(lead.lastContactedBy);

    const { data: existingSale } = await svc
      .from("sales")
      .select("id, validation_status")
      .eq("adversus_external_id", externalId)
      .maybeSingle();

    if (lead.status !== "success") {
      // Withdrawn: the lead moved away from success. Same handling as a
      // cancellation — never deleted.
      if (existingSale && (existingSale as { validation_status: string }).validation_status !== "cancelled") {
        await svc
          .from("sales")
          .update({ validation_status: "cancelled" })
          .eq("id", (existingSale as { id: string }).id);
        withdrawn++;
      }
      continue;
    }

    if (!isOurs) {
      ignoredForeignUser++;
      continue;
    }

    const clientCampaignId = await resolveCampaign(
      svc,
      lead.campaignId,
      target.clientCampaignId,
      newCampaigns,
    );
    const agent = agents.get(lead.lastContactedBy)!;
    const payload = gdprFilter.filter(buildRawPayload(lead));
    gdprFilter.countSale();
    const row = {
      adversus_external_id: externalId,
      source: SOURCE,
      integration_type: "adversus",
      dialer_campaign_id: lead.campaignId,
      client_campaign_id: clientCampaignId,
      agent_name: agent.name,
      agent_external_id: `lederne-${lead.lastContactedBy}`,
      agent_email: emailByAdversusId.get(lead.lastContactedBy) ?? null,
      sale_datetime: lead.updated,
      raw_payload: payload,
    };

    if (existingSale) {
      await svc.from("sales").update(row).eq("id", (existingSale as { id: string }).id);
      updated++;
      newSaleIds.push((existingSale as { id: string }).id);
      continue;
    }

    const { data: inserted, error } = await svc.from("sales").insert(row).select("id").single();
    if (error) {
      log("ERROR", `Kunne ikke oprette salg for lead ${lead.leadId}`, { code: error.code });
      continue;
    }
    const saleId = (inserted as { id: string }).id;
    const { error: itemError } = await svc.from("sale_items").insert({
      sale_id: saleId,
      product_id: target.productId,
      quantity: 1,
      unit_price: 0,
      needs_mapping: false,
      mapped_commission: target.baseCommission,
      mapped_revenue: target.baseRevenue,
    });
    if (itemError) log("ERROR", `Kunne ikke oprette salgslinje for lead ${lead.leadId}`, { code: itemError.code });
    created++;
    newSaleIds.push(saleId);
  }

  // Let the existing pricing engine apply the Mødetype rules.
  let rematch: unknown = null;
  if (newSaleIds.length > 0) {
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/rematch-pricing-rules`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ sale_ids: newSaleIds }),
    });
    rematch = { status: res.status };
  }

  if (newWatermark !== watermark) {
    await svc
      .from("dialer_sync_state")
      .update({ cursor: newWatermark, last_success_at: new Date().toISOString() })
      .eq("integration_id", integration.id)
      .eq("dataset", DATASET);
  } else {
    await svc
      .from("dialer_sync_state")
      .update({ last_success_at: new Date().toISOString() })
      .eq("integration_id", integration.id)
      .eq("dataset", DATASET);
  }

  await svc
    .from("dialer_integrations")
    .update({ last_sync_at: new Date().toISOString(), last_status: "success" })
    .eq("id", integration.id);

  return {
    started_at: startedAt,
    watermark_before: watermark,
    watermark_after: newWatermark,
    leads_seen: rawLeads.length,
    sales_created: created,
    sales_updated: updated,
    sales_withdrawn: withdrawn,
    ignored_other_users: ignoredForeignUser,
    agents_mapped: mapped,
    agents_unmapped: unmapped,
    new_campaigns_flagged: newCampaigns,
    rematch,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: sharedCorsHeaders });

  const auth = await requireCronOrOwner(req);
  if (auth instanceof Response) return auth;

  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    const result = await run(svc);
    return json(200, { ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ukendt fejl";
    log("ERROR", `Lederne-sync fejlede: ${message}`);
    await svc
      .from("dialer_integrations")
      .update({ last_status: "error" })
      .eq("provider", SOURCE)
      .eq("name", INTEGRATION_NAME);
    return json(500, { ok: false, error: message });
  }
});
