import { format, getWeek, getYear, startOfWeek, addDays, endOfWeek } from "date-fns";
import { da } from "date-fns/locale";

export function getWeekNumber(date: Date): number {
  return getWeek(date, { weekStartsOn: 1, locale: da });
}

export function getWeekYear(date: Date): number {
  return getYear(date);
}

export function formatWeekRange(startDate: Date, endDate: Date): string {
  return `${format(startDate, "d/M", { locale: da })} - ${format(endDate, "d/M", { locale: da })}`;
}

export function getWeekStartDate(year: number, weekNumber: number): Date {
  const firstDayOfYear = new Date(year, 0, 1);
  const firstMonday = startOfWeek(firstDayOfYear, { weekStartsOn: 1 });
  return addDays(firstMonday, (weekNumber - 1) * 7);
}

export function getWeekEndDate(year: number, weekNumber: number): Date {
  const weekStart = getWeekStartDate(year, weekNumber);
  return endOfWeek(weekStart, { weekStartsOn: 1 });
}
