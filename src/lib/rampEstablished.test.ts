import { describe, expect, it } from "vitest";
import { coverage, lastFullWeeks, seniority, sortByLongestSince, weeksAgoLabel } from "./rampEstablished";

const weeks = [37, 38, 39, 40, 41, 42].map((w) => ({ iso_year: 2026, iso_week: w }));
// uge 39 = 21.-27. sep, uge 40 = 28. sep-4. okt, uge 41 = 5.-11. okt
const coach = (d: string) => ({ action_type: "1-1 samtale", performed_at: `${d}T10:00:00`, note: "x" });
const absent = (d: string) => ({ action_type: "fravær hele ugen", performed_at: `${d}T10:00:00`, note: null });

describe("rampEstablished", () => {
  it("tager de 4 hele uger før den indeværende", () => {
    const r = lastFullWeeks(weeks, [coach("2026-09-23"), absent("2026-10-06")]);
    expect(r.map((x) => x.iso_week)).toEqual([38, 39, 40, 41]);
    expect(r.map((x) => x.state)).toEqual(["none", "held", "none", "absence"]);
  });

  it("dækning udelader fraværsuger", () => {
    const a = lastFullWeeks(weeks, [coach("2026-09-23"), absent("2026-10-06")]); // 1 af 3
    const b = lastFullWeeks(weeks, [coach("2026-09-16"), coach("2026-09-23"), coach("2026-09-30"), coach("2026-10-07")]); // 4 af 4
    expect(coverage([a])).toEqual({ held: 1, total: 3, pct: 33 });
    expect(coverage([a, b])).toEqual({ held: 5, total: 7, pct: 71 });
  });

  it("sorterer aldrig-holdt øverst, derefter ældste 1-1", () => {
    const list = sortByLongestSince([
      { employee_name: "B", actions: [coach("2026-10-07")] },
      { employee_name: "A", actions: [] },
      { employee_name: "C", actions: [coach("2026-09-01")] },
    ]);
    expect(list.map((x) => x.employee_name)).toEqual(["A", "C", "B"]);
  });

  it("anciennitet og uger siden", () => {
    const today = new Date(2026, 9, 14);
    expect(seniority("2026-02-10", today)).toBe("8 mdr.");
    expect(seniority("2025-09-01", today)).toBe("1 år");
    expect(weeksAgoLabel("2026-10-14T09:00:00", today)).toBe("I dag");
    expect(weeksAgoLabel("2026-10-07T09:00:00", today)).toBe("1 uge siden");
    expect(weeksAgoLabel("2026-09-10T09:00:00", today)).toBe("5 uger siden");
  });
});
