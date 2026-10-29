import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

const graense = vi.hoisted(() => ({ rpc: vi.fn<(fn: string) => Promise<{ data: unknown; error: unknown }>>() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: graense.rpc } }));

import { useSbDrift, tolkDrift, registrerPause, tjekPortAaben } from "./useSbDrift";
import { sessionsGeneration } from "@/lib/sbKladder";

const raekke = (p: boolean, f: boolean, t: boolean) => ({ data: [{ beskeder_pause: p, fil_tilladt: f, tjek_tilladt: t }], error: null });
let qc: QueryClient;
const wrap = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
const kald = () => graense.rpc.mock.calls.filter((c) => c[0] === "sb_24d2_drift").length;

beforeEach(() => { qc = new QueryClient({ defaultOptions: { queries: { retry: 1 } } }); graense.rpc.mockReset(); });

describe("24d2 §1 useSbDrift", () => {
  it("(a) kendt række mappes 1:1", async () => {
    graense.rpc.mockResolvedValue(raekke(false, true, true));
    const { result } = renderHook(() => useSbDrift(true, "u"), { wrapper: wrap });
    await waitFor(() => expect(result.current.status).toBe("kendt"));
    expect(result.current).toMatchObject({ beskederPause: false, filTilladt: true, tjekTilladt: true });
    expect(tjekPortAaben("u", sessionsGeneration())).toBe(true);
    graense.rpc.mockResolvedValue(raekke(true, false, false));
    act(() => result.current.refetch());
    await waitFor(() => expect(result.current.beskederPause).toBe(true));
    expect(result.current).toMatchObject({ filTilladt: false, tjekTilladt: false });
  });

  it.each([
    ["(b) PGRST202", async () => ({ data: null, error: { code: "PGRST202", message: "not found" } })],
    ["(b) 404", async () => ({ data: null, error: { status: 404, message: "Not Found" } })],
    ["(c) netværksfejl", async () => { throw new TypeError("Failed to fetch"); }],
    ["(d) tom liste", async () => ({ data: [], error: null })],
    ["(d) to rækker", async () => ({ data: [raekke(false, true, true).data[0], raekke(false, true, true).data[0]], error: null })],
    ["ugyldig type", async () => ({ data: [{ beskeder_pause: "nej", fil_tilladt: true, tjek_tilladt: true }], error: null })],
  ])("%s → ukendt, fil-/modelvej lukket, ét kald (retry:0)", async (_n, impl) => {
    graense.rpc.mockImplementation(impl as () => Promise<{ data: unknown; error: unknown }>);
    const { result } = renderHook(() => useSbDrift(true, "u"), { wrapper: wrap });
    await waitFor(() => expect(kald()).toBe(1));
    await waitFor(() => expect(qc.isFetching()).toBe(0));
    expect(result.current).toMatchObject({ status: "ukendt", filTilladt: false, tjekTilladt: false, beskederPause: false });
    expect(tjekPortAaben("u", sessionsGeneration())).toBe(false);
    expect(kald()).toBe(1);
  });

  it("tolkDrift afviser alt andet end præcis én række med tre booleans", () => {
    expect(tolkDrift(null)).toBeNull();
    expect(tolkDrift([{ beskeder_pause: true, fil_tilladt: true }])).toBeNull();
    expect(tolkDrift([{ beskeder_pause: true, fil_tilladt: false, tjek_tilladt: true }])).toEqual({ beskeder_pause: true, fil_tilladt: false, tjek_tilladt: true });
  });

  it("(e) genhenter ved window focus, reconnect og samtaleskift inden for 30 s", async () => {
    graense.rpc.mockResolvedValue(raekke(false, true, true));
    const { result, rerender } = renderHook(({ s }) => useSbDrift(true, "u", s), { wrapper: wrap, initialProps: { s: "c1" } });
    await waitFor(() => expect(result.current.status).toBe("kendt"));
    expect(kald()).toBe(1);
    act(() => { focusManager.setFocused(false); focusManager.setFocused(true); });
    await waitFor(() => expect(kald()).toBe(2));
    act(() => { onlineManager.setOnline(false); onlineManager.setOnline(true); });
    await waitFor(() => expect(kald()).toBe(3));
    rerender({ s: "c2" });
    await waitFor(() => expect(kald()).toBe(4));
    focusManager.setFocused(undefined);
  });

  it("samtidige hændelser samles til én hentning", async () => {
    let slip: (v: { data: unknown; error: unknown }) => void = () => {};
    graense.rpc.mockResolvedValueOnce(raekke(false, true, true));
    const { result, rerender } = renderHook(({ s }) => useSbDrift(true, "u", s), { wrapper: wrap, initialProps: { s: "c1" } });
    await waitFor(() => expect(result.current.status).toBe("kendt"));
    graense.rpc.mockImplementation(() => new Promise((r) => { slip = r; }));
    rerender({ s: "c2" });
    act(() => { result.current.refetch(); result.current.refetch(); });
    await waitFor(() => expect(kald()).toBe(2));
    act(() => slip(raekke(false, true, true)));
    await waitFor(() => expect(qc.isFetching()).toBe(0));
    expect(kald()).toBe(2);
  });

  it("(f) fejlet eller ældre driftssvar ophæver ikke en kendt pause; kun nyere gyldig læsning gør", async () => {
    let slipGammel: (v: { data: unknown; error: unknown }) => void = () => {};
    graense.rpc.mockImplementationOnce(() => new Promise((r) => { slipGammel = r; })); // læsning startet FØR beviset
    const { result } = renderHook(() => useSbDrift(true, "u"), { wrapper: wrap });
    await waitFor(() => expect(kald()).toBe(1));
    // Pausebevis (fx P0001/SB24D2_PAUSE) mens læsningen er i gang; invalidering må ikke afbryde den gamle
    graense.rpc.mockImplementationOnce(async () => ({ data: null, error: { code: "PGRST202" } }));
    act(() => registrerPause(qc, "u", sessionsGeneration()));
    expect(result.current.beskederPause).toBe(true);
    act(() => slipGammel(raekke(false, true, true)));
    await waitFor(() => expect(qc.isFetching()).toBe(0));
    expect(result.current.beskederPause).toBe(true); // ældre/fejlet svar ophæver ikke
    // Remount i samme QueryClient: pausen overlever
    const r2 = renderHook(() => useSbDrift(false, "u"), { wrapper: wrap });
    expect(r2.result.current.beskederPause).toBe(true);
    graense.rpc.mockResolvedValue(raekke(false, true, true));
    act(() => result.current.refetch());
    await waitFor(() => expect(result.current.beskederPause).toBe(false));
  });

  it("pause deles ikke på tværs af QueryClients eller brugere", () => {
    registrerPause(qc, "u", sessionsGeneration());
    const andenQc = new QueryClient();
    const r = renderHook(() => useSbDrift(false, "u"), { wrapper: ({ children }) => createElement(QueryClientProvider, { client: andenQc }, children) });
    expect(r.result.current.beskederPause).toBe(false);
    const r2 = renderHook(() => useSbDrift(false, "v"), { wrapper: wrap });
    expect(r2.result.current.beskederPause).toBe(false);
  });

  it("deaktiveret eller uden bruger → intet kald", async () => {
    renderHook(() => useSbDrift(true, null), { wrapper: wrap });
    renderHook(() => useSbDrift(false, "u"), { wrapper: wrap });
    await new Promise((r) => setTimeout(r, 20));
    expect(kald()).toBe(0);
  });
});
