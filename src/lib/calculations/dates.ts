/**
 * Date Calculation Utilities
 * 
 * Single source of truth for all date/period calculations in frontend.
 * Mirrors the backend logic in supabase/functions/_shared/date-helpers.ts
 */

import { addDays, endOfWeek, format, getISOWeekYear, getWeek, startOfWeek } from "date-fns";
import { da } from "date-fns/locale";

/**
 * Gets the start of a day (midnight) for a given date.
 */
export function getStartOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Gets the end of a day (23:59:59.999) for a given date.
 */
export function getEndOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Gets the start of the week (Monday) for a given date.
 * Uses ISO week standard where Monday is day 1.
 */
export function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Gets the end of the week (Sunday 23:59:59) for a given date.
 */
export function getEndOfWeek(date: Date): Date {
  const start = getStartOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Gets the start of the month for a given date.
 */
export function getStartOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Gets the end of the month for a given date.
 */
export function getEndOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

/**
 * Calculates the payroll period for a given date.
 * 
 * Payroll periods run from the 15th of one month to the 14th of the next.
 * - If day >= 15: Period is 15th of current month to 14th of next month
 * - If day < 15: Period is 15th of previous month to 14th of current month
 * 
 * @param date - Date to calculate period for (default: now)
 * @returns Object with start and end dates of the payroll period
 */
export function getPayrollPeriod(date: Date = new Date()): { start: Date; end: Date } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  if (day >= 15) {
    return {
      start: new Date(year, month, 15),
      end: new Date(year, month + 1, 14, 23, 59, 59, 999),
    };
  } else {
    return {
      start: new Date(year, month - 1, 15),
      end: new Date(year, month, 14, 23, 59, 59, 999),
    };
  }
}

/**
 * Gets the payroll period immediately before the period containing the provided date.
 */
export function getPreviousPayrollPeriod(date: Date = new Date()): { start: Date; end: Date } {
  const current = getPayrollPeriod(date);
  const previousDate = new Date(current.start);
  previousDate.setDate(previousDate.getDate() - 1);
  return getPayrollPeriod(previousDate);
}

/**
 * Gets the payroll period immediately after the period containing the provided date.
 */
export function getNextPayrollPeriod(date: Date = new Date()): { start: Date; end: Date } {
  const current = getPayrollPeriod(date);
  const nextDate = new Date(current.end);
  nextDate.setDate(nextDate.getDate() + 1);
  return getPayrollPeriod(nextDate);
}

/**
 * Returns a list of payroll periods relative to a center date.
 * `offsets` are integer step counts where 0 = the period containing centerDate,
 * -1 = previous period, +1 = next period, etc.
 */
export function listPayrollPeriods(
  centerDate: Date = new Date(),
  offsets: number[] = [-1, 0, 1, 2],
): Array<{ start: Date; end: Date; offset: number }> {
  return offsets.map((offset) => {
    let period = getPayrollPeriod(centerDate);
    if (offset < 0) {
      for (let i = 0; i < -offset; i++) {
        period = getPreviousPayrollPeriod(period.start);
      }
    } else if (offset > 0) {
      for (let i = 0; i < offset; i++) {
        period = getNextPayrollPeriod(period.end);
      }
    }
    return { ...period, offset };
  });
}

/**
 * Gets ISO week number for a date (Monday-based).
 */
export function getWeekNumber(date: Date): number {
  return getWeek(date, { weekStartsOn: 1, locale: da });
}

/**
 * Gets ISO week year for a date.
 */
export function getWeekYear(date: Date): number {
  return getISOWeekYear(date);
}

/**
 * Formats a week range for display.
 */
export function formatWeekRange(startDate: Date, endDate: Date): string {
  return `${format(startDate, "d/M", { locale: da })} - ${format(endDate, "d/M", { locale: da })}`;
}

/**
 * Gets week start date (Monday) from ISO week/year values.
 */
export function getWeekStartDate(year: number, weekNumber: number): Date {
  const jan4 = new Date(year, 0, 4);
  const firstWeekStart = startOfWeek(jan4, { weekStartsOn: 1 });
  return addDays(firstWeekStart, (weekNumber - 1) * 7);
}

/**
 * Gets week end date (Sunday) from ISO week/year values.
 */
export function getWeekEndDate(year: number, weekNumber: number): Date {
  const weekStart = getWeekStartDate(year, weekNumber);
  return endOfWeek(weekStart, { weekStartsOn: 1 });
}

/**
 * Counts the number of workdays (Monday-Friday) in a period.
 * 
 * @param start - Start date (inclusive)
 * @param end - End date (inclusive)
 * @returns Number of workdays in the period
 */
export function countWorkDaysInPeriod(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);
  
  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

/**
 * Checks if a date falls on a weekend.
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Checks if a date falls on a workday (Monday-Friday).
 */
export function isWorkday(date: Date): boolean {
  return !isWeekend(date);
}

/**
 * Gets the number of workdays in the current payroll period.
 */
export function getWorkdaysInCurrentPayrollPeriod(): number {
  const { start, end } = getPayrollPeriod();
  return countWorkDaysInPeriod(start, end);
}

/**
 * Gets the number of workdays elapsed in the current payroll period (up to today).
 */
export function getWorkdaysElapsedInPayrollPeriod(): number {
  const { start } = getPayrollPeriod();
  const today = new Date();
  return countWorkDaysInPeriod(start, today);
}

/**
 * Formats a date range for display.
 * 
 * @param start - Start date
 * @param end - End date
 * @param options - Formatting options
 * @returns Formatted date range string
 */
export function formatDateRange(
  start: Date,
  end: Date,
  options: { locale?: string; showYear?: boolean } = {}
): string {
  const { locale = 'da-DK', showYear = false } = options;
  
  const formatOptions: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    ...(showYear && { year: 'numeric' }),
  };
  
  const startStr = start.toLocaleDateString(locale, formatOptions);
  const endStr = end.toLocaleDateString(locale, formatOptions);
  
  return `${startStr} - ${endStr}`;
}

/** Standard number of days in a month for proration calculations */
export const STANDARD_MONTH_DAYS = 30;

/**
 * Backwards-compatible alias for legacy callers.
 * @deprecated Use getPayrollPeriod() instead.
 */
export function calculatePayrollPeriod(): { start: Date; end: Date } {
  return getPayrollPeriod(new Date());
}
