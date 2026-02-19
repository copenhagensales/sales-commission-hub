/**
 * Shared payroll period calculation.
 * Consolidated from 5 identical copies across dashboard files.
 * 
 * Payroll period: 15th of current month to 14th of next month.
 */

/**
 * Calculate the payroll period (15th to 14th) for a given base date.
 * If no date is provided, uses today.
 */
export function getPayrollPeriod(baseDate?: Date): { start: Date; end: Date } {
  const date = baseDate || new Date();
  const day = date.getDate();
  const year = date.getFullYear();
  const month = date.getMonth();

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
 * @deprecated Use getPayrollPeriod() instead. Kept for backwards compatibility.
 */
export function calculatePayrollPeriod(): { start: Date; end: Date } {
  return getPayrollPeriod(new Date());
}
