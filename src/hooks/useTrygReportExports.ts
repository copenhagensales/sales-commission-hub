import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "tryg-report-exports";

/** Udtræk til Tryg-rapporten. Kun superadmin kan læse (RLS på storage). */
export function useTrygReportExports(enabled: boolean) {
  return useQuery({
    queryKey: ["tryg-report-exports"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list("", { sortBy: { column: "created_at", order: "desc" } });
      if (error) throw error;
      return (data ?? []).filter((f) => f.name.endsWith(".xlsx"));
    },
  });
}

export function useDownloadTrygReportExport() {
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(name, 300, { download: name });
      if (error) throw error;
      window.location.assign(data.signedUrl);
    },
  });
}

