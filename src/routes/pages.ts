import { lazy } from "react";

const lazyPage = (importFn: () => Promise<any>) => lazy(importFn);

export const Auth = lazyPage(() => import("@/pages/Auth"));
export const Home = lazyPage(() => import("@/pages/Home"));
export const Dashboard = lazyPage(() => import("@/pages/Dashboard"));
export const Agents = lazyPage(() => import("@/pages/Agents"));
export const Sales = lazyPage(() => import("@/pages/Sales"));
export const Payroll = lazyPage(() => import("@/pages/Payroll"));
export const Settings = lazyPage(() => import("@/pages/Settings"));

export const MgTest = lazyPage(() => import("@/pages/MgTest"));
export const MgTestDashboard = lazyPage(() => import("@/pages/MgTestDashboard"));

export const Codan = lazyPage(() => import("@/pages/Codan"));
export const TdcErhverv = lazyPage(() => import("@/pages/TdcErhverv"));
export const TdcErhvervDashboard = lazyPage(() => import("@/pages/TdcErhvervDashboard"));
export const RelatelDashboard = lazyPage(() => import("@/pages/RelatelDashboard"));
export const TrygDashboard = lazyPage(() => import("@/pages/TrygDashboard"));
export const AseDashboard = lazyPage(() => import("@/pages/AseDashboard"));
export const TeamOverview = lazyPage(() => import("@/pages/TeamOverview"));
export const NotFound = lazyPage(() => import("@/pages/NotFound"));
export const AdversusData = lazyPage(() => import("@/pages/AdversusData"));
export const DialerData = lazyPage(() => import("@/pages/DialerData"));
export const CallsData = lazyPage(() => import("@/pages/CallsData"));
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
export const VagtMinUge = lazyPage(() => import("@/pages/vagt-flow/MinUge"));
export const VagtVehicles = lazyPage(() => import("@/pages/vagt-flow/Vehicles"));
export const VagtTimeOffRequests = lazyPage(() => import("@/pages/vagt-flow/TimeOffRequests"));
export const VagtLocationDetail = lazyPage(() => import("@/pages/vagt-flow/LocationDetail"));
export const VagtBilling = lazyPage(() => import("@/pages/vagt-flow/Billing"));
export const VagtSalesRegistration = lazyPage(() => import("@/pages/vagt-flow/SalesRegistration"));
export const VagtFieldmarketingDashboard = lazyPage(() => import("@/pages/vagt-flow/FieldmarketingDashboard"));

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
export const CareerWishes = lazyPage(() => import("@/pages/CareerWishes"));
export const CareerWishesOverview = lazyPage(() => import("@/pages/CareerWishesOverview"));
export const CarQuiz = lazyPage(() => import("@/pages/CarQuiz"));
export const CarQuizAdmin = lazyPage(() => import("@/pages/CarQuizAdmin"));
export const CodeOfConduct = lazyPage(() => import("@/pages/CodeOfConduct"));
export const CodeOfConductAdmin = lazyPage(() => import("@/pages/CodeOfConductAdmin"));
export const ExtraWork = lazyPage(() => import("@/pages/ExtraWork"));
export const ExtraWorkAdmin = lazyPage(() => import("@/pages/ExtraWorkAdmin"));

export const RecruitmentDashboard = lazyPage(() => import("@/pages/recruitment/RecruitmentDashboard"));
export const RecruitmentCandidates = lazyPage(() => import("@/pages/recruitment/Candidates"));
export const CandidateDetail = lazyPage(() => import("@/pages/recruitment/CandidateDetail"));
export const RecruitmentMessages = lazyPage(() => import("@/pages/recruitment/Messages"));
export const SmsTemplates = lazyPage(() => import("@/pages/recruitment/SmsTemplates"));
export const EmailTemplatesPage = lazyPage(() => import("@/pages/recruitment/EmailTemplates"));
export const Winback = lazyPage(() => import("@/pages/recruitment/Winback"));
export const UpcomingInterviews = lazyPage(() => import("@/pages/recruitment/UpcomingInterviews"));
export const UpcomingHires = lazyPage(() => import("@/pages/recruitment/UpcomingHires"));

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
export const TeamDashboard = lazyPage(() => import("@/pages/dashboards/TeamDashboard"));
export const FieldmarketingDashboardFull = lazyPage(() => import("@/pages/dashboards/FieldmarketingDashboardFull"));
export const CphSalesDashboard = lazyPage(() => import("@/pages/dashboards/CphSalesDashboard"));
export const DashboardSettings = lazyPage(() => import("@/pages/dashboards/DashboardSettings"));
export const DesignDashboard = lazyPage(() => import("@/pages/dashboards/DesignDashboard"));
export const TdcErhvervGoalsDashboard = lazyPage(() => import("@/pages/dashboards/TdcErhvervGoalsDashboard"));
export const FieldmarketingGoalsDashboard = lazyPage(() => import("@/pages/dashboards/FieldmarketingGoalsDashboard"));

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
export const TvBoardAdmin = lazyPage(() => import("@/pages/tv-board/TvBoardAdmin"));

// Live Stats
export const LiveStats = lazyPage(() => import("@/pages/LiveStats"));

// Head to Head
export const HeadToHead = lazyPage(() => import("@/pages/HeadToHead"));

// Coaching Templates Admin
export const CoachingTemplates = lazyPage(() => import("@/pages/admin/CoachingTemplates"));

// Referral Program
export const ReferAFriend = lazyPage(() => import("@/pages/ReferAFriend"));
export const PublicReferralForm = lazyPage(() => import("@/pages/PublicReferralForm"));
export const Referrals = lazyPage(() => import("@/pages/recruitment/Referrals"));

