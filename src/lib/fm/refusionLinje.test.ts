import { describe, it, expect } from "vitest";
import { lokationsRefusion, tillaegsRefusion, coopDirekteLinje } from "./refusionLinje";

describe("refusionLinje", () => {
  it("Kvickly direkte: 1.750 brutto, 750 refusion, netto 1.000 fra daily_rate", () => {
    const d = lokationsRefusion({ dailyRate: 1000, grossDailyRate: 1750, refundDailyRate: 750, refundClientName: "Eesy FM" });
    expect(d?.netto).toBe(1000);
  });
  it("netto er altid daily_rate, også hvis brutto − refusion afviger", () => {
    expect(lokationsRefusion({ dailyRate: 900, grossDailyRate: 1750, refundDailyRate: 750, refundClientName: null })?.netto).toBe(900);
  });
  it("uden refusion vises ingen linje", () => {
    expect(lokationsRefusion({ dailyRate: 1000, grossDailyRate: 1750, refundDailyRate: null, refundClientName: null })).toBeNull();
  });
  it("Coop-tillæg 250 oven på 1.000", () => {
    const d = tillaegsRefusion({ dailyRate: 1000, surchargePerDay: 250, fundedByName: "Eesy FM" });
    expect(d).toEqual({ dagspris: 1000, brutto: 1250, refusion: 250, netto: 1000, refunderesAf: "Eesy FM" });
  });
});

describe("Coop direkte visningslinje", () => {
  it("Kvickly har samme dagspris og separate tillæg som Coop butik", () => {
    const direkte = coopDirekteLinje({ dailyRate: 1000, refundPerDay: 700, refundClientName: "Eesy FM" });
    expect(direkte).toEqual(tillaegsRefusion({ dailyRate: 1000, surchargePerDay: 700, fundedByName: "Eesy FM" }));
    expect(direkte?.dagspris).toBe(1000);
    expect(direkte?.refusion).toBe(700);
    expect(direkte?.netto).toBe(1000);
  });
});
