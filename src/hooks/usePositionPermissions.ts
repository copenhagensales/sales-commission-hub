import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRolePreview } from "@/contexts/RolePreviewContext";
import { 
  generateAllPermissions as generateAllPermissionsFromConfig,
  type DataScope,
} from "@/config/permissions";

export type { DataScope };

export interface PositionPermissions {
  [key: string]: boolean | { view: boolean; edit: boolean } | DataScope;
}

interface JobPosition {
  id: string;
  name: string;
  permissions: PositionPermissions;
}

// Owner position always has full access
const OWNER_POSITION_NAME = "Ejer";

// Use the shared generateAllPermissions from config
const generateAllPermissions = (): PositionPermissions => 
  generateAllPermissionsFromConfig() as PositionPermissions;

export function usePositionPermissions() {
  const { user, loading: authLoading } = useAuth();

  return useQuery({
    queryKey: ["position-permissions", user?.email],
    queryFn: async (): Promise<{ position: JobPosition | null; permissions: PositionPermissions }> => {
      if (!user?.email) {
        return { position: null, permissions: {} };
      }

      // Get employee's job_title - check both email fields
      // First try private_email
      let employee = null;
      const { data: empByPrivate, error: errPrivate } = await supabase
        .from("employee_master_data")
        .select("job_title")
        .ilike("private_email", user.email)
        .eq("is_active", true)
        .maybeSingle();
      
      if (errPrivate) {
        console.error("usePositionPermissions: Error fetching by private_email", errPrivate);
      }
      
      employee = empByPrivate;
      
      // If not found, try work_email
      if (!employee) {
        const { data: empByWork, error: errWork } = await supabase
          .from("employee_master_data")
          .select("job_title")
          .ilike("work_email", user.email)
          .eq("is_active", true)
          .maybeSingle();
        
        if (errWork) {
          console.error("usePositionPermissions: Error fetching by work_email", errWork);
        }
        
        employee = empByWork;
      }
      
      console.log("usePositionPermissions: employee lookup", { email: user.email, employee });

      if (!employee?.job_title) {
        console.log("usePositionPermissions: No job_title found for user", { email: user.email });
        return { position: null, permissions: {} };
      }

      // Check if owner position - always full permissions
      console.log("usePositionPermissions: Checking owner", { 
        jobTitle: employee.job_title, 
        ownerName: OWNER_POSITION_NAME,
        isOwner: employee.job_title.toLowerCase() === OWNER_POSITION_NAME.toLowerCase()
      });
      
      if (employee.job_title.toLowerCase() === OWNER_POSITION_NAME.toLowerCase()) {
        const allPermissions = generateAllPermissions();
        console.log("usePositionPermissions: Owner detected, returning full permissions", allPermissions);
        return {
          position: { id: "owner", name: OWNER_POSITION_NAME, permissions: allPermissions },
          permissions: allPermissions,
        };
      }

      // Get position permissions from job_positions table
      const { data: position, error: posError } = await supabase
        .from("job_positions")
        .select("id, name, permissions")
        .ilike("name", employee.job_title)
        .maybeSingle();

      if (posError) {
        console.error("Error fetching position:", posError);
        return { position: null, permissions: {} };
      }

      if (!position) {
        return { position: null, permissions: {} };
      }

      const permissions = (position.permissions as PositionPermissions) || {};

      return {
        position: { ...position, permissions },
        permissions,
      };
    },
    enabled: !!user && !authLoading,
    staleTime: 0, // Data is immediately stale
    gcTime: 0, // Don't cache - always fetch fresh
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchOnMount: "always", // Always refetch when component mounts
    refetchOnReconnect: true, // Refetch when network reconnects
    retry: 2,
  });
}

// Helper hook to check specific permission
export function useHasPermission(permissionKey: string, type?: "view" | "edit"): boolean {
  const { data } = usePositionPermissions();
  
  if (!data?.permissions) return false;
  
  const value = data.permissions[permissionKey];
  
  if (type) {
    if (typeof value === "object" && value !== null) {
      return value[type] || false;
    }
    return false;
  }
  
  if (typeof value === "boolean") return value;
  if (typeof value === "object" && value !== null) {
    return value.view || value.edit || false;
  }
  
  return false;
}

// Helper hook to check multiple permissions at once
export function usePermissions() {
  const { data, isLoading, isFetched } = usePositionPermissions();
  const { isPreviewMode, previewPermissions, previewRole } = useRolePreview();
  
  // Consider loading only on initial fetch - once we have data, don't show loading on refetches
  const actuallyLoading = isLoading || (!isFetched && !data);
  
  // Use preview permissions when in preview mode, otherwise use actual permissions
  const permissions = isPreviewMode && previewPermissions 
    ? previewPermissions as PositionPermissions 
    : (data?.permissions || {});
  
  const hasPermission = (key: string, type?: "view" | "edit"): boolean => {
    const value = permissions[key];
    
    if (type) {
      if (typeof value === "object" && value !== null && "view" in value) {
        return value[type] || false;
      }
      return false;
    }
    
    if (typeof value === "boolean") return value;
    if (typeof value === "object" && value !== null && "view" in value) {
      return value.view || value.edit || false;
    }
    
    return false;
  };

  const canView = (key: string): boolean => hasPermission(key, "view") || hasPermission(key);
  const canEdit = (key: string): boolean => hasPermission(key, "edit");

  const getDataScope = (key: string): DataScope => {
    const value = permissions[key];
    if (value === "egen" || value === "team" || value === "alt") {
      return value;
    }
    return "egen"; // Default to own data only
  };

  return {
    isLoading: actuallyLoading,
    isPreviewMode,
    position: isPreviewMode && previewRole ? { id: "preview", name: previewRole, permissions } : data?.position,
    permissions,
    hasPermission,
    canView,
    canEdit,
    getDataScope,
    // Data scope helpers
    scopeEmployees: getDataScope("scope_employees"),
    scopeShifts: getDataScope("scope_shifts"),
    scopeAbsence: getDataScope("scope_absence"),
    scopeTimeTracking: getDataScope("scope_time_tracking"),
    scopeContracts: getDataScope("scope_contracts"),
    scopePayroll: getDataScope("scope_payroll"),
    scopeCareerWishes: getDataScope("scope_career_wishes"),
    scopeSales: getDataScope("scope_sales"),
    scopeQuiz: getDataScope("scope_quiz"),
    scopeExtraWork: getDataScope("scope_extra_work"),
    scopeFieldmarketing: getDataScope("scope_fieldmarketing"),
    // Main menu permissions
    canViewDashboard: hasPermission("menu_dashboard"),
    canViewHomeGoals: canView("menu_home_goals"),
    canEditHomeGoals: canEdit("menu_home_goals"),
    canViewSome: canView("menu_some"),
    canEditSome: canEdit("menu_some"),
    canViewSales: canView("menu_sales"),
    canEditSales: canEdit("menu_sales"),
    canViewLogics: canView("menu_logics"),
    canViewClosingShifts: canView("menu_closing_shifts"),
    // Personnel menu
    canViewEmployees: canView("menu_employees"),
    canEditEmployees: canEdit("menu_employees"),
    canViewTeams: canView("menu_teams"),
    canEditTeams: canEdit("menu_teams"),
    canViewLoginLog: canView("menu_login_log"),
    // Management menu
    canViewContracts: canView("menu_contracts"),
    canEditContracts: canEdit("menu_contracts"),
    canViewPermissions: canView("menu_permissions"),
    canViewCareerWishesOverview: canView("menu_career_wishes_overview"),
    // Test menu
    canViewCarQuizAdmin: canView("menu_car_quiz_admin"),
    canViewCocAdmin: canView("menu_coc_admin"),
    canViewPulseSurvey: canView("menu_pulse_survey"),
    // MG menu
    canViewPayroll: canView("menu_payroll"),
    canEditPayroll: canEdit("menu_payroll"),
    canViewTdcErhverv: canView("menu_tdc_erhverv"),
    canViewCodan: canView("menu_codan"),
    canViewMgTest: canView("menu_mg_test"),
    canEditMgTest: canEdit("menu_mg_test"),
    canViewTestDashboard: canView("menu_test_dashboard"),
    canViewDialerData: canView("menu_dialer_data"),
    canViewCallsData: canView("menu_calls_data"),
    canViewAdversusData: canView("menu_adversus_data"),
    // Shift planning menu
    canViewShiftOverview: canView("menu_shift_overview"),
    canViewMySchedule: hasPermission("menu_my_schedule"),
    canViewAbsence: canView("menu_absence"),
    canViewTimeTracking: canView("menu_time_tracking"),
    canViewExtraWork: canView("menu_extra_work"),
    canViewExtraWorkAdmin: canView("menu_extra_work_admin"),
    // Fieldmarketing menu
    canViewFmOverview: canView("menu_fm_overview"),
    canEditFmOverview: canEdit("menu_fm_overview"),
    canViewFmMyWeek: hasPermission("menu_fm_my_week"),
    canViewFmBookWeek: canView("menu_fm_book_week"),
    canEditFmBookWeek: canEdit("menu_fm_book_week"),
    canViewFmBookings: canView("menu_fm_bookings"),
    canEditFmBookings: canEdit("menu_fm_bookings"),
    canViewFmLocations: canView("menu_fm_locations"),
    canEditFmLocations: canEdit("menu_fm_locations"),
    canViewFmVehicles: canView("menu_fm_vehicles"),
    canEditFmVehicles: canEdit("menu_fm_vehicles"),
    canViewFmBilling: canView("menu_fm_billing"),
    canEditFmBilling: canEdit("menu_fm_billing"),
    canViewFmTimeOff: canView("menu_fm_time_off"),
    canEditFmTimeOff: canEdit("menu_fm_time_off"),
    canViewFmSalesRegistration: canView("menu_fm_sales_registration"),
    canEditFmSalesRegistration: canEdit("menu_fm_sales_registration"),
    // Recruitment menu
    canViewRecruitmentDashboard: canView("menu_recruitment_dashboard"),
    canViewCandidates: canView("menu_candidates"),
    canViewUpcomingInterviews: canView("menu_upcoming_interviews"),
    canViewWinback: canView("menu_winback"),
    canViewUpcomingHires: canView("menu_upcoming_hires"),
    canViewMessages: canView("menu_messages"),
    canViewSmsTemplates: canView("menu_sms_templates"),
    canViewEmailTemplates: canView("menu_email_templates"),
    // Boards menu
    canViewBoardsTest: hasPermission("menu_boards_test"),
    canViewBoardsEconomic: hasPermission("menu_boards_economic"),
    canViewBoardsSales: hasPermission("menu_boards_sales"),
    // Personal menu
    canViewMyProfile: canView("menu_my_profile"),
    canViewMyContracts: hasPermission("menu_my_contracts"),
    canViewCareerWishes: hasPermission("menu_career_wishes"),
    canViewTimeStamp: hasPermission("menu_time_stamp"),
    // System menu
    canViewSettings: canView("menu_settings"),
    canEditSettings: canEdit("menu_settings"),
    // Onboarding menu
    canViewOnboarding: canView("menu_onboarding"),
    canEditOnboarding: canEdit("menu_onboarding"),
    canViewOnboardingLeader: canView("menu_onboarding_leader"),
    canViewOnboardingAdmin: canView("menu_onboarding_admin"),
  };
}
