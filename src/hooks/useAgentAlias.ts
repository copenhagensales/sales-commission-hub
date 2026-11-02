import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/**
 * Sælger-alias (F1a-3): eksternt bruger-id pr. kilde → agent. Fyldes af salgssync og kaldshentning; id'er uden kobling vælges manuelt her (ejer).
 * Efter en manuel kobling sættes sælgeren på de kald, der mangler den (agent_alias_anvend). Fejler kaldet, står anvendt_tid null, og kaldshentningen samler op.
 */
export type AgentAlias = Database["public"]["Tables"]["agent_ekstern_alias"]["Row"];
export type AgentValg = Pick<Database["public"]["Tables"]["agents"]["Row"], "id" | "name" | "email" | "is_active">;

const KEYS = { alias: (kilde: string) => ["agent-ekstern-alias", kilde] as const, agents: ["agent-valg"] as const };

/** Alias for en kilde; med kontoId vises kontoens egne id'er + id'er uden kendt konto (fx fra salg). */
export function useAgentAlias(kilde: string, kontoId?: string | null) {
  return useQuery({
    queryKey: [...KEYS.alias(kilde), kontoId ?? "alle"],
    queryFn: async () => {
      let q = supabase.from("agent_ekstern_alias").select("*").eq("kilde", kilde);
      if (kontoId) q = q.or(`konto_id.eq.${kontoId},konto_id.is.null`);
      const { data, error } = await q.order("agent_id", { nullsFirst: true }).order("ekstern_id");
      if (error) throw error;
      return (data ?? []) as AgentAlias[];
    },
    staleTime: 60 * 1000,
  });
}

export function useAgentValg() {
  return useQuery({
    queryKey: KEYS.agents,
    queryFn: async () => {
      const { data, error } = await supabase.from("agents").select("id, name, email, is_active").order("name");
      if (error) throw error;
      return (data ?? []) as AgentValg[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export const IKKE_VORES = "__ikke_vores";

/** Kobler et eksternt id til en agent (og sætter sælgeren på kald uden sælger) – eller markerer det som »ikke vores medarbejder« (krav 10). */
export function useKoblAlias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ kilde, eksternId, agentId, kontoId }: { kilde: string; eksternId: string; agentId: string; kontoId?: string }) => {
      const ikkeVores = agentId === IKKE_VORES;
      const { error } = await supabase.from("agent_ekstern_alias")
        .update({ agent_id: ikkeVores ? null : agentId, ikke_vores: ikkeVores, oprindelse: "manuel", anvendt_tid: null, bagud_hentet_tid: null, aendret: new Date().toISOString() })
        .eq("kilde", kilde).eq("ekstern_id", eksternId);
      if (error) throw error;
      // Kobles id'et fra en kontos side, og det ingen konto har (fx fra salg), hører det til dén konto (krav 10: kun koblinger MED konto filtreres ind)
      if (kontoId) { const { error: e3 } = await supabase.from("agent_ekstern_alias").update({ konto_id: kontoId }).eq("kilde", kilde).eq("ekstern_id", eksternId).is("konto_id", null); if (e3) throw e3; }
      if (ikkeVores) return -1;
      const { data, error: e2 } = await supabase.rpc("agent_alias_anvend", { p_kilde: kilde, p_ekstern_id: eksternId });
      if (e2) throw e2;
      return Number(data ?? 0);
    },
    onSuccess: (n, v) => {
      qc.invalidateQueries({ queryKey: KEYS.alias(v.kilde) });
      toast.success(n < 0 ? "Markeret som ikke vores medarbejder" : n > 0 ? `Sælger sat på ${n.toLocaleString("da-DK")} kald` : "Kobling gemt");
    },
    onError: (e: Error) => toast.error(`Kunne ikke koble sælgeren: ${e.message}`),
  });
}
