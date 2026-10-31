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

/** Telefonudfald (ikke sessionsudfald, ikke salgsstatus): /calls bruger 'no-answer' – sessions bruger 'noAnswer'. */
export function dispositionTilStatus(d: unknown): StandardCall["status"] {
  const s = str(d).toLowerCase().replace(/[\s_-]/g, "");
  if (s === "answered") return "ANSWERED";
  if (s === "noanswer") return "NO_ANSWER";
  if (s === "busy") return "BUSY";
  if (s === "fail" || s === "failed" || s === "congestion") return "FAILED";
  return "OTHER";
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
    status: dispositionTilStatus(e.disposition),
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

export interface CallsSide { calls: CallEntry[]; pageCount: number; total: number | null }

/** Henter alle sider for et start-vindue. `get` er adapterens budgetterede GET (præfikser /v1). */
export async function hentCallsV1(get: (sti: string) => Promise<unknown>, fra: string, til: string, maksSider = 20): Promise<{ entries: CallEntry[]; sider: number; total: number | null }> {
  const filt = encodeURIComponent(JSON.stringify({ start: { $gt: fra, $lt: til } }));
  const entries: CallEntry[] = []; const set = new Set<string>(); let total: number | null = null; let sider = 0;
  for (let side = 1; side <= maksSider; side++) {
    const data = (await get(`/calls?filters=${filt}&pageSize=1000&page=${side}&includeMeta=true`)) as { calls?: CallEntry[]; meta?: { pagination?: { pageCount?: number; total?: number } } } | null;
    const calls = Array.isArray(data?.calls) ? data!.calls! : [];
    sider++;
    for (const c of calls) { const id = str(c.id); if (id && !set.has(id)) { set.add(id); entries.push(c); } }
    const pageCount = Number(data?.meta?.pagination?.pageCount ?? 1);
    total = data?.meta?.pagination?.total != null ? Number(data.meta.pagination.total) : total;
    if (calls.length === 0 || side >= pageCount) break;
  }
  return { entries, sider, total };
}
