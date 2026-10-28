import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MilestoneRow, isHeroMilestone, milestoneTypeLabel, milestoneUnit } from "./TodayMilestones";
import type { PulsenMilestone, PulsenMilestoneType } from "@/hooks/usePulsen";

const mk = (type: string, level: number, tier: number | null | undefined, text = "**Team A** tekst"): PulsenMilestone => ({
  id: "1", milestone_type: type as PulsenMilestoneType, employee_id: null, team_id: null, period_key: "2026-10-28",
  level, value: 12345, shown_in_house: true, occurred_at: "2026-10-28T12:00:00Z",
  payload: tier === undefined ? { text, day: "2026-10-28" } : { text, day: "2026-10-28", tier: tier as number },
});
const fr = {} as Parameters<typeof MilestoneRow>[0]["fr"];

describe("top 5-dage", () => {
  it("teamrekord tier 3 = »top 5-dag« og ikke højdepunkt", () => {
    const m = mk("team_record", 1, 3);
    expect(milestoneTypeLabel(m)).toBe("top 5-dag");
    expect(isHeroMilestone(m)).toBe(false);
  });
  it("tier 1, 0 og manglende tier er højdepunkt med rekordlabel", () => {
    for (const t of [1, 0, null, undefined]) {
      const m = mk("house_record", 1, t);
      expect(isHeroMilestone(m)).toBe(true);
      expect(milestoneTypeLabel(m)).toBe("husrekord");
    }
  });
  it("tier 6 er ikke top 5-label", () => expect(milestoneTypeLabel(mk("team_record", 1, 6))).toBe("teamrekord"));
  it("record_day level 0 / tier 3 i kr, aldrig hero", () => {
    const m = mk("record_day", 0, 3, "**Aslak L.** havde sin **3.-bedste dag**");
    expect(milestoneTypeLabel(m)).toBe("top 5-dag");
    expect(milestoneUnit(m)).toBe("kr");
    expect(isHeroMilestone(m)).toBe(false);
    const { container } = render(<MilestoneRow m={m} fr={fr} interactive={false} />);
    expect(container.textContent).toContain("Aslak L.");
    expect(container.textContent).toContain("top 5-dag");
  });
  it("historisk team-/husrekord level 0/tier 0 i salg", () => {
    const m = mk("team_record", 0, 0);
    expect(milestoneUnit(m)).toBe("salg");
    expect(milestoneTypeLabel(m)).toBe("teamrekord");
    expect(render(<MilestoneRow m={m} fr={fr} interactive={false} />).container.textContent).toContain("salg");
  });
  it("ukendt type renderer uden undefined", () => {
    const m = mk("ny_type", 0, null);
    expect(milestoneTypeLabel(m)).toBe("milepæl");
    expect(milestoneUnit(m)).toBe("");
    const { container } = render(<MilestoneRow m={m} fr={fr} interactive={false} />);
    expect(container.textContent).not.toContain("undefined");
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
