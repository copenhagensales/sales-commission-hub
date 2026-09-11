/**
 * Privacy rules for dialer call data (`dialer_calls`).
 *
 * Calls without a sale are kept forever because they are the denominator in
 * every call statistic (answer rate, hit rate, sales per call, activity per
 * agent). They must therefore contain nothing that can identify — or be linked
 * back to — a person.
 *
 * Only the technical fields below are persisted in `metadata`. Everything else
 * from the dialer payload (customer phone numbers, agent e-mail addresses, free
 * text, etc.) is dropped at ingestion time and never reaches the database.
 *
 * Single source of truth for both ingestion (integration-engine) and the daily
 * GDPR cleanup backstop (gdpr-data-cleanup).
 */

/** Metadata keys that are safe to store: technical call outcome only. */
export const DIALER_CALL_METADATA_ALLOWLIST = [
  "disposition",
  "hangupCause",
  "callType",
  "answerTime",
  "direction",
  "wrapUpDuration",
  "dialingDuration",
  "isSale",
  "result",
  "project",
  "orgCode",
] as const;

/** Retention window for the dialer call identity keys, in days. */
export const DIALER_CALLS_RETENTION_DAYS = 180;

const ALLOWED = new Set<string>(DIALER_CALL_METADATA_ALLOWLIST);

/**
 * Returns a copy of the metadata object containing only allow-listed keys.
 * Returns null when nothing safe is left, so we never store an empty object.
 */
export function sanitizeDialerCallMetadata(
  metadata: unknown,
): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    if (ALLOWED.has(key) && value !== undefined) {
      clean[key] = value;
    }
  }

  return Object.keys(clean).length > 0 ? clean : null;
}

/** True when the metadata object still holds keys outside the allowlist. */
export function hasDisallowedDialerCallMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return false;
  }
  return Object.keys(metadata as Record<string, unknown>).some((key) => !ALLOWED.has(key));
}
