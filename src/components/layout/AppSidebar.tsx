import { LayoutDashboard, Users, ShoppingCart, Wallet, Settings, LogOut, Percent, Shield, Building2, Calendar, MapPin, ChevronDown, ChevronRight, Car, Clock, UserCheck, Receipt, Database, ListChecks, ClipboardList, Timer, FileText, Crown, User, HeartHandshake, BarChart3, Sparkles, UserPlus, CalendarClock, UserCog, Video, Monitor, Phone, FlaskConical, Lock, Home, RefreshCcw, CalendarDays, MessageSquare, GraduationCap, Palette } from "lucide-react";
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
  
  const [mitHjemOpen, setMitHjemOpen] = useState(
    ["/home", "/messages", "/my-schedule", "/my-profile", "/my-contracts", "/career-wishes"].some(path => location.pathname === path || location.pathname.startsWith(path))
  );
  const [shiftPlanningOpen, setShiftPlanningOpen] = useState(location.pathname.startsWith("/shift-planning") || location.pathname === "/time-stamp" || location.pathname === "/closing-shifts");
  const [vagtFlowOpen, setVagtFlowOpen] = useState(location.pathname.startsWith("/vagt-flow"));
  const [recruitmentOpen, setRecruitmentOpen] = useState(location.pathname.startsWith("/recruitment"));
  const [ledelseOpen, setLedelseOpen] = useState(
    ["/contracts", "/permissions", "/career-wishes-overview", "/company-overview"].some(path => location.pathname.startsWith(path))
  );
  const [personnelOpen, setPersonnelOpen] = useState(location.pathname.startsWith("/employees") || location.pathname === "/login-log");
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
    location.pathname.startsWith("/onboarding-program")
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

      // For team scope, get team members' requests
      const { data: teamMembers } = await supabase
        .from("employee_master_data")
        .select("id")
        .eq("manager_id", currentEmployee.id);

      const teamIds = teamMembers?.map(m => m.id) || [];
      if (teamIds.length === 0) return 0;

      const { count } = await supabase
        .from("absence_request_v2")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")
        .or(`postponed_until.is.null,postponed_until.lt.${now}`)
        .in("employee_id", teamIds);

      return count || 0;
    },
    enabled: !!user?.email && p.canViewAbsence,
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });

  // Fetch unread messages count
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

      // Get all conversations the user is a member of
      const { data: memberships } = await supabase
        .from("chat_conversation_members")
        .select("conversation_id, last_read_at")
        .eq("employee_id", currentEmployee.id);

      if (!memberships?.length) return 0;

      let totalUnread = 0;

      for (const membership of memberships) {
        const query = supabase
          .from("chat_messages")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", membership.conversation_id)
          .neq("sender_id", currentEmployee.id)
          .is("deleted_at", null);

        if (membership.last_read_at) {
          query.gt("created_at", membership.last_read_at);
        }

        const { count } = await query;
        totalUnread += count || 0;
      }

      return totalUnread;
    },
    enabled: !!user?.email,
    staleTime: 10000, // Refresh every 10 seconds
    refetchOnWindowFocus: true,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
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
  const showPersonnelMenu = p.canViewEmployees || p.canViewTeams || p.canViewLoginLog;
  
  // Check if any Ledelse menu items are visible
  const showLedelseMenu = p.canViewContracts || p.canViewPermissions || p.canViewCareerWishesOverview;
  
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
  
  // Check if any Onboarding items are visible
  const showOnboardingMenu = p.canViewOnboarding || p.canViewOnboardingLeader || p.canViewOnboardingAdmin;
  
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
              ["/home", "/messages", "/my-schedule", "/my-profile", "/my-contracts", "/career-wishes"].some(path => location.pathname === path || location.pathname.startsWith(path))
                ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                : "text-sidebar-foreground hover:bg-sidebar-accent/50"
            )}>
              <div className="flex items-center gap-3">
                <Home className="h-5 w-5" />
                {t("sidebar.myHome", "Mit Hjem")}
              </div>
              <div className="flex items-center gap-1">
                {(unreadMessagesCount > 0 || pendingContractsCount > 0) && (
                  <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs animate-pulse">
                    {(unreadMessagesCount + pendingContractsCount) > 99 ? "99+" : (unreadMessagesCount + pendingContractsCount)}
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
                {unreadMessagesCount > 0 && (
                  <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs animate-pulse">
                    {unreadMessagesCount > 99 ? "99+" : unreadMessagesCount}
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
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Ledelse (Management) menu */}
          {showLedelseMenu && (
            <Collapsible open={ledelseOpen} onOpenChange={setLedelseOpen}>
              <CollapsibleTrigger className={cn(
                "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                ["/contracts", "/permissions", "/career-wishes-overview", "/company-overview"].some(path => location.pathname.startsWith(path)) 
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
              </CollapsibleContent>
            </Collapsible>
          )}


          {/* Dashboards menu - Always visible */}
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
                <NavLink to="/dashboards/cph-sales" onClick={handleNavClick} className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/dashboards/cph-sales" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <BarChart3 className="h-4 w-4" />
                  Dagsboard CPH Sales
                </NavLink>
                <NavLink to="/dashboards/fieldmarketing" onClick={handleNavClick} className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/dashboards/fieldmarketing" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <BarChart3 className="h-4 w-4" />
                  Fieldmarketing
                </NavLink>
                <NavLink to="/dashboards/eesy-tm" onClick={handleNavClick} className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/dashboards/eesy-tm" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <BarChart3 className="h-4 w-4" />
                  Eesy TM
                </NavLink>
                <NavLink to="/dashboards/tdc-erhverv" onClick={handleNavClick} className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/dashboards/tdc-erhverv" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <BarChart3 className="h-4 w-4" />
                  TDC Erhverv
                </NavLink>
                <NavLink to="/dashboards/relatel" onClick={handleNavClick} className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/dashboards/relatel" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <BarChart3 className="h-4 w-4" />
                  Relatel
                </NavLink>
                <NavLink to="/dashboards/tryg" onClick={handleNavClick} className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/dashboards/tryg" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <BarChart3 className="h-4 w-4" />
                  Tryg
                </NavLink>
                <NavLink to="/dashboards/ase" onClick={handleNavClick} className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/dashboards/ase" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <BarChart3 className="h-4 w-4" />
                  ASE
                </NavLink>
                <NavLink to="/dashboards/mg-test" onClick={handleNavClick} className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/dashboards/mg-test" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <BarChart3 className="h-4 w-4" />
                  Test Dashboard
                </NavLink>
                <NavLink to="/dashboards/united" onClick={handleNavClick} className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/dashboards/united" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <BarChart3 className="h-4 w-4" />
                  United
                </NavLink>
                {p.canViewBoardsTest && (
                  <NavLink to="/boards/test" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/boards/test" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Monitor className="h-4 w-4" />
                    {t("sidebar.test")}
                  </NavLink>
                )}
                <NavLink to="/dashboards/design" onClick={handleNavClick} className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/dashboards/design" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <Palette className="h-4 w-4" />
                  Design dashboard
                </NavLink>
                <NavLink to="/dashboards/settings" onClick={handleNavClick} className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/dashboards/settings" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <Settings className="h-4 w-4" />
                  Indstilling dashboard
                </NavLink>
            </CollapsibleContent>
          </Collapsible>

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

          {/* Onboarding menu */}
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
                {p.canViewOnboarding && (
                  <NavLink to="/onboarding-program" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/onboarding-program" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <LayoutDashboard className="h-4 w-4" />
                    Oversigt
                  </NavLink>
                )}
                <NavLink to="/onboarding-program/employee" onClick={handleNavClick} className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/onboarding-program/employee" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <User className="h-4 w-4" />
                  Min Onboarding
                </NavLink>
                {p.canViewOnboardingLeader && (
                  <NavLink to="/onboarding-program/leader" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/onboarding-program/leader" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Crown className="h-4 w-4" />
                    Leder Onboarding
                  </NavLink>
                )}
                <NavLink to="/onboarding-program/drills" onClick={handleNavClick} className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/onboarding-program/drills" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <ListChecks className="h-4 w-4" />
                  Drill Bibliotek
                </NavLink>
                {p.canViewOnboardingAdmin && (
                  <NavLink to="/onboarding-program/admin" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/onboarding-program/admin" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Settings className="h-4 w-4" />
                    Administration
                  </NavLink>
                )}
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
                  {recruitmentOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
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
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/recruitment/messages" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <FileText className="h-4 w-4" />
                    {t("sidebar.messages")}
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
