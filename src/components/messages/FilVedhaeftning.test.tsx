// B2c-2b-1 T6 (§6): rigtig FilVedhaeftning + rigtig sbFil + rigtig sbKladder; netværket mockes ved grænsen (fetch + auth).
// Ingen netværk, ingen produktionsdata. Kontrollerede promises; alt afsluttes efter hver prøve.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() }, storage: { from: vi.fn() } },
}));

import { supabase } from "@/integrations/supabase/client";
import { FilVedhaeftning } from "./FilVedhaeftning";
import { registrerKladdeOprydning, sessionsGeneration } from "@/lib/sbKladder";
import { filHentningsKapacitet } from "@/lib/sbFil";

const sessionFor = (id: string): Session => ({ access_token: `jwt-${id}`, refresh_token: "r", expires_in: 3600, token_type: "bearer",
  user: { id, app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "2026-01-01T00:00:00Z" } });
const authCb = (e: AuthChangeEvent, id: string | null) => {
  const cb = vi.mocked(supabase.auth.onAuthStateChange).mock.calls[0][0];
  void cb(e, id ? sessionFor(id) : null);
};

type Ctl<T> = { p: Promise<T>; res: (v: T) => void; rej: (e: unknown) => void };
const styret = <T,>(): Ctl<T> => { let res!: (v: T) => void, rej!: (e: unknown) => void; const p = new Promise<T>((a, b) => { res = a; rej = b; }); return { p, res, rej }; };

let aabne: Ctl<unknown>[] = [];
const hold = <T,>(): Ctl<T> => { const c = styret<T>(); aabne.push(c as Ctl<unknown>); return c; };

/** Session-mock: aktuel bruger; kan tilbageholdes. */
let aktuel: string | null = "u1";
let sessionVent: Ctl<void> | null = null;
let fetchMock: ReturnType<typeof vi.fn>;
let revoked: string[] = [];
let oprettet: string[] = [];
let urlNr = 0;

const svar = (status: number, type = "text/plain", krop = "hej") =>
  new Response(status === 200 ? krop : JSON.stringify({ kode: "x" }), { status, headers: status === 200 ? { "Content-Type": type } : {} });

/** Response hvis arrayBuffer tilbageholdes (langsom blobhentning). */
function langsomtSvar(type: string) {
  const c = hold<ArrayBuffer>();
  const r = new Response("x", { status: 200, headers: { "Content-Type": type } });
  Object.defineProperty(r, "arrayBuffer", { value: () => c.p });
  return { r, c };
}

const vis = (p: Partial<Parameters<typeof FilVedhaeftning>[0]> = {}) => (
  <FilVedhaeftning messageId="m1" sti="c/x/f.txt" navn="f.txt" type="text/plain" isOwn={false} brugerId="e1" conversationId="c1" {...p} />
);
const klik = () => act(async () => { fireEvent.click(screen.getByRole("button", { name: "Åbn f.txt" })); });
const flush = () => act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); });

beforeEach(() => {
  registrerKladdeOprydning();
  aktuel = "u1"; sessionVent = null; aabne = []; revoked = []; oprettet = []; urlNr = 0;
  authCb("SIGNED_IN", "u1");
  vi.mocked(supabase.auth.getSession).mockImplementation(async () => {
    if (sessionVent) await sessionVent.p;
    return { data: { session: aktuel ? sessionFor(aktuel) : null }, error: null };
  });
  fetchMock = vi.fn(async () => svar(200));
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => { const u = `blob:t${++urlNr}`; oprettet.push(u); return u; });
  vi.spyOn(URL, "revokeObjectURL").mockImplementation((u: string) => { revoked.push(u); });
});

afterEach(async () => {
  sessionVent?.res();
  for (const c of aabne.splice(0)) c.rej(new DOMException("Aborted", "AbortError"));
  await flush();
  cleanup();
  await flush();
  expect(filHentningsKapacitet()).toEqual({ aktive: 0, ventere: 0 });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("T6 – §6 filhentning og langsom afkodning (B2c-2b-1)", () => {
  it("to åbn-klik før render starter kun én hentning (synkron lås)", async () => {
    const c = hold<Response>();
    fetchMock.mockImplementation(() => c.p);
    render(vis());
    const b = screen.getByRole("button", { name: "Åbn f.txt" });
    await act(async () => { fireEvent.click(b); fireEvent.click(b); });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => { c.res(svar(200)); });
    expect(await screen.findByText("hej")).toBeInTheDocument();
  });

  it("langsom blob.text() + referenceskift: gammel tekst vises aldrig", async () => {
    const t = hold<string>();
    vi.spyOn(Blob.prototype, "text").mockImplementation(() => t.p);
    const r = render(vis());
    await klik(); await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    r.rerender(vis({ sti: "c/x/ny.txt" }));
    await act(async () => { t.res("gammel"); });
    await flush();
    expect(screen.queryByText("gammel")).toBeNull();
    expect(screen.getByRole("button", { name: "Åbn f.txt" })).not.toBeDisabled();
  });

  it("langsom blob.text() + brugerskift: gammel tekst vises aldrig", async () => {
    const t = hold<string>();
    vi.spyOn(Blob.prototype, "text").mockImplementation(() => t.p);
    render(vis());
    await klik(); await flush();
    await act(async () => { aktuel = "u2"; authCb("SIGNED_IN", "u2"); });
    await act(async () => { t.res("gammel"); });
    await flush();
    expect(screen.queryByText("gammel")).toBeNull();
  });

  it("langsom blobhentning + referenceskift: forældet billed-URL oprettes ikke/revokes", async () => {
    const { r: res, c } = langsomtSvar("image/png");
    fetchMock.mockResolvedValue(res);
    const r = render(vis({ type: "image/png", navn: "b.png" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Åbn b.png" })); });
    await flush();
    r.rerender(vis({ type: "image/png", navn: "b.png", sti: "c/x/ny.png" }));
    await act(async () => { c.res(new ArrayBuffer(3)); });
    await flush();
    expect(screen.queryByRole("img")).toBeNull();
    for (const u of oprettet) expect(revoked).toContain(u);
  });

  it("afmontering under langsom blobhentning: ingen state, ingen lækket URL", async () => {
    const { r: res, c } = langsomtSvar("image/png");
    fetchMock.mockResolvedValue(res);
    const r = render(vis({ type: "image/png", navn: "b.png" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Åbn b.png" })); });
    await flush();
    r.unmount();
    await act(async () => { c.res(new ArrayBuffer(3)); });
    await flush();
    expect(oprettet.filter((u) => !revoked.includes(u))).toEqual([]);
  });

  it("blob-URL oprettet, men forløbet blev forældet samtidig → revokes straks", async () => {
    const r = render(vis({ type: "image/png", navn: "b.png" }));
    fetchMock.mockResolvedValue(svar(200, "image/png"));
    vi.mocked(URL.createObjectURL).mockImplementation(() => {
      const u = `blob:t${++urlNr}`; oprettet.push(u);
      r.unmount(); // forældes præcis ved URL-oprettelsen
      return u;
    });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Åbn b.png" })); });
    await flush();
    expect(oprettet).toHaveLength(1);
    expect(revoked).toContain(oprettet[0]);
  });

  it("gammelt catch/finally ignoreres: gammel fejl vises ikke og frigiver ikke ny hentning", async () => {
    const c1 = hold<Response>(), c2 = hold<Response>();
    fetchMock.mockImplementationOnce((_u: string, i: RequestInit) => { i.signal?.addEventListener("abort", () => c1.rej(new TypeError("x"))); return c1.p; })
      .mockImplementationOnce(() => c2.p);
    const r = render(vis());
    await klik(); await flush();
    r.rerender(vis({ sti: "c/x/ny.txt" }));
    await flush();
    await klik(); await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Den nye hentning er stadig låst: et tredje klik starter intet.
    fireEvent.click(screen.getByRole("button", { name: "Åbn f.txt" }));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Filen kunne ikke hentes – prøv igen")).toBeNull();
    await act(async () => { c2.res(svar(200, "text/plain", "ny")); });
    expect(await screen.findByText("ny")).toBeInTheDocument();
  });

  it("stoppet under køventning: afbrudt venter fjernes og starter aldrig GET", async () => {
    const holdte = [hold<Response>(), hold<Response>(), hold<Response>()];
    let n = 0;
    fetchMock.mockImplementation(() => (n < 3 ? holdte[n++].p : Promise.resolve(svar(200))));
    const ids = ["a", "b", "c"];
    render(<>{ids.map((id) => <FilVedhaeftning key={id} messageId={id} sti={`s/${id}`} navn={`${id}.txt`} type="text/plain" isOwn={false} brugerId="e1" conversationId="c1" />)}</>);
    for (const id of ids) await act(async () => { fireEvent.click(screen.getByRole("button", { name: `Åbn ${id}.txt` })); });
    await flush();
    expect(filHentningsKapacitet().aktive).toBe(3);
    const r4 = render(vis());
    await klik(); await flush();
    expect(filHentningsKapacitet().ventere).toBe(1);
    r4.unmount();
    await flush();
    expect(filHentningsKapacitet().ventere).toBe(0);
    for (const h of holdte) await act(async () => { h.res(svar(200)); });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("gammel køventer under ny session (samme bruger, ny generation) starter ikke GET", async () => {
    const holdte = [hold<Response>(), hold<Response>(), hold<Response>()];
    let n = 0;
    fetchMock.mockImplementation(() => (n < 3 ? holdte[n++].p : Promise.resolve(svar(200))));
    // Køventeren uden for React (rigtig sbFil): den vækkes efter ny generation og skal stoppe via vagten.
    const { hentFil } = await import("@/lib/sbFil");
    const optag = [0, 1, 2].map((i) => hentFil(`x${i}`).catch(() => null));
    await flush();
    const gen = sessionsGeneration();
    const ventende = hentFil("m-gammel", undefined, { vagt: () => sessionsGeneration() === gen, bruger: "u1" });
    const udfald = ventende.then(() => "ok", (e: unknown) => (e instanceof Error ? e.message : "fejl"));
    await flush();
    expect(filHentningsKapacitet().ventere).toBe(1);
    await act(async () => { authCb("SIGNED_OUT", null); authCb("SIGNED_IN", "u1"); });
    expect(sessionsGeneration()).toBe(gen + 1);
    await act(async () => { holdte[0].res(svar(200)); });
    expect(await udfald).toBe("foraeldet");
    for (const h of holdte.slice(1)) await act(async () => { h.res(svar(200)); });
    await Promise.all(optag);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("m-gammel"))).toBe(false);
  });

  it("stoppet under JWT-/sessionsopslag (afmontering): nul GET", async () => {
    sessionVent = styret<void>();
    const r = render(vis());
    await klik(); await flush();
    r.unmount();
    await act(async () => { sessionVent!.res(); sessionVent = null; });
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("samme bruger i ny generation under JWT-opslag: nul GET, ingen tekst", async () => {
    sessionVent = styret<void>();
    render(vis());
    await klik(); await flush();
    await act(async () => { authCb("SIGNED_OUT", null); authCb("SIGNED_IN", "u1"); });
    await act(async () => { sessionVent!.res(); sessionVent = null; });
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText("hej")).toBeNull();
  });

  it("session tilhører anden bruger ved JWT-opslag: nul GET", async () => {
    aktuel = "u2";
    render(vis());
    await klik(); await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  for (const status of [403, 404, 410]) {
    it(`GET ${status} → »Filen er ikke længere tilgængelig«, intet genforsøg`, async () => {
      fetchMock.mockResolvedValue(svar(status));
      render(vis());
      await klik();
      expect(await screen.findByText("Filen er ikke længere tilgængelig")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Prøv igen/ })).toBeNull();
    });
  }

  it("GET 401 → log ind igen, med genforsøg", async () => {
    fetchMock.mockResolvedValue(svar(401));
    render(vis());
    await klik();
    expect(await screen.findByText("Log ind igen for at se filen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Prøv igen" })).toBeInTheDocument();
  });

  it("GET 429 med Retry-After → for mange hentninger, ventetid vist", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 429, headers: { "Retry-After": "7" } }));
    render(vis());
    await klik();
    expect(await screen.findByText("For mange hentninger – prøv igen om lidt")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Prøv igen (7 s)" })).toBeInTheDocument();
  });

  it("transportfejl → kan ikke hentes, genforsøg henter igen", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("net")).mockResolvedValueOnce(svar(200));
    render(vis());
    await klik();
    expect(await screen.findByText("Filen kunne ikke hentes – prøv igen")).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Prøv igen" })); });
    expect(await screen.findByText("hej")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
