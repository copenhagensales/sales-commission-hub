/**
 * Opsætning for boardet "Eesy TM Månedsmål".
 *
 * Boardet tæller voice-salg på Eesy TM = alle solgte produkter undtagen 5G internet
 * ("5GI …" og "5G MBB"). Bemærk: mobilabonnementer med "(5G)" i navnet — fx
 * "Fri tale + 40 GB data (5G)" — ER voice og tælles med.
 *
 * Målene ligger i databasen (`board_monthly_goals`), ikke i denne fil.
 */

/** Board-nøgle i `board_monthly_goals`. */
export const EESY_TM_MONTHLY_GOAL_BOARD_KEY = "eesy-tm-monthly-goal";

/** Kendte 5G internet-produkter på Eesy TM (bekræftet i produktkataloget). */
export const EESY_TM_NON_VOICE_PRODUCT_IDS: ReadonlySet<string> = new Set([
  "72c4a439-22c0-4db1-836b-a578d56fe81e", // 5G MBB
  "649784d3-c4f3-4aa3-bcd8-5737ba54a3b5", // 5GI - 279 kr. (3 måneder 129 kr)
  "6594f05c-a38a-4b1d-9e78-06015532880a", // 5GI - 279 kr. (2 måneder 99 kr)
]);

/**
 * Navnemønstre for 5G internet, så nye produktvarianter automatisk holdes ude.
 * Rammer bevidst ikke "(5G)" midt i et voice-produktnavn.
 */
const NON_VOICE_NAME_PATTERNS: RegExp[] = [
  /^\s*5gi\b/i,
  /5g\s*mbb/i,
  /5g\s*internet/i,
];

/** True hvis produktlinjen tæller som voice-salg. */
export function isEesyTmVoiceProduct(productId: string | null, productName?: string | null): boolean {
  if (productId && EESY_TM_NON_VOICE_PRODUCT_IDS.has(productId)) return false;
  if (productName && NON_VOICE_NAME_PATTERNS.some((re) => re.test(productName))) return false;
  return true;
}
