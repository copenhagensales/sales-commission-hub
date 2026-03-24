import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves agent_name/email → real employee name.
 * Uses employee_agent_mapping + employee_master_data + work_email fallback.
 */
export function useAgentNameResolver() {
  const { data: nameMap = new Map<string, string>(), isLoading } = useQuery({
    queryKey: ["agent-name-resolver"],
    queryFn: async () => {
      const map = new Map<string, string>();

      // 1. Get all agents
      const { data: agents } = await supabase
        .from("agents")
        .select("id, email, name");

      // 2. Get all mappings
      const { data: mappings } = await supabase
        .from("employee_agent_mapping")
        .select("agent_id, employee_id");

      // 3. Get all employees
      const { data: employees } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, work_email");

      if (!agents || !employees) return map;

      const employeeById = new Map(
        employees.map((e) => [e.id, `${e.first_name || ""} ${e.last_name || ""}`.trim()])
      );

      const employeeByWorkEmail = new Map(
        employees
          .filter((e) => e.work_email)
          .map((e) => [e.work_email!.toLowerCase(), `${e.first_name || ""} ${e.last_name || ""}`.trim()])
      );

      // Build agent_id → employee_id mapping
      const agentToEmployee = new Map(
        (mappings || []).map((m) => [m.agent_id, m.employee_id])
      );

      // For each agent, resolve to employee name
      for (const agent of agents) {
        const employeeId = agentToEmployee.get(agent.id);
        const empName = employeeId ? employeeById.get(employeeId) : null;

        if (empName) {
          // Map by agent email
          if (agent.email) map.set(agent.email.toLowerCase(), empName);
          // Map by agent name (dialer username)
          if (agent.name) map.set(agent.name.toLowerCase(), empName);
        }
      }

      // Fallback: work_email → name (for agents not in mapping)
      for (const [email, name] of employeeByWorkEmail) {
        if (!map.has(email)) map.set(email, name);
      }

      return map;
    },
    staleTime: 5 * 60 * 1000, // 5 min cache
  });

  const resolve = (agentName: string | null | undefined): string => {
    if (!agentName) return "";
    const resolved = nameMap.get(agentName.toLowerCase());
    return resolved || agentName;
  };

  return { resolve, isLoading };
}
