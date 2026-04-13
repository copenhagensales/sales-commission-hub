import { useQuery } from "@tanstack/react-query";
import { format, eachDayOfInterval, isBefore, isAfter, isSameDay, startOfDay } from "date-fns";
import { useShiftResolution } from "@/hooks/useShiftResolution";
import { resolveShiftForDay } from "@/lib/shiftResolution";

interface WorkingDaysResult {
  total: number;
  passed: number;
  remaining: number;
  days: Date[];
}

/**
 * Calculates working days for an employee using the centralized shift resolver.
 *
 * Hierarchy (no weekday fallback):
 *   1. Individual shifts (shift table) – highest priority
 *   2. Assigned standard shift (employee_standard_shifts → team_standard_shift_days)
 *   3. Team standard shift (fallback when no personal assignment)
 *   4. No shift = 0 working days
 *
 * Excludes holidays and approved absences.
 */
export function useEmployeeWorkingDays(
  employeeId: string | undefined,
  payrollPeriod: { start: Date; end: Date },
  absences: Array<{ start_date: string; end_date: string; type: string }>,
  danishHolidays: Array<{ date: string; name: string }>
): { data: WorkingDaysResult; isLoading: boolean } {
  const { data: shiftData, isLoading } = useShiftResolution(
    employeeId,
    payrollPeriod.start,
    payrollPeriod.end
  );

  // Build exclusion sets
  const holidayDates = new Set(danishHolidays.map((h) => h.date));

  const absenceDates = new Set<string>();
  absences.forEach((absence) => {
    const absenceStart = new Date(absence.start_date);
    const absenceEnd = new Date(absence.end_date);
    eachDayOfInterval({ start: absenceStart, end: absenceEnd }).forEach((day) => {
      absenceDates.add(format(day, "yyyy-MM-dd"));
    });
  });

  // Build working days from shift data
  const allDays = eachDayOfInterval({
    start: payrollPeriod.start,
    end: payrollPeriod.end,
  });

  const workingDays = allDays.filter((day) => {
    const dateStr = format(day, "yyyy-MM-dd");

    // Skip holidays and absences
    if (holidayDates.has(dateStr) || absenceDates.has(dateStr)) return false;

    if (!shiftData) {
      // While loading, return empty (no fallback to weekdays)
      return false;
    }

    // Use centralized resolver — no weekday fallback
    const resolution = resolveShiftForDay(day, shiftData);
    return resolution.hasShift;
  });

  const today = startOfDay(new Date());
  const passedWorkingDays = workingDays.filter(
    (day) => isBefore(day, today) || isSameDay(day, today)
  );
  const remainingWorkingDays = workingDays.filter((day) => isAfter(day, today));

  return {
    data: {
      total: workingDays.length,
      passed: passedWorkingDays.length,
      remaining: remainingWorkingDays.length,
      days: workingDays,
    },
    isLoading,
  };
}
