import { supabase } from "@/integrations/supabase/client";

export type ActivationDateSource = "cohort" | "employee" | "today";

export interface ResolvedActivationDate {
  /** ISO date (YYYY-MM-DD) to prefill in the activation dialog */
  date: string;
  /** Where the prefilled date came from */
  source: ActivationDateSource;
  /** Name of the cohort ("Kommende opstarter") when source === "cohort" */
  cohortName?: string;
}

export function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Single source of truth for "which start date do we suggest when activating?".
 *
 * Priority (Bibel §8 — én sandhed):
 *  1. Start date on the onboarding cohort the employee is a member of
 *     (Kommende opstarter → `onboarding_cohorts.start_date`)
 *  2. The start date already stored on the employee
 *  3. Today
 */
export async function resolveActivationStartDate(
  employeeId: string,
  currentStartDate?: string | null
): Promise<ResolvedActivationDate> {
  const { data, error } = await supabase
    .from("cohort_members")
    .select("cohort:onboarding_cohorts(name, start_date)")
    .eq("employee_id", employeeId);

  if (error) {
    console.error("Kunne ikke hente opstartshold:", error);
  }

  const cohorts = (data ?? [])
    .map((row) => (row as { cohort: { name: string | null; start_date: string | null } | null }).cohort)
    .filter((c): c is { name: string | null; start_date: string | null } => !!c?.start_date)
    .sort((a, b) => (b.start_date! > a.start_date! ? 1 : -1));

  const cohort = cohorts[0];
  if (cohort?.start_date) {
    return { date: cohort.start_date, source: "cohort", cohortName: cohort.name ?? undefined };
  }

  if (currentStartDate) {
    return { date: currentStartDate, source: "employee" };
  }

  return { date: todayIso(), source: "today" };
}

/**
 * Activates an employee with an explicit start date.
 * Never derives the date implicitly — the caller (dialog) decides.
 */
export async function activateEmployee(params: {
  employeeId: string;
  startDate: string;
}): Promise<void> {
  const { employeeId, startDate } = params;

  const { data, error } = await supabase
    .from("employee_master_data")
    .update({
      is_active: true,
      employment_start_date: startDate,
      employment_end_date: null,
    })
    .eq("id", employeeId)
    .select("id");

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Du har ikke rettighed til at ændre denne medarbejder");
  }
}
