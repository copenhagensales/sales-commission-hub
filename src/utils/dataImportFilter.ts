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

const CONFIG_COLUMN_KEYS = ["phone_column", "company_column", "opp_column", "revenue_column", "commission_column", "member_number_column", "filter_column", "seller_column", "date_column", "type_detection_column"];

/** Samler de kolonner, som upload-opsætningen og produktbetingelserne læser. */
export function buildProtectedColumns(config: Record<string, unknown> | null | undefined, conditionCols: string[]): Set<string> {
  const out = new Set<string>(conditionCols.map(normalizeColumnName));
  for (const key of CONFIG_COLUMN_KEYS) {
    const v = config?.[key];
    if (typeof v === "string" && v) out.add(normalizeColumnName(v));
  }
  const productCols = config?.product_columns;
  if (Array.isArray(productCols)) for (const p of productCols) if (typeof p === "string") out.add(normalizeColumnName(p));
  out.add(normalizeColumnName("Annulled Sales"));
  return out;
}

export interface FilterResult {
  row: Record<string, unknown>;
  dropped: string[];
}

/**
 * Fjerner kolonner der hverken er defineret under Data import eller bruges af matchingen.
 * Kolonner markeret "Importeres ikke" fjernes stille (ikke i dropped), medmindre matchingen bruger dem.
 */
export function filterUploadedRow(
  row: Record<string, unknown>,
  definedCols: Set<string>,
  protectedCols: Set<string>,
  excludedCols: Set<string> = new Set(),
): FilterResult {
  const out: Record<string, unknown> = {};
  const dropped: string[] = [];
  for (const [k, v] of Object.entries(row)) {
    const n = normalizeColumnName(k);
    if (isProtectedColumn(k, protectedCols)) {
      out[k] = v;
    } else if (excludedCols.has(n)) {
      continue;
    } else if (definedCols.has(n)) {
      out[k] = v;
    } else {
      dropped.push(k);
    }
  }
  return { row: out, dropped };
}
