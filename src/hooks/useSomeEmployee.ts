import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useIsSomeEmployee() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["is-some-employee", user?.email],
    queryFn: async () => {
      if (!user?.email) return false;

      // Try private_email first
      const { data: privateData } = await supabase
        .from("employee_master_data")
        .select("job_title")
        .eq("is_active", true)
        .eq("private_email", user.email)
        .maybeSingle();

      if (privateData?.job_title === "SOME") return true;

      // Try work_email
      const { data: workData } = await supabase
        .from("employee_master_data")
        .select("job_title")
        .eq("is_active", true)
        .eq("work_email", user.email)
        .maybeSingle();

      return workData?.job_title === "SOME";
    },
    enabled: !!user?.email,
    staleTime: 10000,
  });
}
