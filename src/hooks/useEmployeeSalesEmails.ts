import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveEmployeeSalesEmails } from "@/lib/employeeSalesEmails";

/** Agent emails used to find an employee's sales (mapping, else work email). */
export function useEmployeeSalesEmails(employeeId: string) {
  return useQuery({
    queryKey: ["employee-agent-emails", employeeId],
    queryFn: async (): Promise<string[]> => {
      const { data: mappings } = await supabase
        .from("employee_agent_mapping")
        .select("agents(email)")
        .eq("employee_id", employeeId);
      const mapped = (mappings || []).map(
        (m) => (m.agents as { email: string | null } | null)?.email,
      );
      if (mapped.some(Boolean)) return resolveEmployeeSalesEmails(mapped, null);

      const { data: emp } = await supabase
        .from("employee_master_data")
        .select("work_email")
        .eq("id", employeeId)
        .maybeSingle();
      return resolveEmployeeSalesEmails([], (emp as { work_email: string | null } | null)?.work_email);
    },
    enabled: !!employeeId,
  });
}
