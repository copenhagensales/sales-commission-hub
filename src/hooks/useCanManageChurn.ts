import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Skrivadgang til churn-handlinger og -indstillinger.
 * Genbruger projektets eksisterende rolleafgørelse i databasen — ingen ny rollemodel.
 */
export function useCanManageChurn() {
  return useQuery({
    queryKey: ["churn-can-manage"],
    queryFn: async (): Promise<boolean> => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return false;
      const [manager, owner] = await Promise.all([
        supabase.rpc("is_manager_or_above", { _user_id: uid }),
        supabase.rpc("is_owner", { _user_id: uid }),
      ]);
      return Boolean(manager.data) || Boolean(owner.data);
    },
    staleTime: 10 * 60 * 1000,
  });
}
