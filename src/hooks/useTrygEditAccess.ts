import { usePermissions } from "@/hooks/usePositionPermissions";
import { useAuth } from "@/hooks/useAuth";
import { isBulkSalesEmail } from "@/config/bulkSalesAccess";

/**
 * Adgang til "Tryg - Ret salg": ejere samt de adresser der står i
 * `BULK_SALES_EMAILS` (Filip Kirketerp Møller og Annika Søndergaard).
 * Rolle-rettigheden `menu_reports_tryg_edit_sales` styrer derudover
 * ruten/menuen via permission-systemet.
 */
export function useTrygEditAccess(): { hasAccess: boolean; isLoading: boolean } {
  const { isOwner, isReady } = usePermissions();
  const { user } = useAuth();

  return {
    hasAccess: isReady ? isOwner || isBulkSalesEmail(user?.email) : false,
    isLoading: !isReady,
  };
}
