import { usePermissions } from "@/hooks/usePositionPermissions";
import { useAuth } from "@/hooks/useAuth";
import { useItAccess } from "@/hooks/useItWorkstations";

/** Lønarter: den gamle Løn-sektions bruger-allowlist (Kasper, Mathias, Lone), flyttet fra AppSidebar. */
export const SALARY_ALLOWED_USER_IDS = [
  "f0fb7ec3-5f00-4fcd-a6ca-2a53669147b9",
  "71267f4e-fd9e-4c16-8fe9-da0f48ce2598",
  "e1ac7b84-aedb-400e-88f6-dd24687317e4",
];

/**
 * Fanesynlighed for samlesiderne »Compliance«, »AMO« og »Administration« (bundt b4).
 * Hver underside følger sin rutes eksisterende nøgle; ingen nye nøgler.
 */
export function useAdminSynlighed() {
  const p = usePermissions();
  const v = (k: string) => p.canView(k);
  const ca = v("menu_compliance_admin");
  const { user } = useAuth();
  const { data: hasItAccess = false } = useItAccess();
  // Gamle sektionsbetingelser (c2): ingen ser mere end før.
  const led = v("menu_section_ledelse"), pers = v("menu_section_personale");
  // Gammel AMO-sektion: sektionsnøgle OG mindst én af de fire kernesider.
  const amoSek = v("menu_section_amo") &&
    (!!p.canViewAmoDashboard || !!p.canViewAmoOrganisation || !!p.canViewAmoMeetings || !!p.canViewAmoApv);
  // Samme ejer-afgørelse som den gamle Admin-sektion (stillingsnavn), ikke en ny rolleregel.
  const isOwner = p.position?.name?.toLowerCase() === "ejer";
  const adminSek = !!p.canViewKpiDefinitions || isOwner;
  const loen = !!user?.id && SALARY_ALLOWED_USER_IDS.includes(user.id);

  const compliance = {
    overblik: v("menu_compliance_overview"),
    "processing-activities": v("tab_compliance_processing_activities"), "data-transfers": v("tab_compliance_data_transfers"), "retention-policies": v("tab_compliance_retention_policies"), "dpa-addenda": v("tab_compliance_dpa_addenda"), dpia: v("tab_compliance_dpia"), "impact-assessments": v("tab_compliance_impact_assessments"),
    "access-log": v("tab_compliance_access_log"), "contract-access-log": v("tab_compliance_contract_access_log"), "breach-log": v("tab_compliance_breach_log"), "security-incidents": v("tab_compliance_security_incidents"),
    "backup-policy": v("tab_compliance_backup_policy"), "processing-registry": v("tab_compliance_processing_registry"), "dpa-overview": v("tab_compliance_dpa_overview"), "client-agreements": v("tab_compliance_client_agreements"), persondatapolitik: v("tab_compliance_persondatapolitik"),
    databrudsprocedure: v("tab_compliance_databrudsprocedure"), "konsekvensvurdering-procedure": v("tab_compliance_konsekvensvurdering_procedure"), "art30-pulsen": v("tab_compliance_art30_pulsen"), "art30-push": v("tab_compliance_art30_push"),
    processes: v("menu_compliance_processes"), awareness: v("tab_compliance_awareness"), "ai-governance": v("tab_compliance_ai_governance"),
    "employee-privacy": v("menu_compliance_employee"), admin: v("tab_compliance_admin"), notifications: v("tab_compliance_notifications"),
    it: !!hasItAccess && v("menu_it_workstations"),
  };
  const amo = {
    overblik: amoSek && v("menu_amo_dashboard"),
    apv: amoSek && v("menu_amo_apv"), "kemi-apv": amoSek && v("menu_amo_kemi_apv"),
    meetings: amoSek && v("menu_amo_meetings"), "annual-discussion": amoSek && v("menu_amo_annual_discussion"),
    opgaver: amoSek && v("menu_amo_tasks"),
    organisation: amoSek && v("menu_amo_organisation"), training: amoSek && v("menu_amo_training"),
    documents: amoSek && v("menu_amo_documents"), "audit-log": amoSek && v("menu_amo_audit_log"), settings: amoSek && v("menu_amo_settings"),
  };
  const admin = {
    integrationer: v("tab_administration_integrationer"), types: loen && v("menu_salary_types"),
    rettigheder: led && v("tab_administration_rettigheder"),
    menu: isOwner && v("tab_administration_menu"),
    "kpi-definitioner": adminSek && v("menu_kpi_definitions"),
    security: led && v("tab_administration_sikkerhed"), "login-log": pers && v("menu_login_log"),
    stabilitet: led && v("tab_administration_stabilitet"),
    logikker: v("menu_logics"),
    agenter: adminSek && v("tab_administration_agenter"),
    "tv-board-admin": adminSek && v("tab_administration_tv_tavler"), "dashboards-settings": v("menu_dashboard_admin"),
  };
  const nogen = (o: Record<string, boolean>) => Object.values(o).some(Boolean);
  return { compliance, amo, admin, har: { compliance: nogen(compliance), amo: nogen(amo), admin: nogen(admin), udsendelser: isOwner } };
}
