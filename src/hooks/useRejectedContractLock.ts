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

      // Check for rejected contracts (most recent first)
      const { data: rejectedContracts } = await supabase
        .from("contracts")
        .select("id, title, created_at")
        .eq("employee_id", employee.id)
        .eq("status", "rejected")
        .order("created_at", { ascending: false })
        .limit(1);

      if (!rejectedContracts || rejectedContracts.length === 0) {
        return { isLocked: false, contract: null };
      }

      const mostRecentRejected = rejectedContracts[0];

      // Check if there's a signed contract created AFTER the rejected one
      const { data: signedContracts } = await supabase
        .from("contracts")
        .select("id, created_at")
        .eq("employee_id", employee.id)
        .eq("status", "signed")
        .gt("created_at", mostRecentRejected.created_at)
        .limit(1);

      // If there's a signed contract after the rejection, unlock
      if (signedContracts && signedContracts.length > 0) {
        return { isLocked: false, contract: null };
      }

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
