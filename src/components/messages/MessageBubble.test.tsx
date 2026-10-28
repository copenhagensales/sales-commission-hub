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
vi.mock("@/hooks/useChat", async (orig) => ({
  ...(await orig<typeof import("@/hooks/useChat")>()),
  useEditMessage: () => ({ mutateAsync: editMutate, isPending: false }),
}));
vi.mock("./BeskedStatus", () => ({ BeskedStatus: () => null }));
vi.mock("./FilVedhaeftning", () => ({ FilVedhaeftning: () => null }));

import { MessageBubble } from "./MessageBubble";
import { gemRetKladde, laesRetKladde, rydAlleKladder } from "@/lib/sbKladder";
import { hasUnsentDrafts } from "@/components/mobile";
import type { Message } from "@/hooks/useChat";

const besked = (id: string, content: string, revision = 1): Message => ({
  id, conversation_id: "c", sender_id: "e", content, status: "leveret", revision, created_at: "2026-10-28T10:00:00Z",
  leveret_at: "2026-10-28T10:00:00Z", edited_at: null, reactions: [], read_receipts: [],
} as unknown as Message);

let qc: QueryClient;
const wrap = (n: ReactNode) => <QueryClientProvider client={qc}>{n}</QueryClientProvider>;
const felt = () => screen.queryByRole("textbox") as HTMLTextAreaElement | null;
const ui = (m: Message, emp?: string) => wrap(<MessageBubble message={m} isOwn currentEmployeeId={emp} conversationId="c" onReply={() => undefined} />);

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
