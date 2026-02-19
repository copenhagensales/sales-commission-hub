/**
 * Shared employee avatar hook.
 * Consolidated from 4 identical queries across dashboard files.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface EmployeeAvatarData {
  avatarMap: Map<string, string>;
  idToNameMap: Map<string, string>;
  idToAvatarMap: Map<string, string | null>;
}

/**
 * Fetch employee avatars and name mappings.
 * Returns maps keyed by lowercase full name and by employee ID.
 */
export function useEmployeeAvatars(options?: { enabled?: boolean }) {
  return useQuery<EmployeeAvatarData>({
    queryKey: ["employee-avatars-shared"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, avatar_url")
        .eq("is_active", true);

      const avatarMap = new Map<string, string>();
      const idToNameMap = new Map<string, string>();
      const idToAvatarMap = new Map<string, string | null>();

      (data || []).forEach((emp) => {
        const fullName = `${emp.first_name} ${emp.last_name}`;
        if (emp.avatar_url) {
          avatarMap.set(fullName.toLowerCase(), emp.avatar_url);
        }
        idToNameMap.set(emp.id, fullName);
        idToAvatarMap.set(emp.id, emp.avatar_url);
      });

      return { avatarMap, idToNameMap, idToAvatarMap };
    },
    staleTime: 300_000,
    enabled: options?.enabled ?? true,
  });
}
