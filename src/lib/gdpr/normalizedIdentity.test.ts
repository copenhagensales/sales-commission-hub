import { describe, expect, it } from "vitest";
import {
  NORMALIZED_IDENTITY_STRIP_KEYS,
  stripIdentityFromPiiFields,
  stripNormalizedIdentity,
} from "../../../supabase/functions/_shared/normalized-identity.ts";

describe("stripNormalizedIdentity", () => {
  it("removes customer identity keys and keeps everything else", () => {
    const input = {
      customer_name: "Some Person",
      customer_address: "Vej 1",
      customer_zip: "2100",
      customer_city: "København",
      customer_email: "a@b.dk",
      phone_number: "+4512345678",
      lead_id: "123",
      campaign_id: "c1",
      campaign_name: "CPH sales Kanvas",
      sale_status: "success",
      sale_datetime: "2026-09-11T10:00:00Z",
      agent_external_id: "42",
      agent_email: "seller@copenhagensales.dk",
      product_name: "Tryg Bil",
      product_price: 199,
      product_quantity: 1,
      meeting_date: "2026-09-12",
      external_reference: "OPP-1",
    };

    const { data, removedKeys } = stripNormalizedIdentity(input);

    expect(removedKeys.sort()).toEqual([...NORMALIZED_IDENTITY_STRIP_KEYS].sort());
    expect(data).toEqual({
      phone_number: "+4512345678",
      lead_id: "123",
      campaign_id: "c1",
      campaign_name: "CPH sales Kanvas",
      sale_status: "success",
      sale_datetime: "2026-09-11T10:00:00Z",
      agent_external_id: "42",
      agent_email: "seller@copenhagensales.dk",
      product_name: "Tryg Bil",
      product_price: 199,
      product_quantity: 1,
      meeting_date: "2026-09-12",
      external_reference: "OPP-1",
    });
  });

  it("matches keys case-insensitively and trimmed", () => {
    const { data, removedKeys } = stripNormalizedIdentity({
      " Customer_Name ": "X",
      "CUSTOMER_EMAIL": "y@z.dk",
      phone_number: "1",
    });
    expect(removedKeys).toHaveLength(2);
    expect(data).toEqual({ phone_number: "1" });
  });

  it("returns input untouched when nothing matched", () => {
    const input = { phone_number: "1", lead_id: "2" };
    const { data, removedKeys } = stripNormalizedIdentity(input);
    expect(removedKeys).toEqual([]);
    expect(data).toBe(input);
  });

  it("handles null and non-objects", () => {
    expect(stripNormalizedIdentity(null).data).toBeNull();
    expect(stripNormalizedIdentity(undefined).data).toBeNull();
  });

  it("is idempotent", () => {
    const once = stripNormalizedIdentity({ customer_city: "Kbh", lead_id: "1" }).data;
    expect(stripNormalizedIdentity(once).removedKeys).toEqual([]);
  });
});

describe("stripIdentityFromPiiFields", () => {
  it("keeps phone_number and drops identity fields", () => {
    expect(stripIdentityFromPiiFields(["customer_name", "phone_number"])).toEqual([
      "phone_number",
    ]);
    expect(stripIdentityFromPiiFields(null)).toBeNull();
  });
});
