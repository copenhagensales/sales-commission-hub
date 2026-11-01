import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type PricingAdjustmentRow = Database["public"]["Tables"]["pricing_adjustment_rules"]["Row"] & {
  clients: { name: string } | null;
};

const KEY = ["pricing-adjustment-rules"];

export function usePricingAdjustments() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pricing_adjustment_rules")
        .select("*, clients(name)")
        .order("priority", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PricingAdjustmentRow[];
    },
  });
}

export function useAdjustmentProductNames(ids: string[]) {
  return useQuery({
    queryKey: ["pricing-adjustment-products", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name").in("id", ids);
      if (error) throw error;
      return new Map((data ?? []).map((p) => [p.id, p.name]));
    },
  });
}

export function useToggleAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    retry: 0,
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.from("pricing_adjustment_rules").update({ is_active: isActive }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
