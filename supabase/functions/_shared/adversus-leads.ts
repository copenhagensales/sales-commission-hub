// /v1/leads-hentning (plan v2.5 F1b-2, §2 greb 6): emner hentes fuldt og inkrementelt (filter lastUpdatedTime m. overlap), alle kampagner.
// Kampagnefelter (masterData/resultData = lister af {id, value}) lander i dialer_leads.felter som m:<feltid>/r:<feltid> – kun felter,
// kataloget har hentes = ja; ukendte felt-id'er oprettes automatisk i kataloget (klassifikation ukendt → UI). Ingen rå payload gemmes.
// deno-lint-ignore-file no-explicit-any -- supabase-js er 3rd party
import { anvendKatalog, sikrKampagnefelter, type Katalog } from "./kald-felt-katalog.ts";

export interface LeadFelt { id?: unknown; value?: unknown; name?: unknown; label?: unknown; type?: unknown }
export interface LeadEntry {
  id?: unknown; campaignId?: unknown; contactAttempts?: unknown; lastModifiedTime?: unknown; nextContactTime?: unknown; importedTime?: unknown;
  lastContactedBy?: unknown; status?: unknown; active?: unknown; externalId?: unknown; importId?: unknown;
  masterData?: LeadFelt[] | null; resultData?: LeadFelt[] | null;
}

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const tal = (v: unknown): number | null => { if (v === null || v === undefined || v === "") return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const tid = (v: unknown): string | null => { const s = str(v); if (!s) return null; const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d.toISOString(); };

/** Henter alle sider for et lastUpdatedTime-vindue – samme kontrakt som hentCallsV1: `komplet` = alle sider hentet (ellers flyttes vandmærket ikke).
 *  `udenForVindue` tæller emner, hvis lastModifiedTime ligger uden for vinduet – måler om filteret virker (jf. /calls' uvirksomme timestamp-filter). */
export async function hentLeadsV1(get: (sti: string) => Promise<unknown>, fra: string, til: string, opts: { maksSider?: number; stop?: () => boolean; pageSize?: number } = {}): Promise<{ entries: LeadEntry[]; sider: number; total: number | null; komplet: boolean; udenForVindue: number }> {
  const maksSider = opts.maksSider ?? 30, pageSize = opts.pageSize ?? 1000;
  const filt = encodeURIComponent(JSON.stringify({ lastUpdatedTime: { $gt: fra, $lt: til } }));
  const entries: LeadEntry[] = []; const set = new Set<string>(); let total: number | null = null; let sider = 0; let raa = 0; let komplet = false;
  for (let side = 1; side <= maksSider; side++) {
    if (opts.stop?.()) break;
    const data = (await get(`/leads?filters=${filt}&pageSize=${pageSize}&page=${side}&includeMeta=true`)) as { leads?: unknown; meta?: { pagination?: { pageCount?: unknown; total?: unknown } } } | null;
    if (!data || typeof data !== "object" || !Array.isArray(data.leads)) throw new Error(`leads_v1: ugyldigt svar på side ${side}`);
    const leads = data.leads as LeadEntry[];
    const pageCountRaa = data.meta?.pagination?.pageCount;
    const pageCount = typeof pageCountRaa === "number" ? pageCountRaa : Number.NaN;
    if (side === 1 && leads.length === 0 && (!Number.isFinite(pageCount) || pageCount <= 1)) { sider = 1; total = Number.isFinite(Number(data.meta?.pagination?.total)) ? Number(data.meta?.pagination?.total) : 0; komplet = total === 0; break; }
    if (!Number.isFinite(pageCount) || pageCount < 1) throw new Error(`leads_v1: meta.pagination.pageCount mangler på side ${side}`);
    sider++; raa += leads.length;
    for (const l of leads) { const id = str(l.id); if (id && !set.has(id)) { set.add(id); entries.push(l); } }
    const t = Number(data.meta?.pagination?.total); if (Number.isFinite(t)) total = t;
    if (side >= pageCount) { komplet = true; break; }
    if (leads.length === 0) break;
  }
  if (komplet && total != null && raa < total) komplet = false;
  const fraMs = new Date(fra).getTime(), tilMs = new Date(til).getTime();
  let udenForVindue = 0;
  for (const e of entries) { const m = tid(e.lastModifiedTime); if (m) { const ms = new Date(m).getTime(); if (ms < fraMs || ms > tilMs) udenForVindue++; } }
  return { entries, sider, total, komplet, udenForVindue };
}

/** Fuld hentning (første indlæsning, Codex F1b-2 P1): alle emner i id-orden med id > fraId, én side ad gangen (stabil cursor, 1 request pr. side).
 *  `faerdig` = siden var ikke fuld (ingen flere emner). Kører om natten under budgettet, indtil færdig; derefter kun inkrementel. */
export async function hentLeadsFuldSide(get: (sti: string) => Promise<unknown>, fraId: number, pageSize = 1000): Promise<{ entries: LeadEntry[]; sidsteId: number; faerdig: boolean }> {
  const filt = encodeURIComponent(JSON.stringify({ id: { $gt: fraId } }));
  const data = (await get(`/leads?filters=${filt}&sortProperty=id&sortDirection=asc&pageSize=${pageSize}&page=1`)) as { leads?: unknown } | null;
  if (!data || typeof data !== "object" || !Array.isArray(data.leads)) throw new Error("leads_v1_fuld: ugyldigt svar");
  const leads = data.leads as LeadEntry[];
  let sidsteId = fraId;
  for (const l of leads) { const id = tal(l.id); if (id != null && id > sidsteId) sidsteId = id; }
  if (leads.length > 0 && sidsteId === fraId) throw new Error("leads_v1_fuld: cursor flyttede sig ikke (id mangler/usorteret)");
  return { entries: leads, sidsteId, faerdig: leads.length < pageSize };
}

/** Kampagnefelter i et emne som katalog-ønsker (art m/r, id, evt. navn/type fra feltet selv). */
export function kampagnefelterI(e: LeadEntry): { art: "m" | "r"; id: number; navn?: string; type?: string }[] {
  const ud: { art: "m" | "r"; id: number; navn?: string; type?: string }[] = [];
  const tag = (liste: LeadFelt[] | null | undefined, art: "m" | "r") => {
    for (const f of liste ?? []) { const id = tal(f?.id); if (id == null) continue; ud.push({ art, id, navn: str(f.name) || str(f.label) || undefined, type: str(f.type) || undefined }); }
  };
  tag(e.masterData, "m"); tag(e.resultData, "r");
  return ud;
}

/** Mapper ét emne til en dialer_leads-række (før katalogfilter). felter = importId + m:<id>/r:<id>; null-værdier udelades. */
export function mapLeadEntry(e: LeadEntry, integrationId: string): Record<string, unknown> {
  const felter: Record<string, unknown> = {};
  if (e.importId !== null && e.importId !== undefined) felter.importId = e.importId;
  for (const f of e.masterData ?? []) { const id = tal(f?.id); if (id != null && f.value !== null && f.value !== undefined) felter[`m:${id}`] = f.value; }
  for (const f of e.resultData ?? []) { const id = tal(f?.id); if (id != null && f.value !== null && f.value !== undefined) felter[`r:${id}`] = f.value; }
  return {
    integration_id: integrationId,
    external_id: str(e.id),
    campaign_external_id: str(e.campaignId) || null,
    status: str(e.status) || null,
    aktiv: typeof e.active === "boolean" ? e.active : (e.active === null || e.active === undefined ? null : str(e.active).toLowerCase() === "true"),
    contact_attempts: tal(e.contactAttempts),
    last_modified: tid(e.lastModifiedTime),
    next_contact: tid(e.nextContactTime),
    imported: tid(e.importedTime),
    last_contacted_by: str(e.lastContactedBy) || null,
    ekstern_reference: str(e.externalId) || null,
    felter,
    updated_at: new Date().toISOString(),
  };
}

/** Sikrer katalogrækker for alle kampagnefelter i emnerne (pr. kampagne) og anvender kataloget på hver række.
 *  `feltDefinitioner` (lazy, /campaign-fields) bruges kun til navne/typer for felt-id'er, kataloget ikke kender, og som emnet ikke selv navngiver. */
export async function forberedLeads(svc: any, kat: Katalog, entries: LeadEntry[], integrationId: string, feltDefinitioner?: () => Promise<Map<number, { name: string; type: string }>>): Promise<{ raekker: Record<string, unknown>[]; nyeKatalogfelter: number; kasseredeNoegler: number }> {
  const prKampagne = new Map<string, Map<string, { art: "m" | "r"; id: number; navn?: string; type?: string }>>();
  for (const e of entries) {
    const kampagne = str(e.campaignId); if (!kampagne || !str(e.id)) continue;
    const m = prKampagne.get(kampagne) ?? new Map(); prKampagne.set(kampagne, m);
    for (const f of kampagnefelterI(e)) { const n = `${f.art}:${f.id}`; const eks = m.get(n); if (!eks || (!eks.navn && f.navn)) m.set(n, f); }
  }
  // Ukendte felter uden eget navn → slå op i /campaign-fields (ét request, kun ved behov)
  let defs: Map<number, { name: string; type: string }> | null = null;
  for (const [kampagne, m] of prKampagne) {
    for (const f of m.values()) {
      const sti = `${f.art === "m" ? "masterData" : "resultData"}.${f.id}`;
      const kendt = kat.raekker.some((r) => r.kilde === "adversus" && r.endpoint === "/leads" && r.felt_sti === sti && r.kampagne_ekstern_id === kampagne);
      if (kendt || f.navn) continue;
      if (!defs && feltDefinitioner) { try { defs = await feltDefinitioner(); } catch { defs = new Map(); } }
      const d = defs?.get(f.id); if (d) { f.navn = d.name; f.type = f.type ?? d.type; }
    }
  }
  let nye = 0;
  for (const [kampagne, m] of prKampagne) nye += await sikrKampagnefelter(svc, kat, kampagne, [...m.values()]);
  const raekker: Record<string, unknown>[] = []; let kasserede = 0;
  for (const e of entries) {
    if (!str(e.id)) continue;
    const r = anvendKatalog(kat, "dialer_leads", "adversus", mapLeadEntry(e, integrationId), { metadataFelt: "felter", kampagne: str(e.campaignId) || null });
    if (r.raekke.felter === null) r.raekke.felter = {};  // kolonnen er NOT NULL
    kasserede += r.kasserede_noegler.length;
    raekker.push(r.raekke);
  }
  return { raekker, nyeKatalogfelter: nye, kasseredeNoegler: kasserede };
}

/** /campaign-fields → Map<id, {name, type}> (svaret er en liste eller {fields:[…]}). */
export async function hentKampagnefeltDefinitioner(get: (sti: string) => Promise<unknown>): Promise<Map<number, { name: string; type: string }>> {
  const data = await get("/campaign-fields") as any;
  const liste: any[] = Array.isArray(data) ? data : Array.isArray(data?.fields) ? data.fields : Array.isArray(data?.campaignFields) ? data.campaignFields : [];
  const m = new Map<number, { name: string; type: string }>();
  for (const f of liste) { const id = tal(f?.id); if (id != null) m.set(id, { name: str(f.name) || `Kampagnefelt ${id}`, type: str(f.type) || "string" }); }
  return m;
}
