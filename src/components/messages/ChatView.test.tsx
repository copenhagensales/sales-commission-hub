import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const mutateAsync = vi.fn();
const beskeder = vi.hoisted(() => ({ liste: [] as unknown[], ægteSend: false }));
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
      rpc: vi.fn(async () => ({ data: "e", error: null })),
      functions: { invoke: vi.fn(async () => ({ error: null })) },
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "u" } } })), onAuthStateChange: vi.fn(),
        getSession: vi.fn(async () => ({ data: { session: { access_token: "t" } } })),
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
  udstedUpload: (...a: unknown[]) => udstedUpload(...a),
  uploadTilSti: (...a: unknown[]) => uploadTilSti(...a),
}));
vi.mock("@/hooks/useChat", async (orig) => {
  const ægte = await orig<typeof import("@/hooks/useChat")>();
  return {
    ...ægte,
    useMessages: () => ({ data: beskeder.liste, isLoading: false, hasOlder: false, isLoadingOlder: false, loadOlder: () => undefined }),
    // §9: rigtig useSendMessage (rigtige send-/afstemningsfunktioner) når ægteSend er sat; ellers kontrolleret mutateAsync.
    useSendMessage: () => (beskeder.ægteSend ? ægte.useSendMessage() : { mutateAsync }),
    useRealtimeMessages: () => undefined,
    useMarkAsRead: () => ({ mutate: vi.fn(), isPending: false }),
    useTypingIndicator: () => ({ typingUsers: [], setTyping: vi.fn() }),
    useChatAktiv: () => undefined,
    afstemKun: (...a: Parameters<typeof ægte.afstemKun>) => (beskeder.ægteSend ? ægte.afstemKun(...a) : afstemKun()),
  };
});

import { ChatView } from "./ChatView";
import { SendFejl, IKKE_REGISTRERET_TEKST } from "@/hooks/useChat";
import { rydAlleKladder, hentAfsendelser, type Afsendelse, type FilMeta } from "@/lib/sbKladder";
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
  beskeder.liste = []; beskeder.ægteSend = false;
  net.insert.mockReset(); net.kald.length = 0; net.vent = null; for (const k of Object.keys(net.svar)) delete net.svar[k];
  mutateAsync.mockReset(); udstedUpload.mockReset(); uploadTilSti.mockReset(); afstemKun.mockClear();
});

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

  it("afvist filsending → Ret bevarer id, fil og svar; ny Send bruger samme id", async () => {
    await medFil();
    mutateAsync.mockRejectedValueOnce(new SendFejl("server", "Afvist"));
    skriv("tekst"); await act(async () => { fireEvent.click(send()); });
    const id = (mutateAsync.mock.calls[0][0] as { id: string }).id;
    fireEvent.click(await screen.findByRole("button", { name: "Ret" }));
    expect(screen.getByText("x.txt")).toBeInTheDocument();
    mutateAsync.mockResolvedValueOnce({});
    await act(async () => { fireEvent.click(send()); });
    expect(mutateAsync.mock.calls[1][0]).toMatchObject({ id, attachmentPath: "c/e/gammel.txt", content: "tekst" });
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
    const up = kontrol<unknown>();
    udstedUpload.mockResolvedValueOnce({ sti: "c/e/x.txt", token: "t", conversationId: "A" });
    uploadTilSti.mockReturnValueOnce(up.p);
    const r = await klar();
    await vaelg(r.container, new File(["x"], "x.txt", { type: "text/plain" }));
    await tick();
    skriv("nyere tekst");
    await act(async () => { up.res(undefined); await up.p; });
    expect((screen.getByLabelText("besked") as HTMLTextAreaElement).value).toBe("nyere tekst");
    expect(JSON.parse(sessionStorage.getItem("sb-kladde:e:A")!)).toMatchObject({ tekst: "nyere tekst", fil: { trin: "uploadet" } });
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
    expect(hasUnsentDrafts()).toBe(true);
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
  afterEach(() => { vi.useRealTimers(); });

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

  it("manuelt genforsøg samtidig med timer: højst ét netværksforløb pr. id", async () => {
    const { tilfoejAfsendelse } = await import("@/lib/sbKladder");
    tilfoejAfsendelse("e", "A", afs("A1"));
    await klarFake();
    for (let n = 0; n < 7; n++) { if (ventende.length) await svarFor("A1", null); await fremad(30000); }
    const foer = opslag("A1");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Prøv igen" })); });
    await fremad(0);
    await fremad(1000); // køens timer når frem, mens den manuelle afsendelse holder låsen
    expect(maksPrId).toBe(1);
    expect(opslag("A1")).toBe(foer + 1);
    await svarFor("A1", { id: "A1" });
    expect(hentAfsendelser("e", "A")).toEqual([]);
    expect(net.insert).not.toHaveBeenCalled();
  });

  it("gammel afslutning efter overdragelse frigiver kun egen lås", async () => {
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

  it("§8 A: forhåndsopslag med overtaget sti → tilbud, nul INSERT; efter tryk én udstedelse og samme id", async () => {
    const { tilfoejAfsendelse } = await import("@/lib/sbKladder");
    const fil: FilMeta = { name: "x.txt", type: "text/plain", size: 1, sti: "c/e/gammel.txt", trin: "uploadet" };
    tilfoejAfsendelse("e", "A", afs("F1", fil), new File(["x"], "x.txt", { type: "text/plain" }));
    const reg = (sti: string, status: string) => ({ data: { bucket: "chat-attachments", sti, besked_id: null, status, samtale_id: "A", ejer_employee_id: "e" }, error: null });
    net.svar.sb_stier = [reg("c/e/gammel.txt", "slettet")];
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
});
