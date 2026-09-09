/**
 * GDPR: Strip free-text note fields before persisting webhook / sync payloads.
 *
 * Rule (besluttet af Kasper): Fritekstnoter må aldrig gemmes i Stork igen.
 * Kun fremadrettet filtrering – eksisterende noter er allerede slettet i DB.
 *
 * Anvendes på ALT raw_payload / adversus_events.payload før insert/update.
 * Fjerner:
 *  - Nøgler der matcher /note|bemærk|kommentar/i i objekter
 *  - Elementer i arrays af {label,value} hvor label matcher samme mønster
 *  - Nøglen "fm_comment" (uanset case)
 *
 * Alt andet indhold (OPP nr, Sales ID, A-kasse, Dækningssum, Forening, Tilskud,
 * produktlinjer, telefonfelter osv.) bevares uændret.
 */

const NOTE_REGEX = /note|bemærk|kommentar/i;

/**
 * GDPR (Kaspers beslutning): CVR-berigelsesfelter der aldrig må persisteres.
 * Fjernes både som labels i masterData-arrays og som nøgler i masterDataFields-objekter.
 */
const BLOCKED_FIELD_LABELS = new Set(["antal ansatte", "reklamebeskyttet"]);

function isBlockedLabel(label: string): boolean {
  return BLOCKED_FIELD_LABELS.has(label.trim().toLowerCase());
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isLabelValueItem(v: unknown): v is { label: unknown; value?: unknown } {
  return isPlainObject(v) && "label" in v;
}


export function stripNoteFields<T>(input: T): T {
  if (input === null || input === undefined) return input;

  if (Array.isArray(input)) {
    // Filter {label,value} items whose label matches note pattern; recurse into the rest
    const filtered = input.filter((item) => {
      if (isLabelValueItem(item) && typeof item.label === "string") {
        return !NOTE_REGEX.test(item.label) && !isBlockedLabel(item.label);
      }
      return true;
    });
    return filtered.map((item) => stripNoteFields(item)) as unknown as T;
  }

  if (isPlainObject(input)) {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (key.toLowerCase() === "fm_comment") continue;
      if (NOTE_REGEX.test(key)) continue;
      if (isBlockedLabel(key)) continue;

      out[key] = stripNoteFields(value);
    }
    return out as unknown as T;
  }

  return input;
}
