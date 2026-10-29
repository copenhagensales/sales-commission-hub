import { describe, it, expect, vi, beforeEach } from "vitest";

/** S7-c: hook-hjælperne kalder de rigtige RPC'er med de rigtige navne og tolker svaret. Ingen netværk. */
const net = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: net.rpc, functions: { invoke: net.invoke }, from: () => { throw new Error("ikke brugt"); } },
}));

import { anmeldTekst, begrundelseTekst, sbAfgoer, sbAnmeld, sbModerer, startTjek, ANMELD_KODER } from "./useSbOpslag";

describe("useSbOpslag", () => {
  beforeEach(() => { net.rpc.mockReset(); net.invoke.mockReset(); });

  it("startTjek kalder storkbook-tjek med kilde som type og revision 1 som standard", () => {
    net.invoke.mockResolvedValue({ data: null, error: null });
    startTjek("kommentar", "k1", null);
    expect(net.invoke).toHaveBeenCalledWith("storkbook-tjek", { body: { type: "kommentar", id: "k1", revision: 1 } });
    net.invoke.mockRejectedValue(new Error("net"));
    expect(() => startTjek("opslag", "o1", 3)).not.toThrow();
  });

  it("startTjek kalder efter-callback, når kaldet er slut – også ved fejl", async () => {
    net.invoke.mockResolvedValue({ data: null, error: null });
    const efter = vi.fn();
    startTjek("opslag", "o1", 1, efter);
    await vi.waitFor(() => expect(efter).toHaveBeenCalledTimes(1));
    net.invoke.mockRejectedValue(new Error("net"));
    const efter2 = vi.fn();
    startTjek("kommentar", "k1", 1, efter2);
    await vi.waitFor(() => expect(efter2).toHaveBeenCalledTimes(1));
  });

  it("sbAfgoer / sbModerer sender parametrene i RPC-form og returnerer boolean", async () => {
    net.rpc.mockResolvedValue({ data: true, error: null });
    await expect(sbAfgoer("opslag", "o1", 2, "send")).resolves.toBe(true);
    expect(net.rpc).toHaveBeenCalledWith("sb_afgoer", { p_kilde: "opslag", p_id: "o1", p_revision: 2, p_handling: "send" });
    net.rpc.mockResolvedValue({ data: false, error: null });
    await expect(sbModerer("kommentar", "k1", "skjul", "spam")).resolves.toBe(false);
    expect(net.rpc).toHaveBeenLastCalledWith("sb_moderer", { p_kilde: "kommentar", p_id: "k1", p_handling: "skjul", p_kode: "spam" });
    await sbModerer("opslag", "o1", "vis");
    expect(net.rpc).toHaveBeenLastCalledWith("sb_moderer", { p_kilde: "opslag", p_id: "o1", p_handling: "vis" });
  });

  it("sbAnmeld tolker 'ny'/'findes' og kaster ved fejl", async () => {
    net.rpc.mockResolvedValue({ data: "ny", error: null });
    await expect(sbAnmeld("opslag", "o1", "haard_tone")).resolves.toBe("ny");
    net.rpc.mockResolvedValue({ data: "findes", error: null });
    await expect(sbAnmeld("opslag", "o1", "haard_tone")).resolves.toBe("findes");
    net.rpc.mockResolvedValue({ data: null, error: { message: "nej" } });
    await expect(sbAnmeld("opslag", "o1", "haard_tone")).rejects.toBeTruthy();
  });

  it("tekster: alle fem koder har tekst; ukendt begrundelse giver fast fald-tilbage", () => {
    expect(ANMELD_KODER.map((k) => k.kode)).toEqual(["personoplysning", "haard_tone", "upassende", "spam", "andet"]);
    for (const k of ANMELD_KODER) expect(anmeldTekst(k.kode)).toBe(k.tekst);
    expect(anmeldTekst("x")).toBeNull();
    expect(begrundelseTekst(null)).toMatch(/kunne ikke tjekkes/i);
    expect(begrundelseTekst("haard_tone")).not.toMatch(/kunne ikke tjekkes/i);
    expect(begrundelseTekst("personoplysning", "opslag")).toMatch(/^Opslaget ser ud til/);
    expect(begrundelseTekst("ikke_tjekket", "kommentar")).toMatch(/^Kommentaren kunne ikke tjekkes/);
    expect(begrundelseTekst("personoplysning", "kommentar")).not.toMatch(/[Bb]eskeden/);
  });
});
