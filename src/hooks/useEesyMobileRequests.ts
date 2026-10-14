import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";

export type EesyMobileRequest = Database["public"]["Tables"]["eesy_mobile_requests"]["Row"];

const SUBS_KEY = ["eesy-mobile-subscriptions"];
const MINE_KEY = ["eesy-mobile-request-mine"];
const ALL_KEY = ["eesy-mobile-requests"];

/** Abonnementerne defineres kun i databasen (eesy_mobile_subscriptions). */
export function useEesyMobileSubscriptions() {
  return useQuery({
    queryKey: SUBS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("eesy_mobile_subscriptions");
      if (error) throw error;
      return (data ?? []) as string[];
    },
    staleTime: 60 * 60 * 1000,
  });
}

export function useMyEesyMobileRequest() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...MINE_KEY, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_eesy_mobile_request");
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!user?.id,
  });
}

export interface EesyMobileSubmitInput {
  subscription: string;
  fullName: string;
  address: string;
  cpr: string;
  phone: string;
  icc: string;
}

export function useSubmitEesyMobileRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: EesyMobileSubmitInput) => {
      const { error } = await supabase.rpc("submit_eesy_mobile_request", {
        _subscription: i.subscription,
        _full_name: i.fullName,
        _address: i.address,
        _cpr: i.cpr,
        _phone: i.phone,
        _icc: i.icc,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MINE_KEY });
      qc.invalidateQueries({ queryKey: ALL_KEY });
    },
  });
}

export function useIsOwner() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["is-owner", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_owner", { _user_id: user!.id });
      if (error) return false;
      return data === true;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
  return q.data === true;
}

/** Kun ejere har adgang (RLS). */
export function useEesyMobileRequests(enabled: boolean) {
  return useQuery({
    queryKey: ALL_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eesy_mobile_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EesyMobileRequest[];
    },
    enabled,
  });
}

export function useSetEesyMobileStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, sent }: { id: string; sent: boolean }) => {
      const { error } = await supabase
        .from("eesy_mobile_requests")
        .update({ status: sent ? "sendt" : "ny", sent_at: sent ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ALL_KEY }),
  });
}

/** Logger visning/eksport af CPR pr. anmodning i sensitive_data_access_log. */
export async function logEesyCprAccess(rows: EesyMobileRequest[], accessType: "view" | "export") {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || rows.length === 0) return;
  await supabase.from("sensitive_data_access_log").insert(
    rows.map((r) => ({
      user_id: user.id,
      employee_id: r.employee_id,
      field_accessed: "eesy_cpr_number",
      access_type: accessType,
    })),
  );
}
