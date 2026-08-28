// One-off, tightly scoped Adversus lookup/import action.
//
// mode = "lookup"  -> READ ONLY. Finds Adversus sales by OPP number, lead id,
//                     sale id, phone or owner (Adversus user id) and returns
//                     detail incl. lead result fields and product lines.
// mode = "import"  -> INSERT ONLY. Imports ONLY the explicitly listed Adversus
//                     sale ids through the standard processSales pipeline, so
//                     pricing / sale_items / commission are identical to a
//                     normal sync. Sale ids that already exist in `sales`
//                     (adversus_external_id) are skipped, never updated.
//
// Guards: no date-range import, no delete, no rematch of other sales,
// no watermark or sync-run updates.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { processSales } from "../core/sales.ts";
import { getCampaignMappings } from "../core/mappings.ts";
import type { StandardSale } from "../types.ts";
import type { LogFn } from "../utils/index.ts";

const BASE_URL = "https://api.adversus.io";
const OPP_PATTERN = /OPP-?\d{4,8}/;
const MAX_IMPORT_IDS = 5;

function digits(v: unknown): string {
  return String(v ?? "").replace(/[^0-9]/g, "");
}

async function adversusGet(url: string, auth: string) {
  const res = await fetch(url, { headers: { Authorization: auth, "Content-Type": "application/json" } });
  if (!res.ok) throw new Error(`Adversus ${res.status} on ${url}: ${(await res.text()).slice(0, 300)}`);
  return await res.json();
}

async function getAuth(supabase: SupabaseClient, integrationName: string) {
  const { data: integration, error } = await supabase
    .from("dialer_integrations")
    .select("id, name, provider")
    .ilike("name", integrationName)
    .single();
  if (error || !integration) throw new Error(`Integration not found: ${integrationName}`);

  const encryptionKey = Deno.env.get("DB_ENCRYPTION_KEY");
  if (!encryptionKey) throw new Error("DB_ENCRYPTION_KEY not configured");

  const { data: creds, error: credErr } = await supabase.rpc("get_dialer_credentials", {
    p_integration_id: integration.id,
    p_encryption_key: encryptionKey,
  });
  if (credErr || !creds) throw new Error(`Could not decrypt credentials: ${credErr?.message}`);

  const username = (creds as any).username || (creds as any).ADVERSUS_API_USERNAME;
  const password = (creds as any).password || (creds as any).ADVERSUS_API_PASSWORD;
  if (!username || !password) throw new Error("Missing Adversus credentials");

  return { integration, auth: `Basic ${btoa(`${username}:${password}`)}` };
}

async function fetchSalesWindow(auth: string, days: number, maxPages: number): Promise<any[]> {
  const start = new Date();
  start.setDate(start.getDate() - days);
  const filters = encodeURIComponent(JSON.stringify({ lastModifiedTime: { $gt: start.toISOString() } }));
  const all: any[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const data = await adversusGet(`${BASE_URL}/sales?pageSize=1000&page=${page}&filters=${filters}`, auth);
    const sales = Array.isArray(data) ? data : (data.sales || []);
    all.push(...sales);
    if (sales.length < 1000) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  return all;
}

async function fetchLead(auth: string, leadId: string) {
  const data = await adversusGet(`${BASE_URL}/v1/leads/${leadId}`, auth);
  const lead = data?.leads && Array.isArray(data.leads) ? data.leads[0] : data;
  if (!lead) return null;
  const resultData: any[] = Array.isArray(lead.resultData) ? lead.resultData : [];
  const resultFields: Record<string, unknown> = {};
  let opp: string | null = null;
  for (const f of resultData) {
    const name = f?.name ?? f?.label;
    if (name === undefined) continue;
    resultFields[name] = f.value;
    if (f.value && !opp) {
      const m = String(f.value).match(OPP_PATTERN);
      if (m) opp = m[0];
    }
  }
  let phone = lead.phone || lead.contactPhone || lead.mobile || null;
  if (!phone && lead.contactData) {
    const cd = lead.contactData;
    phone = cd.Telefonnummer1 || cd["Kontakt nummer"] || cd.phone || cd.mobile || cd.Mobil || cd.Telefon || null;
  }
  return { lead, opp, resultData, resultFields, phone };
}

async function fetchUsers(auth: string) {
  const data = await adversusGet(`${BASE_URL}/v1/users`, auth);
  const users = data?.users || data || [];
  const map = new Map<string, { id: string; name: string; email: string | null }>();
  for (const u of users) {
    map.set(String(u.id), { id: String(u.id), name: u.name || u.displayName || "", email: u.email || null });
  }
  return map;
}

const ownerOf = (s: any) => String(typeof s.ownedBy === "object" ? s.ownedBy?.id ?? "" : s.ownedBy ?? "");
const creatorOf = (s: any) => String(typeof s.createdBy === "object" ? s.createdBy?.id ?? "" : s.createdBy ?? "");

export async function importSingleSale(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  log: LogFn,
) {
  const mode = String(body.mode || "lookup");
  const integrationName = String(body.integration_name || "Lovablecph");
  const days = Number(body.days ?? 14);
  const maxPages = Number(body.max_pages ?? 10);

  const oppList = ((body.opp as unknown[]) || []).map((o) => digits(o)).filter(Boolean);
  const leadIds = ((body.lead_ids as unknown[]) || []).map(String);
  const saleIds = ((body.sale_ids as unknown[]) || []).map(String);
  const phones = ((body.phones as unknown[]) || []).map(digits).filter(Boolean);
  const ownerIds = ((body.owner_ids as unknown[]) || []).map(String);
  const campaignIds = ((body.campaign_ids as unknown[]) || []).map(String);

  const { integration, auth } = await getAuth(supabase, integrationName);

  // READ ONLY: list distinct sale owners in the window (no lead calls, fast)
  if (mode === "owners") {
    const raw = await fetchSalesWindow(auth, days, maxPages);
    const users = await fetchUsers(auth).catch(() => new Map());
    const nameFilter = String(body.name_contains || "").toLowerCase();
    const agg = new Map<string, any>();
    for (const s of raw) {
      if (campaignIds.length && !campaignIds.includes(String(s.campaignId))) continue;
      const id = ownerOf(s) || creatorOf(s);
      const u = users.get(id);
      const key = id || "unknown";
      const row = agg.get(key) || {
        ownerId: id,
        name: (typeof s.ownedBy === "object" ? s.ownedBy?.name : null) || u?.name || null,
        email: (typeof s.ownedBy === "object" ? s.ownedBy?.email : null) || u?.email || null,
        campaigns: new Set<string>(),
        count: 0,
        saleIds: [] as string[],
      };
      row.count++;
      row.campaigns.add(String(s.campaignId));
      if (row.saleIds.length < 10) row.saleIds.push(String(s.id));
      agg.set(key, row);
    }
    let owners = [...agg.values()].map((r) => ({ ...r, campaigns: [...r.campaigns] }));
    if (nameFilter) {
      owners = owners.filter((o) =>
        `${o.name ?? ""} ${o.email ?? ""}`.toLowerCase().includes(nameFilter)
      );
    }
    owners.sort((a, b) => b.count - a.count);
    return { success: true, mode, window: { days, rawSalesFetched: raw.length }, owners };
  }

  if (mode === "lookup") {
    const raw = await fetchSalesWindow(auth, days, maxPages);

    let candidates = raw.filter((s: any) => {
      if (saleIds.length && saleIds.includes(String(s.id))) return true;
      if (leadIds.length && leadIds.includes(String(s.leadId))) return true;
      if (ownerIds.length && (ownerIds.includes(ownerOf(s)) || ownerIds.includes(creatorOf(s)))) return true;
      return false;
    });

    // Only OPP / phone given: we must inspect leads, so narrow by campaign first
    const needLeadScan = candidates.length === 0 && (oppList.length > 0 || phones.length > 0);
    if (needLeadScan) {
      candidates = raw.filter((s: any) => !campaignIds.length || campaignIds.includes(String(s.campaignId)));
    }

    const scanLimit = Number(body.scan_limit ?? 60);
    const scanned = candidates.slice(0, scanLimit);
    const users = await fetchUsers(auth).catch(() => new Map());

    const results: any[] = [];
    for (const s of scanned) {
      const leadInfo = s.leadId ? await fetchLead(auth, String(s.leadId)).catch(() => null) : null;
      const oppDigits = digits(leadInfo?.opp);
      const phoneDigits = digits(leadInfo?.phone || s.lead?.phone);

      const oppMatch = oppList.some((o) => oppDigits && oppDigits === o);
      const phoneMatch = phones.some((p) => phoneDigits && (phoneDigits.endsWith(p) || p.endsWith(phoneDigits)));
      const keep = needLeadScan ? (oppMatch || phoneMatch) : true;

      if (keep) {
        const ownerId = ownerOf(s) || creatorOf(s);
        const u = users.get(ownerId);
        results.push({
          saleId: s.id,
          leadId: s.leadId,
          campaignId: s.campaignId,
          state: s.state,
          createdTime: s.createdTime,
          closedTime: s.closedTime,
          lastModifiedTime: s.lastModifiedTime,
          ownerId,
          ownerName: u?.name || null,
          ownerEmail: u?.email || null,
          opp: leadInfo?.opp || null,
          phone: leadInfo?.phone || s.lead?.phone || null,
          company: s.lead?.company || leadInfo?.lead?.company || null,
          lines: (s.lines || []).map((l: any) => ({
            productId: l.productId, title: l.title, quantity: l.quantity, unitPrice: l.unitPrice,
          })),
          resultFields: leadInfo?.resultFields || {},
        });
      }
      await new Promise((r) => setTimeout(r, 1100)); // Adversus rate limit
    }

    const foundIds = results.map((r) => String(r.saleId));
    const { data: existing } = await supabase
      .from("sales")
      .select("id, adversus_external_id, sale_datetime, agent_email, client_campaign_id")
      .in("adversus_external_id", foundIds.length ? foundIds : ["__none__"]);

    return {
      success: true,
      mode,
      integration: { id: integration.id, name: integration.name },
      window: { days, rawSalesFetched: raw.length, candidates: candidates.length, scanned: scanned.length },
      results,
      alreadyInStork: existing || [],
    };
  }

  if (mode === "import") {
    if (saleIds.length === 0) return { success: false, error: "sale_ids is required for mode=import" };
    if (saleIds.length > MAX_IMPORT_IDS) {
      return { success: false, error: `Refusing to import more than ${MAX_IMPORT_IDS} sale ids in one call` };
    }

    // Insert-only guard
    const { data: existing } = await supabase
      .from("sales")
      .select("adversus_external_id")
      .in("adversus_external_id", saleIds);
    const existingIds = new Set((existing || []).map((r: any) => String(r.adversus_external_id)));
    const targetIds = saleIds.filter((id) => !existingIds.has(id));
    if (targetIds.length === 0) {
      return {
        success: true, mode, inserted: 0, skippedExisting: [...existingIds],
        note: "All sale ids already exist in Stork – nothing written.",
      };
    }

    const raw = await fetchSalesWindow(auth, days, maxPages);
    const rawTargets = raw.filter((s: any) => targetIds.includes(String(s.id)));
    const notFound = targetIds.filter((id) => !rawTargets.some((s: any) => String(s.id) === id));
    if (rawTargets.length === 0) {
      return { success: false, error: "None of the requested sale ids were found in Adversus within the window", notFound, window: { days } };
    }

    const mappings = await getCampaignMappings(supabase);
    const campaignMap = new Map(mappings.map((m: any) => [String(m.adversusCampaignId), m]));
    const users = await fetchUsers(auth).catch(() => new Map());

    const standardSales: StandardSale[] = [];
    const problems: any[] = [];

    for (const s of rawTargets) {
      const ownerId = ownerOf(s) || creatorOf(s);
      const u = users.get(ownerId);
      // Optional override: used when the Adversus user has a private email
      // (which the normal sync filters out) but the seller is a known employee.
      const agentEmail = (body.agent_email_override ? String(body.agent_email_override) : null)
        || (typeof s.ownedBy === "object" ? s.ownedBy?.email : null) || u?.email || null;
      const agentName = (typeof s.ownedBy === "object" ? s.ownedBy?.name : null) || u?.name || "Ukendt";

      if (!agentEmail) {
        problems.push({ saleId: s.id, reason: "No agent email resolved in Adversus" });
        continue;
      }

      const campaignId = s.campaignId ? String(s.campaignId) : undefined;
      const mapping: any = campaignId ? campaignMap.get(campaignId) : undefined;
      if (!mapping?.clientCampaignId) {
        problems.push({ saleId: s.id, reason: `Adversus campaign ${campaignId} is not mapped to a client campaign` });
        continue;
      }

      const leadInfo = s.leadId ? await fetchLead(auth, String(s.leadId)).catch(() => null) : null;

      standardSales.push({
        externalId: String(s.id),
        leadId: s.leadId ? String(s.leadId) : null,
        integrationType: "adversus",
        dialerName: integration.name,
        saleDate: s.closedTime || s.createdTime,
        agentExternalId: ownerId,
        agentEmail,
        agentName,
        customerName: s.lead?.company || s.lead?.name || "",
        customerPhone: s.lead?.phone || leadInfo?.phone || "",
        campaignId,
        campaignName: s.campaign?.name || undefined,
        externalReference: leadInfo?.opp || null,
        clientCampaignId: mapping.clientCampaignId,
        products: (s.lines || []).map((l: any) => ({
          name: l.title || "Producto desconocido",
          externalId: String(l.productId),
          quantity: l.quantity || 1,
          unitPrice: l.unitPrice || 0,
          metadata: { rawLineId: l.id },
        })),
        rawPayload: {
          ...s,
          leadResultData: leadInfo?.resultData || [],
          leadResultFields: leadInfo?.resultFields || {},
          manualImport: { by: "integration-engine/import-single-sale", at: new Date().toISOString() },
        },
        metadata: { campaignId: s.campaignId, leadId: s.leadId, lead: s.lead },
      } as StandardSale);

      await new Promise((r) => setTimeout(r, 1100));
    }

    if (standardSales.length === 0) {
      return { success: false, mode, inserted: 0, problems, notFound, note: "Nothing imported." };
    }

    const processResult = await processSales(supabase, standardSales, 10, log);

    const insertedIds = standardSales.map((s) => s.externalId);
    const { data: inserted } = await supabase
      .from("sales")
      .select("id, adversus_external_id, sale_datetime, agent_email, agent_name, client_campaign_id, internal_reference, sale_items(product_id, adversus_product_title, quantity, mapped_commission, mapped_revenue, needs_mapping)")
      .in("adversus_external_id", insertedIds);

    await supabase.from("integration_logs").insert({
      integration_type: "manual-import",
      integration_name: "import-single-sale",
      status: "success",
      message: `Imported ${insertedIds.join(", ")} from ${integration.name}`,
      details: { saleIds: insertedIds, skippedExisting: [...existingIds], problems, notFound },
    });

    log("INFO", `import-single-sale done`, { insertedIds, problems, notFound });

    return {
      success: true,
      mode,
      requested: saleIds,
      skippedExisting: [...existingIds],
      notFound,
      problems,
      processResult,
      inserted,
    };
  }

  return { success: false, error: `Unknown mode: ${mode}` };
}
