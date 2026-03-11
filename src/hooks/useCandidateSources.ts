import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCandidateSources() {
  const queryClient = useQueryClient();

  const { data: sources = [] } = useQuery({
    queryKey: ["candidate-sources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidate_sources")
        .select("id, label")
        .order("label");
      if (error) throw error;
      return data;
    },
  });

  const addSourceMutation = useMutation({
    mutationFn: async (label: string) => {
      const { data, error } = await supabase
        .from("candidate_sources")
        .insert({ label: label.trim() })
        .select("id, label")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidate-sources"] });
    },
  });

  return { sources, addSourceMutation };
}
