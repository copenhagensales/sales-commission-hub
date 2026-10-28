import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// Netværket mockes ved grænsen; MessageBubble og useDraftGuard er de rigtige.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { onAuthStateChange: vi.fn(), getSession: vi.fn() }, from: vi.fn(), rpc: vi.fn(), functions: { invoke: vi.fn() } },
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));
const editMutate = vi.fn();
const aegte = { brug: false };
vi.mock("@/hooks/useChat", async (orig) => {
  const o = await orig<typeof import("@/hooks/useChat")>();
  // c1 §2: kan skiftes til den rigtige useEditMessage (netværk mocket ved supabase-grænsen).
  return { ...o, useEditMessage: () => (aegte.brug ? o.useEditMessage() : { mutateAsync: editMutate, isPending: false }) };
});
vi.mock("./BeskedStatus", () => ({ BeskedStatus: () => null }));
vi.mock("./FilVedhaeftning", () => ({ FilVedhaeftning: () => null }));

import { MessageBubble } from "./MessageBubble";
import { gemRetKladde, laesRetKladde, rydAlleKladder, registrerKladdeOprydning } from "@/lib/sbKladder";
import { supabase } from "@/integrations/supabase/client";
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
const ui = (m: Message, emp?: string, bruger: string | null = "u") => wrap(<MessageBubble message={m} isOwn currentEmployeeId={emp} authBrugerId={bruger} conversationId="c" onReply={() => undefined} />);

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { mutations: { retry: 1, retryDelay: 0 } } });
  rydAlleKladder();
  sessionStorage.clear();
  editMutate.mockReset();
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
  let auth!: (e: string, s: unknown) => void;
  let svar!: (v: { data: unknown; error: unknown }) => void;
  let afvis!: (e: unknown) => void;
  const kontrolRet = () => vi.mocked(supabase.rpc).mockImplementationOnce((() =>
    new Promise((a, r) => { svar = a; afvis = r; })) as never);
  const chain = () => { const b: Record<string, unknown> = {}; for (const k of ["select", "eq", "in", "order", "limit"]) b[k] = () => b; b.maybeSingle = async () => ({ data: null, error: null }); return b; };
  const gem = () => fireEvent.click(screen.getByRole("button", { name: "Gem ændring" }));
  let inv: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    aegte.brug = true;
    vi.mocked(supabase.rpc).mockReset();
    vi.mocked(supabase.from).mockImplementation((() => chain()) as never);
    vi.mocked(toast.error).mockReset();
    registrerKladdeOprydning();
    auth = vi.mocked(supabase.auth.onAuthStateChange).mock.calls[0][0] as (e: string, s: unknown) => void;
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

  it("transportfejl i samme session: præcis ét sb_ret (retry 0 trods mutations.retry=1), kladden bevares, én toast", async () => {
    gemRetKladde("e", "c", { beskedId: "m1", tekst: "behold", revision: 1 });
    kontrolRet();
    render(ui(besked("m1", "a"), "e"));
    await act(async () => { gem(); });
    await act(async () => { afvis(new TypeError("Failed to fetch")); await new Promise((x) => setTimeout(x, 10)); });
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledTimes(1);
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
