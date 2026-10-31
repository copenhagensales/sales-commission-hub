import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { hentCallsV1, mapCallEntry, statusFraKald } from "./adversus-calls.ts";

Deno.test("mapCallEntry: duration_seconds = conversation + queued (besvaret→slut), total = duration, ingen nummer/extension", () => {
  const c = mapCallEntry({ id: 123, campaignId: 7, leadId: 9, contactId: 11, userId: 5, disposition: "answered", byeCause: "NORMAL_CLEARING", start: "2026-10-30T09:00:00Z", answer: "2026-10-30T09:00:10Z", connect: "2026-10-30T09:00:14Z", end: "2026-10-30T09:02:00Z", duration: 120, queued: 4, billable: 110, dialing: 10, conversation: 106, sip: "200", origin: "outbound", anonymous: "n", number: "+4512345678", extension: "101", links: { recording: "https://x/y" } } as never, "Lovablecph");
  assertEquals(c.externalId, "123"); assertEquals(c.durationSeconds, 110); assertEquals(c.totalDurationSeconds, 120);
  assertEquals(c.status, "ANSWERED"); assertEquals(c.leadExternalId, "11"); assertEquals(c.agentExternalId, "5");
  assertEquals(c.recordingUrl, undefined);
  assertEquals(JSON.stringify(c).includes("+4512345678"), false); assertEquals(JSON.stringify(c).includes('"101"'), false);
  assertEquals(c.metadata?.hasRecording, true); assertEquals(c.metadata?.agentConversationSeconds, 106); assertEquals(c.metadata?.queuedSeconds, 4);
});
Deno.test("statusFraKald: samme kontrakt som /cdr-mapperen (disposition først, ellers byeCause)", () => {
  assertEquals(statusFraKald("no-answer", undefined), "NO_ANSWER"); assertEquals(statusFraKald("noAnswer", undefined), "NO_ANSWER");
  assertEquals(statusFraKald("busy", undefined), "BUSY"); assertEquals(statusFraKald("fail", undefined), "FAILED");
  assertEquals(statusFraKald("congestion", undefined), "OTHER");            // som før: ingen disposition-match, ingen årsag → OTHER
  assertEquals(statusFraKald("congestion", "NORMAL_CLEARING"), "ANSWERED"); // som før: årsagen afgør
  assertEquals(statusFraKald(undefined, "USER_BUSY"), "BUSY"); assertEquals(statusFraKald("weird", "CALL_REJECTED"), "FAILED");
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
  assertEquals(r.entries.map((e) => e.id), [1, 2, 3]); assertEquals(r.sider, 3); assertEquals(r.total, 5); assertEquals(r.komplet, false); // meta.total 5 > 4 rå hentede → ikke komplet
  assertEquals(kaldt[0].includes("pageSize=1000"), true); assertEquals(kaldt[0].includes("%22start%22"), true);
});

Deno.test("hentCallsV1: sideloft → komplet=false; stop() → komplet=false; alle sider → komplet=true", async () => {
  const mange = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1 }));
  const get = (sti: string) => { const side = Number(/page=(\d+)/.exec(sti)?.[1]); return Promise.resolve({ calls: side <= 2 ? mange(1000).map((c) => ({ id: c.id + (side - 1) * 1000 })) : [], meta: { pagination: { pageCount: 3, total: 2000 } } }); };
  const loft = await hentCallsV1(get, "a", "b", { maksSider: 1 }); assertEquals(loft.komplet, false);
  let n = 0; const stoppet = await hentCallsV1(get, "a", "b", { stop: () => n++ > 0 }); assertEquals(stoppet.komplet, false);
  const alle = await hentCallsV1(get, "a", "b"); assertEquals(alle.komplet, true); assertEquals(alle.entries.length, 2000);
});

Deno.test("hentCallsV1: ugyldig struktur kaster (tomt objekt, manglende pageCount, calls ikke array)", async () => {
  const kast = async (svar: unknown) => { try { await hentCallsV1(() => Promise.resolve(svar), "a", "b"); return false; } catch { return true; } };
  assertEquals(await kast({}), true);
  assertEquals(await kast({ calls: [{ id: 1 }], meta: {} }), true);  // kald uden meta: ugyldigt
  const tom = await hentCallsV1(() => Promise.resolve({ calls: [] }), "a", "b");  // tomt vindue uden meta (prod 31/10): komplet
  assertEquals(tom.komplet, true); assertEquals(tom.total, 0); assertEquals(tom.entries.length, 0);
  const tom0 = await hentCallsV1(() => Promise.resolve({ calls: [], meta: { pagination: { pageCount: 0, total: 0 } } }), "a", "b");  // pageCount 0 ved tomt vindue
  assertEquals(tom0.komplet, true);
  const tomNull = await hentCallsV1(() => Promise.resolve({ calls: [], meta: { pagination: { pageCount: null, total: null } } }), "a", "b");
  assertEquals(tomNull.komplet, true);
  const tomMenTotal = await hentCallsV1(() => Promise.resolve({ calls: [], meta: { pagination: { pageCount: 0, total: 5 } } }), "a", "b");  // tom side men total > 0: IKKE komplet
  assertEquals(tomMenTotal.komplet, false);
  assertEquals(await kast({ calls: "x", meta: { pagination: { pageCount: 1 } } }), true);
  assertEquals(await kast({ calls: [{ id: 1 }], meta: { pagination: { pageCount: true } } }), true);  // boolean er ikke et tal (side med kald)
  const ok = await hentCallsV1(() => Promise.resolve({ calls: [], meta: { pagination: { pageCount: 1, total: 0 } } }), "a", "b");
  assertEquals(ok.komplet, true);
  const forLidt = await hentCallsV1(() => Promise.resolve({ calls: [{ id: 1 }], meta: { pagination: { pageCount: 1, total: 2500 } } }), "a", "b");
  assertEquals(forLidt.komplet, false);
});
