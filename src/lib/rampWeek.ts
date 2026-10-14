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
  /** Salg pr. afsluttet arbejdsdag i ugen og i sidste uge (grundlag for "bedre end sidste uge"). */
  per_day?: number | null;
  prev_per_day?: number | null;
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

/**
 * Hvilken uge siden viser. Mandag (ingen afsluttede dage i en fuld uge) vises
 * sidste uges slutresultat; resten af ugen den indevaerende uge.
 */
export function isMondayView(ref: Pick<RampWeekStatus, "done_days" | "partial_start"> | null | undefined): boolean {
  return !!ref && !ref.partial_start && ref.done_days === 0;
}

export function displayWeek<T extends { week_status?: RampWeekStatus | null; last_week_status?: RampWeekStatus | null }>(
  m: T,
  monday: boolean,
): RampWeekStatus | null {
  return (monday ? m.last_week_status : m.week_status) ?? null;
}

/** ISO-uge for en dato (lokal tid). */
export function isoWeekOf(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return {
    year: d.getUTCFullYear(),
    week: Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7),
  };
}

/** Ugedagsnavn (mandag = 1) for et tidspunkt. */
export function weekdayName(iso: string): string {
  return WEEKDAY_NAME[new Date(iso).getDay() || 7];
}
