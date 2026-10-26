import { useTeamPersonaleSynlighed } from "@/hooks/useTeamPersonaleSynlighed";
import { useSalgRapporterSynlighed } from "@/hooks/useSalgRapporterSynlighed";
import { useAdminSynlighed } from "@/hooks/useAdminSynlighed";
import { useMitArbejdeSynlighed } from "@/hooks/useMitArbejdeSynlighed";
import { clearPushSubscription } from "@/hooks/usePushNotifications";
import { LayoutDashboard, Users, ShoppingCart, Wallet, Settings, LogOut, Percent, Shield, ShieldCheck, Building2, Calendar, MapPin, ChevronDown, ChevronRight, Car, Clock, UserCheck, Receipt, Database, ListChecks, ClipboardList, ClipboardCheck, FileText, Crown, User, BarChart3, Sparkles, UserPlus, CalendarClock, UserCog, Video, Monitor, Phone, FlaskConical, Lock, Home, RefreshCcw, CalendarDays, MessageSquare, GraduationCap, Palette, Target, Activity, Swords, Mail, Gift, FileBarChart, CreditCard, Pencil, Trophy, Wrench, BookOpen, TrendingUp, TrendingDown, PanelLeft, XCircle, PencilLine, Inbox, AlertTriangle, Menu as MenuIcon, MonitorSmartphone, Tag } from "lucide-react";
import { PulsenUnreadBadge } from "@/components/pulsen/PulsenUnreadBadge";
import { StorkbookMark } from "@/components/storkbook/StorkbookMark";
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
import { useState, useMemo, useEffect } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { useItAccess } from "@/hooks/useItWorkstations";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePositionPermissions";
import { useIsSuperadmin } from "@/hooks/useIsSuperadmin";
import { useRolePreview } from "@/contexts/RolePreviewContext";
import { useCanWorkFieldmarketing, useIsFieldmarketingEmployee } from "@/hooks/useFieldmarketingEmployee";
import { useEmployeeSmsUnreadCount } from "@/hooks/useEmployeeSmsConversations";
import { useShouldShowPulseSurvey } from "@/hooks/usePulseSurvey";
import { useCarQuizCompletion } from "@/hooks/useCarQuiz";
import { useIsSalgskonsulent, useCodeOfConductLock } from "@/hooks/useCodeOfConduct";
import { useHasImmediatePaymentSales } from "@/hooks/useHasImmediatePaymentSales";
import { useFmBookingConflicts } from "@/hooks/useFmBookingConflicts";
import { useTranslation } from "react-i18next";
import { useSidebarMenuConfig, type MenuConfigItem } from "@/hooks/useSidebarMenuConfig";
import { useIsUnitedMember } from "@/hooks/useIsUnitedMember";
import { useTrygEditAccess } from "@/hooks/useTrygEditAccess";
import { useCanViewRampTeam } from "@/hooks/useRampTeam";
import { useQualityAccess } from "@/hooks/useQualityControl";
import { ViewAsSelector } from "./ViewAsSelector";
import { useComplianceReviewStatus } from "@/hooks/useComplianceReviewStatus";
import { usePendingSupplierDispatchCount } from "@/hooks/useSupplierReportDispatch";
import { useInvoiceflowAccess } from "@/hooks/useInvoiceflow";

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
  const { isSuperadmin } = useIsSuperadmin();
  const { hasAccess: trygEditAccess } = useTrygEditAccess();
  const { data: canViewRampTeam } = useCanViewRampTeam();
  // Kvalitetskontrol er skjult for saelgere; adgangen kommer fra databasen
  const { hasAccess: hasQualityAccess } = useQualityAccess();
  const { count: complianceReviewCount } = useComplianceReviewStatus();
  const { data: pendingDispatchCount = 0 } = usePendingSupplierDispatchCount(
    p.canViewFmBilling,
  );
  
  const { data: isFieldmarketing } = useIsFieldmarketingEmployee();
  const { data: canWorkFieldmarketing } = useCanWorkFieldmarketing();
  const mitArbejde = useMitArbejdeSynlighed();
  const tp = useTeamPersonaleSynlighed();
  const sr = useSalgRapporterSynlighed();
  const ad = useAdminSynlighed();
  const { data: carQuizCompletion } = useCarQuizCompletion();
  const { data: isSalgskonsulent } = useIsSalgskonsulent();
  const { isRequired: codeOfConductRequired } = useCodeOfConductLock();
  const { data: employeeSmsUnreadCount = 0 } = useEmployeeSmsUnreadCount();
  
  const pulseSurvey = useShouldShowPulseSurvey();
  const { data: hasImmediatePaymentSales } = useHasImmediatePaymentSales();

  // Menu config from database - controls sort_order and visibility
  const { data: menuConfig } = useSidebarMenuConfig();
  const { data: isUnitedMember } = useIsUnitedMember();
  
  // Helper: check if a menu item is hidden via the menu editor
  const isMenuHidden = useMemo(() => {
    if (!menuConfig) return (_key: string) => false;
    const configMap = new Map(menuConfig.map(c => [c.item_key, c]));
    return (key: string) => {
      const config = configMap.get(key);
      return config ? !config.visible : false;
    };
  }, [menuConfig]);

  // Helper: get sort order for top-level items
  const getSortOrder = useMemo(() => {
    if (!menuConfig) return (_key: string) => 0;
    const configMap = new Map(menuConfig.map(c => [c.item_key, c]));
    return (key: string) => configMap.get(key)?.sort_order ?? 999;
  }, [menuConfig]);

  const [mitHjemOpen, setMitHjemOpen] = useState(
    ["/home", "/messages", "/my-profile", "/my-feedback", "/pulse-survey", "/refer-a-friend", "/my-goals", "/team-goals", "/immediate-payment-ase", "/tdc-opsummering", "/tdc-idriftsaettelse", "/fiber-registrering"].some(path => location.pathname === path || location.pathname.startsWith(path))
  );
  const [spilOpen, setSpilOpen] = useState(
    ["/head-to-head", "/commission-league", "/admin/league", "/admin/h2h", "/team/h2h"].some(path => location.pathname === path || location.pathname.startsWith(path))
  );
  const [shiftPlanningOpen, setShiftPlanningOpen] = useState(location.pathname.startsWith("/shift-planning") || location.pathname === "/time-stamp");
  const [vagtFlowOpen, setVagtFlowOpen] = useState(location.pathname.startsWith("/vagt-flow"));
  const [recruitmentOpen, setRecruitmentOpen] = useState(location.pathname.startsWith("/recruitment"));
  const { hasAccess: invoiceflowAccess } = useInvoiceflowAccess();
  const [ledelseOpen, setLedelseOpen] = useState(
    ["/contracts", "/permissions", "/career-wishes-overview", "/company-overview", "/onboarding-analyse", "/email-templates", "/admin/security", "/system-stability", "/car-quiz-admin", "/code-of-conduct-admin", "/pulse-survey-results", "/reports/revenue-by-client", "/customer-inquiries"].some(path => location.pathname.startsWith(path))
  );
  const [personnelOpen, setPersonnelOpen] = useState(location.pathname.startsWith("/employees") || location.pathname === "/login-log" || location.pathname === "/upcoming-starts");
  const [mgOpen, setMgOpen] = useState(location.pathname === "/mg-test");
  // Dashboard state removed - dashboards are now in separate environment
  // (SOME menu removed; Ekstraarbejde is now top-level)
  const [onboardingOpen, setOnboardingOpen] = useState(
    location.pathname.startsWith("/onboarding-program") || location.pathname === "/coaching-templates"
  );
  const [reportsOpen, setReportsOpen] = useState(
    location.pathname.startsWith("/reports") || location.pathname === "/salary/cancellations"
  );
  const [salaryOpen, setSalaryOpen] = useState(
    location.pathname.startsWith("/salary")
  );

  // Live clock (Danish time)
  const [clockTime, setClockTime] = useState(() =>
    new Date().toLocaleTimeString("da-DK", { timeZone: "Europe/Copenhagen", hour: "2-digit", minute: "2-digit" })
  );
  useEffect(() => {
    const id = setInterval(() => {
      setClockTime(new Date().toLocaleTimeString("da-DK", { timeZone: "Europe/Copenhagen", hour: "2-digit", minute: "2-digit" }));
    }, 15000);
    return () => clearInterval(id);
  }, []);

  const canViewCancellations = p.canView("menu_cancellations");
  const [adminOpen, setAdminOpen] = useState(
    location.pathname.startsWith("/admin")
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
      await clearPushSubscription();
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
    ? "h-full w-full bg-sidebar overflow-y-auto pt-safe pb-safe" 
    : cn(
        "fixed left-0 top-0 z-40 h-[100dvh] pt-safe pb-safe border-r border-sidebar-border bg-sidebar overflow-y-auto transition-all duration-300 ease-in-out",
        isCollapsed ? "w-0 -translate-x-full opacity-0" : "w-64 translate-x-0 opacity-100"
      );

  // Wait for permissions to load
  // IT-modul: kun stab med IT-rettigheden (verificeret i databasen)
  const { data: hasItAccess = false } = useItAccess();
  const showItMenu = !isMenuHidden('section_it') && hasItAccess && p.canView("menu_it_workstations");

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
  
  // Check if Ekstraarbejde menu should be visible (top-level standalone)

  // Check if any Personnel menu items are visible (requires section permission)
  const showPersonnelMenu = !isMenuHidden('section_personale') && p.canView("menu_section_personale") && 
    (tp.har.medarbejdere || p.canViewLoginLog);
  
  // Check if any Ledelse menu items are visible (requires section permission)
  const showLedelseMenu = !isMenuHidden('section_ledelse') && p.canView("menu_section_ledelse") && 
    (p.canViewContracts || p.canViewPermissions || p.canViewCareerWishesOverview || p.canViewSecurityDashboard || p.canViewCarQuizAdmin || p.canViewCocAdmin || p.canViewPulseSurvey || p.canView("menu_customer_inquiries") || p.canViewClientForecast || true);
  
  // Check if any MG menu items are visible (requires section permission)
  const showMgMenu = !isMenuHidden('section_mg') && p.canView("menu_section_mg") && p.canViewMgTest;
  
  const canAccessFmSalesRegistration = p.canViewFmSalesRegistration || !!canWorkFieldmarketing;

  // Check if any Fieldmarketing items are visible. FM opt-in only opens Salgsregistrering.
  const showFieldmarketingMenu = !isMenuHidden('section_fieldmarketing') && (
    // Min vagtplan og Salgsregistrering ligger nu under Mit Hjem → Vagter / Registrér salg (bundt b1).
    p.canView("menu_section_fieldmarketing") && 
      (p.canViewFmOverview || p.canViewFmLocations || p.canViewFmBilling ||
       p.canViewFmBookWeek || p.canViewFmBookings || p.canViewFmEditSales || p.canViewFmEesyDeviations)
  );
  
  // Check if any Shift Planning items are visible (requires section permission)
  const showShiftPlanningMenu = !isMenuHidden('section_vagtplan') && p.canView("menu_section_vagtplan") && 
    tp.har.vagtplan;
  
  
  // Check if any Recruitment items are visible (requires section permission)
  const showRecruitmentMenu = !isMenuHidden('section_rekruttering') && p.canView("menu_section_rekruttering") && 
    (p.canViewRecruitmentDashboard || p.canViewCandidates || p.canViewMessages ||
     p.canViewSmsTemplates || p.canViewEmailTemplates || p.canViewWinback ||
     p.canViewUpcomingInterviews || p.canViewUpcomingHires || p.canViewBookingFlow);
  
  // Check if any Onboarding items are visible (requires section permission) - only show for admin users
  const showOnboardingAdminItems = !isMenuHidden('section_onboarding') && p.canView("menu_section_onboarding") && p.canViewOnboardingAdmin;
  // "Opstartshold" foelger sin egen regel i databasen (can_view_ramp_team)
  const showRampTeam = canViewRampTeam === true;
  const showOnboardingMenu = showOnboardingAdminItems || showRampTeam;

  // "Tryg - Ret salg": kun ejere samt allowlisten (Filip, Annika)
  const showTrygEditSales = trygEditAccess;

  // Check if any Reports menu items are visible (requires section permission)
  // Tryg-ret-salg-adgang (ejer/allowlist) viser sektionen uafhængigt af rollens rapport-sektionsadgang.
  const showReportsMenu = !isMenuHidden('section_rapporter') && (
    (p.canView("menu_section_reports") &&
      (p.canViewReportsAdmin || p.canViewReportsDailyReports || p.canViewReportsManagement || canViewCancellations || p.canViewReportsTdcEditSales)) ||
    showTrygEditSales
  );
  
  // HARDCODED: Only Kasper, Mathias and Lone can see salary menu
  const SALARY_ALLOWED_USER_IDS = [
    'f0fb7ec3-5f00-4fcd-a6ca-2a53669147b9', // Kasper Mikkelsen
    '71267f4e-fd9e-4c16-8fe9-da0f48ce2598', // Mathias Grubak
    'e1ac7b84-aedb-400e-88f6-dd24687317e4', // Lone Mikkelsen
  ];
  const showSalaryMenu = !isMenuHidden('section_lon') && (user?.id ? SALARY_ALLOWED_USER_IDS.includes(user.id) : false);
  
  const isOwner = p.position?.name?.toLowerCase() === "ejer";

  // Check if Admin menu should be visible (KPI or owner for menu editor)
  const showAdminMenu = !isMenuHidden('section_admin') && (p.canViewKpiDefinitions || isOwner);
  
  // Check if AMO menu should be visible
  const showAmoMenu = !isMenuHidden('section_amo') && p.canView("menu_section_amo") && (
    p.canViewAmoDashboard || p.canViewAmoOrganisation || p.canViewAmoMeetings || p.canViewAmoApv
  );
  
  // Check if Spil (Games) menu should be visible
  const showSpilMenu = !isMenuHidden('section_spil') && (p.canViewH2h || p.canViewCommissionLeague);
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
              ["/home", "/messages", "/my-profile", "/my-feedback", "/refer-a-friend", "/vagter", "/registrer-salg", "/spil", "/my-goals"].some(path => location.pathname === path || location.pathname.startsWith(path))
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

              {/* Storkbook (internt: menu_pulsen) */}
              {p.canViewPulsen && (
                <NavLink
                  to="/storkbook"
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname.startsWith("/storkbook") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  <span className="flex items-center gap-3">
                    <StorkbookMark variant="head" size={20} active={location.pathname.startsWith("/storkbook")} />
                    Storkbook
                  </span>
                  <PulsenUnreadBadge />
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
              
              {/* Mine tal - kun for provision-ansatte */}
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
                  Mine tal
                </NavLink>
              )}
              
              {tp.har.mitTeam && (
                <NavLink to="/mit-team" onClick={handleNavClick} className={cn(
                  "flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/mit-team" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <div className="flex items-center gap-3">
                    <Users className="h-4 w-4" />
                    Mit team
                  </div>
                </NavLink>
              )}
              
              {/* Samlesider (bundt b1): Vagter, Registrér salg, Spil */}
              {mitArbejde.harVagter && (
                <NavLink to="/vagter" onClick={handleNavClick} className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/vagter" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <Calendar className="h-4 w-4" />
                  Vagter
                </NavLink>
              )}
              {mitArbejde.harSalg && (
                <NavLink to="/registrer-salg" onClick={handleNavClick} className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/registrer-salg" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <ShoppingCart className="h-4 w-4" />
                  Registrér salg
                </NavLink>
              )}
              {mitArbejde.harSpil && (
                <NavLink to="/spil" onClick={handleNavClick} className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  location.pathname === "/spil" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <div className="flex items-center gap-3">
                    <Trophy className="h-4 w-4" />
                    Spil
                  </div>
                  {pendingH2hCount > 0 && (
                    <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs animate-pulse">
                      {pendingH2hCount > 99 ? "99+" : pendingH2hCount}
                    </Badge>
                  )}
                </NavLink>
              )}

              {/* TDC-værktøjer (samleside, bundt b3) */}
              {sr.har.tdc && (
                <NavLink to="/tdc" onClick={handleNavClick} className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200", location.pathname === "/tdc" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}>
                  <FileText className="h-5 w-5" />
                  TDC-værktøjer
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
                {tp.har.medarbejdere && (
                  <NavLink to="/employees" onClick={handleNavClick} className={cn(
                    "flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/employees" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <div className="flex items-center gap-3">
                      <Users className="h-4 w-4" />
                      Medarbejdere
                    </div>
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
                ["/contracts", "/permissions", "/career-wishes-overview", "/company-overview", "/onboarding-analyse", "/email-templates", "/admin/security", "/car-quiz-admin", "/code-of-conduct-admin", "/pulse-survey-results", "/invoiceflow"].some(path => location.pathname.startsWith(path)) 
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
                {invoiceflowAccess && (
                  <NavLink to="/invoiceflow" onClick={handleNavClick} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/invoiceflow" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <Receipt className="h-4 w-4" />
                    InvoiceFlow
                  </NavLink>
                )}
                {tp.har.kontrakter && (
                  <NavLink to="/contracts" onClick={handleNavClick} className={cn(
                    "flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/contracts" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4" />
                      Kontrakter og karriere
                    </div>
                  </NavLink>
                )}
                
              </CollapsibleContent>
            </Collapsible>
          )}



          {/* Intern Vagtplan menu */}
          {showShiftPlanningMenu && (
            <Collapsible open={shiftPlanningOpen} onOpenChange={setShiftPlanningOpen}>
              <CollapsibleTrigger className={cn(
                "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                (location.pathname.startsWith("/shift-planning") || location.pathname === "/time-stamp") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}>
                <div className="flex items-center gap-3">
                  <ClipboardList className="h-5 w-5" />
                  {t("sidebar.shiftPlan")}
                </div>
                {shiftPlanningOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 space-y-1 mt-1">
                {tp.har.vagtplan && (
                  <NavLink to="/shift-planning" onClick={handleNavClick} className={cn(
                    "flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    location.pathname === "/shift-planning" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}>
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4" />
                      {t("sidebar.shiftPlan")}
                    </div>
                    {pendingAbsenceCount > 0 && (
                      <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">{pendingAbsenceCount}</Badge>
                    )}
                  </NavLink>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Salg og kunder (samlesider, bundt b3) */}
          {!isMenuHidden('section_fieldmarketing') && p.canView("menu_section_fieldmarketing") && sr.har.fieldmarketing && (
            <NavLink to="/vagt-flow" onClick={handleNavClick} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200", location.pathname.startsWith("/vagt-flow") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}>
              <Calendar className="h-5 w-5" />
              {t("sidebar.fieldmarketing")} {(fmBookingConflictsCount + pendingDispatchCount) > 0 && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-bold text-destructive-foreground">
                  {fmBookingConflictsCount + pendingDispatchCount}
                </span>
              )}
            </NavLink>
          )}
          {sr.har.retSalg && (
            <NavLink to="/ret-salg" onClick={handleNavClick} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200", location.pathname === "/ret-salg" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}>
              <PencilLine className="h-5 w-5" />
              Ret salg
            </NavLink>
          )}
          {sr.har.kunder && (
            <NavLink to="/kunder-og-priser" onClick={handleNavClick} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200", location.pathname === "/kunder-og-priser" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}>
              <Percent className="h-5 w-5" />
              {t("sidebar.mgTest")}
            </NavLink>
          )}


          {/* Dashboards menu REMOVED - dashboards are now accessed via EnvironmentSwitcher in a separate environment */}



          {/* Rapporter (samleside, bundt b3) */}
          {!isMenuHidden('section_rapporter') && p.canView("menu_section_reports") && sr.har.rapporter && (
            <NavLink to="/reports/admin" onClick={handleNavClick} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200", location.pathname === "/reports/admin" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}>
              <FileBarChart className="h-5 w-5" />
              Rapporter
            </NavLink>
          )}



          {tp.har.onboarding && (
            <NavLink to="/onboarding-program" onClick={handleNavClick} className={cn(
              "flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              location.pathname === "/onboarding-program" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
            )}>
              <div className="flex items-center gap-3">
                <GraduationCap className="h-5 w-5" />
                Onboarding
              </div>
            </NavLink>
          )}

          {tp.har.rekruttering && (
            <NavLink to="/recruitment" onClick={handleNavClick} className={cn(
              "flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              location.pathname === "/recruitment" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
            )}>
              <div className="flex items-center gap-3">
                <UserPlus className="h-5 w-5" />
                {t("sidebar.recruitment")}
              </div>
              {(pendingReferralsCount > 0 || recruitmentNotificationsCount > 0) && (
                <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs animate-pulse">
                  {(pendingReferralsCount + recruitmentNotificationsCount) > 99 ? "99+" : (pendingReferralsCount + recruitmentNotificationsCount)}
                </Badge>
              )}
            </NavLink>
          )}



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
              </CollapsibleContent>
            </Collapsible>
          )}




          {/* Live-tal */}
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
              Live-tal
            </NavLink>
          )}

          {/* Tavler (bundt b3): kundetavler nås fra vælgeren */}
          {(
            <NavLink to="/dashboards" onClick={handleNavClick} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200", location.pathname === "/dashboards" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}>
              <Monitor className="h-5 w-5" />
              Tavler
            </NavLink>
          )}




          {/* Compliance og AMO / Administration (samlesider, bundt b4) */}
          {ad.har.amo && (
            <NavLink to="/amo" onClick={handleNavClick} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200", location.pathname.startsWith("/amo") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}>
              <Shield className="h-5 w-5" />
              Arbejdsmiljø
            </NavLink>
          )}
          {ad.har.admin && (
            <NavLink to="/admin" onClick={handleNavClick} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200", location.pathname === "/admin" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}>
              <Wrench className="h-5 w-5" />
              Administration
            </NavLink>
          )}
        </nav>
        <div className="border-t border-sidebar-border p-4 space-y-2">

          {ad.har.compliance && (
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
              <span className="flex-1">Compliance</span>
              {p.canView("menu_compliance_admin") && complianceReviewCount > 0 && (
                <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">
                  {complianceReviewCount > 99 ? "99+" : complianceReviewCount}
                </Badge>
              )}
            </NavLink>
          )}
          {/* "Se som" ved siden af kontoknappen — kun synlig for superadmins */}
          <ViewAsSelector />
          <button onClick={() => { handleLogout(); handleNavClick(); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50">
            <LogOut className="h-5 w-5" />
            {t("sidebar.logout")}
          </button>
          <div className="flex items-center justify-between px-3 py-1 text-xs text-sidebar-foreground/70">
            <div className="flex items-center gap-2 min-w-0">
              <User className="h-3 w-3 shrink-0" />
              <span className="truncate">{employeeName || user?.email}</span>
            </div>
            <span className="shrink-0 tabular-nums">{clockTime}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
