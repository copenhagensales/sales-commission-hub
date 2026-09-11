import { describe, expect, it } from "vitest";
import {
  looksLikeFreetextValue,
  matchesFreetextName,
  stripFreetextFields,
} from "../../../supabase/functions/_shared/freetext-strip.ts";

describe("regel A — feltnavn", () => {
  it("fanger Notater, Note til lead, Fastgjorte noter, Bemærkninger og kommentar", () => {
    for (const label of [
      "Notater",
      " NOTATER ",
      "Note til lead",
      "Fastgjorte noter",
      "Bemærkninger",
      "Bemaerkninger",
      "fm_comment",
      "Kommentar",
    ]) {
      expect(matchesFreetextName(label)).toBe(true);
    }
  });

  it("rører ikke legitime felter", () => {
    for (const label of ["OPP nr", "Sales ID", "Tilskud", "Dækningssum", "Telefonnummer1"]) {
      expect(matchesFreetextName(label)).toBe(false);
    }
  });

  it("fjerner feltet uanset værdi", () => {
    const { data, removals } = stripFreetextFields({ data: { Notater: "kort", "OPP nr": "1095472" } });
    expect(data).toEqual({ data: { "OPP nr": "1095472" } });
    expect(removals).toEqual([{ field: "Notater", rule: "A", count: 1 }]);
  });
});

describe("regel B — værdien ligner fritekst", () => {
  it("fjerner ukendt feltnavn med linjeskift", () => {
    const { data, removals } = stripFreetextFields({ Fritekst: "linje 1\nlinje 2" });
    expect(data).toEqual({});
    expect(removals).toEqual([{ field: "Fritekst", rule: "B", count: 1 }]);
  });

  it("fjerner ukendt feltnavn over 120 tegn med mindst tre mellemrum", () => {
    const value = `${"a".repeat(118)} b c d`;
    const { removals } = stripFreetextFields({ Ukendt: value });
    expect(removals).toEqual([{ field: "Ukendt", rule: "B", count: 1 }]);
  });

  it("bevarer lang værdi uden mellemrum", () => {
    const value = "a".repeat(300);
    expect(looksLikeFreetextValue(value)).toBe(false);
    const { data, removals } = stripFreetextFields({ Reference: value });
    expect(data).toEqual({ Reference: value });
    expect(removals).toEqual([]);
  });
});

describe("BEHOLD-ventilen", () => {
  it("rører ikke et BEHOLD-felt med linjeskift", () => {
    const { data, removals } = stripFreetextFields(
      { Adresseblok: "vej 1\n2100 KBH" },
      { keepLabels: ["adresseblok"] },
    );
    expect(data).toEqual({ Adresseblok: "vej 1\n2100 KBH" });
    expect(removals).toEqual([]);
  });

  it("BEHOLD vinder også over regel A", () => {
    const { data } = stripFreetextFields({ Kommentar: "ok" }, { keepLabels: ["Kommentar"] });
    expect(data).toEqual({ Kommentar: "ok" });
  });
});

describe("beholdere og former", () => {
  it("virker rekursivt i data, masterData og leadResultData", () => {
    const { data } = stripFreetextFields({
      data: { Notater: "x", Telefonnummer1: "12345678" },
      masterData: [{ label: "Bemærkninger", value: "y" }, { label: "OPP nr", value: "1" }],
      leadResultData: [{ label: "Notater", value: "z" }],
    });
    expect(data).toEqual({
      data: { Telefonnummer1: "12345678" },
      masterData: [{ label: "OPP nr", value: "1" }],
      leadResultData: [],
    });
  });

  it("tæller flere forekomster af samme felt", () => {
    const { removals } = stripFreetextFields([{ Notater: "a" }, { Notater: "b" }]);
    expect(removals).toEqual([{ field: "Notater", rule: "A", count: 2 }]);
  });
});
