import { describe, it, expect } from "vitest";
import { valider, validerAdmin, periodeStart, gyldigtCvr, oversaetFejl, type FiberKladde } from "./tdcFiber";

const base: FiberKladde = { type: "fuldt", variant: "HAP", mobilevoice: false, cvr: "12345678", leadgiverId: null };

describe("TDC fiber regler", () => {
  it("fuldt salg uden leadgiver er gyldigt", () => {
    expect(valider(base, "me")).toEqual({});
  });
  it("fuldt salg afviser leadgiver", () => {
    expect(valider({ ...base, leadgiverId: "x" }, "me").leadgiver).toBeDefined();
  });
  it("lukket salg kræver leadgiver", () => {
    expect(valider({ ...base, type: "lukket" }, "me").leadgiver).toBeDefined();
    expect(valider({ ...base, type: "lukket", leadgiverId: "x" }, "me")).toEqual({});
  });
  it("leadgiver må ikke være sælgeren selv", () => {
    expect(valider({ ...base, type: "lukket", leadgiverId: "me" }, "me").leadgiver).toBeDefined();
  });
  it("CVR skal være præcis 8 cifre", () => {
    expect(gyldigtCvr("12 34 56 78")).toBe(true);
    expect(gyldigtCvr("1234567")).toBe(false);
    expect(gyldigtCvr("123456789")).toBe(false);
    expect(gyldigtCvr("1234567a")).toBe(false);
  });
  it("rettelse til fuldt salg fjerner krav om leadgiver, til lukket kræver den", () => {
    expect(valider({ ...base, type: "fuldt", leadgiverId: null }, "saelger")).toEqual({});
    expect(valider({ ...base, type: "lukket", leadgiverId: null }, "saelger").leadgiver).toBeDefined();
    expect(valider({ ...base, type: "lukket", leadgiverId: "saelger" }, "saelger").leadgiver).toBeDefined();
  });
  it("fejl oversættes kun ved præcis match", () => {
    expect(oversaetFejl({ code: "P0001", message: "tdc_fiber_ugyldigt_cvr" })).toBe("CVR skal være 8 cifre.");
    expect(oversaetFejl({ code: "P0001", message: "noget tdc_fiber_ugyldigt_cvr" })).toBeNull();
    expect(oversaetFejl({ code: "42501", message: "tdc_fiber_ugyldigt_cvr" })).toBeNull();
  });
  it("lønperioden starter den 15.", () => {
    expect(periodeStart(new Date(2026, 10, 1))).toBe("2026-10-15");
    expect(periodeStart(new Date(2026, 10, 15))).toBe("2026-11-15");
    expect(periodeStart(new Date(2026, 0, 3))).toBe("2025-12-15");
  });
  it("admin: dato i perioden er gyldig, før perioden eller i fremtiden afvises", () => {
    const idag = new Date(2026, 10, 1);
    expect(validerAdmin(base, "s", "2026-10-15", idag)).toEqual({});
    expect(validerAdmin(base, "s", "2026-11-01", idag)).toEqual({});
    expect(validerAdmin(base, "s", "2026-10-14", idag).dato).toBeDefined();
    expect(validerAdmin(base, "s", "2026-11-02", idag).dato).toBeDefined();
  });
  it("admin: sælger kræves og må ikke være leadgiver", () => {
    const idag = new Date(2026, 10, 1);
    expect(validerAdmin(base, null, "2026-11-01", idag).lukker).toBeDefined();
    expect(validerAdmin({ ...base, type: "lukket", leadgiverId: "s" }, "s", "2026-11-01", idag).leadgiver).toBeDefined();
  });
});
