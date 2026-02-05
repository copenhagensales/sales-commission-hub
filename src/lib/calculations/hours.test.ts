import { describe, it, expect } from "vitest";
import {
  BREAK_THRESHOLD_MINUTES,
  BREAK_DURATION_MINUTES,
  calculateHoursFromShift,
  calculateHoursFromTimestamps,
  parseTimeToMinutes,
  formatMinutesAsHours,
  requiresBreakDeduction,
} from "./hours";

describe("Constants", () => {
  it("should have correct break threshold (6 hours)", () => {
    expect(BREAK_THRESHOLD_MINUTES).toBe(360);
  });

  it("should have correct break duration (30 minutes)", () => {
    expect(BREAK_DURATION_MINUTES).toBe(30);
  });
});

describe("calculateHoursFromShift", () => {
  it("should calculate hours for a standard 8-hour shift with break", () => {
    // 08:00-16:00 = 8 hours, but > 6 hours so -30 min break = 7.5 hours
    expect(calculateHoursFromShift("08:00", "16:00")).toBe(7.5);
  });

  it("should not deduct break for shifts under 6 hours", () => {
    // 09:00-14:00 = 5 hours, no break deduction
    expect(calculateHoursFromShift("09:00", "14:00")).toBe(5);
  });

  it("should deduct break for shifts exactly at threshold", () => {
    // 08:00-14:01 = 6 hours 1 min = 361 min > 360, so -30 min break
    expect(calculateHoursFromShift("08:00", "14:01")).toBeCloseTo(5.52, 1);
  });

  it("should handle overnight shifts", () => {
    // 22:00-06:00 = 8 hours, -30 min break = 7.5 hours
    expect(calculateHoursFromShift("22:00", "06:00")).toBe(7.5);
  });

  it("should handle HH:mm:ss format", () => {
    expect(calculateHoursFromShift("08:00:00", "16:00:00")).toBe(7.5);
  });

  it("should return 0 for empty start time", () => {
    expect(calculateHoursFromShift("", "16:00")).toBe(0);
  });

  it("should return 0 for empty end time", () => {
    expect(calculateHoursFromShift("08:00", "")).toBe(0);
  });

  it("should use explicit break minutes when provided", () => {
    // 08:00-16:00 = 8 hours, explicit 0 break = 8 hours
    expect(calculateHoursFromShift("08:00", "16:00", 0)).toBe(8);
    // 08:00-16:00 = 8 hours, explicit 60 min break = 7 hours
    expect(calculateHoursFromShift("08:00", "16:00", 60)).toBe(7);
  });

  it("should handle short shifts with explicit break", () => {
    // 09:00-12:00 = 3 hours, explicit 15 min break = 2.75 hours
    expect(calculateHoursFromShift("09:00", "12:00", 15)).toBe(2.75);
  });
});

describe("parseTimeToMinutes", () => {
  it("should parse HH:mm format", () => {
    expect(parseTimeToMinutes("08:30")).toBe(510);
  });

  it("should parse HH:mm:ss format", () => {
    expect(parseTimeToMinutes("08:30:00")).toBe(510);
  });

  it("should return null for empty string", () => {
    expect(parseTimeToMinutes("")).toBe(null);
  });

  it("should return null for invalid format", () => {
    expect(parseTimeToMinutes("invalid")).toBe(null);
  });

  it("should handle midnight", () => {
    expect(parseTimeToMinutes("00:00")).toBe(0);
  });

  it("should handle end of day", () => {
    expect(parseTimeToMinutes("23:59")).toBe(1439);
  });
});

describe("formatMinutesAsHours", () => {
  it("should format 450 minutes as 7,5", () => {
    expect(formatMinutesAsHours(450)).toBe("7,5");
  });

  it("should format 60 minutes as 1,0", () => {
    expect(formatMinutesAsHours(60)).toBe("1,0");
  });

  it("should format 0 minutes as 0,0", () => {
    expect(formatMinutesAsHours(0)).toBe("0,0");
  });
});

describe("requiresBreakDeduction", () => {
  it("should return true for shifts over 6 hours", () => {
    expect(requiresBreakDeduction("08:00", "16:00")).toBe(true);
  });

  it("should return false for shifts under 6 hours", () => {
    expect(requiresBreakDeduction("09:00", "14:00")).toBe(false);
  });

  it("should return false for exactly 6 hour shift", () => {
    expect(requiresBreakDeduction("08:00", "14:00")).toBe(false);
  });

  it("should return true for overnight shifts over 6 hours", () => {
    expect(requiresBreakDeduction("22:00", "06:00")).toBe(true);
  });
});

describe("calculateHoursFromTimestamps", () => {
  it("should calculate hours from Date objects", () => {
    const clockIn = new Date("2025-02-05T08:00:00");
    const clockOut = new Date("2025-02-05T16:00:00");
    expect(calculateHoursFromTimestamps(clockIn, clockOut)).toBe(8);
  });

  it("should subtract break minutes", () => {
    const clockIn = new Date("2025-02-05T08:00:00");
    const clockOut = new Date("2025-02-05T16:00:00");
    expect(calculateHoursFromTimestamps(clockIn, clockOut, 30)).toBe(7.5);
  });

  it("should handle string timestamps", () => {
    expect(calculateHoursFromTimestamps(
      "2025-02-05T08:00:00",
      "2025-02-05T16:00:00"
    )).toBe(8);
  });
});
