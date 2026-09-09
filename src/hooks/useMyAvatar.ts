/**
 * Upload/fjern eget profilbillede.
 * Bruger den eksisterende offentlige bucket "employee-avatars" og
 * employee_master_data.avatar_url - ingen ny datamodel.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function invalidateAvatarCaches(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["my-profile"] });
  queryClient.invalidateQueries({ queryKey: ["employee-avatars-shared"] });
  queryClient.invalidateQueries({ queryKey: ["employee-master-data"] });
}

export function useUploadMyAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ employeeId, file }: { employeeId: string; file: File }) => {
      const fileExt = file.name.split(".").pop();
      const filePath = `avatars/${employeeId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("employee-avatars")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("employee-avatars").getPublicUrl(filePath);

      const { error } = await supabase
        .from("employee_master_data")
        .update({ avatar_url: publicUrl })
        .eq("id", employeeId);
      if (error) throw error;

      return publicUrl;
    },
    onSuccess: () => invalidateAvatarCaches(queryClient),
  });
}

export function useRemoveMyAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (employeeId: string) => {
      const { error } = await supabase
        .from("employee_master_data")
        .update({ avatar_url: null })
        .eq("id", employeeId);
      if (error) throw error;
    },
    onSuccess: () => invalidateAvatarCaches(queryClient),
  });
}
