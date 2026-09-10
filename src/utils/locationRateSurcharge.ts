/**
 * Butikstillæg (merpris) pr. kæde på en lokationstype.
 *
 * Grundsatsen på lokationen ændres IKKE. Tillægget lægges oven på
 * bruttobeløbet, fordi butikken skal have det fulde beløb uanset kunde.
 * Kun REFUSIONEN afhænger af, om bookingens kunde er den kunde der
 * afholder tillægget (funded_by_client_id).
 */
import { max as maxDate, min as minDate } from "date-fns";
import { countBookedDays, type GrossBookingInput } from "@/utils/bookingGross";

export interface LocationRateSurcharge {
  id: string;
  location_type: string;
  chain_match: string;
  surcharge_per_day: number;
  funded_by_client_id: string | null;
  valid_from: string;
  valid_to: string | null;
  is_active: boolean;
  note: string | null;
}

/** Case-insensitivt match mod location.name. */
export function matchSurcharge(
  locationName: string | null | undefined,
  surcharges: LocationRateSurcharge[] | undefined
): LocationRateSurcharge | null {
  if (!locationName || !surcharges?.length) return null;
  const name = locationName.toLowerCase();
  return (
    surcharges.find(
      (s) => s.is_active && name.includes(s.chain_match.toLowerCase())
    ) ?? null
  );
}

export interface BookingSurchargeResult {
  rule: LocationRateSurcharge | null;
  chain: string | null;
  perDay: number;
  /** Bookede dage der ligger inden for både rapportperioden og tillæggets gyldighed */
  days: number;
  amount: number;
  refundable: boolean;
  refundableAmount: number;
}

const EMPTY: BookingSurchargeResult = {
  rule: null,
  chain: null,
  perDay: 0,
  days: 0,
  amount: 0,
  refundable: false,
  refundableAmount: 0,
};

/**
 * Merpris for én booking i en rapportperiode.
 * Tæller kun de faktiske bookede dage der falder inden for tillæggets
 * gyldighedsperiode, så en rapportperiode kan gå på tværs af grænsen.
 */
export function bookingSurcharge(
  booking: GrossBookingInput & { client_id?: string | null; location?: { name?: string | null } | null },
  surcharges: LocationRateSurcharge[] | undefined,
  periodStart: Date,
  periodEnd: Date
): BookingSurchargeResult {
  const rule = matchSurcharge(booking.location?.name ?? null, surcharges);
  if (!rule) return EMPTY;

  const from = maxDate([periodStart, new Date(rule.valid_from)]);
  const to = rule.valid_to ? minDate([periodEnd, new Date(rule.valid_to)]) : periodEnd;
  if (from > to) return { ...EMPTY, rule, chain: rule.chain_match, perDay: Number(rule.surcharge_per_day) };

  const days = countBookedDays(booking, from, to);
  const perDay = Number(rule.surcharge_per_day);
  const amount = days * perDay;
  const refundable =
    !!rule.funded_by_client_id && booking.client_id === rule.funded_by_client_id;

  return {
    rule,
    chain: rule.chain_match,
    perDay,
    days,
    amount,
    refundable,
    refundableAmount: refundable ? amount : 0,
  };
}
