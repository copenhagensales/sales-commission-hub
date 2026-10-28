// S6 (leverance A): rene kontraktprøver uden netværk og uden produktionskald.
// Deno.serve stubbes før dynamisk import, så ingen server startes.
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

(Deno as unknown as { serve: unknown }).serve = () => ({ finished: Promise.resolve(), shutdown: () => Promise.resolve() });
const tjek = await import("./storkbook-tjek/index.ts");
const fil = await import("./sb-fil/index.ts");
const opr = await import("./beskeder-oprydning/index.ts");
const wrk = await import("./storkbook-udsendelser/index.ts");

Deno.test("tjek: gyldige domme for alle fem begrundelsesveje", () => {
  assertEquals(tjek.validerDom({ tone: "ok", personoplysninger: "ingen", cpr: false }), { tone: "ok", personoplysninger: "ingen", cpr: false });
  assert(tjek.validerDom({ tone: "haard", personoplysninger: "ingen", type: "truende", cpr: false }));
  assert(tjek.validerDom({ tone: "ok", personoplysninger: "fundet", type: "telefon", cpr: false }));
  assert(tjek.validerDom({ tone: "ok", personoplysninger: "fundet", type: "cpr", cpr: true }));
});

Deno.test("tjek: ugyldige/modstridende domme afvises (→ ukendt)", () => {
  for (const x of [null, [], "ok", { tone: "ok" }, { tone: "ok", personoplysninger: "ingen", cpr: "false" },
    { tone: "ok", personoplysninger: "ingen", cpr: true }, { tone: "ok", personoplysninger: "fundet", type: "cpr", cpr: false },
    { tone: "ok", personoplysninger: "ingen", type: "chikane", cpr: false }, { tone: "haard", personoplysninger: "ingen", type: "email", cpr: false },
    { tone: "ok", personoplysninger: "ingen", cpr: false, fil_tjekket: true }, { tone: "ok", personoplysninger: "ingen", cpr: false, type: "x" }]) {
    assertEquals(tjek.validerDom(x), null);
  }
  assertEquals(tjek.UKENDT, { tone: "ok", personoplysninger: "ingen", cpr: false, fil_tjekket: false, udfald: "ukendt" });
  assertEquals(tjek.MAKS_OUTPUT_TOKENS, 200);
});

Deno.test("filtype fra indhold, ikke fra navn", () => {
  assertEquals(fil.filtype(new Uint8Array([0xff, 0xd8, 0xff, 0])), "image/jpeg");
  assertEquals(fil.filtype(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assertEquals(fil.filtype(new TextEncoder().encode("hej")), "text/plain");
  assertEquals(fil.filtype(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0])), null);
  assertEquals(tjek.filtype(new TextEncoder().encode("GIF89a")), "image/gif");
});

Deno.test("Content-Disposition er sikker og tvinger faktisk endelse", () => {
  const d = fil.disposition('ond"\r\nX: y.html', "text/plain");
  assert(!/[\r\n]/.test(d));
  assert(d.startsWith('attachment; filename="'));
  assert(d.includes(".txt"));
  assert(!d.includes(".html"));
  assert(fil.disposition(null, "image/png").startsWith('inline; filename="fil.png"'));
});

Deno.test("Range: 206-grænser og 416", () => {
  assertEquals(fil.range(null, 10), null);
  assertEquals(fil.range("bytes=0-3", 10), { start: 0, slut: 3 });
  assertEquals(fil.range("bytes=5-", 10), { start: 5, slut: 9 });
  assertEquals(fil.range("bytes=-4", 10), { start: 6, slut: 9 });
  assertEquals(fil.range("bytes=2-99", 10), { start: 2, slut: 9 });
  for (const h of ["bytes=10-", "bytes=5-2", "bytes=0-1,3-4", "items=0-1", "bytes=-", "bytes=-0"]) assertEquals(fil.range(h, 10), "ugyldig");
});

Deno.test("tokenudløb læses fra JWT-payload", () => {
  const p = btoa(JSON.stringify({ exp: 1900000000 })).replace(/=+$/, "");
  assertEquals(fil.tokenUdloeb(`x.${p}.y`), 1900000000);
  assertEquals(fil.tokenUdloeb("ugyldig"), null);
  assertEquals(fil.TYPER.pdf, undefined);
});

Deno.test("oprydning: konstant-tid og tidsvindue 03–04 dansk", () => {
  assert(opr.ensKonstantTid("abc", "abc"));
  assert(!opr.ensKonstantTid("abc", "abd"));
  assert(!opr.ensKonstantTid("abc", "abcd"));
  assert(opr.iOptaellingsvindue(new Date("2026-10-28T02:30:00Z"))); // 03:30 CET
  assert(!opr.iOptaellingsvindue(new Date("2026-10-28T03:30:00Z")));
});

Deno.test("worker: tjek-mapping (kilde_type = underliggende indhold, modtager = afsender)", () => {
  const k = wrk.tjekKandidater([
    { id: "h1", tid: "t", kilde: "besked", kilde_id: "m1", revision: 2, type: "afventer", employee_id: "e1" },
    { id: "h2", tid: "t", kilde: "tjek", kilde_id: "m2", revision: 1, type: "afventer", employee_id: "e1" },
    { id: "h3", tid: "t", kilde: "besked", kilde_id: "m3", revision: 0, type: "udloeb", employee_id: "e1" },
    { id: "h4", tid: "t", kilde: "opslag", kilde_id: "p1", revision: 1, type: "udloeb", employee_id: "e2" },
  ]);
  assertEquals(k.length, 2);
  assertEquals(k[0].haendelse, "tjek:besked:m1:2:afventer");
  assertEquals(k[0].kilde_type, "besked");
  assertEquals(k[0].kilde_id, "m1");
  assertEquals(k[0].modtager_employee_id, "e1");
  assertEquals(k[0].afsender_employee_id, null);
  assertEquals(k[0].type_noegle, "storkbook_tjek");
  assertEquals(k[0].metadata, { revision: 2, tjek_type: "afventer" });
  assertEquals(k[1].kilde_type, "opslag");
});

Deno.test("worker: indhold med feltet status er ikke et Afslut", () => {
  assert(wrk.erAfslut({ status: "annulleret", aarsag: "x" }));
  assert(!wrk.erAfslut({ id: "p", status: "leveret" }));
  assert(!wrk.erAfslut({ title: "t", body: "b", status: "leveret" }));
  assert(wrk.erLeveret({ status: "leveret", slettes_efter: null }));
  assert(!wrk.erLeveret({ status: "tjekkes", slettes_efter: null }));
  assert(!wrk.erLeveret({ status: "leveret", slettes_efter: "2000-01-01T00:00:00Z" }));
});
