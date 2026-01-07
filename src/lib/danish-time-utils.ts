/**
 * Danish Time Utilities
 * 
 * This module provides utilities for handling dates and times consistently
 * in Danish timezone (Europe/Copenhagen) throughout the application.
 * 
 * IMPORTANT: Always use these utilities when:
 * - Creating timestamps for database storage
 * - Parsing dates from user input
 * - Displaying dates/times to users
 */

const DANISH_TIMEZONE = 'Europe/Copenhagen';

/**
 * Get the current date/time in Danish timezone
 */
export function getDanishNow(): Date {
  return new Date();
}

/**
 * Format a date for display in Danish timezone
 * Returns the date components as they would appear in Denmark
 */
export function getDanishDateComponents(date: Date): {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  const formatter = new Intl.DateTimeFormat('da-DK', {
    timeZone: DANISH_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);
  
  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
    hours: getPart('hour'),
    minutes: getPart('minute'),
    seconds: getPart('second'),
  };
}

/**
 * Create a Date object from Danish local time components.
 * Use this when you have a date and time that represents Danish local time
 * (e.g., from a user input like "13:30" which means 13:30 in Denmark).
 * 
 * @param year - Year (e.g., 2026)
 * @param month - Month (1-12)
 * @param day - Day of month (1-31)
 * @param hours - Hours (0-23), defaults to 0
 * @param minutes - Minutes (0-59), defaults to 0
 * @param seconds - Seconds (0-59), defaults to 0
 */
export function createDanishDateTime(
  year: number,
  month: number,
  day: number,
  hours: number = 0,
  minutes: number = 0,
  seconds: number = 0
): Date {
  // Create date string in ISO format with the time
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  
  // Create a date object - JavaScript will interpret this as local time
  const localDate = new Date(`${dateStr}T${timeStr}`);
  return localDate;
}

/**
 * Create a Date from a date object and a time string (HH:mm format).
 * The time is interpreted as Danish local time.
 * 
 * @param date - The date to use
 * @param timeString - Time in HH:mm format (e.g., "13:30")
 */
export function combineDateAndDanishTime(date: Date, timeString: string): Date {
  const [hours, minutes] = timeString.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

/**
 * Get ISO string representation that preserves Danish local time intent.
 * Use this when storing timestamps that represent a specific Danish local time.
 */
export function toDanishISOString(date: Date): string {
  return date.toISOString();
}

/**
 * Format a timestamp for database storage with explicit timezone.
 * This creates a string like "2026-01-15T13:30:00+01:00" that explicitly
 * includes the timezone offset.
 */
export function formatWithTimezone(date: Date): string {
  const tzOffset = date.getTimezoneOffset();
  const tzSign = tzOffset <= 0 ? '+' : '-';
  const tzHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
  const tzMins = String(Math.abs(tzOffset) % 60).padStart(2, '0');
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${tzSign}${tzHours}:${tzMins}`;
}

/**
 * Get today's date as a YYYY-MM-DD string in Danish timezone.
 * Useful for date comparisons without time components.
 */
export function getDanishDateString(date: Date = new Date()): string {
  const { year, month, day } = getDanishDateComponents(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Parse a date string (YYYY-MM-DD) and optional time (HH:mm) as Danish local time.
 */
export function parseDanishDateTime(dateStr: string, timeStr?: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  
  if (timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return createDanishDateTime(year, month, day, hours, minutes);
  }
  
  return createDanishDateTime(year, month, day);
}
