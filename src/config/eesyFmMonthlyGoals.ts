/**
 * Opsætning for boardet "Eesy FM Månedsmål".
 *
 * Boardet tæller voice-salg på Eesy FM = alle solgte produkter undtagen "5G Internet".
 * Målene ligger i databasen (`board_monthly_goals`), ikke i denne fil.
 */

/** Board-nøgle i `board_monthly_goals`. */
export const EESY_FM_MONTHLY_GOAL_BOARD_KEY = "eesy-fm-monthly-goal";

/**
 * 5G Internet findes som to produktrækker (Eesy marked + Eesy gaden).
 * Begge ekskluderes, så boardet kun viser voice-salg.
 */
export const EESY_FM_NON_VOICE_PRODUCT_IDS: ReadonlySet<string> = new Set([
  "88cd756a-3413-4d2c-9c86-4fd3c6dae9a4", // 5G Internet (Eesy marked)
  "1e2f6001-c77f-4fe1-a71c-68f9dff5dcfb", // 5G Internet (Eesy gaden)
]);

/** True hvis produktlinjen tæller som voice-salg. */
export function isEesyFmVoiceProduct(productId: string | null): boolean {
  if (!productId) return true;
  return !EESY_FM_NON_VOICE_PRODUCT_IDS.has(productId);
}
