import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const BUCKET = "dpa-documents";

export interface DpaDocument {
  id: string;
  vendor: string;
  file_name: string;
  storage_path: string;
  file_size: number | null;
  content_type: string | null;
  note: string | null;
  created_at: string;
}

/** Arkiverede databehandleraftaler pr. leverandør. */
export function useDpaDocuments() {
  return useQuery({
    queryKey: ["dpa-documents"],
    queryFn: async (): Promise<DpaDocument[]> => {
      const { data, error } = await supabase
        .from("dpa_documents")
        .select(
          "id, vendor, file_name, storage_path, file_size, content_type, note, created_at"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 60000,
  });
}

/** Må den aktuelle bruger arkivere aftaler (ejer eller superadmin). */
export function useCanManageDpaDocuments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["can-manage-dpa-documents", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase.rpc("can_manage_dpa_documents", {
        _user_id: user.id,
      });
      if (error) throw error;
      return !!data;
    },
    enabled: !!user?.id,
    staleTime: 300000,
  });
}

export function useUploadDpaDocument() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ vendor, file }: { vendor: string; file: File }) => {
      const extension = file.name.split(".").pop()?.toLowerCase() || "pdf";
      const slug = vendor.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const path = `${slug}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from("dpa_documents")
        .insert({
          vendor,
          file_name: file.name,
          storage_path: path,
          file_size: file.size,
          content_type: file.type || null,
          uploaded_by: user?.id ?? null,
        });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dpa-documents"] });
    },
  });
}

export function useDeleteDpaDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (doc: { id: string; storage_path: string }) => {
      const { error } = await supabase
        .from("dpa_documents")
        .delete()
        .eq("id", doc.id);
      if (error) throw error;
      await supabase.storage.from(BUCKET).remove([doc.storage_path]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dpa-documents"] });
    },
  });
}

/** Åbner en arkiveret aftale via midlertidigt signeret link. */
export function useOpenDpaDocument() {
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
