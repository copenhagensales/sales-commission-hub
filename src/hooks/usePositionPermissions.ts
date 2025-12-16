import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface PositionPermissions {
  [key: string]: boolean | { view: boolean; edit: boolean };
}

interface JobPosition {
  id: string;
  name: string;
  permissions: PositionPermissions;
}

// Owner position always has full access
const OWNER_POSITION_NAME = "Ejer";

const generateAllPermissions = (): PositionPermissions => ({
  // Menu access
  menu_dashboard: true,
  menu_wallboard: true,
  menu_mg_test: { view: true, edit: true },
  menu_sales: { view: true, edit: true },
  menu_agents: { view: true, edit: true },
  menu_payroll: { view: true, edit: true },
  menu_shift_planning: { view: true, edit: true },
  menu_recruitment: { view: true, edit: true },
  menu_contracts: { view: true, edit: true },
  menu_some: { view: true, edit: true },
  menu_settings: { view: true, edit: true },
  // Data visibility
  view_own_revenue: true,
  view_team_revenue: true,
  view_all_revenue: true,
  view_own_commission: true,
  view_team_commission: true,
  view_all_commission: true,
  view_salary_data: true,
  view_sensitive_data: true,
  // Employee management
  create_employees: true,
  edit_employees: true,
  delete_employees: true,
  manage_teams: true,
  assign_team_members: true,
  manage_positions: true,
  assign_roles: true,
  // Contract management
  view_contracts: true,
  create_contracts: true,
  send_contracts: true,
  edit_contract_templates: true,
  delete_contracts: true,
  // Shift management
  view_all_shifts: true,
  create_shifts: true,
  edit_shifts: true,
  approve_absence: true,
  mark_sick: true,
  edit_time_stamps: true,
  // Sales data
  view_sales: true,
  edit_sales: true,
  delete_sales: true,
  manage_products: true,
  manage_campaigns: true,
  run_payroll: true,
  // Integrations
  view_integrations: true,
  manage_integrations: true,
  view_logs: true,
  trigger_sync: true,
  // System
  manage_system_settings: true,
  view_audit_logs: true,
  manage_webhooks: true,
  full_admin_access: true,
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
  };

  const canView = (key: string): boolean => hasPermission(key, "view") || hasPermission(key);
  const canEdit = (key: string): boolean => hasPermission(key, "edit");

  return {
    isLoading,
    position: data?.position,
    permissions,
    hasPermission,
    canView,
    canEdit,
    // Common permission checks
    canViewDashboard: hasPermission("menu_dashboard"),
    canViewWallboard: hasPermission("menu_wallboard"),
    canViewMgTest: canView("menu_mg_test"),
    canEditMgTest: canEdit("menu_mg_test"),
    canViewSales: canView("menu_sales"),
    canEditSales: canEdit("menu_sales"),
    canViewPayroll: canView("menu_payroll"),
    canEditPayroll: canEdit("menu_payroll"),
    canViewShiftPlanning: canView("menu_shift_planning"),
    canEditShiftPlanning: canEdit("menu_shift_planning"),
    canViewRecruitment: canView("menu_recruitment"),
    canEditRecruitment: canEdit("menu_recruitment"),
    canViewContracts: canView("menu_contracts"),
    canEditContracts: canEdit("menu_contracts"),
    canViewSome: canView("menu_some"),
    canEditSome: canEdit("menu_some"),
    canViewSettings: canView("menu_settings"),
    canEditSettings: canEdit("menu_settings"),
    // Data visibility
    canViewOwnRevenue: hasPermission("view_own_revenue"),
    canViewTeamRevenue: hasPermission("view_team_revenue"),
    canViewAllRevenue: hasPermission("view_all_revenue"),
    canViewSalaryData: hasPermission("view_salary_data"),
    canViewSensitiveData: hasPermission("view_sensitive_data"),
    // Employee management
    canCreateEmployees: hasPermission("create_employees"),
    canEditEmployees: hasPermission("edit_employees"),
    canDeleteEmployees: hasPermission("delete_employees"),
    canManageTeams: hasPermission("manage_teams"),
    canManagePositions: hasPermission("manage_positions"),
    canAssignRoles: hasPermission("assign_roles"),
    // Contract management
    canCreateContracts: hasPermission("create_contracts"),
    canSendContracts: hasPermission("send_contracts"),
    canEditContractTemplates: hasPermission("edit_contract_templates"),
    canDeleteContracts: hasPermission("delete_contracts"),
    // Shift management
    canViewAllShifts: hasPermission("view_all_shifts"),
    canCreateShifts: hasPermission("create_shifts"),
    canEditShifts: hasPermission("edit_shifts"),
    canApproveAbsence: hasPermission("approve_absence"),
    canMarkSick: hasPermission("mark_sick"),
    canEditTimeStamps: hasPermission("edit_time_stamps"),
    // Sales
    canManageProducts: hasPermission("manage_products"),
    canManageCampaigns: hasPermission("manage_campaigns"),
    canRunPayroll: hasPermission("run_payroll"),
    // Integrations
    canViewIntegrations: hasPermission("view_integrations"),
    canManageIntegrations: hasPermission("manage_integrations"),
    canViewLogs: hasPermission("view_logs"),
    canTriggerSync: hasPermission("trigger_sync"),
    // System
    canManageSystemSettings: hasPermission("manage_system_settings"),
    canViewAuditLogs: hasPermission("view_audit_logs"),
    canManageWebhooks: hasPermission("manage_webhooks"),
    hasFullAdminAccess: hasPermission("full_admin_access"),
  };
}
