import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRolePreview } from "@/contexts/RolePreviewContext";
import { 
  generateAllPermissions as generateAllPermissionsFromConfig,
  OWNER_EXCLUDED_PERMISSIONS,
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

// Owner position always has full access (except excluded permissions like softphone)
const OWNER_POSITION_NAME = "Ejer";

// Owners excluded from salary access (still get all other permissions)
const SALARY_EXCLUDED_OWNER_IDS = [
  '9ad9b492-8c14-4d0f-96aa-1e867823fe91', // William Hoé Seiding
];

// Permission keys related to salary
const SALARY_PERMISSION_KEYS = [
  'menu_section_salary',
  'menu_payroll',
  'menu_salary_types',
  'scope_payroll',
];

// Permission keys excluded from owner (same as OWNER_EXCLUDED_PERMISSIONS in config)
const OWNER_EXCLUDED_PERMISSION_KEYS = [
  'softphone_outbound',
  'softphone_inbound',
  'employee_sms',
];

// Use the shared generateAllPermissions from config
// For owner, exclude softphone permissions
const generateAllPermissions = (): PositionPermissions => 
  generateAllPermissionsFromConfig() as PositionPermissions;

const generateOwnerPermissions = (): PositionPermissions => 
  generateAllPermissionsFromConfig(OWNER_EXCLUDED_PERMISSIONS) as PositionPermissions;

// Map job_title to system role key for permission lookup
function mapJobTitleToRoleKey(jobTitle: string | null | undefined): string {
  if (!jobTitle) return 'medarbejder';
  const lower = jobTitle.toLowerCase().trim();
  
  // Owner - full access
  if (lower === 'ejer') return 'ejer';
  
  // Fieldmarketing roles (check before generic teamleder)
  if (lower === 'fieldmarketing leder') return 'fm_leder';
  if (lower === 'fieldmarketing' || lower === 'fm medarbejder') return 'fm_medarbejder_';
  
  // Assisterende Teamleder FM - specific role with limited dashboard access
  if (lower === 'assisterende teamleder fm') return 'assisterende_teamleder_fm';
  
  // Assisterende Teamleder (generic) - maps to teamleder
  if (lower === 'assisterende teamleder') return 'teamleder';
  
  // Team leader roles (generic catch-all)
  if (lower.includes('teamleder')) return 'teamleder';
  
  // Specialized roles
  if (lower === 'rekruttering') return 'rekruttering';
  if (lower === 'some') return 'some';
  
  // Default
  return 'medarbejder';
}

// Map visibility values from database to DataScope format
function mapVisibilityToScope(visibility: string): DataScope {
  switch (visibility) {
    case 'all': return 'alt';
    case 'team': return 'team';
    case 'self': return 'egen';
    default: return 'egen';
  }
}

// Map permission keys to their corresponding scope keys
// This connects role_page_permissions.visibility to the old scope_* system
const PERMISSION_SCOPE_MAP: Record<string, string> = {
  'menu_employees': 'scope_employees',
  'menu_absence': 'scope_absence',
  'menu_shift_overview': 'scope_shifts',
  'menu_time_tracking': 'scope_time_tracking',
  'menu_contracts': 'scope_contracts',
  'menu_payroll': 'scope_payroll',
  'menu_career_wishes_overview': 'scope_career_wishes',
  'menu_fm_overview': 'scope_fieldmarketing',
  'menu_extra_work': 'scope_extra_work',
  'menu_some': 'scope_some',
  'menu_sales': 'scope_sales',
  'menu_car_quiz_admin': 'scope_quiz',
  'menu_reports_daily': 'scope_reports_daily',
};

// localStorage cache key for permissions
const PERMISSIONS_CACHE_KEY = 'cached-permissions-v5';
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// Force-clear old cache versions on load
try {
  localStorage.removeItem('cached-permissions-v1');
  localStorage.removeItem('cached-permissions-v2');
  localStorage.removeItem('cached-permissions-v3');
  localStorage.removeItem('cached-permissions-v4');
} catch (e) {
  // Ignore errors
}

function getCachedPermissions(): { position: JobPosition | null; permissions: PositionPermissions; roleKey: string } | null {
  try {
    const cached = localStorage.getItem(PERMISSIONS_CACHE_KEY);
    if (!cached) return null;
    
    const { timestamp, data } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_MAX_AGE_MS) {
      localStorage.removeItem(PERMISSIONS_CACHE_KEY);
      return null;
    }
    console.log('usePositionPermissions: Using cached permissions (database fallback)');
    return data;
  } catch (e) {
    console.warn('usePositionPermissions: Failed to parse cached permissions', e);
    return null;
  }
}

function setCachedPermissions(data: { position: JobPosition | null; permissions: PositionPermissions; roleKey: string }) {
  try {
    localStorage.setItem(PERMISSIONS_CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      data
    }));
  } catch (e) {
    console.warn('usePositionPermissions: Failed to cache permissions', e);
  }
}

export function usePositionPermissions() {
  const { user, loading: authLoading } = useAuth();

  return useQuery({
    queryKey: ["position-permissions", user?.id, user?.email],
    queryFn: async (): Promise<{ position: JobPosition | null; permissions: PositionPermissions; roleKey: string }> => {
      if (!user?.id && !user?.email) {
        return { position: null, permissions: {}, roleKey: 'medarbejder' };
      }

      try {
        // STRATEGY: Try auth_user_id first (fast, reliable), fallback to email
        let employee = null;
        let lookupMethod = '';
        
        // 1. Try auth_user_id lookup first (most reliable)
        if (user?.id) {
          const { data: empById, error: errById } = await supabase
            .from("employee_master_data")
            .select("job_title, auth_user_id, position_id")
            .eq("auth_user_id", user.id)
            .eq("is_active", true)
            .maybeSingle();
          
          if (errById) {
            console.error("usePositionPermissions: Database error fetching by auth_user_id", errById);
            throw new Error(`Database fejl: ${errById.message}`);
          }
          
          if (empById) {
            employee = empById;
            lookupMethod = 'auth_user_id';
          }
        }
        
        // 2. Fallback to email lookup (for backwards compatibility)
        if (!employee && user?.email) {
          // Try private_email
          const { data: empByPrivate, error: errPrivate } = await supabase
            .from("employee_master_data")
            .select("job_title, auth_user_id, position_id")
            .ilike("private_email", user.email)
            .eq("is_active", true)
            .maybeSingle();
          
          if (errPrivate) {
            console.error("usePositionPermissions: Database error fetching by private_email", errPrivate);
            throw new Error(`Database fejl: ${errPrivate.message}`);
          }
          
          if (empByPrivate) {
            employee = empByPrivate;
            lookupMethod = 'private_email';
          } else {
            // Try work_email
            const { data: empByWork, error: errWork } = await supabase
              .from("employee_master_data")
              .select("job_title, auth_user_id, position_id")
              .ilike("work_email", user.email)
              .eq("is_active", true)
              .maybeSingle();
            
            if (errWork) {
              console.error("usePositionPermissions: Database error fetching by work_email", errWork);
              throw new Error(`Database fejl: ${errWork.message}`);
            }
            
            if (empByWork) {
              employee = empByWork;
              lookupMethod = 'work_email';
            }
          }
        }
        
        console.log("usePositionPermissions: employee lookup", { 
          userId: user?.id, 
          email: user?.email, 
          employee,
          lookupMethod 
        });

        if (!employee?.job_title) {
          console.log("usePositionPermissions: No job_title found for user");
          return { position: null, permissions: {}, roleKey: 'medarbejder' };
        }

        // Determine roleKey: prefer system_role_key from job_positions via position_id
        let roleKey = mapJobTitleToRoleKey(employee.job_title); // fallback
        
        if (employee.position_id) {
          const { data: posData } = await supabase
            .from("job_positions")
            .select("system_role_key")
            .eq("id", employee.position_id)
            .maybeSingle();
          
          if (posData?.system_role_key) {
            roleKey = posData.system_role_key;
            console.log("usePositionPermissions: Using system_role_key from job_positions", {
              position_id: employee.position_id,
              system_role_key: posData.system_role_key,
            });
          }
        }
        
        console.log("usePositionPermissions: Resolved role", { 
          jobTitle: employee.job_title, 
          roleKey,
          position_id: employee.position_id,
        });

        // Check if owner position - always full permissions
        if (roleKey === 'ejer') {
          const ownerPermissions = generateOwnerPermissions();
          console.log("usePositionPermissions: Owner detected, returning full permissions");
          const result = {
            position: { 
              id: "owner", 
              name: OWNER_POSITION_NAME, 
              permissions: ownerPermissions,
            },
            permissions: ownerPermissions,
            roleKey: 'ejer',
          };
          setCachedPermissions(result);
          return result;
        }

        // CONSOLIDATED: Fetch permissions from role_page_permissions table (new system)
        // INCLUDING visibility for data scope
        const { data: rolePermissions, error: rolePermError } = await supabase
          .from("role_page_permissions")
          .select("permission_key, can_view, can_edit, visibility")
          .eq("role_key", roleKey);

        if (rolePermError) {
          console.error("usePositionPermissions: Error fetching role permissions", rolePermError);
          // Fallback to old system if new table has issues
          console.log("usePositionPermissions: Falling back to job_positions lookup");
        }

        // Convert role_page_permissions to PositionPermissions format
        const permissions: PositionPermissions = {};
        if (rolePermissions && rolePermissions.length > 0) {
          rolePermissions.forEach(rp => {
            permissions[rp.permission_key] = { 
              view: rp.can_view ?? false, 
              edit: rp.can_edit ?? false 
            };
            
            // Map visibility to scope key for data access control
            // Converts 'all'/'team'/'self' to 'alt'/'team'/'egen'
            const scopeKey = PERMISSION_SCOPE_MAP[rp.permission_key];
            if (scopeKey && rp.visibility) {
              permissions[scopeKey] = mapVisibilityToScope(rp.visibility);
            }
          });
          console.log("usePositionPermissions: Using role_page_permissions with visibility", { 
            roleKey, 
            permCount: rolePermissions.length 
          });
        } else {
          // Fallback: try old job_positions table
          const { data: position, error: posError } = await supabase
            .from("job_positions")
            .select("id, name, permissions")
            .ilike("name", employee.job_title)
            .maybeSingle();

          if (posError) {
            console.error("usePositionPermissions: Database error fetching position", posError);
            throw new Error(`Database fejl: ${posError.message}`);
          }

          if (position) {
            const legacyPerms = (position.permissions as PositionPermissions) || {};
            console.log("usePositionPermissions: Using legacy job_positions.permissions", { 
              position: position.name,
              permCount: Object.keys(legacyPerms).length 
            });
            
            const result = {
              position: { 
                ...position, 
                permissions: legacyPerms,
              },
              permissions: legacyPerms,
              roleKey,
            };
            setCachedPermissions(result);
            return result;
          }
        }

        const result = {
          position: { 
            id: roleKey, 
            name: employee.job_title, 
            permissions,
          },
          permissions,
          roleKey,
        };
        setCachedPermissions(result);
        return result;
      } catch (error) {
        console.error("usePositionPermissions: Query failed, checking cache", error);
        // On any error, try to use cached permissions
        const cached = getCachedPermissions();
        if (cached) {
          return cached;
        }
        // If no cache, re-throw the error
        throw error;
      }
    },
    enabled: !!user && !authLoading,
    staleTime: 15 * 60 * 1000, // 15 minutes - permissions rarely change during session
    gcTime: 30 * 60 * 1000, // 30 minutes cache
    refetchOnWindowFocus: false, // Don't refetch on window focus - too expensive
    refetchOnMount: 'always', // Only refetch if stale
    refetchOnReconnect: false, // Don't refetch on reconnect - keep cached value
    retry: 2, // Reduced from 3 - faster feedback on persistent failures
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000), // Max 3s delay (was 5s)
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
  const { user } = useAuth();
  const { data, isLoading, isFetched, isError, error, isFetching, isPending } = usePositionPermissions();
  const { isPreviewMode, previewPermissions, previewRole } = useRolePreview();
  
  // Consider loading only on initial fetch - once we have data, don't show loading on refetches
  // Include isPending to properly catch initial query states
  const actuallyLoading = isLoading || isPending || (!isFetched && !data);
  
  // isReady = true ONLY when permissions are fully fetched and available
  // This prevents premature redirects during browser refresh
  const isReady = isFetched && !isLoading && !isPending && !!data;
  
  // isRetrying = actively fetching but no valid position data yet
  // This prevents false "deactivated" messages during database retry attempts
  const isRetrying = isFetching && !data?.position;
  
  // Check if current user is an owner
  const isOwner = data?.roleKey === 'ejer';
  
  // Check if this owner is excluded from salary access
  const isOwnerExcludedFromSalary = isOwner && 
    user?.id && 
    SALARY_EXCLUDED_OWNER_IDS.includes(user.id);
  
  // Use preview permissions when in preview mode, otherwise use actual permissions
  const permissions = isPreviewMode && previewPermissions 
    ? previewPermissions as PositionPermissions 
    : (data?.permissions || {});
  
  const hasPermission = (key: string, type?: "view" | "edit"): boolean => {
    // Owner override: full access EXCEPT salary for excluded owners
    if (isOwner && !isPreviewMode) {
      if (isOwnerExcludedFromSalary && SALARY_PERMISSION_KEYS.includes(key)) {
        return false; // Deny salary access for this owner
      }
      // Deny softphone permissions for owners
      if (OWNER_EXCLUDED_PERMISSION_KEYS.includes(key)) {
        return false;
      }
      return true; // All other permissions granted
    }
    
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

  const canView = (key: string): boolean => {
    // Owner override: full access EXCEPT salary for excluded owners
    if (isOwner && !isPreviewMode) {
      if (isOwnerExcludedFromSalary && SALARY_PERMISSION_KEYS.includes(key)) {
        return false;
      }
      if (OWNER_EXCLUDED_PERMISSION_KEYS.includes(key)) {
        return false;
      }
      return true;
    }
    return hasPermission(key, "view") || hasPermission(key);
  };
  
  const canEdit = (key: string): boolean => {
    // Owner override: full access EXCEPT salary for excluded owners
    if (isOwner && !isPreviewMode) {
      if (isOwnerExcludedFromSalary && SALARY_PERMISSION_KEYS.includes(key)) {
        return false;
      }
      if (OWNER_EXCLUDED_PERMISSION_KEYS.includes(key)) {
        return false;
      }
      return true;
    }
    return hasPermission(key, "edit");
  };

  const getDataScope = (key: string): DataScope => {
    // Owner override: full scope EXCEPT salary for excluded owners
    if (isOwner && !isPreviewMode) {
      if (isOwnerExcludedFromSalary && key === 'scope_payroll') {
        return "egen"; // Restrict salary data scope
      }
      return "alt"; // Full scope for everything else
    }
    
    const value = permissions[key];
    if (value === "egen" || value === "team" || value === "alt") {
      return value;
    }
    return "egen"; // Default to own data only
  };

  const positionData = isPreviewMode && previewRole 
    ? { id: "preview", name: previewRole, permissions } 
    : data?.position;

  return {
    isLoading: actuallyLoading,
    isReady, // True ONLY when permissions are fully loaded - use for route guards
    isRetrying, // True during database retries - prevents false "deactivated" messages
    isError,
    error,
    isPreviewMode,
    isOwner, // True if current user has 'ejer' role - for owner-only features
    position: positionData,
    permissions,
    hasPermission,
    canView,
    canEdit,
    getDataScope,
    // Data scope helpers (legacy - from JSONB permissions)
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
    scopeReportsDaily: getDataScope("scope_reports_daily"),
    // Main menu permissions
    canViewDashboard: hasPermission("menu_dashboard"),
    canViewHomeGoals: canView("menu_home_goals"),
    canEditHomeGoals: canEdit("menu_home_goals"),
    canViewSome: canView("menu_some"),
    canEditSome: canEdit("menu_some"),
    canViewSales: canView("menu_sales"),
    canEditSales: canEdit("menu_sales"),
    canViewLogics: canView("menu_logics"),
    canViewLiveStats: canView("menu_live_stats"),
    canViewClosingShifts: canView("menu_closing_shifts"),
    // Personnel menu
    canViewEmployees: canView("menu_employees"),
    canEditEmployees: canEdit("menu_employees"),
    canViewTeams: canView("menu_teams"),
    canEditTeams: canEdit("menu_teams"),
    canViewLoginLog: canView("menu_login_log"),
    canViewUpcomingStarts: canView("menu_upcoming_starts"),
    canEditUpcomingStarts: canEdit("menu_upcoming_starts"),
    // Management menu
    canViewContracts: canView("menu_contracts"),
    canEditContracts: canEdit("menu_contracts"),
    canViewPermissions: canView("menu_permissions"),
    canViewCareerWishesOverview: canView("menu_career_wishes_overview"),
    canViewSecurityDashboard: canView("menu_security_dashboard"),
    // Test menu
    canViewCarQuizAdmin: canView("menu_car_quiz_admin"),
    canViewCocAdmin: canView("menu_coc_admin"),
    canViewPulseSurvey: canView("menu_pulse_survey"),
    // MG menu
    canViewPayroll: canView("menu_payroll"),
    canEditPayroll: canEdit("menu_payroll"),
    // Salary menu
    canViewSalaryTypes: canView("menu_salary_types"),
    canEditSalaryTypes: canEdit("menu_salary_types"),
    canViewTdcErhverv: canView("menu_tdc_erhverv"),
    canViewTdcOpsummering: canView("menu_tdc_opsummering"),
    canViewCodan: canView("menu_codan"),
    canViewMgTest: canView("menu_mg_test"),
    canEditMgTest: canEdit("menu_mg_test"),
    canViewTestDashboard: canView("menu_test_dashboard"),
    canViewDialerData: canView("menu_dialer_data"),
    canViewCallsData: canView("menu_calls_data"),
    canViewAdversusData: canView("menu_adversus_data"),
    // Shift planning menu
    canViewShiftOverview: canView("menu_shift_overview"),
    canEditShiftOverview: canEdit("menu_shift_overview"),
    canViewMySchedule: hasPermission("menu_my_schedule"),
    canViewAbsence: canView("menu_absence"),
    canEditAbsence: canEdit("menu_absence"),
    canViewTimeTracking: canView("menu_time_tracking"),
    canEditTimeTracking: canEdit("menu_time_tracking"),
    canViewExtraWork: canView("menu_extra_work"),
    canViewExtraWorkAdmin: canView("menu_extra_work_admin"),
    // Fieldmarketing menu
    canViewFmMySchedule: canView("menu_fm_my_schedule"),
    canViewFmOverview: canView("menu_fm_overview"),
    canEditFmOverview: canEdit("menu_fm_overview"),
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
    canViewFmEditSales: canView("menu_fm_edit_sales"),
    canEditFmEditSales: canEdit("menu_fm_edit_sales"),
    canViewFmTravelExpenses: canView("menu_fm_travel_expenses"),
    // Recruitment menu
    canViewRecruitmentDashboard: canView("menu_recruitment_dashboard"),
    canViewCandidates: canView("menu_candidates"),
    canViewUpcomingInterviews: canView("menu_upcoming_interviews"),
    canViewWinback: canView("menu_winback"),
    canViewUpcomingHires: canView("menu_upcoming_hires"),
    canViewMessages: canView("menu_messages"),
    canViewSmsTemplates: canView("menu_sms_templates"),
    canViewEmailTemplates: canView("menu_email_templates"),
    canViewReferrals: canView("menu_referrals"),
    canEditReferrals: canEdit("menu_referrals"),
    // Boards menu
    canViewBoardsSales: hasPermission("menu_boards_sales"),
    // Dashboards menu - only general environment access
    // Individual dashboard access is managed via team_dashboard_permissions
    canViewDashboards: canView("menu_dashboards"),
    // Personal menu (Mit Hjem)
    canViewHome: hasPermission("menu_home"),
    canViewH2h: hasPermission("menu_h2h"),
    canViewCommissionLeague: hasPermission("menu_commission_league"),
    canViewMyProfile: canView("menu_my_profile"),
    canViewMyGoals: hasPermission("menu_my_goals"),
    canViewTeamGoals: hasPermission("menu_team_goals"),
    canViewMyContracts: hasPermission("menu_my_contracts"),
    canViewCareerWishes: hasPermission("menu_career_wishes"),
    canViewMyFeedback: hasPermission("menu_my_feedback"),
    canViewReferAFriend: hasPermission("menu_refer_a_friend"),
    canViewImmediatePaymentAse: canView("menu_immediate_payment_ase"),
    canViewTimeStamp: hasPermission("menu_time_stamp"),
    // System menu
    canViewSettings: canView("menu_settings"),
    canEditSettings: canEdit("menu_settings"),
    // Onboarding menu
    canViewOnboarding: canView("menu_onboarding"),
    canEditOnboarding: canEdit("menu_onboarding"),
    canViewOnboardingLeader: canView("menu_onboarding_leader"),
    canViewOnboardingAdmin: canView("menu_onboarding_admin"),
    // Reports menu
    canViewReportsAdmin: canView("menu_reports_admin"),
    canViewReportsDailyReports: canView("menu_reports_daily"),
    canViewReportsManagement: canView("menu_reports_management"),
    canViewReportsEmployee: canView("menu_reports_employee"),
    // Employee SMS permission
    canSendEmployeeSms: canView("employee_sms"),
    // League admin
    canViewLeagueAdmin: canView("menu_league_admin"),
    // Admin menu
    canViewKpiDefinitions: canView("menu_kpi_definitions"),
    canEditKpiDefinitions: canEdit("menu_kpi_definitions"),
    // Cancellations
    canViewCancellations: canView("menu_cancellations"),
    canEditCancellations: canEdit("menu_cancellations"),
    // Personal messages (distinct from recruitment messages)
    canViewMessagesPersonal: canView("menu_messages_personal"),
    // Economic individual items
    canViewEconomicDashboard: canView("menu_economic_dashboard"),
    canViewEconomicExpenses: canView("menu_economic_expenses"),
    canViewEconomicBudget: canView("menu_economic_budget"),
    canViewEconomicMapping: canView("menu_economic_mapping"),
    canViewEconomicUpload: canView("menu_economic_upload"),
    
    // AMO permissions
    canViewAmoDashboard: canView("menu_amo_dashboard"),
    canViewAmoOrganisation: canView("menu_amo_organisation"),
    canViewAmoAnnualDiscussion: canView("menu_amo_annual_discussion"),
    canViewAmoMeetings: canView("menu_amo_meetings"),
    canViewAmoApv: canView("menu_amo_apv"),
    canViewAmoKemiApv: canView("menu_amo_kemi_apv"),
    canViewAmoTraining: canView("menu_amo_training"),
    canViewAmoDocuments: canView("menu_amo_documents"),
    canViewAmoTasks: canView("menu_amo_tasks"),
    canViewAmoSettings: canView("menu_amo_settings"),
    canViewAmoAuditLog: canView("menu_amo_audit_log"),
    // Client Forecast
    canViewClientForecast: canView("menu_client_forecast"),
  };
}
