import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { backfillDag, dagsvindue, erArbejdstid, inkrementeltVindue } from "./calls-incremental.ts";

Deno.test("inkrementeltVindue: vandmærke − 2 t overlap → nu − 2 min", () => {
  const nu = new Date("2026-10-30T10:00:00Z");
  const v = inkrementeltVindue(new Date("2026-10-30T09:58:00Z"), nu);
  assertEquals(v.fra.toISOString(), "2026-10-30T07:58:00.000Z"); assertEquals(v.til.toISOString(), "2026-10-30T09:58:00.000Z"); assertEquals(v.efterslaeb, false);
});
Deno.test("inkrementeltVindue: langt efterslæb begrænses til 24 t", () => {
  const v = inkrementeltVindue(new Date("2026-10-20T10:00:00Z"), new Date("2026-10-30T10:00:00Z"));
  assertEquals(v.fra.toISOString(), "2026-10-20T08:00:00.000Z"); assertEquals(v.til.toISOString(), "2026-10-21T08:00:00.000Z"); assertEquals(v.efterslaeb, true);
});
Deno.test("inkrementeltVindue uden vandmærke: 2 t bagud", () => {
  const v = inkrementeltVindue(null, new Date("2026-10-30T10:00:00Z"));
  assertEquals(v.fra.toISOString(), "2026-10-30T07:58:00.000Z");
});
Deno.test("erArbejdstid: 07–22 dansk tid", () => {
  assertEquals(erArbejdstid(new Date("2026-10-30T05:30:00Z")), false); // 06:30 DK
  assertEquals(erArbejdstid(new Date("2026-10-30T06:30:00Z")), true);  // 07:30 DK
  assertEquals(erArbejdstid(new Date("2026-10-30T21:30:00Z")), false); // 22:30 DK
});
Deno.test("backfillDag: starter i går, går bagud, stopper ved grænsen", () => {
  const nu = new Date("2026-10-31T13:00:00Z");
  const b1 = backfillDag(null, 3, nu)!; assertEquals(b1.dag, "2026-10-30"); assertEquals(b1.fra, "2026-10-29T23:00:00.000Z"); assertEquals(b1.til, "2026-10-30T23:00:00.000Z"); assertEquals(b1.naeste, "2026-10-29");
  const b2 = backfillDag(b1.naeste, 3, nu)!; assertEquals(b2.dag, "2026-10-29");
  const b3 = backfillDag("2026-10-28", 3, nu)!; assertEquals(b3.dag, "2026-10-28");
  assertEquals(backfillDag("2026-10-27", 3, nu), null);
});

Deno.test("dagsvindue: DST-skiftedag 25/10-2026 er 25 timer, 29/3 er 23 timer", () => {
  assertEquals(dagsvindue("2026-10-25"), { fra: "2026-10-24T22:00:00.000Z", til: "2026-10-25T23:00:00.000Z" });
  assertEquals(dagsvindue("2026-03-29"), { fra: "2026-03-28T23:00:00.000Z", til: "2026-03-29T22:00:00.000Z" });
  assertEquals(dagsvindue("2026-10-30"), { fra: "2026-10-29T23:00:00.000Z", til: "2026-10-30T23:00:00.000Z" });
});
