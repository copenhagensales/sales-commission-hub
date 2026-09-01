import { describe, it, expect } from "vitest";
import { calcBoardProgress } from "./boardProgress";

// September 2026: 22 hverdage. 1/9 = tirsdag (1 hverdag gået).
// 15/9 = tirsdag (11 hverdage gået).
describe("calcBoardProgress", () => {
  it("dag 1: mål 850, faktisk 27,5 -> indeks 71, bagud", () => {
    const p = calcBoardProgress(850, 27.5, new Date(2026, 8, 1));
    expect(p.arbejdsdageTotal).toBe(22);
    expect(p.arbejdsdageGaaet).toBe(1);
    expect(p.forventet).toBeCloseTo(38.6, 1);
    expect(p.gab).toBeCloseTo(11.1, 1);
    expect(Math.round(p.indeks!)).toBe(71);
    expect(p.status).toBe("bagud");
  });

  it("halvvejs: faktisk 425 -> indeks 100, on-track", () => {
    const p = calcBoardProgress(850, 425, new Date(2026, 8, 15));
    expect(p.arbejdsdageGaaet).toBe(11);
    expect(p.forventet).toBeCloseTo(425, 5);
    expect(p.gab).toBeCloseTo(0, 5);
    expect(Math.round(p.indeks!)).toBe(100);
    expect(p.status).toBe("on-track");
  });

  it("halvvejs: faktisk 850 -> indeks 200, foran", () => {
    const p = calcBoardProgress(850, 850, new Date(2026, 8, 15));
    expect(p.gab).toBeCloseTo(-425, 5);
    expect(Math.round(p.indeks!)).toBe(200);
    expect(p.status).toBe("foran");
  });

  it("mål 0 -> indeks null, ukendt", () => {
    const p = calcBoardProgress(0, 0, new Date(2026, 8, 15));
    expect(p.indeks).toBeNull();
    expect(p.status).toBe("ukendt");
  });
});
