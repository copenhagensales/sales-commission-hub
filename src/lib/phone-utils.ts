/**
 * Phone number utilities for formatting and normalizing phone numbers
 * Handles Danish phone numbers and international formats
 */

/**
 * Normalizes a phone number for calling via Twilio
 * - Removes all whitespace, dashes, parentheses
 * - Adds +45 country code if no country code present
 * - Handles various input formats
 * 
 * @param phoneNumber - The raw phone number from database
 * @returns Formatted E.164 phone number (e.g., +4552512853)
 */
export function normalizePhoneNumber(phoneNumber: string | null | undefined): string | null {
  if (!phoneNumber) return null;
  
  // Remove all whitespace, dashes, parentheses, and dots
  let cleaned = phoneNumber.replace(/[\s\-\(\)\.]/g, '');
  
  // Handle empty result
  if (!cleaned) return null;
  
  // If starts with +, it already has a country code
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  
  // If starts with 00, replace with +
  if (cleaned.startsWith('00')) {
    return '+' + cleaned.substring(2);
  }
  
  // If starts with 0045, replace with +45
  if (cleaned.startsWith('0045')) {
    return '+45' + cleaned.substring(4);
  }
  
  // Danish numbers are 8 digits
  // If it's 8 digits, assume Danish and add +45
  if (/^\d{8}$/.test(cleaned)) {
    return '+45' + cleaned;
  }
  
  // If it's 10-11 digits starting with 45, it's likely Danish with country code
  if (/^45\d{8}$/.test(cleaned)) {
    return '+' + cleaned;
  }
  
  // For other formats, assume Danish if reasonable length
  if (/^\d{7,15}$/.test(cleaned)) {
    // If looks like it might already have a country code (10+ digits)
    if (cleaned.length >= 10) {
      return '+' + cleaned;
    }
    // Otherwise add Danish country code
    return '+45' + cleaned;
  }
  
  // Return as-is with + prefix if nothing else matches
  return '+' + cleaned;
}

/**
 * Formats a phone number for display
 * E.g., +4552512853 -> +45 52 51 28 53
 * 
 * @param phoneNumber - The phone number to format
 * @returns Formatted display string
 */
export function formatPhoneForDisplay(phoneNumber: string | null | undefined): string {
  if (!phoneNumber) return '';
  
  const normalized = normalizePhoneNumber(phoneNumber);
  if (!normalized) return phoneNumber;
  
  // Format Danish numbers nicely
  if (normalized.startsWith('+45') && normalized.length === 11) {
    const digits = normalized.substring(3);
    return `+45 ${digits.substring(0, 2)} ${digits.substring(2, 4)} ${digits.substring(4, 6)} ${digits.substring(6, 8)}`;
  }
  
  // For other international numbers, just add spaces every 3-4 digits
  return normalized;
}

/**
 * Validates if a string looks like a valid phone number
 * 
 * @param phoneNumber - The phone number to validate
 * @returns true if it appears to be a valid phone number
 */
export function isValidPhoneNumber(phoneNumber: string | null | undefined): boolean {
  if (!phoneNumber) return false;
  
  const normalized = normalizePhoneNumber(phoneNumber);
  if (!normalized) return false;
  
  // Must start with + and have at least 8 digits after
  return /^\+\d{8,15}$/.test(normalized);
}
