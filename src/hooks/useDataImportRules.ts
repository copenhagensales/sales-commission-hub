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

export function useDataImportDefinitions() {
  return useQuery({
    queryKey: [KEY, "definitions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("data_import_definitions").select("*").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDataImportRules(definitionId: string | null) {
  return useQuery({
    queryKey: [KEY, "detail", definitionId],
    enabled: !!definitionId,
    queryFn: async () => {
      const { data: categories, error: e2 } = await supabase
        .from("data_import_categories").select("*").eq("definition_id", definitionId!).order("name");
      if (e2) throw e2;
      const { data: rules, error } = await supabase
        .from("data_import_column_rules").select("*").eq("definition_id", definitionId!).order("column_name");
      if (error) throw error;
      return { categories: categories ?? [], rules: rules ?? [] };
    },
  });
}

export function useCreateDefinition() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (d: { name: string; client_id: string | null; description: string | null }) => {
      const key = d.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") + "_" + Date.now().toString(36);
      const { data, error } = await supabase.from("data_import_definitions")
        .insert({ key, name: d.name.trim(), client_id: d.client_id, description: d.description })
        .select("id").single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: inv,
    onError: (err: Error) => toast({ title: "Fejl", description: err.message, variant: "destructive" }),
  });
}

export function useClientOptions() {
  return useQuery({
    queryKey: ["clients-options"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
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
    mutationFn: async (c: { id?: string; definition_id: string; name: string; description: string | null; retention_days: number | null }) => {
      const payload = { definition_id: c.definition_id, name: c.name.trim(), description: c.description, retention_days: c.retention_days, updated_at: new Date().toISOString() };
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

/**
 * Henter definerede kolonner og kolonner som produktbetingelserne bruger for en kunde.
 * Bruges af annulleringsuploaden lige før data gemmes.
 */
export async function fetchUploadFilterSets(definitionKey: string, clientId: string) {
  const { data: def, error } = await supabase
    .from("data_import_definitions").select("id").eq("key", definitionKey).maybeSingle();
  if (error) throw error;
  const defined = new Set<string>();
  if (def) {
    const { data: rules, error: e2 } = await supabase
      .from("data_import_column_rules").select("column_name, category_id").eq("definition_id", def.id);
    if (e2) throw e2;
    for (const r of rules ?? []) if (r.category_id) defined.add(normalizeColumnName(r.column_name));
  }
  const { data: conds, error: e3 } = await supabase
    .from("cancellation_product_conditions").select("column_name").eq("client_id", clientId);
  if (e3) throw e3;
  const conditionCols = (conds ?? []).map((c) => normalizeColumnName(c.column_name));
  return { defined, conditionCols, hasDefinition: !!def && defined.size > 0 };
}
