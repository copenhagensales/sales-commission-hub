/**
 * Direkte afregnede kæde-lokationer (fx Kvickly under "Anden lokation"):
 * vi betaler butikken direkte, og kunden (typisk Eesy FM) refunderer et
 * beløb pr. dag. Indgår KUN i refusionsdelen af Coop-rapporten – aldrig i
 * Excel-arket, fakturagrundlaget, totaler, rabat eller unique_locations.
 * DB-beregningen bruger fortsat location.daily_rate (netto).
 */
import { format, max as maxDate, min as minDate } from "date-fns";
import { countBookedDays, type GrossBookingInput } from "@/utils/bookingGross";

export const COOP_LOCATION_TYPE = "Coop butik";
export const DIRECT_REFUND_CHAINS = ["Kvickly", "SuperBrugsen"] as const;

export interface DirectRefundLocation {
  id: string;
  name: string | null;
  type: string | null;
  chain: string | null;
  refund_daily_rate: number | null;
  refund_client_id: string | null;
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

/** Lokationen er direkte afregnet med refusion. */
export function isDirectRefundLocation(loc: DirectRefundLocation | null | undefined): boolean {
  return (
    !!loc &&
    !!loc.chain &&
    loc.type !== COOP_LOCATION_TYPE &&
    Number(loc.refund_daily_rate) > 0 &&
    !!loc.refund_client_id
  );
}

/**
 * Én linje pr. lokation. Kun bekræftede bookinger, hvor bookingens kunde er
 * "Refunderes af"-kunden. Dage tælles med countBookedDays inden for perioden.
 */
export function buildDirectRefunds(
  bookings: DirectRefundBooking[],
  periodStart: Date,
  periodEnd: Date,
  clientNames: Record<string, string> = {}
): DirectRefundLine[] {
  const byLoc = new Map<string, DirectRefundLine>();
  for (const b of bookings) {
    const loc = b.location;
    if (!loc || !isDirectRefundLocation(loc)) continue;
    if (b.status != null && b.status !== "confirmed") continue;
    if (b.client_id !== loc.refund_client_id) continue;
    const days = countBookedDays(b, periodStart, periodEnd);
    if (days <= 0) continue;
    const perDay = Number(loc.refund_daily_rate);
    const from = format(maxDate([new Date(b.start_date), periodStart]), "yyyy-MM-dd");
    const to = format(minDate([new Date(b.end_date), periodEnd]), "yyyy-MM-dd");
    const cur =
      byLoc.get(loc.id) ??
      ({
        locationId: loc.id,
        locationName: loc.name || "Ukendt lokation",
        chain: loc.chain,
        minDate: from,
        maxDate: to,
        days: 0,
        perDay,
        amount: 0,
        refundClientName: clientNames[loc.refund_client_id!] ?? null,
      } as DirectRefundLine);
    cur.days += days;
    cur.amount += days * perDay;
    if (!cur.minDate || from < cur.minDate) cur.minDate = from;
    if (!cur.maxDate || to > cur.maxDate) cur.maxDate = to;
    byLoc.set(loc.id, cur);
  }
  return [...byLoc.values()].sort((a, b) => a.locationName.localeCompare(b.locationName));
}

export const sumDirectRefunds = (lines: DirectRefundLine[]) =>
  lines.reduce((s, l) => s + l.amount, 0);
