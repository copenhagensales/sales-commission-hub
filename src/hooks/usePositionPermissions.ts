import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type DataScope = "egen" | "team" | "alt";

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

const generateAllPermissions = (): PositionPermissions => ({
  // Main menu
  menu_dashboard: true,
  menu_wallboard: true,
  menu_some: { view: true, edit: true },
  menu_sales: { view: true, edit: true },
  menu_logics: { view: true, edit: true },
  menu_closing_shifts: { view: true, edit: true },
  // Personnel menu
  menu_employees: { view: true, edit: true },
  menu_teams: { view: true, edit: true },
  // Employees tabs
  tab_employees_all: { view: true, edit: true },
  tab_employees_dialer_mapping: { view: true, edit: true },
  tab_employees_teams: { view: true, edit: true },
  tab_employees_positions: { view: true, edit: true },
  // Management menu
  menu_contracts: { view: true, edit: true },
  menu_permissions: { view: true, edit: true },
  menu_career_wishes_overview: { view: true, edit: true },
  // Contracts tabs
  tab_contracts_all: { view: true, edit: true },
  tab_contracts_templates: { view: true, edit: true },
  // Test menu
  menu_car_quiz_admin: { view: true, edit: true },
  menu_coc_admin: { view: true, edit: true },
  menu_pulse_survey: { view: true, edit: true },
  // Car Quiz tabs
  tab_car_quiz_questions: { view: true, edit: true },
  tab_car_quiz_submissions: { view: true, edit: true },
  // CoC tabs
  tab_coc_questions: { view: true, edit: true },
  tab_coc_submissions: { view: true, edit: true },
  // Pulse Survey tabs
  tab_pulse_results: { view: true, edit: true },
  tab_pulse_template: { view: true, edit: true },
  tab_pulse_teams: { view: true, edit: true },
  // MG menu
  menu_payroll: { view: true, edit: true },
  menu_tdc_erhverv: { view: true, edit: true },
  menu_codan: { view: true, edit: true },
  menu_mg_test: { view: true, edit: true },
  menu_test_dashboard: { view: true, edit: true },
  menu_dialer_data: { view: true, edit: true },
  menu_calls_data: { view: true, edit: true },
  menu_adversus_data: { view: true, edit: true },
  // MG Test tabs
  tab_mg_products: { view: true, edit: true },
  tab_mg_campaigns: { view: true, edit: true },
  tab_mg_customers: { view: true, edit: true },
  // Shift planning menu
  menu_shift_overview: { view: true, edit: true },
  menu_my_schedule: true,
  menu_absence: { view: true, edit: true },
  menu_time_tracking: { view: true, edit: true },
  menu_extra_work: { view: true, edit: true },
  menu_extra_work_admin: { view: true, edit: true },
  // Fieldmarketing menu
  menu_fm_overview: { view: true, edit: true },
  menu_fm_my_week: true,
  menu_fm_book_week: { view: true, edit: true },
  menu_fm_bookings: { view: true, edit: true },
  menu_fm_locations: { view: true, edit: true },
  menu_fm_vehicles: { view: true, edit: true },
  menu_fm_billing: { view: true, edit: true },
  menu_fm_time_off: { view: true, edit: true },
  // Recruitment menu
  menu_recruitment_dashboard: { view: true, edit: true },
  menu_candidates: { view: true, edit: true },
  menu_upcoming_interviews: { view: true, edit: true },
  menu_winback: { view: true, edit: true },
  menu_upcoming_hires: { view: true, edit: true },
  menu_messages: { view: true, edit: true },
  menu_sms_templates: { view: true, edit: true },
  menu_email_templates: { view: true, edit: true },
  // Boards menu
  menu_boards_test: true,
  menu_boards_economic: true,
  menu_boards_sales: true,
  // Personal menu
  menu_my_profile: { view: true, edit: true },
  menu_my_contracts: true,
  menu_career_wishes: true,
  menu_time_stamp: true,
  // System menu
  menu_settings: { view: true, edit: true },
  // Settings tabs
  tab_settings_api: { view: true, edit: true },
  tab_settings_dialer: { view: true, edit: true },
  tab_settings_customer: { view: true, edit: true },
  tab_settings_webhooks: { view: true, edit: true },
  tab_settings_logs: { view: true, edit: true },
  tab_settings_excel_crm: { view: true, edit: true },
  // Data scope permissions - owner sees all
  scope_employees: "alt" as DataScope,
  scope_shifts: "alt" as DataScope,
  scope_absence: "alt" as DataScope,
  scope_time_tracking: "alt" as DataScope,
  scope_contracts: "alt" as DataScope,
  scope_payroll: "alt" as DataScope,
  scope_career_wishes: "alt" as DataScope,
});

export function usePositionPermissions() {
  const { user, loading: authLoading } = useAuth();

  return useQuery({
    queryKey: ["position-permissions", user?.email],
    queryFn: async (): Promise<{ position: JobPosition | null; permissions: PositionPermissions }> => {
      if (!user?.email) {
        return { position: null, permissions: {} };
      }

      // Get employee's job_title
      const { data: employee, error: empError } = await supabase
        .from("employee_master_data")
        .select("job_title")
        .or(`private_email.eq.${user.email},work_email.eq.${user.email}`)
        .eq("is_active", true)
        .maybeSingle();

      if (empError) {
        console.error("Error fetching employee:", empError);
        return { position: null, permissions: {} };
      }

      if (!employee?.job_title) {
        return { position: null, permissions: {} };
      }

      // Check if owner position - always full permissions
      if (employee.job_title.toLowerCase() === OWNER_POSITION_NAME.toLowerCase()) {
        return {
          position: { id: "owner", name: OWNER_POSITION_NAME, permissions: generateAllPermissions() },
          permissions: generateAllPermissions(),
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
    staleTime: 1000 * 60, // Cache for 1 minute
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
  const { data, isLoading } = usePositionPermissions();
  const permissions = data?.permissions || {};
  
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
    isLoading,
    position: data?.position,
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
    // Main menu permissions
    canViewDashboard: hasPermission("menu_dashboard"),
    canViewWallboard: hasPermission("menu_wallboard"),
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
    canViewFmMyWeek: hasPermission("menu_fm_my_week"),
    canViewFmBookWeek: canView("menu_fm_book_week"),
    canViewFmBookings: canView("menu_fm_bookings"),
    canViewFmLocations: canView("menu_fm_locations"),
    canViewFmVehicles: canView("menu_fm_vehicles"),
    canViewFmBilling: canView("menu_fm_billing"),
    canViewFmTimeOff: canView("menu_fm_time_off"),
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
  };
}
