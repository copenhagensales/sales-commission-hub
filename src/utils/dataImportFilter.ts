/** Normaliserer et kolonnenavn til sammenligning: små bogstaver, uden ekstra mellemrum. */
export function normalizeColumnName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Kolonner som matching/godkendelse læser fra uploaded_data og derfor altid skal bevares,
 * så eksisterende matching ikke ændres: konfigurerede kolonner, produktbetingelser,
 * interne nøgler (starter med "_") og produktkolonner (bruges som fallback i godkendelsen).
 */
export function isProtectedColumn(key: string, protectedCols: Set<string>): boolean {
  const n = normalizeColumnName(key);
  if (key.startsWith("_")) return true;
  if (protectedCols.has(n)) return true;
  return n.includes("product") || n.includes("produkt") || n.includes("subscription");
}

export interface FilterResult {
  row: Record<string, unknown>;
  dropped: string[];
}

/** Fjerner kolonner der hverken er defineret under Data import eller bruges af matchingen. */
export function filterUploadedRow(
  row: Record<string, unknown>,
  definedCols: Set<string>,
  protectedCols: Set<string>,
): FilterResult {
  const out: Record<string, unknown> = {};
  const dropped: string[] = [];
  for (const [k, v] of Object.entries(row)) {
    if (definedCols.has(normalizeColumnName(k)) || isProtectedColumn(k, protectedCols)) {
      out[k] = v;
    } else {
      dropped.push(k);
    }
  }
  return { row: out, dropped };
}
