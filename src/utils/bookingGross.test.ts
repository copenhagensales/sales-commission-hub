import { describe, it, expect } from "vitest";
import { bookingGross } from "./bookingGross";

const base = { start_date: "2026-10-12", end_date: "2026-10-16", booked_days: [0, 1, 2, 3, 4] };

describe("bookingGross", () => {
  it("aftalt samlet pris 14.375 kr. på 5 dage giver 2.875 kr./dag", () => {
    const r = bookingGross({ ...base, total_price: 14375 });
    expect(r.total).toBe(14375);
    expect(r.dailyRate).toBe(2875);
    expect(r.usesTotalPrice).toBe(true);
  });
  it("uden samlet pris bruges dagspris × dage", () => {
    const r = bookingGross({ ...base, total_price: null, daily_rate_override: 1000 });
    expect(r.total).toBe(5000);
    expect(r.usesTotalPrice).toBe(false);
  });
});
