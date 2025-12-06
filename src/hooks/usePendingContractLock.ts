import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function usePendingContractLock() {
  const { user, loading: authLoading } = useAuth();

  const { data: lockData, isLoading: queryLoading } = useQuery({
    queryKey: ["pending-contract-lock", user?.id],
    queryFn: async () => {
      if (!user) return { isLocked: false, contract: null };

      try {
        // Get employee_id for current user
        const { data: employeeData, error: employeeError } = await supabase
          .rpc('get_current_employee_id');
        
        if (employeeError || !employeeData) {
          console.error("Could not get employee id:", employeeError);
          return { isLocked: false, contract: null };
        }

        // Check for pending contracts older than 5 days
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

        const { data: pendingContracts, error: contractError } = await supabase
          .from("contracts")
          .select("id, title, sent_at")
          .eq("employee_id", employeeData)
          .eq("status", "pending_employee")
          .lt("sent_at", fiveDaysAgo.toISOString())
          .order("sent_at", { ascending: true })
          .limit(1);

        if (contractError) {
          console.error("Error fetching contracts:", contractError);
          return { isLocked: false, contract: null };
        }

        if (pendingContracts && pendingContracts.length > 0) {
          return { 
            isLocked: true, 
            contract: pendingContracts[0] 
          };
        }

        return { isLocked: false, contract: null };
      } catch (error) {
        console.error("Error in usePendingContractLock:", error);
        return { isLocked: false, contract: null };
      }
    },
    enabled: !!user && !authLoading,
    refetchInterval: 60000, // Check every minute
    retry: 1,
    staleTime: 30000,
  });

  return {
    isLocked: lockData?.isLocked ?? false,
    contract: lockData?.contract ?? null,
    isLoading: authLoading || (!!user && queryLoading),
  };
}
