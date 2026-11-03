import { describe, expect, it } from "vitest";
import { lokationsomkostningForDag, coopDirekteRefusionForBooking } from "./coopDirekte";
import type { LocationRateSurcharge } from "@/utils/locationRateSurcharge";

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
});
