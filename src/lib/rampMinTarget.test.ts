import { describe, expect, it } from "vitest";
import { minCumulativeAt, weeklyTarget } from "./rampMinTarget";

const T = [5, 8, 11, 14, 17];

describe("rampMinTarget", () => {
  it("spreads week 1 over days", () => {
    expect(minCumulativeAt(1, T)).toBe(1);
    expect(minCumulativeAt(5, T)).toBe(5);
  });
  it("accumulates across weeks", () => {
    expect(minCumulativeAt(6, T)).toBe(6.6);
    expect(minCumulativeAt(10, T)).toBe(13);
    expect(minCumulativeAt(20, T)).toBe(38);
    expect(minCumulativeAt(25, T)).toBe(55);
    expect(minCumulativeAt(30, T)).toBe(72);
  });
  it("last value applies to later weeks", () => {
    expect(weeklyTarget(8, T)).toBe(17);
  });
  it("day 0 is 0", () => expect(minCumulativeAt(0, T)).toBe(0));
});
