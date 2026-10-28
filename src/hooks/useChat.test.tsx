import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

// Kø af svar pr. tabel for maybeSingle(); insert har egen kø. Ingen netværk.
const svar: Record<string, Array<{ data: unknown; error: unknown } | Error>> = {};
const insert = vi.fn();
const kald: string[] = [];
function builder(tabel: string) {
  const b = {
    select: () => b,
    eq: () => b,
    insert: (r: unknown) => { kald.push(`insert:${tabel}`); return insert(r); },
    update: () => { kald.push(`update:${tabel}`); return b; },
    delete: () => { kald.push(`delete:${tabel}`); return b; },
    upsert: () => { kald.push(`upsert:${tabel}`); return b; },
    maybeSingle: () => {
      kald.push(`select:${tabel}`);
      const r = svar[tabel]?.shift() ?? { data: null, error: null };
      return r instanceof Error ? Promise.reject(r) : Promise.resolve(r);
    },
  };
  return b;
}
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (t: string) => builder(t),
    rpc: vi.fn(async () => ({ data: "e", error: null })),
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u" } } })), onAuthStateChange: vi.fn() },
    functions: { invoke: vi.fn(async () => ({ error: null })) },
  },
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

import {
  sendBesked, SendFejl, validerSamtale, normaliserDeltagere, kanSletteSamtale, serverTekst, erForaeldet,
  useSendMessage, IKKE_REGISTRERET_TEKST, GEMT_VAEK_TEKST,
} from "./useChat";

const v = { id: "11111111-1111-1111-1111-111111111111", conversationId: "c", content: "hej" };
const vf = { ...v, attachmentPath: "c/e/x.png", attachmentType: "image/png", attachmentName: "x.png" };
const egen = (besked_id: string | null, status = "bundet") => ({ data: { besked_id, status, samtale_id: "c", ejer_employee_id: "e" }, error: null });
const msg = (data: unknown, error: unknown = null) => ({ data, error });
const fejl = (p: Promise<unknown>) => p.then(() => null, (x) => x as SendFejl);

beforeEach(() => {
  insert.mockReset();
  kald.length = 0;
  for (const k of Object.keys(svar)) delete svar[k];
});

describe("sendBesked – stabilt id og afstemning", () => {
  it("genindsætter ikke en allerede bekræftet række", async () => {
    svar.chat_messages = [msg({ id: v.id })];
    await sendBesked(v, "e");
    expect(insert).not.toHaveBeenCalled();
  });

  it("tabt svar efter commit → afstemning finder rækken, præcis ét INSERT", async () => {
    svar.chat_messages = [msg(null), msg({ id: v.id })];
    insert.mockResolvedValueOnce({ error: { message: "Failed to fetch" } });
    await sendBesked(v, "e");
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).toMatchObject({ id: v.id });
  });

  it("P0001 (fx CPR) vises ordret", async () => {
    svar.chat_messages = [msg(null), msg(null)];
    insert.mockResolvedValueOnce({ error: { code: "P0001", message: "Beskeden indeholder et CPR-nummer" } });
    await expect(sendBesked(v, "e")).rejects.toMatchObject({ art: "server", message: "Beskeden indeholder et CPR-nummer" });
  });

  it("ukendt udfald → art ukendt", async () => {
    svar.chat_messages = [msg(null), msg(null, { message: "x" })];
    insert.mockResolvedValueOnce({ error: { message: "Failed to fetch" } });
    const e = await fejl(sendBesked(v, "e"));
    expect(e).toBeInstanceOf(SendFejl);
    expect(e?.art).toBe("ukendt");
  });

  it("frontend sender ikke status/revision", async () => {
    insert.mockResolvedValueOnce({ error: null });
    await sendBesked(v, "e");
    expect(insert.mock.calls[0][0]).not.toHaveProperty("status");
    expect(insert.mock.calls[0][0]).not.toHaveProperty("revision");
  });
});

describe("T2 – afstemning og P0001 ved filbinding (§2)", () => {
  it("fejlet forhåndsopslag giver nul INSERT", async () => {
    svar.chat_messages = [msg(null, { message: "net" })];
    const e = await fejl(sendBesked(v, "e"));
    expect(insert).not.toHaveBeenCalled();
    expect(e?.art).toBe("ukendt");
    expect(e?.indsat).toBe(false);
  });

  it("forhåndsopslag, der kaster, giver nul INSERT", async () => {
    svar.chat_messages = [new Error("abort")];
    const e = await fejl(sendBesked(v, "e"));
    expect(insert).not.toHaveBeenCalled();
    expect(e?.art).toBe("ukendt");
  });

  it("tabt fil-INSERT-svar: række fundet → bekræftet, intet nyt INSERT", async () => {
    svar.chat_messages = [msg(null), msg({ id: v.id })];
    svar.sb_stier = [egen(null, "uploadet")];
    insert.mockRejectedValueOnce(new Error("Failed to fetch"));
    await sendBesked(vf, "e");
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("P0001 før 23505: genbinding afvist, men egen række fundet → bekræftet", async () => {
    svar.chat_messages = [msg(null), msg({ id: v.id })];
    svar.sb_stier = [egen(null, "uploadet")];
    insert.mockResolvedValueOnce({ error: { code: "P0001", message: IKKE_REGISTRERET_TEKST } });
    await expect(sendBesked(vf, "e")).resolves.toBeUndefined();
  });

  it("tomt beskedopslag med eksisterende binding til samme id → gemt, ikke tilgængelig; intet INSERT", async () => {
    svar.chat_messages = [msg(null)];
    svar.sb_stier = [egen(v.id, "slettet")];
    const e = await fejl(sendBesked(vf, "e"));
    expect(insert).not.toHaveBeenCalled();
    expect(e?.art).toBe("gemt_vaek");
    expect(e?.message).toBe(GEMT_VAEK_TEKST);
  });

  it("P0001 og binding til samme id efter INSERT → gemt_vaek", async () => {
    svar.chat_messages = [msg(null), msg(null)];
    svar.sb_stier = [egen(null, "uploadet"), egen(v.id, "slettes")];
    insert.mockResolvedValueOnce({ error: { code: "P0001", message: IKKE_REGISTRERET_TEKST } });
    expect((await fejl(sendBesked(vf, "e")))?.art).toBe("gemt_vaek");
  });

  it("registerfejl efter »ikke registreret« → uafklaret (ingen genudstedelse)", async () => {
    svar.chat_messages = [msg(null), msg(null)];
    svar.sb_stier = [egen(null, "uploadet"), msg(null, { message: "rls" })];
    insert.mockResolvedValueOnce({ error: { code: "P0001", message: IKKE_REGISTRERET_TEKST } });
    expect((await fejl(sendBesked(vf, "e")))?.art).toBe("ukendt");
  });

  it("udløb/mistet medlemskab: tomt opslag + 23505 → uafklaret, ikke Ret", async () => {
    svar.chat_messages = [msg(null), msg(null)];
    insert.mockResolvedValueOnce({ error: { code: "23505", message: "duplicate" } });
    const e = await fejl(sendBesked(v, "e"));
    expect(e?.art).toBe("ukendt");
    expect(e?.indsat).toBe(true);
  });

  it("afvisning efter tidligere ukendt udfald er ikke bevis → uafklaret", async () => {
    svar.chat_messages = [msg(null), msg(null)];
    insert.mockResolvedValueOnce({ error: { code: "P0001", message: "Beskeden indeholder et CPR-nummer" } });
    expect((await fejl(sendBesked({ ...v, tidligereUkendt: true }, "e")))?.art).toBe("ukendt");
  });

  it("samme id ved genforsøg (ingen ny UUID, ingen upsert)", async () => {
    svar.chat_messages = [msg(null), msg(null), msg(null), msg({ id: v.id })];
    insert.mockResolvedValueOnce({ error: { message: "Failed to fetch" } }).mockResolvedValueOnce({ error: { code: "23505" } });
    await fejl(sendBesked(v, "e"));
    await sendBesked({ ...v, tidligereUkendt: true }, "e");
    expect(insert.mock.calls.map((c) => (c[0] as { id: string }).id)).toEqual([v.id, v.id]);
    expect(kald.some((k) => k.startsWith("upsert"))).toBe(false);
  });

  it("useSendMessage har retry 0 trods mutations.retry=1", async () => {
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: 1, retryDelay: 0 } } });
    const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
    const { result } = renderHook(() => useSendMessage(), { wrapper });
    svar.chat_messages = [msg(null), msg(null, { message: "x" })];
    insert.mockResolvedValue({ error: { message: "Failed to fetch" } });
    await fejl(result.current.mutateAsync(v));
    expect(insert).toHaveBeenCalledTimes(1);
  });
});

describe("T10 – genudstedelse kun ved dokumenteret ubundet overtaget sti (§10)", () => {
  it("ubundet sti overtaget til slettes → genudsted", async () => {
    svar.chat_messages = [msg(null), msg(null)];
    svar.sb_stier = [egen(null, "uploadet"), egen(null, "slettes")];
    insert.mockResolvedValueOnce({ error: { code: "P0001", message: IKKE_REGISTRERET_TEKST } });
    expect((await fejl(sendBesked(vf, "e")))?.art).toBe("genudsted");
  });

  it("bundet til andet id → ingen genudstedelse (ordret afvisning)", async () => {
    svar.chat_messages = [msg(null), msg(null)];
    svar.sb_stier = [egen("andet", "bundet"), egen("andet", "bundet")];
    insert.mockResolvedValueOnce({ error: { code: "P0001", message: IKKE_REGISTRERET_TEKST } });
    expect((await fejl(sendBesked(vf, "e")))?.art).toBe("server");
  });

  it("fremmed ejer/samtale tæller som ukendt register", async () => {
    svar.chat_messages = [msg(null), msg(null)];
    svar.sb_stier = [egen(null), { data: { besked_id: null, status: "slettes", samtale_id: "anden", ejer_employee_id: "e" }, error: null }];
    insert.mockResolvedValueOnce({ error: { code: "P0001", message: IKKE_REGISTRERET_TEKST } });
    expect((await fejl(sendBesked(vf, "e")))?.art).toBe("ukendt");
  });

  it("CPR-P0001 med fil giver ikke genudstedelse", async () => {
    svar.chat_messages = [msg(null), msg(null)];
    svar.sb_stier = [egen(null, "uploadet"), egen(null, "slettes")];
    insert.mockResolvedValueOnce({ error: { code: "P0001", message: "Filen indeholder et CPR-nummer" } });
    const e = await fejl(sendBesked(vf, "e"));
    expect(e?.art).toBe("server");
    expect(e?.message).toBe("Filen indeholder et CPR-nummer");
  });

  it("klienten skriver aldrig til sb_stier", async () => {
    svar.chat_messages = [msg(null), msg(null)];
    svar.sb_stier = [egen(null, "uploadet"), egen(null, "slettes")];
    insert.mockResolvedValueOnce({ error: { code: "P0001", message: IKKE_REGISTRERET_TEKST } });
    await fejl(sendBesked(vf, "e"));
    expect(kald.filter((k) => k.endsWith(":sb_stier") && !k.startsWith("select"))).toEqual([]);
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
