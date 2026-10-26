import { usePermissions } from "@/hooks/usePositionPermissions";
import { useTrygEditAccess } from "@/hooks/useTrygEditAccess";
import { useIsSuperadmin } from "@/hooks/useIsSuperadmin";

/**
 * Fanesynlighed for samlesiderne i »Salg og kunder«, »Løn og rapporter« og »Tavler« (bundt b3).
 * role-ruter → p.canView(rutens nøgle). Hvor det tidligere menupunkt havde en ekstra betingelse
 * (Tryg ret salg: allowlist; Omsætning pr. opgave: superadmin), bruges den samme, så ingen ser mere end før.
 */
export function useSalgRapporterSynlighed() {
  const p = usePermissions();
  const { hasAccess: trygEditAccess } = useTrygEditAccess();
  const { isSuperadmin } = useIsSuperadmin();
  const v = (k: string) => p.canView(k);

  const fieldmarketing = {
    "vagt-flow": v("menu_fm_overview"),
    booking: v("menu_fm_booking"),
    billing: v("menu_fm_billing"),
    "eesy-fm-deviations": v("menu_fm_eesy_deviations"),
    locations: v("menu_fm_locations"),
  };
  const retSalg = {
    "tdc-erhverv-edit-sales": v("menu_reports_tdc_edit_sales"),
    "tryg-edit-sales": !!trygEditAccess,
    "edit-sales": v("menu_fm_edit_sales"),
  };
  const tdc = {
    "fiber-registrering": v("menu_tdc_opsummering"),
    "tdc-idriftsaettelse": v("menu_tdc_opsummering"),
    "tdc-opsummering": v("menu_tdc_opsummering"),
  };
  const kunder = { "mg-test": v("menu_mg_test"), henvendelser: v("menu_customer_inquiries") };
  const rapporter = {
    admin: v("menu_reports_admin"),
    management: v("menu_reports_management"),
    daily: v("menu_reports_daily"),
    "revenue-by-client": v("menu_reports_revenue_by_client") && !!isSuperadmin,
    "weekly-lead-closure": v("menu_reports_weekly_lead_closure"),
    cancellations: v("menu_cancellations"),
  };
  const powerdag = {
    powerdag: v("menu_dashboard_powerdag"),
    input: v("menu_powerdag_input"),
    admin: v("menu_powerdag_input"),
  };
  const nogen = (o: Record<string, boolean>) => Object.values(o).some(Boolean);
  return {
    fieldmarketing, retSalg, tdc, kunder, rapporter, powerdag,
    har: {
      fieldmarketing: nogen(fieldmarketing), retSalg: nogen(retSalg), tdc: nogen(tdc),
      kunder: nogen(kunder), rapporter: nogen(rapporter), powerdag: nogen(powerdag),
    },
  };
}
