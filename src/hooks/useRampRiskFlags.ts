import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Fareflag for nye saelgere — udelukkende lederrettet.
 *
 * Adgangen haandhaeves i databasen (RLS + SECURITY DEFINER), og en saelger kan
 * aldrig se sit eget flag. Denne hook bruges kun til at vise data i lederens
 * brugerflade.
 */

export const RAMP_FLAG_ACTION_TYPES = [
  "1-1 samtale",
  "medlyt med feedback",
  "ny leadbatch",
  "samtale med salgschef",
  "ingen handling",
] as const;

export type RampFlagActionType = (typeof RAMP_FLAG_ACTION_TYPES)[number];

export interface RampFlagAction {
  action_type: RampFlagActionType;
  performed_at: string;
  performed_by_name: string | null;
}

export interface RampRiskFlag {
  id: string;
  employee_id: string;
  employee_name: string;
  campaign_name: string | null;
  day_no: number;
  cum_sales: number;
  threshold_value: number;
  typical_upper: number | null;
  typical_median: number | null;
  created_at: string;
  days_open: number;
  actions: RampFlagAction[];
}

export interface RampRiskSettings {
  risk_factor: number;
  basis_sellers: number;
  basis_leavers: number;
  basis_campaign_label: string;
}

export function useCanViewRampRiskFlags() {
  return useQuery({
    queryKey: ["can-view-ramp-risk-flags"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("can_view_ramp_risk_flags");
      if (error) return false;
      return data === true;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useRampRiskSettings() {
  return useQuery({
    queryKey: ["ramp-risk-settings"],
    queryFn: async (): Promise<RampRiskSettings | null> => {
      const { data, error } = await supabase
        .from("ramp_risk_settings")
        .select("risk_factor, basis_sellers, basis_leavers, basis_campaign_label")
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useRampRiskFlags() {
  return useQuery({
    queryKey: ["ramp-risk-flags"],
    queryFn: async (): Promise<RampRiskFlag[]> => {
      const { data, error } = await supabase.rpc("get_ramp_risk_flags");
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as unknown as RampRiskFlag[];
    },
    staleTime: 60_000,
  });
}

async function currentEmployeeId(): Promise<string> {
  const { data, error } = await supabase.rpc("get_current_employee_id");
  if (error) throw error;
  if (!data) throw new Error("Din bruger er ikke koblet til et medarbejderkort");
  return data as string;
}

export function useLogRampFlagAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { flagId: string; actionType: RampFlagActionType }) => {
      const performedBy = await currentEmployeeId();
      const { error } = await supabase.from("ramp_flag_action").insert({
        flag_id: params.flagId,
        action_type: params.actionType,
        performed_by: performedBy,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ramp-risk-flags"] });
      toast.success("Handling registreret");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Kunne ikke registrere handlingen");
    },
  });
}

export function useCloseRampFlag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (flagId: string) => {
      const closedBy = await currentEmployeeId();
      const { error } = await supabase
        .from("ramp_risk_flag")
        .update({
          status: "closed",
          closed_at: new Date().toISOString(),
          closed_by: closedBy,
        })
        .eq("id", flagId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ramp-risk-flags"] });
      toast.success("Flaget er lukket");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Kunne ikke lukke flaget");
    },
  });
}
