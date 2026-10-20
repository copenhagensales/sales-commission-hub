import { supabase } from "@/integrations/supabase/client";

/**
 * Alle kolonner i employee_master_data undtagen de syv følsomme (CPR, bank, privatadresse).
 * De følsomme felter må kun hentes via stork_hent_foelsomme_felter (logges i databasen).
 * Holdes 1:1 med Row-typen i src/integrations/supabase/types.ts.
 */
export const EMPLOYEE_SAFE_COLUMNS =
  "account_locked, archived_at, auth_user_id, avatar_url, can_work_fm, contract_id, contract_version, created_at, daily_bonus_client_id, default_landing_page, department, display_name_short, employment_end_date, employment_start_date, expected_monthly_shifts, failed_login_count, first_name, freelance_company_address, freelance_company_name, freelance_cvr, has_parking, id, invitation_status, is_active, is_freelance_consultant, is_staff_employee, job_title, last_name, last_team_id, locked_at, manager_id, merged_into_employee_id, mfa_enabled, must_change_password, onboarding_data_complete, original_start_date, original_start_date_derived, parking_monthly_cost, parking_spot_id, personnel_category, position_id, private_email, private_phone, referral_bonus, referral_code, salary_deduction, salary_deduction_note, salary_hours_source, salary_start_date, salary_type, sales_history_from, standard_start_time, system_role_id, team_id, updated_at, vacation_bonus_percent, vacation_type, weekly_hours, work_email, work_location, working_hours_model" as const;

export const EMPLOYEE_SENSITIVE_COLUMNS = [
  "cpr_number",
  "bank_reg_number",
  "bank_account_number",
  "address_street",
  "address_postal_code",
  "address_city",
  "address_country",
] as const;

export type EmployeeSensitiveFields = {
  [K in (typeof EMPLOYEE_SENSITIVE_COLUMNS)[number]]: string | null;
};

const EMPTY_SENSITIVE: EmployeeSensitiveFields = {
  cpr_number: null,
  bank_reg_number: null,
  bank_account_number: null,
  address_street: null,
  address_postal_code: null,
  address_city: null,
  address_country: null,
};

/** Henter de følsomme felter via stork_hent_foelsomme_felter (kun dem man har ret til). */
export async function fetchSensitiveFields(ids: string[]): Promise<Map<string, EmployeeSensitiveFields>> {
  const map = new Map<string, EmployeeSensitiveFields>();
  if (ids.length === 0) return map;
  const { data, error } = await supabase.rpc("stork_hent_foelsomme_felter", { p_ids: ids });
  if (error) throw error;
  for (const row of data ?? []) {
    map.set(row.id, {
      cpr_number: row.cpr_number ?? null,
      bank_reg_number: row.bank_reg_number ?? null,
      bank_account_number: row.bank_account_number ?? null,
      address_street: row.address_street ?? null,
      address_postal_code: row.address_postal_code ?? null,
      address_city: row.address_city ?? null,
      address_country: row.address_country ?? null,
    });
  }
  return map;
}

/** Fletter de følsomme felter ind på medarbejderobjekterne efter id. */
export async function attachSensitiveFields<T extends { id: string }>(
  rows: T[],
): Promise<(T & EmployeeSensitiveFields)[]> {
  const map = await fetchSensitiveFields(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, ...(map.get(r.id) ?? EMPTY_SENSITIVE) }));
}
