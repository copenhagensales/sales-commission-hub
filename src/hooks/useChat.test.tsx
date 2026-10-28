import { describe, it, expect, vi, beforeEach } from "vitest";

const insert = vi.fn();
const maybeSingle = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      insert: (r: unknown) => insert(r),
      select: () => ({ eq: () => ({ maybeSingle: () => maybeSingle() }) }),
    }),
    rpc: vi.fn(),
    auth: { getUser: vi.fn(), onAuthStateChange: vi.fn() },
    functions: { invoke: vi.fn() },
  },
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

import { sendBesked, SendFejl, validerSamtale, normaliserDeltagere, kanSletteSamtale, serverTekst, erForaeldet } from "./useChat";

const v = { id: "11111111-1111-1111-1111-111111111111", conversationId: "c", content: "hej" };

describe("sendBesked – stabilt id og afstemning", () => {
  beforeEach(() => { insert.mockReset(); maybeSingle.mockReset(); });

  it("genindsætter ikke en allerede bekræftet række", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { id: v.id }, error: null });
    await sendBesked(v, "e");
    expect(insert).not.toHaveBeenCalled();
  });

  it("tabt svar efter commit → afstemning finder rækken, præcis ét INSERT", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({ data: { id: v.id }, error: null });
    insert.mockResolvedValueOnce({ error: { message: "Failed to fetch" } });
    await sendBesked(v, "e");
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).toMatchObject({ id: v.id });
  });

  it("P0001 (fx CPR) vises ordret", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    insert.mockResolvedValueOnce({ error: { code: "P0001", message: "Beskeden indeholder et CPR-nummer" } });
    await expect(sendBesked(v, "e")).rejects.toMatchObject({ art: "server", message: "Beskeden indeholder et CPR-nummer" });
  });

  it("ukendt udfald → art ukendt", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({ data: null, error: { message: "x" } });
    insert.mockResolvedValueOnce({ error: { message: "Failed to fetch" } });
    const e = await sendBesked(v, "e").catch((x) => x);
    expect(e).toBeInstanceOf(SendFejl);
    expect(e.art).toBe("ukendt");
  });

  it("frontend sender ikke status/revision", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    insert.mockResolvedValueOnce({ error: null });
    await sendBesked(v, "e");
    expect(insert.mock.calls[0][0]).not.toHaveProperty("status");
    expect(insert.mock.calls[0][0]).not.toHaveProperty("revision");
  });
});

describe("samtaleregler", () => {
  it("gruppegrænser 1/2/50/51 andre og 80/81 tegn", () => {
    expect(validerSamtale(1, "x", true).ok).toBe(false);
    expect(validerSamtale(2, "x", true).ok).toBe(true);
    expect(validerSamtale(50, "x", true).ok).toBe(true);
    expect(validerSamtale(51, "x", true).ok).toBe(false);
    expect(validerSamtale(2, "a".repeat(80), true).ok).toBe(true);
    expect(validerSamtale(2, "a".repeat(81), true).ok).toBe(false);
    expect(validerSamtale(2, "  ", true).ok).toBe(false);
    expect(validerSamtale(1, undefined, false).ok).toBe(true);
  });
  it("normalisering fjerner egen, inaktive og dubletter", () => {
    expect(normaliserDeltagere(["a", "a", "mig", "inaktiv", "b"], "mig", new Set(["a", "b", "mig"]))).toEqual(["a", "b"]);
  });
  it("nøglebundet direkte samtale kan ikke slettes", () => {
    expect(kanSletteSamtale({ direct_key: "k" })).toBe(false);
    expect(kanSletteSamtale({ direct_key: null })).toBe(true);
  });
  it("serverfejl: P0001 ordret, ellers fast tekst; forældet revision genkendes", () => {
    expect(serverTekst({ code: "P0001", message: "X" }, "fast")).toBe("X");
    expect(serverTekst({ code: "42501", message: "X" }, "fast")).toBe("fast");
    expect(erForaeldet({ code: "P0001", message: "Forældet revision" })).toBe(true);
  });
});
