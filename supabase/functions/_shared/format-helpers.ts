/**
 * Centralized Format Helpers
 * 
 * Single source of truth for all formatting in Edge Functions.
 * Ensures consistent display across dashboards, KPIs, and leaderboards.
 */

/**
 * Formats a number as Danish currency (DKK).
 * 
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted currency string (e.g., "1.234 kr." or "1.234,50 kr.")
 */
export function formatCurrency(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
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
  return new Intl.NumberFormat("da-DK", {
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
  return `${value.toFixed(decimals).replace(".", ",")} t`;
}

/**
 * Formats a KPI value based on its category.
 * 
 * @param value - Value to format
 * @param category - KPI category (revenue, commission, conversion, hours, etc.)
 * @returns Formatted string appropriate for the category
 */
export function formatValue(value: number, category: string): string {
  const lowerCategory = category.toLowerCase();
  
  if (lowerCategory === "revenue" || 
      lowerCategory === "commission" || 
      lowerCategory === "økonomi" ||
      lowerCategory === "currency") {
    return formatCurrency(value);
  }
  
  if (lowerCategory === "conversion" || 
      lowerCategory === "percentage" || 
      lowerCategory === "rate") {
    return formatPercentage(value);
  }
  
  if (lowerCategory === "hours" || lowerCategory === "tid") {
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
 * Formats a Danish phone number.
 * 
 * @param phone - Phone number string
 * @returns Formatted phone (e.g., "+45 12 34 56 78")
 */
export function formatPhone(phone: string): string {
  if (!phone) return "";
  
  // Remove all non-digits
  const digits = phone.replace(/\D/g, "");
  
  // If it's a Danish number without country code
  if (digits.length === 8) {
    return `+45 ${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)}`;
  }
  
  // If it already has +45
  if (digits.length === 10 && digits.startsWith("45")) {
    const number = digits.slice(2);
    return `+45 ${number.slice(0, 2)} ${number.slice(2, 4)} ${number.slice(4, 6)} ${number.slice(6, 8)}`;
  }
  
  return phone;
}
