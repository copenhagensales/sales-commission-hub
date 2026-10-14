import { describe, expect, it } from "vitest";
import { expectedNow, restOfWeek, weekRequired, weekStatus } from "./rampWeek";

const T = [5, 8, 11, 14, 17];

// Tallene er de samme, som ramp_week_status gav i databasen 14. okt 2026.
describe("ugemodel", () => {
  it("starter tirsdag: 4 dage, krav 5 × 4/5 = 4", () => {
    expect(weekRequired(1, 4, T)).toBe(4);
    expect(expectedNow(4, 2, 4)).toBe(2);
  });
  it("uge med helligdag: 3 arbejdsdage i opstartsuge 3 = 6,6", () => {
    expect(weekRequired(3, 3, T)).toBe(6.6);
  });
  it("sidste krav gælder for senere uger", () => expect(weekRequired(7, 5, T)).toBe(17));
  it("mandag uden afsluttede dage = ny uge, ingen status", () => {
    expect(weekStatus(0, 0, 0, 1)).toBe("ny_uge");
  });
  it("opstartsuge 1 under forventet = Hold fast", () => {
    expect(weekStatus(0, 2, 2, null)).toBe("hold_fast");
  });
  it("gode tidligere uger men dårlig indeværende uge er aldrig På sporet", () => {
    // 3 salg mod 6,8; sidste uge 23/17 = 1,35
    expect(weekStatus(3, 6.8, 2, 23 / 17)).toBe("start_her");
  });
  it("bedre tempo end sidste uge = Hold fast", () => {
    expect(weekStatus(1, 4.4, 2, 0.125)).toBe("hold_fast");
  });
  it("på eller over forventet = På sporet", () => expect(weekStatus(12, 6.8, 2, 1.43)).toBe("paa_sporet"));
  it("resten af ugen", () => {
    expect(restOfWeek({ required: 8, sales_live: 3, workdays: 5, done_days: 2 })).toEqual({
      missing: 5,
      daysLeft: 3,
      perDay: 1.67,
    });
  });
});
