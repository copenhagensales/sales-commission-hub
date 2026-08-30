import { supabase } from "@/integrations/supabase/client";

/**
 * Lønbeløb ligger i `employee_salary_details` — en beskyttet 1:1-tabel på
 * medarbejderen. RLS i databasen afgør hvem der får rækkerne:
 *
 *  - superadmin: alle
 *  - medarbejderen selv: sin egen
 *  - ejer/rekruttering/FM-leder/teamleder: kun medarbejdere der IKKE er
 *    stab, teamleder eller assistent
 *
 * Frontend skal derfor altid kunne håndtere at beløbet mangler (null).
 */
export interface SalaryDetails {
  employee_id: string;
  amount: number | null;
  percentage_rate: number | null;
  minimum_salary: number | null;
  notes: string | null;
}

export interface SalaryDetailsInput {
  amount?: number | null;
  percentage_rate?: number | null;
  minimum_salary?: number | null;
  notes?: string | null;
}

const SALARY_DETAILS_SELECT =
  "employee_id, amount, percentage_rate, minimum_salary, notes";

/** Henter lønbeløb for en liste af medarbejdere. Tomt map hvis intet er tilladt. */
export async function fetchSalaryDetailsMap(
  employeeIds: string[]
): Promise<Map<string, SalaryDetails>> {
  const ids = Array.from(new Set(employeeIds.filter(Boolean)));
  if (ids.length === 0) return new Map();

  const { data, error } = await supabase
    .from("employee_salary_details")
    .select(SALARY_DETAILS_SELECT)
    .in("employee_id", ids);

  // RLS-afvisning må ikke vælte siden — lønnen vises blot ikke.
  if (error) return new Map();

  return new Map(
    (data ?? []).map((row) => [
      row.employee_id,
      {
        employee_id: row.employee_id,
        amount: row.amount === null ? null : Number(row.amount),
        percentage_rate:
          row.percentage_rate === null ? null : Number(row.percentage_rate),
        minimum_salary:
          row.minimum_salary === null ? null : Number(row.minimum_salary),
        notes: row.notes ?? null,
      },
    ])
  );
}

/** Henter lønbeløb for én medarbejder (null hvis skjult eller ikke sat). */
export async function fetchSalaryDetails(
  employeeId: string | null | undefined
): Promise<SalaryDetails | null> {
  if (!employeeId) return null;
  const map = await fetchSalaryDetailsMap([employeeId]);
  return map.get(employeeId) ?? null;
}

/** Beriger medarbejderrækker med `salary_amount`, så visninger kan bruges uændret. */
export async function attachSalaryAmount<T extends { id: string }>(
  employees: T[]
): Promise<(T & { salary_amount: number | null })[]> {
  const map = await fetchSalaryDetailsMap(employees.map((e) => e.id));
  return employees.map((emp) => ({
    ...emp,
    salary_amount: map.get(emp.id)?.amount ?? null,
  }));
}

/** Gemmer lønbeløb. Databasen afviser, hvis brugeren ikke må rette lønnen. */
export async function saveSalaryDetails(
  employeeId: string,
  values: SalaryDetailsInput
): Promise<void> {
  // Kun de felter der faktisk sendes med bliver rørt — så et beløb-update
  // ikke nulstiller procentsats/minimumsløn/note.
  const payload: Record<string, unknown> = { employee_id: employeeId };
  if ("amount" in values) payload.amount = values.amount ?? null;
  if ("percentage_rate" in values) payload.percentage_rate = values.percentage_rate ?? null;
  if ("minimum_salary" in values) payload.minimum_salary = values.minimum_salary ?? null;
  if ("notes" in values) payload.notes = values.notes ?? null;

  const { error } = await supabase
    .from("employee_salary_details")
    .upsert(payload as never, { onConflict: "employee_id" });

  if (error) throw error;
}

/** Logger opslag i løndata i `sensitive_data_access_log`. */
export async function logSalaryAccess(
  employeeId: string,
  field = "salary_amount",
  accessType: "view" | "edit" = "view"
): Promise<void> {
  await supabase.rpc("log_salary_access", {
    p_employee_id: employeeId,
    p_field: field,
    p_access_type: accessType,
  });
}
