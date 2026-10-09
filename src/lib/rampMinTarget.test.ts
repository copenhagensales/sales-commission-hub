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

describe("minCumulativeAt matcher databasens ramp_expected_at", () => {
  it("giver samme værdier som SQL for 5/8/11/14/17", () => {
    const t = [5, 8, 11, 14, 17];
    // Værdier hentet fra ramp_expected_at i databasen 9. okt 2026.
    expect(minCumulativeAt(1, t)).toBe(1);
    expect(minCumulativeAt(9, t)).toBe(11.4);
    expect(minCumulativeAt(10, t)).toBe(13);
    expect(minCumulativeAt(15, t)).toBe(24);
    expect(minCumulativeAt(29, t)).toBe(68.6);
    expect(minCumulativeAt(40, t)).toBe(106);
  });
});
