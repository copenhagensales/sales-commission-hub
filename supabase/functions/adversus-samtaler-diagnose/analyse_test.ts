import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { cphIso, senesteHverdag, udledTimestampSemantik } from "./analyse.ts";

Deno.test("udledTimestampSemantik: start inden for vinduet, end udenfor → start", () => {
  const r = udledTimestampSemantik([{ start: "2026-10-30T09:05:00Z", end: "2026-10-30T09:40:00Z" }, { start: "2026-10-30T09:20:00Z", end: "2026-10-30T09:31:00Z" }], "2026-10-30T09:00:00Z", "2026-10-30T09:30:00Z");
  assertEquals(r.semantik, "start"); assertEquals(r.antal, 2);
});
Deno.test("udledTimestampSemantik: tom liste → ukendt", () => {
  assertEquals(udledTimestampSemantik([], "2026-10-30T09:00:00Z", "2026-10-30T09:30:00Z").semantik, "ukendt");
});
Deno.test("cphIso: 10:00 dansk vintertid = 09:00Z", () => {
  assertEquals(cphIso("2026-10-30", 10), "2026-10-30T09:00:00.000Z");
});
Deno.test("senesteHverdag springer weekend over", () => {
  assertEquals(senesteHverdag(new Date("2026-10-31T13:00:00Z")), "2026-10-30");
  assertEquals(senesteHverdag(new Date("2026-11-02T06:00:00Z")), "2026-10-30");
});
Deno.test("cphIso: DST-skiftedag 25/10 – 02:00 (før skift) og 10:00 (efter skift)", () => {
  assertEquals(cphIso("2026-10-25", 0), "2026-10-24T22:00:00.000Z");
  assertEquals(cphIso("2026-10-25", 10), "2026-10-25T09:00:00.000Z");
  assertEquals(cphIso("2026-07-01", 10), "2026-07-01T08:00:00.000Z");
});
