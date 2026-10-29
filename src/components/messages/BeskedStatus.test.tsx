import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// Netværket mockes ved grænsen; MessageBubble, BeskedStatus og hooks er de rigtige. SQL-adfærd er antagelser.
// B2b-3b §3: typede grænsemocks (ingen typeomgåelse ved rpc/invoke/from).

const graense = vi.hoisted(() => ({
  rpc: vi.fn<(...a: unknown[]) => Promise<unknown>>(async () => ({ data: "e", error: null })),
  invoke: vi.fn<(...a: unknown[]) => Promise<unknown>>(async () => ({ error: null })),
  from: vi.fn<(t: string) => unknown>(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { onAuthStateChange: vi.fn(), getSession: vi.fn() }, from: graense.from, rpc: graense.rpc, functions: { invoke: graense.invoke } },
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));
vi.mock("./FilVedhaeftning", () => ({ FilVedhaeftning: () => null }));

import { MessageBubble } from "./MessageBubble";
import { aktiveHandlinger } from "@/hooks/useChat";
import { rydAlleKladder, registrerKladdeOprydning, laesRetKladde } from "@/lib/sbKladder";
import { supabase } from "@/integrations/supabase/client";

// B2b-4b §3: typede auth-callbacks uden typeomgåelse – fuld Session bygges fra bruger-id.
const sessionFor = (id: string): Session => ({ access_token: `jwt-${id}`, refresh_token: "r", expires_in: 3600, token_type: "bearer",
  user: { id, app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "2026-01-01T00:00:00Z" } });
const authCb = (e: AuthChangeEvent, s: { user: { id: string } } | null): void => {
  const cb = vi.mocked(supabase.auth.onAuthStateChange).mock.calls[0][0];
  void cb(e, s ? sessionFor(s.user.id) : null);
};
import { toast } from "sonner";
import type { Message } from "@/hooks/useChat";

const afventer = (rev: number, fil = false): Message => ({
  id: "m1", conversation_id: "c", sender_id: "e", content: "vist tekst", status: "afventer_afsender", revision: rev,
  created_at: "2026-10-28T10:00:00Z", leveret_at: null, edited_at: null, reactions: [], read_receipts: [],
  attachment_path: fil ? "e/c/f" : null,
  updated_at: "2026-10-28T10:00:00Z", afventer_fra: null, trukket_tilbage_at: null, slettes_efter: null, personoplysning: false, vaern_niveau: 0,
});

let qc: QueryClient;
let auth: typeof authCb = authCb;
const ui = (m: Message, bruger: string | null = "u") => (
  <QueryClientProvider client={qc}>
    <MessageBubble message={m} isOwn currentEmployeeId="e" authBrugerId={bruger} conversationId="c" onReply={() => undefined} />
  </QueryClientProvider>);
// Rækkeopslag (antagelse om SQL-adfærd): chat_messages giver `raekke`, begrundelse giver `haard_tone`.
let raekke: { data: unknown; error: unknown } = { data: null, error: null };
const chain = (tabel: string) => { const b: Record<string, unknown> = {}; for (const k of ["select", "eq", "in", "order", "limit"]) b[k] = () => b;
  b.maybeSingle = async () => (tabel === "sb_tjek_begrundelser" ? { data: { aarsag_kode: "haard_tone" }, error: null } : tabel === "chat_messages" ? raekke : { data: null, error: null }); return b; };
// B2b-4a: den cachede InfiniteData-liste (samme form som useMessages) – kun en indarbejdet række beviser opdateret visning.
const liste = (r: { id?: string; status: string; revision: number }) =>
  qc.setQueryData(["chat-messages", "c"], { pages: [[{ id: "m1", ...r }]], pageParams: [0] });
/** B2b-4b §3: typesikker læsning af et felt i et mock-argument (ingen cast). */
const arg = (o: unknown, ...sti: string[]): unknown => sti.reduce<unknown>((x, k) => (typeof x === "object" && x !== null ? Reflect.get(x, k) : undefined), o);
const kald = (navn: string) => graense.rpc.mock.calls.filter((c) => c[0] === navn);

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { mutations: { retry: 1, retryDelay: 0 }, queries: { retry: false } } });
  rydAlleKladder();
  sessionStorage.clear();
  graense.rpc.mockReset();
  graense.from.mockImplementation(((t: string) => chain(t)));
  raekke = { data: null, error: null };
  vi.mocked(toast.error).mockReset();
  registrerKladdeOprydning();
  auth = authCb;
  auth("SIGNED_OUT", null); // ny generation pr. prøve: ingen låse fra tidligere prøver
  auth("SIGNED_IN", { user: { id: "u" } });
});

describe("T3 (B2b-1) – Ret fra statuskortet fastholder den viste revision", () => {
  it("Ret åbner editor med vist tekst; Gem sender den viste revision selv efter genhentning til ny revision", async () => {
    const r = render(ui(afventer(3)));
    fireEvent.click(screen.getByRole("button", { name: "Ret" }));
    expect(screen.getByRole("textbox")).toHaveProperty("value", "vist tekst");
    r.rerender(ui(afventer(4)));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "rettet" } });
    graense.rpc.mockResolvedValueOnce({ data: 4, /* SQL-kontrakt: startrevision 3 + 1 */ error: null });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Gem ændring" })); });
    expect(arg(kald("sb_ret")[0][1], "p_revision")).toBe(3);
  });

  it("uden auth-bruger åbner Ret ikke editoren", () => {
    act(() => { auth("SIGNED_OUT", null); });
    render(ui(afventer(3), null));
    fireEvent.click(screen.getByRole("button", { name: "Ret" }));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(laesRetKladde("e", "c", "m1")).toBeNull();
  });
});

describe("B2b-1 – useAfgoer/useFjernFil: viste revision, retry:0 og obligatorisk kontekst", () => {
  it("Træk tilbage sender den viste revision; transportfejl giver præcis ét sb_afgoer (trods mutations.retry=1)", async () => {
    graense.rpc.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(ui(afventer(7)));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Træk tilbage" })); await new Promise((x) => setTimeout(x, 10)); });
    expect(kald("sb_afgoer")).toHaveLength(1);
    expect(kald("sb_afgoer")[0][1]).toMatchObject({ p_revision: 7, p_handling: "traek" });
    // B2b-2: rækken er usynlig i mocken → ukendt udfald vises lokalt, ingen toast.
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("Afstemmer … udfaldet kunne ikke bekræftes");
  });

  it("Fjern fil sender den viste revision; transportfejl giver præcis ét sb_fjern_fil", async () => {
    graense.rpc.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(ui(afventer(2, true)));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Fjern fil" })); await new Promise((x) => setTimeout(x, 10)); });
    expect(kald("sb_fjern_fil")).toHaveLength(1);
    expect(kald("sb_fjern_fil")[0][1]).toMatchObject({ p_revision: 2 });
  });

  it("manglende auth-bruger: Træk tilbage og Fjern fil starter ingen RPC og ingen toast", async () => {
    act(() => { auth("SIGNED_OUT", null); });
    render(ui(afventer(2, true), null));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Træk tilbage" }));
      fireEvent.click(screen.getByRole("button", { name: "Fjern fil" }));
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("sessionsskift under sb_afgoer: sent fejlsvar giver ingen toast", async () => {
    let afvis!: (e: unknown) => void;
    graense.rpc.mockImplementationOnce((() => new Promise((_a, r) => { afvis = r; })));
    render(ui(afventer(2)));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Træk tilbage" })); });
    expect(kald("sb_afgoer")).toHaveLength(1);
    act(() => { auth("SIGNED_OUT", null); auth("SIGNED_IN", { user: { id: "u" } }); });
    await act(async () => { afvis({ code: "P0001", message: "afvist" }); await new Promise((x) => setTimeout(x, 10)); });
    expect(toast.error).not.toHaveBeenCalled();
    expect(kald("sb_afgoer")).toHaveLength(1);
  });
});

describe("T4 (B2b-2 §4) – fælles handlingslås og ærlig resultatvisning", () => {
  const styret = () => { let a!: (v: unknown) => void; let r!: (e: unknown) => void;
    graense.rpc.mockImplementationOnce((() => new Promise((x, y) => { a = x; r = y; })));
    return { svar: (v: unknown) => a(v), afvis: (e: unknown) => r(e) }; };
  const flush = async () => { await act(async () => { await new Promise((x) => setTimeout(x, 5)); }); };
  const knap = (n: string) => screen.getByRole("button", { name: n });

  it("dobbeltklik og blandede klik (Send alligevel, Træk tilbage, Fjern fil, Ret) giver ét RPC-kald og ingen toast", async () => {
    render(ui(afventer(1, true)));
    await waitFor(() => knap("Send alligevel"));
    const k = styret();
    // Referencer fastholdes før første klik (knappen viser spinner under handlingen).
    const send = knap("Send alligevel"), traek = screen.getAllByRole("button").find((b) => b.textContent === "Træk tilbage")!, fjern = knap("Fjern fil"), retK = knap("Ret");
    fireEvent.click(send); fireEvent.click(send); fireEvent.click(traek); fireEvent.click(fjern); fireEvent.click(retK);
    await flush();
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(kald("sb_afgoer")[0][1]).toMatchObject({ p_handling: "send" });
    expect(screen.queryByRole("textbox")).toBeNull(); // Ret ignoreret mens Send holder låsen
    await act(async () => { k.svar({ data: true, error: null }); });
    await flush();
    expect(aktiveHandlinger()).toBe(0);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("dobbeltklik på Fjern fil giver ét sb_fjern_fil", async () => {
    render(ui(afventer(1, true)));
    const k = styret();
    const fjern = knap("Fjern fil");
    fireEvent.click(fjern); fireEvent.click(fjern);
    await flush();
    expect(kald("sb_fjern_fil")).toHaveLength(1);
    await act(async () => { k.svar({ data: 2, error: null }); });
    await flush();
    expect(aktiveHandlinger()).toBe(0);
  });

  it("afmontering under kaldet: låsen holdes til kaldet er afsluttet og frigives derefter", async () => {
    const r = render(ui(afventer(1)));
    const k = styret();
    fireEvent.click(screen.getAllByRole("button").find((b) => b.textContent === "Træk tilbage")!);
    await flush();
    r.unmount();
    expect(aktiveHandlinger()).toBe(1);
    render(ui(afventer(1)));
    // Ny montering ser låsen: Træk tilbage-knappen er optaget (spinner) og et klik giver intet kald.
    fireEvent.click(screen.getAllByRole("button").find((b) => b.className.includes("text-destructive"))!);
    await flush();
    expect(kald("sb_afgoer")).toHaveLength(1);
    await act(async () => { k.svar({ data: true, error: null }); });
    await flush();
    expect(aktiveHandlinger()).toBe(0);
  });

  it("tabt succes-svar (transportfejl) afstemmes mod rækken: samme revision trukket tilbage → ingen toast", async () => {
    render(ui(afventer(4)));
    raekke = { data: { status: "trukket_tilbage", revision: 4, content: "", attachment_path: null }, error: null };
    liste({ status: "trukket_tilbage", revision: 4 });
    graense.rpc.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    fireEvent.click(screen.getAllByRole("button").find((b) => b.textContent === "Træk tilbage")!);
    await flush();
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  // B2b-4a §1: rettet forventning – B2b-3a accepterede her en falsk fejltoast efter en allerede gennemført sb_afgoer.
  it("B2b-4a: P0001-statusafvisning efter allerede gennemført sb_afgoer (samme revision i målstatus) → ingen falsk fejltoast", async () => {
    render(ui(afventer(4)));
    await waitFor(() => knap("Send alligevel"));
    raekke = { data: { status: "leveret", revision: 4, content: "x", attachment_path: null }, error: null };
    liste({ status: "leveret", revision: 4 });
    graense.rpc.mockResolvedValueOnce({ data: null, error: { code: "P0001", message: "Kun afventende indhold kan sendes" } });
    fireEvent.click(knap("Send alligevel"));
    await flush();
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(kald("sb_afgoer")).toHaveLength(1);
  });

  it("B2b-4a: reel P0001-statusafvisning (rækken står stadig afventende) vises ordret én gang", async () => {
    render(ui(afventer(4)));
    await waitFor(() => knap("Send alligevel"));
    raekke = { data: { status: "afventer_afsender", revision: 4, content: "x", attachment_path: null }, error: null };
    graense.rpc.mockResolvedValueOnce({ data: null, error: { code: "P0001", message: "Kun afventende indhold kan sendes" } });
    fireEvent.click(knap("Send alligevel"));
    await flush();
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith("Kun afventende indhold kan sendes");
  });

  it("B2b-4a: P0001 + ulæselig række → den ordrette afvisning bevares (ingen godkendelse uden bevis)", async () => {
    render(ui(afventer(4)));
    await waitFor(() => knap("Send alligevel"));
    raekke = { data: null, error: { message: "netværk" } };
    graense.rpc.mockResolvedValueOnce({ data: null, error: { code: "P0001", message: "Kun afventende indhold kan sendes" } });
    fireEvent.click(knap("Send alligevel"));
    await flush();
    expect(toast.error).toHaveBeenCalledWith("Kun afventende indhold kan sendes");
  });

  it("B2b-4a: direkte succes uden indarbejdet visning (ingen aktiv observer) → synlig bekræftet-tilstand og nyt klik på gammelt grundlag giver intet skrivekald", async () => {
    render(ui(afventer(4)));
    await waitFor(() => knap("Send alligevel"));
    graense.rpc.mockResolvedValueOnce({ data: true, error: null });
    fireEvent.click(knap("Send alligevel"));
    await flush();
    expect(screen.getByRole("alert").textContent).toBe("Handlingen er gennemført, men visningen kunne ikke opdateres");
    expect(knap("Tjek igen")).toBeTruthy();
    fireEvent.click(knap("Send alligevel"));
    fireEvent.click(knap("Træk tilbage"));
    await flush();
    expect(kald("sb_afgoer")).toHaveLength(1);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("reel konflikt med samme status skjules ikke: leveret men nyere revision → afvisningen vises ordret én gang", async () => {
    render(ui(afventer(4)));
    await waitFor(() => knap("Send alligevel"));
    raekke = { data: { status: "leveret", revision: 5, content: "x", attachment_path: null }, error: null };
    graense.rpc.mockResolvedValueOnce({ data: null, error: { code: "P0001", message: "Kun afventende indhold kan sendes" } });
    fireEvent.click(knap("Send alligevel"));
    await flush();
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith("Kun afventende indhold kan sendes");
  });

  it("forældet revision vises som »Beskeden er ændret – prøv igen« én gang", async () => {
    render(ui(afventer(4)));
    raekke = { data: { status: "afventer_afsender", revision: 5, content: "x", attachment_path: null }, error: null };
    graense.rpc.mockResolvedValueOnce({ data: null, error: { code: "P0001", message: "Forældet revision" } });
    fireEvent.click(screen.getAllByRole("button").find((b) => b.textContent === "Træk tilbage")!);
    await flush();
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith("Beskeden er ændret – prøv igen");
  });

  it.each([[false], [null]])("B2b-3a: uventet %s fra sb_afgoer + samme revision i målstatus ved læsning → bekræftet uden toast", async (data) => {
    render(ui(afventer(4)));
    raekke = { data: { status: "trukket_tilbage", revision: 4, content: "", attachment_path: null }, error: null };
    liste({ status: "trukket_tilbage", revision: 4 });
    graense.rpc.mockResolvedValueOnce({ data, error: null });
    fireEvent.click(screen.getAllByRole("button").find((b) => b.textContent === "Træk tilbage")!);
    await flush();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(toast.error).not.toHaveBeenCalled();
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it.each([[false], [null]])("uventet %s fra sb_afgoer er ikke succes – ukendt udfald vises lokalt uden ny skrivning", async (data) => {
    render(ui(afventer(4)));
    raekke = { data: { status: "afventer_afsender", revision: 4, content: "", attachment_path: null }, error: null };
    graense.rpc.mockResolvedValueOnce({ data, error: null });
    fireEvent.click(screen.getAllByRole("button").find((b) => b.textContent === "Træk tilbage")!);
    await flush();
    expect(screen.getByRole("alert").textContent).toBe("Afstemmer … udfaldet kunne ikke bekræftes");
    expect(toast.error).not.toHaveBeenCalled();
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    fireEvent.click(knap("Tjek igen"));
    await flush();
    expect(supabase.rpc).toHaveBeenCalledTimes(1); // Tjek igen læser kun
  });

  it.each([[null], [1]])("uventet sb_fjern_fil-resultat %s (ikke ny revision) er ikke succes", async (data) => {
    render(ui(afventer(1, true)));
    graense.rpc.mockResolvedValueOnce({ data, error: null });
    fireEvent.click(knap("Fjern fil"));
    await flush();
    expect(screen.getByRole("alert").textContent).toBe("Afstemmer … udfaldet kunne ikke bekræftes");
  });

  it("Ret fra statuskortet: kortet afmonteres, editoren holder låsen; Træk tilbage i boblen er ignoreret indtil Annullér", async () => {
    render(ui(afventer(1)));
    fireEvent.click(knap("Ret"));
    expect(screen.getByRole("textbox")).toBeTruthy();
    expect(aktiveHandlinger()).toBe(1);
    fireEvent.click(knap("Annullér"));
    expect(aktiveHandlinger()).toBe(0);
  });
});

describe("B2b-4a §1 – alle ukendte handlinger forbliver synlige og afstembare gennem Ret og remount", () => {
  const flush = async () => { await act(async () => { await new Promise((x) => setTimeout(x, 5)); }); };
  const knap = (n: string) => screen.getByRole("button", { name: n });
  it.each([["Send alligevel"], ["Træk tilbage"], ["Fjern fil"]])("ukendt %s → Ret viser advarsel og »Tjek igen« i editoren; remount bevarer; Tjek igen skriver ikke", async (navn) => {
    raekke = { data: { status: "afventer_afsender", revision: 4, content: "vist tekst", attachment_path: "e/c/f" }, error: null };
    const r = render(ui(afventer(4, true)));
    await waitFor(() => knap(navn));
    graense.rpc.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    fireEvent.click(knap(navn));
    await flush();
    expect(screen.getByRole("alert").textContent).toBe("Afstemmer … udfaldet kunne ikke bekræftes");
    fireEvent.click(knap("Ret"));
    expect(screen.getByRole("textbox")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("Afstemmer … udfaldet kunne ikke bekræftes");
    expect(knap("Tjek igen")).toBeTruthy();
    r.unmount();
    render(ui(afventer(4, true)));
    await flush();
    expect(screen.getByRole("alert").textContent).toBe("Afstemmer … udfaldet kunne ikke bekræftes");
    const skriv = graense.rpc.mock.calls.filter((c) => c[0] !== "sb_tjek_begrundelse").length;
    fireEvent.click(knap("Tjek igen"));
    await flush();
    expect(graense.rpc.mock.calls.filter((c) => c[0] !== "sb_tjek_begrundelse").length).toBe(skriv);
    expect(toast.error).not.toHaveBeenCalled();
  });
});
