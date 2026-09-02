import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TrygReviewStatus = "approved" | "rejected";

export interface TrygSaleReview {
  saleId: string;
  status: TrygReviewStatus;
  reviewedByName: string | null;
  reviewedAt: string;
}

interface ReviewRow {
  sale_id: string;
  status: string;
  reviewed_by_name: string | null;
  reviewed_at: string;
}

/**
 * Statusser (godkendt/afvist) for Tryg Kanvas-salg.
 * Statussen ligger i `tryg_sale_reviews` og påvirker ikke salget selv.
 * Nøglen er salgets id (`sales.id`), fordi salgslinjer kan genskabes med nye id'er.
 */
export function useTrygSaleReviews(saleIds: string[], enabled = true) {
  const ids = [...saleIds].sort();

  return useQuery({
    queryKey: ["tryg-sale-reviews", ids.join(",")],
    enabled: enabled && ids.length > 0,
    queryFn: async (): Promise<Map<string, TrygSaleReview>> => {
      const { data, error } = await supabase
        .from("tryg_sale_reviews")
        .select("sale_id, status, reviewed_by_name, reviewed_at")
        .in("sale_id", ids)
        .returns<ReviewRow[]>();
      if (error) throw error;

      const map = new Map<string, TrygSaleReview>();
      for (const row of data || []) {
        map.set(row.sale_id, {
          saleId: row.sale_id,
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

/** Sætter status på et eller flere salg (upsert). */
export function useSetTrygSaleReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      saleIds,
      status,
    }: {
      saleIds: string[];
      status: TrygReviewStatus;
    }) => {
      if (saleIds.length === 0) return;
      const reviewer = await currentReviewer();
      const rows = saleIds.map((id) => ({
        sale_id: id,
        status,
        reviewed_by: reviewer.id,
        reviewed_by_name: reviewer.name,
        reviewed_at: new Date().toISOString(),
      }));
      const { error } = await supabase
        .from("tryg_sale_reviews")
        .upsert(rows, { onConflict: "sale_id" });
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
    mutationFn: async (saleIds: string[]) => {
      if (saleIds.length === 0) return;
      const { error } = await supabase
        .from("tryg_sale_reviews")
        .delete()
        .in("sale_id", saleIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tryg-sale-reviews"] });
    },
  });
}
