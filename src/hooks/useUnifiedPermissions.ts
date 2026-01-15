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
}

export interface DataVisibilityRule {
  id: string;
  role_key: string;
  data_scope: string;
  visibility: Visibility;
  context: string | null;
  description: string | null;
}

// Fetch all role definitions
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
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Fetch all page permissions
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
    staleTime: 5 * 60 * 1000,
  });
}

// Fetch all data visibility rules
export function useDataVisibilityRules() {
  return useQuery({
    queryKey: ['data-visibility-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('data_visibility_rules')
        .select('*')
        .order('data_scope');
      
      if (error) throw error;
      return data as DataVisibilityRule[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Get current user's role from employee data
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
        if (titleLower.includes('teamleder')) return 'teamleder';
        if (titleLower === 'rekruttering') return 'rekruttering';
        if (titleLower === 'some') return 'some';
      }
      
      return 'medarbejder' as SystemRole;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
}

// Main unified permissions hook
export function useUnifiedPermissions() {
  const { user } = useAuth();
  const { data: currentRole, isLoading: roleLoading } = useCurrentUserRole();
  const { data: pagePermissions, isLoading: permissionsLoading } = usePagePermissions();
  const { data: visibilityRules, isLoading: visibilityLoading } = useDataVisibilityRules();
  
  const isLoading = roleLoading || permissionsLoading || visibilityLoading;
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
  
  // Get data visibility scope for current role
  const getDataScope = (scope: string, context?: string): Visibility => {
    if (isOwner) return 'all'; // Owners see everything
    
    const rule = visibilityRules?.find(
      r => r.role_key === role && r.data_scope === scope && (r.context === context || !context)
    );
    return (rule?.visibility as Visibility) ?? 'none';
  };
  
  // Check if user can see data for a specific target
  const canSeeData = (
    scope: string, 
    targetEmployeeId?: string, 
    currentEmployeeId?: string,
    isInUserTeam?: boolean
  ): boolean => {
    const visibility = getDataScope(scope);
    
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
    visibilityRules,
  };
}

// Helper labels for UI
export const permissionKeyLabels: Record<string, string> = {
  // Sektioner
  menu_section_personal: 'Personlig',
  menu_section_personale: 'Personale',
  menu_section_ledelse: 'Ledelse',
  menu_section_test: 'Test',
  menu_section_mg: 'MG',
  menu_section_vagtplan: 'Vagtplan',
  menu_section_fieldmarketing: 'Fieldmarketing',
  menu_section_rekruttering: 'Rekruttering',
  menu_section_boards: 'Boards',
  menu_section_salary: 'Løn',
  
  // Menupunkter
  menu_dashboard: 'Dashboard',
  menu_employees: 'Medarbejdere',
  menu_teams: 'Teams',
  menu_payroll: 'Løn',
  menu_sales: 'Salg',
  menu_settings: 'Indstillinger',
  menu_absence: 'Fravær',
  menu_permissions: 'Rettigheder',
  menu_salary_types: 'Løntyper',
  menu_leaderboard: 'Leaderboard',
  menu_my_sales: 'Mine salg',
  menu_my_shifts: 'Mine vagter',
  menu_my_absence: 'Mit fravær',
  menu_my_profile: 'Min profil',
  menu_my_coaching: 'Min coaching',
  // Rettede keys (matcher sidebar)
  menu_onboarding_admin: 'Onboarding Admin',
  menu_recruitment_dashboard: 'Rekruttering Dashboard',
  menu_shift_overview: 'Vagtplan Oversigt',
  
  // Fieldmarketing sidebar-menuer (tabs)
  menu_fm_overview: 'Oversigt',
  menu_fm_booking: 'Booking',
  menu_fm_vehicles: 'Køretøjer',
  menu_fm_dashboard: 'Dashboard',
  menu_fm_sales_registration: 'Salgsregistrering',
  menu_fm_billing: 'Fakturering',
  menu_fm_travel_expenses: 'Rejseudgifter',
  menu_fm_edit_sales: 'Ret salg',
  menu_fm_time_off: 'Fraværsanmodninger',
  
  // Fieldmarketing booking-faner (actions)
  menu_fm_book_week: 'Book uge',
  menu_fm_bookings: 'Kommende bookinger',
  menu_fm_locations: 'Lokationer',
  menu_fm_vagtplan_fm: 'Vagtplan FM',
};

export const dataScopeLabels: Record<string, string> = {
  employees: 'Medarbejdere',
  sales: 'Salg',
  shifts: 'Vagter',
  absences: 'Fravær',
  coaching: 'Coaching',
  contracts: 'Kontrakter',
  payroll: 'Løn',
  leaderboard_ranking: 'Leaderboard rangering',
  sales_count_others: 'Andres salgstal',
  commission_details: 'Provisionsdetaljer',
  salary_breakdown: 'Lønspecifikation',
  h2h_stats: 'Head-to-Head statistik',
  employee_performance: 'Medarbejder performance',
};

export const visibilityLabels: Record<Visibility, string> = {
  all: 'Alle',
  team: 'Team',
  self: 'Kun egen',
  none: 'Ingen',
};
