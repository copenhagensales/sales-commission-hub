import { describe, it, expect } from "vitest";
import { portalPeriods, resolveCatalog, parsePortalDate, parsePortalAmount, PortalError } from "../../supabase/functions/_shared/invoiceflowPortalPeriods";

describe("InvoiceFlow portal-perioder", () => {
  it("almindelig kørsel henter kun perioden", () => {
    expect(portalPeriods("2026-09", false)).toEqual(["2026-09"]);
  });
  it("første kørsel henter de seneste 3 måneder, også over årsskifte", () => {
    expect(portalPeriods("2026-01", true)).toEqual(["2026-01", "2025-12", "2025-11"]);
  });
  it("afviser ugyldig periode", () => {
    expect(() => portalPeriods("2026-13", false)).toThrow();
  });
  it("dato og beløb gættes aldrig", () => {
    expect(parsePortalDate("05.10.2026")).toBe("2026-10-05");
    expect(parsePortalDate("oktober")).toBeNull();
    expect(parsePortalAmount("1.234,56 kr.")).toBe(1234.56);
    expect(parsePortalAmount("ukendt")).toBeNull();
  });
});

describe("InvoiceFlow portal-katalog", () => {
  const hiper = { slug: "hiper", status: "understoettet", flow_version: 1, login_fields: ["email", "password"] };
  it("Hiper slås op til modul og loginfelter", () => {
    expect(resolveCatalog(hiper)).toEqual({ slug: "hiper", fields: ["email", "password"], flowVersion: 1 });
  });
  it("ikke-understøttet portal afvises", () => {
    expect(() => resolveCatalog({ ...hiper, status: "kraever_kode" })).toThrow(PortalError);
  });
  it("ukendt slug uden modul afvises", () => {
    expect(() => resolveCatalog({ ...hiper, slug: "yousee" })).toThrow(PortalError);
  });
  it("manglende katalogrække afvises", () => {
    expect(() => resolveCatalog(null)).toThrow(PortalError);
  });
});
