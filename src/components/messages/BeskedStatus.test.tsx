import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// Netværket mockes ved grænsen; MessageBubble, BeskedStatus og hooks er de rigtige. SQL-adfærd er antagelser.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { onAuthStateChange: vi.fn(), getSession: vi.fn() }, from: vi.fn(), rpc: vi.fn(), functions: { invoke: vi.fn() } },
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));
vi.mock("./FilVedhaeftning", () => ({ FilVedhaeftning: () => null }));

import { MessageBubble } from "./MessageBubble";
import { rydAlleKladder, registrerKladdeOprydning, laesRetKladde } from "@/lib/sbKladder";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Message } from "@/hooks/useChat";

const afventer = (rev: number, fil = false): Message => ({
  id: "m1", conversation_id: "c", sender_id: "e", content: "vist tekst", status: "afventer_afsender", revision: rev,
  created_at: "2026-10-28T10:00:00Z", leveret_at: null, edited_at: null, reactions: [], read_receipts: [],
  attachment_path: fil ? "e/c/f" : null,
} as unknown as Message);

let qc: QueryClient;
let auth!: (e: string, s: unknown) => void;
const ui = (m: Message, bruger: string | null = "u") => (
  <QueryClientProvider client={qc}>
    <MessageBubble message={m} isOwn currentEmployeeId="e" authBrugerId={bruger} conversationId="c" onReply={() => undefined} />
  </QueryClientProvider>) as ReactNode;
const chain = () => { const b: Record<string, unknown> = {}; for (const k of ["select", "eq", "in", "order", "limit"]) b[k] = () => b; b.maybeSingle = async () => ({ data: null, error: null }); return b; };
const kald = (navn: string) => vi.mocked(supabase.rpc).mock.calls.filter((c) => c[0] === navn);

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { mutations: { retry: 1, retryDelay: 0 }, queries: { retry: false } } });
  rydAlleKladder();
  sessionStorage.clear();
  vi.mocked(supabase.rpc).mockReset();
  vi.mocked(supabase.from).mockImplementation((() => chain()) as never);
  vi.mocked(toast.error).mockReset();
  registrerKladdeOprydning();
  auth = vi.mocked(supabase.auth.onAuthStateChange).mock.calls[0][0] as (e: string, s: unknown) => void;
  auth("SIGNED_IN", { user: { id: "u" } });
});

describe("T3 (B2b-1) – Ret fra statuskortet fastholder den viste revision", () => {
  it("Ret åbner editor med vist tekst; Gem sender den viste revision selv efter genhentning til ny revision", async () => {
    const r = render(ui(afventer(3)));
    fireEvent.click(screen.getByRole("button", { name: "Ret" }));
    const felt = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(felt.value).toBe("vist tekst");
    r.rerender(ui(afventer(4)));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "rettet" } });
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: 5, error: null } as never);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Gem ændring" })); });
    expect((kald("sb_ret")[0][1] as { p_revision: number }).p_revision).toBe(3);
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
    vi.mocked(supabase.rpc).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(ui(afventer(7)));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Træk tilbage" })); await new Promise((x) => setTimeout(x, 10)); });
    expect(kald("sb_afgoer")).toHaveLength(1);
    expect(kald("sb_afgoer")[0][1]).toMatchObject({ p_revision: 7, p_handling: "traek" });
    // B2b-2: rækken er usynlig i mocken → ukendt udfald vises lokalt, ingen toast.
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("Udfaldet kunne ikke bekræftes");
  });

  it("Fjern fil sender den viste revision; transportfejl giver præcis ét sb_fjern_fil", async () => {
    vi.mocked(supabase.rpc).mockRejectedValueOnce(new TypeError("Failed to fetch"));
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
    vi.mocked(supabase.rpc).mockImplementationOnce((() => new Promise((_a, r) => { afvis = r; })) as never);
    render(ui(afventer(2)));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Træk tilbage" })); });
    expect(kald("sb_afgoer")).toHaveLength(1);
    act(() => { auth("SIGNED_OUT", null); auth("SIGNED_IN", { user: { id: "u" } }); });
    await act(async () => { afvis({ code: "P0001", message: "afvist" }); await new Promise((x) => setTimeout(x, 10)); });
    expect(toast.error).not.toHaveBeenCalled();
    expect(kald("sb_afgoer")).toHaveLength(1);
  });
});
