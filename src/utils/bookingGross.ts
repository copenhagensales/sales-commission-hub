/**
 * Bruttoberegning for bookinger.
 *
 * Skal være 1:1 med DB-funktionen public.booking_gross_amount:
 *   total_price hvis sat, ellers
 *   coalesce(daily_rate_override, location_placements.daily_rate, location.daily_rate, 0) × antal bookede dage
 *
 * Ingen "magisk" fallback-pris. Er alle tre dagspriser null, er bruttoen 0
 * og linjen skal markeres visuelt i UI'et.
 */
import { differenceInDays, max as maxDate, min as minDate } from "date-fns";

export interface GrossBookingInput {
  start_date: string;
  end_date: string;
  booked_days?: number[] | null;
  total_price?: number | null;
  daily_rate_override?: number | null;
  location_placements?: { daily_rate: number | null } | null;
  placement?: { daily_rate: number | null } | null;
  location?: { daily_rate: number | null } | null;
}

/** Antal bookede dage, evt. klippet til en periode. */
export function countBookedDays(
  booking: GrossBookingInput,
  clipStart?: Date,
  clipEnd?: Date
): number {
  const bookedDays = booking.booked_days ?? null;
  const bookStart = new Date(booking.start_date);
  const bookEnd = new Date(booking.end_date);
  const start = clipStart ? maxDate([bookStart, clipStart]) : bookStart;
  const end = clipEnd ? minDate([bookEnd, clipEnd]) : bookEnd;
  if (start > end) return 0;
  if (!bookedDays || bookedDays.length === 0) {
    return differenceInDays(end, start) + 1;
  }
  let count = 0;
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const isoDay = d.getDay() === 0 ? 6 : d.getDay() - 1;
    if (bookedDays.includes(isoDay)) count++;
  }
  return count;
}

/**
 * Dagspris efter samme hierarki som DB:
 * daily_rate_override → placeringens dagspris → lokationens dagspris.
 * Returnerer null hvis ingen af dem findes.
 */
export function resolveDailyRate(booking: GrossBookingInput): number | null {
  const placementRate =
    booking.location_placements?.daily_rate ?? booking.placement?.daily_rate ?? null;
  const rate = booking.daily_rate_override ?? placementRate ?? booking.location?.daily_rate ?? null;
  return rate == null ? null : Number(rate);
}

export interface GrossResult {
  /** Beløb i den (eventuelt klippede) periode */
  total: number;
  days: number;
  dailyRate: number;
  usesTotalPrice: boolean;
  /** True når ingen dagspris kunne findes (brutto regnet som 0) */
  missingRate: boolean;
}

/** Brutto for en booking, evt. proratet til en periode. */
export function bookingGross(
  booking: GrossBookingInput,
  clipStart?: Date,
  clipEnd?: Date
): GrossResult {
  const clippedDays = countBookedDays(booking, clipStart, clipEnd);

  if (booking.total_price != null) {
    const totalDays = countBookedDays(booking);
    const ratio = totalDays > 0 ? clippedDays / totalDays : 1;
    const proratedTotal = Number(booking.total_price) * ratio;
    return {
      total: proratedTotal,
      days: clippedDays,
      dailyRate: clippedDays > 0 ? proratedTotal / clippedDays : Number(booking.total_price),
      usesTotalPrice: true,
      missingRate: false,
    };
  }

  const rate = resolveDailyRate(booking);
  return {
    total: (rate ?? 0) * clippedDays,
    days: clippedDays,
    dailyRate: rate ?? 0,
    usesTotalPrice: false,
    missingRate: rate == null,
  };
}
