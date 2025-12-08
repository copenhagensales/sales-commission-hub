import { LayoutDashboard, Users, ShoppingCart, Wallet, Settings, Tv, LogOut, Percent, Shield, Building2, Calendar, MapPin, ChevronDown, ChevronRight, Car, Clock, UserCheck, Receipt, Database, ListChecks, ClipboardList, Timer, FileText, Crown, User, HeartHandshake, BarChart3, Sparkles, Plus, UserPlus, RefreshCcw, CalendarClock, UserCog, Video } from "lucide-react";
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

// Navigation items for owners only (full access)
const ownerNavigation = [
  { name: "Medarbejdere", href: "/employees", icon: Users },
  { name: "Teams", href: "/teams", icon: Users },
  { name: "Kontrakter", href: "/contracts", icon: FileText },
  { name: "Mine kontrakter", href: "/my-contracts", icon: FileText },
  { name: "Karriereønsker", href: "/career-wishes-overview", icon: Sparkles },
  { name: "SOME", href: "/some", icon: Video },
  { name: "Salg", href: "/sales", icon: ShoppingCart },
  { name: "Provision og CPO", href: "/commission-cpo", icon: Percent },
  { name: "Logikker", href: "/logikker", icon: ListChecks },
  { name: "Bil-quiz overblik", href: "/car-quiz-admin", icon: Car },
  { name: "Code of Conduct overblik", href: "/code-of-conduct-admin", icon: Shield },
];

// MG submenu navigation
const mgNavigation = [
  { name: "Lønkørsel", href: "/payroll", icon: Wallet },
  { name: "TDC Erhverv", href: "/tdc-erhverv", icon: Building2 },
  { name: "Codan", href: "/codan", icon: Shield },
  { name: "MG test", href: "/mg-test", icon: Percent },
  { name: "Datakilder info", href: "/adversus-data", icon: Database },
];

// Navigation items for teamleder (limited team-related access)
const teamlederNavigation = [
  { name: "Vagtplan", href: "/shift-planning", icon: ClipboardList },
  { name: "Godkend fravær", href: "/shift-planning/absence", icon: Clock, badgeKey: "pendingAbsence" },
  { name: "Mit team", href: "/employees", icon: Users },
  { name: "Kontrakter", href: "/contracts", icon: FileText },
  { name: "Mine kontrakter", href: "/my-contracts", icon: FileText },
  { name: "Min profil", href: "/my-profile", icon: User },
];

// Navigation items for rekruttering role
const rekrutteringNavigation = [
  { name: "Rekruttering", href: "/recruitment", icon: UserPlus },
  { name: "Medarbejdere", href: "/employees", icon: Users },
  { name: "Teams", href: "/teams", icon: Users },
  { name: "Kontrakter", href: "/contracts", icon: FileText },
  { name: "Mine kontrakter", href: "/my-contracts", icon: FileText },
  { name: "Karriereønsker", href: "/career-wishes-overview", icon: Sparkles },
  { name: "Min kalender", href: "/my-schedule", icon: UserCheck },
  { name: "Min profil", href: "/my-profile", icon: User },
];

// Rekruttering submenu navigation
const recruitmentNavigation = [
  { name: "Dashboard", href: "/recruitment", icon: LayoutDashboard },
  { name: "Kandidater", href: "/recruitment/candidates", icon: Users },
  { name: "Kommende samtaler", href: "/recruitment/upcoming-interviews", icon: CalendarClock },
  { name: "Winback", href: "/recruitment/winback", icon: RefreshCcw },
  { name: "Ansættelser", href: "/recruitment/upcoming-hires", icon: UserCog },
  { name: "Beskeder", href: "/recruitment/messages", icon: FileText },
  { name: "SMS-skabeloner", href: "/recruitment/sms-templates", icon: FileText },
  { name: "Email-skabeloner", href: "/recruitment/email-templates", icon: FileText },
];

// Navigation items for employees
const employeeNavigation = [
  { name: "Min kalender", href: "/my-schedule", icon: UserCheck },
  { name: "Min profil", href: "/my-profile", icon: Users },
  { name: "Min kontrakt", href: "/my-contracts", icon: FileText },
  { name: "Teamønsker & karriere", href: "/career-wishes", icon: Sparkles },
  { name: "Pulsmåling", href: "/pulse-survey", icon: HeartHandshake },
];

// Teamleder extra navigation (pulse survey results, code of conduct for their team)
const teamlederExtraNavigation = [
  { name: "Pulsmåling resultater", href: "/pulse-survey-results", icon: BarChart3 },
];

// Code of conduct admin - only for teamleders (owners already have it in ownerNavigation)
const teamlederCodeOfConductNav = [
  { name: "Code of Conduct overblik", href: "/code-of-conduct-admin", icon: Shield },
];

const shiftPlanningNavigation = [
  { name: "Vagtplan (leder)", href: "/shift-planning", icon: Calendar },
  { name: "Min kalender", href: "/shift-planning/my-schedule", icon: UserCheck },
  { name: "Fravær", href: "/shift-planning/absence", icon: Clock },
  { name: "Tidsregistrering", href: "/shift-planning/time-tracking", icon: Timer },
];

// Fieldmarketing (vagt-flow) navigation - only for teamleder and above
const vagtFlowNavigation = [
  { name: "Oversigt", href: "/vagt-flow", icon: LayoutDashboard },
  { name: "Min uge", href: "/vagt-flow/min-uge", icon: UserCheck },
  { name: "Book uge", href: "/vagt-flow/book-week", icon: Calendar },
  { name: "Vagtplan", href: "/vagt-flow/bookings", icon: Calendar },
  { name: "Lokationer", href: "/vagt-flow/locations", icon: MapPin },
  { name: "Medarbejdere", href: "/vagt-flow/employees", icon: Users },
  { name: "Fravær", href: "/vagt-flow/time-off", icon: Clock },
  { name: "Køretøjer", href: "/vagt-flow/vehicles", icon: Car },
  { name: "Fakturering", href: "/vagt-flow/billing", icon: Receipt },
];

// Employee-only shift planning items (empty - employees don't see shift planning menu)
const employeeShiftPlanningNavigation: typeof shiftPlanningNavigation = [];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isTeamlederOrAbove, isOwner, isRekruttering, isRekrutteringOrAbove, isTeamleder, isLoading, role } = useCanAccess();
  const { user } = useAuth();
  const { showMenuItem: showPulseSurvey, showBadge: showPulseBadge } = useShouldShowPulseSurvey();
  const { data: isFieldmarketing } = useIsFieldmarketingEmployee();
  const { data: isSomeEmployee } = useIsSomeEmployee();
  const { data: carQuizCompletion } = useCarQuizCompletion();
  const { data: isSalgskonsulent } = useIsSalgskonsulent();
  const { isRequired: codeOfConductRequired } = useCodeOfConductLock();
  const [shiftPlanningOpen, setShiftPlanningOpen] = useState(location.pathname.startsWith("/shift-planning"));
  const [vagtFlowOpen, setVagtFlowOpen] = useState(location.pathname.startsWith("/vagt-flow"));
  const [recruitmentOpen, setRecruitmentOpen] = useState(location.pathname.startsWith("/recruitment"));
  const [mgOpen, setMgOpen] = useState(
    ["/payroll", "/tdc-erhverv", "/codan", "/mg-test", "/adversus-data"].includes(location.pathname)
  );
  const [timeTrackingOpen, setTimeTrackingOpen] = useState(
    location.pathname === "/shift-planning/time-tracking" || 
    location.pathname === "/extra-work" || 
    location.pathname === "/extra-work-admin"
  );

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

  // Fetch granted menu items for this user (for opt-in features like time-stamp)
  const { data: grantedMenuItems = [] } = useQuery({
    queryKey: ["user-granted-permissions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("user_menu_permissions")
        .select("menu_item_id")
        .eq("user_id", user.id)
        .eq("permission_type", "grant");
      return data?.map(p => p.menu_item_id) || [];
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

  // Select navigation based on role and filter out denied items
  const baseNavigation = isOwner 
    ? [...ownerNavigation, ...teamlederExtraNavigation]
    : isTeamleder
      ? [...teamlederNavigation, ...teamlederExtraNavigation, ...teamlederCodeOfConductNav] 
      : isRekruttering 
        ? rekrutteringNavigation
        : employeeNavigation.filter(item => item.href !== '/pulse-survey' || showPulseSurvey);
  
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
    mainNavigation = [...mainNavigation, { name: "Stempel", href: "/time-stamp", icon: Clock }];
  }
  
  const currentShiftPlanningNav = isOwner ? shiftPlanningNavigation : employeeShiftPlanningNavigation;

  if (isLoading) {
    return (
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-sidebar-border bg-sidebar overflow-y-auto">
        <div className="flex h-full flex-col">
        <div className="flex h-16 items-center justify-center border-b border-sidebar-border px-4">
            <div 
              onClick={() => navigate("/")} 
              className="flex items-center justify-center px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 hover:bg-sidebar-accent/50"
            >
              <img src={cphSalesLogo} alt="CPH Sales" className="h-10 w-auto object-contain" />
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Indlæser...</div>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-sidebar-border bg-sidebar overflow-y-auto">
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center justify-center border-b border-sidebar-border px-4">
          <div 
            onClick={() => navigate("/")} 
            className="flex items-center justify-center px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 hover:bg-sidebar-accent/50"
          >
            <img src={cphSalesLogo} alt="CPH Sales" className="h-10 w-auto object-contain" />
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-4">
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
                    {item.href === "/pulse-survey" ? "Ny" : badgeCount}
                  </Badge>
                )}
              </NavLink>
            );
          })}

          {/* Firmabil menu item for Fieldmarketing employees */}
          {isFieldmarketing && !isTeamlederOrAbove && (
            <NavLink
              to="/car-quiz"
              className={cn(
                "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                location.pathname === "/car-quiz" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <div className="flex items-center gap-3">
                <Car className="h-5 w-5" />
                Firmabil
              </div>
              {!carQuizCompletion && (
                <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">
                  !
                </Badge>
              )}
            </NavLink>
          )}

          {/* SOME menu item for SOME employees */}
          {isSomeEmployee && !isOwner && (
            <NavLink
              to="/some"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                location.pathname === "/some" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <Video className="h-5 w-5" />
              SOME
            </NavLink>
          )}

          {isSalgskonsulent && !isOwner && (
            <NavLink
              to="/code-of-conduct"
              className={cn(
                "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                location.pathname === "/code-of-conduct" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5" />
                Code of Conduct
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
                  Vagtplan
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

          {/* Fieldmarketing menu - only for owners */}
          {isOwner && (
            <Collapsible open={vagtFlowOpen} onOpenChange={setVagtFlowOpen}>
              <CollapsibleTrigger className={cn(
                "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                location.pathname.startsWith("/vagt-flow") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}>
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5" />
                  Fieldmarketing
                </div>
                {vagtFlowOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 space-y-1 mt-1">
                {vagtFlowNavigation.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <NavLink
                      key={item.name}
                      to={item.href}
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
                  MG
                </div>
                {mgOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 space-y-1 mt-1">
                {mgNavigation.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <NavLink
                      key={item.name}
                      to={item.href}
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
              <CollapsibleTrigger className={cn(
                "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                location.pathname.startsWith("/recruitment") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}>
                <div className="flex items-center gap-3">
                  <UserPlus className="h-5 w-5" />
                  Rekruttering
                </div>
                {recruitmentOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 space-y-1 mt-1">
                {recruitmentNavigation.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <NavLink
                      key={item.name}
                      to={item.href}
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
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                location.pathname === "/admin" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <Crown className="h-5 w-5" />
              Administration
            </NavLink>
          )}

          {isOwner && (
            <NavLink
              to="/settings"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                location.pathname === "/settings" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <Settings className="h-5 w-5" />
              Indstillinger
            </NavLink>
          )}
        </nav>
        <div className="border-t border-sidebar-border p-4 space-y-2">
          {/* Tidsregistrering with Ekstra arbejde submenu */}
          <Collapsible open={timeTrackingOpen} onOpenChange={setTimeTrackingOpen}>
            <CollapsibleTrigger className={cn(
              "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              (location.pathname === "/shift-planning/time-tracking" || location.pathname === "/extra-work" || location.pathname === "/extra-work-admin") 
                ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                : "text-sidebar-foreground hover:bg-sidebar-accent/50"
            )}>
              <div className="flex items-center gap-3">
                <Timer className="h-5 w-5" />
                Tidsregistrering
              </div>
              {timeTrackingOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-4 space-y-1 mt-1">
              {isTeamlederOrAbove && (
                <NavLink
                  to="/shift-planning/time-tracking"
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/shift-planning/time-tracking" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  <Clock className="h-4 w-4" />
                  Oversigt
                </NavLink>
              )}
              <NavLink
                to={isTeamlederOrAbove ? "/extra-work-admin" : "/extra-work"}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  (location.pathname === "/extra-work" || location.pathname === "/extra-work-admin") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <Plus className="h-4 w-4" />
                Ekstra arbejde
              </NavLink>
            </CollapsibleContent>
          </Collapsible>

          <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50">
            <LogOut className="h-5 w-5" />
            Log ud
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
