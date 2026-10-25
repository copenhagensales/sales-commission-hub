import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";

type T = Database["public"]["Tables"];
export type IfSupplier = T["invoiceflow_suppliers"]["Row"];
export type IfSource = T["invoiceflow_sources"]["Row"];
export type IfSettings = T["invoiceflow_settings"]["Row"];

/** Adgang afgøres af invoiceflow_access i databasen (RLS), ikke af rollenøgler. */
export function useInvoiceflowAccess() {
  const { user, loading } = useAuth();
  const q = useQuery({
    queryKey: ["invoiceflow-access", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("am_i_invoiceflow_user");
      if (error) return false;
      return data === true;
    },
  });
  return { hasAccess: q.data === true, isLoading: loading || (!!user?.id && q.isLoading) };
}

const KEYS = {
  suppliers: ["invoiceflow-suppliers"],
  sources: ["invoiceflow-sources"],
  creds: ["invoiceflow-credentials"],
  jobs: ["invoiceflow-jobs"],
  invoices: ["invoiceflow-invoices"],
  settings: ["invoiceflow-settings"],
  requests: ["invoiceflow-portal-requests"],
};

export function useIfSuppliers() {
  return useQuery({ queryKey: KEYS.suppliers, queryFn: async () => {
    const { data, error } = await supabase.from("invoiceflow_suppliers").select("*").order("name");
    if (error) throw error; return data;
  }});
}
export function useIfSources() {
  return useQuery({ queryKey: KEYS.sources, queryFn: async () => {
    const { data, error } = await supabase.from("invoiceflow_sources").select("*").order("created_at");
    if (error) throw error; return data;
  }});
}
export function useIfCredentialMeta() {
  return useQuery({ queryKey: KEYS.creds, queryFn: async () => {
    const { data, error } = await supabase.from("invoiceflow_credentials").select("id, source_id, field_names, updated_at, last_used_at");
    if (error) throw error; return data;
  }});
}
export function useIfJobs() {
  return useQuery({ queryKey: KEYS.jobs, queryFn: async () => {
    const { data, error } = await supabase.from("invoiceflow_jobs")
      .select("id, kind, period, status, attempt, scheduled_at, next_attempt_at, source_id, runs:invoiceflow_runs(id, started_at, finished_at, result, error_code, error_message, invoices_found)")
      .order("created_at", { ascending: false }).limit(100);
    if (error) throw error; return data;
  }});
}
export function useIfInvoices() {
  return useQuery({ queryKey: KEYS.invoices, queryFn: async () => {
    const { data, error } = await supabase.from("invoiceflow_invoices")
      .select("id, supplier_id, invoice_number, invoice_date, amount_incl_vat, amount_excl_vat, currency, period, status, fetched_by, created_at, deliveries:invoiceflow_deliveries(status, sent_at, attempt)")
      .order("created_at", { ascending: false }).limit(200);
    if (error) throw error; return data;
  }});
}
export function useIfSettings() {
  return useQuery({ queryKey: KEYS.settings, queryFn: async () => {
    const { data, error } = await supabase.from("invoiceflow_settings").select("*").eq("id", true).maybeSingle();
    if (error) throw error; return data;
  }});
}
export function useIfPortalRequests() {
  return useQuery({ queryKey: KEYS.requests, queryFn: async () => {
    const { data, error } = await supabase.from("invoiceflow_portal_requests").select("*").order("created_at", { ascending: false });
    if (error) throw error; return data;
  }});
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => Object.values(KEYS).forEach((k) => qc.invalidateQueries({ queryKey: k }));
}

export function useCreateSupplierWithSource() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (input: {
      supplier: { name: string; cvr: string | null; cadence: string; expected_day: number | null };
      source: { type: "email"; config: Record<string, unknown>; owner_employee_id: string | null };
    }) => {
      const { data: s, error } = await supabase.from("invoiceflow_suppliers").insert(input.supplier).select("id").single();
      if (error) throw error;
      const { error: e2 } = await supabase.from("invoiceflow_sources").insert({ ...input.source, supplier_id: s.id });
      if (e2) throw e2;
    },
    onSuccess: inv,
  });
}

export function useUpdateSource() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (p: { id: string; patch: T["invoiceflow_sources"]["Update"] }) => {
      const { error } = await supabase.from("invoiceflow_sources").update({ ...p.patch, updated_at: new Date().toISOString() }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: inv,
  });
}

export function useUpdateSupplier() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (p: { id: string; patch: T["invoiceflow_suppliers"]["Update"] }) => {
      const { error } = await supabase.from("invoiceflow_suppliers").update({ ...p.patch, updated_at: new Date().toISOString() }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: inv,
  });
}

export function useUpdateIfSettings() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (patch: T["invoiceflow_settings"]["Update"]) => {
      const { error } = await supabase.from("invoiceflow_settings").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", true);
      if (error) throw error;
    },
    onSuccess: inv,
  });
}

export function useAddPortalRequest() {
  const inv = useInvalidate();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (p: { supplier_name: string; portal_url: string | null; note: string | null }) => {
      const { error } = await supabase.from("invoiceflow_portal_requests").insert({ ...p, requested_by: user?.id });
      if (error) throw error;
    },
    onSuccess: inv,
  });
}

type AdminAction =
  | { action: "rerun"; job_id: string }
  | { action: "run_now"; source_id: string }
  | { action: "approve_send"; invoice_id: string }
  | { action: "signed_url"; invoice_id: string }
  | { action: "test"; source_id: string };

export function useInvoiceflowAdmin() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (body: AdminAction) => {
      const { data, error } = await supabase.functions.invoke("invoiceflow-admin", { body });
      if (error) throw error;
      return data as { ok?: boolean; message?: string; url?: string; reason?: string; error?: string };
    },
    onSuccess: inv,
  });
}

/** Write-only: gemmer/sletter login. Returnerer aldrig værdien. */
export function useSaveCredential() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (body: { action: "save"; source_id: string; fields: Record<string, string> } | { action: "delete"; source_id: string }) => {
      const { error } = await supabase.functions.invoke("invoiceflow-credentials", { body });
      if (error) throw error;
    },
    onSuccess: inv,
  });
}
