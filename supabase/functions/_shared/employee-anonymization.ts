/**
 * Single source of truth for which employee_master_data fields are wiped when a
 * person is anonymised (GDPR art. 17 request, or retention-based anonymisation).
 *
 * Everything NOT listed here is preserved on purpose: employment dates, job title,
 * team history, is_active — the data we need for historical statistics.
 */
export const EMPLOYEE_ANONYMIZED_FIRST_NAME = "Slettet";
export const EMPLOYEE_ANONYMIZED_LAST_NAME = "Bruger";

export const employeeAnonymizationPatch: Record<string, string | null> = {
  first_name: EMPLOYEE_ANONYMIZED_FIRST_NAME,
  last_name: EMPLOYEE_ANONYMIZED_LAST_NAME,
  private_email: null,
  work_email: null,
  phone: null,
  cpr_number: null,
  address: null,
  city: null,
  zip_code: null,
  emergency_contact_name: null,
  emergency_contact_phone: null,
  avatar_url: null,
  bank_reg_number: null,
  bank_account_number: null,
  notes: null,
};
