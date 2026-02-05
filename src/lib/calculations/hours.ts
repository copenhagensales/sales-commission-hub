/**
 * Hours Calculation Utilities
 * 
 * Single source of truth for all working hours calculations.
 * Handles shift parsing, break deductions, and time calculations.
 */

/** Threshold in minutes after which a 30-minute break is deducted */
export const BREAK_THRESHOLD_MINUTES = 360; // 6 hours

/** Standard break duration in minutes */
export const BREAK_DURATION_MINUTES = 30;

/**
 * Calculates working hours from shift start and end times.
 * 
 * @param startTime - Start time in "HH:mm" or "HH:mm:ss" format
 * @param endTime - End time in "HH:mm" or "HH:mm:ss" format
 * @param breakMinutes - Optional explicit break duration (if undefined, uses automatic 30min for >6h shifts)
 * @returns Hours worked, rounded to 2 decimal places
 */
export function calculateHoursFromShift(
  startTime: string,
  endTime: string,
  breakMinutes?: number
): number {
  if (!startTime || !endTime) return 0;
  
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  
  if (isNaN(startH) || isNaN(endH)) return 0;
  
  const startMinutes = startH * 60 + (startM || 0);
  const endMinutes = endH * 60 + (endM || 0);
  
  let totalMinutes = endMinutes - startMinutes;
  
  // Handle overnight shifts
  if (totalMinutes < 0) {
    totalMinutes += 24 * 60;
  }
  
  // Apply break deduction
  const breakToApply = breakMinutes !== undefined
    ? breakMinutes
    : (totalMinutes > BREAK_THRESHOLD_MINUTES ? BREAK_DURATION_MINUTES : 0);
  
  const netMinutes = Math.max(0, totalMinutes - breakToApply);
  
  // Round to 2 decimal places
  return Math.round((netMinutes / 60) * 100) / 100;
}

/**
 * Calculates hours from Date objects (e.g., clock-in/out timestamps).
 * 
 * @param clockIn - Clock-in timestamp
 * @param clockOut - Clock-out timestamp
 * @param breakMinutes - Break duration in minutes (default: 0)
 * @returns Hours worked, rounded to 2 decimal places
 */
export function calculateHoursFromTimestamps(
  clockIn: Date | string,
  clockOut: Date | string,
  breakMinutes: number = 0
): number {
  const start = typeof clockIn === 'string' ? new Date(clockIn) : clockIn;
  const end = typeof clockOut === 'string' ? new Date(clockOut) : clockOut;
  
  if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 0;
  }
  
  const diffMs = end.getTime() - start.getTime();
  const totalMinutes = diffMs / (1000 * 60);
  const netMinutes = Math.max(0, totalMinutes - breakMinutes);
  
  return Math.round((netMinutes / 60) * 100) / 100;
}

/**
 * Parses a time string to total minutes since midnight.
 * 
 * @param timeStr - Time in "HH:mm" or "HH:mm:ss" format
 * @returns Minutes since midnight, or null if invalid
 */
export function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr) return null;
  
  const parts = timeStr.split(":");
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1] || "0", 10);
  
  if (isNaN(hours) || isNaN(minutes)) return null;
  
  return hours * 60 + minutes;
}

/**
 * Formats minutes as hours with 1 decimal place.
 * 
 * @param minutes - Total minutes
 * @returns Formatted string (e.g., "7,5")
 */
export function formatMinutesAsHours(minutes: number): string {
  const hours = minutes / 60;
  return hours.toFixed(1).replace(".", ",");
}

/**
 * Checks if a shift duration requires a break deduction.
 * 
 * @param startTime - Start time in "HH:mm" format
 * @param endTime - End time in "HH:mm" format
 * @returns True if shift is longer than 6 hours
 */
export function requiresBreakDeduction(startTime: string, endTime: string): boolean {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  
  if (startMinutes === null || endMinutes === null) return false;
  
  let totalMinutes = endMinutes - startMinutes;
  if (totalMinutes < 0) totalMinutes += 24 * 60;
  
  return totalMinutes > BREAK_THRESHOLD_MINUTES;
}
