import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { permissionKeyLabels as centralPermissionKeyLabels, type PermissionKey } from "@/config/permissionKeys";

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
      // Supabase has a 1000 row default limit - we need to paginate to get all ~1262 rows
      const allPermissions: PagePermission[] = [];
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;
      
      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        
        const { data, error } = await supabase
          .from('role_page_permissions')
          .select('*')
          .order('permission_key')
          .range(from, to);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          allPermissions.push(...(data as PagePermission[]));
          hasMore = data.length === pageSize; // If we got full page, there might be more
          page++;
        } else {
          hasMore = false;
        }
      }
      
      console.log(`[usePagePermissions] Fetched ${allPermissions.length} permissions`);
      return allPermissions;
    },
    staleTime: 15 * 60 * 1000, // 15 minutes - rarely changes during session
    gcTime: 30 * 60 * 1000, // 30 minutes garbage collection
  });
}


// Get current user's role from employee data
// OPTIMIZED: Extended staleTime to 15 minutes - user role doesn't change during session
function useCurrentUserRole() {
  const { user } = useAuth();
  
  const query = useQuery({
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
      
      // Primary: Use system_role_key from job_positions via employee
      const { data: employee } = await supabase
        .from('employee_master_data')
        .select('job_title, position_id')
        .eq('auth_user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      
      if (employee?.position_id) {
        const { data: position } = await supabase
          .from('job_positions')
          .select('system_role_key')
          .eq('id', employee.position_id)
          .maybeSingle();
        
        console.log('[useUnifiedPermissions] Position lookup:', { 
          position_id: employee.position_id, 
          system_role_key: position?.system_role_key 
        });
        
        if (position?.system_role_key) {
          return position.system_role_key;
        }
      }
      
      // Fallback: map job_title to role (legacy support)
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
  
  return {
    ...query,
    isFetched: query.isFetched,
  };
}

// Main unified permissions hook
export function useUnifiedPermissions() {
  const { user } = useAuth();
  const { data: currentRole, isLoading: roleLoading, isFetched: roleFetched } = useCurrentUserRole();
  const { data: pagePermissions, isLoading: permissionsLoading, isFetched: permissionsFetched } = usePagePermissions();
  
  // isLoading: Still fetching initial data
  const isLoading = roleLoading || permissionsLoading;
  
  // isReady: Data is ACTUALLY available for use
  // This prevents race conditions where isLoading=false but data is undefined
  const isReady = roleFetched && permissionsFetched && !!currentRole && !!pagePermissions;
  
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
    isReady,
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

// Helper labels for UI - now imported from central source
// Re-exported for backwards compatibility
export const permissionKeyLabels = centralPermissionKeyLabels;

// Also re-export the type for consumers
export type { PermissionKey };

export const visibilityLabels: Record<Visibility, string> = {
  all: 'Alle',
  team: 'Team',
  self: 'Kun egen',
  none: 'Ingen',
};
