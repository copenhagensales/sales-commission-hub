import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ComplianceAreaReview {
  id: string;
  area_key: string;
  reviewed_at: string;
  reviewed_by_name: string | null;
  note: string | null;
}

/** Alle bekræftede gennemgange, nyeste først. */
export function useComplianceAreaReviews() {
  return useQuery({
    queryKey: ["compliance-area-reviews"],
    queryFn: async (): Promise<ComplianceAreaReview[]> => {
      const { data, error } = await supabase
        .from("compliance_area_reviews")
        .select("id, area_key, reviewed_at, reviewed_by_name, note")
        .order("reviewed_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 60000,
  });
}

/** Bekræft at et compliance-område er gennemgået i dag. */
export function useConfirmComplianceReview() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ areaKey, note }: { areaKey: string; note?: string }) => {
      if (!user?.id) throw new Error("Ingen aktiv bruger");

      const { data: employee } = await supabase
        .from("employee_master_data")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();

      const name =
        employee?.full_name ||
        (user.user_metadata?.full_name as string | undefined) ||
        user.email ||
        null;

      const { error } = await supabase.from("compliance_area_reviews").insert({
        area_key: areaKey,
        reviewed_by: user.id,
        reviewed_by_name: name,
        note: note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance-area-reviews"] });
    },
  });
}
