import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useIsFieldmarketingEmployee() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["is-fieldmarketing-employee", user?.email],
    queryFn: async () => {
      if (!user?.email) return false;

      const { data, error } = await supabase
        .from("employee_master_data")
        .select("job_title")
        .or(`private_email.eq.${user.email},work_email.eq.${user.email}`)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        console.error("Error checking fieldmarketing status:", error);
        return false;
      }

      return data?.job_title === "Fieldmarketing";
    },
    enabled: !!user?.email,
    staleTime: 60000,
  });
}
