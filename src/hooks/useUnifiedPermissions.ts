import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// Types
export type SystemRole = 'ejer' | 'teamleder' | 'rekruttering' | 'medarbejder' | 'some';
export type Visibility = 'all' | 'team' | 'self' | 'none';

export interface RoleDefinition {
  id: string;
  key: string;
  label: string;
  description: string | null;
  detailed_description: string | null;
  color: string | null;
  icon: string | null;
  priority: number | null;
}

export type PermissionType = 'page' | 'tab' | 'action';

export interface PagePermission {
  id: string;
  role_key: string;
  permission_key: string;
  parent_key: string | null;
  permission_type: PermissionType;
  can_view: boolean;
  can_edit: boolean;
  description: string | null;
  visibility: 'all' | 'team' | 'self' | null;
}


// Fetch all role definitions
// OPTIMIZED: Extended staleTime to 15 minutes - role definitions rarely change
export function useRoleDefinitions() {
  return useQuery({
    queryKey: ['role-definitions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_role_definitions')
        .select('*')
        .order('priority', { ascending: false });
      
      if (error) throw error;
      return data as RoleDefinition[];
    },
    staleTime: 15 * 60 * 1000, // 15 minutes - rarely changes
    gcTime: 30 * 60 * 1000, // 30 minutes garbage collection
  });
}

// Fetch all page permissions
// OPTIMIZED: Extended staleTime to 15 minutes - permissions rarely change during session
export function usePagePermissions() {
  return useQuery({
    queryKey: ['page-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_page_permissions')
        .select('*')
        .order('permission_key');
      
      if (error) throw error;
      return data as PagePermission[];
    },
    staleTime: 15 * 60 * 1000, // 15 minutes - rarely changes during session
    gcTime: 30 * 60 * 1000, // 30 minutes garbage collection
  });
}


// Get current user's role from employee data
// OPTIMIZED: Extended staleTime to 15 minutes - user role doesn't change during session
function useCurrentUserRole() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['current-user-role', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      // First check system_roles table
      const { data: systemRole } = await supabase
        .from('system_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (systemRole?.role) {
        return systemRole.role as SystemRole;
      }
      
      // Fallback: map job_title to role
      const { data: employee } = await supabase
        .from('employee_master_data')
        .select('job_title')
        .eq('auth_user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      
      if (employee?.job_title) {
        const titleLower = employee.job_title.toLowerCase();
        if (titleLower === 'ejer') return 'ejer';
        if (titleLower === 'fieldmarketing leder') return 'fm_leder';
        if (titleLower.includes('teamleder')) return 'teamleder';
        if (titleLower === 'rekruttering') return 'rekruttering';
        if (titleLower === 'some') return 'some';
        if (titleLower === 'fieldmarketing') return 'fm_medarbejder_';
      }
      
      return 'medarbejder' as SystemRole;
    },
    enabled: !!user?.id,
    staleTime: 15 * 60 * 1000, // 15 minutes - role doesn't change during session
    gcTime: 30 * 60 * 1000, // 30 minutes garbage collection
  });
}

// Main unified permissions hook
export function useUnifiedPermissions() {
  const { user } = useAuth();
  const { data: currentRole, isLoading: roleLoading } = useCurrentUserRole();
  const { data: pagePermissions, isLoading: permissionsLoading } = usePagePermissions();
  
  const isLoading = roleLoading || permissionsLoading;
  const role = currentRole || 'medarbejder';
  
  // Role helper booleans
  const isOwner = role === 'ejer';
  const isTeamleder = role === 'teamleder';
  const isRekruttering = role === 'rekruttering';
  const isSome = role === 'some';
  const isMedarbejder = role === 'medarbejder';
  
  // Get page permission for current role
  const canView = (permissionKey: string): boolean => {
    if (isOwner) return true; // Owners can view everything
    const permission = pagePermissions?.find(
      p => p.role_key === role && p.permission_key === permissionKey
    );
    return permission?.can_view ?? false;
  };
  
  const canEdit = (permissionKey: string): boolean => {
    if (isOwner) return true; // Owners can edit everything
    const permission = pagePermissions?.find(
      p => p.role_key === role && p.permission_key === permissionKey
    );
    return permission?.can_edit ?? false;
  };
  
  // Get data visibility scope for current role and permission
  const getDataScope = (permissionKey: string): Visibility => {
    if (isOwner) return 'all'; // Owners see everything
    
    const permission = pagePermissions?.find(
      p => p.role_key === role && p.permission_key === permissionKey
    );
    return (permission?.visibility as Visibility) ?? 'self';
  };
  
  // Check if user can see data for a specific target
  const canSeeData = (
    permissionKey: string, 
    targetEmployeeId?: string, 
    currentEmployeeId?: string,
    isInUserTeam?: boolean
  ): boolean => {
    const visibility = getDataScope(permissionKey);
    
    switch (visibility) {
      case 'all':
        return true;
      case 'team':
        return isInUserTeam ?? false;
      case 'self':
        return targetEmployeeId === currentEmployeeId;
      case 'none':
      default:
        return false;
    }
  };
  
  return {
    // Loading state
    isLoading,
    isAuthenticated: !!user,
    
    // Current user's role
    role,
    isOwner,
    isTeamleder,
    isRekruttering,
    isSome,
    isMedarbejder,
    
    // Page access helpers
    canView,
    canEdit,
    
    // Data visibility helpers
    getDataScope,
    canSeeData,
    
    // Raw data for UI display
    pagePermissions,
  };
}

// Helper labels for UI
export const permissionKeyLabels: Record<string, string> = {
  // ===== SEKTIONER (page-niveau) =====
  menu_section_personal: 'Mit Hjem',
  menu_section_personale: 'Personale',
  menu_section_ledelse: 'Ledelse',
  menu_section_test: 'Test',
  menu_section_mg: 'MG',
  menu_section_vagtplan: 'Vagtplan',
  menu_section_fieldmarketing: 'Fieldmarketing',
  menu_section_rekruttering: 'Rekruttering',
  menu_section_boards: 'Boards',
  menu_section_salary: 'Løn',
  menu_section_dashboards: 'Dashboards',
  menu_section_onboarding: 'Onboarding',
  menu_section_reports: 'Rapporter',
  menu_section_admin: 'Admin',
  menu_section_some: 'SOME',
  menu_section_sales_system: 'Salg & System',
  menu_section_spil: 'Spil',
  
  // ===== MIT HJEM (under menu_section_personal) =====
  menu_home: 'Hjem',
  menu_h2h: 'Head-to-Head',
  menu_commission_league: 'Salgsligaen',
  menu_league_admin: 'Liga Administration',
  menu_liga_test_board: 'Liga Test Board',
  menu_h2h_admin: 'H2H Admin',
  menu_team_h2h: 'Team H2H',
  menu_messages: 'Beskeder',
  menu_my_schedule: 'Min vagtplan',
  menu_my_profile: 'Min profil',
  menu_my_goals: 'Mine mål',
  menu_my_contracts: 'Mine kontrakter',
  menu_career_wishes: 'Karriereønsker',
  menu_my_feedback: 'Min feedback',
  menu_refer_friend: 'Henvis en ven',
  
  // ===== PERSONALE (under menu_section_personale) =====
  menu_dashboard: 'Dashboard',
  menu_employees: 'Medarbejdere',
  menu_teams: 'Teams',
  menu_permissions: 'Rettigheder',
  menu_login_log: 'Login log',
  menu_upcoming_starts: 'Kommende opstart',
  
  // ===== LEDELSE (under menu_section_ledelse) =====
  menu_company_overview: 'Firmaoversigt',
  menu_contracts: 'Kontrakter',
  menu_career_wishes_overview: 'Karriereønsker overblik',
  menu_email_templates_ledelse: 'E-mail skabeloner',
  menu_security_dashboard: 'Sikkerhedsoversigt',
  
  // ===== VAGTPLAN (under menu_section_vagtplan) =====
  menu_shift_overview: 'Vagtplan (leder)',
  menu_absence: 'Fravær',
  menu_time_tracking: 'Tidsregistrering',
  menu_time_stamp: 'Stempelur',
  menu_closing_shifts: 'Påmindelser',
  
  // ===== MG (under menu_section_mg) =====
  menu_team_overview: 'Team overblik',
  menu_tdc_erhverv: 'TDC Erhverv',
  menu_tdc_erhverv_dashboard: 'TDC Erhverv Dashboard',
  menu_tdc_opsummering: 'TDC Opsummering',
  menu_relatel_dashboard: 'Relatel Dashboard',
  menu_codan: 'Codan',
  menu_mg_test: 'MG Test',
  menu_mg_test_dashboard: 'MG Test Dashboard',
  menu_dialer_data: 'Dialer data',
  menu_calls_data: 'Opkaldsdata',
  menu_adversus_data: 'Adversus data',
  
  // ===== TEST (under menu_section_test) =====
  menu_car_quiz_admin: 'Bilquiz admin',
  menu_coc_admin: 'COC admin',
  menu_pulse_survey: 'Pulsmåling',
  
  // ===== REKRUTTERING (under menu_section_rekruttering) =====
  menu_recruitment_dashboard: 'Rekruttering Dashboard',
  menu_candidates: 'Kandidater',
  menu_upcoming_interviews: 'Kommende samtaler',
  menu_winback: 'Winback',
  menu_upcoming_hires: 'Kommende ansættelser',
  menu_messages_recruitment: 'Beskeder (rekruttering)',
  menu_sms_templates: 'SMS skabeloner',
  menu_email_templates_recruitment: 'E-mail skabeloner',
  menu_referrals: 'Henvisninger',
  
  // ===== LØN (under menu_section_salary) =====
  menu_payroll: 'Løn',
  menu_salary_types: 'Løntyper',
  
  // ===== SOME (under menu_section_some) =====
  menu_some: 'SOME',
  menu_extra_work: 'Ekstraarbejde',
  
  // ===== DASHBOARDS (under menu_section_dashboards) =====
  menu_dashboard_cph_sales: 'CPH Salg',
  menu_dashboard_cs_top_20: 'CS Top 20',
  menu_dashboard_fieldmarketing: 'Fieldmarketing',
  menu_dashboard_eesy_tm: 'Eesy TM',
  menu_dashboard_tdc_erhverv: 'TDC Erhverv',
  menu_dashboard_relatel: 'Relatel',
  menu_dashboard_mg_test: 'MG Test',
  menu_dashboard_united: 'United',
  menu_dashboard_design: 'Design',
  menu_dashboard_settings: 'Indstillinger',
  
  // ===== REPORTS (under menu_section_reports) =====
  menu_reports_admin: 'Admin rapporter',
  menu_reports_daily: 'Daglige rapporter',
  menu_reports_management: 'Ledelsesrapporter',
  menu_reports_employee: 'Medarbejderrapporter',
  
  // ===== ONBOARDING (under menu_section_onboarding) =====
  menu_onboarding_overview: 'Onboarding overblik',
  menu_onboarding_kursus: 'Kursus',
  menu_onboarding_ramp: 'Ramp-up',
  menu_onboarding_leader: 'Leder-onboarding',
  menu_onboarding_drills: 'Drills',
  menu_onboarding_admin: 'Onboarding admin',
  menu_coaching_templates: 'Coaching skabeloner',
  
  // ===== ADMIN (under menu_section_admin) =====
  menu_kpi_definitions: 'KPI definitioner',
  
  // ===== FIELDMARKETING (under menu_section_fieldmarketing) =====
  menu_fm_overview: 'Oversigt',
  menu_fm_booking: 'Booking',
  menu_fm_vehicles: 'Køretøjer',
  menu_fm_dashboard: 'Dashboard',
  menu_fm_sales_registration: 'Salgsregistrering',
  menu_fm_billing: 'Fakturering',
  menu_fm_travel_expenses: 'Rejseudgifter',
  menu_fm_edit_sales: 'Ret salg',
  menu_fm_time_off: 'Fraværsanmodninger',
  menu_fm_book_week: 'Book uge',
  menu_fm_bookings: 'Kommende bookinger',
  menu_fm_locations: 'Lokationer',
  menu_fm_vagtplan_fm: 'Vagtplan FM',
  
  // ===== SALG & SYSTEM (under menu_section_sales_system) =====
  menu_sales: 'Salg',
  menu_logics: 'Logikker',
  menu_live_stats: 'Live Stats',
  menu_settings: 'Indstillinger',
  
  // Legacy/andre
  menu_leaderboard: 'Leaderboard',
  menu_my_sales: 'Mine salg',
  menu_my_shifts: 'Mine vagter',
  menu_my_absence: 'Mit fravær',
  menu_my_coaching: 'Min coaching',
  
  // ===== TAB PERMISSIONS =====
  // EmployeeMasterData tabs
  tab_employees_all: 'Fane: Alle medarbejdere',
  tab_employees_staff: 'Fane: Backoffice',
  tab_employees_teams: 'Fane: Teams',
  tab_employees_positions: 'Fane: Stillinger',
  tab_employees_permissions: 'Fane: Rettigheder',
  tab_employees_dialer_mapping: 'Fane: Dialer-mapping',
  
  // OnboardingDashboard tabs
  tab_onboarding_overview: 'Fane: Onboarding oversigt',
  tab_onboarding_ramp: 'Fane: Forventninger',
  tab_onboarding_leader: 'Fane: Leder',
  tab_onboarding_drills: 'Fane: Drill-bibliotek',
  tab_onboarding_template: 'Fane: Skabelon',
  tab_onboarding_admin: 'Fane: Onboarding admin',
  
  // MgTestPage tabs
  tab_mg_salary_schemes: 'Fane: Lønordninger',
  tab_mg_relatel_status: 'Fane: Relatel Status',
  tab_mg_relatel_events: 'Fane: Relatel Events',
  
  // Winback tabs
  tab_winback_ghostet: 'Fane: Ghostet',
  tab_winback_takket_nej: 'Fane: Takket nej',
  tab_winback_kundeservice: 'Fane: Kundeservice',
  
  // Messages tabs
  tab_messages_all: 'Fane: Alle beskeder',
  tab_messages_sms: 'Fane: SMS',
  tab_messages_email: 'Fane: Email',
  tab_messages_call: 'Fane: Opkald',
  tab_messages_sent: 'Fane: Sendt',
  
  // FieldmarketingDashboardFull tabs
  tab_fm_eesy: 'Fane: Eesy FM',
  tab_fm_yousee: 'Fane: Yousee',
  
  // BookingManagement tabs
  tab_fm_book_week: 'Fane: Book uge',
  tab_fm_bookings: 'Fane: Kommende bookinger',
  tab_fm_locations: 'Fane: Lokationer',
  tab_fm_vagtplan: 'Fane: Vagtplan FM',
  
  // ===== SOFTPHONE & KOMMUNIKATION =====
  softphone_outbound: 'Softphone: Udgående opkald',
  softphone_inbound: 'Softphone: Indgående opkald',
  employee_sms: 'SMS til medarbejdere',
};

export const visibilityLabels: Record<Visibility, string> = {
  all: 'Alle',
  team: 'Team',
  self: 'Kun egen',
  none: 'Ingen',
};
