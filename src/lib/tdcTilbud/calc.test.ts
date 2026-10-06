import { describe, expect, it } from "vitest";
import { calcTilbud, affordableCount } from "./calc";

describe("calcTilbud (Aarhus Arket 2.0)", () => {
  // Arkets eksempel: C5=1 (100GB Pro), C11=1 (5GB Basis), C15=1 (Std oms), C16=1 (DDI), C33=2 (datakort)
  const q = { "pro-100": 1, "eu-basis-5": 1, "oms-std": 1, ddi: 1, datakort: 2 };
  const t = calcTilbud(q, {});

  it("pris (F19), moms (G19), tilskud (H19), pris-tilskud (I19)", () => {
    expect(t.price).toBeCloseTo(209 + 109 + 145.6 + 14 + 2 * 36.4);
    expect(t.priceInclVat).toBeCloseTo(t.price * 1.25);
    expect(t.subsidy).toBe(1881 + 684);
    expect(t.priceAfterSubsidy).toBeCloseTo(t.price - 2565 / 36);
  });

  it("provision (F31:H31) og difference (I31)", () => {
    expect(t.commission).toEqual([1300 + 585 + 850, 1075 + 470 + 850, 850 + 350 + 850]);
    expect(t.commissionDiff).toBe(t.commission[0] - t.commission[1]);
  });

  it("MB hovednummer tæller ikke med i provision, som i arket", () => {
    expect(calcTilbud({ "mb-hoved": 1 }, {}).commission).toEqual([0, 0, 0]);
    expect(calcTilbud({ "mb-hoved": 1 }, {}).price).toBe(38.5);
  });

  it("resterende budget og antal", () => {
    const h = calcTilbud(q, { "Apple-11": 1 });
    expect(h.remainingBudget).toBeCloseTo(2565 - 959.2);
    expect(affordableCount(h.remainingBudget, 959.2)).toBe(1);
    expect(affordableCount(-5, 100)).toBe(0);
  });
});
