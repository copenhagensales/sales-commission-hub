import { describe, expect, it } from "vitest";
import { fillMilestoneDay, pulsenDayLabel } from "@/lib/pulsen/format";

const now = new Date("2026-10-22T10:00:00Z"); // torsdag 22/10 i Danmark

describe("Pulsen milepælsdato", () => {
  it("skriver 'i dag' kun samme dag", () => {
    expect(pulsenDayLabel("2026-10-22", now)).toBe("i dag");
  });
  it("skriver ugedag og dato senere", () => {
    expect(pulsenDayLabel("2026-10-21", now)).toBe("onsdag 21/10");
    expect(pulsenDayLabel("2026-10-22", new Date("2026-10-23T10:00:00Z"))).toBe("torsdag 22/10");
  });
  it("erstatter {dag} i teksten", () => {
    expect(fillMilestoneDay("**United** rundede **225 salg** {dag}", "2026-10-21", now)).toBe("**United** rundede **225 salg** onsdag 21/10");
  });
});
