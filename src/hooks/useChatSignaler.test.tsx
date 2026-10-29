import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

/**
 * B2d-1 T11 (§11). Ny prøvefil, fordi den fælles chatmock i useChat.test.tsx kasserer realtime-callbacks;
 * her fanges sb_signaler-callbacken ved grænsen. Netværket mockes; SQL/RLS-adfærd er antagelser.
 */
type Svar = { data: unknown; error: unknown };
type Handler = (p: { new: unknown; eventType?: string }) => void;
const g = vi.hoisted(() => ({
  opslag: vi.fn<() => Promise<{ data: unknown; error: unknown }>>(),
  kanaler: [] as Array<{ navn: string; h: Map<string, Handler>; fjernet: boolean }>,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => { const b = { select: () => b, eq: () => b, maybeSingle: () => g.opslag() }; return b; },
    rpc: vi.fn(async () => ({ data: [], error: null })),
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u" } } })), onAuthStateChange: vi.fn(), getSession: vi.fn(async () => ({ data: { session: null } })) },
    channel: (navn: string) => {
      const k = { navn, h: new Map<string, Handler>(), fjernet: false };
      g.kanaler.push(k);
      const ch = { on: (_t: string, f: { table: string }, cb: Handler) => { k.h.set(f.table, cb); return ch; }, subscribe: () => ch, k };
      return ch;
    },
    removeChannel: (ch: { k: { fjernet: boolean } }) => { ch.k.fjernet = true; return Promise.resolve("ok"); },
  },
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

import { toast } from "sonner";
import { useChatUnreadTotal, onChatSignal, glemSignalTilstand, CHAT_UNREAD_KEY } from "./useChat";
import { rydAlleKladder } from "@/lib/sbKladder";

const signal = (o: Record<string, unknown> = {}) => ({ id: 7, kilde: "besked", kilde_id: "b1", haendelse: "afventer", privat: true, conversation_id: null, ...o });
function udskudt<T>() { let løs!: (v: T) => void; const p = new Promise<T>((r) => { løs = r; }); return { p, løs }; }
const aktive = () => g.kanaler.filter((k) => !k.fjernet && k.navn.startsWith("chat-unread-"));
const send = (k: { h: Map<string, Handler> }, s: unknown) => k.h.get("sb_signaler")!({ new: s });
const nøgler = (spy: ReturnType<typeof vi.spyOn>) => spy.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey));

let qc: QueryClient;
let inval: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.useFakeTimers();
  rydAlleKladder();
  g.kanaler.length = 0; g.opslag.mockReset(); vi.mocked(toast).mockReset();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: 1 } } });
  inval = vi.spyOn(qc, "invalidateQueries");
});
afterEach(() => { glemSignalTilstand(qc); qc.clear(); vi.useRealTimers(); });
const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
const monter = (emp = "e1") => renderHook(({ e }) => useChatUnreadTotal(e), { wrapper, initialProps: { e: emp } });

describe("T11 §11 signaler, deduplikering og levetid", () => {
  it("to hookinstanser + samtidige dubletsignaler: ét opslag (delt behandling), højst én toast", async () => {
    const d = udskudt<Svar>();
    g.opslag.mockReturnValue(d.p);
    monter(); monter();
    const [a, b] = aktive();
    act(() => { send(a, signal()); send(b, signal()); send(a, signal()); });
    expect(g.opslag).toHaveBeenCalledTimes(1);
    await act(async () => { d.løs({ data: { conversation_id: "c1" }, error: null }); });
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith("Din besked afventer dig");
    // Efter vellykket behandling: nyt dubletsignal ignoreres helt.
    await act(async () => { send(b, signal()); });
    expect(g.opslag).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(nøgler(inval)).toContain(JSON.stringify(["chat-messages", "c1"]));
    expect(nøgler(inval)).toContain(JSON.stringify(["sb-begrundelse", "e1"]));
  });

  it("opslagfejl: fallback til alle visninger og signalgrænsen; senere genbehandling tilladt uden ny toast", async () => {
    g.opslag.mockResolvedValueOnce({ data: null, error: { message: "netværk" } }).mockResolvedValueOnce({ data: { conversation_id: "c1" }, error: null });
    const meldt = vi.fn();
    const af = onChatSignal(meldt);
    monter();
    const [a] = aktive();
    await act(async () => { send(a, signal({ haendelse: "udloeb" })); });
    await act(async () => { vi.advanceTimersByTime(300); });
    const k = nøgler(inval);
    for (const n of [["chat-conversations"], ["chat-messages"], CHAT_UNREAD_KEY, ["sb-begrundelse", "e1"]]) expect(k).toContain(JSON.stringify(n));
    expect(meldt).toHaveBeenCalledWith({ conversationId: null, kildeId: "b1", haendelse: "udloeb" });
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith("Din besked blev trukket tilbage");
    await act(async () => { send(a, signal({ haendelse: "udloeb" })); });
    expect(g.opslag).toHaveBeenCalledTimes(2); // genbehandlet
    expect(toast).toHaveBeenCalledTimes(1);
    af();
  });

  it("tomt opslag: fallback én gang, ingen retry-løkke (samme signal behandles ikke igen)", async () => {
    g.opslag.mockResolvedValue({ data: null, error: null });
    monter();
    const [a] = aktive();
    await act(async () => { send(a, signal()); });
    await act(async () => { send(a, signal()); send(a, signal()); });
    await act(async () => { vi.advanceTimersByTime(10000); });
    expect(g.opslag).toHaveBeenCalledTimes(1);
    expect(nøgler(inval)).toContain(JSON.stringify(["chat-messages"]));
  });

  it("én forbrugers afmontering skader ikke den andens kanal eller delte debounce", async () => {
    const x = monter(); monter();
    const [a, b] = aktive();
    act(() => { send(a, signal({ privat: false, conversation_id: "c2", id: 9 })); });
    x.unmount();
    expect(a).toBeDefined();
    expect(g.kanaler.filter((k) => k.navn.startsWith("chat-unread-") && k.fjernet).length).toBe(1);
    expect(b.fjernet).toBe(false);
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(nøgler(inval)).toContain(JSON.stringify(["chat-messages", "c2"]));
  });

  it("brugerskift annullerer gamle callbacks, timere og igangværende opslag (ingen toast under ny bruger)", async () => {
    const d = udskudt<Svar>();
    g.opslag.mockReturnValue(d.p);
    monter("e1");
    const [a] = aktive();
    act(() => { send(a, signal()); send(a, signal({ privat: false, id: 8, conversation_id: "c3" })); });
    act(() => { rydAlleKladder(); }); // logud/brugerskift → ny sessionsgeneration
    inval.mockClear();
    await act(async () => { d.løs({ data: { conversation_id: "c1" }, error: null }); });
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(toast).not.toHaveBeenCalled();
    expect(inval).not.toHaveBeenCalled();
    // Gammel kanal er fjernet, gammel callback gør intet; en ny kanal er bundet til den nye session.
    expect(a.fjernet).toBe(true);
    await act(async () => { send(a, signal({ id: 11 })); });
    expect(g.opslag).toHaveBeenCalledTimes(1);
    g.opslag.mockResolvedValue({ data: { conversation_id: "c1" }, error: null });
    const [ny] = aktive();
    expect(ny).not.toBe(a);
    await act(async () => { send(ny, signal({ id: 11 })); });
    expect(toast).toHaveBeenCalledTimes(1);
  });
});
