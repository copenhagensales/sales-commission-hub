/**
 * GDPR: Strip customer identity fields from normalized_data before persisting.
 *
 * Forretningsbeslutning: på kundesiden må Stork kun indtage ét telefonnummer
 * plus provisionsnøglerne. Navn, adresse, postnummer, by og e-mail må aldrig
 * persisteres — uanset kampagne og uanset integration.
 *
 * Kun fremadrettet filtrering. Eksisterende rækker røres ikke her.
 *
 * Matchning er case-insensitiv og trimmer whitespace. Alt andet indhold
 * (lead_id, campaign_id, campaign_name, sale_status, sale_datetime,
 * agent_external_id, agent_email, product_name, product_price,
 * product_quantity, meeting_date, external_reference, phone_number, ...)
 * bevares uændret.
 */

export const NORMALIZED_IDENTITY_STRIP_KEYS = [
  "customer_name",
  "customer_address",
  "customer_zip",
  "customer_city",
  "customer_email",
] as const;

const STRIP_SET = new Set<string>(
  NORMALIZED_IDENTITY_STRIP_KEYS.map((k) => k.toLowerCase())
);

function isStrippedKey(key: string): boolean {
  return STRIP_SET.has(key.trim().toLowerCase());
}

export interface StripNormalizedIdentityResult<T> {
  data: T;
  /** Names of the removed keys — used for counting only, never the values. */
  removedKeys: string[];
}

/**
 * Removes the identity keys from a normalized_data object.
 * Returns the input untouched (and an empty removedKeys) when nothing matched.
 */
export function stripNormalizedIdentity(
  data: Record<string, unknown> | null | undefined
): StripNormalizedIdentityResult<Record<string, unknown> | null> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { data: (data ?? null) as Record<string, unknown> | null, removedKeys: [] };
  }

  const removedKeys: string[] = [];
  const next: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (isStrippedKey(key)) {
      removedKeys.push(key);
      continue;
    }
    next[key] = value;
  }

  if (removedKeys.length === 0) return { data, removedKeys: [] };
  return { data: next, removedKeys };
}

/** Removes the identity keys from a pii_fields list, so it stays in sync. */
export function stripIdentityFromPiiFields(
  piiFields: string[] | null | undefined
): string[] | null {
  if (!Array.isArray(piiFields)) return piiFields ?? null;
  return piiFields.filter((f) => typeof f === "string" && !isStrippedKey(f));
}
