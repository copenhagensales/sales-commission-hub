/**
 * GDPR: Strip free-text note fields before persisting webhook / sync payloads.
 *
 * Reglerne ligger i _shared/freetext-strip.ts (single source of truth) og
 * dækker både feltnavne (regel A) og fritekstlignende værdier (regel B), så et
 * nyt feltnavn ikke kan omgå filteret. Denne fil er den bagudkompatible
 * indgang, der fortsat bruges af alle indtagsveje, og tilføjer kun de
 * CVR-berigelsesfelter der aldrig må persisteres.
 *
 * Alt andet indhold (OPP nr, Sales ID, A-kasse, Dækningssum, Forening, Tilskud,
 * produktlinjer, telefonfelter osv.) bevares uændret.
 */

import {
  type FreetextRemoval,
  stripFreetextFields,
} from "./freetext-strip.ts";

/**
 * GDPR (Kaspers beslutning): CVR-berigelsesfelter der aldrig må persisteres.
 * Fjernes både som labels i masterData-arrays og som nøgler i masterDataFields-objekter.
 */
export const BLOCKED_FIELD_LABELS = ["antal ansatte", "reklamebeskyttet"] as const;

export interface StripNoteOptions {
  /** Feltnavne med decision='BEHOLD' i ingestion_known_fields. */
  keepLabels?: Iterable<string>;
}

/**
 * Fjerner fritekst- og blokerede felter. Bagudkompatibel: returnerer kun data.
 * Brug stripNoteFieldsDetailed når du vil logge hvad der blev fjernet.
 */
export function stripNoteFields<T>(input: T, options: StripNoteOptions = {}): T {
  return stripNoteFieldsDetailed(input, options).data;
}

/** Som stripNoteFields, men returnerer også feltnavn/antal/regel. */
export function stripNoteFieldsDetailed<T>(
  input: T,
  options: StripNoteOptions = {},
): { data: T; removals: FreetextRemoval[] } {
  if (input === null || input === undefined) {
    return { data: input, removals: [] };
  }
  return stripFreetextFields(input, {
    keepLabels: options.keepLabels,
    blockedLabels: BLOCKED_FIELD_LABELS,
  });
}
