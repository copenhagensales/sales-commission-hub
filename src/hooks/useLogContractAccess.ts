import { supabase } from "@/integrations/supabase/client";

export async function logContractAccess(
  contractId: string,
  employeeId: string,
  accessType: "view" | "sign" | "download"
) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    // Don't log if the user is viewing their own contract
    const { data: emp } = await supabase
      .from("employee_master_data")
      .select("id")
      .eq("auth_user_id", userData.user.id)
      .maybeSingle();

    if (emp?.id === employeeId) return;

    await supabase.from("contract_access_log" as any).insert({
      user_id: userData.user.id,
      contract_id: contractId,
      employee_id: employeeId,
      access_type: accessType,
    });
  } catch (err) {
    console.error("Failed to log contract access:", err);
  }
}
