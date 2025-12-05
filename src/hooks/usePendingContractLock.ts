import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePendingContractLock() {
  const { data: lockData, isLoading } = useQuery({
    queryKey: ["pending-contract-lock"],
    queryFn: async () => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { isLocked: false, contract: null };

      // Get employee_id for current user
      const { data: employeeData } = await supabase
        .rpc('get_current_employee_id');
      
      if (!employeeData) return { isLocked: false, contract: null };

      // Check for pending contracts older than 5 days
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      const { data: pendingContracts } = await supabase
        .from("contracts")
        .select("id, title, sent_at")
        .eq("employee_id", employeeData)
        .eq("status", "pending_employee")
        .lt("sent_at", fiveDaysAgo.toISOString())
        .order("sent_at", { ascending: true })
        .limit(1);

      if (pendingContracts && pendingContracts.length > 0) {
        return { 
          isLocked: true, 
          contract: pendingContracts[0] 
        };
      }

      return { isLocked: false, contract: null };
    },
    refetchInterval: 60000, // Check every minute
  });

  return {
    isLocked: lockData?.isLocked ?? false,
    contract: lockData?.contract ?? null,
    isLoading,
  };
}
