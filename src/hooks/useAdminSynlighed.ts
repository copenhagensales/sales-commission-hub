import { usePermissions } from "@/hooks/usePositionPermissions";

/**
 * Fanesynlighed for samlesiderne »Compliance«, »AMO« og »Administration« (bundt b4).
 * Hver underside følger sin rutes eksisterende nøgle; ingen nye nøgler.
 */
export function useAdminSynlighed() {
  const p = usePermissions();
  const v = (k: string) => p.canView(k);
  const ca = v("menu_compliance_admin");

  const compliance = {
    overblik: v("menu_compliance_overview"),
    "processing-activities": ca, "data-transfers": ca, "retention-policies": ca, "dpa-addenda": ca, dpia: ca, "impact-assessments": ca,
    "access-log": ca, "contract-access-log": ca, "breach-log": ca, "security-incidents": ca,
    "backup-policy": ca, "processing-registry": ca, "dpa-overview": ca, "client-agreements": ca, persondatapolitik: ca,
    databrudsprocedure: ca, "konsekvensvurdering-procedure": ca, "art30-pulsen": ca, "art30-push": ca,
    processes: v("menu_compliance_processes"), awareness: ca, "ai-governance": ca,
    "employee-privacy": v("menu_compliance_employee"), admin: ca, notifications: ca,
    it: v("menu_it_workstations"),
  };
  const amo = {
    overblik: v("menu_amo_dashboard"),
    apv: v("menu_amo_apv"), "kemi-apv": v("menu_amo_kemi_apv"),
    meetings: v("menu_amo_meetings"), "annual-discussion": v("menu_amo_annual_discussion"),
    opgaver: v("menu_amo_tasks"),
    organisation: v("menu_amo_organisation"), training: v("menu_amo_training"),
    documents: v("menu_amo_documents"), "audit-log": v("menu_amo_audit_log"), settings: v("menu_amo_settings"),
  };
  const admin = {
    settings: v("menu_settings"), types: v("menu_salary_types"),
    rettigheder: v("menu_permissions"),
    menu: v("menu_permissions"),
    "kpi-definitioner": v("menu_kpi_definitions"),
    security: v("menu_security_dashboard"), "login-log": v("menu_login_log"),
    stabilitet: v("menu_security_dashboard"),
    logikker: v("menu_logics"),
    agenter: v("menu_employees"),
    "tv-board-admin": v("menu_settings"), "dashboards-settings": v("menu_dashboard_admin"),
  };
  const nogen = (o: Record<string, boolean>) => Object.values(o).some(Boolean);
  return { compliance, amo, admin, har: { compliance: nogen(compliance), amo: nogen(amo), admin: nogen(admin) } };
}
