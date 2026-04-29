import { describe, it, expect } from "vitest";
import { buildEmployeeEmailIndex } from "./buildEmployeeEmailIndex";

describe("buildEmployeeEmailIndex", () => {
  it("returnerer tom Map for tomme inputs", () => {
    const result = buildEmployeeEmailIndex({ employees: [], mappings: [], agents: [] });
    expect(result.size).toBe(0);
  });

  it("udelader medarbejder uden nogen valide emails", () => {
    const result = buildEmployeeEmailIndex({
      employees: [{ id: "e1", work_email: null, private_email: "" }],
      mappings: [],
      agents: [],
    });
    expect(result.has("e1")).toBe(false);
  });

  it("kombinerer work + private + dialer-emails i ét Set", () => {
    const result = buildEmployeeEmailIndex({
      employees: [{ id: "e1", work_email: "Work@cph.dk", private_email: "Me@gmail.com" }],
      mappings: [
        { employee_id: "e1", agent_id: "a1" },
        { employee_id: "e1", agent_id: "a2" },
      ],
      agents: [
        { id: "a1", email: "Dialer1@cph.dk" },
        { id: "a2", email: "dialer2@cph.dk" },
      ],
    });
    const set = result.get("e1");
    expect(set).toBeDefined();
    expect(set!.size).toBe(4);
    expect(set!.has("work@cph.dk")).toBe(true);
    expect(set!.has("me@gmail.com")).toBe(true);
    expect(set!.has("dialer1@cph.dk")).toBe(true);
    expect(set!.has("dialer2@cph.dk")).toBe(true);
  });

  it("springer NULL/empty/whitespace emails over", () => {
    const result = buildEmployeeEmailIndex({
      employees: [{ id: "e1", work_email: "  ", private_email: null }],
      mappings: [{ employee_id: "e1", agent_id: "a1" }],
      agents: [
        { id: "a1", email: "" },
        { id: "a2", email: "valid@cph.dk" },
      ],
    });
    expect(result.has("e1")).toBe(false);
  });

  it("normaliserer alle emails til lowercase", () => {
    const result = buildEmployeeEmailIndex({
      employees: [{ id: "e1", work_email: "MIXED@CPH.DK", private_email: null }],
      mappings: [],
      agents: [],
    });
    expect(result.get("e1")?.has("mixed@cph.dk")).toBe(true);
    expect(result.get("e1")?.has("MIXED@CPH.DK")).toBe(false);
  });

  it("inkluderer deaktiverede medarbejdere (helperen filtrerer ikke på is_active)", () => {
    // Helperen modtager ikke is_active — caller bestemmer hvad der hentes.
    // Denne test sikrer at helperen behandler alle givne employees ens.
    const result = buildEmployeeEmailIndex({
      employees: [
        { id: "active", work_email: "a@cph.dk", private_email: null },
        { id: "inactive", work_email: "i@cph.dk", private_email: null },
      ],
      mappings: [],
      agents: [],
    });
    expect(result.size).toBe(2);
  });

  it("ignorerer mappings der peger på ukendt agent_id", () => {
    const result = buildEmployeeEmailIndex({
      employees: [{ id: "e1", work_email: "w@cph.dk", private_email: null }],
      mappings: [{ employee_id: "e1", agent_id: "ghost" }],
      agents: [],
    });
    expect(result.get("e1")?.size).toBe(1);
  });
});
