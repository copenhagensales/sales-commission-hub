import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fastholdEjer, rydAlleKladder, registrerKladdeOprydning } from "@/lib/sbKladder";

/** c3 §7: rigtige auth-callbacks (registreret én gang i modulet). */
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
  rpc: vi.fn<(...a: unknown[]) => Promise<unknown>>(async () => ({ data: "e", error: null })),
  invoke: vi.fn<(...a: unknown[]) => Promise<unknown>>(async () => ({ error: null })),
  from: vi.fn<(t: string) => unknown>(),
  session: vi.fn<() => Promise<unknown>>(async () => ({ data: { session: { access_token: "jwt-u", user: { id: "u" } } }, error: null })),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (t: string) => (graense.from.getMockImplementation() ? graense.from(t) : builder(t)),
    rpc: graense.rpc,
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u" } } })), onAuthStateChange: vi.fn(),
      getSession: graense.session },
    functions: { invoke: graense.invoke },
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
  let hold = 0;
  const nySti = (sti: string, status = "uploadet") => stier.set(sti, { bucket: "chat-attachments", sti, ejer_employee_id: "e", samtale_id: "c", status, besked_id: null });
  const oprydning = (sti: string) => { const s = stier.get(sti); if (s && s.besked_id === null && s.status === "uploadet") s.status = "slettes"; };
  const udfoer = (row: { id: string; conversation_id: string; sender_id: string; attachment_path: string | null }) => {
    if (!bindFoerPk && rækker.has(row.id)) return { error: { code: "23505", message: "duplicate key" } }; // tilbageført, ingen binding
    if (row.attachment_path) {
      const s = stier.get(row.attachment_path);
      if (!s || s.besked_id !== null || s.status !== "uploadet" || s.ejer_employee_id !== row.sender_id || s.samtale_id !== row.conversation_id)
        return { error: { code: "P0001", message: IKKE_REGISTRERET_TEKST } }; // tilbageført
      s.besked_id = row.id; s.status = "bundet";
      // B2b-3b §3: bindingen udføres før primærnøglekonflikten; konflikten tilbagefører taberens binding.
      if (bindFoerPk && rækker.has(row.id)) { s.besked_id = null; s.status = "uploadet"; return { error: { code: "23505", message: "duplicate key" } }; }
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
  return { stier, rækker, holdte, nySti, oprydning, holdNaeste: () => { hold++; } };
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
      expect(graense.invoke.mock.calls.map((x) => (x[1] as { body: { revision: number } }).body.revision)).toEqual([2, 3]);
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
    expect((e as Error).name).toBe("HandlingsFejl");
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
    expect(f).toBeInstanceOf(HandlingsFejl); expect((f as HandlingsFejl).art).toBe("konflikt");
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
    expect((f as HandlingsFejl).art).toBe("ukendt");
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
    expect((f as HandlingsFejl).art).toBe("stoppet");
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
