import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// Netværket mockes ved grænsen; MessageBubble og useDraftGuard er de rigtige.
// B2b-3b §3: typede grænsemocks (ingen typeomgåelse ved rpc/invoke/from).

const graense = vi.hoisted(() => ({
  rpc: vi.fn<(...a: unknown[]) => Promise<unknown>>(async () => ({ data: "e", error: null })),
  invoke: vi.fn<(...a: unknown[]) => Promise<unknown>>(async () => ({ error: null })),
  session: vi.fn<() => Promise<unknown>>(async () => ({ data: { session: { access_token: "jwt-u", user: { id: "u" } } }, error: null })),
  from: vi.fn<(t: string) => unknown>(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { onAuthStateChange: vi.fn(), getSession: graense.session }, from: graense.from, rpc: graense.rpc, functions: { invoke: graense.invoke } },
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));
const editMutate = vi.fn();
const aegte = { brug: false };
vi.mock("@/hooks/useChat", async (orig) => {
  const o = await orig<typeof import("@/hooks/useChat")>();
  // c1 §2: kan skiftes til den rigtige useEditMessage (netværk mocket ved supabase-grænsen).
  return { ...o, useEditMessage: () => (aegte.brug ? o.useEditMessage() : { mutateAsync: editMutate, isPending: false }) };
});
vi.mock("./BeskedStatus", async (orig) => ({ ...(await orig<typeof import("./BeskedStatus")>()), BeskedStatus: () => null }));
vi.mock("./FilVedhaeftning", () => ({ FilVedhaeftning: () => null }));

import { MessageBubble } from "./MessageBubble";
import { gemRetKladde, laesRetKladde, rydAlleKladder, registrerKladdeOprydning } from "@/lib/sbKladder";
import { supabase } from "@/integrations/supabase/client";

// B2b-4b §3: typede auth-callbacks uden typeomgåelse – fuld Session bygges fra bruger-id.
const sessionFor = (id: string): Session => ({ access_token: `jwt-${id}`, refresh_token: "r", expires_in: 3600, token_type: "bearer",
  user: { id, app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "2026-01-01T00:00:00Z" } });
const authCb = (e: AuthChangeEvent, s: { user: { id: string } } | null): void => {
  const cb = vi.mocked(supabase.auth.onAuthStateChange).mock.calls[0][0];
  void cb(e, s ? sessionFor(s.user.id) : null);
};
import { toast } from "sonner";
import { hasUnsentDrafts } from "@/components/mobile";
import type { Message } from "@/hooks/useChat";

const besked = (id: string, content: string, revision = 1): Message => ({
  id, conversation_id: "c", sender_id: "e", content, status: "leveret", revision, created_at: "2026-10-28T10:00:00Z",
  leveret_at: "2026-10-28T10:00:00Z", edited_at: null, reactions: [], read_receipts: [],
} as unknown as Message);

let qc: QueryClient;
const wrap = (n: ReactNode) => <QueryClientProvider client={qc}>{n}</QueryClientProvider>;
const felt = () => screen.queryByRole("textbox") as HTMLTextAreaElement | null;
// B2b-4a: den cachede InfiniteData-liste (samme form som useMessages) – kun en indarbejdet række beviser opdateret visning.
const liste = (r: { id?: string; status: string; revision: number }) =>
  qc.setQueryData(["chat-messages", "c"], { pages: [[{ id: "m1", ...r }]], pageParams: [0] });
const ui = (m: Message, emp?: string, bruger: string | null = "u") => wrap(<MessageBubble message={m} isOwn currentEmployeeId={emp} authBrugerId={bruger} conversationId="c" onReply={() => undefined} />);

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { mutations: { retry: 1, retryDelay: 0 } } });
  rydAlleKladder();
  sessionStorage.clear();
  editMutate.mockReset();
  // c3 §7: fast udgangspunkt uafhængigt af rækkefølge: mocket hook, aktiv auth-bruger "u" via rigtig callback.
  aegte.brug = false;
  registrerKladdeOprydning();
  authCb("SIGNED_IN", { user: { id: "u" } });
});

describe("§7 – gemt redigeringskladde gendannes ved asynkron identitet", () => {
  it("montering før identitet → identitet ankommer → editor åben med gemt tekst og startrevision", async () => {
    gemRetKladde("e", "c", { beskedId: "m1", tekst: "gemt rettelse", revision: 3 });
    const r = render(ui(besked("m1", "server", 5)));
    expect(felt()).toBeNull();
    r.rerender(ui(besked("m1", "server", 5), "e"));
    await act(async () => undefined);
    expect(felt()?.value).toBe("gemt rettelse");
    editMutate.mockResolvedValueOnce({});
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Gem ændring" })); });
    expect(editMutate.mock.calls[0][0]).toMatchObject({ messageId: "m1", content: "gemt rettelse", revision: 3 });
  });

  it("senere servertekst/revision overskriver ikke en igangværende redigering", async () => {
    gemRetKladde("e", "c", { beskedId: "m1", tekst: "min tekst", revision: 2 });
    const r = render(ui(besked("m1", "v1", 2), "e"));
    r.rerender(ui(besked("m1", "v2 fra server", 3), "e"));
    await act(async () => undefined);
    expect(felt()?.value).toBe("min tekst");
    expect(laesRetKladde("e", "c", "m1")).toMatchObject({ tekst: "min tekst", revision: 2 });
  });
});

describe("§1 – prop-skift i MessageBubble giver ingen krydsskrivning", () => {
  it("beskedskift: gammel redigering skrives ikke under den nye nøgle", async () => {
    gemRetKladde("e", "c", { beskedId: "m1", tekst: "rettelse til m1", revision: 1 });
    const r = render(ui(besked("m1", "a"), "e"));
    fireEvent.change(felt()!, { target: { value: "ændret m1" } });
    r.rerender(ui(besked("m2", "b"), "e"));
    await act(async () => undefined);
    expect(felt()).toBeNull();
    expect(laesRetKladde("e", "c", "m2")).toBeNull();
    expect(laesRetKladde("e", "c", "m1")?.tekst).toBe("ændret m1");
  });

  it("medarbejderskift: gammel state skrives ikke under den nye medarbejdernøgle", async () => {
    gemRetKladde("e", "c", { beskedId: "m1", tekst: "e's tekst", revision: 1 });
    const r = render(ui(besked("m1", "a"), "e"));
    r.rerender(ui(besked("m1", "a"), "x"));
    await act(async () => undefined);
    expect(felt()).toBeNull();
    expect(laesRetKladde("x", "c", "m1")).toBeNull();
  });

  it("sen gem-succes efter nøgleskift rydder kun den oprindelige kladde", async () => {
    gemRetKladde("e", "c", { beskedId: "m1", tekst: "r1", revision: 1 });
    gemRetKladde("e", "c", { beskedId: "m2", tekst: "r2", revision: 1 });
    let svar!: (v: unknown) => void;
    editMutate.mockReturnValueOnce(new Promise((x) => { svar = x; }));
    const r = render(ui(besked("m1", "a"), "e"));
    fireEvent.click(screen.getByRole("button", { name: "Gem ændring" }));
    r.rerender(ui(besked("m2", "b"), "e"));
    await act(async () => undefined);
    await act(async () => { svar({}); });
    expect(laesRetKladde("e", "c", "m1")).toBeNull();
    expect(felt()?.value).toBe("r2");
    expect(laesRetKladde("e", "c", "m2")?.tekst).toBe("r2");
  });

  it("rigtig useDraftGuard markerer kun den aktive nøgles ændrede redigering", async () => {
    gemRetKladde("e", "c", { beskedId: "m1", tekst: "uafsendt", revision: 1 });
    const r = render(ui(besked("m1", "a"), "e"));
    await act(async () => undefined);
    expect(hasUnsentDrafts()).toBe(true);
    r.rerender(ui(besked("m2", "b"), "e"));
    await act(async () => undefined);
    expect(hasUnsentDrafts()).toBe(false);
  });
});

describe("c1 §2 – Gem afgrænset til session og kladdeoperation (rigtig useEditMessage)", () => {
  let auth: typeof authCb = authCb;
  let svar!: (v: { data: unknown; error: unknown }) => void;
  let afvis!: (e: unknown) => void;
  const kontrolRet = () => graense.rpc.mockImplementationOnce(() =>
    new Promise((a, r) => { svar = a; afvis = r; }));
  const chain = () => { const b: Record<string, unknown> = {}; for (const k of ["select", "eq", "in", "order", "limit"]) b[k] = () => b; b.maybeSingle = async () => ({ data: null, error: null }); return b; };
  const gem = () => fireEvent.click(screen.getByRole("button", { name: "Gem ændring" }));
  let inv: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    aegte.brug = true;
    graense.rpc.mockReset();
    graense.from.mockImplementation((() => chain()));
    vi.mocked(toast.error).mockReset();
    registrerKladdeOprydning();
    auth = authCb;
    auth("SIGNED_IN", { user: { id: "u" } });
    inv = vi.spyOn(qc, "invalidateQueries");
  });

  it("afmontering + genåbning med nyere kladde: sen succes sletter ikke den nye kladde; præcis ét sb_ret", async () => {
    gemRetKladde("e", "c", { beskedId: "m1", tekst: "gammel", revision: 1 });
    kontrolRet();
    const r = render(ui(besked("m1", "a"), "e"));
    await act(async () => { gem(); });
    expect(supabase.rpc).toHaveBeenCalledTimes(1); // ventepunktet er startet før skiftet
    r.unmount();
    render(ui(besked("m1", "a"), "e"));
    fireEvent.change(felt()!, { target: { value: "nyere" } });
    await act(async () => { svar({ data: 2, error: null }); });
    expect(laesRetKladde("e", "c", "m1")?.tekst).toBe("nyere");
    expect(felt()?.value).toBe("nyere");
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it("nyere tekst i samme kladde under Gem slettes ikke af den ældre afslutning", async () => {
    gemRetKladde("e", "c", { beskedId: "m1", tekst: "v1", revision: 1 });
    kontrolRet();
    render(ui(besked("m1", "a"), "e"));
    await act(async () => { gem(); });
    fireEvent.change(felt()!, { target: { value: "v2" } });
    await act(async () => { svar({ data: 2, error: null }); });
    expect(laesRetKladde("e", "c", "m1")?.tekst).toBe("v2");
  });

  it("logud/genlogin som samme bruger (rigtige auth-callbacks): sen succes rører ikke den nye session", async () => {
    gemRetKladde("e", "c", { beskedId: "m1", tekst: "før", revision: 1 });
    kontrolRet();
    render(ui(besked("m1", "a"), "e"));
    await act(async () => { gem(); });
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    act(() => { auth("SIGNED_OUT", null); auth("SIGNED_IN", { user: { id: "u" } }); });
    gemRetKladde("e", "c", { beskedId: "m1", tekst: "ny session", revision: 1 });
    const foer = inv.mock.calls.length;
    await act(async () => { svar({ data: 2, error: null }); });
    expect(laesRetKladde("e", "c", "m1")?.tekst).toBe("ny session");
    expect(inv.mock.calls.length).toBe(foer);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("skift til anden bruger: sent fejlsvar giver ingen toast, cacheændring eller sletning", async () => {
    gemRetKladde("e", "c", { beskedId: "m1", tekst: "før", revision: 1 });
    kontrolRet();
    render(ui(besked("m1", "a"), "e"));
    await act(async () => { gem(); });
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    act(() => { auth("SIGNED_IN", { user: { id: "anden" } }); });
    gemRetKladde("e", "c", { beskedId: "m1", tekst: "anden brugers", revision: 1 });
    const foer = inv.mock.calls.length;
    await act(async () => { svar({ data: null, error: { code: "P0001", message: "afvist" } }); });
    expect(toast.error).not.toHaveBeenCalled();
    expect(inv.mock.calls.length).toBe(foer);
    expect(laesRetKladde("e", "c", "m1")?.tekst).toBe("anden brugers");
  });

  it("transportfejl i samme session: præcis ét sb_ret (retry 0 trods mutations.retry=1), kladden bevares; usynlig række = ukendt udfald ved editoren uden toast (B2b-2)", async () => {
    gemRetKladde("e", "c", { beskedId: "m1", tekst: "behold", revision: 1 });
    kontrolRet();
    render(ui(besked("m1", "a"), "e"));
    await act(async () => { gem(); });
    await act(async () => { afvis(new TypeError("Failed to fetch")); await new Promise((x) => setTimeout(x, 10)); });
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("Udfaldet kunne ikke bekræftes");
    expect(laesRetKladde("e", "c", "m1")?.tekst).toBe("behold");
  });

  it("sen succes i samme session rydder den oprindelige kladde og lukker editoren", async () => {
    gemRetKladde("e", "c", { beskedId: "m1", tekst: "færdig", revision: 1 });
    kontrolRet();
    render(ui(besked("m1", "a"), "e"));
    await act(async () => { gem(); });
    await act(async () => { svar({ data: 2, error: null }); });
    expect(laesRetKladde("e", "c", "m1")).toBeNull();
    expect(felt()).toBeNull();
  });

  it("manglende auth-bruger: Gem starter intet sb_ret", async () => {
    gemRetKladde("e", "c", { beskedId: "m1", tekst: "x", revision: 1 });
    act(() => { auth("SIGNED_OUT", null); });
    gemRetKladde("e", "c", { beskedId: "m1", tekst: "x", revision: 1 });
    render(ui(besked("m1", "a"), "e", null));
    await act(async () => { gem(); });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});

describe("T3 (B2b-1 §3) – revision og redigeringskladder (rigtig useEditMessage, mocket rpc)", () => {
  let auth: typeof authCb = authCb;
  const chain = () => { const b: Record<string, unknown> = {}; for (const k of ["select", "eq", "in", "order", "limit"]) b[k] = () => b; b.maybeSingle = async () => ({ data: null, error: null }); return b; };
  const gem = () => fireEvent.click(screen.getByRole("button", { name: "Gem ændring" }));
  const konfliktSvar = () => graense.rpc.mockResolvedValueOnce({ data: null, error: { code: "P0001", message: "Forældet revision" } });
  const okSvar = (rev: number) => graense.rpc.mockResolvedValueOnce({ data: rev, error: null });
  const sendtRevision = (i: number) => (graense.rpc.mock.calls[i][1] as { p_revision: number }).p_revision;
  const m = (rev: number, content = "server", status = "leveret") => ({ ...besked("m1", content, rev), status } as Message);

  beforeEach(() => {
    aegte.brug = true;
    graense.rpc.mockReset();
    graense.from.mockImplementation((() => chain()));
    vi.mocked(toast.error).mockReset();
    auth = authCb;
    auth("SIGNED_IN", { user: { id: "u" } });
  });

  it("editor startet på revision 1, server ændret til 2: Gem sender 1; kladde, fejl ved editor og én toast bevares", async () => {
    gemRetKladde("e", "c", { beskedId: "m1", tekst: "min rettelse", revision: 1 });
    const r2 = render(ui(m(1, "v1"), "e"));
    r2.rerender(ui(m(2, "v2 fra server"), "e"));
    konfliktSvar();
    await act(async () => { gem(); });
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(sendtRevision(0)).toBe(1);
    expect(felt()?.value).toBe("min rettelse");
    expect(laesRetKladde("e", "c", "m1")).toMatchObject({ tekst: "min rettelse", revision: 1 });
    expect(screen.getByRole("alert").textContent).toBe("Beskeden er ændret – prøv igen");
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith("Beskeden er ændret – prøv igen");
  });

  it("genhentning ændrer ikke grundlaget; gentaget Gem sender fortsat den gamle revision (ingen tavs omsætning)", async () => {
    gemRetKladde("e", "c", { beskedId: "m1", tekst: "k", revision: 1 });
    const r = render(ui(m(1), "e"));
    r.rerender(ui(m(2), "e"));
    konfliktSvar();
    await act(async () => { gem(); });
    r.rerender(ui(m(3, "endnu nyere"), "e"));
    konfliktSvar();
    await act(async () => { gem(); });
    expect([sendtRevision(0), sendtRevision(1)]).toEqual([1, 1]);
    expect(laesRetKladde("e", "c", "m1")?.revision).toBe(1);
    expect(toast.error).toHaveBeenCalledTimes(2); // én pr. handling
  });

  it("eksplicit »Brug nyeste tekst« gør servertekst og -revision til nyt grundlag; først da sendes 2", async () => {
    gemRetKladde("e", "c", { beskedId: "m1", tekst: "gammel kladde", revision: 1 });
    const r = render(ui(m(1), "e"));
    r.rerender(ui(m(2, "server v2"), "e"));
    expect(felt()?.value).toBe("gammel kladde"); // ikke kasseret uden brugerhandling
    fireEvent.click(screen.getByRole("button", { name: "Brug nyeste tekst" }));
    expect(felt()?.value).toBe("server v2");
    expect(laesRetKladde("e", "c", "m1")).toMatchObject({ tekst: "server v2", revision: 2 });
    okSvar(3);
    await act(async () => { gem(); });
    expect(sendtRevision(0)).toBe(2);
  });

  it("statusændring uden revisionsændring: tjekkes → ingen Gem-handling, kladden bevares", async () => {
    gemRetKladde("e", "c", { beskedId: "m1", tekst: "k", revision: 1 });
    const r = render(ui(m(1), "e"));
    r.rerender(ui(m(1, "server", "tjekkes"), "e"));
    expect(screen.queryByRole("button", { name: "Gem ændring" })).toBeNull();
    expect(screen.getByText("Beskeden kan ikke rettes lige nu")).toBeTruthy();
    expect(laesRetKladde("e", "c", "m1")?.tekst).toBe("k");
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("tilbagetrukket række: editoren lukkes og kladden genskabes ikke ved genåbning", async () => {
    gemRetKladde("e", "c", { beskedId: "m1", tekst: "k", revision: 1 });
    const r = render(ui(m(1), "e"));
    r.rerender(ui(m(1, "", "trukket_tilbage"), "e"));
    expect(felt()).toBeNull();
    r.unmount();
    render(ui(m(1, "", "trukket_tilbage"), "e"));
    expect(felt()).toBeNull();
    expect(screen.queryByRole("button", { name: "Gem ændring" })).toBeNull();
  });

  it("genåbning efter navigation gendanner kladdetekst og startrevision, ikke senest hentede revision", async () => {
    const r = render(ui(m(1, "v1"), "e"));
    gemRetKladde("e", "c", { beskedId: "m1", tekst: "før navigation", revision: 1 });
    r.unmount();
    render(ui(m(4, "v4"), "e"));
    expect(felt()?.value).toBe("før navigation");
    okSvar(2) /* SQL-kontrakt: startrevision 1 + 1 */;
    await act(async () => { gem(); });
    expect(sendtRevision(0)).toBe(1);
  });

  it("4.000 tegn sendes; 4.001 tegn afvises lokalt uden sb_ret", async () => {
    gemRetKladde("e", "c", { beskedId: "m1", tekst: "a", revision: 1 });
    render(ui(m(1), "e"));
    fireEvent.change(felt()!, { target: { value: "x".repeat(4001) } });
    await act(async () => { gem(); });
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Beskeden må højst være 4.000 tegn");
    fireEvent.change(felt()!, { target: { value: "y".repeat(4000) } });
    okSvar(2);
    await act(async () => { gem(); });
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect((graense.rpc.mock.calls[0][1] as { p_tekst: string }).p_tekst.length).toBe(4000);
  });
});

describe("T4 (B2b-2 §4) – Gem og boblens Træk tilbage under fælles lås (rigtige hooks, mocket rpc/rækker)", () => {
  let raekke: { data: unknown; error: unknown } = { data: null, error: null };
  const chain = () => { const b: Record<string, unknown> = {}; for (const k of ["select", "eq", "in", "order", "limit"]) b[k] = () => b; b.maybeSingle = async () => raekke; return b; };
  const flush = () => act(async () => { await new Promise((x) => setTimeout(x, 5)); });
  beforeEach(() => {
    aegte.brug = true;
    raekke = { data: null, error: null };
    graense.rpc.mockReset();
    graense.from.mockImplementation((() => chain()));
    graense.invoke.mockResolvedValue({ data: null, error: null });
    vi.mocked(toast.error).mockReset();
    const auth = authCb;
    auth("SIGNED_OUT", null); auth("SIGNED_IN", { user: { id: "u" } });
  });

  it("dobbeltklik på Gem giver ét sb_ret", async () => {
    gemRetKladde("e", "c", { beskedId: "m1", tekst: "ny", revision: 1 });
    let svar!: (v: unknown) => void;
    graense.rpc.mockImplementationOnce((() => new Promise((r) => { svar = r; })));
    render(ui(besked("m1", "gammel"), "e"));
    const gem = screen.getByRole("button", { name: "Gem ændring" });
    fireEvent.click(gem); fireEvent.click(gem);
    await flush();
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    await act(async () => { svar({ data: 2, error: null }); });
    await flush();
    expect(felt()).toBeNull();
  });

  it("tabt succes-svar på Gem afstemmes mod rækken (tekst og ny revision) → editor lukkes uden toast", async () => {
    gemRetKladde("e", "c", { beskedId: "m1", tekst: "ny tekst", revision: 1 });
    raekke = { data: { status: "tjekkes", revision: 2, content: "ny tekst", attachment_path: null }, error: null };
    graense.rpc.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(ui(besked("m1", "gammel"), "e"));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Gem ændring" })); });
    await flush();
    expect(toast.error).not.toHaveBeenCalled();
    expect(felt()).toBeNull();
    expect(laesRetKladde("e", "c", "m1")).toBeNull();
  });

  it("forældet svar, men rækken har en anden tekst i nyere revision → konflikt vises, kladden bevares", async () => {
    gemRetKladde("e", "c", { beskedId: "m1", tekst: "min", revision: 1 });
    raekke = { data: { status: "leveret", revision: 2, content: "en andens", attachment_path: null }, error: null };
    graense.rpc.mockResolvedValueOnce({ data: null, error: { code: "P0001", message: "Forældet revision" } });
    render(ui(besked("m1", "gammel"), "e"));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Gem ændring" })); });
    await flush();
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(laesRetKladde("e", "c", "m1")?.tekst).toBe("min");
  });

  it("uventet null fra sb_ret er ikke succes: kladden bevares, ukendt udfald ved editoren", async () => {
    gemRetKladde("e", "c", { beskedId: "m1", tekst: "min", revision: 1 });
    graense.rpc.mockResolvedValueOnce({ data: null, error: null });
    render(ui(besked("m1", "gammel"), "e"));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Gem ændring" })); });
    await flush();
    expect(screen.getByRole("alert").textContent).toBe("Udfaldet kunne ikke bekræftes");
    expect(laesRetKladde("e", "c", "m1")?.tekst).toBe("min");
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it("boblens Træk tilbage: dobbeltklik giver ét sb_afgoer", async () => {
    const nu = new Date().toISOString();
    const m = { ...besked("m1", "hej"), leveret_at: nu, created_at: nu } as Message;
    let svar!: (v: unknown) => void;
    graense.rpc.mockImplementationOnce((() => new Promise((r) => { svar = r; })));
    render(ui(m, "e"));
    const aabn = async () => { const t = screen.getByRole("button", { name: "Flere handlinger" }); fireEvent.keyDown(t, { key: "Enter" }); await flush(); };
    await aabn();
    fireEvent.click(screen.getByRole("menuitem", { name: "Træk tilbage" }));
    await flush();
    await aabn();
    const punkt = screen.queryByRole("menuitem", { name: "Træk tilbage" });
    if (punkt) fireEvent.click(punkt);
    await flush();
    expect(graense.rpc.mock.calls.filter((c) => c[0] === "sb_afgoer")).toHaveLength(1);
    await act(async () => { svar({ data: true, error: null }); });
    await flush();
  });

  // ---------- B2b-3a §1: holdbart ukendt udfald (statuskort/boble/editor) ----------
  it("B2b-3a: ukendt Gem overlever remount – editoren viser tilstanden og »Tjek igen« igen efter genåbning", async () => {
    gemRetKladde("e", "c", { beskedId: "m1", tekst: "min", revision: 1 });
    graense.rpc.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const r = render(ui(besked("m1", "gammel"), "e"));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Gem ændring" })); });
    await flush();
    expect(screen.getByRole("alert").textContent).toBe("Udfaldet kunne ikke bekræftes");
    r.unmount();
    render(ui(besked("m1", "gammel"), "e"));
    await flush();
    expect(felt()?.value).toBe("min");
    expect(screen.getByRole("alert").textContent).toBe("Udfaldet kunne ikke bekræftes");
    expect(screen.getByRole("button", { name: "Tjek igen" })).toBeTruthy();
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it("B2b-3a: ukendt Træk tilbage fra leveret boble vises i boblen; »Tjek igen« afklarer ved læsning uden ny skrivning", async () => {
    const nu = new Date().toISOString();
    const m = { ...besked("m1", "hej"), leveret_at: nu, created_at: nu } as Message;
    graense.rpc.mockResolvedValueOnce({ data: null, error: { message: "Failed to fetch" } });
    raekke = { data: { status: "leveret", revision: m.revision, content: "hej", attachment_path: null }, error: null };
    render(ui(m, "e"));
    fireEvent.keyDown(screen.getByRole("button", { name: "Flere handlinger" }), { key: "Enter" });
    await flush();
    fireEvent.click(screen.getByRole("menuitem", { name: "Træk tilbage" }));
    await flush();
    expect(screen.getByRole("alert").textContent).toBe("Udfaldet kunne ikke bekræftes");
    expect(toast.error).not.toHaveBeenCalled();
    raekke = { data: { status: "trukket_tilbage", revision: m.revision, content: "", attachment_path: null }, error: null };
    liste({ status: "trukket_tilbage", revision: m.revision });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Tjek igen" })); });
    await flush();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(graense.rpc.mock.calls.filter((c) => c[0] === "sb_afgoer")).toHaveLength(1);
  });

  it("B2b-3a: sen succes via »Tjek igen« mod nyere kladdeversion bevarer den nyere kladde og editoren", async () => {
    gemRetKladde("e", "c", { beskedId: "m1", tekst: "min", revision: 1 });
    graense.rpc.mockResolvedValueOnce({ data: null, error: null });
    render(ui(besked("m1", "gammel"), "e"));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Gem ændring" })); });
    await flush();
    fireEvent.change(felt()!, { target: { value: "nyere" } });
    raekke = { data: { status: "leveret", revision: 2, content: "min", attachment_path: null }, error: null };
    liste({ status: "leveret", revision: 2 });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Tjek igen" })); });
    await flush();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(felt()?.value).toBe("nyere");
    expect(laesRetKladde("e", "c", "m1")?.tekst).toBe("nyere");
  });

  it("B2b-3a: sen succes via »Tjek igen« for samme kladdeversion rydder kladden og lukker editoren", async () => {
    gemRetKladde("e", "c", { beskedId: "m1", tekst: "min", revision: 1 });
    graense.rpc.mockResolvedValueOnce({ data: null, error: null });
    render(ui(besked("m1", "gammel"), "e"));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Gem ændring" })); });
    await flush();
    raekke = { data: { status: "leveret", revision: 2, content: "min", attachment_path: null }, error: null };
    liste({ status: "leveret", revision: 2 });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Tjek igen" })); });
    await flush();
    expect(felt()).toBeNull();
    expect(laesRetKladde("e", "c", "m1")).toBeNull();
  });

  // B2b-4a §1: rettet forventning – en sen fejl mod en nyere kladdeversion viser ikke længere toast.
  it("B2b-4a: sen fejl efter remount mod nyere kladdeversion bevarer den nyere kladde uden toast", async () => {
    gemRetKladde("e", "c", { beskedId: "m1", tekst: "min", revision: 1 });
    let svar!: (v: unknown) => void;
    graense.rpc.mockImplementationOnce((() => new Promise((r) => { svar = r; })));
    const r = render(ui(besked("m1", "gammel"), "e"));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Gem ændring" })); });
    r.unmount();
    render(ui(besked("m1", "gammel"), "e"));
    fireEvent.change(felt()!, { target: { value: "nyere" } });
    await act(async () => { svar({ data: null, error: { code: "P0001", message: "Forældet revision" } }); });
    await flush();
    expect(laesRetKladde("e", "c", "m1")?.tekst).toBe("nyere");
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.queryByText("Beskeden er ændret – prøv igen")).toBeNull();
  });

  it("B2b-4a: sen fejl efter navigation for samme kladdeversion viser fejlen én gang og bevarer kladden", async () => {
    gemRetKladde("e", "c", { beskedId: "m1", tekst: "min", revision: 1 });
    let svar!: (v: unknown) => void;
    graense.rpc.mockImplementationOnce((() => new Promise((r) => { svar = r; })));
    const r = render(ui(besked("m1", "gammel"), "e"));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Gem ændring" })); });
    r.unmount();
    await act(async () => { svar({ data: null, error: { code: "P0001", message: "Forældet revision" } }); });
    await flush();
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(laesRetKladde("e", "c", "m1")?.tekst).toBe("min");
  });

  // B2b-4a §2
  it("B2b-4a: bevist aktiv tjektimer → klik på Gem i editoren afslutter timeren; intet transportgenforsøg", async () => {
    const { startTjekHvisNoedvendigt, aktiveTjekTimere } = await import("@/hooks/useChat");
    const { fastholdEjer, ejerGyldig } = await import("@/lib/sbKladder");
    raekke = { data: { status: "tjekkes", revision: 1 }, error: null };
    graense.invoke.mockReset().mockResolvedValueOnce({ error: { name: "FunctionsFetchError" } }).mockResolvedValue({ error: null });
    const ejer = fastholdEjer("e", "c", "u")!;
    const p = startTjekHvisNoedvendigt("m1", () => ejerGyldig(ejer), ejer);
    await vi.waitFor(() => expect(aktiveTjekTimere()).toBe(1)); // bevist aktiv ventetimer for revision 1
    gemRetKladde("e", "c", { beskedId: "m1", tekst: "min", revision: 1 });
    graense.rpc.mockResolvedValueOnce({ data: 2, error: null });
    render(ui(besked("m1", "gammel"), "e"));
    raekke = { data: { status: "tjekkes", revision: 2, content: "min", attachment_path: null }, error: null };
    fireEvent.click(screen.getByRole("button", { name: "Gem ændring" }));
    expect(aktiveTjekTimere()).toBe(0); // synkront ved editorovergangen, før sb_ret svarer
    await p;
    await flush();
    await new Promise((x) => setTimeout(x, 2100));
    const rev = (n: number) => graense.invoke.mock.calls.filter((c) => (c[1] as { body: { revision: number } }).body.revision === n).length;
    expect(rev(1)).toBe(1); // intet genforsøg for det gamle tjek
  });
});


describe("B2c-1 §5 – editorspærring ved udløbet indhold (klientens ur)", () => {
  it("åben editor + frist passerer → Gem forsvinder, tekst skjules, ingen sb_ret", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    try {
      aegte.brug = true;
      graense.rpc.mockReset();
      const m = { ...besked("m1", "original"), slettes_efter: new Date(Date.now() + 1000).toISOString() } as Message;
      gemRetKladde("e", "c", { beskedId: "m1", tekst: "min rettelse", revision: 1 });
      render(ui(m, "e"));
      expect(felt()?.value).toBe("min rettelse");
      expect(screen.getByRole("button", { name: "Gem ændring" })).toBeTruthy();
      await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
      expect(felt()).toBeNull();
      expect(screen.queryByRole("button", { name: "Gem ændring" })).toBeNull();
      expect(screen.queryByText("min rettelse")).toBeNull();
      expect(screen.queryByText("original")).toBeNull();
      expect(supabase.rpc).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });

  it("gendannet kladde til allerede udløbet række genskabes ikke", () => {
    const m = { ...besked("m1", "original"), slettes_efter: new Date(Date.now() - 1).toISOString() } as Message;
    gemRetKladde("e", "c", { beskedId: "m1", tekst: "min rettelse", revision: 1 });
    render(ui(m, "e"));
    expect(felt()).toBeNull();
    expect(screen.queryByText("min rettelse")).toBeNull();
    expect(screen.getByText("Beskeden er ikke længere tilgængelig")).toBeTruthy();
  });

  it("svaruddrag med lokalt udløbet original viser ingen originaltekst", () => {
    const m = { ...besked("m2", "svar"), reply_to: { id: "o", content: "gammel", sender_id: "s", status: "leveret", slettes_efter: new Date(Date.now() - 1).toISOString(), deleted_at: null } } as Message;
    render(ui(m, "e"));
    expect(screen.queryByText("gammel")).toBeNull();
    expect(screen.getByText("Beskeden er ikke længere tilgængelig")).toBeTruthy();
  });
});

describe("B2c-1b §1 – aktuel frist i editor, Gem og kvittering", () => {
  const T0 = new Date("2026-10-29T00:00:00Z").getTime();
  const iso = (ms: number) => new Date(T0 + ms).toISOString();
  const sbRet = () => graense.rpc.mock.calls.filter((c) => c[0] === "sb_ret").length;
  beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(T0); aegte.brug = true; graense.rpc.mockClear(); });
  const slut = () => { vi.useRealTimers(); aegte.brug = false; };

  it("åben editor modtager allerede udløbet frist → tekst skjult, ingen Gem, nul sb_ret", async () => {
    try {
      gemRetKladde("e", "c", { beskedId: "m1", tekst: "min rettelse", revision: 1 });
      // B2c-2a: fejlfangende mod f42d62a81 – fristen passerer EFTER montering (gemt nu = T0), og rækken ankommer
      // som ny objektidentitet uden ny frist; et gemt nu ville stadig vise editoren.
      const m = { ...besked("m1", "server"), slettes_efter: iso(1000) };
      const r = render(ui(m, "e"));
      expect(felt()?.value).toBe("min rettelse");
      vi.setSystemTime(T0 + 1500);
      r.rerender(ui({ ...m }, "e"));
      expect(felt()).toBeNull();
      expect(screen.queryByText("min rettelse")).toBeNull();
      expect(screen.queryByText("server")).toBeNull();
      expect(screen.queryByRole("button", { name: "Gem ændring" })).toBeNull();
      expect(sbRet()).toBe(0);
      r.unmount();
    } finally { slut(); }
  });

  it("Gem-callback fra før udløbet (ingen ny render) sender ikke sb_ret", async () => {
    try {
      gemRetKladde("e", "c", { beskedId: "m1", tekst: "min rettelse", revision: 1 });
      const r = render(ui({ ...besked("m1", "server"), slettes_efter: iso(1000) }, "e"));
      const knap = screen.getByRole("button", { name: "Gem ændring" });
      vi.setSystemTime(T0 + 1500); // fristen passerer uden render/timerbehandling
      await act(async () => { fireEvent.click(knap); });
      expect(sbRet()).toBe(0);
      r.unmount();
    } finally { slut(); }
  });

  it("fokus før fristtimerbehandling kvitterer ikke en udløbet fremmed række", async () => {
    try {
      const fokus = vi.spyOn(document, "hasFocus").mockReturnValue(false);
      const m = { ...besked("f1", "fremmed"), sender_id: "anden", slettes_efter: iso(1000) };
      const r = render(wrap(<MessageBubble message={m} isOwn={false} currentEmployeeId="e" authBrugerId="u" conversationId="c" onReply={() => undefined} />));
      vi.setSystemTime(T0 + 1500);
      fokus.mockReturnValue(true);
      await act(async () => { window.dispatchEvent(new Event("focus")); });
      expect(qc.getMutationCache().getAll()).toHaveLength(0); // ingen kvitteringsmutation startet
      fokus.mockRestore();
      r.unmount();
    } finally { slut(); }
  });
});

describe("B2c-2a §1 – editorværn ved udløb, sletning, tjek og generation", () => {
  const T0 = new Date("2026-10-29T00:00:00Z").getTime();
  const iso = (ms: number) => new Date(T0 + ms).toISOString();
  const sbRet = () => graense.rpc.mock.calls.filter((c) => c[0] === "sb_ret").length;
  const kladde = () => laesRetKladde("e", "c", "m1");
  beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(T0); aegte.brug = true; graense.rpc.mockReset(); });
  const slut = () => { vi.useRealTimers(); aegte.brug = false; graense.rpc.mockReset(); };
  const aaben = (m: Message) => { gemRetKladde("e", "c", { beskedId: "m1", tekst: "min rettelse", revision: m.revision }); return render(ui(m, "e")); };

  it("udløb med åben editor (offline) → editor lukket, kladde ryddet, nul sb_ret", async () => {
    try {
      const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
      const m = { ...besked("m1", "server"), slettes_efter: iso(1000) };
      const r = aaben(m);
      expect(felt()?.value).toBe("min rettelse");
      vi.setSystemTime(T0 + 1001);
      r.rerender(ui({ ...m }, "e"));
      expect(felt()).toBeNull();
      expect(screen.queryByText("min rettelse")).toBeNull();
      expect(kladde()).toBeNull();
      expect(sbRet()).toBe(0);
      online.mockRestore(); r.unmount();
    } finally { slut(); }
  });

  it("gendannet editor med allerede udløbet frist åbnes ikke og kladden ryddes", async () => {
    try {
      const r = aaben({ ...besked("m1", "server"), slettes_efter: iso(-5) });
      expect(felt()).toBeNull();
      expect(screen.queryByText("min rettelse")).toBeNull();
      expect(kladde()).toBeNull();
      r.unmount();
    } finally { slut(); }
  });

  for (const udfald of ["succes", "fejl"] as const) it(`sen RPC-${udfald} efter udløb genskaber hverken tekst eller kladde`, async () => {
    try {
      let svar: (v: unknown) => void = () => undefined;
      graense.rpc.mockImplementationOnce(() => new Promise((a) => { svar = a; }));
      const m = { ...besked("m1", "server"), slettes_efter: iso(1000) };
      const r = aaben(m);
      await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Gem ændring" })); });
      expect(sbRet()).toBe(1);
      vi.setSystemTime(T0 + 1001);
      r.rerender(ui({ ...m }, "e"));
      expect(felt()).toBeNull();
      await act(async () => { svar(udfald === "succes" ? { data: 2, error: null } : { data: null, error: { code: "P0001", message: "Kun afventende indhold kan rettes" } }); });
      r.rerender(ui({ ...m }, "e"));
      expect(felt()).toBeNull();
      expect(screen.queryByText("min rettelse")).toBeNull();
      expect(kladde()).toBeNull();
      expect(sbRet()).toBe(1);
      r.unmount();
    } finally { slut(); }
  });

  it("gammel frist mod nyere gyldigt grundlag: ny frist/revision vises, ny kladde rammes ikke af gammel oprydning", async () => {
    try {
      const m = { ...besked("m1", "server"), slettes_efter: iso(1000) };
      const r = render(ui(m, "e"));
      vi.setSystemTime(T0 + 1001);
      r.rerender(ui({ ...m }, "e"));
      expect(screen.queryByText("server")).toBeNull();
      const ny = { ...besked("m1", "ny tekst", 2), slettes_efter: iso(60_000) };
      r.rerender(ui(ny, "e"));
      expect(screen.getByText("ny tekst")).toBeTruthy();
      gemRetKladde("e", "c", { beskedId: "m1", tekst: "ny rettelse", revision: 2 });
      r.rerender(ui({ ...ny }, "e"));
      expect(kladde()?.tekst).toBe("ny rettelse");
      r.unmount();
    } finally { slut(); }
  });

  it("kendt udløbet kladde efter urhop på -690 ms og genåbning: ingen editor, ingen tekst", async () => {
    try {
      const m = { ...besked("m1", "server"), slettes_efter: iso(1000) };
      const r = aaben(m);
      vi.setSystemTime(T0 + 1000); // fristen nået
      r.rerender(ui({ ...m }, "e"));
      expect(felt()).toBeNull();
      r.unmount();
      vi.setSystemTime(T0 + 310); // urhop -690 ms: klientens ur er nu før fristen
      gemRetKladde("e", "c", { beskedId: "m1", tekst: "min rettelse", revision: 1 }); // fx skrevet af en anden fane
      const r2 = render(ui({ ...m }, "e"));
      expect(felt()).toBeNull();
      expect(screen.queryByText("min rettelse")).toBeNull();
      expect(screen.queryByText("server")).toBeNull();
      expect(screen.queryByRole("button", { name: "Gem ændring" })).toBeNull();
      r2.unmount();
    } finally { slut(); }
  });

  it("deleted_at i editorværnet: ingen editor, ingen Gem, kladde ryddet", async () => {
    try {
      const r = aaben({ ...besked("m1", "server"), deleted_at: iso(-1) });
      expect(felt()).toBeNull();
      expect(screen.queryByText("min rettelse")).toBeNull();
      expect(screen.queryByRole("button", { name: "Gem ændring" })).toBeNull();
      expect(kladde()).toBeNull();
      expect(sbRet()).toBe(0);
      r.unmount();
    } finally { slut(); }
  });

  it("tjekkes: Gem spærret, legitim kladde bevares", async () => {
    try {
      const r = aaben({ ...besked("m1", "server"), status: "tjekkes" });
      expect(screen.queryByRole("button", { name: "Gem ændring" })).toBeNull();
      expect(kladde()?.tekst).toBe("min rettelse");
      r.unmount();
    } finally { slut(); }
  });

  it("samme bruger i ny generation: gammel kendt-udløbet status rammer ikke den nye generations kladde", async () => {
    try {
      const m = { ...besked("m1", "server"), slettes_efter: iso(1000) };
      const r = render(ui(m, "e"));
      vi.setSystemTime(T0 + 1001);
      r.rerender(ui({ ...m }, "e"));
      r.unmount();
      const cb = authCb;
      cb("SIGNED_OUT", null); cb("SIGNED_IN", { user: { id: "u" } }); // ny generation, samme bruger
      vi.setSystemTime(T0 + 310); // ur før fristen i den nye generation
      gemRetKladde("e", "c", { beskedId: "m1", tekst: "ny generation", revision: 1 });
      const r2 = render(ui({ ...m }, "e"));
      expect(felt()?.value).toBe("ny generation");
      expect(kladde()?.tekst).toBe("ny generation");
      r2.unmount();
    } finally { slut(); }
  });
});
