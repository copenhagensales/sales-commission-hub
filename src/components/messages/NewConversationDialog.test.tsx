import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

/**
 * B2d-1 T8 (§8). Netværket mockes ved grænsen (supabase-klienten); SQL/RLS-adfærd er antagelser.
 * Én stabil QueryClient pr. prøve med mutations.retry=1 som appens standard, så lokal retry:0 faktisk afprøves.
 */
type Svar = { data: unknown; error: unknown };
const g = vi.hoisted(() => ({
  rpc: vi.fn<(navn: string, a?: unknown) => Promise<unknown>>(),
  hent: vi.fn<() => Promise<{ data: unknown; error: unknown }>>(),
}));
const kolleger: Svar = { data: [{ id: "k1", first_name: "Anna", last_name: "A" }, { id: "k2", first_name: "Bo", last_name: "B" }, { id: "k3", first_name: "Cia", last_name: "C" }], error: null };
/** PostgREST-byggerens abortSignal() returnerer samme thenable; mocken spejler det. */
const medSignal = <T,>(p: Promise<T>) => Object.assign(p, { abortSignal: () => p });
function kaede(tabel: string) {
  const b = {
    select: () => b, eq: () => b, abortSignal: () => b, order: () => b, in: () => b, is: () => b, neq: () => b,
    single: () => (tabel === "chat_conversations" ? g.hent() : Promise.resolve({ data: null, error: null })),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    then: (ok: (v: Svar) => unknown, fejl?: (e: unknown) => unknown) =>
      Promise.resolve(tabel === "employee_master_data" ? kolleger : { data: [], error: null }).then(ok, fejl),
  };
  return b;
}
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (t: string) => kaede(t),
    rpc: (n: string, a?: unknown) => medSignal(n === "get_current_employee_id" ? Promise.resolve({ data: "mig", error: null }) : g.rpc(n, a)),
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u" } } })), onAuthStateChange: vi.fn(), getSession: vi.fn(async () => ({ data: { session: null } })) },
    channel: () => { const c = { on: () => c, subscribe: () => c }; return c; },
    removeChannel: () => Promise.resolve("ok"),
  },
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock("@/components/mobile", () => ({ useIsPhone: () => false, BottomSheet: () => null }));

import { toast } from "sonner";
import { NewConversationDialog } from "./NewConversationDialog";
import { useCreateConversation, OPRETTET_IKKE_HENTET_TEKST, OpretFejl, type Conversation } from "@/hooks/useChat";
import { rydAlleKladder } from "@/lib/sbKladder";

const samtale = { id: "s1", name: "Holdet", is_group: true, members: [{ id: "m1", employee_id: "k1", employee: { id: "k1", first_name: "Anna", last_name: "A" } }] };
const opretKald = () => g.rpc.mock.calls.filter(([n]) => n === "sb_chat_start_gruppe" || n === "sb_chat_start_direkte").length;
function udskudt<T>() { let løs!: (v: T) => void; const p = new Promise<T>((r) => { løs = r; }); return { p, løs }; }

let qc: QueryClient;
beforeEach(() => {
  rydAlleKladder(); // ny session pr. prøve → frisk oprettelsestilstand
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: 1 } } });
  g.rpc.mockReset(); g.hent.mockReset();
  vi.mocked(toast.error).mockReset(); vi.mocked(toast.success).mockReset();
});
afterEach(() => { qc.clear(); });

function Vis({ open, onCreated, onOpenChange }: { open: boolean; onCreated: (id: string) => void; onOpenChange?: (o: boolean) => void }) {
  return createElement(QueryClientProvider, { client: qc }, createElement(NewConversationDialog, { open, onOpenChange: onOpenChange ?? (() => {}), onCreated }));
}
async function vælgGruppe() {
  fireEvent.click(await screen.findByText("Anna A"));
  fireEvent.click(screen.getByText("Bo B"));
  fireEvent.change(screen.getByPlaceholderText("Angiv gruppenavn..."), { target: { value: "Holdet" } });
}

describe("T8 §8 samtaleoprettelse uden gentaget RPC", () => {
  it("RPC lykkes, hentning fejler én gang: én gruppe, samme id; manuelt genforsøg henter kun; komplet cache før navigation", async () => {
    g.rpc.mockResolvedValue({ data: "s1", error: null });
    g.hent.mockResolvedValueOnce({ data: null, error: { message: "netværk" } }).mockResolvedValueOnce({ data: samtale, error: null });
    const cacheVedNavigation: Array<Conversation[] | undefined> = [];
    const onCreated = vi.fn(() => { cacheVedNavigation.push(qc.getQueryData<Conversation[]>(["chat-conversations"])); });
    render(createElement(Vis, { open: true, onCreated }));
    await vælgGruppe();
    fireEvent.click(screen.getByRole("button", { name: "Opret samtale" }));
    expect(await screen.findByText(OPRETTET_IKKE_HENTET_TEKST)).toBeTruthy();
    expect(opretKald()).toBe(1);
    expect(onCreated).not.toHaveBeenCalled();
    // Navn og valg bevares.
    expect((screen.getByPlaceholderText("Angiv gruppenavn...") as HTMLInputElement).value).toBe("Holdet");
    fireEvent.click(screen.getByRole("button", { name: "Prøv igen" }));
    await vi.waitFor(() => expect(onCreated).toHaveBeenCalledWith("s1"));
    expect(opretKald()).toBe(1);
    expect(g.hent).toHaveBeenCalledTimes(2);
    expect(cacheVedNavigation[0]?.[0]?.id).toBe("s1");
    expect(cacheVedNavigation[0]?.[0]?.members?.[0]?.employee?.full_name).toBe("Anna A");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("vedvarende hentefejl: ingen navigation med nøgent id; genåbning af dialogen genforsøger kun hentningen", async () => {
    g.rpc.mockResolvedValue({ data: "s1", error: null });
    g.hent.mockResolvedValue({ data: null, error: { message: "netværk" } });
    const onCreated = vi.fn();
    const r = render(createElement(Vis, { open: true, onCreated }));
    await vælgGruppe();
    fireEvent.click(screen.getByRole("button", { name: "Opret samtale" }));
    await screen.findByText(OPRETTET_IKKE_HENTET_TEKST);
    fireEvent.click(screen.getByRole("button", { name: "Prøv igen" }));
    await vi.waitFor(() => expect(g.hent).toHaveBeenCalledTimes(2));
    r.rerender(createElement(Vis, { open: false, onCreated }));
    r.rerender(createElement(Vis, { open: true, onCreated }));
    expect(await screen.findByText(OPRETTET_IKKE_HENTET_TEKST)).toBeTruthy();
    g.hent.mockResolvedValue({ data: samtale, error: null });
    fireEvent.click(screen.getByRole("button", { name: "Prøv igen" }));
    await vi.waitFor(() => expect(onCreated).toHaveBeenCalledWith("s1"));
    expect(opretKald()).toBe(1);
    expect(qc.getQueryData<Conversation[]>(["chat-conversations"])?.filter((c) => c.id === "s1").length).toBe(1);
  });

  it("dobbeltklik i samme tick giver ét oprettelseskald (synkron lås)", async () => {
    const d = udskudt<Svar>();
    g.rpc.mockReturnValue(d.p);
    g.hent.mockResolvedValue({ data: samtale, error: null });
    const onCreated = vi.fn();
    render(createElement(Vis, { open: true, onCreated }));
    await vælgGruppe();
    const knap = screen.getByRole("button", { name: "Opret samtale" });
    act(() => { fireEvent.click(knap); fireEvent.click(knap); });
    await vi.waitFor(() => expect(opretKald()).toBe(1));
    await act(async () => { d.løs({ data: "s1", error: null }); });
    await vi.waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(opretKald()).toBe(1);
  });

  it("tabt RPC-resultat (transport): ingen automatisk ny gruppe, listen genhentes, fast fejltekst", async () => {
    g.rpc.mockRejectedValue(new TypeError("Failed to fetch"));
    const onCreated = vi.fn();
    const inval = vi.spyOn(qc, "invalidateQueries");
    render(createElement(Vis, { open: true, onCreated }));
    await vælgGruppe();
    fireEvent.click(screen.getByRole("button", { name: "Opret samtale" }));
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith("Kunne ikke oprette samtale"));
    expect(opretKald()).toBe(1); // retry:0 trods mutations.retry=1
    expect(inval).toHaveBeenCalledWith({ queryKey: ["chat-conversations"] });
    expect(onCreated).not.toHaveBeenCalled();
    expect(screen.queryByText(OPRETTET_IKKE_HENTET_TEKST)).toBeNull();
  });

  it("P0001 vises én gang ordret og gentages ikke", async () => {
    g.rpc.mockResolvedValue({ data: null, error: { code: "P0001", message: "Gruppen findes allerede" } });
    render(createElement(Vis, { open: true, onCreated: vi.fn() }));
    await vælgGruppe();
    fireEvent.click(screen.getByRole("button", { name: "Opret samtale" }));
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(toast.error).toHaveBeenCalledWith("Gruppen findes allerede");
    expect(opretKald()).toBe(1);
  });

  it("hook: retry:0 under mutations.retry=1 – hentefejl giver OpretFejl('hent') med kendt id og nul ekstra RPC", async () => {
    g.rpc.mockResolvedValue({ data: "s1", error: null });
    g.hent.mockResolvedValue({ data: null, error: { message: "x" } });
    const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
    const { result } = renderHook(() => useCreateConversation(), { wrapper });
    let fejl: unknown = null;
    await act(async () => { try { await result.current.opret({ name: "Holdet", memberIds: ["k1", "k2"], isGroup: true }); } catch (e) { fejl = e; } });
    expect(fejl).toBeInstanceOf(OpretFejl);
    expect(fejl instanceof OpretFejl && fejl.id).toBe("s1");
    expect(result.current.kendtId).toBe("s1");
    expect(opretKald()).toBe(1);
    expect(g.hent).toHaveBeenCalledTimes(1);
  });
});

// ---------- B2-6B §B ----------
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
describe("B2-6B §B oprettelse: session og reel lukning", () => {
  it("holdt identitetsopslag + sessionsskift: nul oprettelses-RPC, ingen toast, ingen navigation", async () => {
    type Bruger = Awaited<ReturnType<typeof supabase.auth.getUser>>;
    let løs!: (v: Bruger) => void;
    vi.mocked(supabase.auth.getUser).mockImplementationOnce(() => new Promise<Bruger>((r) => { løs = r; }));
    const onCreated = vi.fn();
    render(createElement(Vis, { open: true, onCreated }));
    await vælgGruppe();
    fireEvent.click(screen.getByRole("button", { name: "Opret samtale" }));
    await vi.waitFor(() => expect(løs).toBeTypeOf("function"));
    rydAlleKladder(); // logud/brugerskift
    await act(async () => { løs({ data: { user: { id: "u" } } } as Bruger); await new Promise((r) => setTimeout(r, 0)); });
    expect(opretKald()).toBe(0);
    expect(onCreated).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("kendt oprettelses-id: faktisk Escape-lukning → genåbn bevarer navn/valg/id; kun hentning genforsøges", async () => {
    g.rpc.mockResolvedValue({ data: "s1", error: null });
    g.hent.mockResolvedValue({ data: null, error: { message: "netværk" } });
    const onCreated = vi.fn();
    let åbn!: () => void;
    function Forælder() {
      const [open, setOpen] = useState(true);
      åbn = () => setOpen(true);
      return createElement(QueryClientProvider, { client: qc }, createElement(NewConversationDialog, { open, onOpenChange: setOpen, onCreated }));
    }
    render(createElement(Forælder));
    await vælgGruppe();
    fireEvent.click(screen.getByRole("button", { name: "Opret samtale" }));
    await screen.findByText(OPRETTET_IKKE_HENTET_TEKST);
    fireEvent.keyDown(screen.getByPlaceholderText("Angiv gruppenavn..."), { key: "Escape", code: "Escape" });
    await vi.waitFor(() => expect(screen.queryByPlaceholderText("Angiv gruppenavn...")).toBeNull());
    act(() => { åbn(); });
    expect(await screen.findByText(OPRETTET_IKKE_HENTET_TEKST)).toBeTruthy();
    expect((screen.getByPlaceholderText("Angiv gruppenavn...") as HTMLInputElement).value).toBe("Holdet");
    expect(screen.getByText("2 valgt")).toBeTruthy();
    g.hent.mockResolvedValue({ data: samtale, error: null });
    fireEvent.click(screen.getByRole("button", { name: "Prøv igen" }));
    await vi.waitFor(() => expect(onCreated).toHaveBeenCalledWith("s1"));
    expect(opretKald()).toBe(1);
  });
});
