import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ComplianceState = "missing" | "started_unsigned" | "pending" | "ok" | "rejected";

export interface ContractComplianceRow {
  employee_id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  team_name: string | null;
  employment_start_date: string;
  contract_id: string | null;
  contract_status: string | null;
  contract_title: string | null;
  sent_at: string | null;
  reminder_count: number;
  last_reminder_at: string | null;
  compliance_state: ComplianceState;
}

export const COMPLIANCE_LABELS: Record<ComplianceState, string> = {
  missing: "Ansat uden kontrakt",
  started_unsigned: "Startet uden underskrift",
  pending: "Afventer underskrift",
  ok: "I orden",
  rejected: "Kontrakt afvist",
};

/**
 * Contract compliance overview. Scope (all / own team / self) is enforced
 * server-side by the get_contract_compliance SECURITY DEFINER function.
 */
export function useContractCompliance() {
  const query = useQuery({
    queryKey: ["contract-compliance"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_contract_compliance");
      if (error) throw error;
      return (data ?? []) as unknown as ContractComplianceRow[];
    },
    staleTime: 2 * 60 * 1000,
  });

  const rows = query.data ?? [];

  const counts = {
    missing: rows.filter((r) => r.compliance_state === "missing").length,
    started_unsigned: rows.filter((r) => r.compliance_state === "started_unsigned").length,
    pending: rows.filter((r) => r.compliance_state === "pending").length,
    ok: rows.filter((r) => r.compliance_state === "ok").length,
    rejected: rows.filter((r) => r.compliance_state === "rejected").length,
    total: rows.length,
  };

  return {
    rows,
    counts,
    /** Number of rows that require action from management */
    criticalCount: counts.missing + counts.started_unsigned,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
