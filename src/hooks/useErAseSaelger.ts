import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CLIENT_IDS } from "@/utils/clientIds";

/** True hvis den indloggede medarbejder er tilknyttet kunden ASE (United TM) i employee_client_assignments. */
export function useErAseSaelger() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["er-ase-saelger", user?.email],
    enabled: !!user?.email,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<boolean> => {
      if (!user?.email) return false;
      const lower = user.email.toLowerCase();
      const { data: employee } = await supabase
        .from("employee_master_data")
        .select("id")
        .or(`private_email.ilike.${lower},work_email.ilike.${lower}`)
        .eq("is_active", true)
        .maybeSingle();
      if (!employee) return false;
      const { count } = await supabase
        .from("employee_client_assignments")
        .select("id", { count: "exact", head: true })
        .eq("employee_id", employee.id)
        .eq("client_id", CLIENT_IDS["Ase"]);
      return (count ?? 0) > 0;
    },
  });
}
