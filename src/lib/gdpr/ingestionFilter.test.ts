import { describe, expect, it } from "vitest";
import {
  createDecisionLookup,
  createFilterStats,
  filterIngestionPayload,
  isPhoneField,
  type KnownFieldRow,
  looksLikeFreetextValue,
} from "../../../supabase/functions/_shared/ingestion-filter.ts";

const rows: KnownFieldRow[] = [
  { integration: "adversus", container: "masterData", field_label: "Navn1", decision: "BLOKER" },
  { integration: "adversus", container: "masterData", field_label: "Adresse", decision: "BLOKER" },
  { integration: "adversus", container: "masterData", field_label: "Email", decision: "BLOKER" },
  { integration: "adversus", container: "masterData", field_label: "Fødselsdato", decision: "BLOKER" },
  { integration: "adversus", container: "masterData", field_label: "Telefonnummer", decision: "BLOKER" },
  { integration: "adversus", container: "masterData", field_label: "Medlemsnummer", decision: "BEHOLD" },
  { integration: "adversus", container: "masterData", field_label: "Dækningssum", decision: "BEHOLD" },
  { integration: "adversus", container: "data", field_label: "Navn1", decision: "BLOKER" },
  { integration: "adversus", container: "data", field_label: "Adresse", decision: "BLOKER" },
  { integration: "adversus", container: "data", field_label: "Email", decision: "BLOKER" },
  { integration: "adversus", container: "data", field_label: "Fødselsdato", decision: "BLOKER" },
  { integration: "adversus", container: "data", field_label: "Medlemsnummer", decision: "BEHOLD" },
  { integration: "adversus", container: "data", field_label: "Dækningssum", decision: "BEHOLD" },
  { integration: "adversus", container: "leadResultData", field_label: "Tilskud", decision: "UAFKLARET" },
];

function opts(phoneFilterEnabled = false) {
  return { lookup: createDecisionLookup(rows, "adversus"), phoneFilterEnabled };
}

function run<T>(input: T, container: string, phoneFilterEnabled = false) {
  const stats = createFilterStats();
  const { data } = filterIngestionPayload(input, container, opts(phoneFilterEnabled), stats);
  return { data, stats };
}

describe("array-form og objekt-form giver samme resultat", () => {
  it("fjerner samme felter i masterData (array) og data (objekt)", () => {
    const arrayForm = run(
      {
        masterData: [
          { label: "Navn1", value: "x" },
          { name: "Adresse", value: "y" },
          { label: "Email", value: "z" },
          { label: "Fødselsdato", value: "1980-01-01" },
          { label: "Medlemsnummer", value: "12345" },
          { label: "Dækningssum", value: "500000" },
        ],
      },
      "raw_payload",
    );
    const objectForm = run(
      {
        data: {
          Navn1: "x",
          Adresse: "y",
          Email: "z",
          Fødselsdato: "1980-01-01",
          Medlemsnummer: "12345",
          Dækningssum: "500000",
        },
      },
      "raw_payload",
    );

    const keptArray = (arrayForm.data.masterData as { label?: string; name?: string }[]).map(
      (i) => i.label ?? i.name,
    );
    expect(keptArray).toEqual(["Medlemsnummer", "Dækningssum"]);
    expect(Object.keys(objectForm.data.data as Record<string, unknown>)).toEqual([
      "Medlemsnummer",
      "Dækningssum",
    ]);
    expect([...arrayForm.stats.removed.values()].map((r) => r.field).sort()).toEqual(
      [...objectForm.stats.removed.values()].map((r) => r.field).sort(),
    );
  });
});

describe("BEHOLD slår fritekstdetektoren", () => {
  it("beholder et BEHOLD-felt med linjeskift", () => {
    const value = "linje 1\nlinje 2";
    expect(looksLikeFreetextValue(value)).toBe(true);
    const { data, stats } = run({ data: { Dækningssum: value } }, "raw_payload");
    expect((data.data as Record<string, unknown>).Dækningssum).toBe(value);
    expect(stats.removed.size).toBe(0);
  });
});

describe("ukendte felter", () => {
  it("beholder værdien og registreres som UAFKLARET", () => {
    const { data, stats } = run({ data: { HeltNytFelt: "kort værdi" } }, "raw_payload");
    expect((data.data as Record<string, unknown>).HeltNytFelt).toBe("kort værdi");
    expect([...stats.unknown.values()]).toEqual([
      { field: "HeltNytFelt", container: "data", count: 1 },
    ]);
  });

  it("fjernes og sættes til BLOKER når fritekstdetektoren rammer", () => {
    const long = `${"a".repeat(120)} tre mellemrum her`;
    const { data, stats } = run(
      { data: { UkendtFritekst: long, Notater: "sælgernote" } },
      "raw_payload",
    );
    expect(data.data).toEqual({});
    expect([...stats.freetextBlocked.values()].map((f) => f.field).sort()).toEqual([
      "Notater",
      "UkendtFritekst",
    ]);
  });
});

describe("telefonflaget", () => {
  it("beholder telefonfelter når phone_filter_enabled=false", () => {
    expect(isPhoneField("Telefonnummer")).toBe(true);
    const { data } = run({ masterData: [{ label: "Telefonnummer", value: "12345678" }] }, "raw_payload", false);
    expect((data.masterData as { label: string }[]).map((i) => i.label)).toEqual([
      "Telefonnummer",
    ]);
  });

  it("fjerner telefonfelter når phone_filter_enabled=true", () => {
    const { data } = run({ masterData: [{ label: "Telefonnummer", value: "12345678" }] }, "raw_payload", true);
    expect(data.masterData).toEqual([]);
  });

  it("rører ikke Postnummer-mønstret som telefon", () => {
    expect(isPhoneField("Postnummer")).toBe(false);
  });
});

describe("idempotens", () => {
  it("to kørsler giver samme resultat", () => {
    const input = {
      masterData: [
        { label: "Navn1", value: "x" },
        { label: "Medlemsnummer", value: "12345" },
      ],
      data: { Adresse: "y", Dækningssum: "500000" },
      leadResultData: [{ label: "Tilskud", value: "1200" }],
    };
    const first = run(input, "raw_payload").data;
    const second = run(first, "raw_payload").data;
    expect(second).toEqual(first);
  });
});

describe("provisions- og salgsfelter berøres ikke", () => {
  it("beholder normalized_data-nøglerne der driver provision og kampagnetilknytning", () => {
    const normalized = {
      lead_id: "1",
      campaign_id: "2",
      campaign_name: "Tryg Products",
      sale_status: "success",
      sale_datetime: "2026-09-11T10:00:00Z",
      agent_external_id: "a1",
      product_name: "Bilforsikring",
      product_price: 1200,
      product_quantity: 1,
      external_reference: "OPP-1",
      member_number: "999",
    };
    const { data, stats } = run({ ...normalized }, "normalized_data");
    expect(data).toEqual(normalized);
    expect(stats.removed.size).toBe(0);
  });

  it("filteret rører kun payload — sale_items-felter indgår ikke", () => {
    const sale = {
      raw_payload: { data: { Navn1: "x", Dækningssum: "500000" } },
      mapped_commission: 200,
      mapped_revenue: 500,
      client_campaign_id: "c1",
    };
    const { data } = run(sale.raw_payload, "raw_payload");
    expect(data).toEqual({ data: { Dækningssum: "500000" } });
    expect(sale.mapped_commission).toBe(200);
    expect(sale.mapped_revenue).toBe(500);
    expect(sale.client_campaign_id).toBe("c1");
  });
});
