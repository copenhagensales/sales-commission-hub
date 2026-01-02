/**
 * List of email domains that should be excluded from UI display.
 * These are internal/partner accounts that shouldn't be visible to users.
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
 */
export function isExcludedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const emailLower = email.toLowerCase();
  return EXCLUDED_EMAIL_DOMAINS.some(domain => emailLower.endsWith(domain));
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
 * Filter out agent names that match excluded domains
 * Used for sales data where we have agent_name but need to check against agents table
 */
export function isExcludedAgentName(agentName: string | null | undefined): boolean {
  if (!agentName) return false;
  const nameLower = agentName.toLowerCase();
  // Check if agent name looks like an email from excluded domains
  return EXCLUDED_EMAIL_DOMAINS.some(domain => nameLower.endsWith(domain));
}
