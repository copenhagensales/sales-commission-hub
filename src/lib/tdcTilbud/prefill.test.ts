import { describe, it, expect } from "vitest";
import { buildPrefill } from "./prefill";
import { calcTilbud } from "./calc";

describe("buildPrefill", () => {
  it("summen af alle grupper svarer til tilbuddets pris", () => {
    const q = { "pro-100": 3, "mbb-50": 1, "oms-pro": 1, ddi: 2, filter: 1 };
    const p = buildPrefill(q, {});
    expect(p.mobilePrice + p.mbbPrice + p.otherPrice).toBeCloseTo(calcTilbud(q, {}).price);
    expect(p.otherText).toContain("Professionel omstilling");
  });
});
