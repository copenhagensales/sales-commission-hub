import { describe, it, expect } from "vitest";
import { bygHold, farveTrin } from "./opstartshold";
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

describe("farveTrin (linjer pr. sælger)", () => {
  it("5 trin med grænser 0,4 / 0,8 / 1,2 / 2,0", () => {
    expect([0.3, 0.4, 0.7, 0.8, 1.1, 1.2, 1.9, 2.0].map(farveTrin)).toEqual([0, 1, 1, 2, 2, 3, 3, 4]);
  });
});

describe("hold 20/10 dag 6 (14 linjer, 6 af 10 solgte)", () => {
  const rows: OpstartRaekke[] = Array.from({ length: 10 }, (_, i) => r(`s${i}`, 6, "2026-10-27", i < 6 ? (i < 4 ? 3 : 1) : 0));
  const [h] = bygHold(rows, "2026-10-28");
  it("viser 14 (1,4) · 60 % · 6 af 10", () => {
    const d = h.dage[0];
    expect(`${d.linjer} (${d.prSaelger.toFixed(1).replace(".", ",")}) · ${Math.round(d.pct * 100)} % · ${d.solgte} af ${d.ansatte}`).toBe("14 (1,4) · 60 % · 6 af 10");
  });
});
