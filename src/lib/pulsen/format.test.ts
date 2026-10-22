import { describe, expect, it } from "vitest";
import { fitWithin, pulsenRelativeTime, showCharCounter, PULSEN_MAX_CHARS } from "./format";

const now = new Date(2026, 9, 22, 15, 0, 0);

describe("pulsenRelativeTime", () => {
  it("under ét minut er 'nu'", () => {
    expect(pulsenRelativeTime(new Date(2026, 9, 22, 14, 59, 30).toISOString(), now)).toBe("nu");
  });
  it("minutter", () => {
    expect(pulsenRelativeTime(new Date(2026, 9, 22, 14, 48).toISOString(), now)).toBe("12 min");
  });
  it("i går med klokkeslæt", () => {
    expect(pulsenRelativeTime(new Date(2026, 9, 21, 14, 5).toISOString(), now)).toBe("i går 14:05");
  });
  it("ældre end i går er en dato", () => {
    expect(pulsenRelativeTime(new Date(2026, 9, 3, 9, 0).toISOString(), now)).toBe("3. okt.");
  });
});

describe("tegngrænse", () => {
  it("maks 2000 tegn, tæller fra 1800", () => {
    expect(PULSEN_MAX_CHARS).toBe(2000);
    expect(showCharCounter(1799)).toBe(false);
    expect(showCharCounter(1800)).toBe(true);
  });
});

describe("fitWithin", () => {
  it("længste side højst 2000 px", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(1200, 5000)).toEqual({ width: 480, height: 2000 });
  });
  it("forstørrer ikke små billeder", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
