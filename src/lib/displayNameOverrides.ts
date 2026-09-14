/**
 * Data-driven short display name overrides.
 *
 * Kort visningsnavn beregnes normalt som "Fornavn E." ud fra det fulde navn.
 * Enkelte medarbejdere har en undtagelse gemt i databasen
 * (employee_master_data.display_name_short), som hentes via RPC
 * get_display_name_overrides og lægges i denne modul-cache, så de mange
 * eksisterende formatteringsfunktioner kan slå op uden at ændre signatur.
 */

let overrides: Map<string, string> = new Map();

const normalizeKey = (name: string): string => name.trim().replace(/\s+/g, " ").toLowerCase();

/** Sætter override-cachen (fuldt navn -> kort visningsnavn). */
export function setDisplayNameOverrides(entries: { full_name: string | null; display_name_short: string | null }[]): void {
  const next = new Map<string, string>();
  for (const entry of entries) {
    const key = entry.full_name ? normalizeKey(entry.full_name) : "";
    const value = entry.display_name_short?.trim();
    if (key && value) next.set(key, value);
  }
  overrides = next;
}

/** Slår en override op ud fra det fulde navn. Returnerer null hvis ingen findes. */
export function getDisplayNameOverride(fullName: string | null | undefined): string | null {
  if (!fullName) return null;
  return overrides.get(normalizeKey(fullName)) ?? null;
}
