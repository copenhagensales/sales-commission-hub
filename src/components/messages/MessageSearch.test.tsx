import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Netværksgrænsen: søgningens mutateAsync styres med kontrollerede promises. Ingen netværk.
const soeg = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { onAuthStateChange: vi.fn() } } }));
vi.mock("@/hooks/useChat", async (orig) => {
  const o = await orig<typeof import("@/hooks/useChat")>();
  return { ...o, useSearchMessages: () => ({ mutateAsync: soeg.fn, isPending: false }) };
});

import { MessageSearch } from "./MessageSearch";
import type { SoegeResultat } from "@/hooks/useChat";

const kontrol = <T,>() => { let res!: (v: T) => void; let rej!: (e: unknown) => void; const p = new Promise<T>((a, b) => { res = a; rej = b; }); return { p, res, rej }; };
const r = (id: string, content: string, slettes_efter: string | null = null): SoegeResultat => ({
  id, conversation_id: "A", content, created_at: "2026-10-28T10:00:00Z", slettes_efter, sender: { id: "s", full_name: "Kollega" }, conversation: null,
});
let qc: QueryClient;
const vis = () => render(<QueryClientProvider client={qc}><MessageSearch onClose={() => undefined} onSelectMessage={() => undefined} /></QueryClientProvider>);
const felt = () => screen.getByPlaceholderText("Søg i beskeder...");
const soegEfter = async (q: string) => { fireEvent.change(felt(), { target: { value: q } }); await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Søg" })); }); };

beforeEach(() => { qc = new QueryClient({ defaultOptions: { mutations: { retry: 1, retryDelay: 0 } } }); soeg.fn.mockReset(); });
afterEach(() => { cleanup(); qc.clear(); vi.useRealTimers(); });

describe("T5 (B2c-1 §5) – søgning", () => {
  it("forsinket søgesvar efter rydning genindsætter intet", async () => {
    const k = kontrol<SoegeResultat[]>();
    soeg.fn.mockReturnValueOnce(k.p);
    vis();
    await soegEfter("hemmelig");
    fireEvent.change(felt(), { target: { value: "" } });
    await act(async () => { k.res([r("1", "hemmelig tekst")]); await k.p; });
    expect(screen.queryByText("hemmelig tekst")).toBeNull();
    expect(screen.queryByText("Ingen resultater fundet")).toBeNull();
  });

  it("ny søgning: det gamle svar ignoreres, kun det nye vises", async () => {
    const a = kontrol<SoegeResultat[]>(), b = kontrol<SoegeResultat[]>();
    soeg.fn.mockReturnValueOnce(a.p).mockReturnValueOnce(b.p);
    vis();
    await soegEfter("a");
    // Søg-knappen viser spinner under hentning; ny søgning startes med Enter.
    fireEvent.change(felt(), { target: { value: "b" } });
    await act(async () => { fireEvent.keyDown(felt(), { key: "Enter" }); });
    await act(async () => { b.res([r("2", "nyt")]); await b.p; });
    await act(async () => { a.res([r("1", "gammelt")]); await a.p; });
    expect(screen.getByText("nyt")).toBeTruthy();
    expect(screen.queryByText("gammelt")).toBeNull();
  });

  it("hentefejl er ikke »Ingen resultater« og tilbyder genforsøg", async () => {
    soeg.fn.mockRejectedValueOnce(new Error("netværk")).mockResolvedValueOnce([]);
    vis();
    await soegEfter("x");
    expect(screen.getByText("Søgningen kunne ikke gennemføres")).toBeTruthy();
    expect(screen.queryByText("Ingen resultater fundet")).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Prøv igen" })); });
    expect(soeg.fn).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Ingen resultater fundet")).toBeTruthy();
  });

  it("ingen søgning viser hverken resultater eller tomtekst", () => {
    vis();
    expect(screen.queryByText("Ingen resultater fundet")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("offline-udløb af søgeresultat: teksten fjernes ved fristen uden nyt kald", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    soeg.fn.mockResolvedValueOnce([r("1", "udløber", new Date(Date.now() + 1000).toISOString()), r("2", "bliver")]);
    vis();
    await soegEfter("x");
    expect(screen.getByText("udløber")).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(screen.queryByText("udløber")).toBeNull();
    expect(screen.getByText("bliver")).toBeTruthy();
    expect(soeg.fn).toHaveBeenCalledTimes(1);
  });

  it("genforbindelse rydder gamle resultater straks og genvaliderer efter 300 ms (debounce)", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    soeg.fn.mockResolvedValueOnce([r("1", "før")]).mockResolvedValueOnce([r("2", "efter")]);
    vis();
    await soegEfter("x");
    expect(screen.getByText("før")).toBeTruthy();
    await act(async () => { window.dispatchEvent(new Event("online")); window.dispatchEvent(new Event("online")); });
    expect(screen.queryByText("før")).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(299); });
    expect(soeg.fn).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(soeg.fn).toHaveBeenCalledTimes(2);
    expect(screen.getByText("efter")).toBeTruthy();
  });

  it("sent svar efter afmontering skriver intet (ingen React-advarsel, intet nyt kald)", async () => {
    const k = kontrol<SoegeResultat[]>();
    soeg.fn.mockReturnValueOnce(k.p);
    const v = vis();
    await soegEfter("x");
    // B2c-1b: tidligere falsk grøn (React 18 advarer ikke ved setState efter afmontering). Nu: ejede timere/listeners
    // ryddes, og hverken signal, genforbindelse eller debounce efter afmontering starter et nyt kald.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    v.unmount();
    await act(async () => { k.res([r("1", "sent")]); await k.p; });
    window.dispatchEvent(new Event("online"));
    document.dispatchEvent(new Event("visibilitychange"));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(vi.getTimerCount()).toBe(0);
    expect(soeg.fn).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("sent")).toBeNull();
  });
});

describe("B2bc-5b §2 – søgning: fælles fristgrundlag", () => {
  it("urhop −690 ms efter udløb genopliver ikke et kendt udløbet søgeresultat", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const t0 = Date.now();
    soeg.fn.mockResolvedValueOnce([r("u690", "udløber-urhop", new Date(t0 + 1000).toISOString()), r("b690", "bliver-urhop")]);
    vis();
    await soegEfter("x");
    expect(screen.getByText("udløber-urhop")).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(screen.queryByText("udløber-urhop")).toBeNull();
    vi.setSystemTime(t0 + 1000 - 690);
    fireEvent.change(felt(), { target: { value: "xy" } }); // vilkårlig ny render efter urhop
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.queryByText("udløber-urhop")).toBeNull();
    expect(screen.getByText("bliver-urhop")).toBeTruthy();
  });
});
