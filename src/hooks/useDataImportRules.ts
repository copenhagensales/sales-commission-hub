import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "@/hooks/use-toast";
import { normalizeColumnName } from "@/utils/dataImportFilter";

export type DataImportCategory = Database["public"]["Tables"]["data_import_categories"]["Row"];
export type DataImportColumnRule = Database["public"]["Tables"]["data_import_column_rules"]["Row"];
export type DataImportDefinition = Database["public"]["Tables"]["data_import_definitions"]["Row"];

export const EESY_TM_BASKET_KEY = "eesy_tm_basket";
const KEY = "data-import-rules";

export function useDataImportRules(definitionKey: string = EESY_TM_BASKET_KEY) {
  return useQuery({
    queryKey: [KEY, definitionKey],
    queryFn: async () => {
      const { data: def, error: e1 } = await supabase
        .from("data_import_definitions").select("*").eq("key", definitionKey).maybeSingle();
      if (e1) throw e1;
      const { data: categories, error: e2 } = await supabase
        .from("data_import_categories").select("*").order("name");
      if (e2) throw e2;
      let rules: DataImportColumnRule[] = [];
      if (def) {
        const { data, error } = await supabase
          .from("data_import_column_rules").select("*").eq("definition_id", def.id).order("column_name");
        if (error) throw error;
        rules = data ?? [];
      }
      return { definition: def as DataImportDefinition | null, categories: categories ?? [], rules };
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [KEY] });
}

const onError = (err: Error) => toast({ title: "Fejl", description: err.message, variant: "destructive" });

export function useSaveCategory() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (c: { id?: string; name: string; description: string | null; retention_days: number | null }) => {
      const payload = { name: c.name.trim(), description: c.description, retention_days: c.retention_days, updated_at: new Date().toISOString() };
      const { error } = c.id
        ? await supabase.from("data_import_categories").update(payload).eq("id", c.id)
        : await supabase.from("data_import_categories").insert(payload);
      if (error) throw error;
    },
    onSuccess: inv,
    onError,
  });
}

export function useDeleteCategory() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("data_import_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: inv,
    onError,
  });
}

export function useAddColumns() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ definitionId, columns }: { definitionId: string; columns: string[] }) => {
      const rows = [...new Set(columns.map(normalizeColumnName).filter(Boolean))].map((column_name) => ({ definition_id: definitionId, column_name }));
      if (rows.length === 0) return;
      const { error } = await supabase.from("data_import_column_rules")
        .upsert(rows, { onConflict: "definition_id,column_name", ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: inv,
    onError,
  });
}

export function useSetColumnCategory() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, categoryId }: { id: string; categoryId: string | null }) => {
      const { error } = await supabase.from("data_import_column_rules").update({ category_id: categoryId }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: inv,
    onError,
  });
}

export function useDeleteColumn() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("data_import_column_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: inv,
    onError,
  });
}
