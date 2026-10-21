import { describe, expect, it } from "vitest";
import { computeFlowLines, flowStatus, type FlowDailyRow } from "./trygFlow";

describe("flowStatus", () => {
  it("grøn når krævet ≤ tempo", () => expect(flowStatus(100, 100)).toBe("green"));
  it("gul når krævet ≤ 120 % af tempo", () => expect(flowStatus(120, 100)).toBe("yellow"));
  it("rød over 120 % af tempo", () => expect(flowStatus(121, 100)).toBe("red"));
});

describe("computeFlowLines", () => {
  // Onsdag 21/10-2026: resterende arbejdsdage ons–fre = 3.
  const today = "2026-10-21";
  const row = (day: string, kind: string, n: number, agent = "", status = "success"): FlowDailyRow => ({
    day, account: "main", adversus_campaign_id: "1", kind, agent_reference: agent, status, lead_count: n,
  });
  const base = {
    lines: ["A"],
    lineOf: () => "A",
    closing: new Set(["success"]),
    holidays: new Set<string>(),
    today,
  };

  it("Mangler = Modtaget − Lukket til og med i går, krævet = Mangler ÷ resterende arbejdsdage", () => {
    const [l] = computeFlowLines({
      ...base,
      rows: [row("2026-10-19", "received", 900), row("2026-10-20", "closed", 300, "u1")],
    });
    expect(l.receivedThisWeek).toBe(900);
    expect(l.closedToYesterday).toBe(300);
    expect(l.missing).toBe(600);
    expect(l.requiredPerWorkday).toBe(200);
  });

  it("emner fra tidligere uger tæller fuldt som lukkede, og ikke-lukkende statusser tæller ikke", () => {
    const [l] = computeFlowLines({
      ...base,
      rows: [
        row("2026-10-19", "received", 10),
        row("2026-10-20", "closed", 12, "u1"),
        row("2026-10-20", "closed", 50, "u1", "automaticRedial"),
      ],
    });
    expect(l.missing).toBe(0);
  });

  it("rød: anbefaling X lukninger/dag ≈ Y sælgere ud fra lukninger pr. sælger-dag", () => {
    // Tempo: 100 lukninger på 10 arbejdsdage = 10/dag; 2 sælger-dage → 50 pr. sælger-dag.
    const [l] = computeFlowLines({
      ...base,
      rows: [
        row("2026-10-19", "received", 300),
        row("2026-10-20", "closed", 50, "u1"),
        row("2026-10-16", "closed", 50, "u2"),
      ],
    });
    // Mangler 250 ÷ 3 dage = 83,33; tempo 10 → mangler 73,33/dag ≈ 1,47 sælgere.
    expect(l.status).toBe("red");
    expect(l.shortfallPerDay).toBeCloseTo(73.33, 1);
    expect(l.extraSellers).toBeCloseTo(1.47, 2);
  });

  it("helligdage trækkes fra resterende arbejdsdage", () => {
    const [l] = computeFlowLines({
      ...base,
      holidays: new Set(["2026-10-23"]),
      rows: [row("2026-10-19", "received", 100)],
    });
    expect(l.requiredPerWorkday).toBe(50);
  });

  it("Pulje = akkumuleret Modtaget − Lukket siden første modtagne dag", () => {
    const [l] = computeFlowLines({
      ...base,
      rows: [
        row("2026-10-12", "received", 100),
        row("2026-10-14", "closed", 80, "u1"),
        row("2026-10-19", "received", 50),
        row("2026-10-20", "closed", 40, "u1"),
      ],
    });
    expect(l.pool).toBe(30);
  });

  it("uden Modtaget-data (fx Enreach) vises ingen Mangler/Status", () => {
    const [l] = computeFlowLines({ ...base, rows: [row("2026-10-20", "closed", 5, "u1")] });
    expect(l.missing).toBeNull();
    expect(l.status).toBeNull();
  });
});
