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

      // Find the most recent contract
      const mostRecentContract = allContracts[0];

      // Only lock if the MOST RECENT contract is rejected
      // If they have a newer signed contract, they're unlocked
      if (mostRecentContract.status === "rejected") {
        return {
          isLocked: true,
          contract: mostRecentContract,
        };
      }

      return { isLocked: false, contract: null };
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
