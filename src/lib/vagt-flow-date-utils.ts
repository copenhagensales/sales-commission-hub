import { format, getWeek, startOfWeek, addDays, endOfWeek, getISOWeekYear } from "date-fns";
import { da } from "date-fns/locale";

export function getWeekNumber(date: Date): number {
  return getWeek(date, { weekStartsOn: 1, locale: da });
}

export function getWeekYear(date: Date): number {
  // Use ISO week year - this returns the correct year for week calculations
  // e.g., Dec 29, 2025 is in week 1 of 2026, so this returns 2026
  return getISOWeekYear(date);
}

export function formatWeekRange(startDate: Date, endDate: Date): string {
  return `${format(startDate, "d/M", { locale: da })} - ${format(endDate, "d/M", { locale: da })}`;
}

export function getWeekStartDate(year: number, weekNumber: number): Date {
  // Use ISO week calculation: Start from Jan 4th of the year (always in week 1)
  // and find the Monday of that week, then add the required number of weeks
  const jan4 = new Date(year, 0, 4);
  const firstWeekStart = startOfWeek(jan4, { weekStartsOn: 1 });
  return addDays(firstWeekStart, (weekNumber - 1) * 7);
}

export function getWeekEndDate(year: number, weekNumber: number): Date {
  const weekStart = getWeekStartDate(year, weekNumber);
  return endOfWeek(weekStart, { weekStartsOn: 1 });
}
