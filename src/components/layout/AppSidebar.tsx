import { LayoutDashboard, Users, ShoppingCart, Wallet, Settings, LogOut, Percent, Shield, Building2, Calendar, MapPin, ChevronDown, ChevronRight, Car, Clock, UserCheck, Receipt, Database, ListChecks, ClipboardList, Timer, FileText, Crown, User, HeartHandshake, BarChart3, Sparkles, UserPlus, CalendarClock, UserCog, Video, Monitor, Phone, FlaskConical, Lock, Home, RefreshCcw, CalendarDays, MessageSquare, GraduationCap, Palette, Target, Activity, Swords, Mail, Gift, FileBarChart, CreditCard, Pencil, Trophy, Wrench, BookOpen } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import cphSalesLogo from "@/assets/cph-sales-logo.png";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePositionPermissions";
import { useRolePreview } from "@/contexts/RolePreviewContext";
import { useIsFieldmarketingEmployee } from "@/hooks/useFieldmarketingEmployee";
import { useEmployeeSmsUnreadCount } from "@/hooks/useEmployeeSmsConversations";
import { useCarQuizCompletion } from "@/hooks/useCarQuiz";
import { useIsSalgskonsulent, useCodeOfConductLock } from "@/hooks/useCodeOfConduct";
import { useTranslation } from "react-i18next";

type NavItem = { name: string; href: string; icon: typeof Users; badgeKey?: string };

interface AppSidebarProps {
  isMobile?: boolean;
  onNavigate?: () => void;
}

export function AppSidebar({ isMobile = false, onNavigate }: AppSidebarProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const p = usePermissions(); // Position permissions - THE ONLY source of truth
  const { isPreviewMode } = useRolePreview();
  
  const { data: isFieldmarketing } = useIsFieldmarketingEmployee();
  const { data: carQuizCompletion } = useCarQuizCompletion();
  const { data: isSalgskonsulent } = useIsSalgskonsulent();
  const { isRequired: codeOfConductRequired } = useCodeOfConductLock();
  const { data: employeeSmsUnreadCount = 0 } = useEmployeeSmsUnreadCount();
  
  const [mitHjemOpen, setMitHjemOpen] = useState(
    ["/home", "/head-to-head", "/messages", "/my-schedule", "/my-profile", "/my-goals", "/my-contracts", "/career-wishes", "/my-feedback", "/refer-a-friend"].some(path => location.pathname === path || location.pathname.startsWith(path))
  );
  const [shiftPlanningOpen, setShiftPlanningOpen] = useState(location.pathname.startsWith("/shift-planning") || location.pathname === "/time-stamp" || location.pathname === "/closing-shifts");
  const [vagtFlowOpen, setVagtFlowOpen] = useState(location.pathname.startsWith("/vagt-flow"));
  const [recruitmentOpen, setRecruitmentOpen] = useState(location.pathname.startsWith("/recruitment"));
  const [ledelseOpen, setLedelseOpen] = useState(
    ["/contracts", "/permissions", "/career-wishes-overview", "/company-overview", "/email-templates", "/admin/security"].some(path => location.pathname.startsWith(path))
  );
  const [personnelOpen, setPersonnelOpen] = useState(location.pathname.startsWith("/employees") || location.pathname === "/login-log" || location.pathname === "/upcoming-starts");
  const [mgOpen, setMgOpen] = useState(
    ["/payroll", "/tdc-erhverv", "/tdc-erhverv-dashboard", "/relatel-dashboard", "/tryg-dashboard", "/ase-dashboard", "/codan", "/mg-test", "/mg-test-dashboard", "/dialer-data", "/adversus-data", "/calls-data", "/team-overview"].includes(location.pathname)
  );
  const [dashboardsOpen, setDashboardsOpen] = useState(location.pathname.startsWith("/dashboards"));
  const [testOpen, setTestOpen] = useState(
    ["/car-quiz-admin", "/code-of-conduct-admin", "/pulse-survey-results"].includes(location.pathname)
  );
  const [someOpen, setSomeOpen] = useState(
    ["/some", "/extra-work"].includes(location.pathname)
  );
  const [onboardingOpen, setOnboardingOpen] = useState(
    location.pathname.startsWith("/onboarding-program") || location.pathname === "/onboarding-program/kursus" || location.pathname === "/coaching-templates"
  );
  const [reportsOpen, setReportsOpen] = useState(
    location.pathname.startsWith("/reports")
  );
  const [adminOpen, setAdminOpen] = useState(
    location.pathname.startsWith("/admin")
  );

  // Fetch employee name and pending contracts count
  const { data: employeeData } = useQuery({
    queryKey: ["sidebar-employee-data", user?.email],
    queryFn: async () => {
      if (!user?.email) return { name: null, pendingContracts: 0 };

      const lowerEmail = user.email.toLowerCase();
      const { data: employee } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .maybeSingle();

      if (!employee) return { name: null, pendingContracts: 0 };

      const { count } = await supabase
        .from("contracts")
        .select("*", { count: "exact", head: true })
        .eq("employee_id", employee.id)
        .eq("status", "pending_employee");

      return {
        name: `${employee.first_name} ${employee.last_name}`,
        pendingContracts: count || 0
      };
    },
    enabled: !!user?.email,
    staleTime: 30000,
  });

  // Fetch pending absence requests count
  const { data: pendingAbsenceCount = 0 } = useQuery({
    queryKey: ["pending-absence-count", user?.email],
    queryFn: async () => {
      if (!user?.email || !p.canViewAbsence) return 0;

      const lowerEmail = user.email.toLowerCase();
      const { data: currentEmployee } = await supabase
        .from("employee_master_data")
        .select("id")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .maybeSingle();

      if (!currentEmployee) return 0;

      const now = new Date().toISOString();

      // Based on data scope
      if (p.scopeAbsence === "alt") {
        const { count } = await supabase
          .from("absence_request_v2")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending")
          .or(`postponed_until.is.null,postponed_until.lt.${now}`);
        return count || 0;
      }

      // For team scope, get teams where current user is team_leader or assistant
      const { data: ledTeams } = await supabase
        .from("teams")
        .select("id")
        .or(`team_leader_id.eq.${currentEmployee.id},assistant_team_leader_id.eq.${currentEmployee.id}`);

      const ledTeamIds = ledTeams?.map(t => t.id) || [];
      if (ledTeamIds.length === 0) return 0;

      // Get all employees from those teams
      const { data: teamMembers } = await supabase
        .from("team_members")
        .select("employee_id")
        .in("team_id", ledTeamIds);

      const teamMemberIds = teamMembers?.map(tm => tm.employee_id) || [];
      if (teamMemberIds.length === 0) return 0;

      const { count } = await supabase
        .from("absence_request_v2")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")
        .or(`postponed_until.is.null,postponed_until.lt.${now}`)
        .in("employee_id", teamMemberIds);

      return count || 0;
    },
    enabled: !!user?.email && p.canViewAbsence,
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });

  // Fetch unread messages count using optimized server-side function
  const { data: unreadMessagesCount = 0 } = useQuery({
    queryKey: ["unread-messages-count", user?.email],
    queryFn: async () => {
      if (!user?.email) return 0;

      const lowerEmail = user.email.toLowerCase();
      const { data: currentEmployee } = await supabase
        .from("employee_master_data")
        .select("id")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .maybeSingle();

      if (!currentEmployee) return 0;

      // Use optimized server-side function instead of N+1 queries
      const { data, error } = await supabase.rpc("get_unread_message_count", { 
        p_employee_id: currentEmployee.id 
      });

      if (error) {
        console.error("Error fetching unread count:", error);
        return 0;
      }

      return data || 0;
    },
    enabled: !!user?.email,
    staleTime: 10000,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });

  // Fetch pending H2H challenges count
  const { data: pendingH2hCount = 0 } = useQuery({
    queryKey: ["pending-h2h-count", user?.email],
    queryFn: async () => {
      if (!user?.email) return 0;

      const lowerEmail = user.email.toLowerCase();
      const { data: currentEmployee } = await supabase
        .from("employee_master_data")
        .select("id")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .maybeSingle();

      if (!currentEmployee) return 0;

      const { count } = await supabase
        .from("h2h_challenges")
        .select("*", { count: "exact", head: true })
        .eq("opponent_employee_id", currentEmployee.id)
        .eq("status", "pending");

      return count || 0;
    },
    enabled: !!user?.email,
    staleTime: 10000,
    refetchOnWindowFocus: true,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Fetch pending referrals count (for recruiters)
  const { data: pendingReferralsCount = 0 } = useQuery({
    queryKey: ["pending-referrals-count"],
    queryFn: async () => {
      if (!p.canViewReferrals) return 0;

      const { count } = await supabase
        .from("employee_referrals")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      return count || 0;
    },
    enabled: p.canViewReferrals,
    staleTime: 30000,
    refetchOnWindowFocus: true,
    refetchInterval: 60000, // Auto-refresh every 60 seconds
  });

  // Fetch unread recruitment messages and missed calls count
  const { data: recruitmentNotificationsCount = 0 } = useQuery({
    queryKey: ["recruitment-notifications-count"],
    queryFn: async () => {
      if (!p.canViewMessages) return 0;

      // Count unread inbound SMS in recruitment context
      const { count: unreadSmsCount } = await supabase
        .from("communication_logs")
        .select("*", { count: "exact", head: true })
        .eq("read", false)
        .eq("direction", "inbound")
        .eq("type", "sms")
        .eq("context_type", "recruitment");

      // Count missed calls to candidates (from the last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { count: missedCallsCount } = await supabase
        .from("call_records")
        .select("*", { count: "exact", head: true })
        .not("candidate_id", "is", null)
        .in("status", ["missed", "no-answer", "busy"])
        .gte("started_at", sevenDaysAgo.toISOString());

      return (unreadSmsCount || 0) + (missedCallsCount || 0);
    },
    enabled: p.canViewMessages,
    staleTime: 30000,
    refetchOnWindowFocus: true,
    refetchInterval: 60000, // Auto-refresh every 60 seconds
  });

  const pendingContractsCount = employeeData?.pendingContracts ?? 0;
  const employeeName = employeeData?.name;

  const handleLogout = async () => {
    queryClient.clear();
    const keysToRemove = Object.keys(localStorage).filter(key => 
      key.startsWith('sb-') || key.includes('supabase')
    );
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Logout error:", e);
    }
    
    navigate("/auth");
  };

  const handleNavClick = (e?: React.MouseEvent) => {
    // Stop propagation to prevent Collapsible from capturing the click
    if (e) {
      e.stopPropagation();
    }
    if (isMobile && onNavigate) {
      onNavigate();
    }
  };

  const sidebarClasses = isMobile 
    ? "h-full w-full bg-sidebar overflow-y-auto" 
    : "fixed left-0 top-0 z-40 h-screen w-64 border-r border-sidebar-border bg-sidebar overflow-y-auto";

  // Wait for permissions to load
  if (p.isLoading) {
    return (
      <aside className={sidebarClasses}>
        <div className="flex h-full flex-col">
          {!isMobile && (
            <div className="flex h-16 items-center justify-center border-b border-sidebar-border px-4">
              <div 
                onClick={() => navigate("/")} 
                className="flex items-center justify-center px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 hover:bg-sidebar-accent/50"
              >
                <img src={cphSalesLogo} alt="CPH Sales" className="h-10 w-auto object-contain" />
              </div>
            </div>
          )}
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">{t("sidebar.loading")}</div>
          </div>
        </div>
      </aside>
    );
  }

  // Build main navigation based on position permissions (items NOT in "Mit Hjem" menu)
  const mainNavigation: NavItem[] = [];

  // Non-personal menu items (Salg and Logikker moved to bottom)

  // Check if SOME menu should be visible
  const showSomeMenu = p.canViewSome || p.canViewExtraWork;

  // Check if any Personnel menu items are visible
  const showPersonnelMenu = p.canViewEmployees || p.canViewTeams || p.canViewLoginLog || p.canViewUpcomingStarts;
  
  // Check if any Ledelse menu items are visible
  const showLedelseMenu = p.canViewContracts || p.canViewPermissions || p.canViewCareerWishesOverview || p.canViewSecurityDashboard;
  
  // Check if any MG menu items are visible
  const showMgMenu = p.canViewPayroll || p.canViewMgTest || p.canViewTestDashboard || 
                     p.canViewDialerData || p.canViewCallsData || p.canViewAdversusData ||
                     p.canViewTdcErhverv || p.canViewCodan;
  
  // Check if any Fieldmarketing items are visible
  const showFieldmarketingMenu = p.canViewFmOverview || p.canViewFmMyWeek || p.canViewFmBookWeek || 
                                  p.canViewFmBookings || p.canViewFmLocations || p.canViewFmVehicles ||
                                  p.canViewFmBilling || p.canViewFmTimeOff || p.canViewFmSalesRegistration;
  
  // Check if any Shift Planning items are visible
  const showShiftPlanningMenu = p.canViewShiftOverview || p.canViewAbsence || p.canViewTimeTracking || p.canViewTimeStamp || p.canViewClosingShifts;
  
  // Check if any Test menu items are visible
  const showTestMenu = p.canViewCarQuizAdmin || p.canViewCocAdmin || p.canViewPulseSurvey;
  
  // Check if any Recruitment items are visible
  const showRecruitmentMenu = p.canViewRecruitmentDashboard || p.canViewCandidates || p.canViewMessages ||
                               p.canViewSmsTemplates || p.canViewEmailTemplates || p.canViewWinback ||
                               p.canViewUpcomingInterviews || p.canViewUpcomingHires;
  
  // Check if any Onboarding items are visible - only show for admin users (system not ready for employees yet)
  const showOnboardingMenu = p.canViewOnboardingAdmin;

  // Check if any Reports menu items are visible
  const showReportsMenu = p.canViewReportsAdmin || p.canViewReportsDailyReports || p.canViewReportsManagement || p.canViewReportsEmployee;
  
  // Check if Admin menu should be visible
  const showAdminMenu = p.canViewKpiDefinitions;
  return (
    <aside className={sidebarClasses}>
      <div className="flex h-full flex-col">
        {!isMobile && (
          <div className="flex h-16 items-center justify-center border-b border-sidebar-border px-4">
            <div 
              onClick={() => navigate("/")} 
              className="flex items-center justify-center px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 hover:bg-sidebar-accent/50"
            >
              <img src={cphSalesLogo} alt="CPH Sales" className="h-10 w-auto object-contain" />
            </div>
          </div>
        )}
        <nav className="flex-1 space-y-1 p-4 pt-6">
          {/* Mit Hjem (My Home) menu */}
          <Collapsible open={mitHjemOpen} onOpenChange={setMitHjemOpen}>
            <CollapsibleTrigger className={cn(
              "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              ["/home", "/messages", "/my-schedule", "/my-profile", "/my-goals", "/my-contracts", "/career-wishes", "/my-feedback", "/head-to-head", "/refer-a-friend", "/commission-league"].some(path => location.pathname === path || location.pathname.startsWith(path))
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50"
            )}>
              <div className="flex items-center gap-3">
                <Home className="h-5 w-5" />
                {t("sidebar.myHome", "Mit Hjem")}
              </div>
              <div className="flex items-center gap-1">
                {(unreadMessagesCount > 0 || pendingContractsCount > 0 || pendingH2hCount > 0 || (p.canSendEmployeeSms && employeeSmsUnreadCount > 0)) && (
                  <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs animate-pulse">
                    {(unreadMessagesCount + pendingContractsCount + pendingH2hCount + (p.canSendEmployeeSms ? employeeSmsUnreadCount : 0)) > 99 ? "99+" : (unreadMessagesCount + pendingContractsCount + pendingH2hCount + (p.canSendEmployeeSms ? employeeSmsUnreadCount : 0))}
                  </Badge>
                )}
                {mitHjemOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-4 space-y-1 mt-1">
              {/* Hjem */}
              <NavLink
                to="/home"
                onClick={handleNavClick}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/home" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <Home className="h-4 w-4" />
                {t("sidebar.home")}
              </NavLink>

              {/* Head to Head */}
              <NavLink
                to="/head-to-head"
                onClick={handleNavClick}
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/head-to-head" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <Swords className="h-4 w-4" />
                  Head to Head
                </div>
                {pendingH2hCount > 0 && (
                  <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs animate-pulse">
                    {pendingH2hCount > 99 ? "99+" : pendingH2hCount}
                  </Badge>
                )}
              </NavLink>

              {/* Provisionsliga */}
              <NavLink
                to="/commission-league"
                onClick={(e) => {
                  handleNavClick(e);
                  // Mark as seen to hide "NY" badge
                  localStorage.setItem("league-sidebar-seen", "true");
                }}
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/commission-league" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <Trophy className="h-4 w-4" />
                  Cph Sales Ligaen
                </div>
                {!localStorage.getItem("league-sidebar-seen") && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-yellow-500 text-black rounded animate-pulse">
                    NY
                  </span>
                )}
              </NavLink>
              
              {/* Liga Test Board - kun for ejere */}
              {p.position?.name?.toLowerCase() === "ejer" && (
                <NavLink
                  to="/commission-league/test"
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ml-4",
                    location.pathname === "/commission-league/test" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  <FlaskConical className="h-4 w-4" />
                  Liga Test Board
                </NavLink>
              )}

              {/* Liga Admin - for ejere og teamledere */}
              {p.canViewLeagueAdmin && (
                <NavLink
                  to="/admin/league"
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ml-4",
                    location.pathname === "/admin/league" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  <Shield className="h-4 w-4" />
                  Liga Admin
                </NavLink>
              )}

              {/* H2H Admin */}
              {p.canViewLeagueAdmin && (
                <NavLink
                  to="/admin/h2h"
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ml-4",
                    location.pathname === "/admin/h2h" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  <Swords className="h-4 w-4" />
                  H2H Admin
                </NavLink>
              )}

              {/* Team H2H - for teamledere */}
              {p.canSeeTeamData && (
                <NavLink
                  to="/team/h2h"
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ml-4",
                    location.pathname === "/team/h2h" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  <Users className="h-4 w-4" />
                  Team H2H
                </NavLink>
              )}
              
              {/* Beskeder */}
              <NavLink
                to="/messages"
                onClick={handleNavClick}
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/messages" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-4 w-4" />
                  {t("sidebar.messages", "Beskeder")}
                </div>
                {(unreadMessagesCount > 0 || (p.canSendEmployeeSms && employeeSmsUnreadCount > 0)) && (
                  <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs animate-pulse">
                    {(unreadMessagesCount + (p.canSendEmployeeSms ? employeeSmsUnreadCount : 0)) > 99 ? "99+" : (unreadMessagesCount + (p.canSendEmployeeSms ? employeeSmsUnreadCount : 0))}
                  </Badge>
                )}
              </NavLink>
              
              {/* Min Kalender */}
              {p.canViewMySchedule && (
                <NavLink
                  to="/my-schedule"
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/my-schedule" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  <UserCheck className="h-4 w-4" />
                  {t("sidebar.myCalendar")}
                </NavLink>
              )}
              
              {/* Min Profil */}
              {p.canViewMyProfile && (
                <NavLink
                  to="/my-profile"
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/my-profile" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  <User className="h-4 w-4" />
                  {t("sidebar.myProfile")}
                </NavLink>
              )}
              
              {/* Mine Mål */}
              <NavLink
                to="/my-goals"
                onClick={handleNavClick}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/my-goals" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <Target className="h-4 w-4" />
                {t("sidebar.myGoals", "Mine Mål")}
              </NavLink>
              
              {/* Mine Kontrakter */}
              {p.canViewMyContracts && (
                <NavLink
                  to="/my-contracts"
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/my-contracts" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4" />
                    {t("sidebar.myContracts")}
                  </div>
                  {pendingContractsCount > 0 && (
                    <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">
                      {pendingContractsCount}
                    </Badge>
                  )}
                </NavLink>
              )}
              
              {/* Teamønsker og Karriere */}
              {p.canViewCareerWishes && (
                <NavLink
                  to="/career-wishes"
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/career-wishes" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  <Sparkles className="h-4 w-4" />
                  {t("sidebar.teamWishesCareer")}
                </NavLink>
              )}
              
              {/* Min Feedback */}
              <NavLink
                to="/my-feedback"
                onClick={handleNavClick}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/my-feedback" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <MessageSquare className="h-4 w-4" />
                Min Feedback
              </NavLink>
              
              {/* Anbefal en ven */}
              {p.canViewReferAFriend && (
                <NavLink
                  to="/refer-a-friend"
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/refer-a-friend" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  <Gift className="h-4 w-4" />
                  Anbefal en ven
                </NavLink>
              )}
            </CollapsibleContent>
          </Collapsible>
          
          {/* Main navigation items */}
          {mainNavigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={handleNavClick}
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </div>
              </NavLink>
            );
          })}

          {/* SOME menu */}
          {showSomeMenu && (
            <Collapsible open={someOpen} onOpenChange={setSomeOpen}>
              <CollapsibleTrigger className={cn(
                "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                ["/some", "/extra-work"].includes(location.pathname)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}>
                <div className="flex items-center gap-3">
                  <Video className="h-5 w-5" />
                  SOME
                </div>
                {someOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 space-y-1 mt-1">
                {p.canViewSome && (
                  <NavLink
                    to="/some"
                    onClick={handleNavClick}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                      location.pathname === "/some" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    )}
                  >
                    <Video className="h-4 w-4" />
                    SOME
                  </NavLink>
                )}
                {p.canViewExtraWork && (
                  <NavLink
                    to="/extra-work"
                    onClick={handleNavClick}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                      location.pathname === "/extra-work" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    )}
                  >
                    <HeartHandshake className="h-4 w-4" />
                    {t("sidebar.extraWork")}
                  </NavLink>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Personale (Personnel) menu */}
          {showPersonnelMenu && (
            <Collapsible open={personnelOpen} onOpenChange={setPersonnelOpen}>
              <CollapsibleTrigger className={cn(
                "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                location.pathname.startsWith("/employees") || location.pathname === "/login-log"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}>
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5" />
                  {t("sidebar.personnel")}
                </div>
                {personnelOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 space-y-1 mt-1">
                {p.canViewEmployees && (
                  <NavLink
                    to="/employees"
                    onClick={handleNavClick}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                      location.pathname === "/employees" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    )}
                  >
                    <Users className="h-4 w-4" />
                    {t("sidebar.employees")}
                  </NavLink>
                )}
                {p.canViewLoginLog && (
                  <NavLink
                    to="/login-log"
                    onClick={handleNavClick}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                      location.pathname === "/login-log" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    )}
                  >
                    <Clock className="h-4 w-4" />
                    {t("sidebar.loginLog")}
                  </NavLink>
                )}
                {p.canViewUpcomingStarts && (
                  <NavLink
                    to="/upcoming-starts"
                    onClick={handleNavClick}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                      location.pathname === "/upcoming-starts" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    )}
                  >
                    <UserPlus className="h-4 w-4" />
                    Kommende Opstarter
                  </NavLink>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Ledelse (Management) menu */}
          {showLedelseMenu && (
            <Collapsible open={ledelseOpen} onOpenChange={setLedelseOpen}>
              <CollapsibleTrigger className={cn(
                "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                ["/contracts", "/permissions", "/career-wishes-overview", "/company-overview", "/email-templates", "/admin/security"].some(path => location.pathname.startsWith(path)) 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}>
                <div className="flex items-center gap-3">
                  <Crown className="h-5 w-5" />
                  {t("sidebar.management")}
                </div>
                {ledelseOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 space-y-1 mt-1">
                {p.canViewContracts && (
                  <NavLink to="/company-overview" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/company-overview" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Building2 className="h-4 w-4" />
                    Virksomhedsoverblik
                  </NavLink>
                )}
                {p.canViewContracts && (
                  <NavLink to="/contracts" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/contracts" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <FileText className="h-4 w-4" />
                    {t("sidebar.contracts")}
                  </NavLink>
                )}
                {p.canViewPermissions && (
                  <NavLink to="/permissions" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/permissions" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Shield className="h-4 w-4" />
                    {t("sidebar.permissions")}
                  </NavLink>
                )}
                {p.canViewCareerWishesOverview && (
                  <NavLink to="/career-wishes-overview" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/career-wishes-overview" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Sparkles className="h-4 w-4" />
                    {t("sidebar.careerWishesOverview")}
                  </NavLink>
                )}
                {p.canViewContracts && (
                  <NavLink to="/email-templates" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/email-templates" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Mail className="h-4 w-4" />
                    Skabeloner
                  </NavLink>
                )}
                {p.canViewSecurityDashboard && (
                  <NavLink to="/admin/security" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/admin/security" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Lock className="h-4 w-4" />
                    {t("sidebar.security")}
                  </NavLink>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Firmabil menu item for Fieldmarketing employees */}
          {isFieldmarketing && (
            <NavLink
              to="/car-quiz"
              onClick={handleNavClick}
              className={cn(
                "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                location.pathname === "/car-quiz" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <div className="flex items-center gap-3">
                <Car className="h-5 w-5" />
                {t("sidebar.companyCar")}
              </div>
              {!carQuizCompletion && (
                <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">!</Badge>
              )}
            </NavLink>
          )}

          {/* Code of Conduct for Salgskonsulent */}
          {isSalgskonsulent && (
            <NavLink
              to="/code-of-conduct"
              onClick={handleNavClick}
              className={cn(
                "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                location.pathname === "/code-of-conduct" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5" />
                {t("sidebar.codeOfConduct")}
              </div>
              {codeOfConductRequired && (
                <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">!</Badge>
              )}
            </NavLink>
          )}

          {/* Intern Vagtplan menu */}
          {showShiftPlanningMenu && (
            <Collapsible open={shiftPlanningOpen} onOpenChange={setShiftPlanningOpen}>
              <CollapsibleTrigger className={cn(
                "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                (location.pathname.startsWith("/shift-planning") || location.pathname === "/time-stamp" || location.pathname === "/closing-shifts") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}>
                <div className="flex items-center gap-3">
                  <ClipboardList className="h-5 w-5" />
                  {t("sidebar.shiftPlan")}
                </div>
                {shiftPlanningOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 space-y-1 mt-1">
                {p.canViewShiftOverview && (
                  <NavLink to="/shift-planning" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/shift-planning" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Calendar className="h-4 w-4" />
                    {t("sidebar.shiftPlanLeader")}
                  </NavLink>
                )}
                {p.canViewAbsence && (
                  <NavLink to="/shift-planning/absence" onClick={handleNavClick} className={cn(
                    "flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/shift-planning/absence" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4" />
                      {t("sidebar.absence")}
                    </div>
                    {pendingAbsenceCount > 0 && (
                      <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">{pendingAbsenceCount}</Badge>
                    )}
                  </NavLink>
                )}
                {p.canViewTimeTracking && (
                  <NavLink to="/shift-planning/time-tracking" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/shift-planning/time-tracking" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Timer className="h-4 w-4" />
                    {t("sidebar.timeTracking")}
                  </NavLink>
                )}
                {p.canViewTimeStamp && (
                  <NavLink to="/time-stamp" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/time-stamp" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Clock className="h-4 w-4" />
                    {t("sidebar.timeClock")}
                  </NavLink>
                )}
                {p.canViewClosingShifts && (
                  <NavLink to="/closing-shifts" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/closing-shifts" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Lock className="h-4 w-4" />
                    {t("sidebar.closingShifts")}
                  </NavLink>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Fieldmarketing menu */}
          {showFieldmarketingMenu && (
            <Collapsible open={vagtFlowOpen} onOpenChange={setVagtFlowOpen}>
              <CollapsibleTrigger className={cn(
                "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                location.pathname.startsWith("/vagt-flow") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}>
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5" />
                  {t("sidebar.fieldmarketing")}
                </div>
                {vagtFlowOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 space-y-1 mt-1">
                {p.canViewFmOverview && (
                  <NavLink to="/vagt-flow" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/vagt-flow" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <LayoutDashboard className="h-4 w-4" />
                    {t("sidebar.overview")}
                  </NavLink>
                )}
                {p.canViewFmMyWeek && (
                  <NavLink to="/vagt-flow/min-uge" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/vagt-flow/min-uge" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <UserCheck className="h-4 w-4" />
                    {t("sidebar.myWeek")}
                  </NavLink>
                )}
                {/* Booking - single link to tabbed page */}
                {(p.canViewFmBookWeek || p.canViewFmBookings || p.canViewFmLocations) && (
                  <NavLink to="/vagt-flow/booking" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname.startsWith("/vagt-flow/booking") || 
                    location.pathname === "/vagt-flow/book-week" || 
                    location.pathname === "/vagt-flow/bookings" || 
                    location.pathname.startsWith("/vagt-flow/locations")
                      ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <CalendarDays className="h-4 w-4" />
                    {t("sidebar.booking", "Booking")}
                  </NavLink>
                )}
                {p.canViewFmVehicles && (
                  <NavLink to="/vagt-flow/vehicles" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/vagt-flow/vehicles" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Car className="h-4 w-4" />
                    {t("sidebar.vehicles")}
                  </NavLink>
                )}
                {p.canViewFmSalesRegistration && (
                  <NavLink to="/vagt-flow/fieldmarketing-dashboard" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/vagt-flow/fieldmarketing-dashboard" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <BarChart3 className="h-4 w-4" />
                    {t("sidebar.fieldmarketingDashboard")}
                  </NavLink>
                )}
                {p.canViewFmSalesRegistration && (
                  <NavLink to="/vagt-flow/sales-registration" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/vagt-flow/sales-registration" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <ShoppingCart className="h-4 w-4" />
                    {t("sidebar.salesRegistration")}
                  </NavLink>
                )}
                {p.canViewFmBilling && (
                  <NavLink to="/vagt-flow/billing" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/vagt-flow/billing" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Receipt className="h-4 w-4" />
                    {t("sidebar.billing")}
                  </NavLink>
                )}
                {p.canViewFmTravelExpenses && (
                  <NavLink to="/vagt-flow/travel-expenses" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/vagt-flow/travel-expenses" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <CreditCard className="h-4 w-4" />
                    {t("sidebar.travelExpenses")}
                  </NavLink>
                )}
                {p.canViewFmEditSales && (
                  <NavLink to="/vagt-flow/edit-sales" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/vagt-flow/edit-sales" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Pencil className="h-4 w-4" />
                    Ret salgsregistrering (Leder)
                  </NavLink>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* MG menu */}
          {showMgMenu && (
            <Collapsible open={mgOpen} onOpenChange={setMgOpen}>
              <CollapsibleTrigger className={cn(
                "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                ["/payroll", "/tdc-erhverv", "/tdc-erhverv-dashboard", "/relatel-dashboard", "/tryg-dashboard", "/ase-dashboard", "/codan", "/mg-test", "/adversus-data", "/team-overview"].includes(location.pathname) ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}>
                <div className="flex items-center gap-3">
                  <Percent className="h-5 w-5" />
                  {t("sidebar.mg")}
                </div>
                {mgOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 space-y-1 mt-1">
                {p.canViewPayroll && (
                  <NavLink to="/payroll" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/payroll" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Wallet className="h-4 w-4" />
                    {t("sidebar.payroll")}
                  </NavLink>
                )}
                {p.canViewMgTest && (
                  <NavLink to="/team-overview" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/team-overview" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Users className="h-4 w-4" />
                    {t("sidebar.teamOverview")}
                  </NavLink>
                )}
                {p.canViewTdcErhverv && (
                  <>
                    <NavLink to="/tdc-erhverv" onClick={handleNavClick} className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                      location.pathname === "/tdc-erhverv" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    )}>
                      <Building2 className="h-4 w-4" />
                      {t("sidebar.tdcErhverv")}
                    </NavLink>
                    <NavLink to="/tdc-erhverv-dashboard" onClick={handleNavClick} className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                      location.pathname === "/tdc-erhverv-dashboard" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    )}>
                      <BarChart3 className="h-4 w-4" />
                      TDC Dagsoverblik
                    </NavLink>
                  </>
                )}
                {p.canViewMgTest && (
                  <>
                    <NavLink to="/relatel-dashboard" onClick={handleNavClick} className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                      location.pathname === "/relatel-dashboard" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    )}>
                      <BarChart3 className="h-4 w-4" />
                      Relatel Dagsoverblik
                    </NavLink>
                    <NavLink to="/tryg-dashboard" onClick={handleNavClick} className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                      location.pathname === "/tryg-dashboard" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    )}>
                      <BarChart3 className="h-4 w-4" />
                      Tryg Dagsoverblik
                    </NavLink>
                    <NavLink to="/ase-dashboard" onClick={handleNavClick} className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                      location.pathname === "/ase-dashboard" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    )}>
                      <BarChart3 className="h-4 w-4" />
                      ASE Dagsoverblik
                    </NavLink>
                  </>
                )}
                {p.canViewCodan && (
                  <NavLink to="/codan" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/codan" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Shield className="h-4 w-4" />
                    {t("sidebar.codan")}
                  </NavLink>
                )}
                {p.canViewMgTest && (
                  <NavLink to="/mg-test" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/mg-test" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Percent className="h-4 w-4" />
                    {t("sidebar.mgTest")}
                  </NavLink>
                )}
                {p.canViewTestDashboard && (
                  <NavLink to="/mg-test-dashboard" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/mg-test-dashboard" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <FlaskConical className="h-4 w-4" />
                    {t("sidebar.testDashboard")}
                  </NavLink>
                )}
                {p.canViewDialerData && (
                  <NavLink to="/dialer-data" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/dialer-data" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Database className="h-4 w-4" />
                    {t("sidebar.dialerData")}
                  </NavLink>
                )}
                {p.canViewCallsData && (
                  <NavLink to="/calls-data" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/calls-data" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Phone className="h-4 w-4" />
                    {t("sidebar.callsData")}
                  </NavLink>
                )}
                {p.canViewAdversusData && (
                  <NavLink to="/adversus-data" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/adversus-data" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Database className="h-4 w-4" />
                    {t("sidebar.dataSourcesInfo")}
                  </NavLink>
                )}
                {p.canViewMgTest && (
                  <NavLink to="/1234" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/1234" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <BarChart3 className="h-4 w-4" />
                    1234
                  </NavLink>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}


          {/* Dashboards menu - Show only if user has permission for any dashboard */}
          {(p.canViewDashboardCphSales || p.canViewDashboardFieldmarketing || p.canViewDashboardEesyTm || 
            p.canViewDashboardTdcErhverv || p.canViewDashboardRelatel || p.canViewDashboardTryg || 
            p.canViewDashboardAse || p.canViewDashboardTest || p.canViewDashboardUnited || 
            p.canViewDashboardDesign || p.canViewDashboardSettings || p.canViewBoardsTest) && (
            <Collapsible open={dashboardsOpen} onOpenChange={setDashboardsOpen}>
              <CollapsibleTrigger className={cn(
                "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                location.pathname.startsWith("/dashboards") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}>
                <div className="flex items-center gap-3">
                  <Monitor className="h-5 w-5" />
                  Dashboards
                </div>
                {dashboardsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 space-y-1 mt-1">
                {p.canViewDashboardCphSales && (
                  <NavLink to="/dashboards/cph-sales" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/dashboards/cph-sales" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <BarChart3 className="h-4 w-4" />
                    Dagsboard CPH Sales
                  </NavLink>
                )}
                {p.canViewDashboardFieldmarketing && (
                  <NavLink to="/dashboards/fieldmarketing" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/dashboards/fieldmarketing" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <BarChart3 className="h-4 w-4" />
                    Fieldmarketing
                  </NavLink>
                )}
                {p.canViewDashboardFieldmarketing && (
                  <NavLink to="/dashboards/fieldmarketing-goals" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/dashboards/fieldmarketing-goals" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Target className="h-4 w-4" />
                    Fieldmarketing Mål
                  </NavLink>
                )}
                {p.canViewDashboardEesyTm && (
                  <NavLink to="/dashboards/eesy-tm" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/dashboards/eesy-tm" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <BarChart3 className="h-4 w-4" />
                    Eesy TM
                  </NavLink>
                )}
                {p.canViewDashboardTdcErhverv && (
                  <NavLink to="/dashboards/tdc-erhverv" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/dashboards/tdc-erhverv" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <BarChart3 className="h-4 w-4" />
                    TDC Erhverv
                  </NavLink>
                )}
                {p.canViewDashboardTdcErhverv && (
                  <NavLink to="/dashboards/tdc-erhverv-goals" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/dashboards/tdc-erhverv-goals" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Target className="h-4 w-4" />
                    TDC Erhverv Mål
                  </NavLink>
                )}
                {p.canViewDashboardRelatel && (
                  <NavLink to="/dashboards/relatel" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/dashboards/relatel" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <BarChart3 className="h-4 w-4" />
                    Relatel
                  </NavLink>
                )}
                {p.canViewDashboardTryg && (
                  <NavLink to="/dashboards/tryg" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/dashboards/tryg" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <BarChart3 className="h-4 w-4" />
                    Tryg
                  </NavLink>
                )}
                {p.canViewDashboardAse && (
                  <NavLink to="/dashboards/ase" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/dashboards/ase" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <BarChart3 className="h-4 w-4" />
                    ASE
                  </NavLink>
                )}
                {p.canViewDashboardTest && (
                  <NavLink to="/dashboards/mg-test" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/dashboards/mg-test" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <BarChart3 className="h-4 w-4" />
                    Test Dashboard
                  </NavLink>
                )}
                {p.canViewDashboardUnited && (
                  <NavLink to="/dashboards/united" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/dashboards/united" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <BarChart3 className="h-4 w-4" />
                    United
                  </NavLink>
                )}
                {p.canViewBoardsTest && (
                  <NavLink to="/boards/test" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/boards/test" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Monitor className="h-4 w-4" />
                    {t("sidebar.test")}
                  </NavLink>
                )}
                {p.canViewDashboardDesign && (
                  <NavLink to="/dashboards/design" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/dashboards/design" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Palette className="h-4 w-4" />
                    Design dashboard
                  </NavLink>
                )}
                {p.canViewDashboardSettings && (
                  <NavLink to="/dashboards/settings" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/dashboards/settings" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Settings className="h-4 w-4" />
                    Indstilling dashboard
                  </NavLink>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Test menu */}
          {showTestMenu && (
            <Collapsible open={testOpen} onOpenChange={setTestOpen}>
              <CollapsibleTrigger className={cn(
                "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                ["/car-quiz-admin", "/code-of-conduct-admin", "/pulse-survey-results"].includes(location.pathname) ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}>
                <div className="flex items-center gap-3">
                  <FlaskConical className="h-5 w-5" />
                  {t("sidebar.testMenu")}
                </div>
                {testOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 space-y-1 mt-1">
                {p.canViewCarQuizAdmin && (
                  <NavLink to="/car-quiz-admin" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/car-quiz-admin" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Car className="h-4 w-4" />
                    {t("sidebar.carQuizAdmin")}
                  </NavLink>
                )}
                {p.canViewCocAdmin && (
                  <NavLink to="/code-of-conduct-admin" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/code-of-conduct-admin" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Shield className="h-4 w-4" />
                    {t("sidebar.codeOfConductAdmin")}
                  </NavLink>
                )}
                {p.canViewPulseSurvey && (
                  <NavLink to="/pulse-survey-results" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/pulse-survey-results" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <BarChart3 className="h-4 w-4" />
                    {t("sidebar.pulseSurveyResults")}
                  </NavLink>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Rapporter menu */}
          {showReportsMenu && (
            <Collapsible open={reportsOpen} onOpenChange={setReportsOpen}>
              <CollapsibleTrigger className={cn(
                "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                location.pathname.startsWith("/reports") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}>
                <div className="flex items-center gap-3">
                  <FileBarChart className="h-5 w-5" />
                  Rapporter
                </div>
                {reportsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 space-y-1 mt-1">
                {p.canViewReportsAdmin && (
                  <NavLink to="/reports/admin" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/reports/admin" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Crown className="h-4 w-4" />
                    Rapporter Admin
                  </NavLink>
                )}
                {p.canViewReportsDailyReports && (
                  <NavLink to="/reports/daily" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/reports/daily" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Calendar className="h-4 w-4" />
                    Dagsrapporter
                  </NavLink>
                )}
                {p.canViewReportsManagement && (
                  <NavLink to="/reports/management" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/reports/management" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Users className="h-4 w-4" />
                    Rapporter Ledelse
                  </NavLink>
                )}
                {p.canViewReportsEmployee && (
                  <NavLink to="/reports/employee" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/reports/employee" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <User className="h-4 w-4" />
                    Rapporter Medarbejder
                  </NavLink>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Onboarding menu - Only admin access for now (system not ready for employees) */}
          {showOnboardingMenu && (
            <Collapsible open={onboardingOpen} onOpenChange={setOnboardingOpen}>
              <CollapsibleTrigger className={cn(
                "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                location.pathname.startsWith("/onboarding-program") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}>
                <div className="flex items-center gap-3">
                  <GraduationCap className="h-5 w-5" />
                  Onboarding
                </div>
                {onboardingOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 space-y-1 mt-1">
                <NavLink to="/onboarding-program" onClick={handleNavClick} className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/onboarding-program" && !location.search ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <BarChart3 className="h-4 w-4" />
                  Oversigt
                </NavLink>
                <NavLink to="/onboarding-program/kursus" onClick={handleNavClick} className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/onboarding-program/kursus" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <GraduationCap className="h-4 w-4" />
                  Kursus
                </NavLink>
                <NavLink to="/onboarding-program?tab=ramp" onClick={handleNavClick} className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/onboarding-program" && location.search.includes("tab=ramp") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <Target className="h-4 w-4" />
                  Forventninger
                </NavLink>
                <NavLink to="/onboarding-program?tab=leader" onClick={handleNavClick} className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/onboarding-program" && location.search.includes("tab=leader") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <Crown className="h-4 w-4" />
                  Leder Onboarding
                </NavLink>
                <NavLink to="/onboarding-program?tab=drills" onClick={handleNavClick} className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/onboarding-program" && location.search.includes("tab=drills") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <ListChecks className="h-4 w-4" />
                  Drill Bibliotek
                </NavLink>
                <NavLink to="/onboarding-program?tab=admin" onClick={handleNavClick} className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/onboarding-program" && location.search.includes("tab=admin") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <Settings className="h-4 w-4" />
                  Administration
                </NavLink>
                <NavLink to="/coaching-templates" onClick={handleNavClick} className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/coaching-templates" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <FileText className="h-4 w-4" />
                  Coaching Skabeloner
                </NavLink>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Rekruttering menu */}
          {showRecruitmentMenu && (
            <Collapsible open={recruitmentOpen} onOpenChange={setRecruitmentOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    location.pathname.startsWith("/recruitment") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <UserPlus className="h-5 w-5" />
                    {t("sidebar.recruitment")}
                  </div>
                  <div className="flex items-center gap-1">
                    {(pendingReferralsCount > 0 || recruitmentNotificationsCount > 0) && (
                      <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs animate-pulse">
                        {(pendingReferralsCount + recruitmentNotificationsCount) > 99 ? "99+" : (pendingReferralsCount + recruitmentNotificationsCount)}
                      </Badge>
                    )}
                    {recruitmentOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </div>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 space-y-1 mt-1">
                {p.canViewRecruitmentDashboard && (
                  <NavLink to="/recruitment" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/recruitment" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <LayoutDashboard className="h-4 w-4" />
                    {t("sidebar.dashboard")}
                  </NavLink>
                )}
                {p.canViewCandidates && (
                  <NavLink to="/recruitment/candidates" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname.startsWith("/recruitment/candidates") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Users className="h-4 w-4" />
                    {t("sidebar.candidates")}
                  </NavLink>
                )}
                {p.canViewUpcomingInterviews && (
                  <NavLink to="/recruitment/upcoming-interviews" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/recruitment/upcoming-interviews" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <CalendarClock className="h-4 w-4" />
                    {t("sidebar.upcomingInterviews")}
                  </NavLink>
                )}
                {p.canViewWinback && (
                  <NavLink to="/recruitment/winback" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/recruitment/winback" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <RefreshCcw className="h-4 w-4" />
                    {t("sidebar.winback")}
                  </NavLink>
                )}
                {p.canViewUpcomingHires && (
                  <NavLink to="/recruitment/upcoming-hires" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/recruitment/upcoming-hires" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <UserCog className="h-4 w-4" />
                    {t("sidebar.hires")}
                  </NavLink>
                )}
                {p.canViewMessages && (
                  <NavLink to="/recruitment/messages" onClick={handleNavClick} className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/recruitment/messages" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <div className="flex items-center gap-3">
                      <MessageSquare className="h-4 w-4" />
                      {t("sidebar.messages")}
                    </div>
                    {recruitmentNotificationsCount > 0 && (
                      <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs animate-pulse">
                        {recruitmentNotificationsCount > 99 ? "99+" : recruitmentNotificationsCount}
                      </Badge>
                    )}
                  </NavLink>
                )}
                {p.canViewSmsTemplates && (
                  <NavLink to="/recruitment/sms-templates" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/recruitment/sms-templates" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <FileText className="h-4 w-4" />
                    {t("sidebar.smsTemplates")}
                  </NavLink>
                )}
                {p.canViewEmailTemplates && (
                  <NavLink to="/recruitment/email-templates" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/recruitment/email-templates" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <FileText className="h-4 w-4" />
                    {t("sidebar.emailTemplates")}
                  </NavLink>
                )}
                {p.canViewReferrals && (
                  <NavLink to="/recruitment/referrals" onClick={handleNavClick} className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/recruitment/referrals" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <div className="flex items-center gap-3">
                      <Gift className="h-4 w-4" />
                      Henvisninger
                    </div>
                    {pendingReferralsCount > 0 && (
                      <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs animate-pulse">
                        {pendingReferralsCount > 99 ? "99+" : pendingReferralsCount}
                      </Badge>
                    )}
                  </NavLink>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Salg - near bottom */}
          {p.canViewSales && (
            <NavLink
              to="/sales"
              onClick={handleNavClick}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                location.pathname === "/sales" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <ShoppingCart className="h-5 w-5" />
              {t("sidebar.sales")}
            </NavLink>
          )}

          {/* Logikker - near bottom */}
          {p.canViewLogics && (
            <NavLink
              to="/logikker"
              onClick={handleNavClick}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                location.pathname === "/logikker" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <ListChecks className="h-5 w-5" />
              {t("sidebar.logics")}
            </NavLink>
          )}

          {/* Live Stats */}
          {p.canViewSettings && (
            <NavLink
              to="/live-stats"
              onClick={handleNavClick}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                location.pathname === "/live-stats" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <Activity className="h-5 w-5" />
              Live Stats
            </NavLink>
          )}

          {/* Admin menu */}
          {showAdminMenu && (
            <Collapsible open={adminOpen} onOpenChange={setAdminOpen}>
              <CollapsibleTrigger className={cn(
                "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                location.pathname.startsWith("/admin")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}>
                <div className="flex items-center gap-3">
                  <Wrench className="h-5 w-5" />
                  Admin
                </div>
                {adminOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 space-y-1 mt-1">
                {p.canViewKpiDefinitions && (
                  <NavLink to="/admin/kpi-definitions" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/admin/kpi-definitions" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <BookOpen className="h-4 w-4" />
                    KPI Definitioner
                  </NavLink>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Settings */}
          {p.canViewSettings && (
            <NavLink
              to="/settings"
              onClick={handleNavClick}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                location.pathname === "/settings" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <Settings className="h-5 w-5" />
              {t("sidebar.settings")}
            </NavLink>
          )}
        </nav>
        <div className="border-t border-sidebar-border p-4 space-y-2">
          {/* Time tracking icon link */}
          {(p.canViewTimeTracking || p.canViewExtraWork) && (
            <NavLink
              to={p.canViewTimeTracking ? "/shift-planning/time-tracking" : "/extra-work"}
              onClick={handleNavClick}
              className={cn(
                "flex items-center justify-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 w-10 h-10",
                (location.pathname === "/shift-planning/time-tracking" || location.pathname === "/extra-work" || location.pathname === "/extra-work-admin") 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
              title={t("sidebar.timeTracking")}
            >
              <Timer className="h-5 w-5" />
            </NavLink>
          )}

          <button onClick={() => { handleLogout(); handleNavClick(); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50">
            <LogOut className="h-5 w-5" />
            {t("sidebar.logout")}
          </button>
          <div className="flex items-center gap-2 px-3 py-1 text-xs text-sidebar-foreground/70">
            <User className="h-3 w-3" />
            <span className="truncate">{employeeName || user?.email}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
