import { describe, expect, it } from "vitest";
import { lokationsomkostningForDag, coopDirekteRefusionForBooking, bookedDates } from "./coopDirekte";
import type { LocationRateSurcharge } from "@/utils/locationRateSurcharge";
import { bookingGross } from "@/utils/bookingGross";

const EESY = "eesy";
const YOUSEE = "yousee";
const rule = (chain: string, perDay: number, valid_to: string | null = null): LocationRateSurcharge => ({
  id: chain, location_type: "Coop butik", chain_match: chain, surcharge_per_day: perDay,
  funded_by_client_id: EESY, valid_from: "2026-09-01", valid_to, is_active: true, note: null,
});
const rules = [rule("Kvickly", 700), rule("SuperBrugsen", 250)];
const dag = new Date("2026-11-03T00:00:00");
const kvickly = { type: "Coop direkte", name: "Kvickly Testby" };
const superb = { type: "Coop direkte", name: "SuperBrugsen Testby" };

describe("Coop direkte lokationsomkostning", () => {
  it("Kvickly 1.700 med Eesy-booking giver 1.000", () => {
    expect(lokationsomkostningForDag(1700, kvickly, EESY, dag, rules)).toBe(1000);
  });
  it("Kvickly 1.700 med YouSee-booking giver 1.700", () => {
    expect(lokationsomkostningForDag(1700, kvickly, YOUSEE, dag, rules)).toBe(1700);
  });
  it("SuperBrugsen 1.250 med Eesy-booking giver 1.000", () => {
    expect(lokationsomkostningForDag(1250, superb, EESY, dag, rules)).toBe(1000);
  });
  it("anden type er uændret", () => {
    expect(lokationsomkostningForDag(1750, { type: "Coop butik", name: "Kvickly X" }, EESY, dag, rules)).toBe(1750);
    expect(lokationsomkostningForDag(1700, { type: "Anden lokation", name: "Kvickly X" }, EESY, dag, rules)).toBe(1700);
  });
  it("uden for reglens gyldighed gives hele dagsprisen", () => {
    expect(lokationsomkostningForDag(1700, kvickly, EESY, new Date("2026-08-31T00:00:00"), rules)).toBe(1700);
    const udloebet = [rule("Kvickly", 700, "2026-10-31")];
    expect(lokationsomkostningForDag(1700, kvickly, EESY, dag, udloebet)).toBe(1700);
  });
  it("refusion for booking tæller kun bookede dage", () => {
    const r = coopDirekteRefusionForBooking(
      { start_date: "2026-11-02", end_date: "2026-11-08", booked_days: [0, 1, 2], client_id: EESY },
      kvickly, rules
    );
    expect(r.days).toBe(3);
    expect(r.amount).toBe(2100);
  });
  it("aftalt totalpris fordeles før refusion, og dagsrækker summerer til netto", () => {
    const booking = {
      start_date: "2026-11-02", end_date: "2026-11-08", booked_days: [0, 2, 6],
      total_price: 5100, daily_rate_override: 9999, location: { ...kvickly, daily_rate: 8888 }, client_id: EESY,
    };
    const gross = bookingGross(booking);
    const costs = bookedDates(booking).map(day =>
      lokationsomkostningForDag(gross.dailyRate, booking.location, booking.client_id, day, rules)
    );
    expect(gross.dailyRate).toBe(1700);
    expect(costs).toEqual([1000, 1000, 1000]);
    expect(costs.reduce((sum, cost) => sum + cost, 0)).toBe(3000);
    expect(gross.total - coopDirekteRefusionForBooking(booking, booking.location, rules).amount).toBe(3000);
  });
  it("dagsrækker giver kun refusion på gyldige dage i den viste periode", () => {
    const booking = { start_date: "2026-11-02", end_date: "2026-11-06", booked_days: [0, 1, 2, 3, 4], client_id: EESY };
    const limitedRules = [{ ...rule("Kvickly", 700, "2026-11-04"), valid_from: "2026-11-03" }];
    const costs = bookedDates(booking).map(day => lokationsomkostningForDag(1700, kvickly, EESY, day, limitedRules));
    expect(costs).toEqual([1700, 1000, 1000, 1700, 1700]);
    expect(costs.reduce((sum, cost) => sum + cost, 0)).toBe(7100);
    const clipped = bookedDates(booking, new Date("2026-11-04T00:00:00"), new Date("2026-11-05T00:00:00"));
    expect(clipped.map(day => lokationsomkostningForDag(1700, kvickly, EESY, day, limitedRules))).toEqual([1000, 1700]);
  });
  it("flere bookinger samme dag bevarer hver kundes refusionsgrundlag", () => {
    const dailyCosts = [
      lokationsomkostningForDag(1700, kvickly, EESY, dag, rules),
      lokationsomkostningForDag(1700, kvickly, YOUSEE, dag, rules),
      lokationsomkostningForDag(1250, superb, EESY, dag, rules),
    ];
    expect(dailyCosts).toEqual([1000, 1700, 1000]);
    expect(dailyCosts.reduce((sum, cost) => sum + cost, 0)).toBe(3700);
  });
});
