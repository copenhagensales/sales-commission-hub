import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: vi.fn() }, storage: { from: vi.fn() } } }));

import { validerFil, MAKS_FIL, MAKS_TEKSTFIL, filFejlTekst, erPermanentFilFejl, SbFilFejl, udstedFejlTekst } from "./sbFil";

describe("validerFil", () => {
  it("afviser PDF med forklaring", () => {
    expect(validerFil({ name: "a.pdf", type: "application/pdf", size: 10 })).toEqual({ ok: false, fejl: "PDF understøttes ikke endnu" });
  });
  it("tekstfil 20 KiB tilladt, 20 KiB + 1 afvist", () => {
    expect(validerFil({ name: "a.txt", type: "text/plain", size: MAKS_TEKSTFIL }).ok).toBe(true);
    expect(validerFil({ name: "a.txt", type: "text/plain", size: MAKS_TEKSTFIL + 1 }).ok).toBe(false);
  });
  it("billede 10 MiB tilladt, 10 MiB + 1 afvist", () => {
    expect(validerFil({ name: "a.png", type: "image/png", size: MAKS_FIL }).ok).toBe(true);
    expect(validerFil({ name: "a.png", type: "image/png", size: MAKS_FIL + 1 }).ok).toBe(false);
  });
  it("afviser ukendt type og uoverensstemmende MIME", () => {
    expect(validerFil({ name: "a.svg", type: "image/svg+xml", size: 10 }).ok).toBe(false);
    expect(validerFil({ name: "a.png", type: "text/html", size: 10 }).ok).toBe(false);
  });
});

describe("filfejl", () => {
  it("403/404/410 er permanente, 401/429/net er ikke", () => {
    for (const s of [403, 404, 410]) expect(erPermanentFilFejl(new SbFilFejl(s, "x"))).toBe(true);
    for (const s of [0, 401, 429]) expect(erPermanentFilFejl(new SbFilFejl(s, "x"))).toBe(false);
    expect(filFejlTekst(new SbFilFejl(410, "vaek"))).toBe("Filen er ikke længere tilgængelig");
    expect(filFejlTekst(new SbFilFejl(429, "rate"))).not.toBe("Filen er ikke længere tilgængelig");
  });
  it("pdf_udskudt fra serveren oversættes", () => {
    expect(udstedFejlTekst(new SbFilFejl(400, "pdf_udskudt"))).toBe("PDF understøttes ikke endnu");
  });
});
