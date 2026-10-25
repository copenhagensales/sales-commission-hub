import { describe, it, expect } from "vitest";
import { matchesRule, attachmentMatches } from "../../supabase/functions/_shared/invoiceflowMailMatch";

describe("InvoiceFlow mail-regel", () => {
  const rule = { mailbox: "x@y.dk", from_domain: "leverandoer.dk", subject_contains: "faktura" };
  it("matcher afsender-domæne og emneord", () => {
    expect(matchesRule(rule, { from: "bogholderi@leverandoer.dk", subject: "Din Faktura 123" })).toBe(true);
  });
  it("afviser andet domæne", () => {
    expect(matchesRule(rule, { from: "a@leverandoer.dk.evil.com", subject: "Faktura" })).toBe(false);
  });
  it("afviser manglende emneord", () => {
    expect(matchesRule(rule, { from: "a@leverandoer.dk", subject: "Nyhedsbrev" })).toBe(false);
  });
  it("tager kun PDF-vedhæftninger", () => {
    expect(attachmentMatches(rule, "faktura.pdf", "application/octet-stream")).toBe(true);
    expect(attachmentMatches(rule, "logo.png", "image/png")).toBe(false);
  });
});
