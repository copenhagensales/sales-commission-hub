import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor, within, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";

const mutateAsync = vi.fn();
const beskeder = vi.hoisted(() => ({ liste: [] as unknown[], ægteSend: false, ægteFil: false, opdateret: 0 }));
const kvitMutate = vi.hoisted(() => ({ fn: (() => undefined) as (...a: unknown[]) => void }));
const lagerUpload = vi.hoisted(() => ({ fn: null as null | ((...a: unknown[]) => Promise<{ error: unknown }>) }));
const afstemKun = vi.fn(async () => "ikke_fundet");
const udstedUpload = vi.fn();
const uploadTilSti = vi.fn();

// Netværksgrænsen: supabase-klienten. maybeSingle-svar pr. tabel i kø; INSERT tælles. (Antagelser, ikke SQL-bevis.)
type Svar = { data: unknown; error: unknown };
const net = vi.hoisted(() => ({
  svar: {} as Record<string, Array<Svar>>, insert: vi.fn(), kald: [] as string[],
  /** §4: valgfri kontrol af beskedopslag pr. id (kontrollerede promises). */
  vent: null as null | ((id: string) => Promise<Svar>),
}));
// B2b-3b §3: typede grænsemocks (ingen typeomgåelse ved rpc/invoke/from).

const graense = vi.hoisted(() => ({
  rpc: vi.fn<(...a: unknown[]) => Promise<unknown>>(async () => ({ data: "e", error: null })),
  invoke: vi.fn<(...a: unknown[]) => Promise<unknown>>(async () => ({ error: null })),
  from: vi.fn<(t: string) => unknown>(),
  session: vi.fn<() => Promise<unknown>>(async () => ({ data: { session: { access_token: "t" } } })),
}));
vi.mock("@/integrations/supabase/client", () => {
  const builder = (t: string) => {
    const b: Record<string, unknown> = {};
    let id = "";
    Object.assign(b, {
      select: () => b, eq: (kol: string, v: string) => { if (kol === "id") id = v; return b; },
      insert: (row: unknown) => { net.kald.push(`insert:${t}`); return Promise.resolve(net.insert(row) ?? { error: null }); },
      maybeSingle: () => {
        net.kald.push(`select:${t}`);
        if (t === "chat_messages" && net.vent) return net.vent(id);
        return Promise.resolve(net.svar[t]?.shift() ?? { data: null, error: null });
      },
    });
    return b;
  };
  return {
    supabase: {
      from: (t: string) => builder(t),
      rpc: graense.rpc,
      functions: { invoke: graense.invoke },
      // c3 §7: storage ved netværksgrænsen til den rigtige sbFil.
      storage: { from: () => ({ uploadToSignedUrl: (...a: unknown[]) => (lagerUpload.fn ? lagerUpload.fn(...a) : Promise.resolve({ error: null })) }) },
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "u" } } })), onAuthStateChange: vi.fn(),
        getSession: graense.session,
      },
    },
  };
});
vi.mock("@/lib/employeeLookup", () => ({ findEmployeeByAuth: vi.fn(async () => ({ data: { id: "e", first_name: "A", last_name: "B" } })) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));
// Rigtig useDraftGuard og rigtig MessageBubble (§9); kun skelet erstattes.
vi.mock("@/components/mobile", async (orig) => ({ ...(await orig<typeof import("@/components/mobile")>()), SkeletonList: () => null }));
vi.mock("./MessageSearch", () => ({ MessageSearch: () => null }));
vi.mock("./TypingIndicator", () => ({ TypingIndicator: () => null }));
vi.mock("./MentionInput", async (orig) => ({
  ...(await orig<typeof import("./MentionInput")>()),
  MentionInput: ({ value, onChange, onKeyDown }: { value: string; onChange: (v: string) => void; onKeyDown: (e: React.KeyboardEvent) => void }) => (
    <textarea aria-label="besked" value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} />
  ),
}));
vi.mock("@/lib/sbFil", async (orig) => ({
  ...(await orig<typeof import("@/lib/sbFil")>()),
  // c3 §7: med ægteFil kører den rigtige sbFil (fetch/storage mockes ved grænsen).
  udstedUpload: async (...a: Parameters<typeof import("@/lib/sbFil").udstedUpload>) => (beskeder.ægteFil ? (await orig<typeof import("@/lib/sbFil")>()).udstedUpload(...a) : udstedUpload(...a)),
  uploadTilSti: async (...a: Parameters<typeof import("@/lib/sbFil").uploadTilSti>) => (beskeder.ægteFil ? (await orig<typeof import("@/lib/sbFil")>()).uploadTilSti(...a) : uploadTilSti(...a)),
}));
vi.mock("@/hooks/useChat", async (orig) => {
  const ægte = await orig<typeof import("@/hooks/useChat")>();
  return {
    ...ægte,
    useMessages: () => ({ data: beskeder.liste, isLoading: false, hasOlder: false, isLoadingOlder: false, loadOlder: () => undefined, opdateret: beskeder.opdateret }),
    // §9: rigtig useSendMessage (rigtige send-/afstemningsfunktioner) når ægteSend er sat; ellers kontrolleret mutateAsync.
    useSendMessage: () => (beskeder.ægteSend ? ægte.useSendMessage() : { mutateAsync }),
    useRealtimeMessages: () => undefined,
    useMarkAsRead: () => ({ mutate: (...a: unknown[]) => kvitMutate.fn(...a), isPending: false }),
    useTypingIndicator: () => ({ typingUsers: [], setTyping: vi.fn() }),
    useChatAktiv: () => undefined,
    afstemKun: (...a: Parameters<typeof ægte.afstemKun>) => (beskeder.ægteSend ? ægte.afstemKun(...a) : afstemKun()),
  };
});

import { ChatView } from "./ChatView";
import { SendFejl, IKKE_REGISTRERET_TEKST } from "@/hooks/useChat";
import { rydAlleKladder, hentAfsendelser, gemKladde, laesKladde, type Afsendelse, type FilMeta } from "@/lib/sbKladder";
import { hasUnsentDrafts } from "@/components/mobile";

// Én stabil QueryClient pr. prøve (også gennem rerender/navigation), mutations.retry=1 som App.tsx.
let qc: QueryClient;
const wrap = (n: ReactNode) => <QueryClientProvider client={qc}>{n}</QueryClientProvider>;
const kontrol = <T,>() => { let res!: (v: T) => void; let rej!: (e: unknown) => void; const p = new Promise<T>((a, b) => { res = a; rej = b; }); return { p, res, rej }; };

async function klar(conv = "A") {
  const r = render(wrap(<ChatView conversationId={conv} />));
  await waitFor(() => expect(hentAfsendelser("e", conv)).toBeDefined());
  await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
  return r;
}
const skriv = (t: string) => fireEvent.change(screen.getByLabelText("besked"), { target: { value: t } });
const send = () => screen.getByRole("button", { name: "Send" });

beforeEach(() => {
  Element.prototype.scrollIntoView = () => undefined;
  globalThis.URL.createObjectURL = () => "blob:test";
  globalThis.URL.revokeObjectURL = () => undefined;
  qc = new QueryClient({ defaultOptions: { mutations: { retry: 1, retryDelay: 0 } } });
  rydAlleKladder();
  sessionStorage.clear();
  beskeder.liste = []; beskeder.opdateret = 0; kvitMutate.fn = () => undefined; beskeder.ægteSend = false; beskeder.ægteFil = false; lagerUpload.fn = null;
  net.insert.mockReset(); net.kald.length = 0; net.vent = null; for (const k of Object.keys(net.svar)) delete net.svar[k];
  mutateAsync.mockReset(); udstedUpload.mockReset(); uploadTilSti.mockReset(); afstemKun.mockClear();
});
// d2 §4: afmontér komponenter og ryd QueryClient efter hver prøve (ikke kun generationsreset).
afterEach(() => { cleanup(); qc.clear(); });

describe("T1 – ChatView afsendelse", () => {
  it("dobbelt Send og Enter+klik giver én afsendelse", async () => {
    mutateAsync.mockReturnValue(new Promise(() => undefined));
    await klar();
    skriv("hej");
    await act(async () => {
      fireEvent.keyDown(screen.getByLabelText("besked"), { key: "Enter" });
      fireEvent.click(send());
      fireEvent.click(send());
    });
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(hentAfsendelser("e", "A")).toHaveLength(1);
  });

  it("sen succes for A rydder kun A; pending B og ny tekst bevares", async () => {
    const a = kontrol<unknown>(), b = kontrol<unknown>();
    mutateAsync.mockReturnValueOnce(a.p).mockReturnValueOnce(b.p);
    await klar();
    skriv("A"); await act(async () => { fireEvent.click(send()); });
    skriv("B"); await act(async () => { fireEvent.click(send()); });
    skriv("ny kladde");
    const [idA] = hentAfsendelser("e", "A").map((x) => x.id);
    await act(async () => { a.res({}); await a.p; });
    expect(hentAfsendelser("e", "A").map((x) => x.tekst)).toEqual(["B"]);
    expect(hentAfsendelser("e", "A").some((x) => x.id === idA)).toBe(false);
    expect((screen.getByLabelText("besked") as HTMLTextAreaElement).value).toBe("ny kladde");
  });

  it("A–B–A: pending A overlever samtaleskift, kladde skrives ikke under ny nøgle", async () => {
    mutateAsync.mockReturnValue(new Promise(() => undefined));
    const r = await klar("A");
    skriv("til A"); await act(async () => { fireEvent.click(send()); });
    skriv("kladde A");
    r.rerender(wrap(<ChatView conversationId="B" />));
    await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
    expect((screen.getByLabelText("besked") as HTMLTextAreaElement).value).toBe("");
    r.rerender(wrap(<ChatView conversationId="A" />));
    await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
    expect(hentAfsendelser("e", "A").map((x) => x.tekst)).toEqual(["til A"]);
    expect((screen.getByLabelText("besked") as HTMLTextAreaElement).value).toBe("kladde A");
    expect(hentAfsendelser("e", "B")).toEqual([]);
  });

  it("valgt fil under upload: Send er låst", async () => {
    udstedUpload.mockReturnValue(new Promise(() => undefined));
    const { container } = await klar();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => { fireEvent.change(input, { target: { files: [new File(["x"], "x.txt", { type: "text/plain" })] } }); });
    expect(send()).toBeDisabled();
  });

  it("ukendt udfald tilbyder ikke Ret", async () => {
    mutateAsync.mockRejectedValueOnce(new SendFejl("ukendt", "Ikke sendt – prøv igen"));
    await klar();
    skriv("hej"); await act(async () => { fireEvent.click(send()); });
    expect(await screen.findByText("Afstemmer …")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ret" })).toBeNull();
  });
});

describe("T10 – Ret og genudstedelse", () => {
  async function medFil() {
    udstedUpload.mockResolvedValueOnce({ sti: "c/e/gammel.txt", token: "t", conversationId: "A" });
    uploadTilSti.mockResolvedValueOnce(undefined);
    const r = await klar();
    const input = r.container.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => { fireEvent.change(input, { target: { files: [new File(["x"], "x.txt", { type: "text/plain" })] } }); });
    await waitFor(() => expect(send()).not.toBeDisabled());
    return r;
  }

  it("afvist filsending uden svar → Ret bevarer id og fil (ingen svarreference); ny Send bruger samme id", async () => {
    await medFil();
    mutateAsync.mockRejectedValueOnce(new SendFejl("server", "Afvist"));
    skriv("tekst"); await act(async () => { fireEvent.click(send()); });
    const id = (mutateAsync.mock.calls[0][0] as { id: string }).id;
    fireEvent.click(await screen.findByRole("button", { name: "Ret" }));
    expect(screen.getByText("x.txt")).toBeInTheDocument();
    mutateAsync.mockResolvedValueOnce({});
    await act(async () => { fireEvent.click(send()); });
    expect(mutateAsync.mock.calls[1][0]).toMatchObject({ id, attachmentPath: "c/e/gammel.txt", content: "tekst" });
    expect((mutateAsync.mock.calls[1][0] as { replyToId?: string }).replyToId).toBeUndefined();
  });

  it("Ret overskriver ikke en anden igangværende kladde", async () => {
    mutateAsync.mockRejectedValueOnce(new SendFejl("server", "Afvist"));
    await klar();
    skriv("første"); await act(async () => { fireEvent.click(send()); });
    skriv("anden kladde");
    expect(await screen.findByRole("button", { name: "Ret" })).toBeDisabled();
  });

  it("ubundet overtaget sti → brugerudløst genforsøg giver ny sti og samme id", async () => {
    await medFil();
    mutateAsync.mockRejectedValueOnce(new SendFejl("genudsted", IKKE_REGISTRERET_TEKST));
    await act(async () => { fireEvent.click(send()); });
    const id = (mutateAsync.mock.calls[0][0] as { id: string }).id;
    udstedUpload.mockResolvedValueOnce({ sti: "c/e/ny.txt", token: "t2", conversationId: "A" });
    uploadTilSti.mockResolvedValueOnce(undefined);
    mutateAsync.mockResolvedValueOnce({});
    await act(async () => { fireEvent.click(await screen.findByRole("button", { name: "Ikke sendt – prøv igen" })); });
    expect(udstedUpload).toHaveBeenCalledTimes(2);
    expect(mutateAsync.mock.calls[1][0]).toMatchObject({ id, attachmentPath: "c/e/ny.txt" });
  });

  it("gentagen genudsted-afvisning giver ingen løkke", async () => {
    await medFil();
    mutateAsync.mockRejectedValue(new SendFejl("genudsted", IKKE_REGISTRERET_TEKST));
    udstedUpload.mockResolvedValue({ sti: "c/e/ny.txt", token: "t2", conversationId: "A" });
    uploadTilSti.mockResolvedValue(undefined);
    await act(async () => { fireEvent.click(send()); });
    await act(async () => { fireEvent.click(await screen.findByRole("button", { name: "Ikke sendt – prøv igen" })); });
    await act(async () => { await new Promise((x) => setTimeout(x, 20)); });
    expect(udstedUpload).toHaveBeenCalledTimes(2);
    expect(mutateAsync).toHaveBeenCalledTimes(2);
  });

  it("CPR-P0001 giver ingen udstedelse ved genforsøg", async () => {
    await medFil();
    mutateAsync.mockRejectedValue(new SendFejl("server", "Filen indeholder et CPR-nummer"));
    await act(async () => { fireEvent.click(send()); });
    await act(async () => { fireEvent.click(await screen.findByRole("button", { name: "Ikke sendt – prøv igen" })); });
    expect(screen.getByText("Filen indeholder et CPR-nummer")).toBeInTheDocument();
    expect(udstedUpload).toHaveBeenCalledTimes(1);
  });

  it("manglende File ved genudstedelse → Vælg filen igen, tekst bevaret", async () => {
    mutateAsync.mockRejectedValueOnce(new SendFejl("genudsted", IKKE_REGISTRERET_TEKST));
    await medFil();
    skriv("bevar");
    // Simulér reload: File findes ikke længere i hukommelsen.
    await act(async () => { fireEvent.click(send()); });
    const [a] = hentAfsendelser("e", "A");
    const { saetAfsendelsesFil } = await import("@/lib/sbKladder");
    await act(async () => { saetAfsendelsesFil("e", "A", a.id, null); });
    await act(async () => { fireEvent.click(await screen.findByRole("button", { name: "Ikke sendt – prøv igen" })); });
    expect(await screen.findAllByText("Vælg filen igen")).not.toHaveLength(0);
    expect(hentAfsendelser("e", "A")[0]).toMatchObject({ tekst: "bevar", tilstand: "vaelg_fil" });
    expect(udstedUpload).toHaveBeenCalledTimes(1);
  });
});

describe("§1 – sessionsskift i ChatView (B2a-b1)", () => {
  it("logud under upload-udstedelse → intet efterfølgende upload/INSERT og ingen lagerændring", async () => {
    const u = kontrol<unknown>();
    udstedUpload.mockReturnValueOnce(u.p);
    const { container } = await klar();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => { fireEvent.change(input, { target: { files: [new File(["x"], "x.txt", { type: "text/plain" })] } }); });
    const vagt = (udstedUpload.mock.calls[0][3] as { vagt: () => boolean; bruger: string }).vagt;
    expect((udstedUpload.mock.calls[0][3] as { bruger: string }).bruger).toBe("u");
    expect(vagt()).toBe(true);
    act(() => { rydAlleKladder(); });
    expect(vagt()).toBe(false);
    await act(async () => { u.res({ sti: "c/e/x.txt", token: "t", conversationId: "A" }); await u.p; });
    expect(uploadTilSti).not.toHaveBeenCalled();
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("sb-kladde:e:A")).toBeNull();
  });

  it("logud under igangværende afsendelse → ét kald, sent svar ændrer ikke den nye sessions lager", async () => {
    const a = kontrol<unknown>();
    mutateAsync.mockReturnValueOnce(a.p);
    await klar();
    skriv("hej"); await act(async () => { fireEvent.click(send()); });
    const input = mutateAsync.mock.calls[0][0] as { ejer: { emp: string; conv: string } };
    expect(input.ejer).toMatchObject({ emp: "e", conv: "A" });
    act(() => { rydAlleKladder(); });
    await act(async () => { a.rej(new SendFejl("ukendt", "Ikke sendt – prøv igen")); await a.p.catch(() => undefined); });
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(afstemKun).not.toHaveBeenCalled();
    expect(hentAfsendelser("e", "A")).toEqual([]);
  });
});

describe("§2 – stop ved binding til andet id (B2a-b2)", () => {
  it("stop vises som ikke sendt med fast tekst; ingen genudstedelse ved Prøv igen", async () => {
    mutateAsync.mockRejectedValue(new SendFejl("stop", IKKE_REGISTRERET_TEKST, false));
    udstedUpload.mockResolvedValueOnce({ sti: "c/e/x.txt", token: "t", conversationId: "A" });
    uploadTilSti.mockResolvedValueOnce(undefined);
    const r = await klar();
    const input = r.container.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => { fireEvent.change(input, { target: { files: [new File(["x"], "x.txt", { type: "text/plain" })] } }); });
    await waitFor(() => expect(send()).not.toBeDisabled());
    await act(async () => { fireEvent.click(send()); });
    expect(await screen.findByText(IKKE_REGISTRERET_TEKST)).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Ikke sendt – prøv igen" })); });
    expect(udstedUpload).toHaveBeenCalledTimes(1);
    expect(hentAfsendelser("e", "A")[0]).toMatchObject({ tilstand: "afvist" });
  });
});

// ---------- B2a-b3 ----------
const fremmed = (id: string, content: string, extra: Record<string, unknown> = {}) => ({
  id, conversation_id: "A", sender_id: "anden", content, status: "leveret", revision: 1, created_at: "2026-10-28T10:00:00Z",
  leveret_at: "2026-10-28T10:00:00Z", edited_at: null, reactions: [], read_receipts: [{ employee_id: "e" }],
  sender: { full_name: "Kollega" }, ...extra,
});
const vaelg = async (c: HTMLElement, f: File) => {
  const input = c.querySelector('input[type="file"]') as HTMLInputElement;
  await act(async () => { fireEvent.change(input, { target: { files: [f] } }); });
};
const tick = () => act(async () => { await new Promise((x) => setTimeout(x, 0)); });
const gemtFil = () => (JSON.parse(sessionStorage.getItem("sb-kladde:e:A") ?? "null") as { fil?: { trin: string; sti: string | null } } | null)?.fil ?? null;
const navigér = async (r: ReturnType<typeof render>, conv: string) => { r.rerender(wrap(<ChatView conversationId={conv} />)); await tick(); };

describe("§3 – lageret ejer uploadforløbet (B2a-b3)", () => {
  beforeEach(() => { beskeder.ægteSend = true; });

  it("A–B–A under udstedelse og under upload: Send låst, trin bevaret, nul INSERT før bekræftet upload", async () => {
    const u = kontrol<unknown>(), up = kontrol<unknown>();
    udstedUpload.mockReturnValueOnce(u.p);
    uploadTilSti.mockReturnValueOnce(up.p);
    const r = await klar();
    await vaelg(r.container, new File(["x"], "x.txt", { type: "text/plain" }));
    await navigér(r, "B"); await navigér(r, "A");
    expect(screen.getByText("Uploader …")).toBeInTheDocument();
    expect(send()).toBeDisabled();
    expect(gemtFil()).toMatchObject({ trin: "valgt", sti: null });
    await act(async () => { u.res({ sti: "c/e/x.txt", token: "t", conversationId: "A" }); await u.p; });
    await navigér(r, "B"); await navigér(r, "A");
    expect(screen.getByText("Uploader …")).toBeInTheDocument();
    expect(send()).toBeDisabled();
    expect(gemtFil()).toMatchObject({ trin: "uploader", sti: "c/e/x.txt" });
    fireEvent.click(send());
    expect(net.insert).not.toHaveBeenCalled();
    await act(async () => { up.res(undefined); await up.p; });
    expect(gemtFil()).toMatchObject({ trin: "uploadet", sti: "c/e/x.txt" });
    expect(screen.getByText("Klar til at sende")).toBeInTheDocument();
    // Antagelse: registerrækken for egen ubundet sti med status uploadet.
    net.svar.sb_stier = [{ data: { bucket: "chat-attachments", sti: "c/e/x.txt", besked_id: null, status: "uploadet", samtale_id: "A", ejer_employee_id: "e" }, error: null }];
    await act(async () => { fireEvent.click(send()); });
    await tick();
    expect(net.insert).toHaveBeenCalledTimes(1);
    expect(net.insert.mock.calls[0][0]).toMatchObject({ attachment_path: "c/e/x.txt" });
  });

  it("fejl under udstedelse efter afmontering bevares og kan genforsøges", async () => {
    const u = kontrol<unknown>();
    udstedUpload.mockReturnValueOnce(u.p);
    const r = await klar();
    await vaelg(r.container, new File(["x"], "x.txt", { type: "text/plain" }));
    r.unmount();
    await act(async () => { u.rej(new Error("net")); await u.p.catch(() => undefined); });
    await klar();
    expect(screen.getByText("Filen kunne ikke uploades – prøv igen")).toBeInTheDocument();
    expect(send()).toBeDisabled();
    udstedUpload.mockReturnValueOnce(new Promise(() => undefined));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Prøv igen" })); });
    expect(udstedUpload).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Uploader …")).toBeInTheDocument();
  });

  it("fejl under upload efter afmontering bevares i lageret, ingen sti tilbage", async () => {
    const up = kontrol<unknown>();
    udstedUpload.mockResolvedValueOnce({ sti: "c/e/x.txt", token: "t", conversationId: "A" });
    uploadTilSti.mockReturnValueOnce(up.p);
    const r = await klar();
    await vaelg(r.container, new File(["x"], "x.txt", { type: "text/plain" }));
    await tick();
    r.unmount();
    await act(async () => { up.rej(new Error("upload")); await up.p.catch(() => undefined); });
    expect(gemtFil()).toMatchObject({ trin: "valgt", sti: null });
    await klar();
    expect(screen.getByText("Filen kunne ikke uploades – prøv igen")).toBeInTheDocument();
    expect(send()).toBeDisabled();
  });

  for (const trin of ["valgt", "udstedt", "uploader"] as const) {
    it(`reload ved trin ${trin}: ingen levende forløb → »Vælg filen igen«, Send låst`, async () => {
      sessionStorage.setItem("sb-kladde:e:A", JSON.stringify({ tekst: "t", svarId: null, retId: null, fil: { name: "x.txt", type: "text/plain", size: 1, sti: trin === "valgt" ? null : "c/e/x.txt", trin } }));
      await klar();
      expect(screen.queryByText("Uploader …")).toBeNull();
      expect(screen.getAllByText("Vælg filen igen").length).toBeGreaterThan(0);
      expect(send()).toBeDisabled();
      fireEvent.keyDown(screen.getByLabelText("besked"), { key: "Enter" });
      expect(net.insert).not.toHaveBeenCalled();
    });
  }

  it("reload ved trin uploadet med sti: sendeklar uden File", async () => {
    sessionStorage.setItem("sb-kladde:e:A", JSON.stringify({ tekst: "t", svarId: null, retId: null, fil: { name: "x.txt", type: "text/plain", size: 1, sti: "c/e/x.txt", trin: "uploadet" } }));
    await klar();
    expect(screen.getByText("Klar til at sende")).toBeInTheDocument();
    expect(send()).not.toBeDisabled();
  });

  it("fjern fil → sent udstedelsessvar ignoreres (ingen upload, fil genskabes ikke)", async () => {
    const u = kontrol<unknown>();
    udstedUpload.mockReturnValueOnce(u.p);
    const r = await klar();
    await vaelg(r.container, new File(["x"], "x.txt", { type: "text/plain" }));
    fireEvent.click(screen.getByRole("button", { name: "Fjern fil" }));
    await act(async () => { u.res({ sti: "c/e/x.txt", token: "t", conversationId: "A" }); await u.p; });
    expect(uploadTilSti).not.toHaveBeenCalled();
    expect(screen.queryByText("x.txt")).toBeNull();
    expect(gemtFil()).toBeNull();
  });

  it("genvalg → gammelt svar ignoreres; genbrug af samme File i nyt forsøg", async () => {
    const f = new File(["x"], "x.txt", { type: "text/plain" });
    const u1 = kontrol<unknown>(), u2 = kontrol<unknown>();
    udstedUpload.mockReturnValueOnce(u1.p).mockReturnValueOnce(u2.p);
    uploadTilSti.mockResolvedValue(undefined);
    const r = await klar();
    await vaelg(r.container, f);
    await vaelg(r.container, f); // samme File-objekt, nyt forsøg
    await act(async () => { u1.res({ sti: "c/e/gammel.txt", token: "t1", conversationId: "A" }); await u1.p; });
    expect(uploadTilSti).not.toHaveBeenCalled();
    expect(gemtFil()).toMatchObject({ sti: null, trin: "valgt" });
    await act(async () => { u2.res({ sti: "c/e/ny.txt", token: "t2", conversationId: "A" }); await u2.p; });
    await tick();
    expect(uploadTilSti).toHaveBeenCalledTimes(1);
    expect(gemtFil()).toMatchObject({ sti: "c/e/ny.txt", trin: "uploadet" });
  });

  it("sen uploadafslutning overskriver ikke nyere tekst/svar", async () => {
    beskeder.liste = [fremmed("svar-A", "besked A")];
    const up = kontrol<unknown>();
    udstedUpload.mockResolvedValueOnce({ sti: "c/e/x.txt", token: "t", conversationId: "A" });
    uploadTilSti.mockReturnValueOnce(up.p);
    const r = await klar();
    await vaelg(r.container, new File(["x"], "x.txt", { type: "text/plain" }));
    await tick();
    expect(uploadTilSti).toHaveBeenCalledTimes(1); // upload-trinnet er startet
    skriv("nyere tekst");
    const boble = screen.getByText("besked A").closest(".group") as HTMLElement;
    fireEvent.click(within(boble).getByRole("button", { name: "Svar" }));
    await act(async () => { up.res(undefined); await up.p; });
    expect((screen.getByLabelText("besked") as HTMLTextAreaElement).value).toBe("nyere tekst");
    expect(screen.getByText("Svarer på:").parentElement).toHaveTextContent("besked A");
    expect(JSON.parse(sessionStorage.getItem("sb-kladde:e:A")!)).toMatchObject({ tekst: "nyere tekst", svarId: "svar-A", fil: { trin: "uploadet" } });
  });

  it("filbytes, token og preview-URL gemmes aldrig i sessionStorage", async () => {
    udstedUpload.mockResolvedValueOnce({ sti: "c/e/x.png", token: "HEMMELIGT-TOKEN", conversationId: "A" });
    uploadTilSti.mockReturnValueOnce(new Promise(() => undefined));
    const r = await klar();
    await vaelg(r.container, new File(["BYTES"], "x.png", { type: "image/png" }));
    await tick();
    const alt = Object.keys(sessionStorage).map((k) => sessionStorage.getItem(k)).join("");
    expect(alt).not.toContain("HEMMELIGT-TOKEN");
    expect(alt).not.toContain("blob:");
    expect(alt).not.toContain("BYTES");
  });
});

describe("c3 §7 – uploadnavigation gennem rigtig sbFil (fetch/storage ved grænsen)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(async () => {
    beskeder.ægteSend = true; beskeder.ægteFil = true;
    const { supabase } = await import("@/integrations/supabase/client");
    graense.session.mockResolvedValue({ data: { session: { access_token: "t", user: { id: "u" } } } });
    const auth = vi.mocked(supabase.auth.onAuthStateChange).mock.calls[0][0] as (e: string, s: unknown) => void;
    act(() => { auth("SIGNED_IN", { user: { id: "u" } }); });
  });
  afterEach(() => { fetchSpy?.mockRestore(); });

  it("A–B–A under rigtig udstedelse og upload → sti bevares, ét POST, ét upload, INSERT med stien", async () => {
    const post = kontrol<Response>();
    fetchSpy = vi.spyOn(globalThis, "fetch").mockReturnValueOnce(post.p);
    const up = kontrol<{ error: unknown }>();
    const upFn = vi.fn(() => up.p);
    lagerUpload.fn = upFn;
    const r = await klar();
    await vaelg(r.container, new File(["x"], "x.txt", { type: "text/plain" }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1)); // POST er startet
    await navigér(r, "B"); await navigér(r, "A");
    await act(async () => { post.res(new Response(JSON.stringify({ sti: "c/e/x.txt", token: "k" }), { status: 200 })); });
    await waitFor(() => expect(upFn).toHaveBeenCalledTimes(1));
    await navigér(r, "B"); await navigér(r, "A");
    expect(send()).toBeDisabled();
    await act(async () => { up.res({ error: null }); });
    await tick();
    expect(gemtFil()).toMatchObject({ sti: "c/e/x.txt", trin: "uploadet" });
    net.svar.sb_stier = [{ data: { bucket: "chat-attachments", sti: "c/e/x.txt", besked_id: null, status: "uploadet", samtale_id: "A", ejer_employee_id: "e" }, error: null }];
    net.insert.mockReturnValueOnce({ error: null });
    await waitFor(() => expect(send()).not.toBeDisabled());
    await act(async () => { fireEvent.click(send()); });
    await tick(); await tick();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(net.insert).toHaveBeenCalledTimes(1);
    expect(net.insert.mock.calls[0][0]).toMatchObject({ attachment_path: "c/e/x.txt" });
    expect(JSON.stringify(sessionStorage)).not.toContain("\"k\"");
  });

  it("faktisk logud (auth-callback) efter startet POST → intet upload, intet INSERT, ingen lagerændring", async () => {
    const post = kontrol<Response>();
    fetchSpy = vi.spyOn(globalThis, "fetch").mockReturnValueOnce(post.p);
    const upFn = vi.fn(async () => ({ error: null }));
    lagerUpload.fn = upFn;
    const r = await klar();
    await vaelg(r.container, new File(["x"], "x.txt", { type: "text/plain" }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const { supabase } = await import("@/integrations/supabase/client");
    const auth = vi.mocked(supabase.auth.onAuthStateChange).mock.calls[0][0] as (e: string, s: unknown) => void;
    act(() => { auth("SIGNED_OUT", null); });
    await act(async () => { post.res(new Response(JSON.stringify({ sti: "c/e/x.txt", token: "k" }), { status: 200 })); });
    await tick();
    expect(upFn).not.toHaveBeenCalled();
    expect(net.insert).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("sb-kladde:e:A")).toBeNull();
    act(() => { auth("SIGNED_IN", { user: { id: "u" } }); });
  });

  it("fjern fil under rigtig sessionsopslag → nul POST", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const sess = kontrol<unknown>();
    graense.session.mockReturnValueOnce(sess.p);
    fetchSpy = vi.spyOn(globalThis, "fetch");
    const r = await klar();
    await vaelg(r.container, new File(["x"], "x.txt", { type: "text/plain" }));
    await waitFor(() => expect(supabase.auth.getSession).toHaveBeenCalled()); // sessionsopslaget er startet
    fireEvent.click(screen.getByRole("button", { name: "Fjern fil" }));
    await act(async () => { sess.res({ data: { session: { access_token: "t", user: { id: "u" } } } }); });
    await tick();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("§5 – Ret med svarreference (B2a-b3)", () => {
  beforeEach(() => {
    beskeder.ægteSend = true;
    beskeder.liste = [fremmed("svar-A", "besked A"), fremmed("svar-B", "besked B")];
  });
  const svarPaa = (tekst: string) => {
    const boble = screen.getByText(tekst).closest(".group") as HTMLElement;
    fireEvent.click(within(boble).getByRole("button", { name: "Svar" }));
  };
  async function afvistMedSvarA() {
    await klar();
    svarPaa("besked A");
    skriv("min tekst");
    net.insert.mockReturnValueOnce({ error: { code: "P0001", message: "Afvist af server" } });
    await act(async () => { fireEvent.click(send()); });
    await screen.findByText("Afvist af server");
    expect(net.insert).toHaveBeenCalledTimes(1);
    return (net.insert.mock.calls[0][0] as { id: string }).id;
  }

  it("(a) svar B som eneste skrivekladde: Ret låst, B bevares, intet sendes; DraftGuard aktiv", async () => {
    await afvistMedSvarA();
    svarPaa("besked B");
    const retKnap = screen.getByRole("button", { name: "Ret" });
    expect(retKnap).toBeDisabled();
    fireEvent.click(retKnap);
    expect(screen.getByText("Svarer på:").parentElement).toHaveTextContent("besked B");
    expect(net.insert).toHaveBeenCalledTimes(1);
    expect(hasUnsentDrafts()).toBe(true);
  });

  it("(b) efter rydning af B gendanner Ret svar A, tekst og id; næste Send bruger A", async () => {
    const id = await afvistMedSvarA();
    svarPaa("besked B");
    fireEvent.click(screen.getByRole("button", { name: "Fjern svar" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Ret" })); });
    await tick();
    expect(screen.getByText("Svarer på:").parentElement).toHaveTextContent("besked A");
    expect((screen.getByLabelText("besked") as HTMLTextAreaElement).value).toBe("min tekst");
    net.insert.mockReturnValueOnce({ error: null });
    await act(async () => { fireEvent.click(send()); });
    await tick();
    expect(net.insert.mock.calls[1][0]).toMatchObject({ id, reply_to_id: "svar-A", content: "min tekst" });
  });

  it("(b, fil) Ret gendanner den afviste afsendelses fil og sti", async () => {
    udstedUpload.mockResolvedValueOnce({ sti: "c/e/x.txt", token: "t", conversationId: "A" });
    uploadTilSti.mockResolvedValueOnce(undefined);
    const r = await klar();
    svarPaa("besked A");
    await vaelg(r.container, new File(["x"], "x.txt", { type: "text/plain" }));
    await waitFor(() => expect(send()).not.toBeDisabled());
    net.insert.mockReturnValueOnce({ error: { code: "P0001", message: "Afvist af server" } });
    net.svar.sb_stier = [{ data: { bucket: "chat-attachments", sti: "c/e/x.txt", besked_id: null, status: "uploadet", samtale_id: "A", ejer_employee_id: "e" }, error: null },
      { data: { bucket: "chat-attachments", sti: "c/e/x.txt", besked_id: null, status: "uploadet", samtale_id: "A", ejer_employee_id: "e" }, error: null }];
    await act(async () => { fireEvent.click(send()); });
    await screen.findByText("Afvist af server");
    const id = (net.insert.mock.calls[0][0] as { id: string }).id;
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Ret" })); });
    await tick();
    expect(screen.getByText("x.txt")).toBeInTheDocument();
    net.svar.sb_stier = [{ data: { bucket: "chat-attachments", sti: "c/e/x.txt", besked_id: null, status: "uploadet", samtale_id: "A", ejer_employee_id: "e" }, error: null }];
    net.insert.mockReturnValueOnce({ error: null });
    await act(async () => { fireEvent.click(send()); });
    await tick();
    expect(net.insert.mock.calls[1][0]).toMatchObject({ id, reply_to_id: "svar-A", attachment_path: "c/e/x.txt" });
  });

  it("DraftGuard dækker gendannet svarId alene", async () => {
    sessionStorage.setItem("sb-kladde:e:A", JSON.stringify({ tekst: "", svarId: "svar-A", retId: null, fil: null }));
    await klar();
    // Kun svaret: ingen tekst, fil eller pending poster kan gøre værnet aktivt.
    expect((screen.getByLabelText("besked") as HTMLTextAreaElement).value).toBe("");
    expect(hentAfsendelser("e", "A")).toEqual([]);
    expect(JSON.parse(sessionStorage.getItem("sb-kladde:e:A")!)).toMatchObject({ tekst: "", fil: null });
    expect(hasUnsentDrafts()).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Fjern svar" }));
    await tick();
    expect(hasUnsentDrafts()).toBe(false);
  });
});

describe("§9 – GET 403/404/410 gennem rigtig FilVedhaeftning (B2a-b3)", () => {
  for (const status of [403, 404, 410]) {
    it(`GET ${status} → »Filen er ikke længere tilgængelig«, nul udstedelse/upload/INSERT`, async () => {
      beskeder.ægteSend = true;
      beskeder.liste = [fremmed("m-fil", "", { attachment_path: "c/x/f.txt", attachment_name: "f.txt", attachment_type: "text/plain" })];
      const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ kode: "x" }), { status }));
      await klar();
      await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Åbn f.txt" })); });
      expect(await screen.findByText("Filen er ikke længere tilgængelig")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Prøv igen" })).toBeNull();
      expect(udstedUpload).not.toHaveBeenCalled();
      expect(uploadTilSti).not.toHaveBeenCalled();
      expect(net.insert).not.toHaveBeenCalled();
      f.mockRestore();
    });
  }
});

// ---------- B2a-b4: §4 fælles afstemningskø (kontrollerede timere) ----------
describe("§4 – fælles afstemningskø (B2a-b4)", () => {
  type V = { id: string; res: (s: { data: unknown; error: null }) => void };
  let ventende: V[] = [];
  let samtidige = 0, maks = 0;
  const pr = new Map<string, number>(); let maksPrId = 0;
  const afs = (id: string, fil: FilMeta | null = null): Afsendelse => ({
    id, tekst: id, svarId: null, fil, tilstand: "afstemmer", fejl: null, tidligereUkendt: true, oprettet: 1,
  });
  const fremad = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
  const svarFor = (id: string, data: unknown) => {
    const i = ventende.findIndex((x) => x.id === id);
    if (i < 0) throw new Error(`intet ventende opslag for ${id}`);
    const [x] = ventende.splice(i, 1);
    return act(async () => { x.res({ data, error: null }); await vi.advanceTimersByTimeAsync(0); });
  };
  const opslag = (id: string) => net.kald.filter((k) => k === `select:chat_messages:${id}`).length;
  async function klarFake(conv = "A") {
    const r = render(wrap(<ChatView conversationId={conv} />));
    await fremad(0); await fremad(0); await fremad(0);
    return r;
  }

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    beskeder.ægteSend = true;
    ventende = []; samtidige = 0; maks = 0; pr.clear(); maksPrId = 0;
    net.vent = (id) => {
      net.kald.push(`select:chat_messages:${id}`);
      samtidige++; maks = Math.max(maks, samtidige);
      pr.set(id, (pr.get(id) ?? 0) + 1); maksPrId = Math.max(maksPrId, pr.get(id)!);
      return new Promise((res) => ventende.push({ id, res: (s) => { samtidige--; pr.set(id, pr.get(id)! - 1); res(s); } }));
    };
  });
  afterEach(async () => {
    // d2 §4: afslut ALLE kontrollerede opslag (også detached) før timere nulstilles; kontrollér kapaciteten bagefter.
    for (let n = 0; n < 20 && ventende.length; n++) {
      for (const x of ventende.splice(0)) await act(async () => { x.res({ data: { id: x.id, status: "leveret", revision: 1 }, error: null }); await vi.advanceTimersByTimeAsync(0); });
    }
    expect(ventende).toEqual([]);
    const { afstemningsKapacitet } = await import("./ChatView");
    expect(afstemningsKapacitet()).toMatchObject({ aktive: 0, ventende: 0 });
    cleanup();
    vi.useRealTimers();
  });

  it("A afventer, B tilføjes → begge når afslutning", async () => {
    const { tilfoejAfsendelse } = await import("@/lib/sbKladder");
    tilfoejAfsendelse("e", "A", afs("A1"));
    await klarFake();
    expect(opslag("A1")).toBe(1);
    await act(async () => { tilfoejAfsendelse("e", "A", afs("B1")); });
    await fremad(0);
    expect(opslag("B1")).toBe(1);
    await svarFor("B1", { id: "B1" });
    await svarFor("A1", { id: "A1" });
    expect(hentAfsendelser("e", "A")).toEqual([]);
  });

  it("A afventer, B tilføjes → begge når udtømt serie og tilbyder »Prøv igen«", async () => {
    const { tilfoejAfsendelse } = await import("@/lib/sbKladder");
    tilfoejAfsendelse("e", "A", afs("A1"));
    await klarFake();
    await act(async () => { tilfoejAfsendelse("e", "A", afs("B1")); });
    await fremad(0);
    for (let n = 0; n < 7; n++) {
      for (const id of ["A1", "B1"]) if (ventende.some((x) => x.id === id)) await svarFor(id, null);
      await fremad(30000);
    }
    expect(opslag("A1")).toBe(7);
    expect(opslag("B1")).toBe(7);
    expect(screen.getAllByRole("button", { name: "Prøv igen" })).toHaveLength(2);
    expect(net.insert).not.toHaveBeenCalled();
  });

  it("B2b-3a §2a: udtømt pending-post, som en synlig egen serverrække skjuler, ryddes og spærrer ikke serverhandlinger tavst", async () => {
    const { tilfoejAfsendelse, fastholdEjer } = await import("@/lib/sbKladder");
    const { tagHandling, frigivHandling } = await import("@/hooks/useChat");
    tilfoejAfsendelse("e", "A", afs("A1"));
    const r = await klarFake();
    for (let n = 0; n < 7; n++) { if (ventende.some((x) => x.id === "A1")) await svarFor("A1", null); await fremad(30000); }
    expect(screen.getByRole("button", { name: "Prøv igen" })).toBeTruthy();
    // Udtømt: koordineringen blokerer ikke længere tavst (før B2b-3a: blokeret, så alle klik blev ignoreret).
    const e1 = fastholdEjer("e", "A", "u");
    expect(tagHandling(e1, "A1", "send")).toBe(true);
    frigivHandling(e1!, "A1");
    beskeder.liste = [{ ...fremmed("A1", "A1"), sender_id: "e", status: "afventer_afsender", read_receipts: [] }];
    beskeder.opdateret++;
    r.rerender(wrap(<ChatView conversationId="A" />));
    await fremad(0);
    expect(hentAfsendelser("e", "A")).toEqual([]); // serverrækken beviser gemningen; posten skjuler ikke længere sit genforsøg
    expect(screen.queryByRole("button", { name: "Prøv igen" })).toBeNull();
    expect(net.insert).not.toHaveBeenCalled();
  });

  it("B2b-3a §2a: synlig serverrække under aktivt afstemningsopslag rydder ikke posten før forløbets egen afslutning", async () => {
    const { tilfoejAfsendelse, fastholdEjer } = await import("@/lib/sbKladder");
    const { tagHandling } = await import("@/hooks/useChat");
    tilfoejAfsendelse("e", "A", afs("A1"));
    const r = await klarFake();
    expect(opslag("A1")).toBe(1);
    beskeder.liste = [{ ...fremmed("A1", "A1"), sender_id: "e", status: "afventer_afsender", read_receipts: [] }];
    r.rerender(wrap(<ChatView conversationId="A" />));
    await fremad(0);
    expect(hentAfsendelser("e", "A")).toHaveLength(1); // fysisk igangværende arbejde beskyttes
    expect(tagHandling(fastholdEjer("e", "A", "u"), "A1", "send")).toBe(false);
    await svarFor("A1", { id: "A1" });
    expect(hentAfsendelser("e", "A")).toEqual([]);
  });

  it("mange pending id'er: målt maksimal samtidighed er 3", async () => {
    const { tilfoejAfsendelse } = await import("@/lib/sbKladder");
    for (let i = 0; i < 8; i++) tilfoejAfsendelse("e", "A", afs(`P${i}`));
    await klarFake();
    expect(maks).toBe(3);
    for (let runde = 0; runde < 4; runde++) {
      for (const x of [...ventende]) await svarFor(x.id, { id: x.id });
    }
    expect(maks).toBe(3);
    expect(hentAfsendelser("e", "A")).toEqual([]);
  });

  it("gentagne online-/forgrundshændelser → højst én ventende genstart pr. id", async () => {
    const { tilfoejAfsendelse } = await import("@/lib/sbKladder");
    tilfoejAfsendelse("e", "A", afs("A1"));
    await klarFake();
    // Under aktivt opslag: fem hændelser samles til én genstart.
    for (let i = 0; i < 5; i++) { window.dispatchEvent(new Event("online")); document.dispatchEvent(new Event("visibilitychange")); }
    await svarFor("A1", null);
    await fremad(0);
    expect(opslag("A1")).toBe(2);
    await svarFor("A1", null);
    // Under backoff: gentagne hændelser giver ét nyt opslag, ikke flere.
    for (let i = 0; i < 5; i++) window.dispatchEvent(new Event("online"));
    await fremad(0);
    expect(opslag("A1")).toBe(3);
    expect(maksPrId).toBe(1);
  });

  it("remount under aktiv promise og under backoff: ingen dubletter, backoff bevares", async () => {
    const { tilfoejAfsendelse } = await import("@/lib/sbKladder");
    tilfoejAfsendelse("e", "A", afs("A1"));
    let r = await klarFake();
    r.unmount();
    r = await klarFake();
    expect(opslag("A1")).toBe(1);
    await svarFor("A1", null); // → backoff 1 s
    r.unmount();
    r = await klarFake();
    expect(opslag("A1")).toBe(1);
    await fremad(999);
    expect(opslag("A1")).toBe(1);
    await fremad(1);
    expect(opslag("A1")).toBe(2);
    expect(maksPrId).toBe(1);
  });

  it("manuelt genforsøg efter udtømt serie (ingen baggrundstimer tilbage): højst ét netværksforløb pr. id", async () => {
    const { tilfoejAfsendelse } = await import("@/lib/sbKladder");
    tilfoejAfsendelse("e", "A", afs("A1"));
    await klarFake();
    for (let n = 0; n < 7; n++) { if (ventende.length) await svarFor("A1", null); await fremad(30000); }
    const foer = opslag("A1");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Prøv igen" })); });
    await fremad(0);
    await fremad(1000); // ingen baggrundsafstemning starter, mens den manuelle afsendelse holder låsen
    expect(maksPrId).toBe(1);
    expect(opslag("A1")).toBe(foer + 1);
    await svarFor("A1", { id: "A1" });
    expect(hentAfsendelser("e", "A")).toEqual([]);
    expect(net.insert).not.toHaveBeenCalled();
  });

  it("lås-enhed: gammel frigivelse efter overdragelse frigiver kun egen lås", async () => {
    const { tagLaas, frigivLaas } = await import("./ChatView");
    expect(tagLaas("k", "op1")).toBe(true);
    frigivLaas("k", "op1");
    expect(tagLaas("k", "op2")).toBe(true); // overdraget til ny operation
    frigivLaas("k", "op1");                 // sen afslutning fra den gamle
    expect(tagLaas("k", "op3")).toBe(false);
    frigivLaas("k", "op2");
    expect(tagLaas("k", "op3")).toBe(true);
    frigivLaas("k", "op3");
  });

  const udtoem = async (id: string) => {
    for (let n = 0; n < 7; n++) { if (ventende.some((x) => x.id === id)) await svarFor(id, null); await fremad(30000); }
    expect(screen.getByRole("button", { name: "Prøv igen" })).toBeTruthy();
  };
  const svarFejlFor = (id: string) => {
    const i = ventende.findIndex((x) => x.id === id);
    const [x] = ventende.splice(i, 1);
    return act(async () => { (x.res as (s: { data: unknown; error: unknown }) => void)({ data: null, error: { message: "net" } }); await vi.advanceTimersByTimeAsync(0); });
  };

  for (const scenarie of ["forhåndsopslag fejler", "tabt INSERT-svar + tom efterafstemning", "registerfejl"] as const) {
    it(`c2 §5: udtømt → Prøv igen → ${scenarie} → forløbet fortsætter og ender i afslutning eller ny brugerhandling`, async () => {
      const { tilfoejAfsendelse } = await import("@/lib/sbKladder");
      const { afstemningsKapacitet } = await import("./ChatView");
      const fil: FilMeta = { name: "x.txt", type: "text/plain", size: 1, sti: "c/e/x.txt", trin: "uploadet" };
      const a = scenarie === "registerfejl" ? afs("A1", fil) : scenarie === "tabt INSERT-svar + tom efterafstemning" ? { ...afs("A1"), tidligereUkendt: false } : afs("A1");
      tilfoejAfsendelse("e", "A", a);
      await klarFake();
      await udtoem("A1");
      const foer = opslag("A1");
      if (scenarie === "registerfejl") net.svar.sb_stier = [{ data: null, error: { message: "rls" } }];
      if (scenarie === "tabt INSERT-svar + tom efterafstemning") net.insert.mockReturnValueOnce({ error: { message: "Failed to fetch" } });
      await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Prøv igen" })); });
      await fremad(0);
      if (scenarie === "forhåndsopslag fejler") await svarFejlFor("A1");
      else if (scenarie === "registerfejl") await svarFor("A1", null);
      else { await svarFor("A1", null); await fremad(0); await svarFor("A1", null); } // forhåndsopslag, INSERT tabt, efterafstemning tom
      await fremad(0);
      const insertsEfterManuel = net.insert.mock.calls.length;
      expect(insertsEfterManuel).toBeLessThanOrEqual(1);
      expect(hentAfsendelser("e", "A")[0]?.tilstand).toBe("afstemmer");
      // Eksplicit fortsættelse uden listeændring/remount: næste opslag efter 1 s.
      const efterManuel = opslag("A1");
      await fremad(1000);
      expect(opslag("A1")).toBe(efterManuel + 1);
      // Hele afslutningen: serien udtømmes igen og tilbyder brugerhandlingen; ingen automatisk skrivning.
      for (let n = 0; n < 8; n++) { if (ventende.some((x) => x.id === "A1")) await svarFor("A1", null); await fremad(30000); }
      expect(screen.getByRole("button", { name: "Prøv igen" })).toBeTruthy();
      expect(net.insert.mock.calls.length).toBe(insertsEfterManuel);
      expect(opslag("A1")).toBeGreaterThan(foer);
      expect(ventende).toEqual([]);
      expect(afstemningsKapacitet().aktive).toBe(0);
      expect(maksPrId).toBe(1);
    });
  }

  it("c2 §5: manuel handling under aktivt promise og online-hændelse → ét forløb, fuld afslutning", async () => {
    const { tilfoejAfsendelse } = await import("@/lib/sbKladder");
    const { afstemningsKapacitet } = await import("./ChatView");
    tilfoejAfsendelse("e", "A", afs("A1"));
    await klarFake();
    await udtoem("A1");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Prøv igen" })); });
    await fremad(0);
    expect(ventende.filter((x) => x.id === "A1")).toHaveLength(1); // manuelt promise er aktivt
    for (let i = 0; i < 3; i++) window.dispatchEvent(new Event("online"));
    await fremad(5000); // ingen baggrundsafstemning konkurrerer
    expect(maksPrId).toBe(1);
    await svarFor("A1", { id: "A1" });
    await fremad(0);
    expect(hentAfsendelser("e", "A")).toEqual([]);
    // Efterbehandlingens statusopslag (ikke afstemning) afsluttes også.
    for (const x of [...ventende]) await svarFor(x.id, { status: "leveret", revision: 1 });
    await fremad(60000);
    expect(ventende).toEqual([]);
    expect(afstemningsKapacitet().aktive).toBe(0);
    expect(net.insert).not.toHaveBeenCalled();
  });

  it("c2 §6: tre uafsluttede gamle opslag + faktisk logud/genlogin → ny post afstemmes straks; gamle svar ændrer intet", async () => {
    const { tilfoejAfsendelse } = await import("@/lib/sbKladder");
    const { afstemningsKapacitet } = await import("./ChatView");
    const { supabase } = await import("@/integrations/supabase/client");
    const auth = vi.mocked(supabase.auth.onAuthStateChange).mock.calls[0][0] as (e: string, s: unknown) => void;
    act(() => { auth("SIGNED_IN", { user: { id: "u" } }); });
    for (const id of ["G1", "G2", "G3"]) tilfoejAfsendelse("e", "A", afs(id));
    await klarFake();
    expect(ventende).toHaveLength(3);
    const gamleSession = afstemningsKapacitet().gen;
    act(() => { auth("SIGNED_OUT", null); auth("SIGNED_IN", { user: { id: "u" } }); });
    expect(afstemningsKapacitet()).toMatchObject({ aktive: 0, iKoe: 0, ventende: 0 });
    expect(afstemningsKapacitet().gen).not.toBe(gamleSession);
    await act(async () => { tilfoejAfsendelse("e", "A", afs("N1")); });
    await fremad(0);
    expect(opslag("N1")).toBe(1); // venter ikke på gamle svar
    expect(afstemningsKapacitet().aktive).toBe(1);
    const inv = vi.spyOn(qc, "invalidateQueries");
    for (const id of ["G1", "G2", "G3"]) await svarFor(id, { id });
    expect(afstemningsKapacitet().aktive).toBe(1);
    expect(hentAfsendelser("e", "A").map((x) => x.id)).toEqual(["N1"]);
    expect(inv).not.toHaveBeenCalled();
    await svarFor("N1", { id: "N1" });
    expect(hentAfsendelser("e", "A")).toEqual([]);
    expect(afstemningsKapacitet().aktive).toBe(0);
  });

  it("c2 §6: tre baggrundsforløb + manuel Send deler kapaciteten (målt maks 3) og alle afslutter", async () => {
    const { tilfoejAfsendelse } = await import("@/lib/sbKladder");
    const { afstemningsKapacitet } = await import("./ChatView");
    for (const id of ["P0", "P1", "P2"]) tilfoejAfsendelse("e", "A", afs(id));
    await klarFake();
    expect(maks).toBe(3);
    skriv("hej");
    await act(async () => { fireEvent.click(send()); });
    await fremad(0);
    expect(samtidige).toBe(3); // den manuelle afsendelse venter på en plads
    expect(afstemningsKapacitet().ventende).toBe(1);
    await svarFor("P0", { id: "P0" });
    await fremad(0);
    expect(maks).toBe(3);
    const ny = ventende.find((x) => !["P1", "P2"].includes(x.id))!;
    net.insert.mockReturnValueOnce({ error: null });
    await svarFor(ny.id, null);
    await fremad(0);
    for (const x of [...ventende]) await svarFor(x.id, { id: x.id });
    await fremad(0);
    expect(maks).toBe(3);
    expect(net.insert).toHaveBeenCalledTimes(1);
    expect(hentAfsendelser("e", "A")).toEqual([]);
    expect(afstemningsKapacitet()).toMatchObject({ aktive: 0, ventende: 0, iKoe: 0 });
  });

  it("c2 §6: stopAfstemninger stopper kun den angivne samtales timere; andre forløb fortsætter", async () => {
    const { tilfoejAfsendelse } = await import("@/lib/sbKladder");
    const { stopAfstemninger } = await import("./ChatView");
    tilfoejAfsendelse("e", "A", afs("A1"));
    tilfoejAfsendelse("e", "A", afs("A2"));
    await klarFake();
    await svarFor("A1", null); await svarFor("A2", null); // begge i backoff
    stopAfstemninger("e", "A", "A1");
    await fremad(1000);
    expect(opslag("A1")).toBe(1);
    expect(opslag("A2")).toBe(2);
    await svarFor("A2", { id: "A2" });
  });

  it("c3 §7: reel overdragelse med sent svar – stoppet forløb holder låsen; nyt forløb venter på timer og afslutter", async () => {
    const { tilfoejAfsendelse } = await import("@/lib/sbKladder");
    const { stopAfstemninger, afstemningsKapacitet } = await import("./ChatView");
    tilfoejAfsendelse("e", "A", afs("A1"));
    let r = await klarFake();
    expect(opslag("A1")).toBe(1); // det gamle forløbs netværkstrin er startet
    stopAfstemninger("e", "A", "A1");
    r.unmount();
    r = await klarFake(); // nyt forløb for samme id overtager
    expect(opslag("A1")).toBe(1); // låsen ejes stadig af det gamle kald → ingen konkurrence, timer planlagt
    await svarFor("A1", { id: "A1" }); // sent svar fra det gamle forløb
    expect(hentAfsendelser("e", "A").map((x) => x.id)).toEqual(["A1"]); // gammelt forløb ændrer ikke lageret
    await fremad(1000); // det nye forløbs reelle timer
    expect(opslag("A1")).toBe(2);
    expect(maksPrId).toBe(1);
    await svarFor("A1", { id: "A1" });
    expect(hentAfsendelser("e", "A")).toEqual([]);
    expect(afstemningsKapacitet().aktive).toBe(0);
    r.unmount();
  });

  it("d2 §4: manuel genafsendelse efter udtømt serie → uafklaret, reel 1 s-timer aktiv, online-kapløb samles; fuld afslutning", async () => {
    const { tilfoejAfsendelse } = await import("@/lib/sbKladder");
    const { afstemningsKapacitet } = await import("./ChatView");
    tilfoejAfsendelse("e", "A", afs("A1"));
    await klarFake();
    for (let n = 0; n < 7; n++) { if (ventende.some((x) => x.id === "A1")) await svarFor("A1", null); await fremad(30000); }
    net.insert.mockReturnValueOnce({ error: { message: "transport" } }); // INSERT uden kendt udfald
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Prøv igen" })); });
    await fremad(0);
    await svarFor("A1", null); // manuelt forhåndsopslag: fejlfrit tomt (rigtigt netværkssvar data=null)
    await fremad(0);
    expect(net.insert).toHaveBeenCalledTimes(1);
    expect(net.insert.mock.calls[0][0]).toMatchObject({ id: "A1", content: "A1" });
    await svarFor("A1", null); // afstemning efter INSERT: stadig tom → uafklaret
    await fremad(0);
    expect(hentAfsendelser("e", "A")[0]).toMatchObject({ id: "A1", tilstand: "afstemmer", tidligereUkendt: true });
    const n0 = opslag("A1");
    await fremad(999);
    expect(opslag("A1")).toBe(n0); // timeren er planlagt, men ikke udløbet
    window.dispatchEvent(new Event("online")); window.dispatchEvent(new Event("online"));
    await fremad(0);
    expect(opslag("A1")).toBe(n0 + 1); // kapløbet: timeren erstattes af ÉN genstart
    window.dispatchEvent(new Event("online")); // under aktivt opslag → samles til én ventende genstart
    await fremad(0);
    expect(maksPrId).toBe(1);
    await svarFor("A1", null);
    await fremad(0);
    expect(opslag("A1")).toBe(n0 + 2);
    await svarFor("A1", { id: "A1" });
    await fremad(60000);
    expect(opslag("A1")).toBe(n0 + 2);
    expect(hentAfsendelser("e", "A")).toEqual([]);
    expect(net.insert).toHaveBeenCalledTimes(1); // automatisk afstemning skrev aldrig
    expect(ventende).toEqual([]);
    expect(afstemningsKapacitet()).toMatchObject({ aktive: 0, ventende: 0, iKoe: 0 });
  });

  // ---------- B2b-2: stophul 1 og sene svar efter stop (rigtig kø, rigtig afstemKun) ----------
  it("B2b-2 stophul 1: aktiv filafstemning stoppes før tomt beskedsvar → intet registeropslag, ingen lager-/cacheeffekt", async () => {
    const { tilfoejAfsendelse } = await import("@/lib/sbKladder");
    const { stopAfstemninger, afstemningsKapacitet } = await import("./ChatView");
    const fil: FilMeta = { name: "x.txt", type: "text/plain", size: 1, sti: "A/e/x.txt", trin: "uploadet" };
    tilfoejAfsendelse("e", "A", afs("A1", fil));
    await klarFake();
    expect(opslag("A1")).toBe(1); // beskedopslaget er startet (aktiv afstemKun)
    const inv = vi.spyOn(qc, "invalidateQueries");
    stopAfstemninger("e", "A", "A1");
    await svarFor("A1", null); // sent, fejlfrit tomt beskedsvar
    await fremad(60000);
    expect(net.kald.filter((k) => k === "select:sb_stier")).toEqual([]);
    expect(opslag("A1")).toBe(1);
    expect(inv).not.toHaveBeenCalled();
    expect(hentAfsendelser("e", "A")[0]).toMatchObject({ id: "A1", tilstand: "afstemmer" }); // stop fjerner ikke pending
    expect(afstemningsKapacitet()).toMatchObject({ aktive: 0, ventende: 0, iKoe: 0 });
  });

  for (const [navn, data] of [["sen succes", { id: "A1" }], ["sen fejl/tom", null]] as const) {
    it(`B2b-2: ${navn} efter stop med en nyere pending post på samme id rører ikke den nye post`, async () => {
      const { tilfoejAfsendelse, fjernAfsendelse } = await import("@/lib/sbKladder");
      const { stopAfstemninger } = await import("./ChatView");
      tilfoejAfsendelse("e", "A", afs("A1"));
      await klarFake();
      expect(opslag("A1")).toBe(1);
      stopAfstemninger("e", "A", "A1");
      await act(async () => { fjernAfsendelse("e", "A", "A1"); tilfoejAfsendelse("e", "A", { ...afs("A1"), tekst: "ny", tilstand: "afvist", fejl: "x" }); });
      const inv = vi.spyOn(qc, "invalidateQueries");
      await svarFor("A1", data);
      await fremad(0);
      expect(hentAfsendelser("e", "A")).toEqual([expect.objectContaining({ id: "A1", tekst: "ny", tilstand: "afvist" })]);
      expect(inv).not.toHaveBeenCalled();
      expect(opslag("A1")).toBe(1);
    });
  }

  it("B2b-2 (d2-rettelse): efter uafklaret manuel genafsendelse er netop 1 s-timeren aktiv og udløser præcis ét opslag", async () => {
    const { tilfoejAfsendelse } = await import("@/lib/sbKladder");
    tilfoejAfsendelse("e", "A", afs("A1"));
    await klarFake();
    for (let n = 0; n < 7; n++) { if (ventende.some((x) => x.id === "A1")) await svarFor("A1", null); await fremad(30000); }
    const t0 = vi.getTimerCount(); // udtømt: ingen afstemningstimer (øvrige komponenttimere tælles med i t0)
    net.insert.mockReturnValueOnce({ error: { message: "transport" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Prøv igen" })); });
    await fremad(0);
    await svarFor("A1", null);
    await fremad(0);
    await svarFor("A1", null);
    await fremad(0);
    const n0 = opslag("A1");
    expect(vi.getTimerCount()).toBe(t0 + 1); // netop den planlagte fortsættelse
    await fremad(999);
    expect(opslag("A1")).toBe(n0);
    await fremad(1); // netop timerens udløb (fjernes planlægningen, sker intet opslag her)
    expect(opslag("A1")).toBe(n0 + 1);
    await svarFor("A1", { id: "A1" });
    expect(net.insert).toHaveBeenCalledTimes(1);
  });

  // d2 §5: negative bevisbetingelser gennem komponentforløbet – ingen skrivende sideeffekter.
  for (const [navn, afv] of [
    ["binding til andet id", { besked_id: "ANDET" }], ["fremmed ejer", { ejer_employee_id: "x" }], ["fremmed samtale", { samtale_id: "Z" }],
    ["anden bucket", { bucket: "andet" }], ["anden sti", { sti: "c/e/anden.txt" }], ["status uploadet", { status: "uploadet" }], ["ukendt status", { status: "?" }],
  ] as const) it(`d2 §5 negativ (${navn}): automatisk afstemning giver intet genudstedelsestilbud og nul udstedelse/upload/INSERT`, async () => {
    const { tilfoejAfsendelse } = await import("@/lib/sbKladder");
    const fil: FilMeta = { name: "x.txt", type: "text/plain", size: 1, sti: "c/e/gammel.txt", trin: "uploadet" };
    tilfoejAfsendelse("e", "A", afs("F1", fil), new File(["x"], "x.txt", { type: "text/plain" }));
    net.svar.sb_stier = [{ data: { bucket: "chat-attachments", sti: "c/e/gammel.txt", besked_id: null, status: "slettes", samtale_id: "A", ejer_employee_id: "e", ...afv }, error: null }];
    await klarFake();
    await svarFor("F1", null);
    await fremad(0);
    expect(hentAfsendelser("e", "A")[0]?.tilstand).not.toBe("genudsted");
    expect(udstedUpload).not.toHaveBeenCalled();
    expect(uploadTilSti).not.toHaveBeenCalled();
    expect(net.insert).not.toHaveBeenCalled();
    expect(net.kald.filter((k) => k.startsWith("insert"))).toEqual([]);
  });

  for (const status of ["slettes", "slettet"]) it(`§8 A (${status}): forhåndsopslag med overtaget sti → tilbud, nul INSERT; efter tryk én udstedelse og samme id`, async () => {
    const { tilfoejAfsendelse } = await import("@/lib/sbKladder");
    const fil: FilMeta = { name: "x.txt", type: "text/plain", size: 1, sti: "c/e/gammel.txt", trin: "uploadet" };
    tilfoejAfsendelse("e", "A", afs("F1", fil), new File(["x"], "x.txt", { type: "text/plain" }));
    const reg = (sti: string, status: string) => ({ data: { bucket: "chat-attachments", sti, besked_id: null, status, samtale_id: "A", ejer_employee_id: "e" }, error: null });
    net.svar.sb_stier = [reg("c/e/gammel.txt", status)];
    await klarFake();
    await svarFor("F1", null);
    expect(udstedUpload).not.toHaveBeenCalled(); // automatisk afstemning udfører aldrig genudstedelse
    expect(net.insert).not.toHaveBeenCalled();
    udstedUpload.mockResolvedValueOnce({ sti: "c/e/ny.txt", token: "t", conversationId: "A" });
    uploadTilSti.mockResolvedValueOnce(undefined);
    net.svar.sb_stier = [reg("c/e/ny.txt", "uploadet")];
    net.insert.mockReturnValueOnce({ error: null });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Ikke sendt – prøv igen" })); });
    await fremad(0);
    await svarFor("F1", null);
    await fremad(0);
    expect(udstedUpload).toHaveBeenCalledTimes(1);
    expect(net.insert).toHaveBeenCalledTimes(1);
    expect(net.insert.mock.calls[0][0]).toMatchObject({ id: "F1", attachment_path: "c/e/ny.txt" });
  });

  // ---------- B2a-d1 ----------
  const afvist = (id: string, tekst: string): Afsendelse => ({ id, tekst, svarId: null, fil: null, tilstand: "afvist", fejl: null, tidligereUkendt: false, oprettet: 1 });
  async function fuldKapacitetMedR1() {
    const { tilfoejAfsendelse } = await import("@/lib/sbKladder");
    for (const id of ["P0", "P1", "P2"]) tilfoejAfsendelse("e", "A", afs(id));
    tilfoejAfsendelse("e", "A", afvist("R1", "gammel"));
    const r = await klarFake();
    expect(samtidige).toBe(3);
    return r;
  }
  const afslutAlle = async () => { for (const x of [...ventende]) await svarFor(x.id, { id: x.id }); await fremad(0); };

  it("d1 §1: Prøv igen på vent + Ret i samme handling (før render) → Ret afvist; kun det accepterede forsøg sendes", async () => {
    const { afstemningsKapacitet } = await import("./ChatView");
    await fuldKapacitetMedR1();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Ikke sendt – prøv igen" }));
      fireEvent.click(screen.getByRole("button", { name: "Ret" }));
    });
    expect(afstemningsKapacitet().ventende).toBe(1);
    expect((screen.getByLabelText("besked") as HTMLTextAreaElement).value).toBe("");
    expect(hentAfsendelser("e", "A").find((x) => x.id === "R1")?.tekst).toBe("gammel");
    expect(screen.getByRole("button", { name: "Ret" })).toBeDisabled();
    net.insert.mockReturnValueOnce({ error: null });
    await svarFor("P0", { id: "P0" });
    await fremad(0);
    await svarFor("R1", null); // forhåndsopslag
    await fremad(0);
    expect(net.insert).toHaveBeenCalledTimes(1);
    expect(net.insert.mock.calls[0][0]).toMatchObject({ id: "R1", content: "gammel" });
    await afslutAlle();
    expect(hentAfsendelser("e", "A")).toEqual([]);
    expect(afstemningsKapacitet()).toMatchObject({ aktive: 0, ventende: 0, iKoe: 0 });
    expect(maks).toBe(3);
  });

  it("d1 §1: remount under pladsventning → Ret stadig spærret, ét INSERT, kapacitet frigivet", async () => {
    const { afstemningsKapacitet } = await import("./ChatView");
    const r = await fuldKapacitetMedR1();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Ikke sendt – prøv igen" })); });
    r.unmount();
    await klarFake();
    expect(screen.getByRole("button", { name: "Ret" })).toBeDisabled();
    expect(afstemningsKapacitet().ventende).toBe(1);
    net.insert.mockReturnValueOnce({ error: null });
    await svarFor("P1", { id: "P1" });
    await svarFor("R1", null);
    await fremad(0);
    expect(net.insert).toHaveBeenCalledTimes(1);
    await afslutAlle();
    expect(afstemningsKapacitet()).toMatchObject({ aktive: 0, ventende: 0 });
  });

  it("d1 §1: sessionsskift under pladsventning → intet opslag/INSERT fra det gamle forsøg", async () => {
    const { afstemningsKapacitet } = await import("./ChatView");
    const { supabase } = await import("@/integrations/supabase/client");
    const auth = vi.mocked(supabase.auth.onAuthStateChange).mock.calls[0][0] as (e: string, s: unknown) => void;
    act(() => { auth("SIGNED_IN", { user: { id: "u" } }); });
    await fuldKapacitetMedR1();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Ikke sendt – prøv igen" })); });
    act(() => { auth("SIGNED_OUT", null); auth("SIGNED_IN", { user: { id: "u" } }); });
    await fremad(0);
    await afslutAlle();
    expect(opslag("R1")).toBe(0);
    expect(net.insert).not.toHaveBeenCalled();
    expect(afstemningsKapacitet()).toMatchObject({ aktive: 0, ventende: 0 });
  });

  it("d1 §2: stop id + fjern pending mens manuel venter → nul SELECT/INSERT; andre id'er fortsætter", async () => {
    const { fjernAfsendelse, tilfoejAfsendelse } = await import("@/lib/sbKladder");
    const { stopAfstemninger, afstemningsKapacitet } = await import("./ChatView");
    await fuldKapacitetMedR1();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Ikke sendt – prøv igen" })); });
    expect(afstemningsKapacitet().ventende).toBe(1);
    act(() => { stopAfstemninger("e", "A", "R1"); fjernAfsendelse("e", "A", "R1"); });
    expect(afstemningsKapacitet().ventende).toBe(0);
    await act(async () => { tilfoejAfsendelse("e", "A", afs("Q1")); });
    await svarFor("P0", { id: "P0" });
    await fremad(0);
    expect(opslag("Q1")).toBe(1); // andre forløb fortsætter på den frigivne plads
    await afslutAlle();
    expect(opslag("R1")).toBe(0);
    expect(net.insert).not.toHaveBeenCalled();
    expect(afstemningsKapacitet()).toMatchObject({ aktive: 0, ventende: 0, iKoe: 0 });
  });

  it("d1 §2: stop hele samtalen mens manuel venter → intet fra det annullerede arbejde, anden samtale uberørt", async () => {
    const { tilfoejAfsendelse } = await import("@/lib/sbKladder");
    const { stopAfstemninger, afstemningsKapacitet } = await import("./ChatView");
    tilfoejAfsendelse("e", "B", afs("B1"));
    await fuldKapacitetMedR1();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Ikke sendt – prøv igen" })); });
    act(() => { stopAfstemninger("e", "A"); });
    expect(afstemningsKapacitet().ventende).toBe(0);
    await afslutAlle(); // sene svar fra stoppede baggrundsforløb
    expect(opslag("R1")).toBe(0);
    expect(net.insert).not.toHaveBeenCalled();
    expect(hentAfsendelser("e", "A").map((x) => x.id).sort()).toEqual(["P0", "P1", "P2", "R1"]); // sene svar ændrer ikke lageret
    expect(afstemningsKapacitet()).toMatchObject({ aktive: 0, ventende: 0 });
  });

  it("d1 §2: stop under startet forhåndsopslag → sent svar starter intet INSERT og ændrer ikke lager/cache", async () => {
    const { tilfoejAfsendelse } = await import("@/lib/sbKladder");
    const { stopAfstemninger, afstemningsKapacitet } = await import("./ChatView");
    tilfoejAfsendelse("e", "A", afvist("R1", "gammel"));
    await klarFake();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Ikke sendt – prøv igen" })); });
    await fremad(0);
    expect(opslag("R1")).toBe(1);
    expect(afstemningsKapacitet().aktive).toBe(1); // fysisk igangværende kald holder sin plads
    act(() => { stopAfstemninger("e", "A", "R1"); });
    const inv = vi.spyOn(qc, "invalidateQueries");
    await svarFor("R1", null);
    await fremad(5000);
    expect(net.insert).not.toHaveBeenCalled();
    expect(opslag("R1")).toBe(1);
    expect(inv).not.toHaveBeenCalled();
    expect(hentAfsendelser("e", "A").find((x) => x.id === "R1")?.tilstand).toBe("sender");
    expect(afstemningsKapacitet()).toMatchObject({ aktive: 0, ventende: 0, iKoe: 0 });
  });
});

// ---------- B2a-d2 §4: manglende integrationsforløb gennem rigtig ChatView (netværk ved grænsen) ----------
describe("d2 §4 – integrationsforløb med auth-callbacks", () => {
  let auth!: (e: string, s: unknown) => void;
  let fetchSpy: ReturnType<typeof vi.spyOn> | null = null;
  beforeEach(async () => {
    beskeder.ægteSend = true;
    const { supabase } = await import("@/integrations/supabase/client");
    // B2b-2: typet sessionsfixture uden as-never-omgåelse.
    const session: Session = { access_token: "t", refresh_token: "r", expires_in: 3600, token_type: "bearer",
      user: { id: "u", app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "2026-10-28T00:00:00Z" } };
    graense.session.mockResolvedValue({ data: { session }, error: null });
    auth = vi.mocked(supabase.auth.onAuthStateChange).mock.calls[0][0] as (e: string, s: unknown) => void;
    act(() => { auth("SIGNED_IN", { user: { id: "u" } }); });
  });
  afterEach(() => { fetchSpy?.mockRestore(); fetchSpy = null; });

  it("auth-skift mellem Send og mutationens faktiske start (ventepunkt: kapacitet) → mutationen starter aldrig", async () => {
    const { tilfoejAfsendelse } = await import("@/lib/sbKladder");
    const { afstemningsKapacitet } = await import("./ChatView");
    const hold = new Map<string, (s: Svar) => void>();
    net.vent = (id) => new Promise<Svar>((res) => hold.set(id, res));
    for (const id of ["P0", "P1", "P2"]) tilfoejAfsendelse("e", "A", { id, tekst: id, svarId: null, fil: null, tilstand: "afstemmer", fejl: null, tidligereUkendt: true, oprettet: 1 });
    const r = await klar();
    await waitFor(() => expect(hold.size).toBe(3)); // kapaciteten er optaget af tre startede opslag
    skriv("hej"); await act(async () => { fireEvent.click(send()); });
    expect(afstemningsKapacitet().ventende).toBe(1); // ventepunktet er nået: Send accepteret, mutationen ikke startet
    const foer = net.kald.filter((k) => k === "select:chat_messages").length;
    act(() => { auth("SIGNED_OUT", null); auth("SIGNED_IN", { user: { id: "u" } }); });
    expect(afstemningsKapacitet().ventende).toBe(0);
    await act(async () => { for (const [id, res] of hold) res({ data: { id }, error: null }); hold.clear(); await new Promise((x) => setTimeout(x, 0)); });
    await tick();
    for (const [id, res] of hold) res({ data: { id }, error: null }); // eventuelle detached opslag afsluttes
    await tick();
    expect(net.kald.filter((k) => k === "select:chat_messages").length).toBe(foer); // ingen forhåndsopslag fra den gamle Send
    expect(net.insert).not.toHaveBeenCalled();
    expect(afstemningsKapacitet()).toMatchObject({ aktive: 0, ventende: 0 });
    r.unmount();
  });

  it("A–B–A med lagringsfejl: skrivekladde, valgt svar, filmetadata, åben redigering med startrevision og fejlstatus for begge", async () => {
    const { gemRetKladde } = await import("@/lib/sbKladder");
    const { supabase } = await import("@/integrations/supabase/client");
    beskeder.liste = [fremmed("svar-A", "besked A"), fremmed("m1", "original", { sender_id: "e", revision: 3 })];
    gemRetKladde("e", "A", { beskedId: "m1", tekst: "min rettelse", revision: 3 });
    // B2b-2: udstedelse og upload gennem den rigtige sbFil (fetch/storage ved netværksgrænsen).
    beskeder.ægteFil = true;
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ sti: "c/e/x.txt", token: "k" }), { status: 200 }));
    const upFn = vi.fn(async () => ({ error: null }));
    lagerUpload.fn = upFn;
    const r = await klar();
    const editor = () => screen.getAllByRole("textbox").find((x) => x.getAttribute("aria-label") !== "besked") as HTMLTextAreaElement;
    await waitFor(() => expect(editor().value).toBe("min rettelse"));
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    try {
      fireEvent.click(within(screen.getByText("besked A").closest(".group") as HTMLElement).getByRole("button", { name: "Svar" }));
      skriv("kladdetekst");
      await vaelg(r.container, new File(["x"], "x.txt", { type: "text/plain" }));
      await waitFor(() => expect(send()).not.toBeDisabled());
      expect(fetchSpy).toHaveBeenCalledTimes(1); expect(upFn).toHaveBeenCalledTimes(1);
      expect(udstedUpload).not.toHaveBeenCalled(); // ingen mocket udstedelse
      fireEvent.change(editor(), { target: { value: "min rettelse 2" } });
      await tick();
      expect(set).toHaveBeenCalled(); // lagringen fejlede faktisk
      await navigér(r, "B"); await navigér(r, "A");
      expect((screen.getByLabelText("besked") as HTMLTextAreaElement).value).toBe("kladdetekst");
      expect(screen.getByText("Svarer på:").parentElement).toHaveTextContent("besked A");
      expect(screen.getByText("x.txt")).toBeInTheDocument();
      expect(editor().value).toBe("min rettelse 2");
      expect(screen.getAllByText(LAGER_TEKST)).toHaveLength(2); // komponist og redigering
    } finally { set.mockRestore(); }
    graense.rpc.mockClear();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Gem ændring" })); });
    expect(graense.rpc).toHaveBeenCalledWith("sb_ret", expect.objectContaining({ p_id: "m1", p_revision: 3, p_tekst: "min rettelse 2" }));
    r.unmount();
  });

  it("sessionsskift under allerede startet rigtig Storage-upload → sent svar starter intet trin eller INSERT", async () => {
    beskeder.ægteFil = true;
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ sti: "c/e/x.txt", token: "k" }), { status: 200 }));
    const up = kontrol<{ error: unknown }>();
    const upFn = vi.fn(() => up.p);
    lagerUpload.fn = upFn;
    const r = await klar();
    await vaelg(r.container, new File(["x"], "x.txt", { type: "text/plain" }));
    await waitFor(() => expect(upFn).toHaveBeenCalledTimes(1)); // uploadens netværkstrin er startet
    act(() => { auth("SIGNED_OUT", null); auth("SIGNED_IN", { user: { id: "u" } }); });
    await act(async () => { up.res({ error: null }); await up.p; });
    await tick();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(upFn).toHaveBeenCalledTimes(1);
    expect(net.insert).not.toHaveBeenCalled();
    expect(net.kald.filter((k) => k.startsWith("insert"))).toEqual([]);
    expect(gemtFil()).toBeNull();
    expect(screen.queryByText("x.txt")).toBeNull();
    r.unmount();
  });
});
const LAGER_TEKST = "Kladden kunne ikke gemmes på enheden – den findes kun, mens siden er åben";


// ---------- B2c-1 §5 (T5) – frister, søgning og svaruddrag ----------
describe("T5 (B2c-1 §5) – lokal fristkontrol i tråd, svaruddrag og valgt svar", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn> | undefined;
  afterEach(() => { fetchSpy?.mockRestore(); fetchSpy = undefined; vi.useRealTimers(); });
  const om = (ms: number) => new Date(Date.now() + ms).toISOString();
  const vent = (ms: number) => act(async () => { await new Promise((x) => setTimeout(x, ms)); });
  const svarFra = (id: string, content: string, slettes_efter: string | null) => ({
    id, content, sender_id: "anden", sender: { id: "anden", full_name: "Kollega" }, status: "leveret", slettes_efter, deleted_at: null,
  });

  it("offline-udløb: åben tekstfil, åbent billede, pågående hentning, svaruddrag og valgt svar fjernes straks uden netværk", async () => {
    // B2c-1b: årsag til ustabilitet = vægurfrist (rigtig tid) mod klikkenes varighed; ved langsomme/blandede kørsler
    // udløb c.png før klikket. Nu styres Date deterministisk; kun planlægningstimeren kører i rigtig tid.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-29T00:00:00Z"));
    const frist = om(300);
    const signaler: AbortSignal[] = [];
    let n = 0;
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(((_u: string, init?: RequestInit) => {
      if (init?.signal) signaler.push(init.signal);
      n++;
      if (n === 1) return Promise.resolve(new Response("filindhold", { status: 200, headers: { "Content-Type": "text/plain" } }));
      if (n === 2) return Promise.resolve(new Response(new Uint8Array([1, 2]), { status: 200, headers: { "Content-Type": "image/png" } }));
      // Pågående hentning, der skal aborteres (afvises ved abort, så sbFil's plads frigives).
      return new Promise((_r, rej) => init?.signal?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError"))));
    }) as typeof fetch);
    // jsdom mangler Blob.text(); læses via FileReader (kun prøvemiljø).
    if (!Blob.prototype.text) {
      Blob.prototype.text = function (this: Blob) {
        return new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsText(this); });
      };
    }
    const revoke = vi.fn();
    globalThis.URL.revokeObjectURL = revoke;
    beskeder.liste = [
      fremmed("m1", "hemmelig", { attachment_path: "A/x/a.txt", attachment_type: "text/plain", attachment_name: "a.txt", slettes_efter: frist }),
      fremmed("m2", "billede", { attachment_path: "A/x/b.png", attachment_type: "image/png", attachment_name: "b.png", slettes_efter: frist }),
      fremmed("m3", "langsom", { attachment_path: "A/x/c.png", attachment_type: "image/png", attachment_name: "c.png", slettes_efter: frist }),
      fremmed("m4", "mit svar", { reply_to_id: "m1", reply_to: svarFra("m1", "hemmelig", frist) }),
    ];
    gemKladde("e", "A", { tekst: "kladde", svarId: "m1", fil: null, retId: null });
    await klar();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Åbn a.txt" })); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Åbn b.png" })); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Åbn c.png" })); });
    await waitFor(() => expect(screen.getByText("filindhold")).toBeTruthy());
    await waitFor(() => expect(screen.getByRole("img", { name: "b.png" })).toBeTruthy());
    expect(screen.getAllByText("hemmelig").length).toBeGreaterThanOrEqual(2); // tråd + svaruddrag (+ valgt svar)
    expect(screen.getByText("Svarer på:")).toBeTruthy();
    const kaldFoer = fetchSpy.mock.calls.length;
    await act(async () => { vi.setSystemTime(Date.now() + 400); });
    await vent(700);
    expect(screen.queryByText("hemmelig")).toBeNull();
    expect(screen.queryByText("filindhold")).toBeNull();
    expect(screen.queryByRole("img", { name: "b.png" })).toBeNull();
    expect(screen.queryByText("Svarer på:")).toBeNull();
    expect(screen.getByText("Beskeden er ikke længere tilgængelig")).toBeTruthy(); // m4's svaruddrag
    expect(revoke).toHaveBeenCalledWith("blob:test");
    expect(signaler[2]?.aborted).toBe(true);
    expect(fetchSpy.mock.calls.length).toBe(kaldFoer); // skjulning kræver ingen netværkskald
    expect(laesKladde("e", "A")?.svarId ?? null).toBeNull();
    expect(laesKladde("e", "A")?.tekst).toBe("kladde");
  });

  it("successive frister: hver frist planlægges efter den forrige", async () => {
    beskeder.liste = [fremmed("a", "første", { slettes_efter: om(150) }), fremmed("b", "anden", { slettes_efter: om(450) }), fremmed("c", "varig")];
    await klar();
    await vent(250);
    expect(screen.queryByText("første")).toBeNull();
    expect(screen.getByText("anden")).toBeTruthy();
    await vent(300);
    expect(screen.queryByText("anden")).toBeNull();
    expect(screen.getByText("varig")).toBeTruthy();
  });

  it("SQL-pladsholder efter oprydning: samme id vises igen med serverens pladsholder (ingen blokliste)", async () => {
    beskeder.liste = [fremmed("a", "original", { slettes_efter: om(-1000) })];
    const r = await klar();
    expect(screen.queryByText("original")).toBeNull();
    expect(screen.getByText("Ingen beskeder endnu. Start samtalen!")).toBeTruthy(); // tomtilstand fra det viste indhold
    beskeder.liste = [fremmed("a", "Beskeden er slettet efter fristen", { status: "trukket_tilbage", slettes_efter: null })];
    beskeder.opdateret = 1;
    r.rerender(wrap(<ChatView conversationId="A" />));
    await tick();
    expect(screen.getByText("Beskeden er slettet efter fristen")).toBeTruthy();
    expect(screen.queryByText("original")).toBeNull();
  });

  it("ingen kvittering for lokalt skjulte rækker (kun den viste)", async () => {
    const kvit = vi.fn();
    kvitMutate.fn = kvit;
    const fokus = vi.spyOn(document, "hasFocus").mockReturnValue(true);
    beskeder.liste = [
      fremmed("skjult", "x", { read_receipts: [], slettes_efter: om(-1000) }),
      fremmed("vist", "y", { read_receipts: [] }),
    ];
    await klar();
    fokus.mockRestore();
    const ids = kvit.mock.calls.flatMap((c) => (c[0] as { messageIds: string[] }).messageIds);
    expect(ids).toContain("vist");
    expect(ids).not.toContain("skjult");
  });

  it("svaroriginal uden for indlæste sider: afgrænset opslag viser originalen; fravær i siden fjerner ikke svaret", async () => {
    beskeder.liste = [fremmed("m", "tråd")];
    net.svar.chat_messages = [{ data: { id: "ude", content: "gammel original", sender_id: "s", status: "leveret", slettes_efter: null, deleted_at: null, sender: { id: "s", first_name: "Kol", last_name: "Lega" } }, error: null }];
    gemKladde("e", "A", { tekst: "", svarId: "ude", fil: null, retId: null });
    await klar();
    await waitFor(() => expect(screen.getByText("gammel original")).toBeTruthy());
    expect(net.kald).toContain("select:chat_messages");
    expect(laesKladde("e", "A")?.svarId).toBe("ude");
  });

  it("svaroriginal: tomt RLS-opslag → ingen svartekst og referencen ryddes; fejl → ingen tekst, referencen bevares", async () => {
    beskeder.liste = [fremmed("m", "tråd")];
    net.svar.chat_messages = [{ data: null, error: null }];
    gemKladde("e", "A", { tekst: "t", svarId: "vaek", fil: null, retId: null });
    const r = await klar();
    await waitFor(() => expect(laesKladde("e", "A")?.svarId ?? null).toBeNull());
    expect(screen.queryByText("Svarer på:")).toBeNull();
    r.unmount(); qc.clear();
    net.svar.chat_messages = [{ data: null, error: { message: "netværk" } }];
    gemKladde("e", "A", { tekst: "t", svarId: "fejl", fil: null, retId: null });
    await klar();
    await waitFor(() => expect(screen.getByText("Svaret kan ikke vises lige nu")).toBeTruthy());
    expect(laesKladde("e", "A")?.svarId).toBe("fejl");
  });

  it("svaroriginal fra opslag med udløbet frist (klientens ur) vises ikke, selv om serveren returnerede den", async () => {
    beskeder.liste = [fremmed("m", "tråd")];
    net.svar.chat_messages = [{ data: { id: "ude", content: "skal skjules", sender_id: "s", status: "leveret", slettes_efter: om(-10), deleted_at: null, sender: null }, error: null }];
    gemKladde("e", "A", { tekst: "", svarId: "ude", fil: null, retId: null });
    await klar();
    await tick(); await tick();
    expect(screen.queryByText("skal skjules")).toBeNull();
  });

  it("urforskel: serveren returnerer fortsat rækken → skjult lokalt og ny genhentning 2/4/8/16/32 s; uden rækken stopper planlægningen", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const inval = vi.spyOn(qc, "invalidateQueries");
    const genhentninger = () => inval.mock.calls.filter((c) => JSON.stringify(c[0]?.queryKey) === JSON.stringify(["chat-messages", "A"])).length;
    beskeder.liste = [fremmed("a", "original", { slettes_efter: new Date(Date.now() + 100).toISOString() })];
    const r = render(wrap(<ChatView conversationId="A" />));
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(screen.getByText("original")).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(screen.queryByText("original")).toBeNull(); // lokalt visningsværn uanset server
    expect(genhentninger()).toBe(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(genhentninger()).toBe(1);
    // Serveren (bagud-ur) returnerer stadig rækken med samme frist.
    const returner = async () => { beskeder.opdateret++; r.rerender(wrap(<ChatView conversationId="A" />)); await act(async () => { await vi.advanceTimersByTimeAsync(0); }); };
    await returner();
    await act(async () => { await vi.advanceTimersByTimeAsync(1999); });
    expect(genhentninger()).toBe(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(genhentninger()).toBe(2);
    expect(screen.queryByText("original")).toBeNull();
    // Anden genhentning uden rækken → planlægningen stopper.
    beskeder.liste = []; beskeder.opdateret++;
    r.rerender(wrap(<ChatView conversationId="A" />));
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(genhentninger()).toBe(2);
  });

  it("urforskel: højst fem ekstra genhentninger (2, 4, 8, 16, 32 s), derefter ingen 0-ms-løkke", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const inval = vi.spyOn(qc, "invalidateQueries");
    const genhentninger = () => inval.mock.calls.filter((c) => JSON.stringify(c[0]?.queryKey) === JSON.stringify(["chat-messages", "A"])).length;
    beskeder.liste = [fremmed("a", "original", { slettes_efter: new Date(Date.now() - 1).toISOString() })];
    const r = render(wrap(<ChatView conversationId="A" />));
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(genhentninger()).toBe(1);
    for (const [i, ms] of [2000, 4000, 8000, 16000, 32000].entries()) {
      beskeder.opdateret++;
      r.rerender(wrap(<ChatView conversationId="A" />));
      await act(async () => { await vi.advanceTimersByTimeAsync(ms - 1); });
      expect(genhentninger()).toBe(i + 1);
      await act(async () => { await vi.advanceTimersByTimeAsync(1); });
      expect(genhentninger()).toBe(i + 2);
    }
    beskeder.opdateret++;
    r.rerender(wrap(<ChatView conversationId="A" />));
    await act(async () => { await vi.advanceTimersByTimeAsync(600_000); });
    expect(genhentninger()).toBe(6);
    expect(vi.getTimerCount()).toBeLessThan(5); // ingen ophobede/løbske timere
  });
});

describe("B2c-1b §1/§2 – aktuel frist og genvalidering af valgt svar", () => {
  const T0 = new Date("2026-10-29T00:00:00Z").getTime();
  const iso = (ms: number) => new Date(T0 + ms).toISOString();
  const raekke = (content: string, slettes_efter: string | null = null) => ({ data: { id: "x", content, sender_id: "s", status: "leveret", slettes_efter, deleted_at: null, sender: null }, error: null });
  const vent = (ms: number) => act(async () => { await new Promise((x) => setTimeout(x, ms)); });
  beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(T0); });
  afterEach(() => { vi.useRealTimers(); });

  it("frist passerer under svaropslag → udløbet svar vises aldrig", async () => {
    const k = kontrol<unknown>();
    net.vent = () => k.p;
    beskeder.liste = [fremmed("m", "tråd")];
    gemKladde("e", "A", { tekst: "", svarId: "x", fil: null, retId: null });
    const r = await klar();
    vi.setSystemTime(T0 + 1000);
    await act(async () => { k.res(raekke("udløbet svar", iso(500))); await k.p; });
    await vent(0);
    expect(screen.queryByText("udløbet svar")).toBeNull();
    r.unmount();
  });

  it("gammel svartekst skjules straks ved genforbindelse; læsefejl → fejltilstand uden tekst, reference bevaret", async () => {
    net.svar.chat_messages = [raekke("svartekst")];
    beskeder.liste = [fremmed("m", "tråd")];
    gemKladde("e", "A", { tekst: "", svarId: "x", fil: null, retId: null });
    const r = await klar();
    await waitFor(() => expect(screen.getByText("svartekst")).toBeTruthy());
    net.svar.chat_messages = [{ data: null, error: { message: "Failed to fetch" } }];
    await act(async () => { window.dispatchEvent(new Event("online")); });
    expect(screen.queryByText("svartekst")).toBeNull(); // straks, før debounce/netværk
    await vent(400);
    await waitFor(() => expect(screen.getByText("Svaret kan ikke vises lige nu")).toBeTruthy());
    expect(screen.queryByText("svartekst")).toBeNull();
    expect(laesKladde("e", "A")?.svarId).toBe("x"); // fejl er ikke sletning
    r.unmount();
  });

  it("sent oprindeligt svar efter invalidation genindsætter ikke indhold (query havde endnu ingen data)", async () => {
    const gammel = kontrol<unknown>();
    let n = 0;
    net.vent = () => (++n === 1 ? gammel.p : Promise.resolve(raekke("ny tekst")));
    beskeder.liste = [fremmed("m", "tråd")];
    gemKladde("e", "A", { tekst: "", svarId: "x", fil: null, retId: null });
    const r = await klar();
    await act(async () => { window.dispatchEvent(new Event("online")); });
    await vent(400);
    await waitFor(() => expect(screen.getByText("ny tekst")).toBeTruthy());
    await act(async () => { gammel.res(raekke("gammel tekst")); await gammel.p; });
    await vent(0);
    expect(screen.queryByText("gammel tekst")).toBeNull();
    expect(screen.getByText("ny tekst")).toBeTruthy();
    r.unmount();
  });

  it("fokus før fristtimerbehandling: ingen kvittering af udløbne id'er", async () => {
    const kvit = vi.fn();
    kvitMutate.fn = kvit;
    const fokus = vi.spyOn(document, "hasFocus").mockReturnValue(false);
    beskeder.liste = [fremmed("u1", "udløber", { slettes_efter: iso(1000) }), fremmed("v1", "varig")];
    const r = await klar();
    vi.setSystemTime(T0 + 1500);
    fokus.mockReturnValue(true);
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    const ids = kvit.mock.calls.flatMap((c) => (c[0] as { messageIds?: string[] }).messageIds ?? []);
    expect(ids).not.toContain("u1");
    fokus.mockRestore();
    r.unmount();
  });
});
