import { describe, it, expect } from "vitest";
import { valider, gyldigtCvr, oversaetFejl, type FiberKladde } from "./tdcFiber";

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
  it("fejl oversættes kun ved præcis match", () => {
    expect(oversaetFejl({ code: "P0001", message: "tdc_fiber_ugyldigt_cvr" })).toBe("CVR skal være 8 cifre.");
    expect(oversaetFejl({ code: "P0001", message: "noget tdc_fiber_ugyldigt_cvr" })).toBeNull();
    expect(oversaetFejl({ code: "42501", message: "tdc_fiber_ugyldigt_cvr" })).toBeNull();
  });
});
