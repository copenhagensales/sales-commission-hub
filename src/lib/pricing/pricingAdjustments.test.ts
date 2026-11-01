import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { applyPricingAdjustments, type PricingAdjustmentRule } from "./pricingAdjustments";
import * as edge from "../../../supabase/functions/_shared/pricingAdjustments";

const MBB = "mbb";
const rule: PricingAdjustmentRule = {
  id: "r1", name: "TDC Brands", conditions: { "TDC Brands": "Ja" }, excludedProductIds: [MBB],
  percentReduction: 70, effectiveFrom: "2026-10-29", effectiveTo: null, priority: 0,
  clientCampaignIds: new Set(["eesy-tm"]),
};
const payload = (v: string) => ({ leadResultData: [{ id: 1, label: "TDC Brands", value: v }] });
const base = { productId: "abon", clientCampaignId: "eesy-tm", saleDate: "2026-10-30T10:00:00Z", rawPayload: payload("Ja"), commission: 400, revenue: 1000 };

for (const [name, apply] of Object.entries({ frontend: applyPricingAdjustments, edge: edge.applyPricingAdjustments })) {
  describe(`prisjustering (${name})`, () => {
    it("TDC Brands = Ja giver 70 % reduktion på færdig sats", () => {
      expect(apply([rule], base)).toEqual({ commission: 120, revenue: 300, ruleId: "r1" });
    });
    it("Nej ændrer intet", () => {
      expect(apply([rule], { ...base, rawPayload: payload("Nej") })).toEqual({ commission: 400, revenue: 1000, ruleId: null });
    });
    it("5GI MBB er undtaget", () => {
      expect(apply([rule], { ...base, productId: MBB }).ruleId).toBeNull();
    });
    it("salg før 29/10 (dansk tid) ændres ikke", () => {
      expect(apply([rule], { ...base, saleDate: "2026-10-28T21:30:00Z" }).ruleId).toBeNull();
      expect(apply([rule], { ...base, saleDate: "2026-10-28T23:30:00Z" }).ruleId).toBe("r1");
    });
    it("salg på anden kunde ændres ikke", () => {
      expect(apply([rule], { ...base, clientCampaignId: "andet" }).ruleId).toBeNull();
      expect(apply([rule], { ...base, clientCampaignId: null }).ruleId).toBeNull();
    });
  });
}

it("frontend og edge er identiske", () => {
  const a = readFileSync("src/lib/pricing/pricingAdjustments.ts", "utf8");
  const b = readFileSync("supabase/functions/_shared/pricingAdjustments.ts", "utf8");
  expect(a).toBe(b);
});
