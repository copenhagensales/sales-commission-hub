import { describe, it, expect } from "vitest";
import { bygHold } from "./opstartshold";
import type { OpstartRaekke } from "@/hooks/useOpstartshold";

const r = (emp: string, dag: number, dato: string, linjer: number, hiper = 0, slut: string | null = null): OpstartRaekke => ({
  hold_noegle: "h", hold_navn: "Hold", start_dato: "2026-10-20", employee_id: emp, navn: emp, slut_dato: slut, dag, dato, linjer, hiper,
});

describe("bygHold", () => {
  const rows = [
    r("a", 1, "2026-10-20", 0), r("a", 2, "2026-10-21", 3, 1), r("a", 3, "2026-10-22", 2),
    r("b", 1, "2026-10-20", 0, 0, "2026-10-21"), r("b", 2, "2026-10-21", 1, 0, "2026-10-21"), r("b", 3, "2026-10-22", 0, 0, "2026-10-21"),
  ];
  const [h] = bygHold(rows, "2026-10-22");

  it("ansatte og frafald markeres på dagen efter sidste arbejdsdag", () => {
    expect(h.dage.map((d) => d.ansatte)).toEqual([2, 2, 1]);
    expect(h.dage.map((d) => d.frafald)).toEqual([0, 0, 1]);
  });
  it("% solgte = sælgere med mindst én linje / ansatte", () => {
    expect(h.dage[1].pct).toBe(1);
    expect(h.dage[2].pct).toBe(1);
    expect(h.dage[0].pct).toBe(0);
  });
  it("dagen i dag er foreløbig; totaler", () => {
    expect(h.dage[2].foreloebig).toBe(true);
    expect(h.total.linjer).toBe(6);
    expect(h.total.hiper).toBe(1);
    expect(h.total.prStarter).toBe(3);
    expect(h.total.tilbage).toBe(1);
  });
});
