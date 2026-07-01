import { supabase } from "@/integrations/supabase/client";
import { findEmployeeByAuth } from "@/lib/employeeLookup";

export async function logContractAccess(
  contractId: string,
  employeeId: string,
  accessType: "view" | "sign" | "download"
) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    // Don't log if the user is viewing their own contract
    const { data: emp } = await findEmployeeByAuth<{ id: string }>(
      userData.user,
      "id"
    );

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
