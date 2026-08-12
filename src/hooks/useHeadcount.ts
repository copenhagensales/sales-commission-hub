import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HeadcountCurrent {
  /** Aktive medarbejdere der er startet, ekskl. Stab. */
  activeStartedExclStaff: number;
  /** Aktive medarbejdere med opstartsdato i fremtiden, ekskl. Stab. */
  pendingStarts: number;
  /** Aktive Stab/Backoffice-medarbejdere. */
  staffActive: number;
  /** Alle aktive medarbejdere (inkl. Stab og kommende opstarter). */
  activeTotal: number;
  /** Datakvalitet: aktive rækker uden startdato. */
  missingStartDate: number;
  /** Datakvalitet: inaktive rækker uden slutdato. */
  inactiveMissingEndDate: number;
}

export interface HeadcountMonth {
  monthEnd: string;
  headcountExclStaff: number;
  headcountInclStaff: number;
}

/**
 * Nuværende headcount fra én kilde (get_headcount_current).
 * Definition: aktiv = is_active, startet = startdato <= i dag.
 */
export function useHeadcountCurrent(enabled: boolean = true) {
  return useQuery({
    queryKey: ["headcount-current"],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<HeadcountCurrent> => {
      const { data, error } = await supabase.rpc("get_headcount_current");
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return {
        activeStartedExclStaff: row?.active_started_excl_staff ?? 0,
        pendingStarts: row?.pending_starts ?? 0,
        staffActive: row?.staff_active ?? 0,
        activeTotal: row?.active_total ?? 0,
        missingStartDate: row?.missing_start_date ?? 0,
        inactiveMissingEndDate: row?.inactive_missing_end_date ?? 0,
      };
    },
  });
}

/**
 * Headcount pr. måned fra samme kilde (get_headcount_monthly).
 * Nuværende måned skæres pr. dags dato.
 */
export function useHeadcountMonthly(fromDate: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ["headcount-monthly", fromDate],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<HeadcountMonth[]> => {
      const { data, error } = await supabase.rpc("get_headcount_monthly", { p_from: fromDate });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        monthEnd: row.month_end as string,
        headcountExclStaff: row.headcount_excl_staff ?? 0,
        headcountInclStaff: row.headcount_incl_staff ?? 0,
      }));
    },
  });
}
