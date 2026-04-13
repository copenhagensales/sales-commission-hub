/**
 * Centralized shift resolution module.
 *
 * Single source of truth for determining whether an employee has a shift on a given day
 * and what times/hours that shift entails.
 *
 * Hierarchy (binding):
 *   1. Individual shift (shift table — date-specific)
 *   2. Assigned standard shift (employee_standard_shifts → team_standard_shift_days)
 *   3. No shift → hasShift: false, 0 hours
 *
 * NO weekday fallback. A day without a configured shift = no work, regardless of day-of-week.
 */

import { format, eachDayOfInterval, differenceInMinutes, parse } from "date-fns";

// ── Types ────────────────────────────────────────────────────────────

export type ShiftSource = "individual" | "standard" | "none";

export interface ShiftResolution {
  hasShift: boolean;
  source: ShiftSource;
  startTime: string | null; // "HH:mm"
  endTime: string | null;   // "HH:mm"
  hours: number;            // Gross hours (before break deduction)
  reason: string;
}

export interface IndividualShift {
  date: string;           // "yyyy-MM-dd"
  start_time?: string;    // "HH:mm" or "HH:mm:ss"
  end_time?: string;      // "HH:mm" or "HH:mm:ss"
}

export interface StandardShiftDay {
  shift_id: string;
  day_of_week: number;    // 1=Monday .. 7=Sunday (ISO)
  start_time: string;     // "HH:mm:ss"
  end_time: string;       // "HH:mm:ss"
}

export interface ShiftDataBundle {
  /** Individual shifts keyed by date string "yyyy-MM-dd" */
  individualShifts: Map<string, IndividualShift>;
  /** The employee's assigned standard shift days (from employee_standard_shifts → team_standard_shift_days) */
  standardShiftDays: StandardShiftDay[] | null;
  /** Fallback standard shift (team level) — used only if employee has no personal assignment */
  teamStandardShiftDays?: StandardShiftDay[] | null;
  /** The parent standard shift's default times (from team_standard_shifts table) */
  standardShiftDefaults?: { start_time: string; end_time: string } | null;
}

// ── Helpers ──────────────────────────────────────────────────────────

function timeStr(raw: string | undefined | null): string | null {
  if (!raw) return null;
  return raw.slice(0, 5); // "08:00:00" → "08:00"
}

function calcHours(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const baseDate = "2000-01-01";
  const s = parse(start, "HH:mm", new Date(`${baseDate}T00:00:00`));
  const e = parse(end, "HH:mm", new Date(`${baseDate}T00:00:00`));
  const mins = differenceInMinutes(e, s);
  return mins > 0 ? mins / 60 : 0;
}

/** Convert JS Date.getDay() (0=Sun..6=Sat) to ISO day number (1=Mon..7=Sun) */
function toIsoDayOfWeek(jsDay: number): number {
  return jsDay === 0 ? 7 : jsDay;
}

// ── Core resolver ────────────────────────────────────────────────────

/**
 * Resolve shift for a single employee on a single day.
 *
 * Follows the strict 2-level hierarchy:
 *   1. Individual shift (from `shift` table)
 *   2. Assigned standard shift (employee_standard_shifts → team_standard_shift_days)
 *   3. No shift
 */
export function resolveShiftForDay(
  date: Date,
  shiftData: ShiftDataBundle
): ShiftResolution {
  const dateStr = format(date, "yyyy-MM-dd");
  const isoDow = toIsoDayOfWeek(date.getDay());

  // ── Priority 1: Individual shift ──
  const individual = shiftData.individualShifts.get(dateStr);
  if (individual) {
    const start = timeStr(individual.start_time);
    const end = timeStr(individual.end_time);
    return {
      hasShift: true,
      source: "individual",
      startTime: start,
      endTime: end,
      hours: calcHours(start, end),
      reason: `Individuel vagt på ${dateStr}`,
    };
  }

  // ── Priority 2: Assigned standard shift (employee-level) ──
  if (shiftData.standardShiftDays && shiftData.standardShiftDays.length > 0) {
    const dayConfig = shiftData.standardShiftDays.find(
      (d) => d.day_of_week === isoDow
    );
    if (dayConfig) {
      const start = timeStr(dayConfig.start_time);
      const end = timeStr(dayConfig.end_time);
      return {
        hasShift: true,
        source: "standard",
        startTime: start,
        endTime: end,
        hours: calcHours(start, end),
        reason: `Standardvagt (tildelt) — dag ${isoDow}`,
      };
    }
    // Employee has a standard shift assigned but this day is not configured → no shift
    return {
      hasShift: false,
      source: "none",
      startTime: null,
      endTime: null,
      hours: 0,
      reason: `Standardvagt tildelt men ikke konfigureret for dag ${isoDow}`,
    };
  }

  // ── Priority 2b: Team standard shift (fallback when employee has no personal assignment) ──
  if (shiftData.teamStandardShiftDays && shiftData.teamStandardShiftDays.length > 0) {
    const dayConfig = shiftData.teamStandardShiftDays.find(
      (d) => d.day_of_week === isoDow
    );
    if (dayConfig) {
      const start = timeStr(dayConfig.start_time);
      const end = timeStr(dayConfig.end_time);
      return {
        hasShift: true,
        source: "standard",
        startTime: start,
        endTime: end,
        hours: calcHours(start, end),
        reason: `Team-standardvagt — dag ${isoDow}`,
      };
    }
    // Team has a standard shift but not for this day → no shift
    return {
      hasShift: false,
      source: "none",
      startTime: null,
      endTime: null,
      hours: 0,
      reason: `Team-standardvagt ikke konfigureret for dag ${isoDow}`,
    };
  }

  // ── No shift at any level ──
  return {
    hasShift: false,
    source: "none",
    startTime: null,
    endTime: null,
    hours: 0,
    reason: "Ingen vagt konfigureret",
  };
}

// ── Bulk resolver ────────────────────────────────────────────────────

/**
 * Resolve shifts for every day in a period.
 * Returns a Map keyed by date string.
 */
export function resolveShiftsForPeriod(
  start: Date,
  end: Date,
  shiftData: ShiftDataBundle
): Map<string, ShiftResolution> {
  const days = eachDayOfInterval({ start, end });
  const results = new Map<string, ShiftResolution>();

  for (const day of days) {
    results.set(format(day, "yyyy-MM-dd"), resolveShiftForDay(day, shiftData));
  }

  return results;
}

/**
 * Check whether an employee already has a shift on a given date.
 * Used for double-shift protection in CreateShiftDialog etc.
 */
export function hasExistingShift(
  date: Date,
  shiftData: ShiftDataBundle
): { exists: boolean; source: ShiftSource } {
  const resolution = resolveShiftForDay(date, shiftData);
  return {
    exists: resolution.hasShift,
    source: resolution.source,
  };
}

// ── Utility: count working days in a period (shift-aware) ────────────

/**
 * Count the number of days with a shift in a period.
 * Replaces the old weekday-based `countWorkDaysInPeriod`.
 *
 * @param excludeDates Set of "yyyy-MM-dd" strings to exclude (holidays, absences)
 */
export function countShiftDaysInPeriod(
  start: Date,
  end: Date,
  shiftData: ShiftDataBundle,
  excludeDates?: Set<string>
): number {
  const days = eachDayOfInterval({ start, end });
  let count = 0;

  for (const day of days) {
    const dateStr = format(day, "yyyy-MM-dd");
    if (excludeDates?.has(dateStr)) continue;
    const res = resolveShiftForDay(day, shiftData);
    if (res.hasShift) count++;
  }

  return count;
}

/**
 * Get all dates with a shift in a period.
 *
 * @param excludeDates Set of "yyyy-MM-dd" strings to exclude (holidays, absences)
 */
export function getShiftDaysInPeriod(
  start: Date,
  end: Date,
  shiftData: ShiftDataBundle,
  excludeDates?: Set<string>
): Date[] {
  const days = eachDayOfInterval({ start, end });
  const result: Date[] = [];

  for (const day of days) {
    const dateStr = format(day, "yyyy-MM-dd");
    if (excludeDates?.has(dateStr)) continue;
    const res = resolveShiftForDay(day, shiftData);
    if (res.hasShift) result.push(day);
  }

  return result;
}
