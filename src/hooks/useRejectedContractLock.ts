import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useRejectedContractLock() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["rejected-contract-lock", user?.email],
    queryFn: async () => {
      if (!user?.email) return { isLocked: false, contract: null };

      const lowerEmail = user.email.toLowerCase();

      // Get employee ID for current user
      const { data: employee } = await supabase
        .from("employee_master_data")
        .select("id")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .eq("is_active", true)
        .maybeSingle();

      if (!employee) return { isLocked: false, contract: null };

      // Get ALL contracts for this employee to determine lock status
      const { data: allContracts } = await supabase
        .from("contracts")
        .select("id, title, status, created_at")
        .eq("employee_id", employee.id)
        .order("created_at", { ascending: false });

      if (!allContracts || allContracts.length === 0) {
        return { isLocked: false, contract: null };
      }

      // Find the most recent rejected contract
      const mostRecentRejected = allContracts.find(c => c.status === "rejected");
      
      if (!mostRecentRejected) {
        // No rejected contracts at all - not locked
        return { isLocked: false, contract: null };
      }

      // Check if there's any contract (signed OR pending) created AFTER the rejection
      // This allows users to sign a new pending contract to unlock themselves
      const hasNewerContract = allContracts.some(c => 
        (c.status === "signed" || c.status === "pending_employee") && 
        new Date(c.created_at) > new Date(mostRecentRejected.created_at)
      );

      console.log("useRejectedContractLock DEBUG:", {
        totalContracts: allContracts.length,
        mostRecentRejected: { id: mostRecentRejected.id, status: mostRecentRejected.status, created_at: mostRecentRejected.created_at },
        newerContracts: allContracts.filter(c => 
          (c.status === "signed" || c.status === "pending_employee") && 
          new Date(c.created_at) > new Date(mostRecentRejected.created_at)
        ).map(c => ({ id: c.id, status: c.status, created_at: c.created_at })),
        hasNewerContract,
        willLock: !hasNewerContract,
      });

      if (hasNewerContract) {
        return { isLocked: false, contract: null };
      }

      // Locked: has rejected contract with no newer signed/pending contract
      return {
        isLocked: true,
        contract: mostRecentRejected,
      };
    },
    enabled: !!user?.email,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    isLocked: data?.isLocked ?? false,
    contract: data?.contract ?? null,
    isLoading,
  };
}
