/**
 * List of VALID email domains that SHOULD be synced.
 * Only employees with these domains will have their data stored.
 */
export const VALID_EMAIL_DOMAINS = [
  "@copenhagensales.dk",
  "@cph-relatel.dk",
  "@cph-sales.dk",
];

/**
 * Patterns for emails that should be excluded even if domain matches.
 * These are pseudo-emails created by integrations.
 */
export const EXCLUDED_EMAIL_PATTERNS = [
  /^agent-\d+@adversus\.local$/i,
];

/**
 * List of email domains that should be excluded from UI display.
 * These are internal/partner accounts that shouldn't be visible to users.
 * @deprecated Use isValidSyncEmail() for sync filtering instead
 */
export const EXCLUDED_EMAIL_DOMAINS = [
  "@relatel.dk",
  "@ps-marketing.dk",
  "@finansforbundet.dk",
  "@straightlineagency.dk",
  "@staightlineagency.dk", // typo variant
  "@tele-part.dk",
  "@aogtil.dk",
  "@ase.dk",
];

/**
 * Check if an email should be excluded from display
 * @deprecated Use isValidSyncEmail() for sync filtering instead
 */
export function isExcludedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const emailLower = email.toLowerCase();
  return EXCLUDED_EMAIL_DOMAINS.some(domain => emailLower.endsWith(domain));
}

/**
 * Check if an email is valid for syncing to the database.
 * Returns true only for emails matching VALID_EMAIL_DOMAINS
 * and not matching EXCLUDED_EMAIL_PATTERNS.
 */
export function isValidSyncEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const emailLower = email.toLowerCase();
  
  // First check if it matches an excluded pattern (pseudo-emails)
  if (EXCLUDED_EMAIL_PATTERNS.some(pattern => pattern.test(emailLower))) {
    return false;
  }
  
  // Then check if it's from a valid domain
  return VALID_EMAIL_DOMAINS.some(domain => emailLower.endsWith(domain));
}

/**
 * Filter out records with excluded email domains
 */
export function filterExcludedEmails<T extends { email?: string | null }>(
  records: T[]
): T[] {
  return records.filter(record => !isExcludedEmail(record.email));
}

/**
 * Filter records to only include valid sync emails
 */
export function filterValidSyncEmails<T extends { email?: string | null }>(
  records: T[]
): T[] {
  return records.filter(record => isValidSyncEmail(record.email));
}

/**
 * Filter out agent names that match excluded domains
 * Used for sales data where we have agent_name but need to check against agents table
 */
export function isExcludedAgentName(agentName: string | null | undefined): boolean {
  if (!agentName) return false;
  const nameLower = agentName.toLowerCase();
  // Check if agent name looks like an email from excluded domains
  return EXCLUDED_EMAIL_DOMAINS.some(domain => nameLower.endsWith(domain));
}
