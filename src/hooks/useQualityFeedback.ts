import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Kvalitetsfeedback til sælger og teamledelse.
 *
 * Læser udelukkende de eksisterende kvalitetstabeller via databasens RPC'er,
 * hvor adgangen håndhæves. Kvalitetsstatus har ingen betydning for provision,
 * løn, afregning, annullering eller andre nøgletal.
 */

export type QualityFeedbackRole = "saelger" | "teamleder" | "assisterende_teamleder";

export interface QualityFeedbackRow {
  review_id: string;
  role: QualityFeedbackRole;
  result: "afvist" | "godkendt_med_bemaerkning";
  sale_id: string;
  employee_id: string | null;
  seller_name: string | null;
  team_id: string | null;
  team_name: string | null;
  campaign_name: string | null;
  occurred_at: string;
  search_key: string | null;
  reason_labels: string[] | null;
  comment: string | null;
  completed_at: string;
}

export interface QualityFeedbackHistoryRow {
  review_id: string;
  result: "afvist" | "godkendt_med_bemaerkning";
  campaign_name: string | null;
  occurred_at: string;
  search_key: string | null;
  reason_labels: string[] | null;
  comment: string | null;
  completed_at: string;
  acknowledged_at: string | null;
}

/**
 * Ukvitterede tilbagemeldinger for den aktuelle bruger — både egne sager som
 * sælger og teamets sager som teamleder/assisterende teamleder. Opdateres live
 * via realtime og som sikkerhedsnet hvert minut.
 */
export function useMyQualityFeedback() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["quality-feedback", "mine"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_quality_feedback");
      if (error) throw error;
      return (data ?? []) as unknown as QualityFeedbackRow[];
    },
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("quality-feedback-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "quality_reviews" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["quality-feedback"] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

/** Kvitterer for en tilbagemelding i den rolle brugeren har på sagen. */
export function useAcknowledgeQualityFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { reviewId: string; role: QualityFeedbackRole }) => {
      const { error } = await supabase.rpc("acknowledge_quality_feedback", {
        p_review_id: input.reviewId,
        p_role: input.role,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quality-feedback"] });
    },
  });
}

/** Permanent historik til profilen — bliver liggende efter kvitteringen. */
export function useQualityFeedbackHistory(employeeId?: string | null) {
  return useQuery({
    queryKey: ["quality-feedback", "history", employeeId ?? "mig"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_quality_feedback_history", {
        p_employee_id: employeeId ?? null,
      });
      if (error) throw error;
      return (data ?? []) as unknown as QualityFeedbackHistoryRow[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
