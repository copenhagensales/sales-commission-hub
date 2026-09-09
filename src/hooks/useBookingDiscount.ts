import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { bookingGross } from "@/utils/bookingGross";

export interface BookingDiscountInfo {
  gross: number;
  days: number;
  dailyRate: number;
  missingRate: boolean;
  lockedPercent: number | null;
  discountAmount: number;
  net: number;
  basis: number | null;
  lockedAt: string | null;
  /** Har leverandøren aktive annual_revenue-regler? */
  isAnnualRevenue: boolean;
  locationType: string | null;
}

/**
 * Økonomi for én booking: brutto (samme formel som DB-funktionen
 * booking_gross_amount), den låste rabatsats, netto og revisionssporet
 * (grundlag + låsetidspunkt).
 */
export function useBookingDiscount(bookingId?: string | null) {
  return useQuery({
    queryKey: ["booking-discount", bookingId],
    queryFn: async (): Promise<BookingDiscountInfo | null> => {
      if (!bookingId) return null;

      const { data, error } = await supabase
        .from("booking")
        .select(`
          id, start_date, end_date, booked_days, total_price, daily_rate_override,
          discount_percent_locked, discount_basis, discount_locked_at,
          location(type, daily_rate),
          location_placements(daily_rate)
        `)
        .eq("id", bookingId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const booking: any = data;
      const locationType = booking.location?.type ?? null;

      let isAnnualRevenue = false;
      if (locationType) {
        const { data: rules, error: rulesError } = await supabase
          .from("supplier_discount_rules")
          .select("id")
          .eq("location_type", locationType)
          .eq("discount_type", "annual_revenue")
          .eq("is_active", true)
          .limit(1);
        if (rulesError) throw rulesError;
        isAnnualRevenue = (rules?.length ?? 0) > 0;
      }

      const { total, days, dailyRate, missingRate } = bookingGross(booking);
      const lockedPercent =
        booking.discount_percent_locked == null ? null : Number(booking.discount_percent_locked);
      const discountAmount = lockedPercent == null ? 0 : total * (lockedPercent / 100);

      return {
        gross: total,
        days,
        dailyRate,
        missingRate,
        lockedPercent,
        discountAmount,
        net: total - discountAmount,
        basis: booking.discount_basis == null ? null : Number(booking.discount_basis),
        lockedAt: booking.discount_locked_at ?? null,
        isAnnualRevenue,
        locationType,
      };
    },
    enabled: !!bookingId,
  });
}
