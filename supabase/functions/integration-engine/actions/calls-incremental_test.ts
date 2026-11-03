import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { afstemningsDage, backfillDag, dagsvindue, erArbejdstid, inkrementeltVindue } from "./calls-incremental.ts";

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
  const b1 = backfillDag(null, 3, nu)!; assertEquals(b1.dag, "2026-10-30"); assertEquals(b1.fra, "2026-10-29T23:00:00.000Z"); assertEquals(b1.til, "2026-10-30T23:00:00.000Z"); assertEquals(b1.naeste, "2026-10-29|2026-10-28");
  const b2 = backfillDag(b1.naeste, 3, nu)!; assertEquals(b2.dag, "2026-10-29");
  const b3 = backfillDag("2026-10-28|2026-10-28", 3, nu)!; assertEquals(b3.dag, "2026-10-28");
  assertEquals(backfillDag("2026-10-27|2026-10-28", 3, nu), null);
  // grænsen er fast: selv om 'nu' rykker 5 dage frem under en pause, erklæres 28/10 ikke færdig
  assertEquals(backfillDag("2026-10-28|2026-10-28", 3, new Date("2026-11-05T13:00:00Z"))!.dag, "2026-10-28");
  // gammelt cursorformat uden grænse: bevarer 'dage' dage fra cursoren, også efter pause
  assertEquals(backfillDag("2026-10-28", 3, new Date("2026-11-05T13:00:00Z"))!.dag, "2026-10-28");
  assertEquals(backfillDag("2026-10-28", 3, new Date("2026-11-05T13:00:00Z"))!.naeste, "2026-10-27|2026-10-26");
});

Deno.test("dagsvindue: DST-skiftedag 25/10-2026 er 25 timer, 29/3 er 23 timer", () => {
  assertEquals(dagsvindue("2026-10-25"), { fra: "2026-10-24T22:00:00.000Z", til: "2026-10-25T23:00:00.000Z" });
  assertEquals(dagsvindue("2026-03-29"), { fra: "2026-03-28T23:00:00.000Z", til: "2026-03-29T22:00:00.000Z" });
  assertEquals(dagsvindue("2026-10-30"), { fra: "2026-10-29T23:00:00.000Z", til: "2026-10-30T23:00:00.000Z" });
});

Deno.test("afstemningsDage: genoptager alle manglende dage, ældste først, højst 7 pr. nat", () => {
  assertEquals(afstemningsDage("2026-10-28", "2026-10-31"), ["2026-10-29", "2026-10-30", "2026-10-31"]);
  assertEquals(afstemningsDage("2026-10-31", "2026-10-31"), []);
  assertEquals(afstemningsDage(null, "2026-10-31"), ["2026-10-31"]);
  assertEquals(afstemningsDage("2026-09-01", "2026-10-31").length, 7);
  assertEquals(afstemningsDage("2026-09-01", "2026-10-31")[0], "2026-09-02");  // ældste manglende først – intet springes over
  assertEquals(afstemningsDage("2026-10-20", "2026-10-31")[0], "2026-10-21");
});

Deno.test("hentBrugereV1: alle brugere (også uden e-mail), displayName foretrækkes, sider følges", async () => {
  const { hentBrugereV1 } = await import("./calls-incremental.ts");
  const sider: Record<number, unknown> = {
    1: { users: [{ id: 1, name: "A", displayName: "Anna", email: "a@x.dk", active: true }, { id: 2, name: "B", email: "", active: false }], meta: { pagination: { pageCount: 2 } } },
    2: { users: [{ id: 3, name: "C" }], meta: { pagination: { pageCount: 2 } } },
  };
  const m = await hentBrugereV1((sti) => Promise.resolve(sider[Number(new URL("https://x" + sti).searchParams.get("page"))]));
  assertEquals(m.size, 3);
  assertEquals(m.get("1"), { navn: "Anna", email: "a@x.dk", aktiv: true });
  assertEquals(m.get("2"), { navn: "B", email: null, aktiv: false });
  assertEquals(m.get("3"), { navn: "C", email: null, aktiv: null });
});

Deno.test("domaeneOk (krav 11): eget domæne uanset store bogstaver, fremmed domæne = false, ingen e-mail = null", async () => {
  const { domaeneOk } = await import("./calls-incremental.ts");
  assertEquals(domaeneOk("Miki@CopenhagenSales.dk", ["copenhagensales.dk"]), true);
  assertEquals(domaeneOk("rel@cph-relatel.dk", ["cph-relatel.dk", "copenhagensales.dk"]), true);
  assertEquals(domaeneOk("cra@finansforbundet.dk", ["copenhagensales.dk"]), false);
  assertEquals(domaeneOk("", ["copenhagensales.dk"]), null); assertEquals(domaeneOk(null, ["copenhagensales.dk"]), null);
  assertEquals(domaeneOk("x@copenhagensales.dk", []), false);
});
