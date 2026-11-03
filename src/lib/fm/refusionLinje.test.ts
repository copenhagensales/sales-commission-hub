import { describe, it, expect } from "vitest";
import { lokationsRefusion, tillaegsRefusion, formatRefusionLinje } from "./refusionLinje";

describe("refusionLinje", () => {
  it("Kvickly direkte: 1.750 brutto, 750 refusion, netto 1.000 fra daily_rate", () => {
    const d = lokationsRefusion({ dailyRate: 1000, grossDailyRate: 1750, refundDailyRate: 750, refundClientName: "Eesy FM" });
    expect(formatRefusionLinje(d!)).toBe("Vi betaler 1.750 · Eesy FM refunderer 750 · Netto 1.000");
  });
  it("netto er altid daily_rate, også hvis brutto − refusion afviger", () => {
    expect(lokationsRefusion({ dailyRate: 900, grossDailyRate: 1750, refundDailyRate: 750, refundClientName: null })!.netto).toBe(900);
  });
  it("uden refusion vises ingen linje", () => {
    expect(lokationsRefusion({ dailyRate: 1000, grossDailyRate: 1750, refundDailyRate: null, refundClientName: null })).toBeNull();
  });
  it("Coop-tillæg 250 oven på 1.000", () => {
    const d = tillaegsRefusion({ dailyRate: 1000, surchargePerDay: 250, fundedByName: "Eesy FM" });
    expect(d).toEqual({ brutto: 1250, refusion: 250, netto: 1000, refunderesAf: "Eesy FM" });
  });
});

import { coopDirekteLinje as _cdl } from "./refusionLinje";
describe("Coop direkte visningslinje", () => {
  it("Kvickly 1.700 med 700 i refusion", () => {
    expect(formatRefusionLinje(_cdl({ dailyRate: 1700, refundPerDay: 700, refundClientName: "Eesy FM" })!))
      .toBe("Vi betaler 1.700 · Eesy FM refunderer 700 · Netto 1.000");
  });
});
