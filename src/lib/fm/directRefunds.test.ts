import { describe, expect, it } from "vitest";
import { buildDirectRefunds, sumDirectRefunds, supplierInvoiceBookings } from "./directRefunds";

const EESY = "eesy-id";
const ANDEN = "andet-id";
const start = new Date("2026-10-01T00:00:00");
const end = new Date("2026-10-31T00:00:00");

const kvickly = {
  id: "loc-k", name: "Kvickly Testby", type: "Anden lokation", chain: "Kvickly",
  refund_daily_rate: 750, refund_client_id: EESY, daily_rate: 1000,
};
const coop = {
  id: "loc-c", name: "Kvickly Coop", type: "Coop butik", chain: null,
  refund_daily_rate: null, refund_client_id: null, daily_rate: 1000,
};
const bk = (o: Record<string, unknown>) => ({
  start_date: "2026-10-05", end_date: "2026-10-09", booked_days: [0, 1, 2, 3, 4],
  status: "confirmed", client_id: EESY, location: kvickly, ...o,
});

describe("direkte afregnet refusion", () => {
  it("direkte afregnet lokation indgår i refusionssum men ikke i Excel-rækker/total", () => {
    const bookings = [bk({}), bk({ location: coop })];
    const refunds = buildDirectRefunds(bookings as never, start, end);
    expect(refunds).toHaveLength(1);
    expect(refunds[0].days).toBe(5);
    expect(sumDirectRefunds(refunds)).toBe(3750);
    const invoice = supplierInvoiceBookings(bookings, "Coop butik");
    expect(invoice.map((b) => b.location.id)).toEqual(["loc-c"]);
  });

  it("booking for anden kunde giver ingen refusion", () => {
    expect(buildDirectRefunds([bk({ client_id: ANDEN })] as never, start, end)).toEqual([]);
  });

  it("ubekræftet booking og Coop-type giver ingen refusion", () => {
    expect(buildDirectRefunds([bk({ status: "pending" })] as never, start, end)).toEqual([]);
    expect(
      buildDirectRefunds([bk({ location: { ...kvickly, type: "Coop butik" } })] as never, start, end)
    ).toEqual([]);
  });

  it("tæller kun dage inden for perioden", () => {
    const r = buildDirectRefunds([bk({ start_date: "2026-10-29", end_date: "2026-11-04" })] as never, start, end);
    expect(r[0].days).toBe(2); // tor 29. + fre 30.; lør 31. ikke booket
    expect(r[0].amount).toBe(1500);
  });
});
