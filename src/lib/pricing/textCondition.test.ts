import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { evaluateTextCondition, isTextListCondition } from "./textCondition";
import * as edge from "../../../supabase/functions/_shared/textCondition";

const impls = { frontend: evaluateTextCondition, edge: edge.evaluateTextCondition };

for (const [name, evaluate] of Object.entries(impls)) {
  describe(`tekstbetingelse (${name})`, () => {
    it("gammelt format = matcher kun præcis værdi", () => {
      expect(evaluate("Lønmodtager", "Lønmodtager")).toBe(true);
      expect(evaluate("Lønmodtager", "Selvstændig")).toBe(false);
    });
    it("en af de valgte", () => {
      const c = { operator: "in" as const, values: ["Lønmodtager", "Selvstændig"] };
      expect(evaluate(c, "Selvstændig")).toBe(true);
      expect(evaluate(c, "Studerende")).toBe(false);
    });
    it("ikke lig med", () => {
      const c = { operator: "not_in" as const, values: ["Lønmodtager"] };
      expect(evaluate(c, "Selvstændig")).toBe(true);
      expect(evaluate(c, "Lønmodtager")).toBe(false);
    });
    it("manglende felt matcher aldrig", () => {
      expect(evaluate("Lønmodtager", undefined)).toBe(false);
      expect(evaluate({ operator: "not_in", values: ["Lønmodtager"] }, undefined)).toBe(false);
    });
    it("tom liste matcher aldrig", () => {
      expect(evaluate({ operator: "in", values: [] }, "Lønmodtager")).toBe(false);
      expect(evaluate({ operator: "not_in", values: [] }, "Lønmodtager")).toBe(false);
    });
  });
}

describe("format", () => {
  it("talbetingelse forveksles ikke med tekstbetingelse", () => {
    expect(isTextListCondition({ operator: "in", value: 0, values: [1, 2] })).toBe(false);
    expect(isTextListCondition({ operator: "in", values: ["a"] })).toBe(true);
  });
  it("frontend og edge er identiske", () => {
    const strip = (p: string) => readFileSync(p, "utf8").replace(/Holdes 1:1 med .*\n/, "");
    expect(strip("src/lib/pricing/textCondition.ts")).toBe(strip("supabase/functions/_shared/textCondition.ts"));
  });
});
