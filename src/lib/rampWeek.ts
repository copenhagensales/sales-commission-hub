/**
 * Ugemodellen for Opstart. Selve status beregnes KUN i databasen (ramp_week_status).
 * Her ligger alene spejlet af formlerne til visning (rest af ugen, tekster) og
 * test, der holder frontend og database ens.
 */
import { weeklyTarget } from "./rampMinTarget";

export type RampWeekStatusKey = "start_her" | "hold_fast" | "paa_sporet" | "ny_uge";

export interface RampWeekHistory {
  iso_week: number;
  iso_year: number;
  start_week: number;
  sales: number;
  required: number;
  met: boolean;
}

export interface RampWeekStatus {
  iso_week: number;
  iso_year: number;
  start_week: number;
  week_target: number;
  workdays: number;
  partial_start: boolean;
  start_weekday: number;
  required: number;
  done_days: number;
  expected_now: number;
  sales: number;
  sales_live: number;
  prev_ratio: number | null;
  pace_ratio: number | null;
  status: RampWeekStatusKey;
  history: RampWeekHistory[];
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Ugens krav = krav for opstartsugen × arbejdsdage ÷ 5. */
export function weekRequired(startWeek: number, workdays: number, targets: number[]): number {
  return r2((weeklyTarget(startWeek, targets) * workdays) / 5);
}

/** Forventet nu = ugens krav × afsluttede dage ÷ arbejdsdage i ugen. */
export function expectedNow(required: number, doneDays: number, workdays: number): number {
  return workdays > 0 ? r2((required * doneDays) / workdays) : 0;
}

/** Samme regel som databasen. Opstartsuge 1 (ingen forrige uge) under forventet = hold_fast. */
export function weekStatus(
  sales: number,
  expected: number,
  doneDays: number,
  prevRatio: number | null,
): RampWeekStatusKey {
  if (doneDays === 0 || expected <= 0) return "ny_uge";
  if (sales >= expected) return "paa_sporet";
  if (prevRatio == null) return "hold_fast";
  return sales / expected > prevRatio ? "hold_fast" : "start_her";
}

/** Resten af ugen: manglende salg og salg pr. resterende arbejdsdag (dagens salg tæller med). */
export function restOfWeek(w: Pick<RampWeekStatus, "required" | "sales_live" | "workdays" | "done_days">) {
  const missing = Math.max(0, w.required - w.sales_live);
  const daysLeft = Math.max(0, w.workdays - w.done_days);
  return { missing: r2(missing), daysLeft, perDay: daysLeft > 0 ? r2(missing / daysLeft) : missing };
}

export const WEEKDAY_NAME = ["", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag", "søndag"];
