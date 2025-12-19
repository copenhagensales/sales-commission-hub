import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useIsSomeEmployee() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["is-some-employee", user?.email],
    queryFn: async () => {
      if (!user?.email) return false;

      const lowerEmail = user.email.toLowerCase();
      const { data } = await supabase
        .from("employee_master_data")
        .select("job_title")
        .eq("is_active", true)
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .maybeSingle();

      return data?.job_title === "SOME";
    },
    enabled: !!user?.email,
    staleTime: 10000,
  });
}
