import { supabase } from "@/integrations/supabase/client";

const SENSITIVE_FIELDS = new Set([
  "cpr_number",
  "bank_reg_number",
  "bank_account_number",
]);

export function isSensitiveField(field: string): boolean {
  return SENSITIVE_FIELDS.has(field);
}

export async function logSensitiveAccess(
  employeeId: string,
  fieldAccessed: string,
  accessType: "view" | "edit" | "self_edit" = "edit"
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("sensitive_data_access_log").insert({
      user_id: user.id,
      employee_id: employeeId,
      field_accessed: fieldAccessed,
      access_type: accessType,
    });
  } catch (e) {
    console.error("Failed to log sensitive data access:", e);
  }
}
