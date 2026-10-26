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
import { StrukturMenu } from "./StrukturMenu";
import { findSide, MIT_ARBEJDE } from "@/config/struktur";
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
  const { data: isUnitedMember } = useIsUnitedMember();
  
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
  const tal = (n: number) => n > 0 ? (
    <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1.5 text-xs">{n > 99 ? "99+" : n}</Badge>
  ) : null;
  const badges: Record<string, React.ReactNode> = {
    side_storkbook: <PulsenUnreadBadge />,
    side_spil: tal(pendingH2hCount),
    side_min_profil: tal(pendingContractsCount),
    side_vagtplan: tal(pendingAbsenceCount),
    side_fieldmarketing: tal((fmBookingConflictsCount ?? 0) + pendingDispatchCount),
    side_rekruttering: tal(pendingReferralsCount + recruitmentNotificationsCount),
    side_compliance: p.canView("menu_compliance_admin") ? tal(complianceReviewCount ?? 0) : null,
  };
  const profilSide = findSide("side_min_profil");
  // Telefonens Menu-skuffe: Mit arbejde ligger i bundbjælken/Mig; Min profil står øverst.
  const mobilTop = isMobile && p.canViewMyProfile && profilSide ? [profilSide] : [];

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
          <StrukturMenu badges={badges} onNavigate={() => handleNavClick()} udelad={isMobile ? [MIT_ARBEJDE] : []} top={mobilTop} />
        </nav>
        <div className="border-t border-sidebar-border p-4 space-y-2">

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
