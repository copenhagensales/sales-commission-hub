import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Delte tekstskabeloner til rapporter (`report_text_templates`).
 * Læsning for aktive medarbejdere; skrivning håndhæves i databasen via RLS
 * (`can_edit_report_templates`).
 */
export function useReportTextTemplate(key: string, fallback: string) {
  const query = useQuery({
    queryKey: ["report-text-template", key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_text_templates")
        .select("body")
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      return data?.body ?? fallback;
    },
  });

  return {
    body: query.data ?? fallback,
    isLoading: query.isLoading,
  };
}

export function useSaveReportTextTemplate(key: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("report_text_templates")
        .upsert(
          { key, body, updated_by: userData.user?.id ?? null },
          { onConflict: "key" }
        );
      if (error) throw error;
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["report-text-template", key],
      });
    },
  });
}
