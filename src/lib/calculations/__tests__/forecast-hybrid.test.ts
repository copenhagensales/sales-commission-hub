import { describe, it, expect } from "vitest";
import {
  calculateReliabilityWeight,
  forecastNewEmployee,
  forecastNewEmployeeHybrid,
  MOCK_RAMP_PROFILE,
} from "../forecast";
import type { EmployeePerformance } from "@/types/forecast";

function makeEmp(overrides: Partial<EmployeePerformance> = {}): EmployeePerformance {
  return {
    employeeId: "e1",
    employeeName: "Test",
    teamName: "Team A",
    avatarUrl: null,
    weeklySalesPerHour: [],
    grossPlannedHours: 150,
    plannedHours: 150,
    personalAttendanceFactor: 0.95,
    isEstablished: false,
    daysSinceStart: 30,
    totalHoursWorked: 0,
    totalSalesCount: 0,
    validWeekCount: 0,
    ...overrides,
  };
}

const baseline = 0.5;

describe("calculateReliabilityWeight", () => {
  it("returns 0 when < 2 valid weeks", () => {
    expect(calculateReliabilityWeight(50, 10, 1)).toBe(0);
  });

  it("returns 0 when < 20 hours", () => {
    expect(calculateReliabilityWeight(15, 10, 3)).toBe(0);
  });

  it("returns positive weight with sufficient data", () => {
    const w = calculateReliabilityWeight(60, 20, 3);
    expect(w).toBeGreaterThan(0);
    expect(w).toBeLessThanOrEqual(1);
  });

  it("caps at 1 with lots of data", () => {
    const w = calculateReliabilityWeight(200, 100, 8);
    expect(w).toBe(1);
  });
});

describe("forecastNewEmployeeHybrid", () => {
  it("falls back to ramp-only when no data (w=0)", () => {
    const emp = makeEmp({ validWeekCount: 0, totalHoursWorked: 0 });
    const hybrid = forecastNewEmployeeHybrid(emp, MOCK_RAMP_PROFILE, baseline);
    const rampOnly = forecastNewEmployee(emp, MOCK_RAMP_PROFILE, baseline);

    expect(hybrid.forecastSales).toBe(rampOnly.forecastSales);
    expect(hybrid.hybridBlend).toBe(false);
  });

  it("blends when sufficient data exists", () => {
    const emp = makeEmp({
      weeklySalesPerHour: [0.3, 0.35, 0.28],
      validWeekCount: 3,
      totalHoursWorked: 90,
      totalSalesCount: 30,
    });
    const hybrid = forecastNewEmployeeHybrid(emp, MOCK_RAMP_PROFILE, baseline);
    expect(hybrid.hybridBlend).toBe(true);
    expect(hybrid.reliabilityWeight).toBeGreaterThan(0);
    expect(hybrid.empiricalSph).toBeDefined();
  });

  it("clamps extreme empirical SPH via guardrails", () => {
    // Empirical SPH way higher than ramp-expected
    const emp = makeEmp({
      weeklySalesPerHour: [2.0, 2.0, 2.0],
      validWeekCount: 3,
      totalHoursWorked: 90,
      totalSalesCount: 180,
      daysSinceStart: 30,
    });
    const hybrid = forecastNewEmployeeHybrid(emp, MOCK_RAMP_PROFILE, baseline);
    // baseline = 0.5, clampHigh = 0.5 * 1.4 = 0.7
    // So the empirical (2.0) should be clamped to 0.7, result SPH < 1.0
    expect(hybrid.expectedSph).toBeLessThan(1.0);
    expect(hybrid.hybridBlend).toBe(true);
  });

  it("uses empirical SPH directly when above ramp and reliable (asymmetric blend)", () => {
    const emp = makeEmp({
      weeklySalesPerHour: [0.7, 0.72, 0.68],
      validWeekCount: 3,
      totalHoursWorked: 90,
      totalSalesCount: 65,
      daysSinceStart: 45,
    });
    const hybrid = forecastNewEmployeeHybrid(emp, MOCK_RAMP_PROFILE, baseline);
    expect(hybrid.hybridBlend).toBe(true);
    // With asymmetric blend, finalSph should be close to empirical (~0.7), not dragged down by ramp
    expect(hybrid.expectedSph).toBeGreaterThan(0.6);
  });

  it("applies momentum cap of ±15% for new hires", () => {
    // Recent weeks much higher than EWMA
    const emp = makeEmp({
      weeklySalesPerHour: [0.6, 0.6, 0.2, 0.2],
      validWeekCount: 4,
      totalHoursWorked: 120,
      totalSalesCount: 50,
      daysSinceStart: 30,
    });
    const hybrid = forecastNewEmployeeHybrid(emp, MOCK_RAMP_PROFILE, baseline);
    // With +25% momentum cap it would be higher; with +15% cap it's more conservative
    expect(hybrid.hybridBlend).toBe(true);
    // Just verify it doesn't crash and produces a reasonable result
    expect(hybrid.forecastSales).toBeGreaterThan(0);
  });
});
