import { Samleside, SamlesideFane } from "@/components/layout/Samleside";
import { useAdminSynlighed } from "@/hooks/useAdminSynlighed";
import * as P from "@/routes/pages";

const g = (id: string, label: string) => ({ id, label });

export function ComplianceSamleside() {
  const s = useAdminSynlighed().compliance;
  const R = g("registre", "Registre"), L = g("logs", "Logs"), D = g("dokumenter", "Dokumenter"), PR = g("procedurer", "Procedurer");
  const faner: SamlesideFane[] = [
    { id: "overblik", label: "Overblik", element: <P.ComplianceOverview />, synlig: s.overblik },
    { id: "processing-activities", label: "Behandlingsaktiviteter", element: <P.ComplianceProcessingActivities />, synlig: s["processing-activities"], gruppe: R },
    { id: "data-transfers", label: "Overførsler", element: <P.ComplianceDataTransferRegistry />, synlig: s["data-transfers"], gruppe: R },
    { id: "retention-policies", label: "Opbevaring", element: <P.ComplianceRetentionPolicies />, synlig: s["retention-policies"], gruppe: R },
    { id: "dpa-addenda", label: "DPA-tillæg", element: <P.ComplianceDpaAddenda />, synlig: s["dpa-addenda"], gruppe: R },
    { id: "dpia", label: "DPIA", element: <P.ComplianceDpia />, synlig: s.dpia, gruppe: R },
    { id: "impact-assessments", label: "Konsekvensanalyser", element: <P.ComplianceImpactAssessments />, synlig: s["impact-assessments"], gruppe: R },
    { id: "access-log", label: "Adgangslog", element: <P.ComplianceSensitiveAccessLog />, synlig: s["access-log"], gruppe: L },
    { id: "contract-access-log", label: "Kontraktlog", element: <P.ComplianceContractAccessLog />, synlig: s["contract-access-log"], gruppe: L },
    { id: "breach-log", label: "Brudlog", element: <P.ComplianceBreachLog />, synlig: s["breach-log"], gruppe: L },
    { id: "security-incidents", label: "Hændelser", element: <P.ComplianceSecurityIncidents />, synlig: s["security-incidents"], gruppe: L },
    { id: "backup-policy", label: "Backup", element: <P.ComplianceBackupPolicy />, synlig: s["backup-policy"], gruppe: D },
    { id: "processing-registry", label: "Fortegnelse", element: <P.ComplianceProcessingRegistry />, synlig: s["processing-registry"], gruppe: D },
    { id: "dpa-overview", label: "DPA-overblik", element: <P.ComplianceDpaOverview />, synlig: s["dpa-overview"], gruppe: D },
    { id: "client-agreements", label: "Kundeaftaler", element: <P.ComplianceClientAgreements />, synlig: s["client-agreements"], gruppe: D },
    { id: "persondatapolitik", label: "Persondatapolitik", element: <P.CompliancePersondatapolitik />, synlig: s.persondatapolitik, gruppe: D },
    { id: "databrudsprocedure", label: "Databrud", element: <P.ComplianceDatabrudsprocedure />, synlig: s.databrudsprocedure, gruppe: D },
    { id: "konsekvensvurdering-procedure", label: "Konsekvensvurdering", element: <P.ComplianceKonsekvensvurderingProcedure />, synlig: s["konsekvensvurdering-procedure"], gruppe: D },
    { id: "art30-pulsen", label: "Art. 30 Storkbook", element: <P.ComplianceArt30Pulsen />, synlig: s["art30-pulsen"], gruppe: D },
    { id: "art30-push", label: "Art. 30 Push", element: <P.ComplianceArt30Push />, synlig: s["art30-push"], gruppe: D },
    { id: "processes", label: "Processer", element: <P.ComplianceInternalProcesses />, synlig: s.processes, gruppe: PR },
    { id: "awareness", label: "Awareness", element: <P.ComplianceGdprAwareness />, synlig: s.awareness, gruppe: PR },
    { id: "ai-governance", label: "AI", element: <P.ComplianceAiGovernance />, synlig: s["ai-governance"], gruppe: PR },
    { id: "employee-privacy", label: "Medarbejdere", element: <P.ComplianceEmployeePrivacy />, synlig: s["employee-privacy"], gruppe: PR },
    { id: "admin", label: "Dokumentation", element: <P.ComplianceAdminDocumentation />, synlig: s.admin, gruppe: PR },
    { id: "notifications", label: "Notifikationer", element: <P.ComplianceNotifications />, synlig: s.notifications, gruppe: PR },
    { id: "it", label: "IT", element: <P.ItWorkstations />, synlig: s.it },
  ];
  return <Samleside titel="Compliance" faner={faner} />;
}

export function AmoSamleside() {
  const s = useAdminSynlighed().amo;
  const A = g("apv", "APV"), M = g("moeder", "Møder"), O = g("organisation", "Organisation"), D = g("dokumenter", "Dokumenter");
  return (
    <Samleside titel="Arbejdsmiljø" faner={[
      { id: "overblik", label: "Overblik", element: <P.AmoDashboard />, synlig: s.overblik },
      { id: "apv", label: "APV", element: <P.AmoApv />, synlig: s.apv, gruppe: A },
      { id: "kemi-apv", label: "Kemi-APV", element: <P.AmoKemiApv />, synlig: s["kemi-apv"], gruppe: A },
      { id: "meetings", label: "Møder", element: <P.AmoMeetings />, synlig: s.meetings, gruppe: M },
      { id: "annual-discussion", label: "Årlig drøftelse", element: <P.AmoAnnualDiscussion />, synlig: s["annual-discussion"], gruppe: M },
      { id: "opgaver", label: "Opgaver", element: <P.AmoTasks />, synlig: s.opgaver },
      { id: "organisation", label: "Organisation", element: <P.AmoOrganisation />, synlig: s.organisation, gruppe: O },
      { id: "training", label: "Uddannelse", element: <P.AmoTraining />, synlig: s.training, gruppe: O },
      { id: "documents", label: "Dokumenter", element: <P.AmoDocuments />, synlig: s.documents, gruppe: D },
      { id: "audit-log", label: "Auditlog", element: <P.AmoAuditLog />, synlig: s["audit-log"], gruppe: D },
      { id: "settings", label: "Indstillinger", element: <P.AmoSettings />, synlig: s.settings, gruppe: D },
    ]} />
  );
}

export function AdministrationSamleside() {
  const s = useAdminSynlighed().admin;
  const I = g("indstillinger", "Indstillinger"), S = g("sikkerhed", "Sikkerhed"), T = g("tv-tavler", "TV-tavler");
  return (
    <Samleside titel="Administration" faner={[
      { id: "settings", label: "Indstillinger", element: <P.Settings />, synlig: s.settings, gruppe: I },
      { id: "types", label: "Lønarter", element: <P.SalaryTypes />, synlig: s.types, gruppe: I },
      { id: "rettigheder", label: "Rettigheder", element: <P.Permissions />, synlig: s.rettigheder },
      { id: "menu", label: "Menu", element: <P.MenuEditor />, synlig: s.menu },
      { id: "kpi-definitioner", label: "KPI-definitioner", element: <P.KpiDefinitions />, synlig: s["kpi-definitioner"] },
      { id: "security", label: "Sikkerhed", element: <P.SecurityDashboard />, synlig: s.security, gruppe: S },
      { id: "login-log", label: "Login-log", element: <P.LoginLog />, synlig: s["login-log"], gruppe: S },
      { id: "stabilitet", label: "Stabilitet", element: <P.SystemStability />, synlig: s.stabilitet },
      { id: "logikker", label: "Logikker", element: <P.Logikker />, synlig: s.logikker },
      { id: "agenter", label: "Agenter", element: <P.Agents />, synlig: s.agenter },
      { id: "tv-board-admin", label: "TV-tavler", element: <P.TvBoardAdmin />, synlig: s["tv-board-admin"], gruppe: T },
      { id: "dashboards-settings", label: "Tavleindstillinger", element: <P.DashboardSettings />, synlig: s["dashboards-settings"], gruppe: T },
    ]} />
  );
}
