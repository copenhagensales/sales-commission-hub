import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** 'supplier_invoice' = månedlig leverandørrapport, 'client_week_plan' = ugeplan til kunde. */
export type ReportType = "supplier_invoice" | "client_week_plan";

export interface SupplierReportSubscription {
  id: string;
  name: string | null;
  location_type: string | null;
  report_type: ReportType;
  client_id: string | null;
  cadence: string;
  weekday: number | null;
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

export const WEEKDAY_LABELS: Record<number, string> = {
  1: "Mandag",
  2: "Tirsdag",
  3: "Onsdag",
  4: "Torsdag",
  5: "Fredag",
  6: "Lørdag",
  7: "Søndag",
};

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
        .order("report_type")
        .order("name");
      if (error) throw error;
      return (data ?? []) as SupplierReportSubscription[];
    },
  });
}

/** Kunder til ugeplan-abonnementer. */
export function useReportClients() {
  return useQuery({
    queryKey: ["supplier-report-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

/** Faktiske lokationstyper fra `location` - tomme/blanke filtreres væk. */
export function useSupplierLocationTypes() {
  return useQuery({
    queryKey: ["supplier-report-location-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("location")
        .select("type")
        .not("type", "is", null);
      if (error) throw error;
      const types = new Set<string>();
      for (const row of data ?? []) {
        const value = (row.type ?? "").trim();
        if (value) types.add(value);
      }
      return [...types].sort((a, b) => a.localeCompare(b, "da"));
    },
    staleTime: 5 * 60_000,
  });
}

export function useCreateSupplierReportSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: Partial<SupplierReportSubscription>) => {
      const reportType: ReportType = values.report_type ?? "supplier_invoice";
      const locationType = (values.location_type ?? "").trim();
      if (reportType === "supplier_invoice" && !locationType) {
        throw new Error("Lokationstype mangler");
      }
      if (reportType === "client_week_plan" && (!values.client_id || !values.weekday)) {
        throw new Error("Kunde og ugedag mangler");
      }
      const { data, error } = await supabase
        .from("supplier_report_subscriptions")
        .insert({
          ...values,
          report_type: reportType,
          cadence: reportType === "client_week_plan" ? "weekly" : "monthly",
          location_type: reportType === "supplier_invoice" ? locationType : null,
          client_id: reportType === "client_week_plan" ? values.client_id : null,
          weekday: reportType === "client_week_plan" ? values.weekday : null,
          // Nye abonnementer er altid inaktive indtil modtager er udfyldt og godkendt
          is_active: false,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTIONS_KEY });
      queryClient.invalidateQueries({ queryKey: DISPATCHES_KEY });
    },
  });
}

/**
 * Sletter et abonnement - men bevarer afsendelseshistorik: findes der en
 * dispatch med status 'sent', deaktiveres abonnementet i stedet.
 */
export function useDeleteSupplierReportSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { count, error: countError } = await supabase
        .from("supplier_report_dispatches")
        .select("id", { count: "exact", head: true })
        .eq("subscription_id", id)
        .eq("status", "sent");
      if (countError) throw countError;

      if ((count ?? 0) > 0) {
        const { error } = await supabase
          .from("supplier_report_subscriptions")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
        return { deactivated: true as const, sentCount: count ?? 0 };
      }

      const { error } = await supabase
        .from("supplier_report_subscriptions")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return { deactivated: false as const, sentCount: 0 };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTIONS_KEY });
      queryClient.invalidateQueries({ queryKey: DISPATCHES_KEY });
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

/**
 * Antal udsendelser der venter på handling - bruges til badge i menuen.
 * Kun leverandørrapporter: ugeplaner godkendes ikke.
 */
export function usePendingSupplierDispatchCount(enabled = true) {
  return useQuery({
    queryKey: [...DISPATCHES_KEY, "pending-count"],
    enabled,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("supplier_report_dispatches")
        .select("id, supplier_report_subscriptions!inner(report_type)", {
          count: "exact",
          head: true,
        })
        .eq("supplier_report_subscriptions.report_type", "supplier_invoice")
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

/** Aktive medarbejdere til valg af godkender. */
export function useApproverCandidates() {
  return useQuery({
    queryKey: ["supplier-report-approver-candidates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, work_email, private_email")
        .eq("is_active", true)
        .order("first_name");
      if (error) throw error;
      return (data ?? []).map((e) => ({
        id: e.id,
        name: `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim(),
        email: e.work_email || e.private_email || null,
      }));
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
