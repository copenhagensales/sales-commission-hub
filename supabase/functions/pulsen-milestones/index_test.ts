import { assert, assertEquals } from "jsr:@std/assert@1";

// Forhindr at importen starter en server (rene funktioner prøves; ingen netværk).
(Deno as unknown as { serve: () => unknown }).serve = () => ({});
const m = await import("./index.ts");

const c = (milestone_type: string, level: number, tier: number | null) =>
  ({ milestone_type, level, tier, value: 12345, previous: 10000 });

Deno.test("tier 3-tekster for de tre rekordtyper", () => {
  assertEquals(m.milestoneText(c("record_day", 0, 3), "Aslak L.", "T"), "**Aslak L.** havde sin **3.-bedste dag** nogensinde {dag}: **12.345 kr**");
  assertEquals(m.milestoneText(c("team_record", 1, 3), "x", "Eesy TM"), "**Eesy TM** havde sin **3.-bedste dag** nogensinde {dag}: **12.345 kr** i provision");
  assertEquals(m.milestoneText(c("house_record", 1, 5), "x", "T"), "Husets **5.-bedste dag** nogensinde {dag}: **12.345 kr** i provision");
});

Deno.test("tier 1, 0 og null giver rekordtekst (gammel SQL-kontrakt)", () => {
  for (const t of [1, 0, null]) {
    assert(m.milestoneText(c("record_day", 0, t), "A", "T").includes("slog sin dagsrekord"));
    assert(m.milestoneText(c("team_record", 1, t), "A", "T").includes("satte teamrekord"));
    assert(m.milestoneText(c("house_record", 1, t), "A", "T").startsWith("Husrekord"));
    assert(m.isHeroCand({ milestone_type: "house_record", tier: t }));
  }
});

Deno.test("level 0-historik for team/hus uændret, også ved tier 3", () => {
  assertEquals(m.milestoneText(c("team_record", 0, 3), "A", "T"), "**T** satte teamrekord {dag}: **12345 salg** (før 10000)");
  assertEquals(m.milestoneText(c("house_record", 0, 0), "A", "T"), "Husrekord {dag}: **12345 salg** (før 10000)");
});

Deno.test("hero kun ved placering 1", () => {
  assert(!m.isHeroCand({ milestone_type: "team_record", tier: 4 }));
  assert(!m.isHeroCand({ milestone_type: "record_day", tier: 1 }));
});

Deno.test("rarity-nøgler uændrede", () => {
  assertEquals(m.rarityKey({ milestone_type: "team_day_sales", level: 50, tier: 2 }), "team_step_2");
});
