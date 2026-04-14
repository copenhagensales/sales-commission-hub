import { LayoutDashboard, Users, ShoppingCart, Wallet, Settings, LogOut, Percent, Shield, ShieldCheck, Building2, Calendar, MapPin, ChevronDown, ChevronRight, Car, Clock, UserCheck, Receipt, Database, ListChecks, ClipboardList, ClipboardCheck, Timer, FileText, Crown, User, HeartHandshake, BarChart3, Sparkles, UserPlus, CalendarClock, UserCog, Video, Monitor, Phone, FlaskConical, Lock, Home, RefreshCcw, CalendarDays, MessageSquare, GraduationCap, Palette, Target, Activity, Swords, Mail, Gift, FileBarChart, CreditCard, Pencil, Trophy, Wrench, BookOpen, TrendingUp, TrendingDown, PanelLeft, XCircle, List, Inbox, Bug, Menu as MenuIcon } from "lucide-react";
import { EnvironmentSwitcher } from "./EnvironmentSwitcher";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import cphSalesLogo from "@/assets/cph-sales-logo.png";
import { useState, useMemo } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePositionPermissions";
import { useRolePreview } from "@/contexts/RolePreviewContext";
import { useIsFieldmarketingEmployee } from "@/hooks/useFieldmarketingEmployee";
import { useEmployeeSmsUnreadCount } from "@/hooks/useEmployeeSmsConversations";
import { useShouldShowPulseSurvey } from "@/hooks/usePulseSurvey";
import { useCarQuizCompletion } from "@/hooks/useCarQuiz";
import { useIsSalgskonsulent, useCodeOfConductLock } from "@/hooks/useCodeOfConduct";
import { useHasImmediatePaymentSales } from "@/hooks/useHasImmediatePaymentSales";
import { useFmBookingConflicts } from "@/hooks/useFmBookingConflicts";
import { useTranslation } from "react-i18next";
import { useSidebarMenuConfig, type MenuConfigItem } from "@/hooks/useSidebarMenuConfig";

type NavItem = { name: string; href: string; icon: typeof Users; badgeKey?: string };

interface AppSidebarProps {
  isMobile?: boolean;
  onNavigate?: () => void;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export function AppSidebar({ isMobile = false, onNavigate, isCollapsed = false, onToggle }: AppSidebarProps) {
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
  
  const pulseSurvey = useShouldShowPulseSurvey();
  const { data: hasImmediatePaymentSales } = useHasImmediatePaymentSales();
  
  const [mitHjemOpen, setMitHjemOpen] = useState(
    ["/home", "/messages", "/my-profile", "/my-feedback", "/pulse-survey", "/refer-a-friend", "/my-goals", "/team-goals", "/immediate-payment-ase", "/tdc-opsummering"].some(path => location.pathname === path || location.pathname.startsWith(path))
  );
  const [spilOpen, setSpilOpen] = useState(
    ["/head-to-head", "/commission-league", "/admin/league", "/admin/h2h", "/team/h2h"].some(path => location.pathname === path || location.pathname.startsWith(path))
  );
  const [shiftPlanningOpen, setShiftPlanningOpen] = useState(location.pathname.startsWith("/shift-planning") || location.pathname === "/time-stamp" || location.pathname === "/closing-shifts");
  const [vagtFlowOpen, setVagtFlowOpen] = useState(location.pathname.startsWith("/vagt-flow"));
  const [recruitmentOpen, setRecruitmentOpen] = useState(location.pathname.startsWith("/recruitment"));
  const [ledelseOpen, setLedelseOpen] = useState(
    ["/contracts", "/permissions", "/career-wishes-overview", "/company-overview", "/onboarding-analyse", "/email-templates", "/admin/security", "/system-stability", "/car-quiz-admin", "/code-of-conduct-admin", "/pulse-survey-results", "/reports/revenue-by-client", "/customer-inquiries", "/client-forecast"].some(path => location.pathname.startsWith(path))
  );
  const [personnelOpen, setPersonnelOpen] = useState(location.pathname.startsWith("/employees") || location.pathname === "/login-log" || location.pathname === "/upcoming-starts");
  const [mgOpen, setMgOpen] = useState(location.pathname === "/mg-test");
  // Dashboard state removed - dashboards are now in separate environment
  const [someOpen, setSomeOpen] = useState(
    ["/some", "/extra-work"].includes(location.pathname)
  );
  const [onboardingOpen, setOnboardingOpen] = useState(
    location.pathname.startsWith("/onboarding-program") || location.pathname === "/onboarding-program/kursus" || location.pathname === "/coaching-templates"
  );
  const [reportsOpen, setReportsOpen] = useState(
    location.pathname.startsWith("/reports") || location.pathname === "/salary/cancellations"
  );
  const [salaryOpen, setSalaryOpen] = useState(
    location.pathname.startsWith("/salary")
  );
  
  // Check if user can view cancellations
  const canViewCancellations = p.canView("menu_cancellations");
  const [adminOpen, setAdminOpen] = useState(
    location.pathname.startsWith("/admin")
  );
  const [economicOpen, setEconomicOpen] = useState(
    location.pathname.startsWith("/economic") || location.pathname === "/admin/economic-upload"
  );
  const [amoOpen, setAmoOpen] = useState(
    location.pathname.startsWith("/amo")
  );

  // Fetch employee name and pending contracts count
  // OPTIMIZED: Removed refetchInterval to reduce DB load - only refetch on window focus
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
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
    refetchOnWindowFocus: true,
  });

  // Fetch pending absence requests count
  // OPTIMIZED: Removed refetchInterval - only refetch on window focus
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
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // Fetch unread messages count using optimized server-side function
  // OPTIMIZED: Removed refetchInterval - only refetch on window focus
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
    staleTime: 2 * 60 * 1000, // 2 minutes cache
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    // NO refetchInterval - reduces DB load significantly
  });

  // Fetch pending H2H challenges count
  // OPTIMIZED: Removed refetchInterval - only refetch on window focus
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
    staleTime: 2 * 60 * 1000, // 2 minutes cache
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    // NO refetchInterval - reduces DB load significantly
  });

  // Fetch pending referrals count (for recruiters)
  // OPTIMIZED: Removed refetchInterval - only refetch on window focus
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
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    // NO refetchInterval - reduces DB load significantly
  });

  // Fetch unread recruitment messages and missed calls count
  // OPTIMIZED: Removed refetchInterval - only refetch on window focus
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
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    // NO refetchInterval - reduces DB load significantly
  });

  // Fetch FM booking conflicts using shared hook
  const { count: fmBookingConflictsCount } = useFmBookingConflicts(p.canViewFmBookings || p.canViewFmBookWeek);

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
    : cn(
        "fixed left-0 top-0 z-40 h-screen border-r border-sidebar-border bg-sidebar overflow-y-auto transition-all duration-300 ease-in-out",
        isCollapsed ? "w-0 -translate-x-full opacity-0" : "w-64 translate-x-0 opacity-100"
      );

  // Wait for permissions to load
  if (p.isLoading) {
    return (
      <aside className={sidebarClasses}>
        <div className="flex h-full flex-col">
          {!isMobile && (
            <div className="flex h-28 items-center justify-center border-b border-sidebar-border px-4">
              <div 
                onClick={() => navigate("/")} 
                className="flex items-center justify-center px-3 py-2 cursor-pointer transition-transform duration-200 hover:scale-105"
              >
                <img src={cphSalesLogo} alt="CPH Sales" className="h-24 w-auto object-contain" />
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

  // SECTION-PERMISSION ENFORCEMENT: Section permission must be true for ANY child items to show
  // This ensures the sidebar matches what the Permission Editor shows
  
  // Check if SOME menu should be visible
  const showSomeMenu = p.canViewSome || p.canViewExtraWork;

  // Check if any Personnel menu items are visible (requires section permission)
  const showPersonnelMenu = p.canView("menu_section_personale") && 
    (p.canViewEmployees || p.canViewTeams || p.canViewLoginLog || p.canViewUpcomingStarts);
  
  // Check if any Ledelse menu items are visible (requires section permission)
  const showLedelseMenu = p.canView("menu_section_ledelse") && 
    (p.canViewContracts || p.canViewPermissions || p.canViewCareerWishesOverview || p.canViewSecurityDashboard || p.canViewCarQuizAdmin || p.canViewCocAdmin || p.canViewPulseSurvey || p.canView("menu_customer_inquiries") || p.canViewClientForecast || true);
  
  // Check if any MG menu items are visible (requires section permission)
  const showMgMenu = p.canView("menu_section_mg") && p.canViewMgTest;
  
  // Check if any Fieldmarketing items are visible (requires section permission)
  const showFieldmarketingMenu = p.canView("menu_section_fieldmarketing") && 
    (p.canViewFmMySchedule || p.canViewFmOverview || p.canViewFmBookWeek || 
     p.canViewFmBookings || p.canViewFmLocations || p.canViewFmVehicles ||
     p.canViewFmBilling || p.canViewFmTimeOff || p.canViewFmSalesRegistration ||
     false);
  
  // Check if any Shift Planning items are visible (requires section permission)
  const showShiftPlanningMenu = p.canView("menu_section_vagtplan") && 
    (p.canViewShiftOverview || p.canViewAbsence || p.canViewTimeTracking || p.canViewTimeStamp || p.canViewClosingShifts);
  
  
  // Check if any Recruitment items are visible (requires section permission)
  const showRecruitmentMenu = p.canView("menu_section_rekruttering") && 
    (p.canViewRecruitmentDashboard || p.canViewCandidates || p.canViewMessages ||
     p.canViewSmsTemplates || p.canViewEmailTemplates || p.canViewWinback ||
     p.canViewUpcomingInterviews || p.canViewUpcomingHires || p.canViewBookingFlow);
  
  // Check if any Onboarding items are visible (requires section permission) - only show for admin users
  const showOnboardingMenu = p.canView("menu_section_onboarding") && p.canViewOnboardingAdmin;

  // Check if any Reports menu items are visible (requires section permission)
  const showReportsMenu = p.canView("menu_section_reports") && 
    (p.canViewReportsAdmin || p.canViewReportsDailyReports || p.canViewReportsManagement || p.canViewReportsEmployee || canViewCancellations);
  
  // HARDCODED: Only Kasper, Mathias and Lone can see salary menu
  const SALARY_ALLOWED_USER_IDS = [
    'f0fb7ec3-5f00-4fcd-a6ca-2a53669147b9', // Kasper Mikkelsen
    '71267f4e-fd9e-4c16-8fe9-da0f48ce2598', // Mathias Grubak
    'e1ac7b84-aedb-400e-88f6-dd24687317e4', // Lone Mikkelsen
  ];
  const showSalaryMenu = user?.id ? SALARY_ALLOWED_USER_IDS.includes(user.id) : false;
  
  // Check if Admin menu should be visible
  const showAdminMenu = p.canViewKpiDefinitions;
  
  // Check if AMO menu should be visible
  const showAmoMenu = p.canView("menu_section_amo") && (
    p.canViewAmoDashboard || p.canViewAmoOrganisation || p.canViewAmoMeetings || p.canViewAmoApv
  );
  
  // Check if Spil (Games) menu should be visible
  const showSpilMenu = p.canViewH2h || p.canViewCommissionLeague;
  
  // Check if Economic menu should be visible (owner always has access)
  const isOwner = p.position?.name?.toLowerCase() === "ejer";
  const showEconomicMenu = isOwner || p.canView("menu_section_economic");
  return (
    <aside className={sidebarClasses}>
      <div className="flex h-full flex-col">
        {!isMobile && (
          <div className="flex h-28 items-center justify-center border-b border-sidebar-border px-3 relative">
            <div 
              onClick={() => navigate("/")} 
              className="flex items-center justify-center px-3 py-2 cursor-pointer transition-transform duration-200 hover:scale-105"
            >
              <img src={cphSalesLogo} alt="CPH Sales" className="h-24 w-auto object-contain" />
            </div>
            
            {/* Collapse button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="absolute right-2 h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-all duration-200"
              title="Skjul sidebar"
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          </div>
        )}
        
        {/* Environment Switcher - below header */}
        {!isMobile && (
          <div className="px-4 py-3 border-b border-sidebar-border/50">
            <EnvironmentSwitcher compact className="w-full justify-center" />
          </div>
        )}
        
        <nav className="flex-1 space-y-1 p-4 pt-4">
          {/* Mit Hjem (My Home) menu */}
          <Collapsible open={mitHjemOpen} onOpenChange={setMitHjemOpen}>
            <CollapsibleTrigger className={cn(
              "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              ["/home", "/messages", "/my-profile", "/my-feedback", "/refer-a-friend"].some(path => location.pathname === path || location.pathname.startsWith(path))
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50"
            )}>
              <div className="flex items-center gap-3">
                <Home className="h-5 w-5" />
                {t("sidebar.myHome", "Mit Hjem")}
              </div>
              <div className="flex items-center gap-1">
                {(unreadMessagesCount > 0 || pendingContractsCount > 0 || (p.canSendEmployeeSms && employeeSmsUnreadCount > 0)) && (
                  <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs animate-pulse">
                    {(unreadMessagesCount + pendingContractsCount + (p.canSendEmployeeSms ? employeeSmsUnreadCount : 0)) > 99 ? "99+" : (unreadMessagesCount + pendingContractsCount + (p.canSendEmployeeSms ? employeeSmsUnreadCount : 0))}
                  </Badge>
                )}
                {mitHjemOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-4 space-y-1 mt-1">
              {/* Hjem */}
              {p.canViewHome && (
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
              )}

              {/* Beskeder */}
              {p.canViewMessagesPersonal && (
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
              
              {/* Min Feedback */}
              {p.canViewMyFeedback && (
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
              )}

              {/* Pulsmåling */}
              {pulseSurvey.showMenuItem && (
                <NavLink
                  to="/pulse-survey"
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/pulse-survey" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  <ClipboardCheck className="h-4 w-4" />
                  <span className="flex-1">Pulsmåling</span>
                  {pulseSurvey.showBadge && (
                    <Badge variant="destructive" className="animate-pulse ml-auto h-5 min-w-[20px] px-1.5 text-[10px]">1</Badge>
                  )}
                </NavLink>
              )}
              
              {/* Løn & Mål - kun for provision-ansatte */}
              {p.canViewMyGoals && (
                <NavLink
                  to="/my-goals"
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/my-goals" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  <Target className="h-4 w-4" />
                  Løn & Mål
                </NavLink>
              )}
              
              {/* Teammål */}
              {p.canViewTeamGoals && (
                <NavLink
                  to="/team-goals"
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/team-goals" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  <Users className="h-4 w-4" />
                  Teammål
                </NavLink>
              )}
              
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

              {/* Straksbetaling (ASE) - shown dynamically based on qualifying sales */}
              {hasImmediatePaymentSales && (
                <NavLink
                  to="/immediate-payment-ase"
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/immediate-payment-ase" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  <CreditCard className="h-4 w-4" />
                  Straksbetaling (ASE)
                </NavLink>
              )}

              {/* TDC Opsummering */}
              {p.canViewTdcOpsummering && (
                <NavLink
                  to="/tdc-opsummering"
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/tdc-opsummering" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  <FileText className="h-4 w-4" />
                  TDC Opsummering
                </NavLink>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Spil (Games) menu - H2H and Liga */}
          {showSpilMenu && (
            <Collapsible open={spilOpen} onOpenChange={setSpilOpen}>
              <CollapsibleTrigger className={cn(
                "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                ["/head-to-head", "/commission-league"].some(path => location.pathname === path || location.pathname.startsWith(path))
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}>
                <div className="flex items-center gap-3">
                  <Trophy className="h-5 w-5" />
                  Spil
                </div>
                <div className="flex items-center gap-1">
                  {pendingH2hCount > 0 && (
                    <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs animate-pulse">
                      {pendingH2hCount > 99 ? "99+" : pendingH2hCount}
                    </Badge>
                  )}
                  {spilOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 space-y-1 mt-1">
                {/* Head to Head */}
                {p.canViewH2h && (
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
                )}

                {/* Cph Sales Ligaen */}
                {p.canViewCommissionLeague && (
                  <NavLink
                    to="/commission-league"
                    onClick={(e) => {
                      handleNavClick(e);
                      localStorage.setItem("league-sidebar-seen", "true");
                    }}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                      location.pathname === "/commission-league" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Trophy className="h-4 w-4" />
                      Superligaen
                    </div>
                    {!localStorage.getItem("league-sidebar-seen") && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold bg-yellow-500 text-black rounded animate-pulse">
                        NY
                      </span>
                    )}
                  </NavLink>
                )}
                
              </CollapsibleContent>
            </Collapsible>
          )}
          
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
                ["/contracts", "/permissions", "/career-wishes-overview", "/company-overview", "/onboarding-analyse", "/email-templates", "/admin/security", "/car-quiz-admin", "/code-of-conduct-admin", "/pulse-survey-results"].some(path => location.pathname.startsWith(path)) 
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
                  <NavLink to="/onboarding-analyse" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/onboarding-analyse" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <TrendingDown className="h-4 w-4" />
                    Onboarding Analyse
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
                {p.canViewSecurityDashboard && (
                  <NavLink to="/system-stability" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/system-stability" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Activity className="h-4 w-4" />
                    Systemstabilitet
                  </NavLink>
                )}
                
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
                {/* Hard-coded access: only km@ and mg@ can see this menu item */}
                {p.canView("menu_reports_revenue_by_client") && 
                 ["km@copenhagensales.dk", "mg@copenhagensales.dk"].includes(user?.email?.toLowerCase() || "") && (
                  <NavLink to="/reports/revenue-by-client" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/reports/revenue-by-client" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <TrendingUp className="h-4 w-4" />
                    Omsætning per opgave
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
                {p.canView("menu_customer_inquiries") && (
                  <NavLink to="/customer-inquiries" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/customer-inquiries" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Inbox className="h-4 w-4" />
                    Kundehenvendelser
                  </NavLink>
                )}
                {p.canViewClientForecast && (
                  <NavLink to="/client-forecast" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname.startsWith("/client-forecast") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <BarChart3 className="h-4 w-4" />
                    Kundeforecast
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

          {/* Fejlrapportering - standalone, visible for users with access */}
          <FeedbackNavLink handleNavClick={handleNavClick} />

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
                {p.canViewFmMySchedule && (
                  <NavLink to="/vagt-flow/my-schedule" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/vagt-flow/my-schedule" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <UserCheck className="h-4 w-4" />
                    Min vagtplan
                  </NavLink>
                )}
                {p.canViewFmOverview && (
                  <NavLink to="/vagt-flow" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/vagt-flow" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <LayoutDashboard className="h-4 w-4" />
                    {t("sidebar.overview")}
                  </NavLink>
                )}
                {/* Booking - single link to tabbed page */}
                {(p.canViewFmBookWeek || p.canViewFmBookings || p.canViewFmLocations) && (
                  <NavLink to="/vagt-flow/booking" onClick={handleNavClick} className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname.startsWith("/vagt-flow/booking") || 
                    location.pathname === "/vagt-flow/book-week" || 
                    location.pathname === "/vagt-flow/bookings" || 
                    location.pathname.startsWith("/vagt-flow/locations")
                      ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <div className="flex items-center gap-3">
                      <CalendarDays className="h-4 w-4" />
                      {t("sidebar.booking", "Booking")}
                    </div>
                    {fmBookingConflictsCount > 0 && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs animate-pulse">
                              {fmBookingConflictsCount > 99 ? "99+" : fmBookingConflictsCount}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            {fmBookingConflictsCount} medarbejder(e) er tildelt vagter under godkendt fravær
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
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
                location.pathname === "/mg-test" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}>
                <div className="flex items-center gap-3">
                  <Percent className="h-5 w-5" />
                  {t("sidebar.mg")}
                </div>
                {mgOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 space-y-1 mt-1">
                {p.canViewMgTest && (
                  <NavLink to="/mg-test" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/mg-test" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Percent className="h-4 w-4" />
                    {t("sidebar.mgTest")}
                  </NavLink>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}


          {/* Dashboards menu REMOVED - dashboards are now accessed via EnvironmentSwitcher in a separate environment */}

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
                {canViewCancellations && (
                  <NavLink to="/salary/cancellations" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/salary/cancellations" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <XCircle className="h-4 w-4" />
                    Annulleringer
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
                {p.canViewBookingFlow && (
                  <NavLink to="/recruitment/booking-flow" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/recruitment/booking-flow" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <CalendarClock className="h-4 w-4" />
                    Booking Flow
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

          {/* Løn menu */}
          {showSalaryMenu && (
            <Collapsible open={salaryOpen} onOpenChange={setSalaryOpen}>
              <CollapsibleTrigger className={cn(
                "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                location.pathname.startsWith("/salary")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}>
                <div className="flex items-center gap-3">
                  <Wallet className="h-5 w-5" />
                  Løn
                </div>
                {salaryOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 space-y-1 mt-1">
                {p.canViewSalaryTypes && (
                  <NavLink to="/salary/types" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/salary/types" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Receipt className="h-4 w-4" />
                    Lønarter
                  </NavLink>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Økonomi menu */}
          {showEconomicMenu && (
            <Collapsible open={economicOpen} onOpenChange={setEconomicOpen}>
              <CollapsibleTrigger className={cn(
                "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                (location.pathname.startsWith("/economic") || location.pathname === "/admin/economic-upload")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}>
                <div className="flex items-center gap-3">
                  <Receipt className="h-5 w-5" />
                  Økonomi
                </div>
                {economicOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 space-y-1 mt-1">
                {p.canViewEconomicDashboard && (
                <NavLink to="/economic" onClick={handleNavClick} className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/economic" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <LayoutDashboard className="h-4 w-4" />
                  Overblik
                </NavLink>
                )}
                {p.canViewEconomicDashboard && (
                <NavLink to="/economic/posteringer" onClick={handleNavClick} className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/economic/posteringer" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <List className="h-4 w-4" />
                  Posteringer
                </NavLink>
                )}
                {p.canViewEconomicExpenses && (
                <NavLink to="/economic/expenses" onClick={handleNavClick} className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/economic/expenses" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <Receipt className="h-4 w-4" />
                  Udgifter
                </NavLink>
                )}
                {p.canViewEconomicBudget && (
                <NavLink to="/economic/budget" onClick={handleNavClick} className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/economic/budget" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <Target className="h-4 w-4" />
                  Budget 2026
                </NavLink>
                )}
                {p.canViewEconomicMapping && (
                <NavLink to="/economic/mapping" onClick={handleNavClick} className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/economic/mapping" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <Database className="h-4 w-4" />
                  Mapping
                </NavLink>
                )}
                {p.canViewEconomicDashboard && (
                <NavLink to="/economic/revenue-match" onClick={handleNavClick} className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/economic/revenue-match" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <Receipt className="h-4 w-4" />
                  Omsætning
                </NavLink>
                )}
                {p.canViewEconomicDashboard && (
                <NavLink to="/economic/sales-validation" onClick={handleNavClick} className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/economic/sales-validation" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <ShieldCheck className="h-4 w-4" />
                  Salgsvalidering
                </NavLink>
                )}
                {p.canViewEconomicUpload && (
                <NavLink to="/admin/economic-upload" onClick={handleNavClick} className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/admin/economic-upload" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <Database className="h-4 w-4" />
                  Import
                </NavLink>
                )}
              </CollapsibleContent>
            </Collapsible>
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
          {p.canViewLiveStats && (
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

          {/* AMO Compliance Hub */}
          {showAmoMenu && (
            <Collapsible open={amoOpen} onOpenChange={setAmoOpen}>
              <CollapsibleTrigger className={cn(
                "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                location.pathname.startsWith("/amo")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}>
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5" />
                  Arbejdsmiljø
                </div>
                {amoOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 space-y-1 mt-1">
                {p.canViewAmoDashboard && (
                  <NavLink to="/amo" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/amo" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </NavLink>
                )}
                {p.canViewAmoOrganisation && (
                  <NavLink to="/amo/organisation" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/amo/organisation" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Users className="h-4 w-4" />
                    Organisation
                  </NavLink>
                )}
                {p.canViewAmoAnnualDiscussion && (
                  <NavLink to="/amo/annual-discussion" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/amo/annual-discussion" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Calendar className="h-4 w-4" />
                    Årlig drøftelse
                  </NavLink>
                )}
                {p.canViewAmoMeetings && (
                  <NavLink to="/amo/meetings" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/amo/meetings" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <ClipboardList className="h-4 w-4" />
                    Møder
                  </NavLink>
                )}
                {p.canViewAmoApv && (
                  <NavLink to="/amo/apv" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/amo/apv" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <FileText className="h-4 w-4" />
                    APV
                  </NavLink>
                )}
                {p.canViewAmoKemiApv && (
                  <NavLink to="/amo/kemi-apv" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/amo/kemi-apv" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <FlaskConical className="h-4 w-4" />
                    Kemi-APV
                  </NavLink>
                )}
                {p.canViewAmoTraining && (
                  <NavLink to="/amo/training" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/amo/training" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <GraduationCap className="h-4 w-4" />
                    Uddannelse
                  </NavLink>
                )}
                {p.canViewAmoDocuments && (
                  <NavLink to="/amo/documents" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/amo/documents" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Database className="h-4 w-4" />
                    Dokumenter
                  </NavLink>
                )}
                {p.canViewAmoTasks && (
                  <NavLink to="/amo/tasks" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/amo/tasks" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <ListChecks className="h-4 w-4" />
                    Opgaver
                  </NavLink>
                )}
                {p.canViewAmoSettings && (
                  <NavLink to="/amo/settings" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/amo/settings" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Settings className="h-4 w-4" />
                    Indstillinger
                  </NavLink>
                )}
                {p.canViewAmoAuditLog && (
                  <NavLink to="/amo/audit-log" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/amo/audit-log" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Clock className="h-4 w-4" />
                    Audit log
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

          {p.canView("menu_compliance_overview") && (
            <NavLink
              to="/compliance"
              onClick={handleNavClick}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                location.pathname.startsWith("/compliance")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <ShieldCheck className="h-5 w-5" />
              Compliance
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

function FeedbackNavLink({ handleNavClick }: { handleNavClick: () => void }) {
  const location = useLocation();
  const { user } = useAuth();

  const { data: hasAccess } = useQuery({
    queryKey: ["feedback-sidebar-access", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      // Check if owner
      const { data: ownerCheck } = await supabase.rpc("is_owner", { _user_id: user.id });
      if (ownerCheck) return true;
      // Check access table
      const { data: emp } = await supabase
        .from("employee_master_data")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (!emp?.id) return false;
      const { data: access } = await supabase
        .from("system_feedback_access" as any)
        .select("id")
        .eq("employee_id", emp.id)
        .maybeSingle();
      return !!access;
    },
    enabled: !!user?.id,
  });

  if (!hasAccess) return null;

  return (
    <NavLink to="/system-feedback" onClick={handleNavClick} className={cn(
      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
      location.pathname === "/system-feedback" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
    )}>
      <Bug className="h-4 w-4" />
      Fejlrapportering
    </NavLink>
  );
}
