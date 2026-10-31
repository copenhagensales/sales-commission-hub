import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/**
 * Integrationer-siden (Mathias 31/10): registret over Storks API'er som data (api_register) + de data, hver API's underside viser.
 * Kun Adversus er redigerbar nu; øvrige vises som »Låst«. Alle læsninger går gennem React Query (ingen supabase i komponenter).
 */
export type ApiRegisterRaekke = Database["public"]["Tables"]["api_register"]["Row"];

export const RETNING_LABEL: Record<string, string> = { henter: "Henter", sender: "Sender", begge: "Henter og sender" };
export const API_STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  aktiv: { label: "Redigerbar", variant: "default" },
  laast: { label: "Låst", variant: "secondary" },
  planlagt: { label: "Planlagt", variant: "outline" },
};

/** Hvilke dialer_integrations.provider-værdier hører til en API-nøgle i registret. */
export const API_PROVIDERE: Record<string, string[]> = {
  adversus: ["adversus"],
  lederne: ["adversus_lederne"],
  enreach: ["enreach"],
};

export const KEYS = {
  register: ["api-register"] as const,
  konti: (providere: string[]) => ["api-register-konti", ...providere] as const,
  syncState: (ids: string[]) => ["api-register-sync-state", ...ids] as const,
  systemPolitikker: (tabeller: string[]) => ["api-register-systempolitikker", ...tabeller] as const,
  kampagnePolitikker: ["api-register-kampagnepolitikker"] as const,
};

export function useApiRegister() {
  return useQuery({
    queryKey: KEYS.register,
    queryFn: async () => {
      const { data, error } = await supabase.from("api_register").select("*").order("sort").order("navn");
      if (error) throw error;
      return (data ?? []) as ApiRegisterRaekke[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export type DialerKonto = Pick<
  Database["public"]["Tables"]["dialer_integrations"]["Row"],
  "id" | "name" | "provider" | "is_active" | "last_sync_at" | "last_status" | "sync_frequency_minutes" | "config"
>;

/** Konti (dialer_integrations) for API'ens providere; tom liste for API'er uden dialer-konti. */
export function useDialerKonti(providere: string[]) {
  return useQuery({
    queryKey: KEYS.konti(providere),
    queryFn: async () => {
      if (providere.length === 0) return [] as DialerKonto[];
      const { data, error } = await supabase
        .from("dialer_integrations")
        .select("id, name, provider, is_active, last_sync_at, last_status, sync_frequency_minutes, config")
        .in("provider", providere)
        .order("name");
      if (error) throw error;
      return (data ?? []) as DialerKonto[];
    },
  });
}

export type SyncState = Database["public"]["Tables"]["dialer_sync_state"]["Row"];

export function useSyncState(integrationIds: string[]) {
  return useQuery({
    queryKey: KEYS.syncState(integrationIds),
    queryFn: async () => {
      if (integrationIds.length === 0) return [] as SyncState[];
      const { data, error } = await supabase
        .from("dialer_sync_state")
        .select("integration_id, dataset, last_success_at, cursor, last_error_at, last_error, updated_at")
        .in("integration_id", integrationIds)
        .order("dataset");
      if (error) throw error;
      return (data ?? []) as SyncState[];
    },
    enabled: integrationIds.length > 0,
  });
}

export type SystemPolitik = Database["public"]["Tables"]["data_retention_policies"]["Row"];

/** Systempolitikker (data_retention_policies) for API'ens tabeller. */
export function useSystemPolitikker(tabeller: string[]) {
  return useQuery({
    queryKey: KEYS.systemPolitikker(tabeller),
    queryFn: async () => {
      if (tabeller.length === 0) return [] as SystemPolitik[];
      const { data, error } = await supabase.from("data_retention_policies").select("*").in("data_type", tabeller).order("data_type");
      if (error) throw error;
      return (data ?? []) as SystemPolitik[];
    },
  });
}

export interface KampagnePolitik {
  id: string;
  klientkampagne: string;
  adversusKampagner: string[];
  retention_days: number | null;
  dialer_retention_days: number | null;
  is_active: boolean;
  cleanup_mode: string;
  no_data_held: boolean;
}

/** Kampagnepolitikker (campaign_retention_policies) koblet til Adversus-kampagner via adversus_campaign_mappings – det, oprydningen bruger i dag. */
export function useKampagnePolitikker(enabled: boolean) {
  return useQuery({
    queryKey: KEYS.kampagnePolitikker,
    queryFn: async () => {
      const [pol, kamp, map] = await Promise.all([
        supabase.from("campaign_retention_policies").select("id, client_campaign_id, retention_days, dialer_retention_days, is_active, cleanup_mode, no_data_held"),
        supabase.from("client_campaigns").select("id, name"),
        supabase.from("adversus_campaign_mappings").select("adversus_campaign_id, adversus_campaign_name, client_campaign_id"),
      ]);
      if (pol.error) throw pol.error;
      if (kamp.error) throw kamp.error;
      if (map.error) throw map.error;
      const navn = new Map((kamp.data ?? []).map((k) => [k.id, k.name] as const));
      const adv = new Map<string, string[]>();
      for (const m of map.data ?? []) {
        if (!m.client_campaign_id) continue;
        const liste = adv.get(m.client_campaign_id) ?? [];
        liste.push(m.adversus_campaign_name ? `${m.adversus_campaign_name} (${m.adversus_campaign_id})` : m.adversus_campaign_id);
        adv.set(m.client_campaign_id, liste);
      }
      return (pol.data ?? [])
        .map((p) => ({
          id: p.id,
          klientkampagne: navn.get(p.client_campaign_id) ?? p.client_campaign_id,
          adversusKampagner: adv.get(p.client_campaign_id) ?? [],
          retention_days: p.retention_days,
          dialer_retention_days: p.dialer_retention_days,
          is_active: p.is_active,
          cleanup_mode: p.cleanup_mode,
          no_data_held: p.no_data_held,
        }))
        .sort((a, b) => a.klientkampagne.localeCompare(b.klientkampagne, "da")) as KampagnePolitik[];
    },
    enabled,
  });
}
