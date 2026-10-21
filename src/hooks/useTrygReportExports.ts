import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

/** Engangsudtræk: Hjerteforeningen – lukkede leads (kører edge-funktionen, giver download). */
export function useRunHjerteforeningenExport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("hjerteforeningen-leads-export", { body: {} });
      if (error) throw error;
      return data as { fileName: string; signedUrl: string | null; rows: number };
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["tryg-report-exports"] });
      if (d.signedUrl) window.location.assign(d.signedUrl);
    },
  });
}
