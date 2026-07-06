import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useIsFieldmarketingEmployee() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["is-fieldmarketing-employee", user?.email],
    queryFn: async () => {
      if (!user?.email) return false;

      const lowerEmail = user.email.toLowerCase();
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("job_title")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
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

export function useCanWorkFieldmarketing() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["can-work-fieldmarketing", user?.email],
    queryFn: async () => {
      if (!user?.email) return false;

      const lowerEmail = user.email.toLowerCase();
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("job_title, can_work_fm")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        console.error("Error checking fieldmarketing work access:", error);
        return false;
      }

      return data?.job_title === "Fieldmarketing" || data?.can_work_fm === true;
    },
    enabled: !!user?.email,
    staleTime: 60000,
  });
}
