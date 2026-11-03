// B3 (krav 13–14): HeroBase-hook-payload (PostJson-skabelon eller egen skabelon med HeroBase' placeholders) → SessionDto til den fælles sink.
// Kun de felter, sessions-vejen allerede gemmer, læses; `data` (kundefelter) og alt andet ignoreres og gemmes aldrig.
import type { SessionDto } from "./sessions-sink.ts";

type Row = Record<string, unknown>;
const s = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());
/** Validering (Codex B3 r1): kun forventede former kommer videre – ugyldige felter kasseres (undefined), så databasefejl aldrig kan gengive payload-værdier. */
const ID_OK = /^[A-Za-z0-9@._:+-]{1,80}$/;         // emne-/kampagne-/bruger-id (orgCode kan være e-mail)
const ORD_OK = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/;     // closure/status: lukkede værdisæt
const id = (v: unknown): string | undefined => { const t = s(v); return ID_OK.test(t) ? t : undefined; };
const ord = (v: unknown): string | undefined => { const t = s(v); return ORD_OK.test(t) ? t : undefined; };
const tid = (v: unknown): string | undefined => { const t = s(v); if (!t || t.length > 40) return undefined; const ms = Date.parse(t); return Number.isFinite(ms) ? new Date(ms).toISOString() : undefined; };
export interface HookValidering { ok: boolean; kasseret: string[] }
const get1 = (o: unknown, keys: string[]): unknown => { if (!o || typeof o !== "object") return undefined; const r = o as Row; for (const k of keys) { const v = r[k]; if (v !== undefined && v !== null && v !== "") return v; const lk = k.toLowerCase(); for (const ok of Object.keys(r)) if (ok.toLowerCase() === lk && r[ok] !== undefined && r[ok] !== null && r[ok] !== "") return r[ok]; } return undefined; };
/** orgCode fra en bruger-reference: HeroBase sender enten orgCode som tekst eller et objekt { orgCode, name, username }. */
const orgCode = (v: unknown): string => (typeof v === "string" ? s(v) : s(get1(v, ["orgCode"])));

export function tilSessionDto(payload: unknown, dialerName: string, validering?: HookValidering): SessionDto | null {
  if (!payload || typeof payload !== "object") return null;
  const k = (navn: string) => { validering?.kasseret.push(navn); };
  const uniqueId = id(get1(payload, ["uniqueId", "UniqueId", "leadId", "LeadId"]));
  if (!uniqueId) return null;
  const closureRaa = s(get1(payload, ["closure", "Closure", "leadClosure"]));
  const closure = closureRaa ? ord(closureRaa) : undefined; if (closureRaa && !closure) k("closure");
  const campaignObj = get1(payload, ["campaign", "Campaign"]);
  const campaignRaa = s(get1(payload, ["campaignId", "CampaignId"])) || s(get1(campaignObj, ["uniqueId", "UniqueId"]));
  const campaignId = campaignRaa ? id(campaignRaa) : undefined; if (campaignRaa && !campaignId) k("campaignId");
  const agentRaa = orgCode(get1(payload, ["firstProcessedByUser", "FirstProcessedByUser"])) || orgCode(get1(payload, ["lastModifiedUser", "lastModifiedByUser", "LastModifiedByUser"]));
  const agent = agentRaa ? id(agentRaa) : undefined; if (agentRaa && !agent) k("bruger");
  const startRaa = s(get1(payload, ["firstProcessedTime", "FirstProcessedTime"])); const startTime = startRaa ? tid(startRaa) : undefined; if (startRaa && !startTime) k("firstProcessedTime");
  const endRaa = s(get1(payload, ["lastModifiedTime", "LastModifiedTime"])); const endTime = endRaa ? tid(endRaa) : undefined; if (endRaa && !endTime) k("lastModifiedTime");
  let sessionSeconds: number | undefined;
  if (startTime && endTime) { const d = Date.parse(endTime) - Date.parse(startTime); if (Number.isFinite(d) && d > 0) sessionSeconds = Math.round(d / 1000); }
  const navnRaa = s(get1(campaignObj, ["code", "Code", "name", "Name"])) || s(get1(payload, ["campaignCode", "CampaignCode", "campaignName", "CampaignName"]));
  const campaignName = navnRaa && navnRaa.length <= 120 ? navnRaa : undefined;
  return {
    externalId: uniqueId, integrationType: "enreach", dialerName, leadExternalId: uniqueId,
    agentExternalId: agent, campaignExternalId: campaignId,
    status: closure ? closure.toLowerCase() : "unknown", startTime, endTime, sessionSeconds, hasCdr: false,
    metadata: { closure: closure ?? "unknown", ...(campaignName ? { campaignName } : {}), via: "hook" },
  };
}
