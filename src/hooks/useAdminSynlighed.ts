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
    "processing-activities": ca, "data-transfers": ca, "retention-policies": ca, "dpa-addenda": ca, dpia: ca, "impact-assessments": ca,
    "access-log": ca, "contract-access-log": ca, "breach-log": ca, "security-incidents": ca,
    "backup-policy": ca, "processing-registry": ca, "dpa-overview": ca, "client-agreements": ca, persondatapolitik: ca,
    databrudsprocedure: ca, "konsekvensvurdering-procedure": ca, "art30-pulsen": ca, "art30-push": ca,
    processes: v("menu_compliance_processes"), awareness: ca, "ai-governance": ca,
    "employee-privacy": v("menu_compliance_employee"), admin: ca, notifications: ca,
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
    settings: v("menu_settings"), types: loen && v("menu_salary_types"),
    rettigheder: led && v("menu_permissions"),
    menu: isOwner,
    "kpi-definitioner": adminSek && v("menu_kpi_definitions"),
    security: led && v("menu_security_dashboard"), "login-log": pers && v("menu_login_log"),
    stabilitet: led && v("menu_security_dashboard"),
    logikker: v("menu_logics"),
    agenter: adminSek && v("menu_employees"),
    "tv-board-admin": adminSek && v("menu_settings"), "dashboards-settings": v("menu_dashboard_admin"),
  };
  const nogen = (o: Record<string, boolean>) => Object.values(o).some(Boolean);
  return { compliance, amo, admin, har: { compliance: nogen(compliance), amo: nogen(amo), admin: nogen(admin), udsendelser: isOwner } };
}
