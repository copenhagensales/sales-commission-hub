import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const BUCKET = "client-agreements";

export type ClientAgreementType = "dpa" | "contract";

export interface ClientAgreementDocument {
  id: string;
  client_id: string;
  doc_type: ClientAgreementType;
  file_name: string;
  storage_path: string;
  file_size: number | null;
  content_type: string | null;
  note: string | null;
  created_at: string;
}

export interface ComplianceClient {
  id: string;
  name: string;
}

/** Kunder til visning af aftale-bokse. */
export function useComplianceClients() {
  return useQuery({
    queryKey: ["compliance-clients"],
    queryFn: async (): Promise<ComplianceClient[]> => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    staleTime: 300000,
  });
}

/** Arkiverede kundeaftaler (DPA og kontrakt) pr. kunde. */
export function useClientAgreementDocuments() {
  return useQuery({
    queryKey: ["client-agreement-documents"],
    queryFn: async (): Promise<ClientAgreementDocument[]> => {
      const { data, error } = await supabase
        .from("client_agreement_documents")
        .select(
          "id, client_id, doc_type, file_name, storage_path, file_size, content_type, note, created_at"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ClientAgreementDocument[];
    },
    staleTime: 60000,
  });
}

export function useUploadClientAgreement() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      clientId,
      docType,
      file,
    }: {
      clientId: string;
      docType: ClientAgreementType;
      file: File;
    }) => {
      const extension = file.name.split(".").pop()?.toLowerCase() || "pdf";
      const path = `${clientId}/${docType}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from("client_agreement_documents")
        .insert({
          client_id: clientId,
          doc_type: docType,
          file_name: file.name,
          storage_path: path,
          file_size: file.size,
          content_type: file.type || null,
          uploaded_by: user?.id ?? null,
        });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-agreement-documents"] });
    },
  });
}

export function useDeleteClientAgreement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (doc: { id: string; storage_path: string }) => {
      const { error } = await supabase
        .from("client_agreement_documents")
        .delete()
        .eq("id", doc.id);
      if (error) throw error;
      await supabase.storage.from(BUCKET).remove([doc.storage_path]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-agreement-documents"] });
    },
  });
}

/** Åbner en arkiveret kundeaftale via midlertidigt signeret link. */
export function useOpenClientAgreement() {
  return useMutation({
    mutationFn: async (storagePath: string) => {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(storagePath, 60 * 10);
      if (error) throw error;
      if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
    },
  });
}
