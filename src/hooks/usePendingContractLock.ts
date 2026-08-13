import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { REFRESH_PROFILES } from "@/utils/tvMode";
import { useContractPolicy } from "@/hooks/useContractPolicy";
import { usePermissions } from "@/hooks/usePositionPermissions";

export function usePendingContractLock() {
  const { user, loading: authLoading } = useAuth();
  const { pendingLockDays, pendingLockEnabled, isLoading: policyLoading } = useContractPolicy();
  const { isOwner } = usePermissions();

  // Owners are never locked out — there must always be a way into the system.
  const ruleActive = pendingLockEnabled && !isOwner;

  const { data: lockData, isLoading: queryLoading } = useQuery({
    queryKey: ["pending-contract-lock", user?.id, pendingLockDays],
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

        // Check for pending contracts older than the configured number of days
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - pendingLockDays);

        const { data: pendingContracts, error: contractError } = await supabase
          .from("contracts")
          .select("id, title, sent_at")
          .eq("employee_id", employeeData)
          .eq("status", "pending_employee")
          .lt("sent_at", cutoff.toISOString())
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
    enabled: !!user && !authLoading && !policyLoading && ruleActive,
    ...REFRESH_PROFILES.dashboard,
    retry: 1,
  });

  return {
    isLocked: ruleActive ? (lockData?.isLocked ?? false) : false,
    contract: lockData?.contract ?? null,
    lockDays: pendingLockDays,
    isLoading: authLoading || (!!user && ruleActive && (policyLoading || queryLoading)),
  };
}
