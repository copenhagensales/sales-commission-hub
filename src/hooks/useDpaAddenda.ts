import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Database, Json } from "@/integrations/supabase/types";
import { generateDpaAddendumPdf, type DpaAddendumContent } from "@/lib/compliance/dpaAddendumPdf";

/**
 * Kundeaftaler – tillæg (allonge) til databehandleraftale.
 * Læser KUN metadata (kunder, kampagner, retentionspolitikker og manuelle felter) —
 * aldrig salg eller kundepersondata. Adgang håndhæves af RLS (superadmin).
 */

const BUCKET = "dpa-addenda";

export type DpaSubprocessor = Database["public"]["Tables"]["dpa_subprocessors"]["Row"];
export type DpaClientProfile = Database["public"]["Tables"]["dpa_client_profiles"]["Row"];
export type DpaCampaignField = Database["public"]["Tables"]["dpa_campaign_fields"]["Row"];
export type DpaAddendum = Database["public"]["Tables"]["dpa_addenda"]["Row"];
export type DpaAddendumStatus = "draft" | "sent" | "approved" | "rejected" | "superseded";

export interface DpaCampaign {
  id: string;
  client_id: string;
  name: string;
  retention_days: number | null;
  cleanup_mode: string | null;
  no_data_held: boolean | null;
  has_retention: boolean;
}

const KEYS = {
  base: ["dpa-addenda-base"] as const,
  profiles: ["dpa-client-profiles"] as const,
  fields: ["dpa-campaign-fields"] as const,
  subprocessors: ["dpa-subprocessors"] as const,
  versions: ["dpa-addenda-versions"] as const,
};

/** Kunder + kampagner + aktive retentionspolitikker (kun metadata). */
export function useDpaClientsAndCampaigns() {
  return useQuery({
    queryKey: KEYS.base,
    queryFn: async () => {
      const [clientsRes, campaignsRes, retentionRes] = await Promise.all([
        supabase.from("clients").select("id, name").order("name"),
        supabase.from("client_campaigns").select("id, client_id, name").order("name"),
        supabase
          .from("campaign_retention_policies")
          .select("client_campaign_id, retention_days, cleanup_mode, no_data_held")
          .eq("is_active", true),
      ]);
      if (clientsRes.error) throw clientsRes.error;
      if (campaignsRes.error) throw campaignsRes.error;
      if (retentionRes.error) throw retentionRes.error;
      const retention = new Map((retentionRes.data ?? []).map((r) => [r.client_campaign_id, r]));
      const campaigns: DpaCampaign[] = (campaignsRes.data ?? []).map((c) => {
        const r = retention.get(c.id);
        return {
          id: c.id,
          client_id: c.client_id,
          name: c.name,
          retention_days: r?.retention_days ?? null,
          cleanup_mode: r?.cleanup_mode ?? null,
          no_data_held: r?.no_data_held ?? null,
          has_retention: !!r,
        };
      });
      return { clients: clientsRes.data ?? [], campaigns };
    },
    staleTime: 60_000,
  });
}

export function useDpaSubprocessors() {
  return useQuery({
    queryKey: KEYS.subprocessors,
    queryFn: async () => {
      const { data, error } = await supabase.from("dpa_subprocessors").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDpaClientProfiles() {
  return useQuery({
    queryKey: KEYS.profiles,
    queryFn: async () => {
      const { data, error } = await supabase.from("dpa_client_profiles").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDpaCampaignFields() {
  return useQuery({
    queryKey: KEYS.fields,
    queryFn: async () => {
      const { data, error } = await supabase.from("dpa_campaign_fields").select("*").order("sort_order").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDpaAddendaVersions() {
  return useQuery({
    queryKey: KEYS.versions,
    queryFn: async () => {
      const { data, error } = await supabase.from("dpa_addenda").select("*").order("version", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSaveDpaClientProfile() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (profile: Database["public"]["Tables"]["dpa_client_profiles"]["Insert"]) => {
      const { error } = await supabase
        .from("dpa_client_profiles")
        .upsert({ ...profile, updated_by: user?.id ?? null }, { onConflict: "client_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.profiles }),
  });
}

export function useSaveDpaSubprocessor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Pick<DpaSubprocessor, "id" | "registration" | "processing" | "location" | "transfer_basis">) => {
      const { id, ...rest } = row;
      const { error } = await supabase.from("dpa_subprocessors").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.subprocessors }),
  });
}

export function useAddDpaCampaignField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaignId, label, description }: { campaignId: string; label: string; description?: string }) => {
      const { error } = await supabase
        .from("dpa_campaign_fields")
        .insert({ client_campaign_id: campaignId, business_label: label.trim(), description: description?.trim() || null });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.fields }),
  });
}

export function useRemoveDpaCampaignField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dpa_campaign_fields").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.fields }),
  });
}

/** Genererer PDF, gemmer den og opretter en låst version. */
export function useGenerateDpaAddendum() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ clientId, version, content }: { clientId: string; version: number; content: DpaAddendumContent }) => {
      const blob = generateDpaAddendumPdf(content);
      const path = `${clientId}/v${version}-${crypto.randomUUID()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: "application/pdf", upsert: false });
      if (upErr) throw upErr;
      const { error } = await supabase.from("dpa_addenda").insert({
        client_id: clientId,
        version,
        content: content as unknown as Json,
        pdf_path: path,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.versions }),
  });
}

export function useUpdateDpaAddendumStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Pick<DpaAddendum, "id"> & { client_id?: string } & Partial<Pick<DpaAddendum, "status" | "sent_at" | "approved_at" | "approved_contact" | "rejected_at">>) => {
      const { id, client_id, ...rest } = patch;
      const { error } = await supabase.from("dpa_addenda").update(rest).eq("id", id);
      if (error) throw error;
      // En ny godkendt version erstatter tidligere godkendte versioner for samme kunde.
      if (rest.status === "approved" && client_id) {
        const { error: supErr } = await supabase
          .from("dpa_addenda")
          .update({ status: "superseded" })
          .eq("client_id", client_id)
          .eq("status", "approved")
          .neq("id", id);
        if (supErr) throw supErr;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.versions }),
  });
}

export function useUploadSignedDpaAddendum() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ addendum, file }: { addendum: DpaAddendum; file: File }) => {
      const path = `${addendum.client_id}/v${addendum.version}-underskrevet-${crypto.randomUUID()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type || "application/pdf", upsert: false });
      if (upErr) throw upErr;
      const { error } = await supabase.from("dpa_addenda").update({ signed_pdf_path: path }).eq("id", addendum.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.versions }),
  });
}

/** Sletter en kladde (ikke sendt/godkendt). DB afviser sletning af alt andet. */
export function useDeleteDpaAddendum() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (addendum: DpaAddendum) => {
      const { data, error } = await supabase.from("dpa_addenda").delete().eq("id", addendum.id).select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Versionen kunne ikke slettes");
      await supabase.storage.from(BUCKET).remove([addendum.pdf_path]);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.versions }),
  });
}

export function useDownloadDpaFile() {
  return useMutation({
    mutationFn: async ({ path, fileName }: { path: string; fileName: string }) => {
      const { data, error } = await supabase.storage.from(BUCKET).download(path);
      if (error) throw error;
      if (!data) throw new Error("Kunne ikke hente filen");
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },
  });
}
