import { LayoutDashboard, Users, ShoppingCart, Wallet, Settings, Tv, LogOut, Percent, Shield, Building2, Calendar, MapPin, ChevronDown, ChevronRight, Car, Clock, UserCheck, Receipt, Database, ListChecks, ClipboardList, Timer, FileText, Crown, User, HeartHandshake, BarChart3, Sparkles } from "lucide-react";
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
import { useCarQuizCompletion } from "@/hooks/useCarQuiz";

// Navigation items for teamleder and above
const teamlederNavigation = [
  { name: "Medarbejdere", href: "/employees", icon: Users },
  { name: "Kontrakter", href: "/contracts", icon: FileText },
  { name: "Mine kontrakter", href: "/my-contracts", icon: FileText },
  { name: "Salg", href: "/sales", icon: ShoppingCart },
  { name: "Codan", href: "/codan", icon: Shield },
  { name: "TDC Erhverv", href: "/tdc-erhverv", icon: Building2 },
  { name: "Provision og CPO", href: "/commission-cpo", icon: Percent },
  { name: "Lønkørsel", href: "/payroll", icon: Wallet },
  { name: "Datakilder info", href: "/adversus-data", icon: Database },
  { name: "Logikker", href: "/logikker", icon: ListChecks },
  { name: "MG test", href: "/mg-test", icon: Percent },
  { name: "Bil-quiz overblik", href: "/car-quiz-admin", icon: Car },
];

// Navigation items for rekruttering role
const rekrutteringNavigation = [
  { name: "Medarbejdere", href: "/employees", icon: Users },
  { name: "Kontrakter", href: "/contracts", icon: FileText },
  { name: "Mine kontrakter", href: "/my-contracts", icon: FileText },
  { name: "Karriereønsker", href: "/career-wishes-overview", icon: Sparkles },
  { name: "Min kalender", href: "/my-schedule", icon: UserCheck },
  { name: "Min profil", href: "/my-profile", icon: User },
];

// Navigation items for employees
const employeeNavigation = [
  { name: "Min kalender", href: "/my-schedule", icon: UserCheck },
  { name: "Min profil", href: "/my-profile", icon: Users },
  { name: "Min kontrakt", href: "/my-contracts", icon: FileText },
  { name: "Teamønsker & karriere", href: "/career-wishes", icon: Sparkles },
  { name: "Pulsmåling", href: "/pulse-survey", icon: HeartHandshake },
];

// Teamleder navigation includes pulse survey results and career wishes overview
const teamlederExtraNavigation = [
  { name: "Pulsmåling resultater", href: "/pulse-survey-results", icon: BarChart3 },
  { name: "Karriereønsker", href: "/career-wishes-overview", icon: Sparkles },
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
  const { isTeamlederOrAbove, isOwner, isRekruttering, isRekrutteringOrAbove, isLoading, role } = useCanAccess();
  const { user } = useAuth();
  const { showMenuItem: showPulseSurvey, showBadge: showPulseBadge } = useShouldShowPulseSurvey();
  const { data: isFieldmarketing } = useIsFieldmarketingEmployee();
  const { data: carQuizCompletion } = useCarQuizCompletion();
  const [shiftPlanningOpen, setShiftPlanningOpen] = useState(location.pathname.startsWith("/shift-planning"));
  const [vagtFlowOpen, setVagtFlowOpen] = useState(location.pathname.startsWith("/vagt-flow"));

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

  // Select navigation based on role
  const mainNavigation = isTeamlederOrAbove 
    ? [...teamlederNavigation, ...teamlederExtraNavigation] 
    : isRekruttering 
      ? rekrutteringNavigation
      : employeeNavigation.filter(item => item.href !== '/pulse-survey' || showPulseSurvey);
  const currentShiftPlanningNav = isTeamlederOrAbove ? shiftPlanningNavigation : employeeShiftPlanningNavigation;

  if (isLoading) {
    return (
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-sidebar-border bg-sidebar overflow-y-auto">
        <div className="flex h-full flex-col">
          <div className="flex h-20 items-center justify-center border-b border-sidebar-border px-6">
            <img src={cphSalesLogo} alt="CPH Sales" className="h-14 w-auto object-contain" />
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
        <div className="flex h-20 items-center justify-center border-b border-sidebar-border px-6">
          <img src={cphSalesLogo} alt="CPH Sales" className="h-14 w-auto object-contain" />
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {mainNavigation.map((item) => {
            const isActive = location.pathname === item.href;
            const showBadge = (item.href === "/my-contracts" && pendingContractsCount > 0) || 
                              (item.href === "/pulse-survey" && showPulseBadge);
            const badgeCount = item.href === "/my-contracts" ? pendingContractsCount : 1;
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

          {/* Intern Vagtplan menu */}
          {currentShiftPlanningNav.length > 0 && (
            <Collapsible open={shiftPlanningOpen} onOpenChange={setShiftPlanningOpen}>
              <CollapsibleTrigger className={cn(
                "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                location.pathname.startsWith("/shift-planning") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}>
                <div className="flex items-center gap-3">
                  <ClipboardList className="h-5 w-5" />
                  Intern vagtplan
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

          {/* Fieldmarketing menu - only for teamleder and above */}
          {isTeamlederOrAbove && (
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

          {isTeamlederOrAbove && (
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
