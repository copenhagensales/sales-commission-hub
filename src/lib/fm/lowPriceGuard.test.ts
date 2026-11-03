import { describe, it, expect } from "vitest";
import { effektivDagspris, erLavPris, manglerBegrundelse, erLavPrisFejl, refusionUoverensstemmelse } from "./lowPriceGuard";

describe("lowPriceGuard", () => {
  it("99 kr. pr. dag kræver begrundelse", () => {
    expect(manglerBegrundelse(99, "")).toBe(true);
  });
  it("100 kr. pr. dag kræver ikke begrundelse", () => {
    expect(manglerBegrundelse(100, "")).toBe(false);
  });
  it("1 kr. med begrundelse er tilladt", () => {
    expect(manglerBegrundelse(1, "Gratis stand aftalt")).toBe(false);
  });
  it("aftalt total 300 kr. over 3 dage = 100 kr. → ok", () => {
    expect(effektivDagspris({ totalPrice: 300, bookedDays: 3 })).toBe(100);
    expect(erLavPris(100)).toBe(false);
  });
  it("aftalt total 299 kr. over 3 dage er lav", () => {
    expect(erLavPris(effektivDagspris({ totalPrice: 299, bookedDays: 3 }))).toBe(true);
  });
  it("0 bookede dage regnes som 1", () => {
    expect(effektivDagspris({ totalPrice: 50, bookedDays: 0 })).toBe(50);
  });
  it("override går forud for lokationens dagspris", () => {
    expect(effektivDagspris({ dailyRateOverride: 1, locationDailyRate: 1000 })).toBe(1);
  });
  it("ingen pris er ikke lav", () => {
    expect(erLavPris(effektivDagspris({}))).toBe(false);
  });
  it("databasefejl genkendes kun ved præcis kode og hint", () => {
    expect(erLavPrisFejl({ code: "P0001", hint: "stork_lav_pris" })).toBe(true);
    expect(erLavPrisFejl({ code: "P0001", hint: "andet" })).toBe(false);
  });
  it("1.750 − 750 = 1.000 stemmer; 1.750 − 750 ≠ 900", () => {
    expect(refusionUoverensstemmelse({ brutto: 1750, refusion: 750, netto: 1000 })).toBe(false);
    expect(refusionUoverensstemmelse({ brutto: 1750, refusion: 750, netto: 900 })).toBe(true);
  });
});
