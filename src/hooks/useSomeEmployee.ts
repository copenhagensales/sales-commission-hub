import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useIsSomeEmployee() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["is-some-employee", user?.email],
    queryFn: async () => {
      if (!user?.email) return false;

      // Query with proper filter - check both private and work email
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("job_title")
        .eq("is_active", true)
        .or(`private_email.eq."${user.email}",work_email.eq."${user.email}"`)
        .maybeSingle();

      if (error) {
        console.error("Error checking SOME status:", error);
        return false;
      }

      console.log("useSomeEmployee result:", { email: user.email, job_title: data?.job_title, isSome: data?.job_title === "SOME" });
      
      return data?.job_title === "SOME";
    },
    enabled: !!user?.email,
    staleTime: 60000,
  });
}
