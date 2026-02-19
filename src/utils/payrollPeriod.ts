/**
 * Shared payroll period calculation.
 * Consolidated from 5 identical copies across dashboard files.
 * 
 * Payroll period: 15th of current month to 14th of next month.
 */

/**
 * Calculate the current payroll period (15th to 14th).
 */
export function calculatePayrollPeriod(): { start: Date; end: Date } {
  const today = new Date();
  const currentDay = today.getDate();
  
  if (currentDay >= 15) {
    const start = new Date(today.getFullYear(), today.getMonth(), 15);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 14);
    return { start, end };
  } else {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 15);
    const end = new Date(today.getFullYear(), today.getMonth(), 14);
    return { start, end };
  }
}
