import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TrygReviewStatus = "approved" | "rejected";

export interface TrygSaleReview {
  saleItemId: string;
  status: TrygReviewStatus;
  reviewedByName: string | null;
  reviewedAt: string;
}

/**
 * Statusser (godkendt/afvist) for Tryg Kanvas-salgslinjer.
 * Statussen ligger i `tryg_sale_reviews` og påvirker ikke salget selv.
 */
export function useTrygSaleReviews(saleItemIds: string[], enabled = true) {
  const ids = [...saleItemIds].sort();

  return useQuery({
    queryKey: ["tryg-sale-reviews", ids.join(",")],
    enabled: enabled && ids.length > 0,
    queryFn: async (): Promise<Map<string, TrygSaleReview>> => {
      const { data, error } = await supabase
        .from("tryg_sale_reviews")
        .select("sale_item_id, status, reviewed_by_name, reviewed_at")
        .in("sale_item_id", ids);
      if (error) throw error;

      const map = new Map<string, TrygSaleReview>();
      for (const row of data || []) {
        map.set(row.sale_item_id, {
          saleItemId: row.sale_item_id,
          status: row.status as TrygReviewStatus,
          reviewedByName: row.reviewed_by_name,
          reviewedAt: row.reviewed_at,
        });
      }
      return map;
    },
  });
}

/** Navnet på den aktuelle bruger, til visning i status-fanerne. */
async function currentReviewer(): Promise<{ id: string | null; name: string | null }> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return { id: null, name: null };

  const { data: employee } = await supabase
    .from("employee_master_data")
    .select("first_name, last_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const name = [employee?.first_name, employee?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return { id: user.id, name: name || user.email || null };
}

/** Sætter status på en eller flere salgslinjer (upsert). */
export function useSetTrygSaleReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      saleItemIds,
      status,
    }: {
      saleItemIds: string[];
      status: TrygReviewStatus;
    }) => {
      if (saleItemIds.length === 0) return;
      const reviewer = await currentReviewer();
      const rows = saleItemIds.map((id) => ({
        sale_item_id: id,
        status,
        reviewed_by: reviewer.id,
        reviewed_by_name: reviewer.name,
        reviewed_at: new Date().toISOString(),
      }));
      const { error } = await supabase
        .from("tryg_sale_reviews")
        .upsert(rows, { onConflict: "sale_item_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tryg-sale-reviews"] });
    },
  });
}

/** Fjerner statussen, så linjen igen ligger under Gennemgang. */
export function useClearTrygSaleReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (saleItemIds: string[]) => {
      if (saleItemIds.length === 0) return;
      const { error } = await supabase
        .from("tryg_sale_reviews")
        .delete()
        .in("sale_item_id", saleItemIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tryg-sale-reviews"] });
    },
  });
}
