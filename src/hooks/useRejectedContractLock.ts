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

      // Check for rejected contracts
      const { data: rejectedContracts } = await supabase
        .from("contracts")
        .select("id, title")
        .eq("employee_id", employee.id)
        .eq("status", "rejected")
        .limit(1);

      return {
        isLocked: rejectedContracts && rejectedContracts.length > 0,
        contract: rejectedContracts?.[0] ?? null,
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
