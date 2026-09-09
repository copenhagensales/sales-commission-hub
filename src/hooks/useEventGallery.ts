import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const BUCKET = "event-photos";

export interface EventGalleryPhoto {
  id: string;
  storage_path: string;
  title: string | null;
  event_date: string | null;
  sort_order: number;
  created_at: string;
  url: string | null;
}

/** Billeder til "Seneste event"-galleriet på forsiden. */
export function useEventGalleryPhotos(limit = 5) {
  return useQuery({
    queryKey: ["event-gallery-photos", limit],
    queryFn: async (): Promise<EventGalleryPhoto[]> => {
      const { data, error } = await supabase
        .from("event_gallery_photos")
        .select("id, storage_path, title, event_date, sort_order, created_at")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      const rows = data || [];
      if (rows.length === 0) return [];

      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(
          rows.map((r) => r.storage_path),
          60 * 60
        );

      return rows.map((row, index) => ({
        ...row,
        url: signed?.[index]?.signedUrl ?? null,
      }));
    },
    staleTime: 300000,
  });
}

/** Må den aktuelle bruger administrere galleriet (ejer, superadmin eller teamleder). */
export function useCanManageEventGallery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["can-manage-event-gallery", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase.rpc("can_manage_event_gallery", {
        _user_id: user.id,
      });
      if (error) throw error;
      return !!data;
    },
    enabled: !!user?.id,
    staleTime: 300000,
  });
}

export function useUploadEventPhotos() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      files,
      title,
      eventDate,
    }: {
      files: File[];
      title?: string;
      eventDate?: string;
    }) => {
      for (const file of files) {
        const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;

        const { error: insertError } = await supabase
          .from("event_gallery_photos")
          .insert({
            storage_path: path,
            title: title?.trim() || null,
            event_date: eventDate || null,
            uploaded_by: user?.id ?? null,
          });
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-gallery-photos"] });
    },
  });
}

export function useDeleteEventPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (photo: { id: string; storage_path: string }) => {
      const { error } = await supabase
        .from("event_gallery_photos")
        .delete()
        .eq("id", photo.id);
      if (error) throw error;
      await supabase.storage.from(BUCKET).remove([photo.storage_path]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-gallery-photos"] });
    },
  });
}
