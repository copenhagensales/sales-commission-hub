import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { dispositionTilStatus, hentCallsV1, mapCallEntry } from "./adversus-calls.ts";

Deno.test("mapCallEntry: duration_seconds = conversation + queued (besvaret→slut), total = duration, ingen nummer/extension", () => {
  const c = mapCallEntry({ id: 123, campaignId: 7, leadId: 9, contactId: 11, userId: 5, disposition: "answered", byeCause: "NORMAL_CLEARING", start: "2026-10-30T09:00:00Z", answer: "2026-10-30T09:00:10Z", connect: "2026-10-30T09:00:14Z", end: "2026-10-30T09:02:00Z", duration: 120, queued: 4, billable: 110, dialing: 10, conversation: 106, sip: "200", origin: "outbound", anonymous: "n", number: "+4512345678", extension: "101", links: { recording: "https://x/y" } } as never, "Lovablecph");
  assertEquals(c.externalId, "123"); assertEquals(c.durationSeconds, 110); assertEquals(c.totalDurationSeconds, 120);
  assertEquals(c.status, "ANSWERED"); assertEquals(c.leadExternalId, "11"); assertEquals(c.agentExternalId, "5");
  assertEquals(c.recordingUrl, undefined);
  assertEquals(JSON.stringify(c).includes("+4512345678"), false); assertEquals(JSON.stringify(c).includes('"101"'), false);
  assertEquals(c.metadata?.hasRecording, true); assertEquals(c.metadata?.agentConversationSeconds, 106); assertEquals(c.metadata?.queuedSeconds, 4);
});
Deno.test("dispositionTilStatus: /calls-værdier og tolerance", () => {
  assertEquals(dispositionTilStatus("no-answer"), "NO_ANSWER"); assertEquals(dispositionTilStatus("noAnswer"), "NO_ANSWER");
  assertEquals(dispositionTilStatus("busy"), "BUSY"); assertEquals(dispositionTilStatus("congestion"), "FAILED"); assertEquals(dispositionTilStatus("fail"), "FAILED");
  assertEquals(dispositionTilStatus(undefined), "OTHER"); assertEquals(dispositionTilStatus("weird"), "OTHER");
});
Deno.test("mapCallEntry: leadId som fallback for contactId; manglende tal → 0", () => {
  const c = mapCallEntry({ id: "1", leadId: 9, disposition: "busy", start: "2026-10-30T09:00:00Z", end: "2026-10-30T09:00:05Z" }, "X");
  assertEquals(c.leadExternalId, "9"); assertEquals(c.durationSeconds, 0); assertEquals(c.status, "BUSY");
});
Deno.test("hentCallsV1: følger pageCount, dedup på id, stopper ved tom side", async () => {
  const sider: Record<number, unknown> = {
    1: { calls: [{ id: 1 }, { id: 2 }], meta: { pagination: { pageCount: 3, total: 5 } } },
    2: { calls: [{ id: 2 }, { id: 3 }], meta: { pagination: { pageCount: 3, total: 5 } } },
    3: { calls: [], meta: { pagination: { pageCount: 3, total: 5 } } },
  };
  const kaldt: string[] = [];
  const get = (sti: string) => { kaldt.push(sti); const side = Number(/page=(\d+)/.exec(sti)?.[1]); return Promise.resolve(sider[side]); };
  const r = await hentCallsV1(get, "2026-10-30T09:00:00Z", "2026-10-30T10:00:00Z");
  assertEquals(r.entries.map((e) => e.id), [1, 2, 3]); assertEquals(r.sider, 3); assertEquals(r.total, 5);
  assertEquals(kaldt[0].includes("pageSize=1000"), true); assertEquals(kaldt[0].includes("%22start%22"), true);
});
