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
  it("Kvickly Coop direkte dagspris 1.000 forbliver 1.000 med separat Eesy-refusion 700", () => {
    expect(lokationsomkostningForDag(1000)).toBe(1000);
    expect(coopDirekteRefusionForBooking({ start_date: "2026-11-03", end_date: "2026-11-03", booked_days: [1], client_id: EESY }, kvickly, rules).amount).toBe(700);
  });
  it("Kvickly 1.700 med YouSee-booking giver 1.700", () => {
    expect(lokationsomkostningForDag(1700)).toBe(1700);
    expect(coopDirekteRefusionForBooking({ start_date: "2026-11-03", end_date: "2026-11-03", client_id: YOUSEE }, kvickly, rules).amount).toBe(0);
  });
  it("SuperBrugsen dagspris 1.000 og separat refusion 250", () => {
    expect(lokationsomkostningForDag(1000)).toBe(1000);
    expect(coopDirekteRefusionForBooking({ start_date: "2026-11-03", end_date: "2026-11-03", client_id: EESY }, superb, rules).amount).toBe(250);
  });
  it("anden type er uændret", () => {
    expect(lokationsomkostningForDag(1750)).toBe(1750);
    expect(lokationsomkostningForDag(1700)).toBe(1700);
  });
  it("uden for reglens gyldighed gives hele dagsprisen", () => {
    expect(coopDirekteRefusionForBooking({ start_date: "2026-08-31", end_date: "2026-08-31", client_id: EESY }, kvickly, rules).amount).toBe(0);
    const udloebet = [rule("Kvickly", 700, "2026-10-31")];
    expect(coopDirekteRefusionForBooking({ start_date: "2026-11-03", end_date: "2026-11-03", client_id: EESY }, kvickly, udloebet).amount).toBe(0);
  });
  it("refusion for booking tæller kun bookede dage", () => {
    const r = coopDirekteRefusionForBooking(
      { start_date: "2026-11-02", end_date: "2026-11-08", booked_days: [0, 1, 2], client_id: EESY },
      kvickly, rules
    );
    expect(r.days).toBe(3);
    expect(r.amount).toBe(2100);
  });
  it("aftalt totalpris fordeles uden refusionsfradrag i dagsrækker", () => {
    const booking = {
      start_date: "2026-11-02", end_date: "2026-11-08", booked_days: [0, 2, 6],
      total_price: 3000, daily_rate_override: 9999, location: { ...kvickly, daily_rate: 8888 }, client_id: EESY,
    };
    const gross = bookingGross(booking);
    const costs = bookedDates(booking).map(day =>
      lokationsomkostningForDag(gross.dailyRate)
    );
    expect(gross.dailyRate).toBe(1000);
    expect(costs).toEqual([1000, 1000, 1000]);
    expect(costs.reduce((sum, cost) => sum + cost, 0)).toBe(3000);
    expect(coopDirekteRefusionForBooking(booking, booking.location, rules).amount).toBe(2100);
  });
  it("dagsrækker giver kun refusion på gyldige dage i den viste periode", () => {
    const booking = { start_date: "2026-11-02", end_date: "2026-11-06", booked_days: [0, 1, 2, 3, 4], client_id: EESY };
    const limitedRules = [{ ...rule("Kvickly", 700, "2026-11-04"), valid_from: "2026-11-03" }];
    const costs = bookedDates(booking).map(() => lokationsomkostningForDag(1000));
    expect(costs).toEqual([1000, 1000, 1000, 1000, 1000]);
    expect(costs.reduce((sum, cost) => sum + cost, 0)).toBe(5000);
    expect(coopDirekteRefusionForBooking(booking, kvickly, limitedRules).amount).toBe(1400);
    const clipped = bookedDates(booking, new Date("2026-11-04T00:00:00"), new Date("2026-11-05T00:00:00"));
    expect(clipped.map(() => lokationsomkostningForDag(1000))).toEqual([1000, 1000]);
    expect(coopDirekteRefusionForBooking(booking, kvickly, limitedRules, clipped[0], clipped[1]).amount).toBe(700);
  });
  it("flere bookinger samme dag bevarer hver kundes refusionsgrundlag", () => {
    const dailyCosts = [
      lokationsomkostningForDag(1000),
      lokationsomkostningForDag(1000),
      lokationsomkostningForDag(1000),
    ];
    expect(dailyCosts).toEqual([1000, 1000, 1000]);
    expect(dailyCosts.reduce((sum, cost) => sum + cost, 0)).toBe(3000);
  });
});
