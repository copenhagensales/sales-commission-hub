import type { RouteConfig } from "./types";
import { redirectTo, PulsenRedirect, MyScheduleRedirect, MyGoalsRedirect, MyContractsRedirect, CareerWishesRedirect } from "./redirects";
import {
  VagtplanSamleside,
  MitTeamSamleside,
  OnboardingSamleside,
  RekrutteringSamleside,
  MedarbejdereSamleside,
  KontrakterSamleside,
  VagterSamleside,
  RegistrerSalgSamleside,
  SpilSamleside,
  Auth,
  Home,
  Pulsen,
  TdcErhvervDashboard,
  RelatelDashboard,
  NotFound,
  EmployeeDetail,
  EmployeeOnboarding,
  ResetPassword,
  VagtLocationDetail,
  ContractSign,
  PulseSurvey,
  PublicPulseSurvey,
  MyProfile,
  MyGoals,
  InvoiceFlow,
  CandidateDetail,
  PublicCandidateBooking,
  RolePreview,
  EesyTmDashboard,
  HiperDashboard,
  UnitedDashboard,
  CsTop20Dashboard,
  DashboardHome,
  FieldmarketingDashboardFull,
  AseFmDashboard,
  CphSalesDashboard,
  SalesOverviewAll,
  Messages,
  TvBoardLogin,
  TvBoardView,
  TvBoardDirect,
  LiveStats,
  PublicReferralForm,
  TdcOpsummeringPublic,
  TdcSalgPublic,
  TvLeagueDashboard,
  FieldmarketingSamleside,
  RetSalgSamleside,
  TdcSamleside,
  KunderOgPriserSamleside,
  RapporterSamleside,
  PowerdagSamleside,
  ComplianceSamleside,
  AmoSamleside,
  AdministrationSamleside,
  TdcMonthlyGoalBoard,
  RelatelMonthlyGoalBoard,
  EesyFmMonthlyGoalBoard,
  YouseeFmMonthlyGoalBoard,
  EesyTmMonthlyGoalBoard,
  HiperMonthlyGoalBoard,
  ShortLinkRedirect,
  PublicUnsubscribe,
} from "./pages";
import { SmartRedirect } from "./guards";

export const routes: RouteConfig[] = [
  { path: "/", component: SmartRedirect, access: "public" },
  { path: "/auth", component: Auth, access: "auth" },
  { path: "/onboarding", component: EmployeeOnboarding, access: "public" },
  { path: "/reset-password", component: ResetPassword, access: "public" },

  { path: "/home", component: Home, access: "role", positionPermission: "menu_home" },
  { path: "/storkbook", component: Pulsen, access: "role", positionPermission: "menu_pulsen" },
  { path: "/storkbook/demo", component: redirectTo("/storkbook"), access: "protected" },
  { path: "/pulsen", component: PulsenRedirect, access: "protected" },
  { path: "/pulsen/demo", component: redirectTo("/storkbook"), access: "protected" },
  { path: "/head-to-head", component: redirectTo("/spil?tab=head2head"), access: "protected" },
  
  { path: "/my-schedule", component: MyScheduleRedirect, access: "protected" },
  { path: "/my-profile", component: MyProfile, access: "role", positionPermission: "menu_my_profile" },
  { path: "/my-goals", component: MyGoals, access: "role", positionPermission: "menu_my_goals" },
  { path: "/my-goals/:employeeId", component: MyGoals, access: "role", positionPermission: "menu_my_goals" },
  { path: "/team-goals", component: redirectTo("/mit-team?tab=team-goals"), access: "protected" },
  { path: "/my-contracts", component: MyContractsRedirect, access: "protected" },
  { path: "/pulse-survey", component: PulseSurvey, access: "protected" },
  { path: "/career-wishes", component: CareerWishesRedirect, access: "protected" },
  { path: "/car-quiz", component: redirectTo("/my-profile?tab=kodeks"), access: "protected" },
  { path: "/code-of-conduct", component: redirectTo("/my-profile?tab=kodeks"), access: "protected" },
  { path: "/time-stamp", component: redirectTo("/vagter?tab=stempelur"), access: "protected" },
  { path: "/my-time-clock", component: redirectTo("/vagter?tab=stempelur"), access: "protected" },
  { path: "/extra-work", component: redirectTo("/home"), access: "protected" },
  { path: "/messages", component: Messages, access: "role", positionPermission: "menu_messages_personal" },
  { path: "/refer-a-friend", component: redirectTo("/my-profile?tab=anbefal"), access: "protected" },
  { path: "/perks", component: redirectTo("/my-profile?tab=fordele"), access: "protected" },
  { path: "/immediate-payment-ase", component: redirectTo("/registrer-salg?tab=straksbetaling"), access: "protected" },
  { path: "/vagter", component: VagterSamleside, access: "protected" },
  { path: "/registrer-salg", component: RegistrerSalgSamleside, access: "protected" },
  { path: "/spil", component: SpilSamleside, access: "protected" },
  { path: "/commission-league", component: redirectTo("/spil?tab=superligaen"), access: "protected" },
  

  { path: "/refer/:code", component: PublicReferralForm, access: "public" },
  { path: "/tdc-public", component: TdcOpsummeringPublic, access: "public" },
  { path: "/tdc-salg", component: TdcSalgPublic, access: "public" },
  { path: "/book/:candidateId", component: PublicCandidateBooking, access: "public" },
  { path: "/unsubscribe/:candidateId", component: PublicUnsubscribe, access: "public" },
  { path: "/r/:code", component: ShortLinkRedirect, access: "public" },
  { path: "/contract/:id", component: ContractSign, access: "public" },
  { path: "/contract/sign/:id", component: ContractSign, access: "public" },

  { path: "/dashboard", component: redirectTo("/home"), access: "protected" },
  { path: "/agents", component: redirectTo("/admin?tab=agenter"), access: "protected" },
  { path: "/sales", component: redirectTo("/live-stats"), access: "protected" },

  { path: "/kunder-og-priser", component: KunderOgPriserSamleside, access: "protected" },
  { path: "/mg-test", component: redirectTo("/kunder-og-priser"), access: "protected" },
  { path: "/mg/data-import", component: redirectTo("/kunder-og-priser"), access: "protected" },

  { path: "/logikker", component: redirectTo("/admin?tab=logikker"), access: "protected" },
  { path: "/employees", component: MedarbejdereSamleside, access: "protected" },
  { path: "/employees/:id", component: EmployeeDetail, access: "role", positionPermission: "menu_employees" },
  { path: "/login-log", component: redirectTo("/admin?tab=sikkerhed&side=login-log"), access: "protected" },
  { path: "/upcoming-starts", component: redirectTo("/employees?tab=upcoming-starts"), access: "protected" },

  { path: "/settings", component: redirectTo("/admin?tab=indstillinger&side=settings"), access: "protected" },

  { path: "/vagt-flow/my-schedule", component: redirectTo("/vagter?tab=vagtplan"), access: "protected" },
  { path: "/vagt-flow", component: FieldmarketingSamleside, access: "protected" },
  { path: "/vagt-flow/booking", component: redirectTo("/vagt-flow?fane=booking"), access: "protected" },
  { path: "/vagt-flow/book-week", component: redirectTo("/vagt-flow?fane=booking"), access: "protected" },
  { path: "/vagt-flow/locations", component: redirectTo("/vagt-flow?fane=locations"), access: "protected" },
  {
    path: "/vagt-flow/locations/:id",
    component: VagtLocationDetail,
    access: "role",
    positionPermission: "menu_fm_locations",
  },
  { path: "/vagt-flow/bookings", component: redirectTo("/vagt-flow?fane=booking&tab=bookings"), access: "protected" },
  { path: "/vagt-flow/vehicles", component: redirectTo("/vagt-flow"), access: "protected" },
  { path: "/vagt-flow/time-off", component: redirectTo("/shift-planning?tab=absence"), access: "protected" },
  { path: "/vagt-flow/sales-registration", component: redirectTo("/registrer-salg?tab=fm"), access: "protected" },
  { path: "/vagt-flow/billing", component: redirectTo("/vagt-flow?fane=billing"), access: "protected" },
  { path: "/vagt-flow/travel-expenses", component: redirectTo("/vagt-flow"), access: "protected" },
  { path: "/vagt-flow/edit-sales", component: redirectTo("/ret-salg?tab=edit-sales"), access: "protected" },
  { path: "/vagt-flow/eesy-fm-deviations", component: redirectTo("/vagt-flow?fane=eesy-fm-deviations"), access: "protected" },

  { path: "/shift-planning", component: VagtplanSamleside, access: "protected" },
  { path: "/mit-team", component: MitTeamSamleside, access: "protected" },
  { path: "/shift-planning/my-schedule", component: redirectTo("/vagter?tab=vagtplan"), access: "protected" },
  { path: "/shift-planning/absence", component: redirectTo("/shift-planning?tab=absence"), access: "protected" },
  { path: "/shift-planning/time-tracking", component: redirectTo("/shift-planning"), access: "protected" },

  { path: "/extra-work-admin", component: redirectTo("/shift-planning"), access: "protected" },
  { path: "/contracts", component: KontrakterSamleside, access: "protected" },
  { path: "/company-overview", component: redirectTo("/employees?tab=company-overview"), access: "protected" },
  { path: "/onboarding-analyse", component: redirectTo("/employees?tab=onboarding-analyse"), access: "protected" },
  { path: "/email-templates", component: redirectTo("/contracts?tab=email-templates"), access: "protected" },
  { path: "/pulse-survey-results", component: redirectTo("/mit-team?tab=pulse-survey-results"), access: "protected" },
  { path: "/career-wishes-overview", component: redirectTo("/contracts?tab=career-wishes-overview"), access: "protected" },
  // Adgang håndhæves af invoiceflow_access (RLS); siden viser selv afvisning.
  { path: "/invoiceflow", component: InvoiceFlow, access: "protected" },
  { path: "/customer-inquiries", component: redirectTo("/kunder-og-priser?tab=henvendelser"), access: "protected" },
  
  // Client Forecast
  { path: "/client-forecast", component: redirectTo("/home"), access: "protected" },
  { path: "/client-forecast/:id", component: redirectTo("/home"), access: "protected" },
  { path: "/car-quiz-admin", component: redirectTo("/mit-team?tab=car-quiz-admin"), access: "protected" },
  { path: "/code-of-conduct-admin", component: redirectTo("/mit-team?tab=code-of-conduct-admin"), access: "protected" },

  { path: "/recruitment", component: RekrutteringSamleside, access: "protected" },
  { path: "/recruitment/candidates", component: redirectTo("/recruitment?tab=candidates"), access: "protected" },
  {
    path: "/recruitment/candidates/:id",
    component: CandidateDetail,
    access: "role",
    positionPermission: "menu_candidates",
  },
  { path: "/recruitment/messages", component: redirectTo("/recruitment?tab=messages"), access: "protected" },
  { path: "/recruitment/sms-templates", component: redirectTo("/recruitment?tab=sms-templates"), access: "protected" },
  { path: "/recruitment/email-templates", component: redirectTo("/recruitment?tab=email-templates"), access: "protected" },
  { path: "/recruitment/winback", component: redirectTo("/recruitment?tab=winback"), access: "protected" },
  { path: "/recruitment/upcoming-interviews", component: redirectTo("/recruitment?tab=upcoming-interviews"), access: "protected" },
  { path: "/recruitment/upcoming-hires", component: redirectTo("/recruitment?tab=upcoming-hires"), access: "protected" },
  { path: "/recruitment/booking-flow", component: redirectTo("/recruitment?tab=booking-flow"), access: "protected" },
  { path: "/recruitment/booking-flow/engagement", component: redirectTo("/recruitment?tab=engagement"), access: "protected" },
  { path: "/recruitment/referrals", component: redirectTo("/recruitment?tab=referrals"), access: "protected" },

  { path: "/client-sales-overview", component: redirectTo("/kunder-og-priser"), access: "protected" },
  { path: "/boards/sales", component: redirectTo("/dashboards"), access: "protected" },

  // Dashboard Landing Page
  { path: "/dashboards", component: DashboardHome, access: "protected" },

  // Team Dashboards - access controlled at runtime via useRequireDashboardAccess hook
  { path: "/dashboards/cph-sales", component: CphSalesDashboard, access: "protected" },
  { path: "/dashboards/fieldmarketing", component: FieldmarketingDashboardFull, access: "protected" },
  { path: "/dashboards/ase-fm", component: AseFmDashboard, access: "protected" },
  { path: "/dashboards/tdc-erhverv", component: TdcErhvervDashboard, access: "protected" },
  { path: "/dashboards/tdc-monthly-goal", component: TdcMonthlyGoalBoard, access: "protected" },
  { path: "/dashboards/relatel-monthly-goal", component: RelatelMonthlyGoalBoard, access: "protected" },
  { path: "/dashboards/eesy-fm-monthly-goal", component: EesyFmMonthlyGoalBoard, access: "protected" },
  { path: "/dashboards/yousee-fm-monthly-goal", component: YouseeFmMonthlyGoalBoard, access: "protected" },
  { path: "/dashboards/eesy-tm-monthly-goal", component: EesyTmMonthlyGoalBoard, access: "protected" },
  { path: "/dashboards/hiper-monthly-goal", component: HiperMonthlyGoalBoard, access: "protected" },
  { path: "/dashboards/relatel", component: RelatelDashboard, access: "protected" },
  { path: "/dashboards/relatel-products", component: redirectTo("/dashboards"), access: "protected" },
  { path: "/dashboards/eesy-tm", component: EesyTmDashboard, access: "protected" },
  { path: "/dashboards/hiper", component: HiperDashboard, access: "protected" },
  { path: "/dashboards/united", component: UnitedDashboard, access: "protected" },
  { path: "/dashboards/cs-top-20", component: CsTop20Dashboard, access: "protected" },
  { path: "/dashboards/sales-overview-all", component: SalesOverviewAll, access: "protected" },
  { path: "/dashboards/commission-league", component: TvLeagueDashboard, access: "protected" },
  { path: "/dashboards/powerdag", component: PowerdagSamleside, access: "protected" },
  { path: "/dashboards/powerdag/input", component: redirectTo("/dashboards/powerdag?tab=input"), access: "protected" },
  { path: "/dashboards/powerdag/admin", component: redirectTo("/dashboards/powerdag?tab=admin"), access: "protected" },

  // Dashboard Admin pages - restricted to those with dashboard admin permission
  { path: "/dashboards/settings", component: redirectTo("/admin?tab=tv-tavler&side=dashboards-settings"), access: "protected" },
  { path: "/dashboards/design", component: redirectTo("/dashboards"), access: "protected" },

  { path: "/survey", component: PublicPulseSurvey, access: "public" },

  { path: "/closing-shifts", component: redirectTo("/shift-planning"), access: "protected" },

  { path: "/permissions", component: redirectTo("/admin?tab=rettigheder"), access: "protected" },
  { path: "/role-preview/:id", component: RolePreview, access: "role", positionPermission: "menu_permissions" },

  // Onboarding
  { path: "/onboarding-program", component: OnboardingSamleside, access: "protected" },
  { path: "/onboarding-program/kursus", component: redirectTo("/onboarding-program"), access: "protected" },
  { path: "/my-feedback", component: redirectTo("/my-profile?tab=feedback"), access: "protected" },
  { path: "/coaching-templates", component: redirectTo("/onboarding-program?tab=coaching-templates"), access: "protected" },
  // Fareflag: adgangen haandhaeves i databasen og i selve siden (kun ledere)
  { path: "/opstartshold", component: redirectTo("/onboarding-program?tab=opstartshold"), access: "protected" },

  // Kvalitetskontrol: adgangen haandhaeves i databasen (RLS + RPC) og i siden
  { path: "/kvalitetskontrol", component: redirectTo("/mit-team?tab=kvalitetskontrol"), access: "protected" },
  { path: "/kvalitetskontrol/administration", component: redirectTo("/mit-team?tab=administration"), access: "protected" },

  { path: "/excel-field-matcher", component: redirectTo("/employees"), access: "protected" },

  // TV Board routes
  { path: "/t/:code", component: TvBoardDirect, access: "public" },
  { path: "/tv", component: TvBoardLogin, access: "public" },
  { path: "/tv/:slug", component: TvBoardView, access: "public" },
  { path: "/tv-board-admin", component: redirectTo("/admin?tab=tv-tavler&side=tv-board-admin"), access: "protected" },

  // Live Stats (hidden from sidebar, accessible via URL only)
  { path: "/live-stats", component: LiveStats, access: "protected" },

  // Reports
  { path: "/reports/admin", component: RapporterSamleside, access: "protected" },
  { path: "/reports/management", component: redirectTo("/reports/admin?tab=management"), access: "protected" },
  { path: "/reports/employee", component: redirectTo("/reports/admin"), access: "protected" },
  { path: "/reports/daily", component: redirectTo("/reports/admin?tab=daily"), access: "protected" },
  { path: "/reports/revenue-by-client", component: redirectTo("/reports/admin?tab=revenue-by-client"), access: "protected" },
  { path: "/ret-salg", component: RetSalgSamleside, access: "protected" },
  { path: "/reports/tdc-erhverv-edit-sales", component: redirectTo("/ret-salg?tab=tdc-erhverv-edit-sales"), access: "protected" },
  { path: "/reports/weekly-lead-closure", component: redirectTo("/reports/admin?tab=weekly-lead-closure"), access: "protected" },
  // Adgang håndhæves i siden via useTrygEditAccess (ejere + allowlist), da Filip/Annika
  // ikke har rollen. Rutens rolle-guard ville ellers afvise dem.
  { path: "/reports/tryg-edit-sales", component: redirectTo("/ret-salg?tab=tryg-edit-sales"), access: "protected" },

  // Security Dashboard
  { path: "/admin/security", component: redirectTo("/admin?tab=sikkerhed&side=security"), access: "protected" },

  // System Stability (integration health dashboard)
  { path: "/system-stability", component: redirectTo("/admin?tab=stabilitet"), access: "protected" },


  // KPI Definitions (Owner only)
  { path: "/admin/kpi-definitions", component: redirectTo("/admin?tab=kpi-definitioner"), access: "protected" },

  // Salary
  { path: "/salary/types", component: redirectTo("/admin?tab=indstillinger&side=types"), access: "protected" },
  { path: "/salary/cancellations", component: redirectTo("/reports/admin?tab=cancellations"), access: "protected" },

  // TDC Opsummering
  { path: "/tdc", component: TdcSamleside, access: "protected" },
  { path: "/tdc-opsummering", component: redirectTo("/tdc?tab=tdc-opsummering"), access: "protected" },
  { path: "/tdc-idriftsaettelse", component: redirectTo("/tdc?tab=tdc-idriftsaettelse"), access: "protected" },
  { path: "/tdc-salgsvaerktoej", component: redirectTo("/tdc?tab=tdc-opsummering"), access: "protected" },
  { path: "/fiber-registrering", component: redirectTo("/tdc?tab=fiber-registrering"), access: "protected" },

  // Economic Upload (Owner only)
  { path: "/admin/economic-upload", component: redirectTo("/reports/admin"), access: "protected" },

  // Economic (fjernet 26/10 – omdirigeringer)
  { path: "/economic", component: redirectTo("/reports/admin"), access: "protected" },
  { path: "/economic/posteringer", component: redirectTo("/reports/admin"), access: "protected" },
  { path: "/economic/expenses", component: redirectTo("/reports/admin"), access: "protected" },
  { path: "/economic/budget", component: redirectTo("/reports/admin"), access: "protected" },
  { path: "/economic/mapping", component: redirectTo("/reports/admin"), access: "protected" },
  { path: "/economic/revenue-match", component: redirectTo("/reports/admin"), access: "protected" },
  { path: "/economic/sales-validation", component: redirectTo("/reports/admin"), access: "protected" },


  // AMO Compliance Hub
  { path: "/amo", component: AmoSamleside, access: "protected" },
  { path: "/amo/organisation", component: redirectTo("/amo?tab=organisation&side=organisation"), access: "protected" },
  { path: "/amo/annual-discussion", component: redirectTo("/amo?tab=moeder&side=annual-discussion"), access: "protected" },
  { path: "/amo/meetings", component: redirectTo("/amo?tab=moeder&side=meetings"), access: "protected" },
  { path: "/amo/apv", component: redirectTo("/amo?tab=apv&side=apv"), access: "protected" },
  { path: "/amo/kemi-apv", component: redirectTo("/amo?tab=apv&side=kemi-apv"), access: "protected" },
  { path: "/amo/training", component: redirectTo("/amo?tab=organisation&side=training"), access: "protected" },
  { path: "/amo/documents", component: redirectTo("/amo?tab=dokumenter&side=documents"), access: "protected" },
  { path: "/amo/tasks", component: redirectTo("/amo?tab=opgaver"), access: "protected" },
  { path: "/amo/settings", component: redirectTo("/amo?tab=dokumenter&side=settings"), access: "protected" },
  { path: "/amo/audit-log", component: redirectTo("/amo?tab=dokumenter&side=audit-log"), access: "protected" },

  // System Feedback
  { path: "/system-feedback", component: redirectTo("/home"), access: "protected" },

  // Compliance
  { path: "/compliance", component: ComplianceSamleside, access: "protected" },
  { path: "/compliance/employee-privacy", component: redirectTo("/compliance?tab=procedurer&side=employee-privacy"), access: "protected" },
  { path: "/compliance/processes", component: redirectTo("/compliance?tab=procedurer&side=processes"), access: "protected" },
  { path: "/compliance/admin", component: redirectTo("/compliance?tab=procedurer&side=admin"), access: "protected" },
  { path: "/compliance/notifications", component: redirectTo("/compliance?tab=procedurer&side=notifications"), access: "protected" },
  { path: "/compliance/processing-activities", component: redirectTo("/compliance?tab=registre&side=processing-activities"), access: "protected" },
  { path: "/compliance/security-incidents", component: redirectTo("/compliance?tab=logs&side=security-incidents"), access: "protected" },
  { path: "/compliance/data-transfers", component: redirectTo("/compliance?tab=registre&side=data-transfers"), access: "protected" },
  { path: "/compliance/retention-policies", component: redirectTo("/compliance?tab=registre&side=retention-policies"), access: "protected" },
  { path: "/compliance/dpia", component: redirectTo("/compliance?tab=registre&side=dpia"), access: "protected" },
  { path: "/compliance/awareness", component: redirectTo("/compliance?tab=procedurer&side=awareness"), access: "protected" },
  { path: "/compliance/ai-governance", component: redirectTo("/compliance?tab=procedurer&side=ai-governance"), access: "protected" },
  { path: "/compliance/access-log", component: redirectTo("/compliance?tab=logs&side=access-log"), access: "protected" },
  { path: "/compliance/contract-access-log", component: redirectTo("/compliance?tab=logs&side=contract-access-log"), access: "protected" },
  { path: "/compliance/documents/backup-policy", component: redirectTo("/compliance?tab=dokumenter&side=backup-policy"), access: "protected" },
  { path: "/compliance/documents/processing-registry", component: redirectTo("/compliance?tab=dokumenter&side=processing-registry"), access: "protected" },
  { path: "/compliance/documents/dpa-overview", component: redirectTo("/compliance?tab=dokumenter&side=dpa-overview"), access: "protected" },
  { path: "/compliance/documents/client-agreements", component: redirectTo("/compliance?tab=dokumenter&side=client-agreements"), access: "protected" },
  { path: "/compliance/dpa-addenda", component: redirectTo("/compliance?tab=registre&side=dpa-addenda"), access: "protected" },
  { path: "/compliance/documents/persondatapolitik", component: redirectTo("/compliance?tab=dokumenter&side=persondatapolitik"), access: "protected" },
  { path: "/compliance/documents/databrudsprocedure", component: redirectTo("/compliance?tab=dokumenter&side=databrudsprocedure"), access: "protected" },
  { path: "/compliance/documents/konsekvensvurdering-procedure", component: redirectTo("/compliance?tab=dokumenter&side=konsekvensvurdering-procedure"), access: "protected" },
  { path: "/compliance/documents/art30-pulsen", component: redirectTo("/compliance?tab=dokumenter&side=art30-pulsen"), access: "protected" },
  { path: "/compliance/documents/art30-push", component: redirectTo("/compliance?tab=dokumenter&side=art30-push"), access: "protected" },
  { path: "/compliance/breach-log", component: redirectTo("/compliance?tab=logs&side=breach-log"), access: "protected" },
  { path: "/compliance/impact-assessments", component: redirectTo("/compliance?tab=registre&side=impact-assessments"), access: "protected" },

  // Menu Editor (owner only)
  { path: "/admin", component: AdministrationSamleside, access: "protected" },
  { path: "/admin/menu-editor", component: redirectTo("/admin?tab=menu"), access: "protected" },

  // Manual sales entry (team United — enforced in the edge function)
  { path: "/tast-selv-salg", component: redirectTo("/registrer-salg?tab=salg"), access: "protected" },

  // IT (stab only — enforced by permission + staff flag in DB)
  { path: "/it/arbejdsstationer", component: redirectTo("/compliance?tab=it"), access: "protected" },


  { path: "*", component: NotFound, access: "public" },
];
