// /v1/calls-mapper (plan v2.4 F1a): dokumenteret endpoint i stedet for det udokumenterede /cdr.
// Læsekontrakt bevares: dialer_calls.duration_seconds = besvaret→slut (= /cdr's conversationSeconds) = conversation + queued;
// total_duration_seconds = duration; status i de fem eksisterende værdier. Kundens nummer (number) og extension gemmes ikke.
import type { StandardCall } from "../types.ts";

export interface CallEntry {
  id?: unknown; campaignId?: unknown; leadId?: unknown; contactId?: unknown; userId?: unknown;
  disposition?: unknown; byeCause?: unknown; start?: unknown; answer?: unknown; connect?: unknown; end?: unknown;
  duration?: unknown; queued?: unknown; billable?: unknown; dialing?: unknown; conversation?: unknown;
  sip?: unknown; origin?: unknown; anonymous?: unknown; links?: { recording?: unknown } | null;
}

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

/** Samme statuskontrakt som den gamle /cdr-mapper (adversus.ts mapAdversusDisposition/mapAdversusHangupCause) – ÉN sandhed, begge mappere kalder disse. */
export function mapAdversusDispositionStatus(disposition: string | undefined): StandardCall["status"] | null {
  if (!disposition) return null;
  const d = disposition.toLowerCase();
  if (d.includes("answered") || d.includes("success") || d.includes("connected") || d.includes("sale") || d === "answer") return "ANSWERED";
  if (d.includes("no answer") || d.includes("noanswer") || d.includes("no_answer") || d.includes("no-answer") || d === "ring") return "NO_ANSWER";
  if (d.includes("busy")) return "BUSY";
  if (d.includes("voicemail") || d.includes("machine") || d.includes("answering")) return "NO_ANSWER";
  if (d.includes("fail") || d.includes("error") || d.includes("invalid")) return "FAILED";
  return null;
}
export function mapAdversusHangupCauseStatus(cause: string | undefined): StandardCall["status"] {
  if (!cause) return "OTHER";
  const c = cause.toUpperCase();
  if (c.includes("NORMAL_CLEARING") || c.includes("SUCCESS") || c.includes("ANSWERED")) return "ANSWERED";
  if (c.includes("NO_USER_RESPONSE") || c.includes("NO_ANSWER") || c.includes("TIMEOUT")) return "NO_ANSWER";
  if (c.includes("BUSY") || c.includes("USER_BUSY")) return "BUSY";
  if (c.includes("CALL_REJECTED") || c.includes("FAIL") || c.includes("UNALLOCATED") || c.includes("INVALID")) return "FAILED";
  return "OTHER";
}
/** Telefonudfald: disposition først, ellers byeCause (= hangupCause) – identisk med /cdr-vejen. */
export function statusFraKald(disposition: unknown, byeCause: unknown): StandardCall["status"] {
  return mapAdversusDispositionStatus(str(disposition) || undefined) ?? mapAdversusHangupCauseStatus(str(byeCause) || undefined);
}

export function mapCallEntry(e: CallEntry, dialerName: string): StandardCall {
  const queued = num(e.queued), conversation = num(e.conversation);
  return {
    externalId: str(e.id),
    integrationType: "adversus",
    dialerName,
    startTime: str(e.start) || new Date(0).toISOString(),
    endTime: str(e.end) || str(e.start) || new Date(0).toISOString(),
    durationSeconds: conversation + queued,
    totalDurationSeconds: num(e.duration),
    status: statusFraKald(e.disposition, e.byeCause),
    agentExternalId: str(e.userId),
    campaignExternalId: str(e.campaignId),
    leadExternalId: str(e.contactId) || str(e.leadId),
    recordingUrl: undefined,
    metadata: {
      disposition: str(e.disposition) || undefined,
      hangupCause: str(e.byeCause) || undefined,
      direction: str(e.origin) || undefined,
      answerTime: str(e.answer) || undefined,
      connectTime: str(e.connect) || undefined,
      queuedSeconds: queued,
      dialingSeconds: num(e.dialing),
      billableSeconds: num(e.billable),
      agentConversationSeconds: conversation,
      sip: str(e.sip) || undefined,
      anonymous: str(e.anonymous) || undefined,
      hasRecording: !!str(e.links?.recording),
      kilde: "calls_v1",
    },
  };
}

/** Henter alle sider for et start-vindue. `get` er adapterens budgetterede GET (præfikser /v1). `komplet` = alle sider hentet
 *  (ellers må vandmærket IKKE flyttes). `stop()` afbryder mellem sider (tidsbudget). */
export async function hentCallsV1(get: (sti: string) => Promise<unknown>, fra: string, til: string, opts: { maksSider?: number; stop?: () => boolean } = {}): Promise<{ entries: CallEntry[]; sider: number; total: number | null; komplet: boolean }> {
  const maksSider = opts.maksSider ?? 30;
  const filt = encodeURIComponent(JSON.stringify({ start: { $gt: fra, $lt: til } }));
  const entries: CallEntry[] = []; const set = new Set<string>(); let total: number | null = null; let sider = 0; let raa = 0; let komplet = false;
  for (let side = 1; side <= maksSider; side++) {
    if (opts.stop?.()) break;
    const data = (await get(`/calls?filters=${filt}&pageSize=1000&page=${side}&includeMeta=true`)) as { calls?: unknown; meta?: { pagination?: { pageCount?: unknown; total?: unknown } } } | null;
    // Gyldig struktur kræves (ellers kan et fejlsvar ligne en tom, komplet side): calls skal være array og meta.pagination.pageCount et tal ≥ 1
    if (!data || typeof data !== "object" || !Array.isArray(data.calls)) throw new Error(`calls_v1: ugyldigt svar på side ${side}`);
    const pageCount = Number(data.meta?.pagination?.pageCount);
    if (!Number.isFinite(pageCount) || pageCount < 1) throw new Error(`calls_v1: meta.pagination.pageCount mangler på side ${side}`);
    const calls = data.calls as CallEntry[];
    sider++; raa += calls.length;
    for (const c of calls) { const id = str(c.id); if (id && !set.has(id)) { set.add(id); entries.push(c); } }
    const t = Number(data.meta?.pagination?.total); if (Number.isFinite(t)) total = t;
    if (side >= pageCount) { komplet = true; break; }
    if (calls.length === 0) break;  // tom side før pageCount: ikke komplet
  }
  if (komplet && total != null && raa < total) komplet = false;  // meta.total større end hentet (rå antal, før dedup)
  return { entries, sider, total, komplet };
}
