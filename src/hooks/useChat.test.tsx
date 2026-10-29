import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fastholdEjer, rydAlleKladder, registrerKladdeOprydning, sessionsGeneration } from "@/lib/sbKladder";
import { saetModelPort, tjekPortAaben } from "@/hooks/useSbDrift";

/** c3 §7: rigtige auth-callbacks (registreret én gang i modulet). */
/** B2b-4b §3: typesikker læsning af et felt i et mock-argument (ingen cast). */
const arg = (o: unknown, ...sti: string[]): unknown => sti.reduce<unknown>((x, k) => (typeof x === "object" && x !== null ? Reflect.get(x, k) : undefined), o);
const auth = (e: string, bruger: string | null) => {
  registrerKladdeOprydning();
  const cb = vi.mocked(supabase.auth.onAuthStateChange).mock.calls[0][0] as (e: string, s: unknown) => void;
  cb(e, bruger ? { user: { id: bruger } } : null);
};

// Kø af svar pr. tabel for maybeSingle(); insert har egen kø. Ingen netværk.
const svar: Record<string, Array<{ data: unknown; error: unknown } | Error | Promise<{ data: unknown; error: unknown }>>> = {};
const insert = vi.fn();
const kald: string[] = [];
/** c3 §8: valgfri dynamisk svarfunktion pr. tabel (fælles netværksmodel); filtre fra .eq(). */
const dyn: Record<string, ((f: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>) | undefined> = {};
const dynInsert: { fn?: (tabel: string, r: unknown) => Promise<{ error: unknown }> } = {};
function builder(tabel: string) {
  const filtre: Record<string, unknown> = {};
  const b = {
    select: () => b,
    eq: (k: string, v: unknown) => { filtre[k] = v; return b; },
    insert: (r: unknown) => { kald.push(`insert:${tabel}`); return dynInsert.fn ? dynInsert.fn(tabel, r) : insert(r); },
    update: () => { kald.push(`update:${tabel}`); return b; },
    delete: () => { kald.push(`delete:${tabel}`); return b; },
    upsert: () => { kald.push(`upsert:${tabel}`); return b; },
    maybeSingle: () => {
      kald.push(`select:${tabel}`);
      if (dyn[tabel]) return dyn[tabel]!(filtre);
      const r = svar[tabel]?.shift() ?? { data: null, error: null };
      return r instanceof Error ? Promise.reject(r) : r instanceof Promise ? r : Promise.resolve(r);
    },
  };
  return b;
}
// B2b-3b §3: typede grænsemocks (ingen typeomgåelse ved rpc/invoke/from).

const graense = vi.hoisted(() => ({
  rpc: vi.fn<(...a: unknown[]) => PromiseLike<unknown>>(async () => ({ data: "e", error: null })),
  invoke: vi.fn<(...a: unknown[]) => Promise<unknown>>(async () => ({ error: null })),
  from: vi.fn<(t: string) => unknown>(),
  session: vi.fn<() => Promise<unknown>>(async () => ({ data: { session: { access_token: "jwt-u", user: { id: "u" } } }, error: null })),
  upload: vi.fn<(...a: unknown[]) => Promise<{ error: unknown }>>(async () => ({ error: null })),
  // B2c-2b-2 §7: presence-kanaler ved grænsen (kun tællere, intet netværk).
  kanaler: [] as Array<{ navn: string; track: ReturnType<typeof vi.fn>; fjernet: boolean }>,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (t: string) => (graense.from.getMockImplementation() ? graense.from(t) : builder(t)),
    rpc: graense.rpc,
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u" } } })), onAuthStateChange: vi.fn(),
      getSession: graense.session },
    functions: { invoke: graense.invoke },
    storage: { from: () => ({ uploadToSignedUrl: graense.upload }) },
    channel: (navn: string) => {
      const k = { navn, track: vi.fn(async () => "ok"), fjernet: false };
      graense.kanaler.push(k);
      const ch = { on: () => ch, subscribe: () => ch, presenceState: () => ({}), track: k.track, k };
      return ch;
    },
    removeChannel: (ch: { k: { fjernet: boolean } }) => { ch.k.fjernet = true; return Promise.resolve("ok"); },
  },
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

import {
  sendBesked, SendFejl, validerSamtale, normaliserDeltagere, kanSletteSamtale, serverTekst, erForaeldet,
  useSendMessage, IKKE_REGISTRERET_TEKST, GEMT_VAEK_TEKST,
} from "./useChat";

const v = { id: "11111111-1111-1111-1111-111111111111", conversationId: "c", content: "hej" };
const vf = { ...v, attachmentPath: "c/e/x.png", attachmentType: "image/png", attachmentName: "x.png" };
// Antagelse (ikke SQL-bevis): sb_stier-rækken som 24d-vaern.sql v4 beskriver den, set gennem eksisterende RLS.
const række = (o: Record<string, unknown> = {}) => ({ data: { bucket: "chat-attachments", sti: "c/e/x.png", besked_id: null, status: "uploadet", samtale_id: "c", ejer_employee_id: "e", ...o }, error: null });
const egen = (besked_id: string | null, status = "bundet") => række({ besked_id, status });
const msg = (data: unknown, error: unknown = null) => ({ data, error });
const fejl = (p: Promise<unknown>) => p.then(() => null, (x) => x as SendFejl);

beforeEach(() => {
  for (let g = 0; g <= sessionsGeneration() + 5; g++) saetModelPort("u", g, true); // 24d2: kendt tjek_tilladt=true

  insert.mockReset();
  kald.length = 0;
  for (const k of Object.keys(svar)) delete svar[k];
  for (const k of Object.keys(dyn)) delete dyn[k];
  dynInsert.fn = undefined;
  graense.invoke.mockClear();
  auth("SIGNED_IN", "u"); // fast udgangspunkt: aktiv auth-bruger "u" (uafhængigt af prøverækkefølge)
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
    await fejl(result.current.mutateAsync({ ...v, ejer: fastholdEjer("e", "c", "u")! }));
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

  it("bundet til andet id → stop før INSERT (ingen succes, INSERT eller genudstedelse)", async () => {
    svar.chat_messages = [msg(null)];
    svar.sb_stier = [egen("andet", "bundet")];
    const e = await fejl(sendBesked(vf, "e"));
    expect(e?.art).toBe("stop");
    expect(insert).not.toHaveBeenCalled();
  });

  it("fremmed ejer/samtale tæller som ukendt register", async () => {
    svar.chat_messages = [msg(null), msg(null)];
    svar.sb_stier = [egen(null), række({ status: "slettes", samtale_id: "anden" })];
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

describe("§1 – gammelt forløb sender aldrig som den nye session (B2a-b1)", () => {
  const kontrol = <T,>() => { let res!: (v: T) => void; const p = new Promise<T>((a) => { res = a; }); return { p, res }; };
  const opsaet = () => {
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: 1, retryDelay: 0 } } });
    const inv = vi.spyOn(qc, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
    return { inv, ...renderHook(() => useSendMessage(), { wrapper }) };
  };
  beforeEach(() => { graense.rpc.mockClear(); });

  it("fastholdt ejer: ingen identitetsopslag undervejs, sender_id er den fastholdte", async () => {
    const { result } = opsaet();
    insert.mockResolvedValueOnce({ error: null });
    await result.current.mutateAsync({ ...v, ejer: fastholdEjer("fast", "c", "u")! });
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(insert.mock.calls[0][0]).toMatchObject({ sender_id: "fast" });
  });

  it("logud under forhåndsopslag → nul INSERT og ingen cacheændring", async () => {
    const { result, inv } = opsaet();
    const foer = kontrol<{ data: unknown; error: unknown }>();
    svar.chat_messages = [foer.p];
    auth("SIGNED_IN", "u");
    const p = fejl(result.current.mutateAsync({ ...v, ejer: fastholdEjer("e", "c", "u")! }));
    await vi.waitFor(() => expect(kald).toContain("select:chat_messages")); // forhåndsopslaget er startet
    auth("SIGNED_OUT", null); // faktisk logud
    foer.res(msg(null));
    expect((await p)?.indsat).toBe(false);
    expect(insert).not.toHaveBeenCalled();
    expect(inv).not.toHaveBeenCalled();
  });

  it("logud og genlogin som SAMME bruger under forhåndsopslag → nul INSERT", async () => {
    const { result } = opsaet();
    const foer = kontrol<{ data: unknown; error: unknown }>();
    svar.chat_messages = [foer.p];
    auth("SIGNED_IN", "u");
    const p = fejl(result.current.mutateAsync({ ...v, ejer: fastholdEjer("e", "c", "u")! }));
    await vi.waitFor(() => expect(kald).toContain("select:chat_messages")); // forhåndsopslaget er startet
    auth("SIGNED_OUT", null); auth("SIGNED_IN", "u"); // genlogin som samme bruger giver ikke den gamle generation tilbage
    foer.res(msg(null));
    await p;
    expect(insert).not.toHaveBeenCalled();
  });

  it("skift under igangværende INSERT → ét INSERT, ingen efterfølgende afstemning, ingen cacheændring", async () => {
    const { result, inv } = opsaet();
    const ins = kontrol<{ error: unknown }>();
    insert.mockReturnValueOnce(ins.p);
    const p = fejl(result.current.mutateAsync({ ...v, ejer: fastholdEjer("e", "c", "u")! }));
    await vi.waitFor(() => expect(insert).toHaveBeenCalledTimes(1));
    const foerAntal = kald.length;
    rydAlleKladder();
    ins.res({ error: { message: "Failed to fetch" } });
    await p;
    expect(insert).toHaveBeenCalledTimes(1);
    expect(kald.slice(foerAntal)).toEqual([]);
    expect(inv).not.toHaveBeenCalled();
  });

  it("vellykket INSERT med sent svar efter logud → onSuccess skriver ikke til cachen", async () => {
    const { result, inv } = opsaet();
    const ins = kontrol<{ error: unknown }>();
    insert.mockReturnValueOnce(ins.p);
    const p = result.current.mutateAsync({ ...v, ejer: fastholdEjer("e", "c", "u")! });
    await vi.waitFor(() => expect(insert).toHaveBeenCalledTimes(1));
    rydAlleKladder();
    ins.res({ error: null });
    await p;
    expect(inv).not.toHaveBeenCalled();
  });
});

describe("§2/§8 – registerafstemning og genudstedelse gennem rigtig useSendMessage (B2a-b2)", () => {
  // Rigtige send-/afstemningsfunktioner; kun supabase-klienten er mocket. Én stabil QueryClient, mutations.retry=1.
  const opsaet = () => {
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: 1, retryDelay: 0 } } });
    const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
    const { result } = renderHook(() => useSendMessage(), { wrapper });
    return (x: Omit<Parameters<typeof result.current.mutateAsync>[0], "ejer">) => fejl(result.current.mutateAsync({ ...x, ejer: fastholdEjer("e", "c", "u")! }));
  };
  const vu = { ...vf, replyToId: "svar-1", tidligereUkendt: true };
  const P = (message: string) => ({ error: { code: "P0001", message } });

  it("registerfejl efter fejlfrit tomt beskedopslag → uafklaret, intet INSERT", async () => {
    const send = opsaet();
    svar.chat_messages = [msg(null)];
    svar.sb_stier = [msg(null, { message: "rls" })];
    const e = await send(vu);
    expect(e?.art).toBe("ukendt");
    expect(insert).not.toHaveBeenCalled();
  });

  it("RLS-usynlig tekstbesked efter tidligere ukendt forsøg → uafklaret (ingen Ret)", async () => {
    const send = opsaet();
    svar.chat_messages = [msg(null), msg(null)];
    insert.mockResolvedValueOnce({ error: { code: "23505", message: "duplicate" } });
    expect((await send({ ...v, tidligereUkendt: true }))?.art).toBe("ukendt");
    svar.chat_messages = [msg(null), msg(null)];
    insert.mockResolvedValueOnce(P("Beskeden indeholder et CPR-nummer"));
    expect((await send({ ...v, tidligereUkendt: true }))?.art).toBe("ukendt");
  });

  it("tilladt brugertryk: fejlfri opslag + egen ubundet uploadet sti → samme id/tekst/svar/sti; tidligereUkendt bevares", async () => {
    const send = opsaet();
    svar.chat_messages = [msg(null)];
    svar.sb_stier = [række()];
    insert.mockResolvedValueOnce({ error: null });
    const input = { ...vu };
    expect(await send(input)).toBeNull();
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).toMatchObject({ id: v.id, content: "hej", reply_to_id: "svar-1", attachment_path: "c/e/x.png" });
    expect(input.tidligereUkendt).toBe(true);
  });

  it("manglende eller minimeret registerrække → uafklaret, intet INSERT", async () => {
    const send = opsaet();
    svar.chat_messages = [msg(null), msg(null)];
    svar.sb_stier = [msg(null), msg({ besked_id: null })];
    expect((await send(vu))?.art).toBe("ukendt");
    expect((await send(vu))?.art).toBe("ukendt");
    expect(insert).not.toHaveBeenCalled();
  });

  it("forkert ejer eller samtale → uafklaret, intet INSERT", async () => {
    const send = opsaet();
    svar.chat_messages = [msg(null), msg(null)];
    svar.sb_stier = [række({ ejer_employee_id: "anden" }), række({ samtale_id: "anden" })];
    expect((await send(vf))?.art).toBe("ukendt");
    expect((await send(vf))?.art).toBe("ukendt");
    expect(insert).not.toHaveBeenCalled();
  });

  it("ukendt/inkonsistent status (fx udstedt) → uafklaret, intet INSERT", async () => {
    const send = opsaet();
    svar.chat_messages = [msg(null)];
    svar.sb_stier = [række({ status: "udstedt" })];
    expect((await send(vf))?.art).toBe("ukendt");
    expect(insert).not.toHaveBeenCalled();
  });

  it("binding til samme id → bevist tidligere gemning (gemt_vaek), intet INSERT", async () => {
    const send = opsaet();
    svar.chat_messages = [msg(null)];
    svar.sb_stier = [række({ besked_id: v.id, status: "bundet" })];
    expect((await send(vu))?.art).toBe("gemt_vaek");
    expect(insert).not.toHaveBeenCalled();
  });

  it("binding til andet id → stop: hverken succes, INSERT eller genudstedelse (også efter INSERT)", async () => {
    const send = opsaet();
    svar.chat_messages = [msg(null)];
    svar.sb_stier = [række({ besked_id: "andet", status: "bundet" })];
    expect((await send(vu))?.art).toBe("stop");
    expect(insert).not.toHaveBeenCalled();
    svar.chat_messages = [msg(null), msg(null)];
    svar.sb_stier = [række(), række({ besked_id: "andet", status: "bundet" })];
    insert.mockResolvedValueOnce(P(IKKE_REGISTRERET_TEKST));
    expect((await send(vf))?.art).toBe("stop");
  });

  it("§8: begge overtagelsesstatusser (slettes/slettet) + præcis filbindings-P0001 efter tidligere ukendt → genudsted", async () => {
    const send = opsaet();
    for (const status of ["slettes", "slettet"]) {
      svar.chat_messages = [msg(null), msg(null)];
      svar.sb_stier = [række(), række({ status })];
      insert.mockResolvedValueOnce(P(IKKE_REGISTRERET_TEKST));
      expect((await send(vu))?.art).toBe("genudsted");
    }
  });

  it("§8: CPR- eller generel P0001 med overtaget sti åbner ikke genudstedelse", async () => {
    const send = opsaet();
    for (const tekst of ["Filen indeholder et CPR-nummer", "Beskeden blev afvist"]) {
      for (const tu of [false, true]) {
        svar.chat_messages = [msg(null), msg(null)];
        svar.sb_stier = [række(), række({ status: "slettet" })];
        insert.mockResolvedValueOnce(P(tekst));
        expect((await send({ ...vf, tidligereUkendt: tu }))?.art).toBe(tu ? "ukendt" : "server");
      }
    }
  });

  it("§8: registerfejl efter præcis filbindings-P0001 → uafklaret", async () => {
    const send = opsaet();
    svar.chat_messages = [msg(null), msg(null)];
    svar.sb_stier = [række(), msg(null, { message: "net" })];
    insert.mockResolvedValueOnce(P(IKKE_REGISTRERET_TEKST));
    expect((await send(vu))?.art).toBe("ukendt");
  });

  it("bevis fra en anden sti frigiver ikke forsøget", async () => {
    const send = opsaet();
    svar.chat_messages = [msg(null), msg(null), msg(null)];
    svar.sb_stier = [række({ sti: "c/e/andet.png", besked_id: v.id, status: "bundet" }), række({ sti: "c/e/andet.png" }), række({ bucket: "andet" })];
    expect((await send(vu))?.art).toBe("ukendt");
    expect((await send(vu))?.art).toBe("ukendt");
    expect((await send(vu))?.art).toBe("ukendt");
    expect(insert).not.toHaveBeenCalled();
  });

  it("(rettet i b4, §8 A) overtaget sti i forhåndsopslaget → intet INSERT, men genudstedelse tilbydes", async () => {
    const send = opsaet();
    for (const status of ["slettes", "slettet"]) {
      svar.chat_messages = [msg(null)];
      svar.sb_stier = [række({ status })];
      const e = await send(vu);
      expect(e?.art).toBe("genudsted");
      expect(e?.indsat).toBe(false);
    }
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("§8 A og b1-hensyn (ii)/(iv) (B2a-b4)", () => {
  const kontrol = <T,>() => { let res!: (v: T) => void; const p = new Promise<T>((a) => { res = a; }); return { p, res }; };
  const opsaet = () => {
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: 1, retryDelay: 0 } } });
    const inv = vi.spyOn(qc, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
    return { inv, ...renderHook(() => useSendMessage(), { wrapper }) };
  };
  const vu = { ...vf, tidligereUkendt: true };

  it("§8 A betingelse 1: fejlet beskedopslag + overtaget register → uafklaret, ikke genudsted", async () => {
    const { result } = opsaet();
    svar.chat_messages = [msg(null, { message: "net" })];
    svar.sb_stier = [række({ status: "slettet" })];
    expect((await fejl(result.current.mutateAsync({ ...vu, ejer: fastholdEjer("e", "c", "u")! })))?.art).toBe("ukendt");
    expect(insert).not.toHaveBeenCalled();
  });

  it("§8 A betingelse 2: registerfejl, minimeret række, forkert ejer/samtale, anden sti/bucket, ukendt status → uafklaret", async () => {
    const { result } = opsaet();
    const cases = [msg(null, { message: "rls" }), msg({ besked_id: null, status: "slettet" }), række({ status: "slettet", ejer_employee_id: "x" }),
      række({ status: "slettet", samtale_id: "x" }), række({ status: "slettet", sti: "c/e/andet.png" }), række({ status: "slettet", bucket: "x" }), række({ status: "mystisk" })];
    for (const c of cases) {
      svar.chat_messages = [msg(null)];
      svar.sb_stier = [c];
      expect((await fejl(result.current.mutateAsync({ ...vu, ejer: fastholdEjer("e", "c", "u")! })))?.art).toBe("ukendt");
    }
    expect(insert).not.toHaveBeenCalled();
  });

  it("§8 A: automatisk afstemning (afstemKun) giver kun tilbuddet – ingen skrivende kald", async () => {
    const { afstemKun } = await import("./useChat");
    svar.chat_messages = [msg(null)];
    svar.sb_stier = [række({ status: "slettes" })];
    expect(await afstemKun({ id: v.id, conversationId: "c", attachmentPath: "c/e/x.png", ejer: fastholdEjer("e", "c", "u")! })).toBe("genudsted");
    expect(kald.filter((k) => !k.startsWith("select"))).toEqual([]);
  });

  it("(c1 §1) manglende identitet: fastholdEjer giver null og ingen ejer starter ingen skrivning", async () => {
    auth("SIGNED_OUT", null); // ingen aktiv auth-bruger at falde tilbage på (uafhængigt af prøverækkefølge)
    expect(fastholdEjer("e", "c", null)).toBeNull();
    expect(fastholdEjer(undefined, "c", "u")).toBeNull();
    expect(fastholdEjer("e", "", "u")).toBeNull();
    const { result } = opsaet();
    const e = await fejl(result.current.mutateAsync({ ...v, ejer: undefined as never }));
    expect(e?.art).toBe("ukendt");
    expect(kald).toEqual([]);
    expect(insert).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
    auth("SIGNED_IN", "u");
  });

  it("(c1 §1) forkert samtale i konteksten → ingen opslag, intet INSERT", async () => {
    const { result } = opsaet();
    const e = await fejl(result.current.mutateAsync({ ...v, ejer: fastholdEjer("e", "anden", "u")! }));
    expect(e?.art).toBe("ukendt");
    expect(kald).toEqual([]);
    expect(insert).not.toHaveBeenCalled();
  });

  it("(c1 §1) afstemKun uden kontekst eller med forkert samtale → ukendt, ingen opslag", async () => {
    const { afstemKun } = await import("./useChat");
    expect(await afstemKun({ id: v.id, conversationId: "c", ejer: undefined as never })).toBe("ukendt");
    expect(await afstemKun({ id: v.id, conversationId: "c", ejer: fastholdEjer("e", "anden", "u")! })).toBe("ukendt");
    expect(kald).toEqual([]);
  });

  it("(c1 §1) konteksten fastholdes før mutate: logud mellem brugerhandling og mutationens start → nul skrivning", async () => {
    const { result } = opsaet();
    const ejer = fastholdEjer("e", "c", "u")!; // brugerhandlingen
    rydAlleKladder(); // logud før mutate
    const e = await fejl(result.current.mutateAsync({ ...v, ejer }));
    expect(e?.art).toBe("ukendt");
    expect(kald).toEqual([]);
    expect(insert).not.toHaveBeenCalled();
  });

  it("(iv) efterbehandling: logud under statusopslag → intet tjek-kald og ingen cacheændring derefter", async () => {
    const { result, inv } = opsaet();
    const status = kontrol<{ data: unknown; error: null }>();
    svar.chat_messages = [msg(null), status.p];
    insert.mockResolvedValueOnce({ error: null });
    await result.current.mutateAsync({ ...v, ejer: fastholdEjer("e", "c", "u")! });
    await vi.waitFor(() => expect(kald.filter((k) => k === "select:chat_messages")).toHaveLength(2));
    const foer = inv.mock.calls.length;
    rydAlleKladder();
    status.res({ data: { status: "tjekkes", revision: 1 }, error: null });
    await new Promise((x) => setTimeout(x, 0));
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
    expect(inv.mock.calls.length).toBe(foer);
  });
});

describe("c3 §7 – logud under tjek-genforsøgets ventetid", () => {
  it("transportfejl → 2 s ventetid → faktisk logud → intet nyt tjek-kald, ingen cacheeffekt", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      auth("SIGNED_IN", "u");
      const qc = new QueryClient({ defaultOptions: { mutations: { retry: 1, retryDelay: 0 } } });
      const inv = vi.spyOn(qc, "invalidateQueries");
      const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
      const { result, unmount } = renderHook(() => useSendMessage(), { wrapper });
      svar.chat_messages = [msg(null), msg({ status: "tjekkes", revision: 1 })];
      insert.mockResolvedValueOnce({ error: null });
      graense.invoke.mockClear();
      graense.invoke.mockResolvedValueOnce({ error: { name: "FunctionsFetchError" } });
      await result.current.mutateAsync({ ...v, ejer: fastholdEjer("e", "c", "u")! });
      await vi.advanceTimersByTimeAsync(0);
      expect(supabase.functions.invoke).toHaveBeenCalledTimes(1); // første tjek er sendt; ventetiden løber
      const foer = inv.mock.calls.length;
      auth("SIGNED_OUT", null);
      await vi.advanceTimersByTimeAsync(2500);
      expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
      expect(inv.mock.calls.length).toBe(foer);
      auth("SIGNED_IN", "u");
      unmount(); qc.clear();
    } finally { vi.useRealTimers(); }
  });
});

describe("c3 §8 – to isolerede klientforløb med samme id mod fælles netværksmodel (antagelse, ikke SQL)", () => {
  it("atomisk binding + primærnøglekonflikt: én række, én binding; taberen rapporteres som allerede gemt, ikke ny besked", async () => {
    auth("SIGNED_IN", "u");
    // Fælles model: rækker og stibindinger; INSERT er atomisk (binding sker kun ved vellykket INSERT).
    const rækker = new Map<string, Record<string, unknown>>();
    const bindinger = new Map<string, string>();
    const forsinket: Array<() => void> = [];
    let holdFoerste = true;
    dyn.chat_messages = async (f) => ({ data: rækker.has(String(f.id)) ? { id: f.id, status: "leveret", revision: 1 } : null, error: null });
    dyn.sb_stier = async () => ({ data: { bucket: "chat-attachments", sti: "c/e/x.png", besked_id: bindinger.get("c/e/x.png") ?? null, status: bindinger.has("c/e/x.png") ? "bundet" : "uploadet", samtale_id: "c", ejer_employee_id: "e" }, error: null });
    dynInsert.fn = (_t, r) => {
      const row = r as { id: string; attachment_path: string | null };
      const udfoer = () => {
        if (rækker.has(row.id)) return { error: { code: "23505", message: "duplicate key" } };
        rækker.set(row.id, row);
        if (row.attachment_path) bindinger.set(row.attachment_path, row.id);
        return { error: null };
      };
      if (holdFoerste) { holdFoerste = false; return new Promise((res) => forsinket.push(() => res(udfoer()))); }
      return Promise.resolve(udfoer());
    };
    const lav = () => {
      const qc = new QueryClient({ defaultOptions: { mutations: { retry: 1, retryDelay: 0 } } });
      const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
      return { qc, ...renderHook(() => useSendMessage(), { wrapper }) };
    };
    const fane1 = lav(), fane2 = lav();
    const p1 = fane1.result.current.mutateAsync({ ...vf, ejer: fastholdEjer("e", "c", "u")! });
    await vi.waitFor(() => expect(forsinket).toHaveLength(1)); // fane 1's INSERT er sendt og venter (sent gammelt INSERT)
    await fane2.result.current.mutateAsync({ ...vf, ejer: fastholdEjer("e", "c", "u")! }); // fane 2 vinder
    forsinket[0](); // fane 1's sene INSERT taber på primærnøglen
    await p1; // afstemt som allerede gemt (samme id), ikke en ny række
    expect(rækker.size).toBe(1);
    expect([...bindinger.entries()]).toEqual([["c/e/x.png", vf.id]]);
    fane1.unmount(); fane2.unmount(); fane1.qc.clear(); fane2.qc.clear();
  });
});

/**
 * d2 §5 – fælles netværksmodel. ANTAGELSER (ikke SQL-bevis; SQL er ikke kørt): sb_stier-rækken pr. (bucket, sti) med
 * ejer/samtale/status/besked_id; INSERT i chat_messages er atomisk: primærnøglekonflikt (23505) og filbindingsfejl
 * (P0001 IKKE_REGISTRERET_TEKST, når stien ikke er egen, ubundet og 'uploadet') tilbagefører hele transaktionen.
 * Oprydning overtager kun en ubundet 'uploadet' sti (→ 'slettes'); en sti i 'slettes'/'slettet' kan aldrig bindes igen.
 */
function lavModel(bindFoerPk = false) {
  type Sti = { bucket: string; sti: string; ejer_employee_id: string; samtale_id: string; status: string; besked_id: string | null };
  const stier = new Map<string, Sti>();
  const rækker = new Map<string, { id: string; attachment_path: string | null }>();
  const holdte: Array<() => void> = [];
  /** B2b-4b: observeret rækkefølge af binding, PK-kontrol og tilbageførsel (model = antagelse, ikke SQL). */
  const log: string[] = [];
  let hold = 0;
  const nySti = (sti: string, status = "uploadet") => stier.set(sti, { bucket: "chat-attachments", sti, ejer_employee_id: "e", samtale_id: "c", status, besked_id: null });
  const oprydning = (sti: string) => { const s = stier.get(sti); if (s && s.besked_id === null && s.status === "uploadet") s.status = "slettes"; };
  const udfoer = (row: { id: string; conversation_id: string; sender_id: string; attachment_path: string | null }) => {
    if (!bindFoerPk && rækker.has(row.id)) { log.push(`pk:${row.id}`); return { error: { code: "23505", message: "duplicate key" } }; } // tilbageført, ingen binding
    if (row.attachment_path) {
      const s = stier.get(row.attachment_path);
      if (!s || s.besked_id !== null || s.status !== "uploadet" || s.ejer_employee_id !== row.sender_id || s.samtale_id !== row.conversation_id)
        return { error: { code: "P0001", message: IKKE_REGISTRERET_TEKST } }; // tilbageført
      s.besked_id = row.id; s.status = "bundet"; log.push(`bind:${row.attachment_path}`);
      // B2b-3b §3: bindingen udføres før primærnøglekonflikten; konflikten tilbagefører taberens binding.
      if (bindFoerPk && rækker.has(row.id)) { log.push(`pk:${row.id}`); s.besked_id = null; s.status = "uploadet"; log.push(`rollback:${row.attachment_path}`); return { error: { code: "23505", message: "duplicate key" } }; }
    }
    if (bindFoerPk && rækker.has(row.id)) return { error: { code: "23505", message: "duplicate key" } };
    rækker.set(row.id, { id: row.id, attachment_path: row.attachment_path });
    return { error: null };
  };
  dyn.chat_messages = async (f) => ({ data: rækker.has(String(f.id)) ? { id: f.id, status: "leveret", revision: 1 } : null, error: null });
  dyn.sb_stier = async (f) => { const s = stier.get(String(f.sti)); return { data: s && s.bucket === f.bucket ? { ...s } : null, error: null }; };
  dynInsert.fn = (_t, r) => {
    const row = r as Parameters<typeof udfoer>[0];
    if (hold > 0) { hold--; return new Promise((res) => holdte.push(() => res(udfoer(row)))); }
    return Promise.resolve(udfoer(row));
  };
  return { stier, rækker, holdte, log, nySti, oprydning, holdNaeste: () => { hold++; } };
}

describe("d2 §5 – sent gammelt INSERT og to klienter mod fælles netværksmodel (antagelse, ikke SQL)", () => {
  const vA = { ...vf, attachmentPath: "c/e/gammel.png" };

  it("binding/INSERT vinder før oprydning → én række, stien bundet; oprydning overtager ikke", async () => {
    const m = lavModel(); m.nySti("c/e/gammel.png");
    m.holdNaeste();
    const p = sendBesked(vA, "e");
    await vi.waitFor(() => expect(m.holdte).toHaveLength(1));
    m.holdte[0]();
    await p;
    m.oprydning("c/e/gammel.png");
    expect(m.rækker.size).toBe(1);
    expect(m.stier.get("c/e/gammel.png")).toMatchObject({ besked_id: vA.id, status: "bundet" });
  });

  for (const status of ["slettes", "slettet"]) it(`oprydning overtager (${status}) før gammelt INSERT → tilbageført, genudsted-tilbud, stien kan ikke bindes igen`, async () => {
    const m = lavModel(); m.nySti("c/e/gammel.png");
    m.holdNaeste();
    const p = fejl(sendBesked(vA, "e"));
    await vi.waitFor(() => expect(m.holdte).toHaveLength(1)); // det gamle INSERT er sendt og venter
    m.oprydning("c/e/gammel.png");
    m.stier.get("c/e/gammel.png")!.status = status;
    m.holdte[0]();
    const e = await p;
    expect(e).toBeInstanceOf(SendFejl);
    expect(e?.art).toBe("genudsted"); // præcis filbindings-P0001 + overtaget egen sti
    expect(m.rækker.size).toBe(0);
    expect(m.stier.get("c/e/gammel.png")).toMatchObject({ besked_id: null, status });
    const igen = await fejl(sendBesked(vA, "e")); // nyt forsøg på samme sti
    expect(igen?.art).toBe("genudsted");
    expect(m.rækker.size).toBe(0);
    expect(m.stier.get("c/e/gammel.png")?.besked_id).toBeNull();
  });

  it("to isolerede klienter, samme id, hver sin nye sti → begge afslutter, én række, taberens sti ubundet, ingen ekstra besked", async () => {
    auth("SIGNED_IN", "u");
    const m = lavModel(); m.nySti("c/e/b.png"); m.nySti("c/e/c.png");
    const lav = () => {
      const qc = new QueryClient({ defaultOptions: { mutations: { retry: 1, retryDelay: 0 } } });
      const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
      return { qc, ...renderHook(() => useSendMessage(), { wrapper }) };
    };
    const k1 = lav(), k2 = lav();
    m.holdNaeste();
    const p1 = k1.result.current.mutateAsync({ ...vf, attachmentPath: "c/e/b.png", ejer: fastholdEjer("e", "c", "u")! });
    await vi.waitFor(() => expect(m.holdte).toHaveLength(1));
    await k2.result.current.mutateAsync({ ...vf, attachmentPath: "c/e/c.png", ejer: fastholdEjer("e", "c", "u")! });
    m.holdte[0](); // klient 1's INSERT taber på primærnøglen og tilbageføres
    await p1; // afstemt: samme id findes → ingen ny besked, ingen fejl
    expect(m.rækker.size).toBe(1);
    expect(m.rækker.get(vf.id)?.attachment_path).toBe("c/e/c.png");
    expect(m.stier.get("c/e/b.png")).toMatchObject({ besked_id: null, status: "uploadet" });
    expect(m.stier.get("c/e/c.png")).toMatchObject({ besked_id: vf.id, status: "bundet" });
    for (const k of [k1, k2]) { k.unmount(); k.qc.clear(); }
  });
});

// ---------- B2b-2: §9 tjek for rigtig revision, stophul 2 og auth-skift før mutationFn (netværk mocket; SQL antagelser) ----------
import { startTjekHvisNoedvendigt, stopEfterbehandling, aktiveEfterbehandlinger, aktiveTjek, aktiveTjekTimere, useEditMessage, tagHandling, frigivHandling } from "./useChat";
import { ejerGyldig } from "@/lib/sbKladder";

describe("T9 (B2b-2 §9) – tjek for den rigtige revision", () => {
  const transport = { error: { name: "FunctionsFetchError" } };
  const tjekkes = (revision: number) => msg({ status: "tjekkes", revision });
  const invokes = () => graense.invoke.mock.calls.length;
  beforeEach(() => { vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }); graense.invoke.mockReset(); });
  const slut = () => { vi.useRealTimers(); graense.invoke.mockReset().mockImplementation((async () => ({ error: null }))); };

  it("samme revision og stadig tjekkes efter transportfejl → præcis ét genforsøg (højst to kald i alt)", async () => {
    try {
      svar.chat_messages = [tjekkes(2), tjekkes(2), tjekkes(2)];
      graense.invoke.mockResolvedValue(transport);
      const p = startTjekHvisNoedvendigt("m", () => true, fastholdEjer("e", "c", "u")!);
      await vi.advanceTimersByTimeAsync(10000); await p;
      expect(invokes()).toBe(2);
      expect(graense.invoke.mock.calls[1][1]).toMatchObject({ body: { type: "besked", id: "m", revision: 2 } });
      expect(aktiveTjek()).toBe(0);
    } finally { slut(); }
  });

  it.each([["ændret revision", tjekkes(3)], ["ændret status", msg({ status: "leveret", revision: 2 })], ["utilgængelig række", msg(null)], ["læsefejl", msg(null, { message: "x" })]])(
    "%s efter ventetiden stopper det gamle forløb (intet genforsøg)", async (_n, r2) => {
      try {
        svar.chat_messages = [tjekkes(2), r2];
        graense.invoke.mockResolvedValue(transport);
        const p = startTjekHvisNoedvendigt("m", () => true, fastholdEjer("e", "c", "u")!);
        await vi.advanceTimersByTimeAsync(3000); await p;
        expect(invokes()).toBe(1);
      } finally { slut(); }
    });

  it("brugerskift under ventetiden stopper det gamle forløb", async () => {
    try {
      svar.chat_messages = [tjekkes(2), tjekkes(2)];
      graense.invoke.mockResolvedValue(transport);
      const ejer = fastholdEjer("e", "c", "u")!;
      const p = startTjekHvisNoedvendigt("m", () => ejerGyldig(ejer), ejer);
      await vi.advanceTimersByTimeAsync(0);
      expect(invokes()).toBe(1);
      auth("SIGNED_IN", "anden");
      await vi.advanceTimersByTimeAsync(3000); await p;
      expect(invokes()).toBe(1);
      expect(kald.filter((k) => k === "select:chat_messages")).toHaveLength(1); // ingen genlæsning efter skiftet
    } finally { slut(); auth("SIGNED_IN", "u"); }
  });

  it("parallelle starter for samme bruger/id/revision deduplikeres; en nyere revision er et særskilt forløb", async () => {
    try {
      svar.chat_messages = [tjekkes(2), tjekkes(2), tjekkes(3)];
      const slip: Array<() => void> = [];
      graense.invoke.mockImplementation((() => new Promise((r) => { slip.push(() => r({ error: null })); })));
      const ejer = fastholdEjer("e", "c", "u")!;
      const a = startTjekHvisNoedvendigt("m", () => true, ejer);
      const b = startTjekHvisNoedvendigt("m", () => true, ejer);
      await vi.advanceTimersByTimeAsync(0);
      expect(invokes()).toBe(1);
      const c = startTjekHvisNoedvendigt("m", () => true, ejer);
      await vi.advanceTimersByTimeAsync(0);
      expect(invokes()).toBe(2);
      expect(graense.invoke.mock.calls.map((x) => arg(x[1], "body", "revision"))).toEqual([2, 3]);
      for (const f of slip) f();
      await vi.advanceTimersByTimeAsync(0);
      await Promise.all([a, b, c]); // alle forløb afsluttet før timerreset
      expect(aktiveTjek()).toBe(0);
      graense.invoke.mockReset();
    } finally { slut(); }
  });

  it.each([["optaget"], ["forældet"], ["ikke_konfigureret"]])("edge-resultat %s ændrer aldrig status direkte (kun læsninger)", async (status) => {
    try {
      svar.chat_messages = [tjekkes(2)];
      graense.invoke.mockResolvedValue({ data: { status }, error: null });
      await startTjekHvisNoedvendigt("m", () => true, fastholdEjer("e", "c", "u")!);
      expect(kald.filter((k) => !k.startsWith("select:"))).toEqual([]);
    } finally { slut(); }
  });
});

describe("B2b-2 stophul 2 – bekræftet INSERT stoppes under detached statusopslag", () => {
  it("stopEfterbehandling under statusopslaget: nul tjek-kald og nul cacheeffekter bagefter", async () => {
    auth("SIGNED_IN", "u");
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: 1, retryDelay: 0 } } });
    const inv = vi.spyOn(qc, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
    const { result, unmount } = renderHook(() => useSendMessage(), { wrapper });
    let statusSvar!: (r: { data: unknown; error: unknown }) => void;
    svar.chat_messages = [msg(null), new Promise((r) => { statusSvar = r; })];
    insert.mockResolvedValueOnce({ error: null });
    graense.invoke.mockClear();
    await result.current.mutateAsync({ ...v, ejer: fastholdEjer("e", "c", "u")! });
    await new Promise((x) => setTimeout(x, 0));
    expect(aktiveEfterbehandlinger()).toBe(1); // detached efterbehandling er synlig for stopvejen
    expect(kald.filter((k) => k === "select:chat_messages")).toHaveLength(2); // statusopslaget er startet
    stopEfterbehandling("e", "c", v.id);
    const foer = inv.mock.calls.length;
    statusSvar(msg({ status: "tjekkes", revision: 1 }));
    await new Promise((x) => setTimeout(x, 0));
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
    expect(inv.mock.calls.length).toBe(foer);
    expect(aktiveEfterbehandlinger()).toBe(0);
    unmount(); qc.clear();
  });
});

describe("B2b-2 – auth-skift efter mutate, men før mutationFn", () => {
  it("bevist ventepunkt: intet sb_ret før mutationFn; efter auth-skift starter mutationFn intet kald", async () => {
    auth("SIGNED_IN", "u");
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: 1, retryDelay: 0 } } });
    const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
    const { result, unmount } = renderHook(() => useEditMessage(), { wrapper });
    graense.rpc.mockClear();
    const ejer = fastholdEjer("e", "c", "u")!;
    expect(tagHandling(ejer, "m", "gem")).toBe(true);
    const p = result.current.mutateAsync({ messageId: "m", content: "x", conversationId: "c", revision: 1, ejer }).catch((e) => e);
    expect(supabase.rpc).not.toHaveBeenCalled(); // ventepunktet: mutationFn er ikke kørt endnu (synkront efter mutate)
    auth("SIGNED_IN", "anden");
    const e = await p;
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(e instanceof Error ? e.name : null).toBe("HandlingsFejl");
    auth("SIGNED_IN", "u");
    unmount(); qc.clear();
  });
});

// ---------- B2c-1 §5: pagination bevares (lokal fristfiltrering sker kun i visningen) ----------
import { useMessages, CHAT_PAGE_SIZE } from "./useChat";
import { waitFor } from "@testing-library/react";
describe("T5 (B2c-1 §5) – useMessages bevarer rå sider", () => {
  it("fuld serverside med udløbne rækker: InfiniteData uændret, alle rækker returneres, hasOlder sand", async () => {
    const fortid = new Date(Date.now() - 60_000).toISOString();
    const raekker = Array.from({ length: CHAT_PAGE_SIZE }, (_, i) => ({
      id: `m${String(i).padStart(3, "0")}`, conversation_id: "c", sender_id: "s", content: "x", status: "leveret", revision: 1,
      created_at: new Date(2026, 9, 1, 0, i).toISOString(), slettes_efter: i % 2 ? fortid : null, reply_to_id: null,
    }));
    const thenable = (data: unknown) => {
      const b: Record<string, unknown> = {};
      for (const k of ["select", "eq", "is", "order", "in", "range", "neq"]) b[k] = () => b;
      b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(ok);
      return b;
    };
    let foerste = true;
    graense.from.mockImplementation((t: string) => {
      if (t === "chat_messages" && foerste) { foerste = false; return thenable(raekker); }
      return thenable([]);
    });
    try {
      const qcP = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: 1 } } });
      const w = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qcP }, children);
      const { result } = renderHook(() => useMessages("c"), { wrapper: w });
      await waitFor(() => expect(result.current.data).toBeDefined());
      expect(result.current.data).toHaveLength(CHAT_PAGE_SIZE); // udløbne rækker filtreres ikke i cachen
      expect(result.current.hasOlder).toBe(true);
      const cache = qcP.getQueryData<{ pages: unknown[][]; pageParams: unknown[] }>(["chat-messages", "c"]);
      expect(cache?.pages).toHaveLength(1);
      expect(cache?.pages[0]).toHaveLength(CHAT_PAGE_SIZE);
      expect(cache?.pageParams).toEqual([0]);
      expect(typeof result.current.opdateret).toBe("number");
      qcP.clear();
    } finally { graense.from.mockReset(); }
  });
});

// ---------- B2b-3a: resultatkontrakt, holdbart ukendt udfald, lås/kø/stop (netværk mocket; SQL/RLS = antagelser) ----------
import { vurderUdfald, useAfgoer, useFjernFil, aktiveHandlinger, udfaldSnapshot, tjekUdfaldIgen, HandlingsFejl } from "./useChat";
import { useInfiniteQuery } from "@tanstack/react-query";
import { act } from "@testing-library/react";
import { toast } from "sonner";

describe("B2b-3a §1 – resultatvurdering mod snapshot", () => {
  const raek = (revision: number, o: Partial<{ status: string; content: string; attachment_path: string | null }> = {}) =>
    ({ status: "afventer_afsender", content: "x", attachment_path: null, revision, ...o });
  it("startrevision 1 mod revision 3 med samme tekst → konflikt (en større revision er aldrig nok)", () => {
    expect(vurderUdfald({ art: "gem", startRevision: 1, forventet: { revision: 2, content: "x" }, filRef: null }, raek(3))).toBe("konflikt");
  });
  it("filfjernelse fra revision 1 mod revision 3 uden fil → konflikt", () => {
    expect(vurderUdfald({ art: "fjern", startRevision: 1, forventet: { revision: 2, utenFil: true }, filRef: "e/c/f" }, raek(3))).toBe("konflikt");
  });
  it("præcis startrevision + 1 med ønsket resultat → bekræftet; anden tekst ved +1 → konflikt", () => {
    expect(vurderUdfald({ art: "gem", startRevision: 1, forventet: { revision: 2, content: "x" }, filRef: null }, raek(2))).toBe("bekraeftet");
    expect(vurderUdfald({ art: "gem", startRevision: 1, forventet: { revision: 2, content: "y" }, filRef: null }, raek(2))).toBe("konflikt");
  });
  it("gammel række (startrevision) beviser ikke afvisning → ukendt; ulæselig/usynlig → ukendt", () => {
    expect(vurderUdfald({ art: "gem", startRevision: 1, forventet: { revision: 2, content: "y" }, filRef: null }, raek(1))).toBe("ukendt");
    expect(vurderUdfald({ art: "traek", startRevision: 4, forventet: { revision: 4, status: "trukket_tilbage" }, filRef: null }, raek(4))).toBe("ukendt");
    expect(vurderUdfald({ art: "send", startRevision: 4, forventet: { revision: 4, status: "leveret" }, filRef: null }, "fejl")).toBe("ukendt");
    expect(vurderUdfald({ art: "send", startRevision: 4, forventet: { revision: 4, status: "leveret" }, filRef: null }, null)).toBe("ukendt");
  });
  it("send/træk: samme revision i målstatus → bekræftet; anden revision eller anden status → konflikt", () => {
    const s = { art: "send" as const, startRevision: 4, forventet: { revision: 4, status: "leveret" }, filRef: null };
    expect(vurderUdfald(s, raek(4, { status: "leveret" }))).toBe("bekraeftet");
    expect(vurderUdfald(s, raek(5, { status: "leveret" }))).toBe("konflikt");
    expect(vurderUdfald(s, raek(4, { status: "trukket_tilbage" }))).toBe("konflikt");
  });
});

describe("B2b-3a §1/§2a – rigtige hooks med stabil QueryClient (mutations.retry=1)", () => {
  let qc: QueryClient;
  const wrap = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
  const ID = "m1";
  const rpc = () => graense.rpc;
  const laesninger = () => kald.filter((k) => k === "select:chat_messages").length;
  const r = (revision: number, o: Record<string, unknown> = {}) => msg({ status: "afventer_afsender", revision, content: "x", attachment_path: null, ...o });
  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { mutations: { retry: 1, retryDelay: 0 }, queries: { retry: false } } });
    rpc().mockReset();
    vi.mocked(toast.error).mockReset();
    auth("SIGNED_OUT", null); auth("SIGNED_IN", "u"); // ny generation: ingen låse/snapshots fra andre prøver
  });
  // Isolation: ingen rpc-kald/toasts lækker til andre prøver i blandet rækkefølge.
  afterEach(() => { rpc().mockReset(); vi.mocked(toast.error).mockReset(); for (const k of Object.keys(svar)) delete svar[k]; });
  const ejer = () => fastholdEjer("e", "c", "u")!;
  const afslut = async () => { await act(async () => { await new Promise((x) => setTimeout(x, 0)); }); qc.clear(); };

  it("Gem: transportfejl og række med revision 3 og samme tekst (start 1) → konflikt, ét sb_ret, intet snapshot", async () => {
    const { result } = renderHook(() => useEditMessage(), { wrapper: wrap });
    const e = ejer(); expect(tagHandling(e, ID, "gem")).toBe(true);
    rpc().mockResolvedValueOnce({ data: null, error: { message: "Failed to fetch" } });
    svar.chat_messages = [r(3)];
    const f = await result.current.mutateAsync({ messageId: ID, content: "x", conversationId: "c", revision: 1, ejer: e }).then(() => null, (x) => x);
    expect(f).toBeInstanceOf(HandlingsFejl); expect(f instanceof HandlingsFejl ? f.art : null).toBe("konflikt");
    expect(rpc()).toHaveBeenCalledTimes(1);
    expect(udfaldSnapshot("e", "c", ID)).toBeNull();
    expect(aktiveHandlinger()).toBe(0);
    await afslut();
  });

  it("sb_ret med revision ≠ start+1 er ikke direkte succes → afstemmes ved læsning", async () => {
    const { result } = renderHook(() => useEditMessage(), { wrapper: wrap });
    const e = ejer(); tagHandling(e, ID, "gem");
    rpc().mockResolvedValueOnce({ data: 7, error: null });
    svar.chat_messages = [r(1)];
    const f = await result.current.mutateAsync({ messageId: ID, content: "ny", conversationId: "c", revision: 1, ejer: e, kladdeVersion: 9 }).then(() => null, (x) => x);
    expect(f instanceof HandlingsFejl ? f.art : null).toBe("ukendt");
    expect(udfaldSnapshot("e", "c", ID)).toMatchObject({ art: "gem", startRevision: 1, forventet: { revision: 2, content: "ny" }, kladdeVersion: 9, bekraeftet: false });
    await afslut();
  });

  it("Fjern fil: transportfejl og revision 3 uden fil (start 1) → konflikt og én konflikttoast", async () => {
    const { result } = renderHook(() => useFjernFil(), { wrapper: wrap });
    const e = ejer(); tagHandling(e, ID, "fjern");
    rpc().mockResolvedValueOnce({ data: null, error: { message: "Failed to fetch" } });
    svar.chat_messages = [r(3)];
    await result.current.mutateAsync({ messageId: ID, revision: 1, conversationId: "c", ejer: e, filRef: "e/c/f", fejltekst: "Kunne ikke fjerne filen" }).catch(() => null);
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith("Beskeden er ændret – prøv igen");
    expect(udfaldSnapshot("e", "c", ID)).toBeNull();
    await afslut();
  });

  it("transportfejl med gammel række → ukendt bevares; senere commit → »Tjek igen« bekræfter uden ny skrivning", async () => {
    const { result } = renderHook(() => useAfgoer(), { wrapper: wrap });
    const e = ejer(); tagHandling(e, ID, "send");
    rpc().mockResolvedValueOnce({ data: null, error: { message: "Failed to fetch" } });
    svar.chat_messages = [r(4)];
    await result.current.mutateAsync({ messageId: ID, revision: 4, handling: "send", conversationId: "c", ejer: e, fejltekst: "x" }).catch(() => null);
    expect(toast.error).not.toHaveBeenCalled();
    expect(udfaldSnapshot("e", "c", ID)?.bekraeftet).toBe(false);
    // Ret-åbning rydder ikke tilstanden.
    expect(tagHandling(ejer(), ID, "ret")).toBe(true);
    expect(udfaldSnapshot("e", "c", ID)).not.toBeNull();
    svar.chat_messages = [r(4, { status: "leveret" })];
    // B2b-4a: uden indarbejdet visning (ingen aktiv observer) er resultatet bekræftet, men det gamle grundlag beskyttes.
    expect(await tjekUdfaldIgen(qc, "e", "c", ID)).toBe("ukendt");
    expect(udfaldSnapshot("e", "c", ID)?.bekraeftet).toBe(true);
    expect(tagHandling(ejer(), ID, "send", { revision: 4, status: "afventer_afsender" })).toBe(false);
    qc.setQueryData(["chat-messages", "c"], { pages: [[{ id: ID, status: "leveret", revision: 4 }]], pageParams: [0] });
    expect(await tjekUdfaldIgen(qc, "e", "c", ID)).toBe("bekraeftet");
    expect(udfaldSnapshot("e", "c", ID)).toBeNull();
    expect(rpc()).toHaveBeenCalledTimes(1);
    await afslut();
  });

  it("tilbageholdt og fejlet »Tjek igen«: tjekker under læsning; læsefejl bevarer snapshot; ingen skrivning", async () => {
    const { result } = renderHook(() => useAfgoer(), { wrapper: wrap });
    const e = ejer(); tagHandling(e, ID, "traek");
    rpc().mockResolvedValueOnce({ data: null, error: { message: "Failed to fetch" } });
    svar.chat_messages = [r(4)];
    await result.current.mutateAsync({ messageId: ID, revision: 4, handling: "traek", conversationId: "c", ejer: e }).catch(() => null);
    let slip!: (x: { data: unknown; error: unknown }) => void;
    svar.chat_messages = [new Promise((x) => { slip = x; })];
    const p = tjekUdfaldIgen(qc, "e", "c", ID);
    expect(await tjekUdfaldIgen(qc, "e", "c", ID)).toBe("stoppet"); // parallelt tryk deduplikeres
    slip({ data: null, error: { message: "netværk" } });
    expect(await p).toBe("ukendt");
    expect(udfaldSnapshot("e", "c", ID)?.art).toBe("traek");
    expect(rpc()).toHaveBeenCalledTimes(1);
    await afslut();
  });

  it("§2a: rigtig InfiniteData-query – mens genhentningen efter vellykket Send tilbageholdes, ignoreres et nyt klik; læsefejl → bekræftet-tilstand spærrer gammelt grundlag", async () => {
    let n = 0; let slip!: (v: unknown) => void; let afvis!: (e: unknown) => void;
    const side = (status: string) => ({ beskeder: [{ id: ID, status, revision: 4 }] });
    renderHook(() => useInfiniteQuery({
      queryKey: ["chat-messages", "c"], initialPageParam: 0, getNextPageParam: () => undefined,
      queryFn: () => (++n === 1 ? Promise.resolve(side("afventer_afsender")) : new Promise((res, rej) => { slip = res; afvis = rej; })),
    }), { wrapper: wrap });
    await waitFor(() => expect(n).toBe(1));
    const { result } = renderHook(() => useAfgoer(), { wrapper: wrap });
    const e = ejer(); const vis = { revision: 4, status: "afventer_afsender" };
    expect(tagHandling(e, ID, "send", vis)).toBe(true);
    rpc().mockResolvedValueOnce({ data: true, error: null });
    let faerdig = false;
    const p = result.current.mutateAsync({ messageId: ID, revision: 4, handling: "send", conversationId: "c", ejer: e }).then(() => { faerdig = true; });
    await waitFor(() => expect(n).toBe(2));
    expect(faerdig).toBe(false);
    expect(tagHandling(ejer(), ID, "send", vis)).toBe(false); // samme gamle grundlag: andet klik ignoreres
    expect(rpc()).toHaveBeenCalledTimes(1);
    afvis(new Error("netværk"));
    await p;
    expect(udfaldSnapshot("e", "c", ID)).toMatchObject({ bekraeftet: true });
    expect(tagHandling(ejer(), ID, "traek", vis)).toBe(false); // stadig gammelt grundlag
    expect(aktiveHandlinger()).toBe(0);
    expect(tagHandling(ejer(), ID, "traek", { revision: 4, status: "leveret" })).toBe(true); // opdateret visning
    expect(udfaldSnapshot("e", "c", ID)).toBeNull();
    void slip;
    await afslut();
  });

  it("§2a stop under RPC: intet resultatopslag, ingen toast/snapshot; låsen beholdes til kaldet afslutter", async () => {
    const { result } = renderHook(() => useAfgoer(), { wrapper: wrap });
    const e = ejer(); tagHandling(e, ID, "send");
    let slip!: (v: unknown) => void;
    rpc().mockImplementationOnce((() => new Promise((x) => { slip = x; })));
    const p = result.current.mutateAsync({ messageId: ID, revision: 4, handling: "send", conversationId: "c", ejer: e, fejltekst: "x" }).catch(() => null);
    await waitFor(() => expect(rpc()).toHaveBeenCalledTimes(1));
    const foer = laesninger();
    stopEfterbehandling("e", "c", ID);
    expect(aktiveHandlinger()).toBe(1); // fysisk igangværende kald beholder låsen
    slip({ data: null, error: { message: "Failed to fetch" } });
    await p;
    expect(laesninger()).toBe(foer);
    expect(toast.error).not.toHaveBeenCalled();
    expect(udfaldSnapshot("e", "c", ID)).toBeNull();
    expect(aktiveHandlinger()).toBe(0);
    await afslut();
  });

  it("§2a stop under resultatafstemningen (Gem): sent svar giver intet snapshot, ingen toast og ingen cacheinvalidering", async () => {
    const { result } = renderHook(() => useEditMessage(), { wrapper: wrap });
    const e = ejer(); tagHandling(e, ID, "gem");
    rpc().mockResolvedValueOnce({ data: null, error: { message: "Failed to fetch" } });
    let slip!: (x: { data: unknown; error: unknown }) => void;
    svar.chat_messages = [new Promise((x) => { slip = x; })];
    const inv = vi.spyOn(qc, "invalidateQueries");
    const p = result.current.mutateAsync({ messageId: ID, content: "ny", conversationId: "c", revision: 1, ejer: e }).then(() => null, (x) => x);
    await waitFor(() => expect(laesninger()).toBe(1));
    stopEfterbehandling("e", "c");
    slip(r(1));
    const f = await p;
    expect(f instanceof HandlingsFejl ? f.art : null).toBe("stoppet");
    expect(udfaldSnapshot("e", "c", ID)).toBeNull();
    expect(toast.error).not.toHaveBeenCalled();
    expect(inv).not.toHaveBeenCalled();
    await afslut();
  });

  it("§2a stop under sb_fjern_fil før svar: ingen efterbehandling (intet tjek-kald)", async () => {
    const { result } = renderHook(() => useFjernFil(), { wrapper: wrap });
    const e = ejer(); tagHandling(e, ID, "fjern");
    let slip!: (v: unknown) => void;
    rpc().mockImplementationOnce((() => new Promise((x) => { slip = x; })));
    const p = result.current.mutateAsync({ messageId: ID, revision: 1, conversationId: "c", ejer: e, filRef: "f" }).catch(() => null);
    await waitFor(() => expect(rpc()).toHaveBeenCalledTimes(1));
    stopEfterbehandling("e", "c");
    slip({ data: 2, error: null });
    await p;
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
    expect(laesninger()).toBe(0);
    await afslut();
  });
});

describe("B2b-3a §1 – Træk tilbage fra leveret: uændret startstatus er intet bevis", () => {
  it("leveret → læst leveret i samme revision = ukendt; trukket = bekræftet; afventer = konflikt", () => {
    const s = { art: "traek" as const, startRevision: 2, startStatus: "leveret", forventet: { revision: 2, status: "trukket_tilbage" }, filRef: null };
    const raek = (status: string) => ({ status, revision: 2, content: "", attachment_path: null });
    expect(vurderUdfald(s, raek("leveret"))).toBe("ukendt");
    expect(vurderUdfald(s, raek("trukket_tilbage"))).toBe("bekraeftet");
    expect(vurderUdfald(s, raek("afventer_afsender"))).toBe("konflikt");
  });
});

describe("B2b-3b §3 – to klienter, binding før primærnøglekonflikt (model = antagelse, ikke SQL)", () => {
  const lav = () => {
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: 1, retryDelay: 0 } } });
    const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
    return { qc, ...renderHook(() => useSendMessage(), { wrapper }) };
  };
  const forloeb = async (m: ReturnType<typeof lavModel>) => {
    auth("SIGNED_IN", "u");
    const k1 = lav(), k2 = lav();
    m.holdNaeste();
    const p1 = fejl(k1.result.current.mutateAsync({ ...vf, attachmentPath: "c/e/b.png", ejer: fastholdEjer("e", "c", "u")! }));
    await vi.waitFor(() => expect(m.holdte).toHaveLength(1));
    await k2.result.current.mutateAsync({ ...vf, attachmentPath: "c/e/c.png", ejer: fastholdEjer("e", "c", "u")! });
    return { k1, k2, p1 };
  };
  const ryd = (...k: Array<ReturnType<typeof lav>>) => { for (const x of k) { x.unmount(); x.qc.clear(); } };

  it("taberen binder først, konflikten tilbagefører bindingen → én række med vinderens sti, taberens sti ubundet, ingen fejl", async () => {
    const m = lavModel(true); m.nySti("c/e/b.png"); m.nySti("c/e/c.png");
    const { k1, k2, p1 } = await forloeb(m);
    m.holdte[0]();
    expect(await p1).toBeNull(); // afstemt som allerede gemt
    expect(m.rækker.size).toBe(1);
    expect(m.rækker.get(vf.id)?.attachment_path).toBe("c/e/c.png");
    expect(m.stier.get("c/e/c.png")).toMatchObject({ besked_id: vf.id, status: "bundet" });
    expect(m.stier.get("c/e/b.png")).toMatchObject({ besked_id: null, status: "uploadet" });
    // Beskedopslaget viser faktisk den bundne række.
    expect((await dyn.chat_messages!({ id: vf.id })).data).toMatchObject({ id: vf.id, status: "leveret" });
    ryd(k1, k2);
  });

  for (const [navn, opsaet] of [
    ["fejlet beskedopslag", (m: ReturnType<typeof lavModel>) => { dyn.chat_messages = async () => ({ data: null, error: { message: "Failed to fetch" } }); void m; }],
    ["registerfejl efter tomt beskedopslag", () => { dyn.chat_messages = async () => ({ data: null, error: null }); dyn.sb_stier = async () => ({ data: null, error: { message: "x" } }); }],
    ["manglende register efter tomt beskedopslag", () => { dyn.chat_messages = async () => ({ data: null, error: null }); dyn.sb_stier = async () => ({ data: null, error: null }); }],
    ["minimeret register efter tomt beskedopslag", () => { dyn.chat_messages = async () => ({ data: null, error: null }); dyn.sb_stier = async () => ({ data: { besked_id: null }, error: null }); }],
  ] as const) it(`negativt bevis: ${navn} → taberen uafklaret (ukendt), intet nyt INSERT, taberens sti ubundet`, async () => {
    const m = lavModel(true); m.nySti("c/e/b.png"); m.nySti("c/e/c.png");
    const { k1, k2, p1 } = await forloeb(m);
    opsaet(m);
    m.holdte[0]();
    const e = await p1;
    expect(e?.art).toBe("ukendt");
    expect(m.rækker.size).toBe(1);
    expect(m.stier.get("c/e/b.png")).toMatchObject({ besked_id: null, status: "uploadet" });
    ryd(k1, k2);
  });
});

describe("B2b-3b §2b – tjekforløbets ejer, ventetimer og JWT", () => {
  const transport = { error: { name: "FunctionsFetchError" } };
  const tjekkes = (revision: number) => msg({ status: "tjekkes", revision });
  const invokes = () => graense.invoke.mock.calls.length;
  beforeEach(() => { vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }); graense.invoke.mockReset(); auth("SIGNED_IN", "u"); });
  afterEach(() => { vi.useRealTimers(); graense.invoke.mockReset(); graense.session.mockReset().mockImplementation(async () => ({ data: { session: { access_token: "jwt-u", user: { id: "u" } } }, error: null })); });

  it("JWT bindes eksplicit til operationens session (Authorization-header)", async () => {
    svar.chat_messages = [tjekkes(2)];
    graense.invoke.mockResolvedValue({ error: null });
    await startTjekHvisNoedvendigt("m", () => true, fastholdEjer("e", "c", "u")!);
    expect(graense.invoke.mock.calls[0][1]).toMatchObject({ headers: { Authorization: "Bearer jwt-u" }, body: { id: "m", revision: 2 } });
  });

  it("stop under edge-kald: sent transportsvar opretter ingen ventetimer, intet genforsøg", async () => {
    svar.chat_messages = [tjekkes(2), tjekkes(2)];
    let slip: (v: unknown) => void = () => undefined;
    graense.invoke.mockImplementationOnce(() => new Promise((r) => { slip = r; }));
    const p = startTjekHvisNoedvendigt("m", () => true, fastholdEjer("e", "c", "u")!);
    await vi.waitFor(() => expect(invokes()).toBe(1));
    stopEfterbehandling("e", "c", "m");
    slip(transport);
    await vi.advanceTimersByTimeAsync(0);
    expect(aktiveTjekTimere()).toBe(0);
    await vi.advanceTimersByTimeAsync(5000); await p;
    expect(invokes()).toBe(1);
    expect(aktiveTjek()).toBe(0);
  });

  it("stop under genforsøgsventetiden afslutter timeren straks; ingen genlæsning/genforsøg", async () => {
    svar.chat_messages = [tjekkes(2), tjekkes(2)];
    graense.invoke.mockResolvedValue(transport);
    const p = startTjekHvisNoedvendigt("m", () => true, fastholdEjer("e", "c", "u")!);
    await vi.waitFor(() => expect(aktiveTjekTimere()).toBe(1)); // bevist aktiv timer
    const laes = kald.filter((k) => k === "select:chat_messages").length;
    stopEfterbehandling("e", "c", "m");
    expect(aktiveTjekTimere()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    await p;
    await vi.advanceTimersByTimeAsync(5000);
    expect(invokes()).toBe(1);
    expect(kald.filter((k) => k === "select:chat_messages").length).toBe(laes);
  });

  it("sessionsophør (logud) under ventetiden afslutter timeren straks", async () => {
    svar.chat_messages = [tjekkes(2), tjekkes(2)];
    graense.invoke.mockResolvedValue(transport);
    const ejer = fastholdEjer("e", "c", "u")!;
    const p = startTjekHvisNoedvendigt("m", () => ejerGyldig(ejer), ejer);
    await vi.waitFor(() => expect(aktiveTjekTimere()).toBe(1));
    auth("SIGNED_OUT", null);
    expect(aktiveTjekTimere()).toBe(0);
    await p; await vi.advanceTimersByTimeAsync(5000);
    expect(invokes()).toBe(1);
  });

  it("sessionsskift under SDK/token-ventepunkt: gammelt arbejde sendes aldrig med den nye brugers JWT", async () => {
    svar.chat_messages = [tjekkes(2)];
    let slip: (v: unknown) => void = () => undefined;
    graense.session.mockImplementationOnce(() => new Promise((r) => { slip = r; }));
    const ejer = fastholdEjer("e", "c", "u")!;
    const p = startTjekHvisNoedvendigt("m", () => ejerGyldig(ejer), ejer);
    await vi.waitFor(() => expect(supabase.auth.getSession).toHaveBeenCalled());
    auth("SIGNED_IN", "anden");
    slip({ data: { session: { access_token: "jwt-anden", user: { id: "anden" } } }, error: null });
    await p;
    expect(invokes()).toBe(0);
  });

  it("session med anden bruger end operationens (uden generationsskift) → intet kald", async () => {
    svar.chat_messages = [tjekkes(2)];
    graense.session.mockResolvedValueOnce({ data: { session: { access_token: "jwt-x", user: { id: "x" } } }, error: null });
    await startTjekHvisNoedvendigt("m", () => true, fastholdEjer("e", "c", "u")!);
    expect(invokes()).toBe(0);
  });

  it("manuel handling (Send) mod bevist aktiv timer: afslutter tjekforløbet (timer væk), ingen genforsøg bagefter", async () => {
    svar.chat_messages = [tjekkes(2), tjekkes(2)];
    graense.invoke.mockResolvedValue(transport);
    const ejer = fastholdEjer("e", "c", "u")!;
    const p = startTjekHvisNoedvendigt("m", () => ejerGyldig(ejer), ejer);
    await vi.waitFor(() => expect(aktiveTjekTimere()).toBe(1));
    expect(tagHandling(ejer, "m", "send")).toBe(true); // manuel handling får låsen og afslutter det gamle tjeks timer
    expect(aktiveTjekTimere()).toBe(0);
    await p; await vi.advanceTimersByTimeAsync(5000);
    expect(invokes()).toBe(1);
    frigivHandling(ejer, "m");
  });
});

// ---------- B2b-4a: sammenhængende resultat, visningsgrundlag og stop gennem afstemning/transport ----------
import { overtagTilGem, visningIndarbejdet } from "./useChat";
import { onlineManager } from "@tanstack/react-query";

describe("B2b-4a §1 – resultat frigiver ikke det gamle grundlag før faktisk indarbejdet visning", () => {
  let qc: QueryClient;
  const wrap = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
  const ID = "m1";
  const r = (revision: number, o: Record<string, unknown> = {}) => msg({ status: "afventer_afsender", revision, content: "x", attachment_path: null, ...o });
  const liste = (status: string, revision: number) => ({ id: ID, status, revision });
  const ejer = () => fastholdEjer("e", "c", "u")!;
  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { mutations: { retry: 1, retryDelay: 0 }, queries: { retry: false } } });
    graense.rpc.mockReset();
    vi.mocked(toast.error).mockReset();
    auth("SIGNED_OUT", null); auth("SIGNED_IN", "u");
  });
  afterEach(() => { onlineManager.setOnline(true); graense.rpc.mockReset(); vi.mocked(toast.error).mockReset(); for (const k of Object.keys(svar)) delete svar[k]; qc.clear(); });

  it("visningIndarbejdet: kun forventet (eller senere) revision i målstatus i InfiniteData tæller", () => {
    const s = { id: ID, forventet: { revision: 4, status: "leveret" }, ejer: { conv: "c" } };
    expect(visningIndarbejdet(qc, s)).toBe(false); // ingen liste
    qc.setQueryData(["chat-messages", "c"], { pages: [[liste("afventer_afsender", 4)]], pageParams: [0] });
    expect(visningIndarbejdet(qc, s)).toBe(false);
    qc.setQueryData(["chat-messages", "c"], { pages: [[], [liste("leveret", 4)]], pageParams: [0, 1] });
    expect(visningIndarbejdet(qc, s)).toBe(true);
  });

  it("direkte succes med paused/offline genhentning (aktiv observer) → bekræftet snapshot, ikke frigivet grundlag; låsen frigives", async () => {
    let n = 0;
    renderHook(() => useInfiniteQuery({ queryKey: ["chat-messages", "c"], initialPageParam: 0, getNextPageParam: () => undefined,
      queryFn: async () => (++n === 1 ? [liste("afventer_afsender", 4)] : [liste("leveret", 4)]) }), { wrapper: wrap });
    await vi.waitFor(() => expect(n).toBe(1));
    const { result } = renderHook(() => useAfgoer(), { wrapper: wrap });
    const e = ejer(); expect(tagHandling(e, ID, "send", { revision: 4, status: "afventer_afsender" })).toBe(true);
    // Nettet falder bort, mens sb_afgoer svarer: genhentningen pauses (refetchQueries afslutter uden opdatering).
    graense.rpc.mockImplementationOnce(async () => { onlineManager.setOnline(false); return { data: true, error: null }; });
    await result.current.mutateAsync({ messageId: ID, revision: 4, handling: "send", conversationId: "c", ejer: e });
    expect(udfaldSnapshot("e", "c", ID)?.bekraeftet).toBe(true);
    expect(aktiveHandlinger()).toBe(0); // ingen permanent lås – beskyttelsen er den synlige bekræftet-tilstand
    expect(tagHandling(ejer(), ID, "send", { revision: 4, status: "afventer_afsender" })).toBe(false); // gammelt grundlag
    expect(graense.rpc).toHaveBeenCalledTimes(1);
    onlineManager.setOnline(true);
    await vi.waitFor(() => expect(visningIndarbejdet(qc, { id: ID, forventet: { revision: 4, status: "leveret" }, ejer: { conv: "c" } })).toBe(true));
    expect(await tjekUdfaldIgen(qc, "e", "c", ID)).toBe("bekraeftet");
    expect(graense.rpc).toHaveBeenCalledTimes(1);
  });

  it("direkte succes uden aktiv observer (afmonteret liste) → bekræftet snapshot; nyt klik på gammelt grundlag starter ingen skrivning", async () => {
    qc.setQueryData(["chat-messages", "c"], { pages: [[liste("afventer_afsender", 4)]], pageParams: [0] });
    const { result } = renderHook(() => useAfgoer(), { wrapper: wrap });
    const e = ejer(); tagHandling(e, ID, "traek");
    graense.rpc.mockResolvedValueOnce({ data: true, error: null });
    await result.current.mutateAsync({ messageId: ID, revision: 4, handling: "traek", conversationId: "c", ejer: e });
    expect(udfaldSnapshot("e", "c", ID)).toMatchObject({ art: "traek", bekraeftet: true });
    expect(tagHandling(ejer(), ID, "traek", { revision: 4, status: "afventer_afsender" })).toBe(false);
    expect(graense.rpc).toHaveBeenCalledTimes(1);
  });

  it("»Tjek igen« mod fejlet listegenhentning: bekræftet snapshot bevares, ingen skrivning", async () => {
    let n = 0;
    renderHook(() => useInfiniteQuery({ queryKey: ["chat-messages", "c"], initialPageParam: 0, getNextPageParam: () => undefined,
      queryFn: async () => { if (++n === 1) return [liste("afventer_afsender", 4)]; throw new Error("net"); } }), { wrapper: wrap });
    await vi.waitFor(() => expect(n).toBe(1));
    const { result } = renderHook(() => useAfgoer(), { wrapper: wrap });
    const e = ejer(); tagHandling(e, ID, "send");
    graense.rpc.mockResolvedValueOnce({ data: true, error: null });
    await result.current.mutateAsync({ messageId: ID, revision: 4, handling: "send", conversationId: "c", ejer: e });
    expect(udfaldSnapshot("e", "c", ID)?.bekraeftet).toBe(true);
    expect(await tjekUdfaldIgen(qc, "e", "c", ID)).toBe("ukendt");
    expect(udfaldSnapshot("e", "c", ID)?.bekraeftet).toBe(true);
    expect(graense.rpc).toHaveBeenCalledTimes(1);
  });

  it("»Tjek igen« bekræfter ukendt udfald, men visningen er ikke opdateret → bekræftet snapshot (ikke frigivet)", async () => {
    const { result } = renderHook(() => useAfgoer(), { wrapper: wrap });
    const e = ejer(); tagHandling(e, ID, "send");
    graense.rpc.mockResolvedValueOnce({ data: null, error: { message: "Failed to fetch" } });
    svar.chat_messages = [r(4)];
    await result.current.mutateAsync({ messageId: ID, revision: 4, handling: "send", conversationId: "c", ejer: e }).catch(() => null);
    svar.chat_messages = [r(4, { status: "leveret" })];
    expect(await tjekUdfaldIgen(qc, "e", "c", ID)).toBe("ukendt");
    expect(udfaldSnapshot("e", "c", ID)?.bekraeftet).toBe(true);
  });

  it("»Tjek igen« deltager i handlingskoordineringen: optaget lås → intet tjek; under tjek afvises skrivning og Gem-overgang", async () => {
    const { result } = renderHook(() => useAfgoer(), { wrapper: wrap });
    const e = ejer(); tagHandling(e, ID, "send");
    graense.rpc.mockResolvedValueOnce({ data: null, error: { message: "Failed to fetch" } });
    svar.chat_messages = [r(4)];
    await result.current.mutateAsync({ messageId: ID, revision: 4, handling: "send", conversationId: "c", ejer: e }).catch(() => null);
    const holder = ejer(); expect(tagHandling(holder, ID, "ret")).toBe(true);
    // Editorens 'ret'-lås må ikke skjule/blokere tjekket; en skrivende handling gør.
    let slip!: (x: unknown) => void;
    svar.chat_messages = [new Promise((x) => { slip = x; })];
    const p = tjekUdfaldIgen(qc, "e", "c", ID);
    expect(tagHandling(ejer(), ID, "traek")).toBe(false);
    expect(overtagTilGem(holder, ID)).toBe(false);
    slip(msg({ status: "afventer_afsender", revision: 4, content: "x", attachment_path: null }));
    expect(await p).toBe("ukendt");
    expect(graense.rpc).toHaveBeenCalledTimes(1);
  });

  it("stop under »Tjek igen«: sent svar ændrer ikke snapshot, giver ingen toast/cacheinvalidering og ingen efterbehandling", async () => {
    const { result } = renderHook(() => useAfgoer(), { wrapper: wrap });
    const e = ejer(); tagHandling(e, ID, "send");
    graense.rpc.mockResolvedValueOnce({ data: null, error: { message: "Failed to fetch" } });
    svar.chat_messages = [r(4)];
    await result.current.mutateAsync({ messageId: ID, revision: 4, handling: "send", conversationId: "c", ejer: e }).catch(() => null);
    await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
    const inv = vi.spyOn(qc, "invalidateQueries");
    const ref = vi.spyOn(qc, "refetchQueries");
    let slip!: (x: unknown) => void;
    svar.chat_messages = [new Promise((x) => { slip = x; })];
    const foer = udfaldSnapshot("e", "c", ID);
    const p = tjekUdfaldIgen(qc, "e", "c", ID);
    stopEfterbehandling("e", "c", ID);
    slip(msg({ status: "leveret", revision: 4, content: "x", attachment_path: null }));
    expect(await p).toBe("stoppet");
    expect(udfaldSnapshot("e", "c", ID)).toBe(foer);
    expect(inv).not.toHaveBeenCalled();
    expect(ref).not.toHaveBeenCalled();
    expect(aktiveEfterbehandlinger()).toBe(0);
    expect(toast.error).not.toHaveBeenCalled();
    expect(graense.invoke).not.toHaveBeenCalled();
  });

  it("P0001 fra sb_afgoer + samme revision i målstatus → ingen fejl; anden revision → ordret afvisning", async () => {
    qc.setQueryData(["chat-messages", "c"], { pages: [[liste("leveret", 4)]], pageParams: [0] });
    const { result } = renderHook(() => useAfgoer(), { wrapper: wrap });
    const e = ejer(); tagHandling(e, ID, "send");
    graense.rpc.mockResolvedValueOnce({ data: null, error: { code: "P0001", message: "Kun afventende indhold kan sendes" } });
    svar.chat_messages = [r(4, { status: "leveret" })];
    await expect(result.current.mutateAsync({ messageId: ID, revision: 4, handling: "send", conversationId: "c", ejer: e, fejltekst: "x" })).resolves.toBeTruthy();
    expect(toast.error).not.toHaveBeenCalled();
    const e2 = ejer(); tagHandling(e2, ID, "send");
    graense.rpc.mockResolvedValueOnce({ data: null, error: { code: "P0001", message: "Kun afventende indhold kan sendes" } });
    svar.chat_messages = [r(5, { status: "leveret" })];
    const f = await result.current.mutateAsync({ messageId: ID, revision: 4, handling: "send", conversationId: "c", ejer: e2, fejltekst: "x" }).then(() => null, (x) => x);
    expect(f instanceof HandlingsFejl ? f.art : null).toBe("afvist");
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith("Kun afventende indhold kan sendes"));
    expect(graense.rpc).toHaveBeenCalledTimes(2);
  });
});

describe("B2b-4a §2 – stop gennem transporten og manuel Gem mod aktivt tjek", () => {
  const transport = { error: { name: "FunctionsFetchError" } };
  const tjekkes = (revision: number) => msg({ status: "tjekkes", revision });
  beforeEach(() => { vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }); graense.invoke.mockReset(); auth("SIGNED_IN", "u"); });
  afterEach(() => { vi.useRealTimers(); graense.invoke.mockReset(); });

  it("én AbortController pr. tjek: stop under SDK'ets senere tokenventepunkt forhindrer HTTP-transport", async () => {
    svar.chat_messages = [tjekkes(2)];
    // Mock af SDK-grænsen (rigtig SDK-prøve er B2b-4b): token afventes inde i invoke, derefter fetch med signal.
    let slipToken!: () => void; let http = 0;
    graense.invoke.mockImplementationOnce(async (...a: unknown[]) => {
      const signal = arg(a[1], "signal");
      await new Promise<void>((x) => { slipToken = x; });
      if (signal instanceof AbortSignal && signal.aborted) return { error: { name: "FunctionsFetchError" } };
      http++; return { error: null };
    });
    const p = startTjekHvisNoedvendigt("m", () => true, fastholdEjer("e", "c", "u")!);
    await vi.waitFor(() => expect(graense.invoke).toHaveBeenCalledTimes(1));
    const sig0 = arg(graense.invoke.mock.calls[0][1], "signal"); const sig = sig0 instanceof AbortSignal ? sig0 : null;
    expect(sig).toBeInstanceOf(AbortSignal);
    expect(sig?.aborted).toBe(false);
    stopEfterbehandling("e", "c", "m");
    expect(sig?.aborted).toBe(true);
    slipToken();
    await p;
    await vi.advanceTimersByTimeAsync(5000);
    expect(http).toBe(0);
    expect(graense.invoke).toHaveBeenCalledTimes(1); // intet transportgenforsøg efter afbrydelse
    expect(aktiveTjekTimere()).toBe(0);
    expect(aktiveTjek()).toBe(0);
  });

  it("sessionsophør afbryder også transportsignalet", async () => {
    svar.chat_messages = [tjekkes(2)];
    let slip!: () => void;
    graense.invoke.mockImplementationOnce(async () => { await new Promise<void>((x) => { slip = x; }); return { error: null }; });
    const ejer = fastholdEjer("e", "c", "u")!;
    const p = startTjekHvisNoedvendigt("m", () => ejerGyldig(ejer), ejer);
    await vi.waitFor(() => expect(graense.invoke).toHaveBeenCalledTimes(1));
    const sig0 = arg(graense.invoke.mock.calls[0][1], "signal"); const sig = sig0 instanceof AbortSignal ? sig0 : null;
    auth("SIGNED_OUT", null);
    expect(sig?.aborted).toBe(true);
    slip(); await p;
  });

  it("manuel Gem via editorovergangen (overtagTilGem) mod bevist aktiv tjektimer afslutter det gamle tjek", async () => {
    svar.chat_messages = [tjekkes(2), tjekkes(2)];
    graense.invoke.mockResolvedValue(transport);
    const ejer = fastholdEjer("e", "c", "u")!;
    const p = startTjekHvisNoedvendigt("m", () => ejerGyldig(ejer), ejer);
    await vi.waitFor(() => expect(aktiveTjekTimere()).toBe(1));
    expect(tagHandling(ejer, "m", "ret")).toBe(true);
    expect(overtagTilGem(ejer, "m")).toBe(true);
    expect(aktiveTjekTimere()).toBe(0);
    await p; await vi.advanceTimersByTimeAsync(5000);
    expect(graense.invoke).toHaveBeenCalledTimes(1);
    frigivHandling(ejer, "m");
  });
});

// ---------- B2b-4b §3: rigtig SDK (functions-js via supabase-js) med mocket HTTP ----------
import { createClient } from "@supabase/supabase-js";

describe("B2b-4b §3 – SDK'ets senere tokenventepunkt gennem rigtig SDK og mocket HTTP", () => {
  let http: Array<{ url: string; authorization: string | null }> = [];
  const ventende: Array<() => void> = [];
  const slipToken = () => { for (const x of ventende.splice(0)) x(); };
  let tokenOpslag = 0;
  /** Tokenopslag startet af invoke (SDK'et kan også slå token op til realtime ved oprettelse). */
  let tokenVedInvoke = -1;
  const iSdkTokenopslag = () => tokenVedInvoke >= 0 && tokenOpslag > tokenVedInvoke;
  /** Mocket HTTP (ingen netværk): et allerede afbrudt signal afvises uden transport, som fetch-specifikationen kræver. */
  const httpMock = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (init?.signal?.aborted) return Promise.reject(new DOMException("aborted", "AbortError"));
    const h = new Headers(init?.headers);
    http.push({ url: String(input), authorization: h.get("Authorization") });
    return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }));
  };
  const lavSdk = () => createClient("http://lokal.test", "anon-noegle", {
    // SDK'ets eget, senere tokenopslag (fetchWithAuth venter på det, også når Authorization er sat eksplicit).
    accessToken: () => { tokenOpslag++; return new Promise<string>((x) => { ventende.push(() => x("sdk-token")); }); },
    global: { fetch: httpMock },
  });
  const tjekkes = (revision: number) => msg({ status: "tjekkes", revision });
  beforeEach(() => {
    http = []; tokenOpslag = 0; tokenVedInvoke = -1;
    const sdk = lavSdk();
    graense.invoke.mockReset().mockImplementation((navn: unknown, o: unknown) => (tokenVedInvoke = tokenOpslag, sdk.functions.invoke(String(navn), {
      headers: { Authorization: String(arg(o, "headers", "Authorization")) },
      body: (() => { const b = arg(o, "body"); return typeof b === "object" && b !== null ? { ...b } : undefined; })(),
      signal: (() => { const s = arg(o, "signal"); return s instanceof AbortSignal ? s : undefined; })(),
    })));
    auth("SIGNED_IN", "u");
  });
  afterEach(() => { graense.invoke.mockReset(); });

  it("positiv kontrol: uden stop sendes præcis ét HTTP-kald med den eksplicitte JWT", async () => {
    svar.chat_messages = [tjekkes(2)];
    const p = startTjekHvisNoedvendigt("m", () => true, fastholdEjer("e", "c", "u")!);
    await vi.waitFor(() => expect(iSdkTokenopslag()).toBe(true));
    slipToken();
    await p;
    expect(http).toHaveLength(1);
    expect(http[0].url).toContain("/functions/v1/storkbook-tjek");
    expect(http[0].authorization).toBe("Bearer jwt-u");
  });

  it("stop under SDK'ets tokenopslag → ingen efterfølgende HTTP-transport, intet genforsøg", async () => {
    svar.chat_messages = [tjekkes(2), tjekkes(2)];
    const p = startTjekHvisNoedvendigt("m", () => true, fastholdEjer("e", "c", "u")!);
    await vi.waitFor(() => expect(iSdkTokenopslag()).toBe(true)); // inde i SDK'et, efter vores sidste kontrol før invoke
    stopEfterbehandling("e", "c", "m");
    slipToken();
    await p;
    expect(http).toHaveLength(0);
    expect(graense.invoke).toHaveBeenCalledTimes(1);
    expect(aktiveTjek()).toBe(0);
    expect(aktiveTjekTimere()).toBe(0);
  });

  it("sessionsophør under SDK'ets tokenopslag → ingen efterfølgende HTTP-transport", async () => {
    svar.chat_messages = [tjekkes(2), tjekkes(2)];
    const ejer = fastholdEjer("e", "c", "u")!;
    const p = startTjekHvisNoedvendigt("m", () => ejerGyldig(ejer), ejer);
    await vi.waitFor(() => expect(iSdkTokenopslag()).toBe(true));
    auth("SIGNED_OUT", null);
    slipToken();
    await p;
    expect(http).toHaveLength(0);
    expect(aktiveTjekTimere()).toBe(0);
    auth("SIGNED_IN", "u");
  });
});

// ---------- B2b-4b §3: to isolerede klientforløb gennem rigtig sbFil (udstedelse + upload) og faktisk beskedvisning ----------
import { udstedUpload, uploadTilSti } from "@/lib/sbFil";

describe("B2b-4b §3 – to isolerede klienter: rigtig sbFil, binding før PK-konflikt, taberens rollback (model = antagelse, ikke SQL)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn> | null = null;
  const klienter: Array<{ qc: QueryClient; unmount: () => void }> = [];
  const lav = () => {
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: 1, retryDelay: 0 }, queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
    const h = renderHook(() => useSendMessage(), { wrapper });
    klienter.push({ qc, unmount: h.unmount });
    return { qc, ...h };
  };
  /** Mocket sb-fil-edge (udsted): hver klient får sin egen sti; Storage-upload registrerer stien i modellen. */
  const opsaetFil = (m: ReturnType<typeof lavModel>) => {
    let n = 0;
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((): Promise<Response> => {
      n++;
      return Promise.resolve(new Response(JSON.stringify({ sti: `c/e/klient${n}.png`, token: `tok${n}` }), { status: 200, headers: { "Content-Type": "application/json" } }));
    });
    graense.upload.mockReset().mockImplementation(async (sti: unknown) => { m.nySti(String(sti)); return { error: null }; });
  };
  const filFor = () => new File([new Uint8Array([1, 2, 3])], "x.png", { type: "image/png" });
  /** Hver klient: udsted → upload gennem rigtig sbFil → send med den udstedte sti. Klient 1 holdes ved INSERT. */
  const forloeb = async (m: ReturnType<typeof lavModel>) => {
    auth("SIGNED_IN", "u");
    const k1 = lav(), k2 = lav();
    const kontekst = (e: ReturnType<typeof fastholdEjer>) => ({ vagt: () => ejerGyldig(e), bruger: "u" });
    const e1 = fastholdEjer("e", "c", "u")!, e2 = fastholdEjer("e", "c", "u")!;
    const u1 = await udstedUpload("c", { name: "x.png", size: 3 }, "image/png", kontekst(e1));
    await uploadTilSti(u1, filFor(), "image/png", kontekst(e1));
    const u2 = await udstedUpload("c", { name: "x.png", size: 3 }, "image/png", kontekst(e2));
    await uploadTilSti(u2, filFor(), "image/png", kontekst(e2));
    expect(u1.sti).not.toBe(u2.sti);
    m.holdNaeste();
    const p1 = fejl(k1.result.current.mutateAsync({ ...vf, attachmentPath: u1.sti, ejer: e1 }));
    await vi.waitFor(() => expect(m.holdte).toHaveLength(1));
    await k2.result.current.mutateAsync({ ...vf, attachmentPath: u2.sti, ejer: e2 });
    return { u1, u2, p1 };
  };
  afterEach(() => {
    fetchSpy?.mockRestore(); fetchSpy = null;
    graense.upload.mockReset().mockImplementation(async () => ({ error: null }));
    for (const k of klienter.splice(0)) { k.unmount(); k.qc.clear(); }
    graense.from.mockReset();
  });

  it("taberen binder først; PK-konflikten tilbagefører bindingen; vinderens række vises faktisk i beskedlisten", async () => {
    const m = lavModel(true);
    opsaetFil(m);
    const { u1, u2, p1 } = await forloeb(m);
    expect(graense.upload.mock.calls.map((c) => c[0])).toEqual([u1.sti, u2.sti]); // rigtig sbFil → Storage, hver sin sti
    m.holdte[0]();
    expect(await p1).toBeNull(); // afstemt som allerede gemt (ingen fejl, intet nyt INSERT)
    // Observeret rækkefølge: vinderen binder; taberen binder FØR PK-konflikten, som derefter tilbagefører taberens binding.
    expect(m.log).toEqual([`bind:${u2.sti}`, `bind:${u1.sti}`, `pk:${vf.id}`, `rollback:${u1.sti}`]);
    expect(m.rækker.size).toBe(1);
    expect(m.stier.get(u2.sti)).toMatchObject({ besked_id: vf.id, status: "bundet" });
    expect(m.stier.get(u1.sti)).toMatchObject({ besked_id: null, status: "uploadet" });
    // Faktisk beskedvisning gennem rigtig useMessages mod modellens rækker.
    const rows = [...m.rækker.values()].map((r) => ({ id: r.id, conversation_id: "c", sender_id: "e", content: "hej", status: "leveret", revision: 1,
      created_at: "2026-10-29T00:00:00Z", attachment_path: r.attachment_path, reply_to_id: null }));
    const thenable = (data: unknown) => {
      const b: Record<string, unknown> = {};
      for (const k of ["select", "eq", "is", "order", "in", "range", "neq"]) b[k] = () => b;
      b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(ok);
      return b;
    };
    graense.from.mockImplementation((t: string) => thenable(t === "chat_messages" ? rows : []));
    const qcV = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: 1 } } });
    klienter.push({ qc: qcV, unmount: () => undefined });
    const w = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qcV }, children);
    const vis = renderHook(() => useMessages("c"), { wrapper: w });
    await waitFor(() => expect(vis.result.current.data).toBeDefined());
    expect(vis.result.current.data?.map((x) => [x.id, x.attachment_path])).toEqual([[vf.id, u2.sti]]);
    vis.unmount();
  });

  it("kontrol: flyttes PK-kontrollen foran bindingen, ændres den observerede rækkefølge (hovedprøvens forventning fejler)", async () => {
    const m = lavModel(false);
    opsaetFil(m);
    const { u1, u2, p1 } = await forloeb(m);
    m.holdte[0]();
    await p1;
    expect(m.log).toEqual([`bind:${u2.sti}`, `pk:${vf.id}`]);
    expect(m.log).not.toEqual([`bind:${u2.sti}`, `bind:${u1.sti}`, `pk:${vf.id}`, `rollback:${u1.sti}`]);
  });

  for (const [navn, opsaet] of [
    ["fejlet beskedopslag", () => { dyn.chat_messages = async () => ({ data: null, error: { message: "Failed to fetch" } }); }],
    ["registerfejl efter tomt beskedopslag", () => { dyn.chat_messages = async () => ({ data: null, error: null }); dyn.sb_stier = async () => ({ data: null, error: { message: "x" } }); }],
    ["manglende register efter tomt beskedopslag", () => { dyn.chat_messages = async () => ({ data: null, error: null }); dyn.sb_stier = async () => ({ data: null, error: null }); }],
    ["minimeret register efter tomt beskedopslag", () => { dyn.chat_messages = async () => ({ data: null, error: null }); dyn.sb_stier = async () => ({ data: { besked_id: null }, error: null }); }],
  ] as const) it(`negativt bevis gennem rigtig sbFil: ${navn} → taberen ukendt, intet nyt INSERT, taberens sti ubundet`, async () => {
    const m = lavModel(true);
    opsaetFil(m);
    const { u1, p1 } = await forloeb(m);
    opsaet();
    const inserts = kald.filter((k) => k === "insert:chat_messages").length;
    m.holdte[0]();
    const e = await p1;
    expect(e?.art).toBe("ukendt");
    expect(kald.filter((k) => k === "insert:chat_messages").length).toBe(inserts);
    expect(m.rækker.size).toBe(1);
    expect(m.stier.get(u1.sti)).toMatchObject({ besked_id: null, status: "uploadet" });
  });
});


// ---------- B2c-2b-2 – fristur, presence-kanal og fristoprydning ----------
import { useFristUr, erUdloebet, useTypingIndicator, fristOprydning } from "./useChat";

describe("B2c-2b-2 (Codex) – fristur: callback før fristen, render efter fristen", () => {
  afterEach(() => { vi.useRealTimers(); });
  const T0 = new Date("2026-10-29T08:00:00.000Z").getTime();
  const FRIST = new Date(T0 + 1000).toISOString();

  it("gemt nu = frist − 1 ms og aktuelt ur efter fristen: render vurderer det aktuelle ur (udløbet)", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(T0 + 999); // »gemt nu« = frist − 1 ms
    const { result } = renderHook(() => { const nu = useFristUr([FRIST]); return { nu, ude: erUdloebet(FRIST, nu) }; });
    expect(result.current.ude).toBe(false);
    expect(vi.getTimerCount()).toBe(1); // planlagt 1 ms frem
    // Callbacken (forgrund) måles før fristen, men render/effekt sker efter: uret flyttes uden at timeren kører.
    vi.setSystemTime(T0 + 1001);
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(result.current.nu).toBe(T0 + 1001);
    expect(result.current.ude).toBe(true);
    expect(vi.getTimerCount()).toBe(0); // udløbet frist armeres aldrig igen (ingen 0-ms-løkke)
  });

  it("timer fyrer før fristen (urhop tilbage): intet gammelt indhold uden ny timer; senere passage udløser", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(T0 + 999);
    const { result } = renderHook(() => { const nu = useFristUr([FRIST]); return erUdloebet(FRIST, nu); });
    vi.setSystemTime(T0 + 500); // urhop tilbage, før timeren fyrer
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(result.current).toBe(false);
    expect(vi.getTimerCount()).toBe(1); // ny timer mod den stadig fremtidige frist
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(Date.now()).toBeGreaterThan(new Date(FRIST).getTime());
    expect(result.current).toBe(true);
  });

  it("urhop frem uden timer: forgrundssignal vurderer straks mod aktuelt ur", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(T0);
    const { result } = renderHook(() => { const nu = useFristUr([FRIST]); return erUdloebet(FRIST, nu); });
    vi.setSystemTime(T0 + 60_000);
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("online")); });
    expect(result.current).toBe(true);
  });
});

describe("B2c-2b-2 §7 – presence-kanal ved samtaleskift og afmontering", () => {
  beforeEach(() => { graense.kanaler.length = 0; });
  it("gammel callback kalder hverken fjernet eller forkert samtales kanal", async () => {
    const { result, rerender, unmount } = renderHook(({ c }) => useTypingIndicator(c), { initialProps: { c: "A" } });
    const gammel = result.current.setTyping;
    await act(async () => { await gammel(true, "e", "N", "A"); });
    const [a] = graense.kanaler;
    expect(a.track).toHaveBeenCalledTimes(1);
    rerender({ c: "B" });
    const b = graense.kanaler[1];
    expect(a.fjernet).toBe(true);
    await act(async () => { await gammel(false, "e", "N", "A"); }); // sen timer fra samtale A
    expect(a.track).toHaveBeenCalledTimes(1);
    expect(b.track).not.toHaveBeenCalled();
    unmount();
    await act(async () => { await gammel(false, "e", "N", "B"); });
    expect(b.track).not.toHaveBeenCalled();
  });
});

describe("B2c-2b-2 (Codex) – fristoprydning via stopvejen", () => {
  let qc: QueryClient;
  const wrap = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
  const r = (revision: number) => msg({ status: "afventer_afsender", revision, content: "x", attachment_path: null });
  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { mutations: { retry: 1, retryDelay: 0 }, queries: { retry: false } } });
    graense.rpc.mockReset(); vi.mocked(toast.error).mockReset();
    auth("SIGNED_OUT", null); auth("SIGNED_IN", "u");
  });
  afterEach(() => { graense.rpc.mockReset(); vi.mocked(toast.error).mockReset(); for (const k of Object.keys(svar)) delete svar[k]; qc.clear(); });

  it("når snapshot og »Tjek igen« for netop det udløbne id; andre snapshots og fysisk lås bevares", async () => {
    const { result } = renderHook(() => useAfgoer(), { wrapper: wrap });
    for (const id of ["x1", "x2"]) {
      const e = fastholdEjer("e", "c", "u")!; expect(tagHandling(e, id, "send")).toBe(true);
      graense.rpc.mockResolvedValueOnce({ data: null, error: { message: "Failed to fetch" } });
      svar.chat_messages = [r(4)];
      await result.current.mutateAsync({ messageId: id, revision: 4, handling: "send", conversationId: "c", ejer: e }).catch(() => null);
    }
    await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
    expect(udfaldSnapshot("e", "c", "x1")).not.toBeNull();
    const x2 = udfaldSnapshot("e", "c", "x2");
    expect(x2).not.toBeNull();
    // Igangværende »Tjek igen« for x1 (tilbageholdt læsning).
    let slip!: (x: unknown) => void;
    svar.chat_messages = [new Promise((x) => { slip = x; })];
    const p = tjekUdfaldIgen(qc, "e", "c", "x1");
    // Fysisk igangværende arbejde på x3 (låsen ejes af sit kald).
    const e3 = fastholdEjer("e", "c", "u")!; expect(tagHandling(e3, "x3", "send")).toBe(true);
    const laase = aktiveHandlinger();
    const inv = vi.spyOn(qc, "invalidateQueries");
    const ref = vi.spyOn(qc, "refetchQueries");
    fristOprydning("e", "c", "x1");
    fristOprydning("e", "c", "x3");
    slip(msg({ status: "leveret", revision: 4, content: "x", attachment_path: null }));
    expect(await p).toBe("stoppet");
    expect(udfaldSnapshot("e", "c", "x1")).toBeNull();
    expect(udfaldSnapshot("e", "c", "x2")).toBe(x2); // andre afsendelser røres ikke
    expect(aktiveHandlinger()).toBe(laase); // lås beholdes til egen afslutning
    expect(toast.error).not.toHaveBeenCalled();
    expect(inv).not.toHaveBeenCalled(); // stopvejen: sent tjeksvar giver ingen cacheeffekt
    expect(ref).not.toHaveBeenCalled();
    frigivHandling(e3, "x3");
  });
});

// ---------- B2bc-5a: visningsbevis på det viste grundlag og gyldige genvalideringslæsninger (netværk mocket; SQL/RLS = antagelser) ----------
import { dedupSider, traadHentSekvens } from "./useChat";

describe("B2bc-5a §1 – resultatbevis læser samme deduplikerede rækkegrundlag som visningen", () => {
  let qc: QueryClient;
  const wrap = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
  const ID = "m1";
  const raek = (status: string, revision: number) => ({ id: ID, status, revision });
  const ejer = () => fastholdEjer("e", "c", "u")!;
  const forventet = { id: ID, forventet: { revision: 4, status: "leveret" }, ejer: { conv: "c" } };
  /** To sider: side 0 (nyeste) og side 1 (ældre, den viste kopi). `nyeste` styrer side 0's svar pr. kald. */
  const toSider = (nyeste: (n: number) => Promise<unknown[]> | unknown[], aeldre: () => unknown[] = () => [raek("afventer_afsender", 4)]) => {
    let n = 0;
    const h = renderHook(() => useInfiniteQuery({ queryKey: ["chat-messages", "c"], initialPageParam: 0,
      getNextPageParam: (_l: unknown, all: unknown[]) => (all.length < 2 ? all.length : undefined),
      queryFn: async ({ pageParam }: { pageParam: number }) => (pageParam === 0 ? nyeste(++n) : aeldre()) }), { wrapper: wrap });
    return { h, kald: () => n };
  };
  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { mutations: { retry: 1, retryDelay: 0 }, queries: { retry: false } } });
    graense.rpc.mockReset(); vi.mocked(toast.error).mockReset();
    auth("SIGNED_OUT", null); auth("SIGNED_IN", "u");
  });
  afterEach(() => { onlineManager.setOnline(true); graense.rpc.mockReset(); graense.from.mockReset(); for (const k of Object.keys(svar)) delete svar[k]; qc.clear(); });

  it("rigtig useMessages: dublet på to sider med forskellig status/revision – visning og bevis bruger den samme (ældste sides) kopi", async () => {
    const raekker = Array.from({ length: CHAT_PAGE_SIZE }, (_, i) => ({ id: i === 0 ? ID : `x${i}`, conversation_id: "c", sender_id: "s", content: "x",
      status: i === 0 ? "leveret" : "leveret", revision: i === 0 ? 5 : 1, created_at: new Date(2026, 9, 2, 0, i).toISOString(), reply_to_id: null }));
    const aeldre = [{ id: ID, conversation_id: "c", sender_id: "s", content: "x", status: "afventer_afsender", revision: 4, created_at: new Date(2026, 9, 1).toISOString(), reply_to_id: null }];
    const thenable = (data: unknown) => {
      const b: Record<string, unknown> = {};
      for (const k of ["select", "eq", "is", "order", "in", "range", "neq"]) b[k] = () => b;
      b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(ok);
      return b;
    };
    let side = 0;
    graense.from.mockImplementation((t: string) => (t === "chat_messages" ? thenable(side++ === 0 ? raekker : aeldre) : thenable([])));
    const { result } = renderHook(() => useMessages("c"), { wrapper: wrap });
    await waitFor(() => expect(result.current.hasOlder).toBe(true));
    await act(async () => { result.current.loadOlder(); });
    await waitFor(() => expect(qc.getQueryData<{ pages: unknown[] }>(["chat-messages", "c"])?.pages).toHaveLength(2));
    const vist = result.current.data?.find((m) => m.id === ID);
    expect(vist).toMatchObject({ revision: 4, status: "afventer_afsender" }); // visningsrækkefølgen er uændret
    expect(visningIndarbejdet(qc, { id: ID, forventet: { revision: 5, status: "leveret" }, ejer: { conv: "c" } })).toBe(false);
    expect(visningIndarbejdet(qc, { id: ID, forventet: { revision: 4, status: "afventer_afsender" }, ejer: { conv: "c" } })).toBe(true);
    expect(dedupSider(qc.getQueryData<{ pages: never[][] }>(["chat-messages", "c"])!.pages).find((m) => m.id === ID)).toBe(vist);
  });

  it("direkte succes: genhentning opdaterer kun den ikke-viste kopi → bekræftet snapshot; nyt klik starter intet skrivekald", async () => {
    const { h } = toSider((n) => [raek(n === 1 ? "afventer_afsender" : "leveret", 4)]);
    await vi.waitFor(() => expect(qc.getQueryData<{ pages: unknown[] }>(["chat-messages", "c"])?.pages).toHaveLength(1));
    await act(async () => { await h.result.current.fetchNextPage(); });
    const { result } = renderHook(() => useAfgoer(), { wrapper: wrap });
    const e = ejer(); expect(tagHandling(e, ID, "send", { revision: 4, status: "afventer_afsender" })).toBe(true);
    graense.rpc.mockResolvedValueOnce({ data: true, error: null });
    await result.current.mutateAsync({ messageId: ID, revision: 4, handling: "send", conversationId: "c", ejer: e });
    expect(visningIndarbejdet(qc, forventet)).toBe(false);
    expect(udfaldSnapshot("e", "c", ID)?.bekraeftet).toBe(true);
    expect(tagHandling(ejer(), ID, "send", { revision: 4, status: "afventer_afsender" })).toBe(false);
    expect(graense.rpc).toHaveBeenCalledTimes(1);
  });

  it("direkte succes med paused/offline genhentning og dublet → bekræftet snapshot, ét skrivekald", async () => {
    const { h } = toSider(() => [raek("leveret", 4)]);
    await vi.waitFor(() => expect(qc.getQueryData<{ pages: unknown[] }>(["chat-messages", "c"])?.pages).toHaveLength(1));
    await act(async () => { await h.result.current.fetchNextPage(); });
    const { result } = renderHook(() => useAfgoer(), { wrapper: wrap });
    const e = ejer(); tagHandling(e, ID, "send", { revision: 4, status: "afventer_afsender" });
    graense.rpc.mockImplementationOnce(async () => { onlineManager.setOnline(false); return { data: true, error: null }; });
    await result.current.mutateAsync({ messageId: ID, revision: 4, handling: "send", conversationId: "c", ejer: e });
    expect(udfaldSnapshot("e", "c", ID)?.bekraeftet).toBe(true);
    expect(tagHandling(ejer(), ID, "send", { revision: 4, status: "afventer_afsender" })).toBe(false);
    expect(graense.rpc).toHaveBeenCalledTimes(1);
  });

  it("direkte succes uden observer (afmonteret liste): nyere kopi kun på side 0 frigiver ikke det viste grundlag", async () => {
    qc.setQueryData(["chat-messages", "c"], { pages: [[raek("leveret", 4)], [raek("afventer_afsender", 4)]], pageParams: [0, 1] });
    const { result } = renderHook(() => useAfgoer(), { wrapper: wrap });
    const e = ejer(); tagHandling(e, ID, "send", { revision: 4, status: "afventer_afsender" });
    graense.rpc.mockResolvedValueOnce({ data: true, error: null });
    await result.current.mutateAsync({ messageId: ID, revision: 4, handling: "send", conversationId: "c", ejer: e });
    expect(udfaldSnapshot("e", "c", ID)?.bekraeftet).toBe(true);
    expect(tagHandling(ejer(), ID, "send", { revision: 4, status: "afventer_afsender" })).toBe(false);
    expect(graense.rpc).toHaveBeenCalledTimes(1);
  });

  it("tilbageholdt genhentning, der kun opdaterer side 0: låsen holdes til svaret, derefter bekræftet snapshot", async () => {
    let slip!: (v: unknown[]) => void;
    const { h } = toSider((n) => (n <= 1 ? [raek("afventer_afsender", 4)] : new Promise<unknown[]>((x) => { slip = x; })));
    await vi.waitFor(() => expect(qc.getQueryData<{ pages: unknown[] }>(["chat-messages", "c"])?.pages).toHaveLength(1));
    await act(async () => { await h.result.current.fetchNextPage(); });
    const { result } = renderHook(() => useAfgoer(), { wrapper: wrap });
    const e = ejer(); tagHandling(e, ID, "send", { revision: 4, status: "afventer_afsender" });
    graense.rpc.mockResolvedValueOnce({ data: true, error: null });
    const p = result.current.mutateAsync({ messageId: ID, revision: 4, handling: "send", conversationId: "c", ejer: e });
    await vi.waitFor(() => expect(typeof slip).toBe("function"));
    expect(aktiveHandlinger()).toBe(1);
    expect(tagHandling(ejer(), ID, "send", { revision: 4, status: "afventer_afsender" })).toBe(false);
    slip([raek("leveret", 4)]);
    await p;
    expect(udfaldSnapshot("e", "c", ID)?.bekraeftet).toBe(true);
    expect(aktiveHandlinger()).toBe(0);
    expect(graense.rpc).toHaveBeenCalledTimes(1);
  });

  it("»Tjek igen« bekræfter rækken, men genhentningen opdaterer kun den ikke-viste kopi → bekræftet, ingen skrivning", async () => {
    const { h } = toSider((n) => [raek(n === 1 ? "afventer_afsender" : "leveret", 4)]);
    await vi.waitFor(() => expect(qc.getQueryData<{ pages: unknown[] }>(["chat-messages", "c"])?.pages).toHaveLength(1));
    await act(async () => { await h.result.current.fetchNextPage(); });
    const { result } = renderHook(() => useAfgoer(), { wrapper: wrap });
    const e = ejer(); tagHandling(e, ID, "send", { revision: 4, status: "afventer_afsender" });
    graense.rpc.mockResolvedValueOnce({ data: null, error: { message: "Failed to fetch" } });
    svar.chat_messages = [msg({ status: "afventer_afsender", revision: 4, content: "x", attachment_path: null })];
    await result.current.mutateAsync({ messageId: ID, revision: 4, handling: "send", conversationId: "c", ejer: e }).catch(() => null);
    svar.chat_messages = [msg({ status: "leveret", revision: 4, content: "x", attachment_path: null })];
    expect(await tjekUdfaldIgen(qc, "e", "c", ID)).toBe("ukendt");
    expect(udfaldSnapshot("e", "c", ID)?.bekraeftet).toBe(true);
    expect(tagHandling(ejer(), ID, "send", { revision: 4, status: "afventer_afsender" })).toBe(false);
    expect(graense.rpc).toHaveBeenCalledTimes(1);
  });
});

describe("B2bc-5a §3 – trådens hentesekvens: kun requests startet efter hændelsen er bevis (rigtig useMessages)", () => {
  let qc: QueryClient;
  const wrap = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
  type Ctl = { res: (d: unknown[]) => void };
  const koe: Ctl[] = [];
  const styret = () => {
    const b: Record<string, unknown> = {};
    for (const k of ["select", "eq", "is", "order", "in", "range", "neq"]) b[k] = () => b;
    const p = new Promise<unknown[]>((res) => koe.push({ res }));
    b.then = (ok: (v: unknown) => unknown, fejl?: (e: unknown) => unknown) => p.then((data) => ({ data, error: null })).then(ok, fejl);
    return b;
  };
  const tom = () => { const b: Record<string, unknown> = {}; for (const k of ["select", "eq", "is", "order", "in", "range", "neq"]) b[k] = () => b; b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok); return b; };
  const r = (content: string) => [{ id: "m", conversation_id: "c5", sender_id: "s", content, status: "leveret", revision: 1, created_at: new Date(2026, 9, 1).toISOString(), reply_to_id: null }];
  beforeEach(() => {
    koe.length = 0;
    qc = new QueryClient({ defaultOptions: { mutations: { retry: 1 }, queries: { retry: false } } });
    graense.from.mockImplementation((t: string) => (t === "chat_messages" ? styret() : tom()));
  });
  afterEach(() => { for (const k of koe.splice(0)) k.res([]); graense.from.mockReset(); qc.clear(); });

  it("gammelt trådrequest afslutter efter hændelsen: data skifter, men hentStart beviser intet; nyt request gør", async () => {
    const { result } = renderHook(() => useMessages("c5"), { wrapper: wrap });
    await vi.waitFor(() => expect(koe).toHaveLength(1));
    await act(async () => { koe[0].res(r("v1")); });
    await waitFor(() => expect(result.current.data?.[0]?.content).toBe("v1"));
    // Gammelt request starter …
    void act(() => { void qc.refetchQueries({ queryKey: ["chat-messages", "c5"] }); });
    await vi.waitFor(() => expect(koe).toHaveLength(2));
    const haendelse = traadHentSekvens("c5"); // … hændelsen kommer efter starten
    await act(async () => { koe[1].res(r("gammel")); });
    await waitFor(() => expect(result.current.data?.[0]?.content).toBe("gammel"));
    expect(result.current.hentStart).toBeLessThanOrEqual(haendelse); // dataUpdatedAt er nyere, men det er ikke bevis
    void act(() => { void qc.invalidateQueries({ queryKey: ["chat-messages", "c5"] }); });
    await vi.waitFor(() => expect(koe).toHaveLength(3));
    await act(async () => { koe[2].res(r("ny")); });
    await waitFor(() => expect(result.current.data?.[0]?.content).toBe("ny"));
    expect(result.current.hentStart).toBeGreaterThan(haendelse);
  });

  it("sen gammel afslutning efter nyt svar ændrer hverken data eller bevis", async () => {
    const { result } = renderHook(() => useMessages("c5"), { wrapper: wrap });
    await vi.waitFor(() => expect(koe).toHaveLength(1));
    await act(async () => { koe[0].res(r("v1")); });
    await waitFor(() => expect(result.current.data?.[0]?.content).toBe("v1"));
    void act(() => { void qc.refetchQueries({ queryKey: ["chat-messages", "c5"] }); });
    await vi.waitFor(() => expect(koe).toHaveLength(2));
    const haendelse = traadHentSekvens("c5");
    void act(() => { void qc.invalidateQueries({ queryKey: ["chat-messages", "c5"] }); }); // annullerer det gamle
    await vi.waitFor(() => expect(koe).toHaveLength(3));
    await act(async () => { koe[2].res(r("ny")); });
    await waitFor(() => expect(result.current.data?.[0]?.content).toBe("ny"));
    await act(async () => { koe[1].res(r("gammel")); await new Promise((x) => setTimeout(x, 0)); });
    expect(result.current.data?.[0]?.content).toBe("ny");
    expect(result.current.hentStart).toBeGreaterThan(haendelse);
  });
});

describe("B2bc-5b §2 – fristlager: render læser, effekt registrerer; oprydning uden monteret boble", () => {
  it("erKendtUdloebet skriver ikke: kasseret render efterlader intet udløbsbevis; urhop −690 ms efter registrering genopliver intet", async () => {
    const { erKendtUdloebet, kontrollerUdloeb, harKendtUdloebet } = await import("./useChat");
    const frist = new Date(10_000).toISOString();
    expect(erKendtUdloebet("e", "c5b", "m1", frist, 10_001)).toBe(true); // render ser udløb ved eget ur
    expect(harKendtUdloebet("e", "c5b", "m1")).toBe(false);              // men intet er registreret
    expect(erKendtUdloebet("e", "c5b", "m1", frist, 10_001 - 690)).toBe(false); // uregistreret: ingen bevis
    expect(kontrollerUdloeb("e", "c5b", "m1", frist, 10_001)).toMatchObject({ udloebet: true, ny: true });
    expect(kontrollerUdloeb("e", "c5b", "m1", frist, 10_001)).toMatchObject({ udloebet: true, ny: false }); // ingen løkke
    expect(erKendtUdloebet("e", "c5b", "m1", frist, 10_001 - 690)).toBe(true);
    // B2-6C: ny frist/null uden startbevis er ikke bevis; dokumenteret nyere data (læsning startet efter) afslutter.
    expect(kontrollerUdloeb("e", "c5b", "m1", new Date(99_000).toISOString(), 10_500).udloebet).toBe(true);
    const { laesStart } = await import("@/lib/sbKladder");
    expect(kontrollerUdloeb("e", "c5b", "m1", new Date(99_000).toISOString(), 10_500, laesStart()).udloebet).toBe(false);
    expect(harKendtUdloebet("e", "c5b", "m1")).toBe(false);
    kontrollerUdloeb("e", "c5b", "m2", frist, 10_001);
    expect(kontrollerUdloeb("e", "c5b", "m2", null, 10_001, laesStart()).udloebet).toBe(false);
    expect(harKendtUdloebet("e", "c5b", "m2")).toBe(false);
  });
  it("fristOprydning rydder gemt redigeringskladde og Ret-lås for id'et; andre id'ers kladder og en fysisk Gem-lås røres ikke", async () => {
    const { fristOprydning, tagHandling, handlingFor, overtagTilGem } = await import("./useChat");
    const { gemRetKladde, laesRetKladde } = await import("@/lib/sbKladder");
    gemRetKladde("e", "c5o", { beskedId: "x", tekst: "kladde", revision: 1 });
    gemRetKladde("e", "c5o", { beskedId: "y", tekst: "anden", revision: 1 });
    const ejer = fastholdEjer("e", "c5o", "u")!;
    expect(tagHandling(ejer, "x", "ret")).toBe(true);
    const ejer2 = fastholdEjer("e", "c5o", "u")!;
    expect(tagHandling(ejer2, "g", "ret")).toBe(true);
    expect(overtagTilGem(ejer2, "g", { revision: 1, status: "leveret" })).toBe(true);
    fristOprydning("e", "c5o", "x");
    fristOprydning("e", "c5o", "g");
    expect(laesRetKladde("e", "c5o", "x")).toBeNull();
    expect(laesRetKladde("e", "c5o", "y")?.tekst).toBe("anden");
    expect(handlingFor("e", "c5o", "x").art).toBeNull();
    expect(handlingFor("e", "c5o", "g").art).toBe("gem"); // fysisk arbejde beholder pladsen til egen afslutning
  });
});

// ---------- B2d-2 T12 (§12): sletning/forladelse gennem rigtig useDeleteConversation ----------
import { useDeleteConversation, rydSlettetSamtale, registrerSamtaleStop, handlingFor, ForaeldetSession } from "./useChat";
import { gemKladde, laesKladde, tilfoejAfsendelse, hentAfsendelser, gemRetKladde, laesRetKladde, sessionsGeneration as genNu } from "@/lib/sbKladder";
describe("T12 §12 sletning, forladelse og kladdeoprydning", () => {
  let qc12: QueryClient;
  // Antagelse (ikke SQL-bevis): RLS lader DELETE returnere rækken ved tilladt sletning og 0 rækker ved afvisning.
  const tabeller = (o: { conv: Record<string, unknown>; slettet: boolean }) => (t: string) => {
    const b: Record<string, unknown> = {};
    const res = () => ({ data: t === "chat_conversations" || t === "chat_conversation_members" ? (o.slettet ? [{ id: "x" }] : []) : null, error: null });
    Object.assign(b, {
      select: () => b, eq: () => b, delete: () => b, abortSignal: () => b,
      single: () => Promise.resolve({ data: o.conv, error: null }),
      then: (ok: (v: unknown) => unknown, f?: (e: unknown) => unknown) => Promise.resolve(res()).then(ok, f),
    });
    return b;
  };
  const afsPost = { id: "p1", tekst: "t", svarId: null, fil: null, tilstand: "afstemmer" as const, fejl: null, tidligereUkendt: false, oprettet: 1 };
  const stop = vi.fn();
  beforeEach(() => {
    rydAlleKladder();
    qc12 = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: 1 } } });
    graense.rpc.mockImplementation(async () => ({ data: "e", error: null }));
    registrerSamtaleStop(stop); stop.mockReset();
    gemKladde("e", "S", { tekst: "kladde", svarId: null });
    gemRetKladde("e", "S", { beskedId: "m", tekst: "ret", revision: 1 });
    tilfoejAfsendelse("e", "S", afsPost);
    gemKladde("e", "T", { tekst: "anden samtale", svarId: null });
  });
  afterEach(() => { graense.from.mockReset(); graense.rpc.mockReset(); qc12.clear(); registrerSamtaleStop(() => {}); });
  const w = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc12 }, children);

  it("bekræftet sletning: stopvej først, derefter kun samtalens kladde/ret-kladde/pending ryddet", async () => {
    graense.from.mockImplementation(tabeller({ conv: { created_by: "e", is_group: true, direct_key: null }, slettet: true }));
    let ryddetVedStop: boolean | null = null;
    stop.mockImplementation(() => { ryddetVedStop = laesKladde("e", "S") === null; });
    const { result } = renderHook(() => useDeleteConversation(), { wrapper: w });
    await act(async () => { await result.current.slet("S"); });
    expect(stop).toHaveBeenCalledWith("e", "S");
    expect(ryddetVedStop).toBe(false); // invalidering før rydning
    expect(laesKladde("e", "S")).toBeNull();
    expect(laesRetKladde("e", "S", "m")).toBeNull();
    expect(hentAfsendelser("e", "S")).toEqual([]);
    expect(laesKladde("e", "T")?.tekst).toBe("anden samtale");
    // Sent callback (fx ChatViews autogem) genskaber intet.
    gemKladde("e", "S", { tekst: "sen", svarId: null });
    expect(laesKladde("e", "S")).toBeNull();
  });

  it("bekræftet forladelse af gruppe (ikke opretter) rydder; afvist forladelse og afvist sletning bevarer; retry:0", async () => {
    graense.from.mockImplementation(tabeller({ conv: { created_by: "anden", is_group: true, direct_key: null }, slettet: false }));
    const { result } = renderHook(() => useDeleteConversation(), { wrapper: w });
    await act(async () => { await expect(result.current.slet("S")).rejects.toThrow("Kunne ikke forlade gruppen"); });
    expect(graense.from.mock.calls.filter(([t]) => t === "chat_conversations").length).toBe(1); // ingen automatisk gentagelse
    expect(laesKladde("e", "S")?.tekst).toBe("kladde");
    expect(stop).not.toHaveBeenCalled();
    graense.from.mockImplementation(tabeller({ conv: { created_by: "anden", is_group: true, direct_key: null }, slettet: true }));
    await act(async () => { await result.current.slet("S"); });
    expect(laesKladde("e", "S")).toBeNull();
  });

  it("nøglebundet direkte samtale afvises før DELETE og bevarer kladden", async () => {
    const kaldte: string[] = [];
    graense.from.mockImplementation((t: string) => { kaldte.push(t); return tabeller({ conv: { created_by: "e", is_group: false, direct_key: "k" }, slettet: true })(t); });
    const { result } = renderHook(() => useDeleteConversation(), { wrapper: w });
    await act(async () => { await expect(result.current.slet("S")).rejects.toThrow("Direkte samtaler kan ikke slettes"); });
    expect(kaldte).toEqual(["chat_conversations"]);
    expect(laesKladde("e", "S")?.tekst).toBe("kladde");
  });

  it("logud under sletningen: handlingens gamle generation rydder intet i den nye session", async () => {
    let løs!: (v: unknown) => void;
    graense.from.mockImplementation((t: string) => {
      const b = tabeller({ conv: { created_by: "e", is_group: true, direct_key: null }, slettet: true })(t) as Record<string, unknown>;
      if (t === "chat_conversations") b.single = () => new Promise((r) => { løs = r; });
      return b;
    });
    const { result } = renderHook(() => useDeleteConversation(), { wrapper: w });
    let p!: Promise<unknown>;
    act(() => { p = result.current.slet("S"); });
    await vi.waitFor(() => expect(løs).toBeTypeOf("function"));
    rydAlleKladder(); // logud/brugerskift
    expect(laesKladde("e", "S")).toBeNull(); // logud rydder brugerens tilstand
    gemKladde("e", "S", { tekst: "ny brugers kladde", svarId: null });
    await act(async () => { løs({ data: { created_by: "e", is_group: true, direct_key: null }, error: null }); await expect(p).rejects.toBeInstanceOf(ForaeldetSession); });
    expect(stop).not.toHaveBeenCalled();
    expect(laesKladde("e", "S")?.tekst).toBe("ny brugers kladde");
    rydSlettetSamtale("e", "S", genNu() - 1);
    expect(laesKladde("e", "S")?.tekst).toBe("ny brugers kladde");
  });

  it("lokale editorlåse ryddes; fysisk Gem beholder sin lås til egen afslutning", async () => {
    auth("SIGNED_IN", "u");
    const ejer = fastholdEjer("e", "S", "u")!;
    expect(tagHandling(ejer, "r", "ret")).toBe(true);
    expect(tagHandling(fastholdEjer("e", "S", "u"), "g", "gem")).toBe(true);
    rydSlettetSamtale("e", "S", genNu());
    expect(handlingFor("e", "S", "r").art).toBeNull();
    expect(handlingFor("e", "S", "g").art).toBe("gem");
  });
});

// ---------- B2-6B §B: sletning/forladelse ved sessionsskift, genoptaget gruppe, rigtig SDK ----------
import { fastholdSession, sessionGyldig, rydSamtale, laesStart, genoptagSamtale, samtaleRyddet, ejerGyldig as ejerOk, tilfoejAfsendelse as tilfoej6, hentAfsendelser as hent6, gemKladde as gem6, laesKladde as laes6, saetAfsendelsesFil, afsendelsesFil, sessionsGeneration as gen6 } from "@/lib/sbKladder";
import { useDeleteConversation as useSlet6, ForaeldetSession as Foraeldet6 } from "./useChat";
describe("B2-6B §B sletning/forladelse: sessionsskift ved hvert ventepunkt", () => {
  let qc6: QueryClient;
  const w6 = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc6 }, children);
  afterEach(() => { graense.from.mockReset(); graense.rpc.mockReset(); graense.rpc.mockImplementation(async () => ({ data: "e", error: null })); qc6.clear(); });
  // Trin 0 = medarbejderopslag (rpc), 1 = samtaleopslag, 2–4 = DELETE beskeder/medlemmer/samtale (opretter-sletning).
  for (const trin of [0, 1, 2, 3, 4]) {
    it(`trin ${trin} holdt + sessionsskift: nul efterfølgende skrivninger, ingen rydning, ingen genvalidering`, async () => {
      rydAlleKladder();
      qc6 = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: 1 } } });
      const inval = vi.spyOn(qc6, "invalidateQueries");
      gem6("e", "S", { tekst: "kladde", svarId: null });
      let løs!: () => void;
      const holdt = <T,>(v: T) => new Promise<T>((r) => { løs = () => r(v); });
      let n = 0;
      const skriv: string[] = [];
      graense.rpc.mockImplementation(() => { const r = { data: "e", error: null }; const p = n++ === trin ? holdt(r) : Promise.resolve(r); return Object.assign(p, { abortSignal: () => p }); });
      graense.from.mockImplementation((t: string) => {
        const b: Record<string, unknown> = {};
        let sletter = false;
        const svarFor = () => ({ data: t === "chat_messages" ? null : [{ id: "x" }], error: null });
        const vent = <T,>(v: T) => (n++ === trin ? holdt(v) : Promise.resolve(v));
        Object.assign(b, {
          select: () => b, eq: () => b, abortSignal: () => b,
          delete: () => { sletter = true; skriv.push(t); return b; },
          single: () => vent({ data: { created_by: "e", is_group: true, direct_key: null }, error: null }),
          then: (ok: (v: unknown) => unknown, f?: (e: unknown) => unknown) => (sletter ? vent(svarFor()) : Promise.resolve(svarFor())).then(ok, f),
        });
        return b;
      });
      const { result } = renderHook(() => useSlet6(), { wrapper: w6 });
      let p!: Promise<unknown>;
      act(() => { p = result.current.slet("S"); });
      await vi.waitFor(() => expect(løs).toBeTypeOf("function"));
      const skrevetFoer = skriv.length;
      rydAlleKladder(); // logud/brugerskift
      gem6("e", "S", { tekst: "ny session", svarId: null });
      const invFoer = inval.mock.calls.length;
      await act(async () => { løs(); await expect(p).rejects.toBeInstanceOf(Foraeldet6); });
      expect(skriv.length).toBe(skrevetFoer);
      expect(laes6("e", "S")?.tekst).toBe("ny session");
      expect(inval.mock.calls.length).toBe(invFoer);
    });
  }
});

describe("B2-6B §B genoptaget gruppe i samme session", () => {
  beforeEach(() => { rydAlleKladder(); });
  it("lukning spærrer; kun læsning startet EFTER lukning genoptager; gamle ejere/callbacks forbliver ugyldige", () => {
    auth("SIGNED_IN", "u");
    const gammel = fastholdEjer("e", "G", "u")!;
    const gammelStart = laesStart(); // læsning startet før lukningen
    rydSamtale("e", "G");
    expect(samtaleRyddet("e", "G")).toBe(true);
    expect(genoptagSamtale("e", "G", gammelStart, gen6())).toBe(false); // vilkårlig gammel cacheindlæsning
    expect(samtaleRyddet("e", "G")).toBe(true);
    const a = { id: "n1", tekst: "t", svarId: null, fil: null, tilstand: "sender" as const, fejl: null, tidligereUkendt: false, oprettet: 1 };
    expect(tilfoej6("e", "G", a)).toBe(false); // tavs bortkastning er nu et kontrollerbart resultat
    expect(genoptagSamtale("e", "G", laesStart(), gen6())).toBe(true);
    // Ny forløb: gem kladde, send tekst og fil → præcis én accepteret afsendelse pr. handling.
    gem6("e", "G", { tekst: "ny kladde", svarId: null });
    const ny = fastholdEjer("e", "G", "u")!;
    expect(tilfoej6("e", "G", a, null, ny)).toBe(true);
    const f = new File(["x"], "f.txt");
    expect(tilfoej6("e", "G", { ...a, id: "n2" }, f, ny)).toBe(true);
    expect(hent6("e", "G").map((x) => x.id)).toEqual(["n1", "n2"]);
    // Gamle callbacks fra det tidligere forløb: ugyldig ejer, ingen ny post, ingen File, kladden urørt.
    expect(ejerOk(gammel)).toBe(false);
    expect(tilfoej6("e", "G", { ...a, id: "g1" }, null, gammel)).toBe(false);
    saetAfsendelsesFil("e", "G", "g2", new File(["y"], "g.txt"));
    expect(afsendelsesFil("e", "G", "g2")).toBeNull();
    expect(hent6("e", "G").map((x) => x.id)).toEqual(["n1", "n2"]);
    expect(laes6("e", "G")?.tekst).toBe("ny kladde");
  });

  it("fastholdt session: tokenrefresh for samme bruger gyldig; logud/brugerskift ugyldig og signal afbrudt", () => {
    auth("SIGNED_IN", "u");
    const s = fastholdSession();
    auth("TOKEN_REFRESHED", "u");
    expect(sessionGyldig(s)).toBe(true);
    expect(s.signal.aborted).toBe(false);
    auth("SIGNED_IN", "v"); // brugerskift
    expect(sessionGyldig(s)).toBe(false);
    expect(s.signal.aborted).toBe(true);
  });
});

describe("B2-6B §B rigtig SDK med mocket HTTP: stop under tokenventepunkt", () => {
  // Rigtig supabase-js-klient; HTTP mockes ved fetch. Mocken opfører sig som platformens fetch: et afbrudt signal
  // afvises uden transport. Kun ikke-afbrudte kald tælles som transport.
  async function kør(stop: boolean) {
    rydAlleKladder();
    let tokenLøs!: (t: string) => void;
    const transport: string[] = [];
    const hentFn = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.signal?.aborted) throw new DOMException("afbrudt", "AbortError");
      transport.push(String(url));
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    });
    const klient = createClient("http://lokal.test", "anon", {
      accessToken: () => new Promise<string>((r) => { tokenLøs = r; }),
      global: { fetch: hentFn },
    });
    const s = fastholdSession();
    const p = klient.from("chat_conversation_members").delete().eq("conversation_id", "S").abortSignal(s.signal);
    const r = p.then((x) => x, (e: unknown) => ({ data: null, error: e }));
    await vi.waitFor(() => expect(tokenLøs).toBeTypeOf("function"));
    if (stop) rydAlleKladder();
    tokenLøs("jwt");
    await r;
    return { transport, gyldig: sessionGyldig(s) };
  }
  it("stop under tokenventen forhindrer gammel transport", async () => {
    const { transport, gyldig } = await kør(true);
    expect(gyldig).toBe(false);
    expect(transport).toEqual([]);
  });
  it("positiv kontrol uden stop: præcis én transport", async () => {
    const { transport } = await kør(false);
    expect(transport.length).toBe(1);
  });
});

// ---------- B2-7 §2: transportstop ved sessionsophør gennem rigtig SDK og mocket HTTP ----------
import { ejerSignal, ejerPasser as ejerPasser7 } from "@/lib/sbKladder";
import { useEditMessage as useRet7, useAfgoer as useAfgoer7, useFjernFil as useFjern7, tagHandling as tag7, aktiveHandlinger as aktive7, sendBesked as send7, SendFejl as SendFejl7, useCreateConversation as useOpret7, useDeleteConversation as useSlet7, ForaeldetSession as Foraeldet7 } from "./useChat";

describe("B2-7 §2 – fire skriveveje: logud/brugerskift under skrivekaldets tokenvent giver nul transport", () => {
  // Rigtig supabase-js; HTTP mockes ved fetch som platformen: et afbrudt signal afvises uden transport.
  let transport: string[] = [];
  let tokenOpslag = 0;
  let holdFra = Number.POSITIVE_INFINITY;
  const holdte: Array<() => void> = [];
  const slip = () => { for (const x of holdte.splice(0)) x(); };
  const svarHttp: { krop: string } = { krop: "true" };
  let sentSvar: (() => void) | null = null;
  let holdSvar = false;
  const hentFn = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    if (init?.signal?.aborted) throw new DOMException("afbrudt", "AbortError");
    transport.push(String(url));
    // Allerede afsendt: serveren kan have gennemført; et senere afbrudt signal afviser svaret som fetch gør.
    if (holdSvar) await new Promise<void>((x, afvis) => { sentSvar = x; init?.signal?.addEventListener("abort", () => afvis(new DOMException("afbrudt", "AbortError"))); });
    return new Response(svarHttp.krop, { status: 201, headers: { "content-type": "application/json" } });
  });
  const klient = createClient("http://lokal.test", "anon", {
    // Tokenopslag før holdFra (fx SDK'ets initiale opslag ved oprettelse) besvares straks; skrivekaldets eget holdes.
    accessToken: () => { const n = ++tokenOpslag; return n > holdFra ? new Promise<string>((x) => { holdte.push(() => x("jwt")); }) : Promise.resolve("jwt"); },
    global: { fetch: hentFn },
  });
  let qc: QueryClient;
  const wrap = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
  const ID = "m7";
  beforeEach(async () => {
    qc = new QueryClient({ defaultOptions: { mutations: { retry: 1, retryDelay: 0 }, queries: { retry: false } } });
    transport = []; holdte.length = 0; sentSvar = null; holdSvar = false; svarHttp.krop = "true";
    await Promise.resolve();
    holdFra = tokenOpslag; // alt derefter er skrivekaldets eget ventepunkt
    auth("SIGNED_OUT", null); auth("SIGNED_IN", "u");
    graense.rpc.mockReset().mockImplementation((n: unknown, a: unknown) => klient.rpc(String(n), typeof a === "object" && a !== null ? { ...a } : {}));
    graense.from.mockImplementation((t: string) => ({ ...builder(t), insert: (r: unknown) => { kald.push(`insert:${t}`); return klient.from(t).insert(typeof r === "object" && r !== null ? { ...r } : {}); } }));
  });
  afterEach(async () => {
    slip(); sentSvar?.();
    graense.rpc.mockReset(); graense.from.mockReset();
    await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
    expect(aktive7()).toBe(0);
    qc.clear();
  });
  const ventPaaToken = () => vi.waitFor(() => expect(holdte.length).toBe(1));

  type Vej = "insert" | "sb_ret" | "sb_afgoer" | "sb_fjern_fil";
  async function start(vej: Vej) {
    const e = fastholdEjer("e", "c", "u")!;
    if (vej === "insert") {
      svar.chat_messages = [msg(null), msg(null), msg(null)];
      return { p: send7(v, "e", () => ejerPasser7(e, "c"), () => ejerSignal(e)).then(() => "ok", (x: unknown) => x), unmount: () => undefined };
    }
    svar.chat_messages = [msg({ status: "afventer_afsender", revision: 1, content: "x", attachment_path: null })];
    svarHttp.krop = vej === "sb_afgoer" ? "true" : "2";
    if (vej === "sb_ret") {
      const h = renderHook(() => useRet7(), { wrapper: wrap }); tag7(e, ID, "gem");
      return { p: h.result.current.mutateAsync({ messageId: ID, content: "x", conversationId: "c", revision: 1, ejer: e }).then(() => "ok", (x: unknown) => x), unmount: h.unmount };
    }
    if (vej === "sb_afgoer") {
      const h = renderHook(() => useAfgoer7(), { wrapper: wrap }); tag7(e, ID, "send");
      return { p: h.result.current.mutateAsync({ messageId: ID, revision: 1, handling: "send", conversationId: "c", ejer: e }).then(() => "ok", (x: unknown) => x), unmount: h.unmount };
    }
    const h = renderHook(() => useFjern7(), { wrapper: wrap }); tag7(e, ID, "fjern");
    return { p: h.result.current.mutateAsync({ messageId: ID, revision: 1, conversationId: "c", ejer: e, filRef: null }).then(() => "ok", (x: unknown) => x), unmount: h.unmount };
  }
  const veje: Vej[] = ["insert", "sb_ret", "sb_afgoer", "sb_fjern_fil"];

  for (const vej of veje) {
    for (const [navn, skift] of [["logud", () => auth("SIGNED_OUT", null)], ["brugerskift", () => auth("SIGNED_IN", "u2")]] as const) {
      it(`${vej}: ${navn} under skrivekaldets tokenventen → nul HTTP-transport, ingen falsk succes`, async () => {
        const { p, unmount } = await start(vej);
        await ventPaaToken();
        skift();
        slip();
        const r = await p;
        expect(transport).toEqual([]);
        expect(r).not.toBe("ok");
        if (vej === "insert") expect(r instanceof SendFejl7 ? r.art : null).toBe("ukendt");
        unmount();
      });
    }
    it(`${vej}: positiv kontrol uden stop → præcis ét HTTP-kald`, async () => {
      const { p, unmount } = await start(vej);
      await ventPaaToken();
      slip();
      await p;
      expect(transport).toHaveLength(1);
      expect(transport[0]).toContain(vej === "insert" ? "/rest/v1/chat_messages" : `/rest/v1/rpc/${vej}`);
      unmount();
    });
    it(`${vej}: allerede sendt kald med sent svar efter logud → ukendt/stoppet, ingen ny skrivning`, async () => {
      holdSvar = true;
      const { p, unmount } = await start(vej);
      await ventPaaToken();
      slip();
      await vi.waitFor(() => expect(transport).toHaveLength(1));
      auth("SIGNED_OUT", null);
      sentSvar?.();
      const r = await p;
      expect(r).not.toBe("ok");
      expect(transport).toHaveLength(1);
      expect(kald.filter((k) => k === "insert:chat_messages").length).toBeLessThanOrEqual(1);
      unmount();
    });
  }
});

describe("B2-7 §1 – afviste ventepunkter i oprettelse og sletning efter sessionsskift → ForaeldetSession", () => {
  let qc: QueryClient;
  const wrap = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
  beforeEach(() => { qc = new QueryClient({ defaultOptions: { mutations: { retry: 1, retryDelay: 0 } } }); auth("SIGNED_OUT", null); auth("SIGNED_IN", "u"); });
  afterEach(() => { vi.mocked(supabase.auth.getUser).mockReset(); /* vitest 3: mockReset gendanner den typede grænsemock */ qc.clear(); });
  const holdtIdentitet = () => {
    const h: { afvis: ((e: Error) => void) | null } = { afvis: null };
    vi.mocked(supabase.auth.getUser).mockImplementationOnce(() => new Promise((_, r) => { h.afvis = r; }));
    return h;
  };
  it("oprettelse: identitetsopslag afvises efter logud → ForaeldetSession, ingen RPC", async () => {
    const afvis = holdtIdentitet();
    const { result, unmount } = renderHook(() => useOpret7(), { wrapper: wrap });
    graense.rpc.mockClear();
    const p = result.current.opret({ name: "", memberIds: ["x"], isGroup: false })!.then(() => null, (x: unknown) => x);
    await vi.waitFor(() => expect(afvis.afvis).toBeTypeOf("function"));
    auth("SIGNED_OUT", null);
    afvis.afvis?.(new Error("Not authenticated"));
    expect(await p).toBeInstanceOf(Foraeldet7);
    expect(graense.rpc.mock.calls.filter((c) => String(c[0]).startsWith("sb_chat_start"))).toHaveLength(0);
    unmount();
  });
  it("sletning: identitetsopslag afvises efter brugerskift → ForaeldetSession, ingen DELETE", async () => {
    const afvis = holdtIdentitet();
    kald.length = 0;
    const { result, unmount } = renderHook(() => useSlet7(), { wrapper: wrap });
    const p = result.current.slet("c").then(() => null, (x: unknown) => x);
    await vi.waitFor(() => expect(afvis.afvis).toBeTypeOf("function"));
    auth("SIGNED_IN", "u2");
    afvis.afvis?.(new Error("Not authenticated"));
    expect(await p).toBeInstanceOf(Foraeldet7);
    expect(kald.filter((k) => k.startsWith("delete:"))).toHaveLength(0);
    unmount();
  });
  it("kontrol: samme afvisning uden sessionsskift bevarer den oprindelige fejl", async () => {
    const afvis = holdtIdentitet();
    const { result, unmount } = renderHook(() => useSlet7(), { wrapper: wrap });
    const p = result.current.slet("c").then(() => null, (x: unknown) => x);
    await vi.waitFor(() => expect(afvis.afvis).toBeTypeOf("function"));
    afvis.afvis?.(new Error("Not authenticated"));
    const e = await p;
    expect(e).not.toBeInstanceOf(Foraeldet7);
    expect(e instanceof Error ? e.message : null).toBe("Not authenticated");
    unmount();
  });
});
