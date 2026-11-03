/**
 * "Coop direkte"-lokationer: vi betaler butikken direkte (Corpay/bogholder),
 * og kædereglens kunde (Eesy FM) refunderer et beløb pr. dag. Indgår KUN i
 * refusionsdelen af Coop-rapporten – aldrig i Excel-arket, fakturagrundlaget,
 * totaler, rabat eller unique_locations.
 */
import { format, max as maxDate, min as minDate } from "date-fns";
import type { GrossBookingInput } from "@/utils/bookingGross";
import type { LocationRateSurcharge } from "@/utils/locationRateSurcharge";
import { COOP_DIREKTE_TYPE, coopDirekteRefusionForBooking } from "@/lib/fm/coopDirekte";

export const COOP_LOCATION_TYPE = "Coop butik";

export interface DirectRefundLocation {
  id: string;
  name: string | null;
  type: string | null;
}

export type DirectRefundBooking = GrossBookingInput & {
  status?: string | null;
  client_id?: string | null;
  location?: (DirectRefundLocation & { daily_rate: number | null }) | null;
};

export interface DirectRefundLine {
  locationId: string;
  locationName: string;
  chain: string | null;
  minDate: string | null;
  maxDate: string | null;
  days: number;
  perDay: number;
  amount: number;
  refundClientName?: string | null;
}

/**
 * Én linje pr. "Coop direkte"-lokation. Kæde, refusion pr. dag og kunde
 * kommer altid fra kædereglen. Kun bekræftede bookinger for reglens kunde og
 * dage inden for både perioden og reglens gyldighed.
 */
export function buildDirectRefunds(
  bookings: DirectRefundBooking[],
  periodStart: Date,
  periodEnd: Date,
  rules: LocationRateSurcharge[] | undefined,
  clientNames: Record<string, string> = {}
): DirectRefundLine[] {
  const byLoc = new Map<string, DirectRefundLine>();
  for (const b of bookings) {
    const loc = b.location;
    if (!loc || loc.type !== COOP_DIREKTE_TYPE) continue;
    if (b.status != null && b.status !== "confirmed") continue;
    const r = coopDirekteRefusionForBooking(b, loc, rules, periodStart, periodEnd);
    if (!r.rule || r.days <= 0) continue;
    const from = format(maxDate([new Date(b.start_date), periodStart]), "yyyy-MM-dd");
    const to = format(minDate([new Date(b.end_date), periodEnd]), "yyyy-MM-dd");
    const cur: DirectRefundLine = byLoc.get(loc.id) ?? {
      locationId: loc.id,
      locationName: loc.name || "Ukendt lokation",
      chain: r.rule.chain_match,
      minDate: from,
      maxDate: to,
      days: 0,
      perDay: r.perDay,
      amount: 0,
      refundClientName: clientNames[r.rule.funded_by_client_id ?? ""] ?? null,
    };
    cur.days += r.days;
    cur.amount += r.amount;
    if (!cur.minDate || from < cur.minDate) cur.minDate = from;
    if (!cur.maxDate || to > cur.maxDate) cur.maxDate = to;
    byLoc.set(loc.id, cur);
  }
  return [...byLoc.values()].sort((a, b) => a.locationName.localeCompare(b.locationName));
}

export const sumDirectRefunds = (lines: DirectRefundLine[]) =>
  lines.reduce((s, l) => s + l.amount, 0);

/**
 * Bookinger i leverandørrapportens fakturagrundlag (Excel/total/rabat/
 * unique_locations): kun lokationer af den valgte type. "Coop direkte" har
 * en anden type og kommer derfor aldrig med i Coop-fakturagrundlaget.
 */
export function supplierInvoiceBookings<T extends { location?: { type?: string | null } | null }>(
  bookings: T[],
  locationType: string
): T[] {
  return bookings.filter((b) => b.location?.type === locationType);
}
