import { lazy } from "react";

export const TdcOpsummeringPublic = lazy(() => import("@/pages/TdcOpsummeringPublic"));

const lazyPage = (importFn: () => Promise<any>) => lazy(importFn);

export const Auth = lazyPage(() => import("@/pages/Auth"));
export const Home = lazyPage(() => import("@/pages/Home"));
export const Dashboard = lazyPage(() => import("@/pages/Dashboard"));
export const Agents = lazyPage(() => import("@/pages/Agents"));
export const Sales = lazyPage(() => import("@/pages/Sales"));
export const Settings = lazyPage(() => import("@/pages/Settings"));

export const MgTest = lazyPage(() => import("@/pages/MgTest"));

export const TdcErhvervDashboard = lazyPage(() => import("@/pages/TdcErhvervDashboard"));
export const RelatelDashboard = lazyPage(() => import("@/pages/RelatelDashboard"));
export const RelatelProductsDashboard = lazyPage(() => import("@/pages/RelatelProductsDashboard"));
export const UnitedDashboard = lazyPage(() => import("@/pages/UnitedDashboard"));
export const CsTop20Dashboard = lazyPage(() => import("@/pages/CsTop20Dashboard"));
export const NotFound = lazyPage(() => import("@/pages/NotFound"));
export const Logikker = lazyPage(() => import("@/pages/Logikker"));
export const EmployeeMasterData = lazyPage(() => import("@/pages/EmployeeMasterData"));
export const EmployeeDetail = lazyPage(() => import("@/pages/EmployeeDetail"));
export const EmployeeOnboarding = lazyPage(() => import("@/pages/EmployeeOnboarding"));
export const ResetPassword = lazyPage(() => import("@/pages/ResetPassword"));

export const VagtFlowIndex = lazyPage(() => import("@/pages/vagt-flow/Index"));
export const VagtBookWeek = lazyPage(() => import("@/pages/vagt-flow/BookWeek"));
export const VagtLocations = lazyPage(() => import("@/pages/vagt-flow/Locations"));
export const VagtBookings = lazyPage(() => import("@/pages/vagt-flow/Bookings"));
export const VagtBookingManagement = lazyPage(() => import("@/pages/vagt-flow/BookingManagement"));
export const VagtVehicles = lazyPage(() => import("@/pages/vagt-flow/Vehicles"));
export const VagtTimeOffRequests = lazyPage(() => import("@/pages/vagt-flow/TimeOffRequests"));
export const VagtLocationDetail = lazyPage(() => import("@/pages/vagt-flow/LocationDetail"));
export const VagtBilling = lazyPage(() => import("@/pages/vagt-flow/Billing"));
export const VagtSalesRegistration = lazyPage(() => import("@/pages/vagt-flow/SalesRegistration"));
export const VagtFieldmarketingDashboard = lazyPage(() => import("@/pages/vagt-flow/FieldmarketingDashboard"));
export const VagtTravelExpenses = lazyPage(() => import("@/pages/vagt-flow/TravelExpenses"));
export const VagtEditSalesRegistrations = lazyPage(() => import("@/pages/vagt-flow/EditSalesRegistrations"));
export const MyBookingSchedule = lazyPage(() => import("@/pages/vagt-flow/MyBookingSchedule"));

export const ShiftOverview = lazyPage(() => import("@/pages/shift-planning/ShiftOverview"));
export const MySchedule = lazyPage(() => import("@/pages/shift-planning/MySchedule"));
export const AbsenceManagement = lazyPage(() => import("@/pages/shift-planning/AbsenceManagement"));
export const TimeTracking = lazyPage(() => import("@/pages/shift-planning/TimeTracking"));

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
export const CarQuiz = lazyPage(() => import("@/pages/CarQuiz"));
export const CarQuizAdmin = lazyPage(() => import("@/pages/CarQuizAdmin"));
export const CodeOfConduct = lazyPage(() => import("@/pages/CodeOfConduct"));
export const CodeOfConductAdmin = lazyPage(() => import("@/pages/CodeOfConductAdmin"));
export const ExtraWork = lazyPage(() => import("@/pages/ExtraWork"));
export const ExtraWorkAdmin = lazyPage(() => import("@/pages/ExtraWorkAdmin"));
export const MyTimeClock = lazyPage(() => import("@/pages/MyTimeClock"));

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
export const PublicCandidateBooking = lazyPage(() => import("@/pages/recruitment/PublicCandidateBooking"));

export const Some = lazyPage(() => import("@/pages/Some"));
export const TimeStamp = lazyPage(() => import("@/pages/TimeStamp"));

export const ClientSalesOverview = lazyPage(() => import("@/pages/ClientSalesOverview"));
export const SalesDashboard = lazyPage(() => import("@/pages/boards/SalesDashboard"));

export const ClosingShifts = lazyPage(() => import("@/pages/ClosingShifts"));
export const Permissions = lazyPage(() => import("@/pages/Permissions"));
export const CompanyOverview = lazyPage(() => import("@/pages/CompanyOverview"));
export const SystemEmailTemplates = lazyPage(() => import("@/pages/EmailTemplates"));

export const RolePreview = lazyPage(() => import("@/pages/RolePreview"));
export const LoginLog = lazyPage(() => import("@/pages/LoginLog"));

// Team Dashboards
export const DashboardHome = lazyPage(() => import("@/pages/dashboards/DashboardHome"));
export const EesyTmDashboard = lazyPage(() => import("@/pages/EesyTmDashboard"));
export const FieldmarketingDashboardFull = lazyPage(() => import("@/pages/dashboards/FieldmarketingDashboardFull"));
export const CphSalesDashboard = lazyPage(() => import("@/pages/dashboards/CphSalesDashboard"));
export const DashboardSettings = lazyPage(() => import("@/pages/dashboards/DashboardSettings"));
export const DesignDashboard = lazyPage(() => import("@/pages/dashboards/DesignDashboard"));
export const SalesOverviewAll = lazyPage(() => import("@/pages/dashboards/SalesOverviewAll"));

export const Messages = lazyPage(() => import("@/pages/Messages"));

// Onboarding
export const OnboardingDashboard = lazyPage(() => import("@/pages/onboarding/OnboardingDashboard"));
export const OnboardingAdmin = lazyPage(() => import("@/pages/onboarding/OnboardingAdmin"));
export const OnboardingCourse = lazyPage(() => import("@/pages/onboarding/OnboardingCourse"));
export const MyFeedback = lazyPage(() => import("@/pages/onboarding/MyFeedback"));

export const ExcelFieldMatcher = lazyPage(() => import("@/pages/ExcelFieldMatcher"));

// TV Board
export const TvBoardLogin = lazyPage(() => import("@/pages/tv-board/TvBoardLogin"));
export const TvBoardView = lazyPage(() => import("@/pages/tv-board/TvBoardView"));
export const TvLeagueDashboard = lazyPage(() => import("@/pages/tv-board/TvLeagueDashboard"));
export const TvBoardAdmin = lazyPage(() => import("@/pages/tv-board/TvBoardAdmin"));
export const TvBoardDirect = lazyPage(() => import("@/pages/tv-board/TvBoardDirect"));

// Live Stats
export const LiveStats = lazyPage(() => import("@/pages/LiveStats"));

// Head to Head
export const HeadToHead = lazyPage(() => import("@/pages/HeadToHead"));

// Coaching Templates Admin
export const CoachingTemplates = lazyPage(() => import("@/pages/admin/CoachingTemplates"));

// Security Dashboard
export const SecurityDashboard = lazyPage(() => import("@/pages/admin/SecurityDashboard"));

// Referral Program
export const ReferAFriend = lazyPage(() => import("@/pages/ReferAFriend"));
export const PublicReferralForm = lazyPage(() => import("@/pages/PublicReferralForm"));
export const Referrals = lazyPage(() => import("@/pages/recruitment/Referrals"));

// Personnel
export const UpcomingStarts = lazyPage(() => import("@/pages/personnel/UpcomingStarts"));

// Reports
export const ReportsAdmin = lazyPage(() => import("@/pages/reports/ReportsAdmin"));
export const ReportsManagement = lazyPage(() => import("@/pages/reports/ReportsManagement"));
export const ReportsEmployee = lazyPage(() => import("@/pages/reports/ReportsEmployee"));
export const DailyReports = lazyPage(() => import("@/pages/reports/DailyReports"));
export const RevenueByClient = lazyPage(() => import("@/pages/reports/RevenueByClient"));

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

// Economic
export const EconomicUpload = lazyPage(() => import("@/pages/admin/EconomicUpload"));
export const EconomicLayout = lazyPage(() => import("@/pages/economic/EconomicLayout"));
export const EconomicDashboard = lazyPage(() => import("@/pages/economic/EconomicDashboard"));
export const EconomicExpenses = lazyPage(() => import("@/pages/economic/EconomicExpenses"));
export const EconomicPosteringer = lazyPage(() => import("@/pages/economic/EconomicPosteringer"));
export const EconomicBudget = lazyPage(() => import("@/pages/economic/EconomicBudget"));
export const EconomicMapping = lazyPage(() => import("@/pages/economic/EconomicMapping"));
export const EconomicRevenueMatch = lazyPage(() => import("@/pages/economic/EconomicRevenueMatch"));
export const SalesValidation = lazyPage(() => import("@/pages/economic/SalesValidation"));

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
export const ClientForecast = lazyPage(() => import("@/pages/ClientForecast"));
export const ClientForecastDetail = lazyPage(() => import("@/pages/ClientForecastDetail"));

// Powerdag
export const PowerdagBoard = lazyPage(() => import("@/pages/dashboards/PowerdagBoard"));
export const PowerdagInput = lazyPage(() => import("@/pages/dashboards/PowerdagInput"));
export const PowerdagAdmin = lazyPage(() => import("@/pages/dashboards/PowerdagAdmin"));

// System Feedback
export const SystemFeedback = lazyPage(() => import("@/pages/SystemFeedback"));

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

export const ShortLinkRedirect = lazyPage(() => import("@/pages/ShortLinkRedirect"));
export const MenuEditor = lazyPage(() => import("@/pages/MenuEditor"));
