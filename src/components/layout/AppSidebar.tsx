import { LayoutDashboard, Users, ShoppingCart, Wallet, Settings, Tv, LogOut, Percent, Shield, Building2, Calendar, MapPin, ChevronDown, ChevronRight, Car, Clock, UserCheck, Receipt, Database, ListChecks, ClipboardList, Timer, FileText, Crown, User, HeartHandshake, BarChart3, Sparkles, Plus, UserPlus, RefreshCcw, CalendarClock, UserCog, Video, Monitor, Phone, DollarSign } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import cphSalesLogo from "@/assets/cph-sales-logo.png";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useCanAccess } from "@/hooks/useSystemRoles";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useShouldShowPulseSurvey } from "@/hooks/usePulseSurvey";
import { useIsFieldmarketingEmployee } from "@/hooks/useFieldmarketingEmployee";
import { useIsSomeEmployee } from "@/hooks/useSomeEmployee";
import { useCarQuizCompletion } from "@/hooks/useCarQuiz";
import { useIsSalgskonsulent, useCodeOfConductLock } from "@/hooks/useCodeOfConduct";
import { useTranslation } from "react-i18next";

// Navigation items - using translation keys instead of hardcoded names
const getOwnerNavigation = (t: (key: string) => string) => [
  { name: t("sidebar.employees"), href: "/employees", icon: Users },
  { name: t("sidebar.teams"), href: "/teams", icon: Users },
  { name: t("sidebar.contracts"), href: "/contracts", icon: FileText },
  { name: t("sidebar.myContracts"), href: "/my-contracts", icon: FileText },
  { name: t("sidebar.careerWishesOverview"), href: "/career-wishes-overview", icon: Sparkles },
  { name: t("sidebar.some"), href: "/some", icon: Video },
  { name: t("sidebar.sales"), href: "/sales", icon: ShoppingCart },
  { name: t("sidebar.commissionCpo"), href: "/commission-cpo", icon: Percent },
  { name: t("sidebar.logics"), href: "/logikker", icon: ListChecks },
  { name: t("sidebar.carQuizAdmin"), href: "/car-quiz-admin", icon: Car },
  { name: t("sidebar.codeOfConductAdmin"), href: "/code-of-conduct-admin", icon: Shield },
];

// MG submenu navigation
const getMgNavigation = (t: (key: string) => string) => [
  { name: t("sidebar.payroll"), href: "/payroll", icon: Wallet },
  { name: t("sidebar.tdcErhverv"), href: "/tdc-erhverv", icon: Building2 },
  { name: t("sidebar.codan"), href: "/codan", icon: Shield },
  { name: t("sidebar.mgTest"), href: "/mg-test", icon: Percent },
  { name: t("sidebar.dialerData"), href: "/dialer-data", icon: Database },
  { name: t("sidebar.callsData"), href: "/calls-data", icon: Phone },
  { name: t("sidebar.dataSourcesInfo"), href: "/adversus-data", icon: Database },
];

// Navigation items for teamleder (limited team-related access)
const getTeamlederNavigation = (t: (key: string) => string) => [
  { name: t("sidebar.shiftPlan"), href: "/shift-planning", icon: ClipboardList },
  { name: t("sidebar.myProfile"), href: "/my-profile", icon: User },
  { name: t("sidebar.approveAbsence"), href: "/shift-planning/absence", icon: Clock, badgeKey: "pendingAbsence" },
  { name: t("sidebar.myTeam"), href: "/employees", icon: Users },
  { name: t("sidebar.contracts"), href: "/contracts", icon: FileText },
  { name: t("sidebar.myContracts"), href: "/my-contracts", icon: FileText },
];

// Navigation items for rekruttering role (without Rekruttering - that's in submenu)
const getRekrutteringNavigation = (t: (key: string) => string) => [
  { name: t("sidebar.employees"), href: "/employees", icon: Users },
  { name: t("sidebar.teams"), href: "/teams", icon: Users },
  { name: t("sidebar.contracts"), href: "/contracts", icon: FileText },
  { name: t("sidebar.myContracts"), href: "/my-contracts", icon: FileText },
  { name: t("sidebar.careerWishesOverview"), href: "/career-wishes-overview", icon: Sparkles },
  { name: t("sidebar.myCalendar"), href: "/my-schedule", icon: UserCheck },
  { name: t("sidebar.myProfile"), href: "/my-profile", icon: User },
];

// Rekruttering submenu navigation
const getRecruitmentNavigation = (t: (key: string) => string) => [
  { name: t("sidebar.dashboard"), href: "/recruitment", icon: LayoutDashboard },
  { name: t("sidebar.candidates"), href: "/recruitment/candidates", icon: Users },
  { name: t("sidebar.upcomingInterviews"), href: "/recruitment/upcoming-interviews", icon: CalendarClock },
  { name: t("sidebar.winback"), href: "/recruitment/winback", icon: RefreshCcw },
  { name: t("sidebar.hires"), href: "/recruitment/upcoming-hires", icon: UserCog },
  { name: t("sidebar.messages"), href: "/recruitment/messages", icon: FileText },
  { name: t("sidebar.smsTemplates"), href: "/recruitment/sms-templates", icon: FileText },
  { name: t("sidebar.emailTemplates"), href: "/recruitment/email-templates", icon: FileText },
];

// Navigation items for employees
const getEmployeeNavigation = (t: (key: string) => string) => [
  { name: t("sidebar.myCalendar"), href: "/my-schedule", icon: UserCheck },
  { name: t("sidebar.myProfile"), href: "/my-profile", icon: Users },
  { name: t("sidebar.myContract"), href: "/my-contracts", icon: FileText },
  { name: t("sidebar.teamWishesCareer"), href: "/career-wishes", icon: Sparkles },
  { name: t("sidebar.pulseSurvey"), href: "/pulse-survey", icon: HeartHandshake },
];

// Navigation items for SOME employees (dedicated)
const getSomeEmployeeNavigation = (t: (key: string) => string) => [
  { name: t("sidebar.some"), href: "/some", icon: Video },
  { name: t("sidebar.myCalendar"), href: "/my-schedule", icon: UserCheck },
  { name: t("sidebar.myProfile"), href: "/my-profile", icon: Users },
  { name: t("sidebar.myContracts"), href: "/my-contracts", icon: FileText },
];

// Teamleder extra navigation (pulse survey results, code of conduct for their team)
const getTeamlederExtraNavigation = (t: (key: string) => string) => [
  { name: t("sidebar.pulseSurveyResults"), href: "/pulse-survey-results", icon: BarChart3 },
];

// Code of conduct admin - only for teamleders (owners already have it in ownerNavigation)
const getTeamlederCodeOfConductNav = (t: (key: string) => string) => [
  { name: t("sidebar.codeOfConductAdmin"), href: "/code-of-conduct-admin", icon: Shield },
];

const getShiftPlanningNavigation = (t: (key: string) => string) => [
  { name: t("sidebar.shiftPlanLeader"), href: "/shift-planning", icon: Calendar },
  { name: t("sidebar.mySchedule"), href: "/shift-planning/my-schedule", icon: UserCheck },
  { name: t("sidebar.absence"), href: "/shift-planning/absence", icon: Clock },
  { name: t("sidebar.timeTracking"), href: "/shift-planning/time-tracking", icon: Timer },
];

// Fieldmarketing (vagt-flow) navigation - only for teamleder and above
const getVagtFlowNavigation = (t: (key: string) => string) => [
  { name: t("sidebar.overview"), href: "/vagt-flow", icon: LayoutDashboard },
  { name: t("sidebar.myWeek"), href: "/vagt-flow/min-uge", icon: UserCheck },
  { name: t("sidebar.bookWeek"), href: "/vagt-flow/book-week", icon: Calendar },
  { name: t("sidebar.bookings"), href: "/vagt-flow/bookings", icon: Calendar },
  { name: t("sidebar.locations"), href: "/vagt-flow/locations", icon: MapPin },
  { name: t("sidebar.vehicles"), href: "/vagt-flow/vehicles", icon: Car },
  { name: t("sidebar.billing"), href: "/vagt-flow/billing", icon: Receipt },
];

// Boards navigation
const getBoardsNavigation = (t: (key: string) => string) => [
  { name: t("sidebar.test"), href: "/boards/test", icon: Tv },
  { name: t("sidebar.economic"), href: "/boards/economic", icon: Wallet },
];

type NavItem = { name: string; href: string; icon: typeof Users; badgeKey?: string };

// Employee-only shift planning items (empty - employees don't see shift planning menu)
const employeeShiftPlanningNavigation: NavItem[] = [];

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
  const { isTeamlederOrAbove, isOwner, isRekruttering, isRekrutteringOrAbove, isTeamleder, isSome, isLoading, role } = useCanAccess();
  const { user } = useAuth();
  const { showMenuItem: showPulseSurvey, showBadge: showPulseBadge } = useShouldShowPulseSurvey();
  const { data: isFieldmarketing } = useIsFieldmarketingEmployee();
  const { data: isSomeEmployee, isLoading: isSomeLoading } = useIsSomeEmployee();
  const { data: carQuizCompletion } = useCarQuizCompletion();
  const { data: isSalgskonsulent } = useIsSalgskonsulent();
  const { isRequired: codeOfConductRequired } = useCodeOfConductLock();
  const [shiftPlanningOpen, setShiftPlanningOpen] = useState(location.pathname.startsWith("/shift-planning"));
  const [vagtFlowOpen, setVagtFlowOpen] = useState(location.pathname.startsWith("/vagt-flow"));
  const [recruitmentOpen, setRecruitmentOpen] = useState(location.pathname.startsWith("/recruitment"));
  const [mgOpen, setMgOpen] = useState(
    ["/payroll", "/tdc-erhverv", "/codan", "/mg-test", "/dialer-data", "/adversus-data"].includes(location.pathname)
  );
  const [timeTrackingOpen, setTimeTrackingOpen] = useState(
    location.pathname === "/shift-planning/time-tracking" || 
    location.pathname === "/extra-work" || 
    location.pathname === "/extra-work-admin"
  );
  const [boardsOpen, setBoardsOpen] = useState(location.pathname.startsWith("/boards"));

  // Fetch denied menu items for this user
  const { data: deniedMenuItems = [] } = useQuery({
    queryKey: ["user-denied-permissions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("user_menu_permissions")
        .select("menu_item_id")
        .eq("user_id", user.id)
        .eq("permission_type", "deny");
      return data?.map(p => p.menu_item_id) || [];
    },
    enabled: !!user?.id,
    staleTime: 60000,
  });

  // Fetch granted menu items for this user using security definer function
  const { data: grantedMenuItems = [] } = useQuery({
    queryKey: ["user-granted-permissions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase.rpc('get_user_granted_permissions', {
        _user_id: user.id
      });
      if (error) {
        console.error("Error fetching granted permissions:", error);
        return [];
      }
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 60000,
  });

  // Helper to check if a menu item is denied
  const isMenuItemDenied = (menuId: string) => deniedMenuItems.includes(menuId);
  
  // Helper to check if a menu item is granted (for opt-in features)
  const isMenuItemGranted = (menuId: string) => grantedMenuItems.includes(menuId);

  // Fetch employee name and pending contracts count
  const { data: employeeData } = useQuery({
    queryKey: ["sidebar-employee-data", user?.email],
    queryFn: async () => {
      if (!user?.email) return { name: null, pendingContracts: 0 };

      const { data: employee } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name")
        .eq("private_email", user.email)
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

  // Fetch pending absence requests count for teamleders
  const { data: pendingAbsenceCount = 0 } = useQuery({
    queryKey: ["pending-absence-count", user?.email],
    queryFn: async () => {
      if (!user?.email) return 0;

      const { data: currentEmployee } = await supabase
        .from("employee_master_data")
        .select("id")
        .eq("private_email", user.email)
        .maybeSingle();

      if (!currentEmployee) return 0;

      const now = new Date().toISOString();

      // If owner, get all pending requests
      if (isOwner) {
        const { count } = await supabase
          .from("absence_request_v2")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending")
          .or(`postponed_until.is.null,postponed_until.lt.${now}`);
        return count || 0;
      }

      // For teamleders, only get team members' requests
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
    enabled: !!user?.email && isTeamlederOrAbove,
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });

  const pendingContractsCount = employeeData?.pendingContracts ?? 0;
  const employeeName = employeeData?.name;

  const handleLogout = async () => {
    // Clear all query cache first
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

  // Check if user has SOME access via individual permission
  const hasSomeAccess = isMenuItemGranted("some");
  
  // Debug logging
  console.log("AppSidebar - grantedMenuItems:", grantedMenuItems, "hasSomeAccess:", hasSomeAccess, "user:", user?.id, "isRekruttering:", isRekruttering);
  
  // Build navigation based on ALL roles the user has (not just one)
  const buildCombinedNavigation = () => {
    const navItems: NavItem[] = [];
    const seenHrefs = new Set<string>();

    const addItems = (items: NavItem[]) => {
      items.forEach(item => {
        if (!seenHrefs.has(item.href)) {
          seenHrefs.add(item.href);
          navItems.push(item);
        }
      });
    };

    // Add items based on each role the user has
    if (isOwner) {
      addItems([...getOwnerNavigation(t), ...getTeamlederExtraNavigation(t)]);
    } else {
      // Non-owner users get items based on their roles
      if (isTeamleder) {
        addItems([...getTeamlederNavigation(t), ...getTeamlederExtraNavigation(t), ...getTeamlederCodeOfConductNav(t)]);
      }
      if (isRekruttering) {
        addItems(getRekrutteringNavigation(t));
      }
      if (isSomeEmployee || isSome) {
        addItems(getSomeEmployeeNavigation(t));
      }
      // If user has no special roles, give employee navigation
      if (!isTeamleder && !isRekruttering && !(isSomeEmployee || isSome)) {
        addItems(getEmployeeNavigation(t).filter(item => item.href !== '/pulse-survey' || showPulseSurvey));
      }
    }

    return navItems;
  };

  const baseNavigation = buildCombinedNavigation();
  
  // Filter out denied menu items based on href to menu_item_id mapping
  const hrefToMenuId: Record<string, string> = {
    '/pulse-survey': 'pulse-survey',
    '/some': 'some',
    '/employees': 'employees',
    '/teams': 'teams',
    '/contracts': 'contracts',
    '/my-contracts': 'my-contracts',
    '/my-profile': 'my-profile',
    '/my-schedule': 'my-schedule',
    '/career-wishes': 'career-wishes',
    '/sales': 'sales',
    '/shift-planning': 'shift-planning',
  };
  
  let mainNavigation = baseNavigation.filter(item => {
    const menuId = hrefToMenuId[item.href];
    if (menuId && isMenuItemDenied(menuId)) return false;
    return true;
  });
  
  // Add opt-in menu items if user has been granted access
  if (isMenuItemGranted("time-stamp")) {
    mainNavigation = [...mainNavigation, { name: t("sidebar.timeClock"), href: "/time-stamp", icon: Clock }];
  }
  
  // Add SOME menu item if granted via individual permissions and not already in navigation
  if (hasSomeAccess && !mainNavigation.some(item => item.href === "/some")) {
    mainNavigation = [...mainNavigation, { name: t("sidebar.some"), href: "/some", icon: Video }];
  }
  
  // Add car-quiz-admin if granted
  if (isMenuItemGranted("car-quiz-admin") && !mainNavigation.some(item => item.href === "/car-quiz-admin")) {
    mainNavigation = [...mainNavigation, { name: t("sidebar.carQuizAdmin"), href: "/car-quiz-admin", icon: Car }];
  }
  
  // Add code of conduct admin if granted
  if (isMenuItemGranted("coc-admin") && !mainNavigation.some(item => item.href === "/code-of-conduct-admin")) {
    mainNavigation = [...mainNavigation, { name: t("sidebar.codeOfConductAdmin"), href: "/code-of-conduct-admin", icon: Shield }];
  }
  
  // Add pulse survey results if granted
  if (isMenuItemGranted("pulse-results") && !mainNavigation.some(item => item.href === "/pulse-survey-results")) {
    mainNavigation = [...mainNavigation, { name: t("sidebar.pulseSurveyResults"), href: "/pulse-survey-results", icon: BarChart3 }];
  }
  
  const currentShiftPlanningNav = isOwner ? getShiftPlanningNavigation(t) : employeeShiftPlanningNavigation;
  const vagtFlowNav = getVagtFlowNavigation(t);
  const mgNav = getMgNavigation(t);
  const boardsNav = getBoardsNavigation(t);
  const recruitmentNav = getRecruitmentNavigation(t);

  const handleNavClick = () => {
    if (isMobile && onNavigate) {
      onNavigate();
    }
  };

  const sidebarClasses = isMobile 
    ? "h-full w-full bg-sidebar overflow-y-auto" 
    : "fixed left-0 top-0 z-40 h-screen w-64 border-r border-sidebar-border bg-sidebar overflow-y-auto";

  if (isLoading || isSomeLoading) {
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
          {mainNavigation.map((item) => {
            const isActive = location.pathname === item.href;
            const hasPendingAbsenceBadge = 'badgeKey' in item && item.badgeKey === 'pendingAbsence' && pendingAbsenceCount > 0;
            const showBadge = (item.href === "/my-contracts" && pendingContractsCount > 0) || 
                              (item.href === "/pulse-survey" && showPulseBadge) ||
                              hasPendingAbsenceBadge;
            const badgeCount = hasPendingAbsenceBadge 
              ? pendingAbsenceCount 
              : item.href === "/my-contracts" 
                ? pendingContractsCount 
                : 1;
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
                {showBadge && (
                  <Badge variant={item.href === "/pulse-survey" ? "default" : "destructive"} className="h-5 min-w-5 px-1.5 text-xs">
                    {item.href === "/pulse-survey" ? t("sidebar.new") : badgeCount}
                  </Badge>
                )}
              </NavLink>
            );
          })}

          {/* Firmabil menu item for Fieldmarketing employees */}
          {isFieldmarketing && !isTeamlederOrAbove && (
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
                <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">
                  !
                </Badge>
              )}
            </NavLink>
          )}


          {isSalgskonsulent && !isOwner && (
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
                <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">
                  !
                </Badge>
              )}
            </NavLink>
          )}

          {/* Intern Vagtplan menu */}
          {currentShiftPlanningNav.length > 0 && (
            <Collapsible open={shiftPlanningOpen} onOpenChange={setShiftPlanningOpen}>
              <CollapsibleTrigger className={cn(
                "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                location.pathname.startsWith("/shift-planning") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}>
                <div className="flex items-center gap-3">
                  <ClipboardList className="h-5 w-5" />
                  {t("sidebar.shiftPlan")}
                </div>
                {shiftPlanningOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 space-y-1 mt-1">
                {currentShiftPlanningNav.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      onClick={handleNavClick}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                        isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.name}
                    </NavLink>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Fieldmarketing menu - for owners, teamleders, or users with fieldmarketing permission */}
          {(isOwner || isTeamlederOrAbove || isMenuItemGranted("fieldmarketing")) && (
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
                {vagtFlowNav.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      onClick={handleNavClick}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                        isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.name}
                    </NavLink>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* MG menu - only for owners */}
          {isOwner && (
            <Collapsible open={mgOpen} onOpenChange={setMgOpen}>
              <CollapsibleTrigger className={cn(
                "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                ["/payroll", "/tdc-erhverv", "/codan", "/mg-test", "/adversus-data"].includes(location.pathname) ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}>
                <div className="flex items-center gap-3">
                  <Percent className="h-5 w-5" />
                  {t("sidebar.mg")}
                </div>
                {mgOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 space-y-1 mt-1">
                {mgNav.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      onClick={handleNavClick}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                        isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.name}
                    </NavLink>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Boards menu - for teamleder or above */}
          {isTeamlederOrAbove && (
            <Collapsible open={boardsOpen} onOpenChange={setBoardsOpen}>
              <CollapsibleTrigger className={cn(
                "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                location.pathname.startsWith("/boards") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}>
                <div className="flex items-center gap-3">
                  <Monitor className="h-5 w-5" />
                  {t("sidebar.boards")}
                </div>
                {boardsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 space-y-1 mt-1">
                {boardsNav.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      onClick={handleNavClick}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                        isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.name}
                    </NavLink>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Rekruttering menu - for owners and rekruttering role */}
          {(isOwner || isRekruttering) && (
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
                {recruitmentNav.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      onClick={handleNavClick}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                        isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.name}
                    </NavLink>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          )}

          {isOwner && (
            <NavLink
              to="/admin"
              onClick={handleNavClick}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                location.pathname === "/admin" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <Crown className="h-5 w-5" />
              {t("sidebar.administration")}
            </NavLink>
          )}

          {isOwner && (
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
          <NavLink
            to={isTeamlederOrAbove ? "/shift-planning/time-tracking" : "/extra-work"}
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
