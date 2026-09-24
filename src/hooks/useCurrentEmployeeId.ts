import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/** Medarbejder-id for den indloggede bruger (null hvis ikke koblet, fx TV-login). */
export function useCurrentEmployeeId(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["current-employee-id", user?.id],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc("get_current_employee_id");
      if (error) return null;
      return (data as string | null) ?? null;
    },
    enabled: enabled && !!user?.id,
    staleTime: 600000,
  });
}
