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
  // Sektionsnøgler fra de gamle menupunkter (c2): ingen ser mere end før.
  const fm = v("menu_section_fieldmarketing"), rap = v("menu_section_reports"), led = v("menu_section_ledelse"), mg = v("menu_section_mg");

  const fieldmarketing = {
    "vagt-flow": fm && v("menu_fm_overview"),
    booking: fm && v("menu_fm_booking"),
    billing: fm && v("menu_fm_billing"),
    "eesy-fm-deviations": fm && v("menu_fm_eesy_deviations"),
    locations: fm && v("menu_fm_locations"),
  };
  const retSalg = {
    "tdc-erhverv-edit-sales": rap && v("menu_reports_tdc_edit_sales"),
    "tryg-edit-sales": !!trygEditAccess && v("tab_ret_salg_tryg"),
    "edit-sales": fm && v("menu_fm_edit_sales"),
  };
  const tdc = {
    "fiber-registrering": v("tab_tdc_vaerktoejer_fiber"),
    "tdc-idriftsaettelse": v("tab_tdc_vaerktoejer_idriftsaettelse"),
    "tdc-opsummering": v("tab_tdc_vaerktoejer_opsummering"),
  };
  const kunder = { "mg-test": mg && v("menu_mg_test"), henvendelser: led && v("menu_customer_inquiries") };
  const rapporter = {
    admin: rap && v("menu_reports_admin"),
    management: rap && v("menu_reports_management"),
    daily: rap && v("menu_reports_daily"),
    "revenue-by-client": led && v("menu_reports_revenue_by_client") && !!isSuperadmin,
    "weekly-lead-closure": led && v("menu_reports_weekly_lead_closure"),
    cancellations: rap && v("menu_cancellations"),
  };
  const powerdag = {
    powerdag: v("menu_dashboard_powerdag"),
    input: v("tab_powerdag_input"),
    admin: v("tab_powerdag_administration"),
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
