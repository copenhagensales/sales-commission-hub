import { lazy } from "react";
// Hjem hentes også sent, så grafbiblioteket (recharts) ikke ligger i første indlæsning.
export const Home = lazy(() => import("@/pages/Home"));

export const TdcOpsummeringPublic = lazy(() => import("@/pages/TdcOpsummeringPublic"));
export const TdcSalgPublic = lazy(() => import("@/pages/TdcSalgPublic"));

const lazyPage = (importFn: () => Promise<any>) => lazy(importFn);

export const Auth = lazyPage(() => import("@/pages/Auth"));
export const Pulsen = lazyPage(() => import("@/pages/Pulsen"));
export const Agents = lazyPage(() => import("@/pages/Agents"));
export const Settings = lazyPage(() => import("@/pages/Settings"));

export const MgTest = lazyPage(() => import("@/pages/MgTest"));

export const TdcErhvervDashboard = lazyPage(() => import("@/pages/TdcErhvervDashboard"));
export const RelatelDashboard = lazyPage(() => import("@/pages/RelatelDashboard"));
export const UnitedDashboard = lazyPage(() => import("@/pages/UnitedDashboard"));
export const CsTop20Dashboard = lazyPage(() => import("@/pages/CsTop20Dashboard"));
export const NotFound = lazyPage(() => import("@/pages/NotFound"));
export const Logikker = lazyPage(() => import("@/pages/Logikker"));
export const EmployeeMasterData = lazyPage(() => import("@/pages/EmployeeMasterData"));
export const EmployeeDetail = lazyPage(() => import("@/pages/EmployeeDetail"));
export const EmployeeOnboarding = lazyPage(() => import("@/pages/EmployeeOnboarding"));
export const ResetPassword = lazyPage(() => import("@/pages/ResetPassword"));

export const VagtFlowIndex = lazyPage(() => import("@/pages/vagt-flow/Index"));
export const VagtLocations = lazyPage(() => import("@/pages/vagt-flow/Locations"));
export const VagtBookingManagement = lazyPage(() => import("@/pages/vagt-flow/BookingManagement"));
export const VagtLocationDetail = lazyPage(() => import("@/pages/vagt-flow/LocationDetail"));
export const VagtBilling = lazyPage(() => import("@/pages/vagt-flow/Billing"));
export const VagtSalesRegistration = lazyPage(() => import("@/pages/vagt-flow/SalesRegistration"));
export const VagtFieldmarketingDashboard = lazyPage(() => import("@/pages/vagt-flow/FieldmarketingDashboard"));
export const VagtEditSalesRegistrations = lazyPage(() => import("@/pages/vagt-flow/EditSalesRegistrations"));
export const VagtEesyFmDeviations = lazyPage(() => import("@/pages/vagt-flow/EesyFmDeviations"));
export const MyBookingSchedule = lazyPage(() => import("@/pages/vagt-flow/MyBookingSchedule"));

export const ShiftOverview = lazyPage(() => import("@/pages/shift-planning/ShiftOverview"));
export const MySchedule = lazyPage(() => import("@/pages/shift-planning/MySchedule"));
export const AbsenceManagement = lazyPage(() => import("@/pages/shift-planning/AbsenceManagement"));

export const Contracts = lazyPage(() => import("@/pages/Contracts"));
export const MyContracts = lazyPage(() => import("@/pages/MyContracts"));
export const ContractSign = lazyPage(() => import("@/pages/ContractSign"));
export const PulseSurvey = lazyPage(() => import("@/pages/PulseSurvey"));
export const PulseSurveyResults = lazyPage(() => import("@/pages/PulseSurveyResults"));
export const PublicPulseSurvey = lazyPage(() => import("@/pages/PublicPulseSurvey"));
export const MyProfile = lazyPage(() => import("@/pages/MyProfile"));
export const MyGoals = lazyPage(() => import("@/pages/MyGoals"));
export const TeamGoals = lazyPage(() => import("@/pages/TeamGoals"));
export const CareerWishes = lazyPage(() => import("@/pages/CareerWishes"));
export const CareerWishesOverview = lazyPage(() => import("@/pages/CareerWishesOverview"));
export const InvoiceFlow = lazyPage(() => import("@/pages/InvoiceFlow"));
export const CarQuiz = lazyPage(() => import("@/pages/CarQuiz"));
export const CarQuizAdmin = lazyPage(() => import("@/pages/CarQuizAdmin"));
export const CodeOfConduct = lazyPage(() => import("@/pages/CodeOfConduct"));
export const CodeOfConductAdmin = lazyPage(() => import("@/pages/CodeOfConductAdmin"));

export const RecruitmentDashboard = lazyPage(() => import("@/pages/recruitment/RecruitmentDashboard"));
export const RecruitmentCandidates = lazyPage(() => import("@/pages/recruitment/Candidates"));
export const CandidateDetail = lazyPage(() => import("@/pages/recruitment/CandidateDetail"));
export const RecruitmentMessages = lazyPage(() => import("@/pages/recruitment/Messages"));
export const SmsTemplates = lazyPage(() => import("@/pages/recruitment/SmsTemplates"));
export const EmailTemplatesPage = lazyPage(() => import("@/pages/recruitment/EmailTemplates"));
export const Winback = lazyPage(() => import("@/pages/recruitment/Winback"));
export const UpcomingInterviews = lazyPage(() => import("@/pages/recruitment/UpcomingInterviews"));
export const UpcomingHires = lazyPage(() => import("@/pages/recruitment/UpcomingHires"));
export const BookingFlow = lazyPage(() => import("@/pages/recruitment/BookingFlow"));
export const BookingFlowEngagement = lazyPage(() => import("@/pages/recruitment/BookingFlowEngagement"));
export const PublicCandidateBooking = lazyPage(() => import("@/pages/recruitment/PublicCandidateBooking"));
export const PublicUnsubscribe = lazyPage(() => import("@/pages/recruitment/PublicUnsubscribe"));

export const TimeStamp = lazyPage(() => import("@/pages/TimeStamp"));


export const Permissions = lazyPage(() => import("@/pages/Permissions"));
export const CompanyOverview = lazyPage(() => import("@/pages/CompanyOverview"));
export const SystemEmailTemplates = lazyPage(() => import("@/pages/EmailTemplates"));

export const RolePreview = lazyPage(() => import("@/pages/RolePreview"));
export const LoginLog = lazyPage(() => import("@/pages/LoginLog"));

// Team Dashboards
export const DashboardHome = lazyPage(() => import("@/pages/dashboards/DashboardHome"));
export const HiperDashboard = lazyPage(() => import("@/pages/HiperDashboard"));
export const EesyTmDashboard = lazyPage(() => import("@/pages/EesyTmDashboard"));
export const FieldmarketingDashboardFull = lazyPage(() => import("@/pages/dashboards/FieldmarketingDashboardFull"));
export const AseFmDashboard = lazyPage(() => import("@/pages/dashboards/AseFmDashboard"));
export const CphSalesDashboard = lazyPage(() => import("@/pages/dashboards/CphSalesDashboard"));
export const DashboardSettings = lazyPage(() => import("@/pages/dashboards/DashboardSettings"));
export const SalesOverviewAll = lazyPage(() => import("@/pages/dashboards/SalesOverviewAll"));

export const Messages = lazyPage(() => import("@/pages/Messages"));

// Onboarding
export const OnboardingDashboard = lazyPage(() => import("@/pages/onboarding/OnboardingDashboard"));
export const RampTeam = lazyPage(() => import("@/pages/onboarding/RampTeam"));
export const QualityControl = lazyPage(() => import("@/pages/quality/QualityControl"));
export const QualityAdmin = lazyPage(() => import("@/pages/quality/QualityAdmin"));
export const OnboardingAdmin = lazyPage(() => import("@/pages/onboarding/OnboardingAdmin"));
export const MyFeedback = lazyPage(() => import("@/pages/onboarding/MyFeedback"));


// TV Board
export const TvBoardLogin = lazyPage(() => import("@/pages/tv-board/TvBoardLogin"));
export const TvBoardView = lazyPage(() => import("@/pages/tv-board/TvBoardView"));
export const TvLeagueDashboard = lazyPage(() => import("@/pages/tv-board/TvLeagueDashboard"));
export const TvBoardAdmin = lazyPage(() => import("@/pages/tv-board/TvBoardAdmin"));
export const TvBoardDirect = lazyPage(() => import("@/pages/tv-board/TvBoardDirect"));

// Live Stats
export const LiveStats = lazyPage(() => import("@/pages/LiveStats"));
export const Sales = lazyPage(() => import("@/pages/Sales"));

// Head to Head
export const HeadToHead = lazyPage(() => import("@/pages/HeadToHead"));

// Coaching Templates Admin
export const CoachingTemplates = lazyPage(() => import("@/pages/admin/CoachingTemplates"));

// Security Dashboard
export const SecurityDashboard = lazyPage(() => import("@/pages/admin/SecurityDashboard"));

// Referral Program
export const ReferAFriend = lazyPage(() => import("@/pages/ReferAFriend"));
export const EmployeePerks = lazyPage(() => import("@/pages/EmployeePerks"));
export const PublicReferralForm = lazyPage(() => import("@/pages/PublicReferralForm"));
export const Referrals = lazyPage(() => import("@/pages/recruitment/Referrals"));

// Personnel
export const UpcomingStarts = lazyPage(() => import("@/pages/personnel/UpcomingStarts"));

// Reports
export const ReportsAdmin = lazyPage(() => import("@/pages/reports/ReportsAdmin"));
export const ReportsManagement = lazyPage(() => import("@/pages/reports/ReportsManagement"));
export const DailyReports = lazyPage(() => import("@/pages/reports/DailyReports"));
export const RevenueByClient = lazyPage(() => import("@/pages/reports/RevenueByClient"));
export const WeeklyLeadClosureReport = lazyPage(() => import("@/pages/reports/WeeklyLeadClosureReport"));
export const TdcErhvervEditSales = lazyPage(() => import("@/pages/reports/TdcErhvervEditSales"));
export const TrygEditSales = lazyPage(() => import("@/pages/reports/TrygEditSales"));

// Salary Schemes
export const SalarySchemes = lazyPage(() => import("@/pages/SalarySchemes"));

// Commission League
export const CommissionLeague = lazyPage(() => import("@/pages/CommissionLeague"));


// League Admin


// H2H Admin


// Team H2H (for team leaders)


// KPI Definitions (Owner only)
export const KpiDefinitions = lazyPage(() => import("@/pages/admin/KpiDefinitions"));

// Salary
export const SalaryTypes = lazyPage(() => import("@/pages/SalaryTypes"));

// TDC Opsummering
export const TdcOpsummering = lazyPage(() => import("@/pages/TdcOpsummering"));
export const TdcIdriftsaettelse = lazyPage(() => import("@/pages/TdcIdriftsaettelse"));
export const FiberRegistrering = lazyPage(() => import("@/pages/FiberRegistrering"));

// Economic

export const ImmediatePaymentASE = lazyPage(() => import("@/pages/ImmediatePaymentASE"));

// Salary pages
export const Cancellations = lazyPage(() => import("@/pages/salary/Cancellations"));

// System Stability
export const SystemStability = lazyPage(() => import("@/pages/SystemStability"));

// Onboarding Analyse
export const OnboardingAnalyse = lazyPage(() => import("@/pages/OnboardingAnalyse"));

// AMO Compliance Hub
export const AmoDashboard = lazyPage(() => import("@/pages/amo/AmoDashboard"));
export const AmoPlaceholder = lazyPage(() => import("@/pages/amo/AmoPlaceholder"));
export const AmoOrganisation = lazyPage(() => import("@/pages/amo/AmoOrganisation"));
export const AmoMeetings = lazyPage(() => import("@/pages/amo/AmoMeetings"));
export const AmoAnnualDiscussion = lazyPage(() => import("@/pages/amo/AmoAnnualDiscussion"));
export const AmoApv = lazyPage(() => import("@/pages/amo/AmoApv"));
export const AmoKemiApv = lazyPage(() => import("@/pages/amo/AmoKemiApv"));
export const AmoTraining = lazyPage(() => import("@/pages/amo/AmoTraining"));
export const AmoDocuments = lazyPage(() => import("@/pages/amo/AmoDocuments"));
export const AmoTasks = lazyPage(() => import("@/pages/amo/AmoTasks"));
export const AmoAuditLog = lazyPage(() => import("@/pages/amo/AmoAuditLog"));
export const AmoSettings = lazyPage(() => import("@/pages/amo/AmoSettings"));

export const CustomerInquiries = lazyPage(() => import("@/pages/CustomerInquiries"));

// Client Forecast

// Powerdag
export const PowerdagBoard = lazyPage(() => import("@/pages/dashboards/PowerdagBoard"));
export const TdcMonthlyGoalBoard = lazyPage(() => import("@/pages/dashboards/TdcMonthlyGoalBoard"));
export const RelatelMonthlyGoalBoard = lazyPage(() => import("@/pages/dashboards/RelatelMonthlyGoalBoard"));
export const EesyFmMonthlyGoalBoard = lazyPage(() => import("@/pages/dashboards/EesyFmMonthlyGoalBoard"));
export const YouseeFmMonthlyGoalBoard = lazyPage(() => import("@/pages/dashboards/YouseeFmMonthlyGoalBoard"));
export const HiperMonthlyGoalBoard = lazyPage(() => import("@/pages/dashboards/HiperMonthlyGoalBoard"));
export const EesyTmMonthlyGoalBoard = lazyPage(() => import("@/pages/dashboards/EesyTmMonthlyGoalBoard"));
export const PowerdagInput = lazyPage(() => import("@/pages/dashboards/PowerdagInput"));
export const PowerdagAdmin = lazyPage(() => import("@/pages/dashboards/PowerdagAdmin"));

// System Feedback

// Compliance
export const ComplianceOverview = lazyPage(() => import("@/pages/compliance/ComplianceOverview"));
export const ComplianceEmployeePrivacy = lazyPage(() => import("@/pages/compliance/EmployeePrivacy"));
export const ComplianceInternalProcesses = lazyPage(() => import("@/pages/compliance/InternalProcesses"));
export const ComplianceAdminDocumentation = lazyPage(() => import("@/pages/compliance/AdminDocumentation"));
export const ComplianceNotifications = lazyPage(() => import("@/pages/compliance/ComplianceNotifications"));
export const ComplianceProcessingActivities = lazyPage(() => import("@/pages/compliance/ProcessingActivities"));
export const ComplianceSecurityIncidents = lazyPage(() => import("@/pages/compliance/SecurityIncidents"));
export const ComplianceDataTransferRegistry = lazyPage(() => import("@/pages/compliance/DataTransferRegistry"));
export const ComplianceRetentionPolicies = lazyPage(() => import("@/pages/compliance/RetentionPolicies"));
export const ComplianceDpia = lazyPage(() => import("@/pages/compliance/DpiaDocumentation"));
export const ComplianceGdprAwareness = lazyPage(() => import("@/pages/compliance/GdprAwareness"));
export const ComplianceAiGovernance = lazyPage(() => import("@/pages/compliance/AiGovernance"));
export const ComplianceSensitiveAccessLog = lazyPage(() => import("@/pages/compliance/SensitiveAccessLog"));
export const ComplianceContractAccessLog = lazyPage(() => import("@/pages/compliance/ContractAccessLog"));
export const ComplianceBackupPolicy = lazyPage(() => import("@/pages/compliance/BackupPolicy"));
export const ComplianceProcessingRegistry = lazyPage(() => import("@/pages/compliance/ProcessingRegistry"));
export const ComplianceDpaOverview = lazyPage(() => import("@/pages/compliance/DpaOverview"));
export const ComplianceClientAgreements = lazyPage(() => import("@/pages/compliance/ClientAgreements"));
export const ComplianceDpaAddenda = lazyPage(() => import("@/pages/compliance/DpaAddenda"));
export const CompliancePersondatapolitik = lazyPage(() => import("@/pages/compliance/MarkdownComplianceDoc").then((m) => ({ default: m.PersondatapolitikPage })));
export const ComplianceDatabrudsprocedure = lazyPage(() => import("@/pages/compliance/MarkdownComplianceDoc").then((m) => ({ default: m.DatabrudsprocedurePage })));
export const ComplianceKonsekvensvurderingProcedure = lazyPage(() => import("@/pages/compliance/MarkdownComplianceDoc").then((m) => ({ default: m.KonsekvensvurderingProcedurePage })));
export const ComplianceArt30Pulsen = lazyPage(() => import("@/pages/compliance/MarkdownComplianceDoc").then((m) => ({ default: m.Art30PulsenPage })));
export const ComplianceArt30Push = lazyPage(() => import("@/pages/compliance/MarkdownComplianceDoc").then((m) => ({ default: m.Art30PushPage })));
export const ComplianceBreachLog = lazyPage(() => import("@/pages/compliance/BreachLog"));
export const ComplianceImpactAssessments = lazyPage(() => import("@/pages/compliance/ImpactAssessments"));

export const ShortLinkRedirect = lazyPage(() => import("@/pages/ShortLinkRedirect"));
export const MenuEditor = lazyPage(() => import("@/pages/MenuEditor"));
export const TastSelvSalg = lazyPage(() => import("@/pages/TastSelvSalg"));

export const ItWorkstations = lazyPage(() => import("@/pages/it/ItWorkstations"));

// Samlesider (bundt b1)
export const VagterSamleside = lazyPage(() => import("@/pages/samlesider/MitArbejde").then((m) => ({ default: m.VagterSamleside })));
export const RegistrerSalgSamleside = lazyPage(() => import("@/pages/samlesider/MitArbejde").then((m) => ({ default: m.RegistrerSalgSamleside })));
export const SpilSamleside = lazyPage(() => import("@/pages/samlesider/MitArbejde").then((m) => ({ default: m.SpilSamleside })));
const tp = () => import("@/pages/samlesider/TeamPersonale");
export const VagtplanSamleside = lazyPage(() => tp().then((m) => ({ default: m.VagtplanSamleside })));
export const MitTeamSamleside = lazyPage(() => tp().then((m) => ({ default: m.MitTeamSamleside })));
export const OnboardingSamleside = lazyPage(() => tp().then((m) => ({ default: m.OnboardingSamleside })));
export const RekrutteringSamleside = lazyPage(() => tp().then((m) => ({ default: m.RekrutteringSamleside })));
export const MedarbejdereSamleside = lazyPage(() => tp().then((m) => ({ default: m.MedarbejdereSamleside })));
export const KontrakterSamleside = lazyPage(() => tp().then((m) => ({ default: m.KontrakterSamleside })));
// Samlesider (bundt b3)
const sr = () => import("@/pages/samlesider/SalgRapporter");
export const FieldmarketingSamleside = lazyPage(() => sr().then((m) => ({ default: m.FieldmarketingSamleside })));
export const RetSalgSamleside = lazyPage(() => sr().then((m) => ({ default: m.RetSalgSamleside })));
export const TdcSamleside = lazyPage(() => sr().then((m) => ({ default: m.TdcSamleside })));
export const KunderOgPriserSamleside = lazyPage(() => sr().then((m) => ({ default: m.KunderOgPriserSamleside })));
export const RapporterSamleside = lazyPage(() => sr().then((m) => ({ default: m.RapporterSamleside })));
export const PowerdagSamleside = lazyPage(() => sr().then((m) => ({ default: m.PowerdagSamleside })));
// Samlesider (bundt b4)
const ac = () => import("@/pages/samlesider/AdminCompliance");
export const ComplianceSamleside = lazyPage(() => ac().then((m) => ({ default: m.ComplianceSamleside })));
export const AmoSamleside = lazyPage(() => ac().then((m) => ({ default: m.AmoSamleside })));
export const AdministrationSamleside = lazyPage(() => ac().then((m) => ({ default: m.AdministrationSamleside })));
