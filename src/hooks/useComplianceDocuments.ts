import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";

export type ComplianceDocumentRow = Database["public"]["Tables"]["compliance_documents"]["Row"];
export type ComplianceVersionRow = Database["public"]["Tables"]["compliance_document_versions"]["Row"];

export interface ComplianceDocumentWithVersions extends ComplianceDocumentRow {
  versions: ComplianceVersionRow[];
  /** Gældende (godkendt) version, hvis nogen. */
  current: ComplianceVersionRow | null;
  /** Nyeste version, der afventer godkendelse, hvis nogen. */
  pending: ComplianceVersionRow | null;
}

export const versionLabel = (v: Pick<ComplianceVersionRow, "version_major" | "version_minor">) =>
  `${v.version_major}.${v.version_minor}`;

export const APPROVER_LABEL = "Kasper Mikkelsen";

const KEY = ["compliance-documents"];

export function useComplianceDocuments() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<ComplianceDocumentWithVersions[]> => {
      const [docs, versions] = await Promise.all([
        supabase.from("compliance_documents").select("*").order("sort_order"),
        supabase
          .from("compliance_document_versions")
          .select("*")
          .order("version_major", { ascending: false })
          .order("version_minor", { ascending: false }),
      ]);
      if (docs.error) throw docs.error;
      if (versions.error) throw versions.error;
      return (docs.data ?? []).map((d) => {
        const vs = (versions.data ?? []).filter((v) => v.document_id === d.id);
        return {
          ...d,
          versions: vs,
          current: vs.find((v) => v.status === "approved") ?? null,
          pending: vs.find((v) => v.status === "pending") ?? null,
        };
      });
    },
    staleTime: 60_000,
  });
}

export function useComplianceDocument(key: string) {
  const query = useComplianceDocuments();
  return { ...query, doc: query.data?.find((d) => d.key === key) ?? null };
}

/** Må den indloggede bruger godkende compliance-dokumenter (håndhæves også i databasen). */
export function useIsComplianceApprover() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["compliance-is-approver", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("compliance_is_approver");
      if (error) return false;
      return data === true;
    },
    enabled: !!user?.id,
    staleTime: 300_000,
  });
}

export function useApproveComplianceVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (versionId: string) => {
      const { error } = await supabase
        .from("compliance_document_versions")
        .update({ status: "approved" })
        .eq("id", versionId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/**
 * Gemmer en ændret tekst. Findes der allerede et udkast, opdateres det.
 * Ellers oprettes næste version (1.1, 1.2 …) som udkast.
 */
export function useSaveComplianceDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      doc,
      contentMd,
      changeNote,
    }: {
      doc: ComplianceDocumentWithVersions;
      contentMd: string;
      changeNote: string;
    }) => {
      if (doc.pending) {
        const { error } = await supabase
          .from("compliance_document_versions")
          .update({ content_md: contentMd, change_note: changeNote })
          .eq("id", doc.pending.id);
        if (error) throw error;
        return;
      }
      const latest = doc.versions[0];
      const { error } = await supabase.from("compliance_document_versions").insert({
        document_id: doc.id,
        version_major: latest?.version_major ?? 1,
        version_minor: latest ? latest.version_minor + 1 : 0,
        content_md: contentMd,
        change_note: changeNote,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
