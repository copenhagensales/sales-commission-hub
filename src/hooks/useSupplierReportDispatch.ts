import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SupplierReportSubscription {
  id: string;
  name: string | null;
  location_type: string;
  recipient_name: string | null;
  recipient_email: string | null;
  cc_emails: string[];
  approver_employee_id: string | null;
  send_day: number;
  send_hour: number;
  period_mode: string;
  attach_xlsx: boolean;
  include_surcharge_summary: boolean;
  is_active: boolean;
  last_run_at: string | null;
}

export interface SupplierReportDispatch {
  id: string;
  subscription_id: string;
  period_start: string;
  period_end: string;
  report_id: string | null;
  status: string;
  approved_at: string | null;
  sent_at: string | null;
  sent_to: string[] | null;
  error_message: string | null;
  reminder_count: number;
  last_reminder_at: string | null;
  created_at: string;
  supplier_report_subscriptions: SupplierReportSubscription | null;
}

const SUBSCRIPTIONS_KEY = ["supplier-report-subscriptions"];
const DISPATCHES_KEY = ["supplier-report-dispatches"];

export function useSupplierReportSubscriptions() {
  return useQuery({
    queryKey: SUBSCRIPTIONS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_report_subscriptions")
        .select("*")
        .order("location_type");
      if (error) throw error;
      return (data ?? []) as SupplierReportSubscription[];
    },
  });
}

export function useUpdateSupplierReportSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: Partial<SupplierReportSubscription>;
    }) => {
      const { error } = await supabase
        .from("supplier_report_subscriptions")
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTIONS_KEY });
      queryClient.invalidateQueries({ queryKey: DISPATCHES_KEY });
    },
  });
}

export function useSupplierReportDispatches(options?: { pendingOnly?: boolean }) {
  const pendingOnly = options?.pendingOnly ?? false;
  return useQuery({
    queryKey: [...DISPATCHES_KEY, pendingOnly],
    queryFn: async () => {
      let query = supabase
        .from("supplier_report_dispatches")
        .select("*, supplier_report_subscriptions(*)")
        .order("period_start", { ascending: false });
      if (pendingOnly) {
        query = query.in("status", ["pending_approval", "approved", "failed"]);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as SupplierReportDispatch[];
    },
  });
}

/** Antal udsendelser der venter på handling - bruges til badge i menuen. */
export function usePendingSupplierDispatchCount(enabled = true) {
  return useQuery({
    queryKey: [...DISPATCHES_KEY, "pending-count"],
    enabled,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("supplier_report_dispatches")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending_approval", "approved", "failed"]);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 60_000,
  });
}

/** Godkendt rapport for en given leverandør og periode (kilden til tallene). */
export function useApprovedReportForPeriod(
  locationType: string | undefined,
  periodStart: string | undefined,
) {
  return useQuery({
    queryKey: ["supplier-approved-report", locationType, periodStart],
    enabled: !!locationType && !!periodStart,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_invoice_reports")
        .select("id, status, total_amount, final_amount")
        .eq("location_type", locationType!)
        .eq("period_start", periodStart!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useApproveDispatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      dispatchId,
      reportId,
    }: {
      dispatchId: string;
      reportId: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("supplier_report_dispatches")
        .update({
          status: "approved",
          report_id: reportId,
          approved_by: userData.user?.id ?? null,
          approved_at: new Date().toISOString(),
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", dispatchId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DISPATCHES_KEY });
    },
  });
}

export function useSendDispatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dispatchId: string) => {
      const { data, error } = await supabase.functions.invoke(
        "send-supplier-report",
        { body: { dispatch_id: dispatchId } },
      );
      if (error) throw error;
      if ((data as { error?: string })?.error) {
        throw new Error((data as { error: string }).error);
      }
      return data as { recipients: string[]; attachmentName: string | null };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DISPATCHES_KEY });
      queryClient.invalidateQueries({ queryKey: ["supplier-report"] });
    },
  });
}
