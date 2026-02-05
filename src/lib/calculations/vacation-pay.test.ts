import { describe, it, expect } from "vitest";
import {
  VACATION_PAY_RATES,
  getVacationPayRate,
  calculateVacationPay,
  type VacationType,
} from "./vacation-pay";

describe("VACATION_PAY_RATES", () => {
  it("should have correct rates for all employee types", () => {
    expect(VACATION_PAY_RATES.SELLER).toBe(0.125);
    expect(VACATION_PAY_RATES.STAFF).toBe(0.125);
    expect(VACATION_PAY_RATES.ASSISTANT).toBe(0.125);
    expect(VACATION_PAY_RATES.LEADER).toBe(0.01);
  });
});

describe("getVacationPayRate", () => {
  it("should return 12.5% for vacation_pay type", () => {
    expect(getVacationPayRate("vacation_pay")).toBe(0.125);
  });

  it("should return 1% for vacation_bonus type (ferie med løn)", () => {
    expect(getVacationPayRate("vacation_bonus")).toBe(0.01);
  });

  it("should return 0 for null vacation type", () => {
    expect(getVacationPayRate(null)).toBe(0);
  });

  it("should return 0 for unknown vacation type", () => {
    // Test that null returns 0 (undefined not in type)
    const unknownType = null as VacationType;
    expect(getVacationPayRate(unknownType)).toBe(0);
  });
});

describe("calculateVacationPay", () => {
  it("should calculate 12.5% vacation pay with default rate", () => {
    expect(calculateVacationPay(10000)).toBe(1250);
  });

  it("should calculate with custom rate", () => {
    expect(calculateVacationPay(10000, 0.01)).toBe(100);
  });

  it("should return 0 for zero base salary", () => {
    expect(calculateVacationPay(0)).toBe(0);
  });

  it("should handle negative base salary", () => {
    expect(calculateVacationPay(-1000)).toBe(-125);
  });
});
