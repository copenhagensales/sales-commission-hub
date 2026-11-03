/**
 * "Coop direkte": Coop-butikker (Kvickly/SuperBrugsen), vi afregner direkte
 * med (Corpay/bogholder) i stedet for via Coop. location.daily_rate er den
 * reelle pris, vi betaler butikken. Kæde og refusion afledes ALTID af navnet
 * mod kædereglerne i location_rate_surcharges (location_type "Coop butik").
 *
 * Lokationsomkostning i DB = dagspris − refusion pr. dag, men kun når
 * bookingens kunde er reglens funded_by_client_id og dagen ligger inden for
 * reglens gyldighed. Alle andre typer: uændret (hele dagsprisen).
 */
import { matchSurcharge, type LocationRateSurcharge } from "@/utils/locationRateSurcharge";

export const COOP_DIREKTE_TYPE = "Coop direkte";
export const COOP_RULES_TYPE = "Coop butik";

export interface CoopDirekteLocation {
  type?: string | null;
  name?: string | null;
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Kædereglen for en "Coop direkte"-lokation (null for alle andre typer). */
export function coopDirekteRule(
  location: CoopDirekteLocation | null | undefined,
  rules: LocationRateSurcharge[] | undefined
): LocationRateSurcharge | null {
  if (!location || location.type !== COOP_DIREKTE_TYPE) return null;
  const rule = matchSurcharge(location.name ?? null, rules);
  return rule && rule.location_type === COOP_RULES_TYPE ? rule : null;
}

/** Reglen gælder på dagen (valid_from/valid_to som yyyy-mm-dd). */
export function ruleValidOn(rule: LocationRateSurcharge, day: Date): boolean {
  const d = ymd(day);
  if (d < rule.valid_from.slice(0, 10)) return false;
  if (rule.valid_to && d > rule.valid_to.slice(0, 10)) return false;
  return true;
}

/** Refusion pr. dag for én booket dag (0 hvis den ikke gælder). */
export function coopDirekteRefusionForDag(
  location: CoopDirekteLocation | null | undefined,
  bookingClientId: string | null | undefined,
  day: Date,
  rules: LocationRateSurcharge[] | undefined
): number {
  const rule = coopDirekteRule(location, rules);
  if (!rule || !rule.funded_by_client_id) return 0;
  if (bookingClientId !== rule.funded_by_client_id) return 0;
  if (!ruleValidOn(rule, day)) return 0;
  return Number(rule.surcharge_per_day) || 0;
}

/** Lokationsomkostning for én booket dag i DB. Aldrig under 0. */
export function lokationsomkostningForDag(
  dailyRate: number,
  location: CoopDirekteLocation | null | undefined,
  bookingClientId: string | null | undefined,
  day: Date,
  rules: LocationRateSurcharge[] | undefined
): number {
  const refusion = coopDirekteRefusionForDag(location, bookingClientId, day, rules);
  return Math.max(0, dailyRate - refusion);
}

/** Bookede dage (ISO 0=man … 6=søn) mellem start og slut, evt. klippet. */
export function bookedDates(
  booking: { start_date: string; end_date: string; booked_days?: number[] | null },
  clipStart?: Date,
  clipEnd?: Date
): Date[] {
  const start = new Date(`${booking.start_date.slice(0, 10)}T00:00:00`);
  const end = new Date(`${booking.end_date.slice(0, 10)}T00:00:00`);
  const from = clipStart && clipStart > start ? clipStart : start;
  const to = clipEnd && clipEnd < end ? clipEnd : end;
  const days = booking.booked_days ?? null;
  const out: Date[] = [];
  for (const d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const iso = d.getDay() === 0 ? 6 : d.getDay() - 1;
    if (!days || days.length === 0 || days.includes(iso)) out.push(new Date(d));
  }
  return out;
}

/** Samlet refusion for en booking (sum af gyldige dage). */
export function coopDirekteRefusionForBooking(
  booking: { start_date: string; end_date: string; booked_days?: number[] | null; client_id?: string | null },
  location: CoopDirekteLocation | null | undefined,
  rules: LocationRateSurcharge[] | undefined,
  clipStart?: Date,
  clipEnd?: Date
): { days: number; perDay: number; amount: number; rule: LocationRateSurcharge | null } {
  const rule = coopDirekteRule(location, rules);
  if (!rule) return { days: 0, perDay: 0, amount: 0, rule: null };
  let days = 0;
  for (const d of bookedDates(booking, clipStart, clipEnd)) {
    if (coopDirekteRefusionForDag(location, booking.client_id, d, rules) > 0) days++;
  }
  const perDay = Number(rule.surcharge_per_day) || 0;
  return { days, perDay, amount: days * perDay, rule };
}
