// D2a: seneste besked pr. samtale til samtalelisten (som i enhver beskedapp). Kun læsning; RLS afgør hvad der kan ses.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SidsteBesked { conversation_id: string; sender_id: string; content: string; created_at: string; attachment_name: string | null; attachment_path: string | null }

/** Henter de nyeste beskeder i de givne samtaler og beholder den seneste pr. samtale. Trukne/slettede beskeder springes over. */
export function useSidsteBeskeder(conversationIds: string[]) {
  const noegle = [...conversationIds].sort().join(",");
  return useQuery({
    queryKey: ["chat-sidste-beskeder", noegle],
    enabled: conversationIds.length > 0,
    staleTime: 5_000,
    queryFn: async (): Promise<Record<string, SidsteBesked>> => {
      const FELTER = "conversation_id, sender_id, content, created_at, attachment_name, attachment_path";
      const { data, error } = await supabase
        .from("chat_messages")
        .select(FELTER)
        .in("conversation_id", conversationIds)
        .is("deleted_at", null)
        .is("trukket_tilbage_at", null)
        .order("created_at", { ascending: false })
        .limit(Math.min(500, conversationIds.length * 10));
      if (error) throw error;
      const ud: Record<string, SidsteBesked> = {};
      for (const r of (data ?? []) as SidsteBesked[]) if (!ud[r.conversation_id]) ud[r.conversation_id] = r;
      // Samlet grænse kan skjule stille samtaler bag travle [Codex D2a-4]: hent seneste pr. manglende samtale særskilt (limit 1).
      const mangler = conversationIds.filter((id) => !ud[id]);
      if (mangler.length > 0 && (data?.length ?? 0) >= Math.min(500, conversationIds.length * 10)) {
        const rest = await Promise.all(mangler.map((id) => supabase.from("chat_messages").select(FELTER).eq("conversation_id", id)
          .is("deleted_at", null).is("trukket_tilbage_at", null).order("created_at", { ascending: false }).limit(1)));
        for (const r of rest) { const m = (r.data ?? [])[0] as SidsteBesked | undefined; if (m) ud[m.conversation_id] = m; }
      }
      return ud;
    },
  });
}
