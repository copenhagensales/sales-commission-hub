import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const MANUAL_SALES_TEAM_IDS = [
  "ed095592-cc72-4dc5-b4d7-cc4a65250cac", // United (Lederne)
  "0cb1b854-e7b5-4f49-8fdf-30e54e7d2f95", // Eesy TM (Hiper)
];

/**
 * True if the current user is a member of team United (or an owner/manager
 * who should always see the entry).
 */
export function useIsUnitedMember() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["is-united-member", user?.email],
    enabled: !!user?.email,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      if (!user?.email) return false;

      const lowerEmail = user.email.toLowerCase();
      const { data: employee } = await supabase
        .from("employee_master_data")
        .select("id, auth_user_id")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .eq("is_active", true)
        .maybeSingle();

      if (!employee) return false;

      // Team membership
      const { data: memberships } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("employee_id", employee.id);

      if ((memberships ?? []).some((m) => MANUAL_SALES_TEAM_IDS.includes(m.team_id))) return true;

      // Fallback: owners/managers always see the entry
      if (employee.auth_user_id) {
        const { data: isMgr } = await supabase.rpc("is_manager_or_above", {
          _user_id: employee.auth_user_id,
        });
        if (isMgr) return true;
      }

      return false;
    },
  });
}
