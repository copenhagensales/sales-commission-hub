import { describe, it, expect } from "vitest";
import { countsTowardPayrollProvision } from "./payrollSaleFilter";

describe("countsTowardPayrollProvision", () => {
  it("counts pending sales", () => expect(countsTowardPayrollProvision("pending")).toBe(true));
  it("counts sales without status", () => expect(countsTowardPayrollProvision(null)).toBe(true));
  it("excludes cancelled sales", () => expect(countsTowardPayrollProvision("cancelled")).toBe(false));
  it("excludes rejected sales", () => expect(countsTowardPayrollProvision("rejected")).toBe(false));
});
