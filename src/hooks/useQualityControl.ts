import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Kvalitetsmodulet (version 1.0).
 *
 * Alle kontroller er uforanderlige rækker i quality_reviews — en ny kontrol af
 * samme salg giver en ny række. Resultatet udledes af tjeklistepunkterne og
 * påvirker IKKE provision, løn, annullering eller pricing.
 *
 * Adgang håndhæves i databasen (RLS + SECURITY DEFINER RPC'er). Sælgere har
 * ingen adgang til kontroller, status eller kommentarer.
 */

export type QualityItemType = "obligatorisk" | "kvalitet";
export type QualityItemState = "ok" | "mangler" | "ikke_relevant";
export type QualityResult = "godkendt" | "godkendt_med_bemaerkning" | "afvist";
export type QualityStatus = QualityResult | "ikke_kontrolleret";

export interface QualityQueueRow {
  sale_id: string;
  sale_datetime: string | null;
  sale_date: string;
  client_campaign_id: string | null;
  campaign_name: string | null;
  employee_id: string | null;
  seller_name: string | null;
  team_id: string | null;
  team_name: string | null;
  search_key: string | null;
  search_key_type: string | null;
  is_cancelled: boolean;
  status: QualityStatus;
  last_review_id: string | null;
  last_reviewed_at: string | null;
}

export interface QualityChecklistItem {
  id: string;
  checklist_id: string;
  label: string;
  guidance: string | null;
  item_type: QualityItemType;
  sort_order: number;
  is_active: boolean;
}

export interface QualityErrorCode {
  id: string;
  code: string;
  label: string;
  item_type: QualityItemType;
  is_active: boolean;
  sort_order: number;
}

export interface QualityPeriodStats {
  total_sales: number;
  reviewed: number;
  rejected: number;
  remarked: number;
}

type PeriodKey = "day" | "prev_day" | "d30" | "prev_d30";

export interface QualityOverview {
  date: string;
  teams: Array<{
    team_id: string | null;
    team_name: string | null;
    stats: Partial<Record<PeriodKey, QualityPeriodStats>>;
  }>;
  totals: Partial<Record<PeriodKey, QualityPeriodStats>>;
  sellers: Array<{
    employee_id: string;
    seller_name: string | null;
    team_id: string | null;
    stats: Partial<Record<PeriodKey, QualityPeriodStats>>;
  }>;
  error_codes: Array<{
    code: string;
    label: string;
    item_type: QualityItemType;
    counts: Partial<Record<PeriodKey, number>>;
  }>;
}

export interface QualityReviewerStats {
  date: string;
  daily_goal: number;
  me: {
    reviewer_employee_id?: string;
    today_count?: number;
    avg_secs_today?: number | null;
    avg_secs_30d?: number | null;
    count_30d?: number;
  };
  my_daily: Array<{ date: string; count: number }>;
  reviewers: Array<{
    employee_id: string;
    name: string | null;
    today_count: number;
    avg_secs_today: number | null;
    avg_secs_30d: number | null;
    count_30d: number;
  }>;
}

/** Udleder resultatet af tjeklistens tilstande. Aldrig valgt manuelt. */
export function deriveQualityResult(
  items: Array<{ item_type: QualityItemType; state: QualityItemState }>,
): QualityResult {
  const missingRequired = items.some(
    (i) => i.item_type === "obligatorisk" && i.state === "mangler",
  );
  if (missingRequired) return "afvist";
  const missingQuality = items.some(
    (i) => i.item_type === "kvalitet" && i.state === "mangler",
  );
  return missingQuality ? "godkendt_med_bemaerkning" : "godkendt";
}

export const QUALITY_RESULT_LABEL: Record<QualityStatus, string> = {
  ikke_kontrolleret: "Ikke kontrolleret",
  godkendt: "Godkendt",
  godkendt_med_bemaerkning: "Godkendt m. bemærkning",
  afvist: "Afvist",
};

/** Adgang til modulet. */
export function useQualityAccess() {
  const { user, loading } = useAuth();

  const access = useQuery({
    queryKey: ["quality-access", user?.id],
    queryFn: async () => {
      const [module, controller, superadmin] = await Promise.all([
        supabase.rpc("quality_has_module_access"),
        supabase.rpc("is_quality_controller"),
        supabase.rpc("am_i_superadmin"),
      ]);
      return {
        hasAccess: module.data === true,
        isController: controller.data === true,
        isSuperadmin: superadmin.data === true,
      };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  return {
    hasAccess: access.data?.hasAccess === true,
    isController: access.data?.isController === true,
    isSuperadmin: access.data?.isSuperadmin === true,
    isLoading: loading || (!!user?.id && access.isLoading),
  };
}

/** Dagens kontrolkø. Flere datoer bruges mandag (fredag, lørdag, søndag). */
export function useQualityQueue(dates: string[], enabled = true) {
  return useQuery({
    queryKey: ["quality-queue", dates],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_quality_queue", {
        p_dates: dates,
      });
      if (error) throw error;
      return (data ?? []) as unknown as QualityQueueRow[];
    },
    enabled: enabled && dates.length > 0,
    staleTime: 30 * 1000,
  });
}

export function useQualityOverview(date: string, enabled = true) {
  return useQuery({
    queryKey: ["quality-overview", date],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_quality_overview", {
        p_date: date,
      });
      if (error) throw error;
      return data as unknown as QualityOverview;
    },
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useQualityReviewerStats(date: string, enabled = true) {
  return useQuery({
    queryKey: ["quality-reviewer-stats", date],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_quality_reviewer_stats", {
        p_date: date,
      });
      if (error) throw error;
      return data as unknown as QualityReviewerStats;
    },
    enabled,
    staleTime: 60 * 1000,
  });
}

/** Aktiv tjekliste (nyeste version) for en kampagne, med fallback til den generelle. */
export function useQualityChecklist(campaignId: string | null | undefined) {
  return useQuery({
    queryKey: ["quality-checklist", campaignId ?? "global"],
    queryFn: async () => {
      const { data: lists, error } = await supabase
        .from("quality_checklists")
        .select("id, client_campaign_id, name, version, valid_from, is_active")
        .eq("is_active", true)
        .order("version", { ascending: false });
      if (error) throw error;

      const forCampaign = (lists ?? []).find(
        (l) => campaignId && l.client_campaign_id === campaignId,
      );
      const fallback = (lists ?? []).find((l) => l.client_campaign_id === null);
      const checklist = forCampaign ?? fallback;
      if (!checklist) return null;

      const { data: items, error: itemsError } = await supabase
        .from("quality_checklist_items")
        .select("id, checklist_id, label, guidance, item_type, sort_order, is_active")
        .eq("checklist_id", checklist.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (itemsError) throw itemsError;

      return {
        checklist,
        items: (items ?? []) as QualityChecklistItem[],
      };
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useQualityErrorCodes() {
  return useQuery({
    queryKey: ["quality-error-codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quality_error_codes")
        .select("id, code, label, item_type, is_active, sort_order")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as QualityErrorCode[];
    },
    staleTime: 10 * 60 * 1000,
  });
}

export interface SaveQualityReviewInput {
  sale: QualityQueueRow;
  checklistId: string;
  checklistVersion: number;
  items: Array<{
    checklist_item_id: string;
    item_type: QualityItemType;
    state: QualityItemState;
  }>;
  errorCodeIds: string[];
  comment: string;
  startedAt: string;
}

/**
 * Gemmer en kontrol i én arbejdsgang via save_quality_review, så kontrol,
 * tjeklistepunkter og fejlkoder ikke kan ende halvt gemt. Resultatet udledes i
 * databasen ud fra tjeklisten. Ved Afvist sendes straks-mail til teamleder.
 */
export function useSaveQualityReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveQualityReviewInput) => {
      const { data, error } = await supabase.rpc("save_quality_review", {
        p_sale_id: input.sale.sale_id,
        p_sale_datetime: input.sale.sale_datetime,
        p_sale_date: input.sale.sale_date,
        p_client_campaign_id: input.sale.client_campaign_id,
        p_employee_id: input.sale.employee_id,
        p_seller_name: input.sale.seller_name,
        p_team_id: input.sale.team_id,
        p_team_name: input.sale.team_name,
        p_search_key: input.sale.search_key,
        p_checklist_id: input.checklistId,
        p_checklist_version: input.checklistVersion,
        p_items: input.items.map((i) => ({
          checklist_item_id: i.checklist_item_id,
          state: i.state,
        })),
        p_error_code_ids: input.errorCodeIds,
        p_comment: input.comment,
        p_started_at: input.startedAt,
      });
      if (error) throw error;

      const saved = data as unknown as { review_id: string; result: QualityResult };

      if (saved.result === "afvist") {
        await supabase.functions.invoke("quality-mails", {
          body: { action: "rejected_review", review_id: saved.review_id },
        });
      }

      return { reviewId: saved.review_id, result: saved.result };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quality-queue"] });
      queryClient.invalidateQueries({ queryKey: ["quality-overview"] });
      queryClient.invalidateQueries({ queryKey: ["quality-reviewer-stats"] });
    },
  });
}

/** "Færdig for i dag" — kan kun bruges én gang pr. dag. */
export function useQualityDailyCompletion(date: string) {
  return useQuery({
    queryKey: ["quality-daily-completion", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quality_daily_completions")
        .select("id, completion_date, completed_at, reviewed_count")
        .eq("completion_date", date)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 30 * 1000,
  });
}

export function useFinishQualityDay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (date: string) => {
      const { data, error } = await supabase.functions.invoke("quality-mails", {
        body: { action: "daily_summary", date },
      });
      if (error) throw error;
      return data as { already_done?: boolean; leaders?: number; management?: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quality-daily-completion"] });
      queryClient.invalidateQueries({ queryKey: ["quality-mail-log"] });
    },
  });
}

// ==================== Administration (superadmin) ====================

export function useQualityControllers() {
  return useQuery({
    queryKey: ["quality-controllers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quality_controllers")
        .select("id, employee_id, is_active, daily_goal, notes, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useQualitySettings() {
  return useQuery({
    queryKey: ["quality-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quality_settings")
        .select("id, daily_goal, min_reviews_for_percentage")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateQualitySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; daily_goal: number }) => {
      const { error } = await supabase
        .from("quality_settings")
        .update({ daily_goal: input.daily_goal })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quality-settings"] });
      queryClient.invalidateQueries({ queryKey: ["quality-reviewer-stats"] });
    },
  });
}

export function useSetQualityController() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { employee_id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("quality_controllers")
        .upsert(
          { employee_id: input.employee_id, is_active: input.is_active },
          { onConflict: "employee_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quality-controllers"] });
      queryClient.invalidateQueries({ queryKey: ["quality-access"] });
    },
  });
}

export function useUpsertQualityErrorCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      code: string;
      label: string;
      item_type: QualityItemType;
      is_active: boolean;
      sort_order: number;
    }) => {
      if (input.id) {
        const { error } = await supabase
          .from("quality_error_codes")
          .update({
            code: input.code,
            label: input.label,
            item_type: input.item_type,
            is_active: input.is_active,
            sort_order: input.sort_order,
          })
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("quality_error_codes").insert({
          code: input.code,
          label: input.label,
          item_type: input.item_type,
          is_active: input.is_active,
          sort_order: input.sort_order,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quality-error-codes"] });
    },
  });
}

/** Alle tjeklister med punkter, til administrationssiden. */
export function useQualityChecklistsAdmin() {
  return useQuery({
    queryKey: ["quality-checklists-admin"],
    queryFn: async () => {
      const { data: lists, error } = await supabase
        .from("quality_checklists")
        .select("id, client_campaign_id, name, version, valid_from, is_active, created_at")
        .order("version", { ascending: false });
      if (error) throw error;

      const { data: items, error: itemsError } = await supabase
        .from("quality_checklist_items")
        .select("id, checklist_id, label, guidance, item_type, sort_order, is_active")
        .order("sort_order", { ascending: true });
      if (itemsError) throw itemsError;

      const { data: campaigns } = await supabase
        .from("client_campaigns")
        .select("id, name");

      return {
        lists: lists ?? [],
        items: (items ?? []) as QualityChecklistItem[],
        campaigns: campaigns ?? [],
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Ny version af en tjekliste. Den gamle version deaktiveres, men slettes ikke,
 * så tidligere kontroller fortsat peger på deres egen version.
 */
export function useCreateChecklistVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      previousChecklistId: string;
      clientCampaignId: string | null;
      name: string;
      items: Array<{
        label: string;
        guidance: string | null;
        item_type: QualityItemType;
        sort_order: number;
        is_active: boolean;
      }>;
    }) => {
      const { data: prev, error: prevError } = await supabase
        .from("quality_checklists")
        .select("version")
        .eq("id", input.previousChecklistId)
        .single();
      if (prevError) throw prevError;

      const { data: created, error } = await supabase
        .from("quality_checklists")
        .insert({
          client_campaign_id: input.clientCampaignId,
          name: input.name,
          version: (prev.version ?? 1) + 1,
          valid_from: new Date().toISOString().slice(0, 10),
          is_active: true,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (input.items.length > 0) {
        const { error: itemsError } = await supabase
          .from("quality_checklist_items")
          .insert(
            input.items.map((i) => ({ ...i, checklist_id: created.id })),
          );
        if (itemsError) throw itemsError;
      }

      const { error: deactivateError } = await supabase
        .from("quality_checklists")
        .update({ is_active: false })
        .eq("id", input.previousChecklistId);
      if (deactivateError) throw deactivateError;

      return created.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quality-checklists-admin"] });
      queryClient.invalidateQueries({ queryKey: ["quality-checklist"] });
    },
  });
}
