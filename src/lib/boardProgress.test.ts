import { describe, it, expect } from "vitest";
import { calcBoardProgress, indeksBarClass } from "./boardProgress";

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

  it("indeks 104 -> gul on-track, indeks 105 -> grøn foran", () => {
    // 11/22 hverdage gået, forventet = 425
    const onTrack = calcBoardProgress(850, 425 * 1.04, new Date(2026, 8, 15));
    expect(onTrack.status).toBe("on-track");
    const foran = calcBoardProgress(850, 425 * 1.05, new Date(2026, 8, 15));
    expect(foran.status).toBe("foran");
  });

  it("indeks 90 -> efter, indeks 84 -> bagud", () => {
    expect(calcBoardProgress(850, 425 * 0.9, new Date(2026, 8, 15)).status).toBe("efter");
    expect(calcBoardProgress(850, 425 * 0.84, new Date(2026, 8, 15)).status).toBe("bagud");
  });

  it("mål 0 -> indeks null, ukendt", () => {
    const p = calcBoardProgress(0, 0, new Date(2026, 8, 15));
    expect(p.indeks).toBeNull();
    expect(p.status).toBe("ukendt");
  });
});

describe("indeksBarClass", () => {
  const d = new Date(2026, 8, 15); // forventet = 425

  it("indeks 105 -> grøn", () => {
    expect(indeksBarClass(calcBoardProgress(850, 425 * 1.05, d).status)).toBe("bg-emerald-400");
  });

  it("indeks 95-104 -> gul", () => {
    expect(indeksBarClass(calcBoardProgress(850, 425 * 0.95, d).status)).toBe("bg-yellow-400");
    expect(indeksBarClass(calcBoardProgress(850, 425 * 1.04, d).status)).toBe("bg-yellow-400");
  });

  it("indeks under 95 -> rød (både efter og bagud)", () => {
    expect(indeksBarClass(calcBoardProgress(850, 425 * 0.9, d).status)).toBe("bg-rose-400");
    expect(indeksBarClass(calcBoardProgress(850, 425 * 0.5, d).status)).toBe("bg-rose-400");
  });

  it("ukendt -> neutral", () => {
    expect(indeksBarClass("ukendt")).toBe("bg-slate-600");
  });
});
