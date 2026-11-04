import { describe, expect, it } from "vitest";
import { buildDirectRefunds, sumDirectRefunds, supplierInvoiceBookings } from "./directRefunds";
import type { LocationRateSurcharge } from "@/utils/locationRateSurcharge";

const EESY = "eesy-id";
const ANDEN = "andet-id";
const start = new Date("2026-10-01T00:00:00");
const end = new Date("2026-10-31T00:00:00");
const rules: LocationRateSurcharge[] = [
  { id: "k", location_type: "Coop butik", chain_match: "Kvickly", surcharge_per_day: 700,
    funded_by_client_id: EESY, valid_from: "2026-09-01", valid_to: null, is_active: true, note: null },
];

const direkte = { id: "loc-k", name: "Kvickly Testby", type: "Coop direkte", daily_rate: 1000 };
const coop = { id: "loc-c", name: "Kvickly Coop", type: "Coop butik", daily_rate: 1000 };
const bk = (o: Record<string, unknown>) => ({
  start_date: "2026-10-05", end_date: "2026-10-09", booked_days: [0, 1, 2, 3, 4],
  status: "confirmed", client_id: EESY, location: direkte, ...o,
});

describe("direkte afregnet refusion (Coop direkte)", () => {
  it("direkte afregnet lokation indgår i refusionssum men ikke i Excel-rækker/total", () => {
    const bookings = [bk({}), bk({ location: coop })];
    const refunds = buildDirectRefunds(bookings as never, start, end, rules, { [EESY]: "Eesy FM" });
    expect(refunds).toHaveLength(1);
    expect(refunds[0].chain).toBe("Kvickly");
    expect(refunds[0].days).toBe(5);
    expect(refunds[0].refundClientName).toBe("Eesy FM");
    expect(sumDirectRefunds(refunds)).toBe(3500);
    expect(refunds[0].perDay).toBe(700);
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
  it("regeldatoer afgrænser refusion, uden at Coop butik giver direkte refusion", () => {
    const limited = [{ ...rules[0], valid_from: "2026-10-06", valid_to: "2026-10-08" }];
    expect(sumDirectRefunds(buildDirectRefunds([bk({})] as never, start, end, limited))).toBe(2100);
    expect(buildDirectRefunds([bk({ location: coop })] as never, start, end, rules)).toEqual([]);
  });
});
