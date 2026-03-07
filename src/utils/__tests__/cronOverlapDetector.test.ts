import { describe, it, expect } from "vitest";
import {
  parseCronMinutes,
  estimateFrequencyFromCron,
} from "../cronOverlapDetector";

describe("parseCronMinutes", () => {
  it("parses star as all 60 minutes", () => {
    expect(parseCronMinutes("* * * * *")).toHaveLength(60);
  });

  it("parses step notation */10", () => {
    expect(parseCronMinutes("*/10 * * * *")).toEqual([0, 10, 20, 30, 40, 50]);
  });

  it("parses comma-separated values", () => {
    expect(parseCronMinutes("5,55 * * * *")).toEqual([5, 55]);
  });

  it("parses range 10-15", () => {
    expect(parseCronMinutes("10-15 * * * *")).toEqual([10, 11, 12, 13, 14, 15]);
  });

  it("parses mixed range and list", () => {
    expect(parseCronMinutes("0-5,30 * * * *")).toEqual([0, 1, 2, 3, 4, 5, 30]);
  });

  it("returns empty array for invalid expression", () => {
    expect(parseCronMinutes("bad")).toEqual([]);
  });
});

describe("estimateFrequencyFromCron", () => {
  it("returns 5 for regular step */5 (even 5-min intervals)", () => {
    expect(estimateFrequencyFromCron("*/5 * * * *")).toBe(5);
  });

  it("returns 15 for regular step */15 (even 15-min intervals)", () => {
    expect(estimateFrequencyFromCron("*/15 * * * *")).toBe(15);
  });

  it("returns 10 for wrap-around schedule 5,55 (wrap gap is shorter than linear gap)", () => {
    // Linear gap: 50, wrap-around gap: 60-55+5 = 10 → min = 10
    expect(estimateFrequencyFromCron("5,55 * * * *")).toBe(10);
  });

  it("returns 1 for uneven gaps 1,2,58 (smallest gap dominates)", () => {
    // Gaps: 1, 56, wrap 3 → min = 1
    expect(estimateFrequencyFromCron("1,2,58 * * * *")).toBe(1);
  });

  it("returns 60 for single minute entry (fires once per hour)", () => {
    expect(estimateFrequencyFromCron("30 * * * *")).toBe(60);
  });

  it("returns 1 for every-minute schedule (60 entries)", () => {
    expect(estimateFrequencyFromCron("* * * * *")).toBe(1);
  });

  it("returns 1 for range+list 0-5,30 (consecutive minutes in range)", () => {
    expect(estimateFrequencyFromCron("0-5,30 * * * *")).toBe(1);
  });

  it("returns 15 for evenly offset schedule 3,18,33,48 (including wrap-around)", () => {
    // Gaps: 15, 15, 15, wrap: 60-48+3=15 → min = 15
    expect(estimateFrequencyFromCron("3,18,33,48 * * * *")).toBe(15);
  });

  it("returns 2 for two close minutes 29,31 (gap dominates over wrap)", () => {
    // Gap: 2, wrap: 60-31+29=58 → min = 2
    expect(estimateFrequencyFromCron("29,31 * * * *")).toBe(2);
  });

  it("returns 1 for consecutive range 10-15 (all 1-min gaps)", () => {
    expect(estimateFrequencyFromCron("10-15 * * * *")).toBe(1);
  });

  it("returns 30 for */30 schedule", () => {
    expect(estimateFrequencyFromCron("*/30 * * * *")).toBe(30);
  });

  it("returns 60 for empty/invalid expression", () => {
    expect(estimateFrequencyFromCron("bad")).toBe(60);
  });
});
