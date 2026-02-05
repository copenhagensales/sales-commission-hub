/**
 * Formatting Utilities
 * 
 * Single source of truth for all number/currency formatting in frontend.
 * Uses Danish locale (da-DK) as the default.
 */

const DEFAULT_LOCALE = 'da-DK';

/**
 * Formats a number as Danish currency (DKK).
 * 
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted currency string (e.g., "1.234 kr." or "1.234,50 kr.")
 */
export function formatCurrency(value: number, decimals: number = 0): string {
  if (value === null || value === undefined || isNaN(value)) {
    return "0 kr.";
  }
  
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'currency',
    currency: 'DKK',
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value);
}

/**
 * Formats a number as DKK without the "kr." suffix.
 * Useful for compact displays.
 * 
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted number string (e.g., "1.234")
 */
export function formatDKK(value: number, decimals: number = 0): string {
  if (value === null || value === undefined || isNaN(value)) {
    return "0";
  }
  
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value);
}

/**
 * Formats a number with Danish locale (e.g., 1.234,56).
 * 
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted number string
 */
export function formatNumber(value: number, decimals: number = 0): string {
  if (value === null || value === undefined || isNaN(value)) {
    return "0";
  }
  
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value);
}

/**
 * Formats a percentage value.
 * 
 * @param value - Percentage as a number (e.g., 12.5 for 12.5%)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string (e.g., "12,5%")
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  if (value === null || value === undefined || isNaN(value)) {
    return "0%";
  }
  
  return `${value.toFixed(decimals).replace(".", ",")}%`;
}

/**
 * Formats hours (e.g., "7,5 t").
 * 
 * @param value - Hours as a number
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted hours string
 */
export function formatHours(value: number, decimals: number = 1): string {
  if (value === null || value === undefined || isNaN(value)) {
    return "0 t";
  }
  
  return `${value.toFixed(decimals).replace(".", ",")} t`;
}

/**
 * Formats a value based on its category/type.
 * 
 * @param value - Value to format
 * @param category - Category (revenue, commission, percentage, hours, etc.)
 * @returns Formatted string appropriate for the category
 */
export function formatValue(value: number, category: string): string {
  const lowerCategory = category.toLowerCase();
  
  if (lowerCategory.includes('revenue') || 
      lowerCategory.includes('commission') || 
      lowerCategory.includes('økonomi') ||
      lowerCategory.includes('provision') ||
      lowerCategory.includes('salary') ||
      lowerCategory.includes('løn') ||
      lowerCategory.includes('currency')) {
    return formatCurrency(value);
  }
  
  if (lowerCategory.includes('percentage') || 
      lowerCategory.includes('percent') || 
      lowerCategory.includes('rate') ||
      lowerCategory.includes('conversion')) {
    return formatPercentage(value);
  }
  
  if (lowerCategory.includes('hour') || lowerCategory.includes('tid') || lowerCategory.includes('timer')) {
    return formatHours(value);
  }
  
  // Default: format as number
  return formatNumber(value);
}

/**
 * Formats a full name for display as "Firstname L." (for privacy in leaderboards).
 * 
 * @param fullName - Full name (e.g., "John Michael Doe")
 * @returns Formatted name (e.g., "John D.")
 */
export function formatDisplayName(fullName: string): string {
  if (!fullName) return "";
  
  const parts = fullName.trim().split(" ").filter(p => p.length > 0);
  
  if (parts.length >= 2) {
    const firstName = parts[0];
    const lastInitial = parts[parts.length - 1][0];
    return `${firstName} ${lastInitial}.`;
  }
  
  return fullName;
}

/**
 * Formats a compact number (e.g., 1.2k, 1.5M).
 * 
 * @param value - Number to format
 * @returns Compact formatted string
 */
export function formatCompact(value: number): string {
  if (value === null || value === undefined || isNaN(value)) {
    return "0";
  }
  
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    notation: 'compact',
    compactDisplay: 'short',
  }).format(value);
}
