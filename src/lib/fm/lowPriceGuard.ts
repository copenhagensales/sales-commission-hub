/**
 * Spærring mod urealistisk lave FM-priser.
 * Samme grænse håndhæves i databasen (booking_low_price_guard / location_low_rate_guard).
 */
export const MIN_DAGSPRIS_KR = 100;

export const LAV_PRIS_INFOTEKST =
  "Dagspris ex moms. Eesy-tillæg for Kvickly/SuperBrugsen beregnes automatisk og skal ikke med her.";

export interface PrisInput {
  totalPrice?: number | null;
  bookedDays?: number | null;
  dailyRateOverride?: number | null;
  locationDailyRate?: number | null;
}

/** Effektiv dagspris: aftalt total / bookede dage, ellers override, ellers lokationens dagspris. */
export function effektivDagspris(p: PrisInput): number | null {
  if (p.totalPrice != null) {
    const dage = Math.max(p.bookedDays ?? 0, 1);
    return p.totalPrice / dage;
  }
  if (p.dailyRateOverride != null) return p.dailyRateOverride;
  if (p.locationDailyRate != null) return p.locationDailyRate;
  return null;
}

export function erLavPris(dagspris: number | null | undefined): boolean {
  return dagspris != null && Number.isFinite(dagspris) && dagspris < MIN_DAGSPRIS_KR;
}

/** Kræver begrundelse, når prisen er lav og begrundelsen er tom. */
export function manglerBegrundelse(dagspris: number | null | undefined, begrundelse: string | null | undefined): boolean {
  return erLavPris(dagspris) && !(begrundelse ?? "").trim();
}

/** Præcis match på databasens fejl (HINT = stork_lav_pris). */
export function erLavPrisFejl(err: { code?: string; hint?: string } | null | undefined): boolean {
  return !!err && err.code === "P0001" && err.hint === "stork_lav_pris";
}

export interface RefusionInput {
  netto?: number | null;
  brutto?: number | null;
  refusion?: number | null;
}

/** Brutto − refusion stemmer ikke med netto (kun advarsel). */
export function refusionUoverensstemmelse(r: RefusionInput): boolean {
  if (r.brutto == null || r.refusion == null || r.netto == null) return false;
  return Math.abs(r.brutto - r.refusion - r.netto) > 0.5;
}
