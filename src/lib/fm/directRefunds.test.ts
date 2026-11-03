import { describe, expect, it } from "vitest";
import { buildDirectRefunds, sumDirectRefunds, supplierInvoiceBookings, coopDirekteReportBooking, hasLegacyCoopRefund } from "./directRefunds";
import type { LocationRateSurcharge } from "@/utils/locationRateSurcharge";

const EESY = "eesy-id";
const ANDEN = "andet-id";
const start = new Date("2026-10-01T00:00:00");
const end = new Date("2026-10-31T00:00:00");
const rules: LocationRateSurcharge[] = [
  { id: "k", location_type: "Coop butik", chain_match: "Kvickly", surcharge_per_day: 700,
    funded_by_client_id: EESY, valid_from: "2026-09-01", valid_to: null, is_active: true, note: null },
];

const direkte = { id: "loc-k", name: "Kvickly Testby", type: "Coop direkte", daily_rate: 1700 };
const coop = { id: "loc-c", name: "Kvickly Coop", type: "Coop butik", daily_rate: 1000 };
const bk = (o: Record<string, unknown>) => ({
  start_date: "2026-10-05", end_date: "2026-10-09", booked_days: [0, 1, 2, 3, 4],
  status: "confirmed", client_id: EESY, location: direkte, ...o,
});

describe("direkte afregnet refusion (Coop direkte)", () => {
  it("egen rapport: Kvickly 1700 × 4 Eesy-dage giver 6800 / 2800 / 4000", () => {
    const result = coopDirekteReportBooking(bk({ end_date: "2026-10-08" }), rules, start, end);
    expect(result.days).toBe(4);
    expect(result.total).toBe(6800);
    expect(result.refundPerDay).toBe(700);
    expect(result.refundAmount).toBe(2800);
    expect(result.netAmount).toBe(4000);
  });

  it("YouSee betaler fuld brutto uden refusion", () => {
    const result = coopDirekteReportBooking(bk({ client_id: ANDEN, end_date: "2026-10-08" }), rules, start, end);
    expect(result.refundAmount).toBe(0);
    expect(result.refundPerDay).toBe(0);
    expect(result.netAmount).toBe(6800);
  });

  it("ugefordeling summerer til perioden og refusion stopper ved gyldighed", () => {
    const booking = bk({ start_date: "2026-10-08", end_date: "2026-10-13", total_price: 6800 });
    const limited = [{ ...rules[0], valid_to: "2026-10-12" }];
    const first = coopDirekteReportBooking(booking, limited, new Date("2026-10-05"), new Date("2026-10-11"));
    const next = coopDirekteReportBooking(booking, limited, new Date("2026-10-12"), new Date("2026-10-18"));
    expect(first.total + next.total).toBe(6800);
    expect(first.refundAmount).toBe(1400);
    expect(next.refundAmount).toBe(700);
    expect(first.netAmount + next.netAmount).toBe(4700);
  });

  it("blokerer ny opkrævning når en gammel godkendt Coop-rapport overlapper", () => {
    const report = { location_type: "Coop butik", status: "approved", direct_refund_amount: 2800,
      period_start: "2026-10-01", period_end: "2026-10-31" };
    expect(hasLegacyCoopRefund([report], "2026-10-15", "2026-11-14")).toBe(true);
    expect(hasLegacyCoopRefund([report], "2026-11-01", "2026-11-30")).toBe(false);
    expect(hasLegacyCoopRefund([{ ...report, direct_refund_amount: 0 }], "2026-10-01", "2026-10-31")).toBe(false);
    expect(hasLegacyCoopRefund([{ ...report, status: "draft" }], "2026-10-01", "2026-10-31")).toBe(false);
  });
  it("direkte afregnet lokation indgår i refusionssum men ikke i Excel-rækker/total", () => {
    const bookings = [bk({}), bk({ location: coop })];
    const refunds = buildDirectRefunds(bookings as never, start, end, rules, { [EESY]: "Eesy FM" });
    expect(refunds).toHaveLength(1);
    expect(refunds[0].chain).toBe("Kvickly");
    expect(refunds[0].days).toBe(5);
    expect(refunds[0].refundClientName).toBe("Eesy FM");
    expect(sumDirectRefunds(refunds)).toBe(3500);
    const invoice = supplierInvoiceBookings(bookings, "Coop butik");
    expect(invoice.map((b) => b.location.id)).toEqual(["loc-c"]);
  });

  it("booking for anden kunde giver ingen refusion", () => {
    expect(buildDirectRefunds([bk({ client_id: ANDEN })] as never, start, end, rules)).toEqual([]);
  });

  it("ubekræftet booking, anden type og navn uden kæde giver ingen refusion", () => {
    expect(buildDirectRefunds([bk({ status: "pending" })] as never, start, end, rules)).toEqual([]);
    expect(buildDirectRefunds([bk({ location: { ...direkte, type: "Anden lokation" } })] as never, start, end, rules)).toEqual([]);
    expect(buildDirectRefunds([bk({ location: { ...direkte, name: "Netto Testby" } })] as never, start, end, rules)).toEqual([]);
  });

  it("tæller kun dage inden for perioden", () => {
    const r = buildDirectRefunds([bk({ start_date: "2026-10-29", end_date: "2026-11-04" })] as never, start, end, rules);
    expect(r[0].days).toBe(2); // tor 29. + fre 30.; lør 31. ikke booket
    expect(r[0].amount).toBe(1400);
  });
});
