import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/**
 * Integrationer-siden (Mathias 31/10): registret over Storks API'er (api_register) + KONTO-laget (api_konto: én linje pr. konto/API,
 * api_konto_klient: hvilke klienter kontoen arbejder for). Kun Adversus er redigerbar i kataloget nu; navn og klienter kan rettes på alle konti.
 * Alle læsninger går gennem React Query (ingen supabase i komponenter).
 */
export type ApiRegisterRaekke = Database["public"]["Tables"]["api_register"]["Row"];
export type ApiKonto = Database["public"]["Tables"]["api_konto"]["Row"];
export type Klient = Pick<Database["public"]["Tables"]["clients"]["Row"], "id" | "name">;

export const RETNING_LABEL: Record<string, string> = { henter: "Henter", sender: "Sender", begge: "Henter og sender" };
export const API_STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  aktiv: { label: "Redigerbar", variant: "default" },
  laast: { label: "Låst", variant: "secondary" },
  planlagt: { label: "Planlagt", variant: "outline" },
};

export const KEYS = {
  register: ["api-register"] as const,
  konti: ["api-konti"] as const,
  kontoKlienter: ["api-konto-klienter"] as const,
  klienter: ["api-klienter"] as const,
  kampagner: (integrationId: string) => ["api-konto-kampagner", integrationId] as const,
  dialerKonti: (ids: string[]) => ["api-dialer-konti", ...ids] as const,
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

/** Alle konti (én pr. dialer-konto og pr. øvrig API). */
export function useApiKonti() {
  return useQuery({
    queryKey: KEYS.konti,
    queryFn: async () => {
      const { data, error } = await supabase.from("api_konto").select("*").order("sort").order("navn");
      if (error) throw error;
      return (data ?? []) as ApiKonto[];
    },
    staleTime: 60 * 1000,
  });
}

/** Klienter pr. konto som Map<konto_id, client_id[]>. */
export function useKontoKlienter() {
  return useQuery({
    queryKey: KEYS.kontoKlienter,
    queryFn: async () => {
      const { data, error } = await supabase.from("api_konto_klient").select("konto_id, client_id");
      if (error) throw error;
      const m = new Map<string, string[]>();
      for (const r of data ?? []) m.set(r.konto_id, [...(m.get(r.konto_id) ?? []), r.client_id]);
      return m;
    },
  });
}

export function useKlienter() {
  return useQuery({
    queryKey: KEYS.klienter,
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as Klient[];
    },
    staleTime: 10 * 60 * 1000,
  });
}

/** Navn/note/aktiv på en konto (RLS: ejer/superadmin). */
export function useOpdaterKonto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, aendring }: { id: string; aendring: Partial<Pick<ApiKonto, "navn" | "note" | "aktiv">> }) => {
      const { error } = await supabase.from("api_konto").update({ ...aendring, aendret: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.konti }),
    onError: (e: Error) => toast.error(`Kunne ikke gemme kontoen: ${e.message}`),
  });
}

/** Sætter kontoens klienter (erstatter mængden atomisk via RPC). */
export function useSaetKontoKlienter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ kontoId, clientIds }: { kontoId: string; clientIds: string[] }) => {
      // Atomisk i DB (RPC): en fejlende indsættelse efterlader den gamle mængde (Codex P1)
      const { error } = await supabase.rpc("api_konto_saet_klienter", { p_konto: kontoId, p_clients: clientIds });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.kontoKlienter }),
    onError: (e: Error) => toast.error(`Kunne ikke gemme klienter: ${e.message}`),
  });
}

/** Kampagner (Adversus/Enreach-id'er) kontoen har kald eller emner på – til filtrering af kampagnefelter og -politikker. */
export function useKontoKampagner(integrationId: string | null) {
  return useQuery({
    queryKey: KEYS.kampagner(integrationId ?? "-"),
    queryFn: async () => {
      if (!integrationId) return [] as string[];
      const { data, error } = await supabase.rpc("api_konto_kampagner", { p_integration_id: integrationId });
      if (error) throw error;
      return (data ?? []).map((r) => r.campaign_external_id);
    },
    enabled: !!integrationId,
    staleTime: 5 * 60 * 1000,
  });
}

export type DialerKonto = Pick<
  Database["public"]["Tables"]["dialer_integrations"]["Row"],
  "id" | "name" | "provider" | "is_active" | "last_sync_at" | "last_status" | "sync_frequency_minutes" | "config"
>;

/** dialer_integrations-rækker for givne id'er (ejer). */
export function useDialerKonti(ids: string[]) {
  return useQuery({
    queryKey: KEYS.dialerKonti(ids),
    queryFn: async () => {
      if (ids.length === 0) return [] as DialerKonto[];
      const { data, error } = await supabase
        .from("dialer_integrations")
        .select("id, name, provider, is_active, last_sync_at, last_status, sync_frequency_minutes, config")
        .in("id", ids)
        .order("name");
      if (error) throw error;
      return (data ?? []) as DialerKonto[];
    },
    enabled: ids.length > 0,
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
  adversusKampagneIds: string[];
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
      const adv = new Map<string, { tekst: string; id: string }[]>();
      for (const m of map.data ?? []) {
        if (!m.client_campaign_id) continue;
        const liste = adv.get(m.client_campaign_id) ?? [];
        liste.push({ tekst: m.adversus_campaign_name ? `${m.adversus_campaign_name} (${m.adversus_campaign_id})` : m.adversus_campaign_id, id: m.adversus_campaign_id });
        adv.set(m.client_campaign_id, liste);
      }
      return (pol.data ?? [])
        .map((p) => ({
          id: p.id,
          klientkampagne: navn.get(p.client_campaign_id) ?? p.client_campaign_id,
          adversusKampagner: (adv.get(p.client_campaign_id) ?? []).map((x) => x.tekst),
          adversusKampagneIds: (adv.get(p.client_campaign_id) ?? []).map((x) => x.id),
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
