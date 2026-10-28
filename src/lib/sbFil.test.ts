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

describe("§1 – identitets-/generationsværn i udstedelse og upload (B2a-b1)", () => {
  it("sessionsskift under uploadhjælperens sessionsopslag → nul POST", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { udstedUpload, erForaeldetOperation } = await import("./sbFil");
    let svar!: (v: unknown) => void;
    vi.mocked(supabase.auth.getSession).mockReturnValueOnce(new Promise((r) => { svar = r; }) as never);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    let gyldig = true;
    const p = udstedUpload("c", { name: "x.png", size: 1 }, "image/png", { vagt: () => gyldig, bruger: "u" });
    gyldig = false; // logud/brugerskift mens sessionen slås op
    svar({ data: { session: { access_token: "t", user: { id: "u" } } } });
    const e = await p.catch((x) => x);
    expect(erForaeldetOperation(e)).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("forældet før upload → intet uploadToSignedUrl", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { uploadTilSti } = await import("./sbFil");
    const up = vi.fn();
    vi.mocked(supabase.storage.from).mockReturnValue({ uploadToSignedUrl: up } as never);
    await expect(uploadTilSti({ sti: "s", token: "t", conversationId: "c" }, new File(["x"], "x.png"), "image/png", { vagt: () => false, bruger: "u" })).rejects.toBeInstanceOf(SbFilFejl);
    expect(up).not.toHaveBeenCalled();
  });

  it("gyldig vagt: HTTP-kontrakten er uændret (ét POST med samme felter)", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { udstedUpload } = await import("./sbFil");
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({ data: { session: { access_token: "t", user: { id: "u" } } } } as never);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ sti: "s", token: "k" }), { status: 200 }));
    await expect(udstedUpload("c", { name: "x.png", size: 1 }, "image/png", { vagt: () => true, bruger: "u" })).resolves.toEqual({ sti: "s", token: "k", conversationId: "c" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String((fetchSpy.mock.calls[0][1] as RequestInit).body))).toEqual({ action: "udsted", conversation_id: "c", filnavn: "x.png", type: "image/png", size: 1 });
    fetchSpy.mockRestore();
  });
});

describe("c1 §3 – sidste await-hul før POST og sessionens bruger", () => {
  const kontrolSession = async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    let svar!: (v: unknown) => void;
    vi.mocked(supabase.auth.getSession).mockReturnValueOnce(new Promise((r) => { svar = r; }) as never);
    return (v: unknown) => svar(v);
  };
  const gyldigSession = { data: { session: { access_token: "t", user: { id: "u" } } } };

  it("hoveder fortsætter gyldigt, men operationen invalideres før udstedUpload fortsætter (logud) → nul POST", async () => {
    const { udstedUpload, erForaeldetOperation } = await import("./sbFil");
    const svar = await kontrolSession();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    // Vagten er gyldig ved sessionsopslaget (2 kald i hoveder), men forældet ved kontrollen umiddelbart før POST.
    let n = 0;
    const p = udstedUpload("c", { name: "x.png", size: 1 }, "image/png", { vagt: () => ++n <= 2, bruger: "u" });
    svar(gyldigSession);
    const e = await p.catch((x) => x);
    expect(n).toBe(3);
    expect(erForaeldetOperation(e)).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("fjernelse/genvalg under sessionsopslag (rigtigt uploadejerskab) → nul POST, forældet udfald", async () => {
    vi.resetModules();
    const k = await import("./sbKladder");
    const { udstedUpload, erForaeldetOperation } = await import("./sbFil");
    const svar = await kontrolSession();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const ejer = k.fastholdEjer("e", "c", "u")!;
    const id = k.startKladdeUpload(ejer, new File(["x"], "x.png"), { name: "x.png", type: "image/png", size: 1 })!;
    const p = udstedUpload("c", { name: "x.png", size: 1 }, "image/png", { vagt: () => k.erAktuelKladdeUpload(ejer, id), bruger: "u" });
    k.fjernKladdeFil("e", "c");
    svar(gyldigSession);
    expect(erForaeldetOperation(await p.catch((x) => x))).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("returneret session med andet user.id → nul POST, forældet udfald", async () => {
    const { udstedUpload, erForaeldetOperation } = await import("./sbFil");
    const svar = await kontrolSession();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const p = udstedUpload("c", { name: "x.png", size: 1 }, "image/png", { vagt: () => true, bruger: "u" });
    svar({ data: { session: { access_token: "t", user: { id: "anden" } } } });
    expect(erForaeldetOperation(await p.catch((x) => x))).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
