import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const mutateAsync = vi.fn();
const afstemKun = vi.fn(async () => "ikke_fundet");
const udstedUpload = vi.fn();
const uploadTilSti = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u" } } })), onAuthStateChange: vi.fn() } },
}));
vi.mock("@/lib/employeeLookup", () => ({ findEmployeeByAuth: vi.fn(async () => ({ data: { id: "e", first_name: "A", last_name: "B" } })) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));
vi.mock("@/components/mobile", () => ({ SkeletonList: () => null, useDraftGuard: () => undefined }));
vi.mock("./MessageSearch", () => ({ MessageSearch: () => null }));
vi.mock("./TypingIndicator", () => ({ TypingIndicator: () => null }));
vi.mock("./MessageBubble", () => ({ MessageBubble: () => null }));
vi.mock("./MentionInput", () => ({
  MentionInput: ({ value, onChange, onKeyDown }: { value: string; onChange: (v: string) => void; onKeyDown: (e: React.KeyboardEvent) => void }) => (
    <textarea aria-label="besked" value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} />
  ),
}));
vi.mock("@/lib/sbFil", async (orig) => ({
  ...(await orig<typeof import("@/lib/sbFil")>()),
  udstedUpload: (...a: unknown[]) => udstedUpload(...a),
  uploadTilSti: (...a: unknown[]) => uploadTilSti(...a),
}));
vi.mock("@/hooks/useChat", async (orig) => {
  const ægte = await orig<typeof import("@/hooks/useChat")>();
  return {
    ...ægte,
    useMessages: () => ({ data: [], isLoading: false, hasOlder: false, isLoadingOlder: false, loadOlder: () => undefined }),
    useSendMessage: () => ({ mutateAsync }),
    useRealtimeMessages: () => undefined,
    useMarkAsRead: () => ({ mutate: vi.fn(), isPending: false }),
    useTypingIndicator: () => ({ typingUsers: [], setTyping: vi.fn() }),
    useChatAktiv: () => undefined,
    afstemKun: () => afstemKun(),
  };
});

import { ChatView } from "./ChatView";
import { SendFejl, IKKE_REGISTRERET_TEKST } from "@/hooks/useChat";
import { rydAlleKladder, hentAfsendelser } from "@/lib/sbKladder";

const wrap = (n: ReactNode) => <QueryClientProvider client={new QueryClient()}>{n}</QueryClientProvider>;
const kontrol = <T,>() => { let res!: (v: T) => void; let rej!: (e: unknown) => void; const p = new Promise<T>((a, b) => { res = a; rej = b; }); return { p, res, rej }; };

async function klar(conv = "A") {
  const r = render(wrap(<ChatView conversationId={conv} />));
  await waitFor(() => expect(hentAfsendelser("e", conv)).toBeDefined());
  await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
  return r;
}
const skriv = (t: string) => fireEvent.change(screen.getByLabelText("besked"), { target: { value: t } });
const send = () => screen.getByRole("button", { name: "Send" });

beforeEach(() => {
  Element.prototype.scrollIntoView = () => undefined;
  globalThis.URL.createObjectURL = () => "blob:test";
  globalThis.URL.revokeObjectURL = () => undefined;
  rydAlleKladder();
  sessionStorage.clear();
  mutateAsync.mockReset(); udstedUpload.mockReset(); uploadTilSti.mockReset(); afstemKun.mockClear();
});

describe("T1 – ChatView afsendelse", () => {
  it("dobbelt Send og Enter+klik giver én afsendelse", async () => {
    mutateAsync.mockReturnValue(new Promise(() => undefined));
    await klar();
    skriv("hej");
    await act(async () => {
      fireEvent.keyDown(screen.getByLabelText("besked"), { key: "Enter" });
      fireEvent.click(send());
      fireEvent.click(send());
    });
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(hentAfsendelser("e", "A")).toHaveLength(1);
  });

  it("sen succes for A rydder kun A; pending B og ny tekst bevares", async () => {
    const a = kontrol<unknown>(), b = kontrol<unknown>();
    mutateAsync.mockReturnValueOnce(a.p).mockReturnValueOnce(b.p);
    await klar();
    skriv("A"); await act(async () => { fireEvent.click(send()); });
    skriv("B"); await act(async () => { fireEvent.click(send()); });
    skriv("ny kladde");
    const [idA] = hentAfsendelser("e", "A").map((x) => x.id);
    await act(async () => { a.res({}); await a.p; });
    expect(hentAfsendelser("e", "A").map((x) => x.tekst)).toEqual(["B"]);
    expect(hentAfsendelser("e", "A").some((x) => x.id === idA)).toBe(false);
    expect((screen.getByLabelText("besked") as HTMLTextAreaElement).value).toBe("ny kladde");
  });

  it("A–B–A: pending A overlever samtaleskift, kladde skrives ikke under ny nøgle", async () => {
    mutateAsync.mockReturnValue(new Promise(() => undefined));
    const r = await klar("A");
    skriv("til A"); await act(async () => { fireEvent.click(send()); });
    skriv("kladde A");
    r.rerender(wrap(<ChatView conversationId="B" />));
    await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
    expect((screen.getByLabelText("besked") as HTMLTextAreaElement).value).toBe("");
    r.rerender(wrap(<ChatView conversationId="A" />));
    await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
    expect(hentAfsendelser("e", "A").map((x) => x.tekst)).toEqual(["til A"]);
    expect((screen.getByLabelText("besked") as HTMLTextAreaElement).value).toBe("kladde A");
    expect(hentAfsendelser("e", "B")).toEqual([]);
  });

  it("valgt fil under upload: Send er låst", async () => {
    udstedUpload.mockReturnValue(new Promise(() => undefined));
    const { container } = await klar();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => { fireEvent.change(input, { target: { files: [new File(["x"], "x.txt", { type: "text/plain" })] } }); });
    expect(send()).toBeDisabled();
  });

  it("ukendt udfald tilbyder ikke Ret", async () => {
    mutateAsync.mockRejectedValueOnce(new SendFejl("ukendt", "Ikke sendt – prøv igen"));
    await klar();
    skriv("hej"); await act(async () => { fireEvent.click(send()); });
    expect(await screen.findByText("Afstemmer …")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ret" })).toBeNull();
  });
});

describe("T10 – Ret og genudstedelse", () => {
  async function medFil() {
    udstedUpload.mockResolvedValueOnce({ sti: "c/e/gammel.txt", token: "t", conversationId: "A" });
    uploadTilSti.mockResolvedValueOnce(undefined);
    const r = await klar();
    const input = r.container.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => { fireEvent.change(input, { target: { files: [new File(["x"], "x.txt", { type: "text/plain" })] } }); });
    await waitFor(() => expect(send()).not.toBeDisabled());
    return r;
  }

  it("afvist filsending → Ret bevarer id, fil og svar; ny Send bruger samme id", async () => {
    await medFil();
    mutateAsync.mockRejectedValueOnce(new SendFejl("server", "Afvist"));
    skriv("tekst"); await act(async () => { fireEvent.click(send()); });
    const id = (mutateAsync.mock.calls[0][0] as { id: string }).id;
    fireEvent.click(await screen.findByRole("button", { name: "Ret" }));
    expect(screen.getByText("x.txt")).toBeInTheDocument();
    mutateAsync.mockResolvedValueOnce({});
    await act(async () => { fireEvent.click(send()); });
    expect(mutateAsync.mock.calls[1][0]).toMatchObject({ id, attachmentPath: "c/e/gammel.txt", content: "tekst" });
  });

  it("Ret overskriver ikke en anden igangværende kladde", async () => {
    mutateAsync.mockRejectedValueOnce(new SendFejl("server", "Afvist"));
    await klar();
    skriv("første"); await act(async () => { fireEvent.click(send()); });
    skriv("anden kladde");
    expect(await screen.findByRole("button", { name: "Ret" })).toBeDisabled();
  });

  it("ubundet overtaget sti → brugerudløst genforsøg giver ny sti og samme id", async () => {
    await medFil();
    mutateAsync.mockRejectedValueOnce(new SendFejl("genudsted", IKKE_REGISTRERET_TEKST));
    await act(async () => { fireEvent.click(send()); });
    const id = (mutateAsync.mock.calls[0][0] as { id: string }).id;
    udstedUpload.mockResolvedValueOnce({ sti: "c/e/ny.txt", token: "t2", conversationId: "A" });
    uploadTilSti.mockResolvedValueOnce(undefined);
    mutateAsync.mockResolvedValueOnce({});
    await act(async () => { fireEvent.click(await screen.findByRole("button", { name: "Ikke sendt – prøv igen" })); });
    expect(udstedUpload).toHaveBeenCalledTimes(2);
    expect(mutateAsync.mock.calls[1][0]).toMatchObject({ id, attachmentPath: "c/e/ny.txt" });
  });

  it("gentagen genudsted-afvisning giver ingen løkke", async () => {
    await medFil();
    mutateAsync.mockRejectedValue(new SendFejl("genudsted", IKKE_REGISTRERET_TEKST));
    udstedUpload.mockResolvedValue({ sti: "c/e/ny.txt", token: "t2", conversationId: "A" });
    uploadTilSti.mockResolvedValue(undefined);
    await act(async () => { fireEvent.click(send()); });
    await act(async () => { fireEvent.click(await screen.findByRole("button", { name: "Ikke sendt – prøv igen" })); });
    await act(async () => { await new Promise((x) => setTimeout(x, 20)); });
    expect(udstedUpload).toHaveBeenCalledTimes(2);
    expect(mutateAsync).toHaveBeenCalledTimes(2);
  });

  it("CPR-P0001 giver ingen udstedelse ved genforsøg", async () => {
    await medFil();
    mutateAsync.mockRejectedValue(new SendFejl("server", "Filen indeholder et CPR-nummer"));
    await act(async () => { fireEvent.click(send()); });
    await act(async () => { fireEvent.click(await screen.findByRole("button", { name: "Ikke sendt – prøv igen" })); });
    expect(screen.getByText("Filen indeholder et CPR-nummer")).toBeInTheDocument();
    expect(udstedUpload).toHaveBeenCalledTimes(1);
  });

  it("manglende File ved genudstedelse → Vælg filen igen, tekst bevaret", async () => {
    mutateAsync.mockRejectedValueOnce(new SendFejl("genudsted", IKKE_REGISTRERET_TEKST));
    await medFil();
    skriv("bevar");
    // Simulér reload: File findes ikke længere i hukommelsen.
    await act(async () => { fireEvent.click(send()); });
    const [a] = hentAfsendelser("e", "A");
    const { saetAfsendelsesFil } = await import("@/lib/sbKladder");
    await act(async () => { saetAfsendelsesFil("e", "A", a.id, null); });
    await act(async () => { fireEvent.click(await screen.findByRole("button", { name: "Ikke sendt – prøv igen" })); });
    expect(await screen.findAllByText("Vælg filen igen")).not.toHaveLength(0);
    expect(hentAfsendelser("e", "A")[0]).toMatchObject({ tekst: "bevar", tilstand: "vaelg_fil" });
    expect(udstedUpload).toHaveBeenCalledTimes(1);
  });
});
