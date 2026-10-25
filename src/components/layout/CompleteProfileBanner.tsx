import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CompleteProfileBanner() {
  const { data: needsCompletion, isLoading } = useQuery({
    queryKey: ["profile-completion-status"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return false;

      const lowerEmail = userData.user.email?.toLowerCase() || '';
      const { data: row, error } = await supabase
        .from("employee_master_data")
        .select("id, onboarding_data_complete")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .maybeSingle();

      if (error || !row) return false;

      // CPR/adresse/bank hentes via stork_hent_foelsomme_felter for eget id.
      const { data: sensitive, error: sensitiveError } = await supabase.rpc(
        "stork_hent_foelsomme_felter",
        { p_ids: [row.id] },
      );
      if (sensitiveError) return false;
      const s = sensitive?.[0];
      const employee = {
        onboarding_data_complete: row.onboarding_data_complete,
        cpr_number: s?.cpr_number ?? null,
        address_street: s?.address_street ?? null,
        bank_account_number: s?.bank_account_number ?? null,
      };

      // Check if onboarding_data_complete is explicitly false, 
      // or if critical fields are missing
      const hasCompleteData = employee.onboarding_data_complete === true;
      const hasCriticalFields = !!(employee.cpr_number && employee.address_street && employee.bank_account_number);
      
      return !hasCompleteData && !hasCriticalFields;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  if (isLoading || !needsCompletion) {
    return null;
  }

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-3 max-md:rounded-2xl max-md:border max-md:p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4 max-w-7xl mx-auto">
        <div className="flex items-start gap-3 md:items-center">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-sm max-md:text-[15px] text-amber-800 dark:text-amber-200">
            <strong>Velkommen!</strong> Udfyld venligst dine personlige oplysninger for at færdiggøre din profil.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0 max-md:w-full max-md:min-h-11 border-amber-500/30 text-amber-800 dark:text-amber-200 hover:bg-amber-500/10">
          <Link to="/my-profile">
            Udfyld nu <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
