/**
 * Centralized Date Helpers
 * 
 * Single source of truth for all date/period calculations in Edge Functions.
 * Ensures consistent behavior across KPI calculations, leaderboards, and dashboards.
 */

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
 * @param date - Date to calculate period for
 * @returns Object with start and end dates of the payroll period
 */
export function getPayrollPeriod(date: Date): { start: Date; end: Date } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  if (day >= 15) {
    return {
      start: new Date(year, month, 15),
      end: new Date(year, month + 1, 14, 23, 59, 59),
    };
  } else {
    return {
      start: new Date(year, month - 1, 15),
      end: new Date(year, month, 14, 23, 59, 59),
    };
  }
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
 * Formats a date to ISO string for database queries.
 */
export function toISOString(date: Date): string {
  return date.toISOString();
}

/**
 * Formats a date as YYYY-MM-DD.
 */
export function toDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Creates all standard periods used for KPI calculations.
 * 
 * @param now - Current date/time
 * @returns Array of period definitions
 */
export function getAllPeriods(now: Date): Array<{ type: string; start: Date; end: Date }> {
  const payroll = getPayrollPeriod(now);
  
  return [
    { type: "today", start: getStartOfDay(now), end: now },
    { type: "this_week", start: getStartOfWeek(now), end: now },
    { type: "this_month", start: getStartOfMonth(now), end: now },
    { type: "payroll_period", start: payroll.start, end: payroll.end },
  ];
}

/**
 * Gets commonly used periods for incremental calculations.
 * 
 * @param now - Current date/time
 * @returns Array of period definitions for today and payroll
 */
export function getIncrementalPeriods(now: Date): Array<{ type: string; start: Date; end: Date }> {
  const payroll = getPayrollPeriod(now);
  
  return [
    { type: "today", start: getStartOfDay(now), end: now },
    { type: "payroll_period", start: payroll.start, end: payroll.end },
  ];
}
