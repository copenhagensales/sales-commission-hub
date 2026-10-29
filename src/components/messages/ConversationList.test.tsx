import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import type { Conversation } from "@/hooks/useChat";

const h = vi.hoisted(() => ({ afvis: null as null | ((e: unknown) => void), løs: null as null | (() => void) }));
const samtale: Conversation = {
  id: "g1", is_group: true, name: "Holdet", created_by: "andre", direct_key: null, vaern_niveau: 0,
  created_at: "2026-10-01T10:00:00Z", updated_at: "2026-10-01T10:00:00Z", unread_count: 3, members: [],
};
vi.mock("@/hooks/useChat", async () => {
  const ægte = await vi.importActual<typeof import("@/hooks/useChat")>("@/hooks/useChat");
  return {
    ...ægte,
    useConversations: () => ({ data: [samtale], isLoading: false }),
    useOnlineStatus: () => new Set<string>(),
    useDeleteConversation: () => ({
      isPending: false,
      slet: () => new Promise<void>((løs, afvis) => { h.løs = løs; h.afvis = afvis; }),
    }),
  };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { toast } from "sonner";
import { ConversationList } from "./ConversationList";
import { ForaeldetSession } from "@/lib/sbKladder";

beforeEach(() => { h.afvis = null; h.løs = null; vi.mocked(toast.success).mockClear(); vi.mocked(toast.error).mockClear(); });
afterEach(() => cleanup());

async function startForlad() {
  const onSelect = vi.fn();
  render(<ConversationList selectedId="g1" onSelect={onSelect} />);
  const knap = screen.getByRole("button", { name: "Flere handlinger" });
  knap.focus();
  fireEvent.keyDown(knap, { key: "Enter" });
  fireEvent.click(await screen.findByText("Forlad gruppe"));
  fireEvent.click(await screen.findByRole("button", { name: "Forlad" }));
  await vi.waitFor(() => expect(h.afvis).toBeTypeOf("function"));
  onSelect.mockClear(); // tastaturåbning af menuen bobler til kortet; kun afslutningens kald tæller
  return onSelect;
}

describe("B2-6A §D ConversationList: sen afslutning efter sessionsskift", () => {
  it("ForaeldetSession efter sessionsskift: ingen toast, ingen navigation, listen uændret", async () => {
    const onSelect = await startForlad();
    await act(async () => { h.afvis!(new ForaeldetSession()); await Promise.resolve(); });
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByText("Holdet")).toBeTruthy();
  });
  it("regressionsværn: almindelig fejl viser fejltoast, navigerer ikke", async () => {
    const onSelect = await startForlad();
    await act(async () => { h.afvis!(new Error("x")); await Promise.resolve(); });
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
