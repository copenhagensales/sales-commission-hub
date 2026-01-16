import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Eye, 
  Pencil, 
  Settings2, 
  Save,
  ChevronRight,
  Folder,
  FileText,
  Zap,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Lock
} from "lucide-react";
import { toast } from "sonner";
import { 
  usePagePermissions, 
  useRoleDefinitions,
  permissionKeyLabels,
  type PagePermission,
  type RoleDefinition,
  type Visibility
} from "@/hooks/useUnifiedPermissions";

type PermissionType = 'page' | 'tab' | 'action';

interface EditingPermission {
  id?: string;
  role_key: string;
  permission_key: string;
  parent_key: string | null;
  permission_type: PermissionType;
  can_view: boolean;
  can_edit: boolean;
  description: string;
}

const permissionTypeIcons: Record<PermissionType, React.ReactNode> = {
  page: <Folder className="h-4 w-4" />,
  tab: <FileText className="h-4 w-4" />,
  action: <Zap className="h-4 w-4" />,
};

const permissionTypeLabelsUI: Record<PermissionType, string> = {
  page: 'Side',
  tab: 'Fane',
  action: 'Handling',
};

const colorMap: Record<string, string> = {
  primary: "bg-primary text-primary-foreground",
  blue: "bg-blue-500 text-white",
  amber: "bg-amber-500 text-white",
  purple: "bg-purple-500 text-white",
  muted: "bg-muted text-muted-foreground",
  gray: "bg-muted text-muted-foreground",
};

// ===== PERMISSION HIERARCHY =====
// Maps each permission key to its parent key (null = top-level)
const PERMISSION_HIERARCHY: Record<string, string | null> = {
  // ===== SEKTIONER (top-level) =====
  menu_section_personal: null,
  menu_section_personale: null,
  menu_section_ledelse: null,
  menu_section_test: null,
  menu_section_mg: null,
  menu_section_vagtplan: null,
  menu_section_fieldmarketing: null,
  menu_section_rekruttering: null,
  menu_section_boards: null,
  menu_section_salary: null,
  menu_section_dashboards: null,
  menu_section_onboarding: null,
  menu_section_reports: null,
  menu_section_admin: null,
  menu_section_some: null,
  
  // ===== MIT HJEM (under menu_section_personal) =====
  menu_home: 'menu_section_personal',
  menu_h2h: 'menu_section_personal',
  menu_commission_league: 'menu_section_personal',
  menu_messages: 'menu_section_personal',
  menu_my_schedule: 'menu_section_personal',
  menu_my_profile: 'menu_section_personal',
  menu_my_goals: 'menu_section_personal',
  menu_my_contracts: 'menu_section_personal',
  menu_career_wishes: 'menu_section_personal',
  menu_my_feedback: 'menu_section_personal',
  menu_refer_friend: 'menu_section_personal',
  
  // ===== PERSONALE (under menu_section_personale) =====
  menu_dashboard: 'menu_section_personale',
  menu_employees: 'menu_section_personale',
  menu_teams: 'menu_section_personale',
  menu_absence: 'menu_section_personale',
  menu_permissions: 'menu_section_personale',
  menu_login_log: 'menu_section_personale',
  menu_upcoming_starts: 'menu_section_personale',
  
  // ===== LEDELSE (under menu_section_ledelse) =====
  menu_company_overview: 'menu_section_ledelse',
  menu_contracts: 'menu_section_ledelse',
  menu_career_wishes_overview: 'menu_section_ledelse',
  menu_email_templates_ledelse: 'menu_section_ledelse',
  menu_security_dashboard: 'menu_section_ledelse',
  
  // ===== VAGTPLAN (under menu_section_vagtplan) =====
  menu_shift_overview: 'menu_section_vagtplan',
  menu_time_tracking: 'menu_section_vagtplan',
  menu_time_stamp: 'menu_section_vagtplan',
  menu_closing_shifts: 'menu_section_vagtplan',
  
  // ===== MG (under menu_section_mg) =====
  menu_team_overview: 'menu_section_mg',
  menu_tdc_erhverv: 'menu_section_mg',
  menu_tdc_erhverv_dashboard: 'menu_section_mg',
  menu_relatel_dashboard: 'menu_section_mg',
  menu_tryg_dashboard: 'menu_section_mg',
  menu_ase_dashboard: 'menu_section_mg',
  menu_codan: 'menu_section_mg',
  menu_mg_test: 'menu_section_mg',
  menu_mg_test_dashboard: 'menu_section_mg',
  menu_dialer_data: 'menu_section_mg',
  menu_calls_data: 'menu_section_mg',
  menu_adversus_data: 'menu_section_mg',
  
  // ===== TEST (under menu_section_test) =====
  menu_car_quiz_admin: 'menu_section_test',
  menu_coc_admin: 'menu_section_test',
  menu_pulse_survey: 'menu_section_test',
  
  // ===== REKRUTTERING (under menu_section_rekruttering) =====
  menu_recruitment_dashboard: 'menu_section_rekruttering',
  menu_candidates: 'menu_section_rekruttering',
  menu_upcoming_interviews: 'menu_section_rekruttering',
  menu_winback: 'menu_section_rekruttering',
  menu_upcoming_hires: 'menu_section_rekruttering',
  menu_messages_recruitment: 'menu_section_rekruttering',
  menu_sms_templates: 'menu_section_rekruttering',
  menu_email_templates_recruitment: 'menu_section_rekruttering',
  menu_referrals: 'menu_section_rekruttering',
  
  // ===== LØN (under menu_section_salary) =====
  menu_payroll: 'menu_section_salary',
  menu_salary_types: 'menu_section_salary',
  
  // ===== SOME (under menu_section_some) =====
  menu_some: 'menu_section_some',
  menu_extra_work: 'menu_section_some',
  
  // ===== DASHBOARDS (under menu_section_dashboards) =====
  menu_dashboard_cph_sales: 'menu_section_dashboards',
  menu_dashboard_cs_top_20: 'menu_section_dashboards',
  menu_dashboard_fieldmarketing: 'menu_section_dashboards',
  menu_dashboard_fm_goals: 'menu_section_dashboards',
  menu_dashboard_eesy_tm: 'menu_section_dashboards',
  menu_dashboard_tdc_erhverv: 'menu_section_dashboards',
  menu_dashboard_tdc_goals: 'menu_section_dashboards',
  menu_dashboard_relatel: 'menu_section_dashboards',
  menu_dashboard_tryg: 'menu_section_dashboards',
  menu_dashboard_ase: 'menu_section_dashboards',
  menu_dashboard_mg_test: 'menu_section_dashboards',
  menu_dashboard_united: 'menu_section_dashboards',
  menu_dashboard_design: 'menu_section_dashboards',
  menu_dashboard_settings: 'menu_section_dashboards',
  
  // ===== REPORTS (under menu_section_reports) =====
  menu_reports_admin: 'menu_section_reports',
  menu_reports_daily: 'menu_section_reports',
  menu_reports_management: 'menu_section_reports',
  menu_reports_employee: 'menu_section_reports',
  
  // ===== ONBOARDING (under menu_section_onboarding) =====
  menu_onboarding_overview: 'menu_section_onboarding',
  menu_onboarding_kursus: 'menu_section_onboarding',
  menu_onboarding_ramp: 'menu_section_onboarding',
  menu_onboarding_leader: 'menu_section_onboarding',
  menu_onboarding_drills: 'menu_section_onboarding',
  menu_onboarding_admin: 'menu_section_onboarding',
  menu_coaching_templates: 'menu_section_onboarding',
  
  // ===== ADMIN (under menu_section_admin) =====
  menu_kpi_definitions: 'menu_section_admin',
  
  // ===== FIELDMARKETING (under menu_section_fieldmarketing) =====
  menu_fm_overview: 'menu_section_fieldmarketing',
  menu_fm_booking: 'menu_section_fieldmarketing',
  menu_fm_vehicles: 'menu_section_fieldmarketing',
  menu_fm_dashboard: 'menu_section_fieldmarketing',
  menu_fm_sales_registration: 'menu_section_fieldmarketing',
  menu_fm_billing: 'menu_section_fieldmarketing',
  menu_fm_travel_expenses: 'menu_section_fieldmarketing',
  menu_fm_edit_sales: 'menu_section_fieldmarketing',
  menu_fm_time_off: 'menu_section_fieldmarketing',
  menu_fm_book_week: 'menu_section_fieldmarketing',
  menu_fm_bookings: 'menu_section_fieldmarketing',
  menu_fm_locations: 'menu_section_fieldmarketing',
  menu_fm_vagtplan_fm: 'menu_section_fieldmarketing',
  
  // Legacy/andre
  menu_sales: null,
  menu_settings: null,
  menu_leaderboard: null,
  menu_my_sales: 'menu_section_personal',
  menu_my_shifts: 'menu_section_personal',
  menu_my_absence: 'menu_section_personal',
  menu_my_coaching: 'menu_section_personal',
  
  // ===== TAB PERMISSIONS =====
  // EmployeeMasterData tabs
  tab_employees_all: 'menu_employees',
  tab_employees_staff: 'menu_employees',
  tab_employees_teams: 'menu_employees',
  tab_employees_positions: 'menu_employees',
  tab_employees_permissions: 'menu_employees',
  tab_employees_dialer: 'menu_employees',
  
  // OnboardingDashboard tabs
  tab_onboarding_overview: 'menu_onboarding_overview',
  tab_onboarding_ramp: 'menu_onboarding_overview',
  tab_onboarding_leader: 'menu_onboarding_overview',
  tab_onboarding_drills: 'menu_onboarding_overview',
  tab_onboarding_template: 'menu_onboarding_overview',
  tab_onboarding_admin: 'menu_onboarding_overview',
  
  // MgTestPage tabs
  tab_mg_salary_schemes: 'menu_mg_test',
  tab_mg_relatel_status: 'menu_mg_test',
  tab_mg_relatel_events: 'menu_mg_test',
  
  // Winback tabs
  tab_winback_ghostet: 'menu_winback',
  tab_winback_takket_nej: 'menu_winback',
  tab_winback_kundeservice: 'menu_winback',
  
  // Messages tabs
  tab_messages_all: 'menu_messages',
  tab_messages_sms: 'menu_messages',
  tab_messages_email: 'menu_messages',
  tab_messages_call: 'menu_messages',
  tab_messages_sent: 'menu_messages',
  
  // FieldmarketingDashboardFull tabs
  tab_fm_eesy: 'menu_fm_dashboard',
  tab_fm_yousee: 'menu_fm_dashboard',
  
  // BookingManagement tabs
  tab_fm_book_week: 'menu_fm_booking',
  tab_fm_bookings: 'menu_fm_booking',
  tab_fm_locations: 'menu_fm_booking',
  tab_fm_vagtplan: 'menu_fm_booking',
};

// Derive permission type from key
const getPermissionTypeFromKey = (key: string): PermissionType => {
  if (key.startsWith('tab_')) return 'tab';
  if (key.startsWith('action_')) return 'action';
  return 'page';
};

// Get all permission keys from permissionKeyLabels
const ALL_PERMISSION_KEYS = Object.keys(permissionKeyLabels);

// Recursive permission row component for multi-level hierarchy
interface PermissionWithChildren {
  id: string;
  role_key: string;
  permission_key: string;
  parent_key: string | null;
  permission_type: PermissionType | null;
  can_view: boolean;
  can_edit: boolean;
  description: string | null;
  visibility?: 'all' | 'team' | 'self';
  children?: PermissionWithChildren[];
}

interface PermissionRowProps {
  permission: PermissionWithChildren;
  level: number;
  rolePermissions: PermissionWithChildren[];
  togglePermission: (permission: PermissionWithChildren, field: 'can_view' | 'can_edit') => void;
  isChildDisabled: (child: PermissionWithChildren, field: 'can_view' | 'can_edit') => boolean;
  openEditPermission: (permission: PermissionWithChildren) => void;
  updateRowVisibility: (permission: PermissionWithChildren, visibility: 'all' | 'team' | 'self') => void;
}

function PermissionRow({
  permission,
  level,
  rolePermissions,
  togglePermission,
  isChildDisabled,
  openEditPermission,
  updateRowVisibility
}: PermissionRowProps) {
  const paddingLeft = level * 16;
  const isTopLevel = level === 0;
  const disabled = level > 0 && isChildDisabled(permission, 'can_view');
  
  return (
    <>
      <TableRow className={isTopLevel ? "bg-muted/30" : "bg-background"}>
        <TableCell>
          <div className="flex items-center gap-2" style={{ paddingLeft }}>
            {level > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            {permissionTypeIcons[permission.permission_type || 'page']}
            <span className="text-xs text-muted-foreground">
              {permissionTypeLabelsUI[permission.permission_type || 'page']}
            </span>
          </div>
        </TableCell>
        <TableCell className="font-medium" style={{ paddingLeft: level > 0 ? paddingLeft + 8 : undefined }}>
          {permissionKeyLabels[permission.permission_key] || permission.permission_key}
        </TableCell>
        <TableCell className="text-muted-foreground text-sm">
          {permission.description}
        </TableCell>
        <TableCell className="text-center">
          <div className="flex items-center justify-center" title={disabled ? 'Slået fra - forælder er deaktiveret' : undefined}>
            <Switch
              checked={permission.can_view}
              disabled={disabled}
              onCheckedChange={() => togglePermission(permission, 'can_view')}
              className={disabled ? 'opacity-50' : ''}
            />
          </div>
        </TableCell>
        <TableCell className="text-center">
          <div 
            className="flex items-center justify-center gap-1" 
            title={
              isChildDisabled(permission, 'can_edit') 
                ? `Låst - aktiver først "Rediger" på ${permissionKeyLabels[permission.parent_key || ''] || 'forælderen'}`
                : undefined
            }
          >
            <Switch
              checked={permission.can_edit}
              disabled={isChildDisabled(permission, 'can_edit')}
              onCheckedChange={() => togglePermission(permission, 'can_edit')}
              className={isChildDisabled(permission, 'can_edit') ? 'opacity-50 cursor-not-allowed' : ''}
            />
            {isChildDisabled(permission, 'can_edit') && (
              <Lock className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
        </TableCell>
        {/* Data visibility columns - active for all rows */}
        <TableCell className="text-center">
          <div className="flex items-center justify-center">
            <Switch
              checked={permission.visibility === 'all'}
              disabled={disabled || !permission.can_view}
              onCheckedChange={() => updateRowVisibility(permission, 'all')}
              className={disabled || !permission.can_view ? 'opacity-50' : ''}
            />
          </div>
        </TableCell>
        <TableCell className="text-center">
          <div className="flex items-center justify-center">
            <Switch
              checked={permission.visibility === 'team'}
              disabled={disabled || !permission.can_view}
              onCheckedChange={() => updateRowVisibility(permission, 'team')}
              className={disabled || !permission.can_view ? 'opacity-50' : ''}
            />
          </div>
        </TableCell>
        <TableCell className="text-center">
          <div className="flex items-center justify-center">
            <Switch
              checked={permission.visibility === 'self'}
              disabled={disabled || !permission.can_view}
              onCheckedChange={() => updateRowVisibility(permission, 'self')}
              className={disabled || !permission.can_view ? 'opacity-50' : ''}
            />
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => openEditPermission(permission)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {permission.can_view && permission.children?.map((child) => (
        <PermissionRow
          key={child.id}
          permission={child}
          level={level + 1}
          rolePermissions={rolePermissions}
          togglePermission={togglePermission}
          isChildDisabled={isChildDisabled}
          openEditPermission={openEditPermission}
          updateRowVisibility={updateRowVisibility}
        />
      ))}
    </>
  );
}

// New role form interface
interface NewRoleForm {
  key: string;
  label: string;
  description: string;
  color: string;
  icon: string;
  priority: number;
  copyFromRole: string | null;
}

const ROLE_COLORS = [
  { value: 'primary', label: 'Primær', class: 'bg-primary text-primary-foreground' },
  { value: 'blue', label: 'Blå', class: 'bg-blue-500 text-white' },
  { value: 'amber', label: 'Gul', class: 'bg-amber-500 text-white' },
  { value: 'purple', label: 'Lilla', class: 'bg-purple-500 text-white' },
  { value: 'muted', label: 'Grå', class: 'bg-muted text-muted-foreground' },
];


export function PermissionEditor() {
  const queryClient = useQueryClient();
  const { data: permissions = [], isLoading: permissionsLoading } = usePagePermissions();
  const { data: roles = [], isLoading: rolesLoading } = useRoleDefinitions();
  
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [editingPermission, setEditingPermission] = useState<EditingPermission | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  
  // Create role state
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
  const [newRoleForm, setNewRoleForm] = useState<NewRoleForm>({
    key: '',
    label: '',
    description: '',
    color: 'muted',
    icon: 'user',
    priority: 100,
    copyFromRole: null,
  });
  
  // Delete role state
  const [roleToDelete, setRoleToDelete] = useState<RoleDefinition | null>(null);
  const [linkedPositions, setLinkedPositions] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Extended permissions with the new fields (assuming types will be updated)
  const extendedPermissions = permissions as (PagePermission & { 
    parent_key?: string | null; 
    permission_type?: PermissionType;
  })[];

  // Group permissions by role
  const permissionsByRole = extendedPermissions.reduce((acc, p) => {
    if (!acc[p.role_key]) acc[p.role_key] = [];
    acc[p.role_key].push(p);
    return acc;
  }, {} as Record<string, typeof extendedPermissions>);

  // Seed all permissions for a role
  const seedPermissionsForRole = async (roleKey: string) => {
    setIsSeeding(true);
    
    try {
      // Get existing permissions for this role
      const existingKeys = permissionsByRole[roleKey]?.map(p => p.permission_key) || [];
      
      // Find missing keys
      const missingKeys = ALL_PERMISSION_KEYS.filter(key => !existingKeys.includes(key));
      
      if (missingKeys.length === 0) {
        toast.info('Alle rettigheder er allerede oprettet');
        setIsSeeding(false);
        return;
      }
      
      // Determine default values based on role
      const isOwner = roleKey === 'ejer';
      const isTeamleder = roleKey === 'teamleder';
      
      // Create permission records for all missing keys
      const newPermissions = missingKeys.map(key => ({
        role_key: roleKey,
        permission_key: key,
        parent_key: PERMISSION_HIERARCHY[key] || null,
        permission_type: getPermissionTypeFromKey(key),
        can_view: isOwner, // Only owner gets view by default
        can_edit: isOwner, // Only owner gets edit by default
        visibility: isOwner ? 'all' : (isTeamleder ? 'team' : 'self'),
        description: null,
      }));
      
      // Insert in batches to avoid timeout
      const BATCH_SIZE = 50;
      for (let i = 0; i < newPermissions.length; i += BATCH_SIZE) {
        const batch = newPermissions.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('role_page_permissions')
          .insert(batch);
        
        if (error) {
          console.error('Error seeding permissions batch:', error);
          throw error;
        }
      }
      
      toast.success(`${missingKeys.length} rettigheder oprettet for ${roleKey}`);
      queryClient.invalidateQueries({ queryKey: ['page-permissions'] });
    } catch (error: any) {
      console.error('Error seeding permissions:', error);
      toast.error('Kunne ikke oprette rettigheder: ' + error.message);
    } finally {
      setIsSeeding(false);
    }
  };

  // Copy permissions from an existing role
  const copyPermissionsFromRole = async (newRoleKey: string, sourceRoleKey: string) => {
    setIsSeeding(true);
    
    try {
      // Get all permissions from source role
      const sourcePermissions = permissionsByRole[sourceRoleKey] || [];
      
      if (sourcePermissions.length === 0) {
        // If source has no permissions, fall back to regular seeding
        toast.info('Kilderollen har ingen rettigheder - opretter standard rettigheder');
        setIsSeeding(false);
        await seedPermissionsForRole(newRoleKey);
        return;
      }
      
      // Create new permission records copying values from source
      const newPermissions = sourcePermissions.map(p => ({
        role_key: newRoleKey,
        permission_key: p.permission_key,
        parent_key: p.parent_key || PERMISSION_HIERARCHY[p.permission_key] || null,
        permission_type: p.permission_type || getPermissionTypeFromKey(p.permission_key),
        can_view: p.can_view,
        can_edit: p.can_edit,
        visibility: p.visibility || 'self',
        description: p.description,
      }));
      
      // Insert in batches to avoid timeout
      const BATCH_SIZE = 50;
      for (let i = 0; i < newPermissions.length; i += BATCH_SIZE) {
        const batch = newPermissions.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('role_page_permissions')
          .insert(batch);
        
        if (error) {
          console.error('Error copying permissions batch:', error);
          throw error;
        }
      }
      
      toast.success(`${newPermissions.length} rettigheder kopieret fra ${sourceRoleKey}`);
      queryClient.invalidateQueries({ queryKey: ['page-permissions'] });
    } catch (error: any) {
      console.error('Error copying permissions:', error);
      toast.error('Kunne ikke kopiere rettigheder: ' + error.message);
    } finally {
      setIsSeeding(false);
    }
  };

  // Auto-seed when selecting a role with no permissions
  useEffect(() => {
    if (selectedRole && !permissionsLoading) {
      const rolePermissionCount = permissionsByRole[selectedRole]?.length || 0;
      if (rolePermissionCount === 0) {
        seedPermissionsForRole(selectedRole);
      }
    }
  }, [selectedRole, permissionsLoading]);

  // Get multi-level hierarchy - now supports grandchildren
  const getPermissionHierarchy = (rolePermissions: typeof extendedPermissions) => {
    // Top-level pages are items WITHOUT a parent_key
    const topLevelPages = rolePermissions.filter(p => !p.parent_key);
    
    // Build nested children recursively
    const getChildren = (parentKey: string): typeof extendedPermissions[0][] => {
      const directChildren = rolePermissions.filter(p => p.parent_key === parentKey);
      return directChildren.map(child => ({
        ...child,
        children: getChildren(child.permission_key)
      })) as typeof extendedPermissions[0][];
    };
    
    return topLevelPages.map(page => ({
      ...page,
      children: getChildren(page.permission_key)
    }));
  };

  // Update permission mutation
  const updateMutation = useMutation({
    mutationFn: async (permission: EditingPermission) => {
      const { error } = await supabase
        .from('role_page_permissions')
        .update({
          can_view: permission.can_view,
          can_edit: permission.can_edit,
          description: permission.description,
          parent_key: permission.parent_key,
          permission_type: permission.permission_type,
        })
        .eq('id', permission.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-permissions'] });
      toast.success('Rettighed opdateret');
      setIsSheetOpen(false);
      setEditingPermission(null);
    },
    onError: (error) => {
      toast.error('Kunne ikke opdatere rettighed: ' + error.message);
    },
  });

  // Create role mutation
  const createRoleMutation = useMutation({
    mutationFn: async (form: NewRoleForm) => {
      const { error } = await supabase
        .from('system_role_definitions')
        .insert({
          key: form.key,
          label: form.label,
          description: form.description,
          color: form.color,
          icon: form.icon,
          priority: form.priority,
        });
      
      if (error) throw error;
      return { roleKey: form.key, copyFromRole: form.copyFromRole };
    },
    onSuccess: async ({ roleKey, copyFromRole }) => {
      queryClient.invalidateQueries({ queryKey: ['role-definitions'] });
      toast.success('Rolle oprettet');
      setIsCreateRoleOpen(false);
      setNewRoleForm({
        key: '',
        label: '',
        description: '',
        color: 'muted',
        icon: 'user',
        priority: 100,
        copyFromRole: null,
      });
      
      // Copy permissions from source role or auto-seed
      if (copyFromRole) {
        await copyPermissionsFromRole(roleKey, copyFromRole);
      }
      
      setSelectedRole(roleKey);
    },
    onError: (error) => {
      toast.error('Kunne ikke oprette rolle: ' + error.message);
    },
  });

  // Delete role mutation
  const deleteRoleMutation = useMutation({
    mutationFn: async (roleKey: string) => {
      // First delete all permissions for this role
      const { error: permError } = await supabase
        .from('role_page_permissions')
        .delete()
        .eq('role_key', roleKey);
      
      if (permError) throw permError;
      
      // Clear system_role_key from job_positions
      const { error: posError } = await supabase
        .from('job_positions')
        .update({ system_role_key: null })
        .eq('system_role_key', roleKey);
      
      if (posError) throw posError;
      
      // Finally delete the role itself
      const { error } = await supabase
        .from('system_role_definitions')
        .delete()
        .eq('key', roleKey);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-definitions'] });
      queryClient.invalidateQueries({ queryKey: ['page-permissions'] });
      queryClient.invalidateQueries({ queryKey: ['job-positions'] });
      toast.success('Rolle slettet');
      setIsDeleteDialogOpen(false);
      setRoleToDelete(null);
      if (selectedRole === roleToDelete?.key) {
        setSelectedRole(null);
      }
    },
    onError: (error) => {
      toast.error('Kunne ikke slette rolle: ' + error.message);
    },
  });

  // Handle delete role click - check for linked positions
  const handleDeleteRoleClick = async (role: RoleDefinition) => {
    const { data: positions } = await supabase
      .from('job_positions')
      .select('name')
      .eq('system_role_key', role.key);
    
    setRoleToDelete(role);
    setLinkedPositions(positions?.map(p => p.name) || []);
    setIsDeleteDialogOpen(true);
  };

  const handleCreateRole = () => {
    if (!newRoleForm.key.trim()) {
      toast.error('Nøgle er påkrævet');
      return;
    }
    if (!newRoleForm.label.trim()) {
      toast.error('Navn er påkrævet');
      return;
    }
    // Check if key already exists
    if (roles.some(r => r.key === newRoleForm.key)) {
      toast.error('En rolle med denne nøgle eksisterer allerede');
      return;
    }
    createRoleMutation.mutate(newRoleForm);
  };

  // Toggle permission inline with automatic child inheritance
  const togglePermission = async (permission: PagePermission & { parent_key?: string | null; permission_type?: PermissionType }, field: 'can_view' | 'can_edit') => {
    const newValue = !permission[field];
    
    // Update the permission itself
    const { data, error, status, statusText } = await supabase
      .from('role_page_permissions')
      .update({ [field]: newValue })
      .eq('id', permission.id)
      .select();
    
    if (error) {
      console.error('Permission update error:', error);
      toast.error(`Kunne ikke opdatere: ${error.message}`);
      return;
    }
    
    if (!data || data.length === 0) {
      console.error('No rows updated - RLS may be blocking. Permission ID:', permission.id);
      toast.error('Ingen rækker opdateret - kontroller rettigheder i databasen');
      return;
    }
    
    toast.success('Rettighed opdateret');

    // If it's a page and we're turning OFF, also turn off all children
    if ((permission.permission_type === 'page' || !permission.parent_key) && !newValue) {
      const children = rolePermissions.filter(p => p.parent_key === permission.permission_key);
      if (children.length > 0) {
        const childIds = children.map(c => c.id);
        await supabase
          .from('role_page_permissions')
          .update({ [field]: false })
          .in('id', childIds);
      }
    }
    
    // If it's a page and we're turning ON can_view, also turn on children's can_view
    if ((permission.permission_type === 'page' || !permission.parent_key) && newValue && field === 'can_view') {
      const children = rolePermissions.filter(p => p.parent_key === permission.permission_key);
      if (children.length > 0) {
        const childIds = children.map(c => c.id);
        await supabase
          .from('role_page_permissions')
          .update({ can_view: true })
          .in('id', childIds);
      }
    }

    queryClient.invalidateQueries({ queryKey: ['page-permissions'] });
  };

  // Check if a child permission should be disabled (parent is off)
  const isChildDisabled = (child: PagePermission & { parent_key?: string | null; permission_type?: PermissionType }, field: 'can_view' | 'can_edit') => {
    if (!child.parent_key) return false;
    const parent = rolePermissions.find(p => p.permission_key === child.parent_key);
    return parent ? !parent[field] : false;
  };

  const openEditPermission = (permission: PagePermission & { parent_key?: string | null; permission_type?: PermissionType }) => {
    setEditingPermission({
      id: permission.id,
      role_key: permission.role_key,
      permission_key: permission.permission_key,
      parent_key: permission.parent_key || null,
      permission_type: (permission.permission_type as PermissionType) || 'page',
      can_view: permission.can_view,
      can_edit: permission.can_edit,
      description: permission.description || '',
    });
    setIsSheetOpen(true);
  };

  const handleSave = () => {
    if (!editingPermission) return;
    
    if (!editingPermission.permission_key.trim()) {
      toast.error('Nøgle er påkrævet');
      return;
    }

    if (editingPermission.id) {
      updateMutation.mutate(editingPermission);
    }
  };

  // Update row visibility directly on permission row
  const updateRowVisibility = async (permission: PermissionWithChildren, newVisibility: 'all' | 'team' | 'self') => {
    const { data, error } = await supabase
      .from('role_page_permissions')
      .update({ visibility: newVisibility })
      .eq('id', permission.id)
      .select();

    if (error) {
      console.error('Visibility update error:', error);
      toast.error(`Kunne ikke opdatere synlighed: ${error.message}`);
      return;
    }

    if (!data || data.length === 0) {
      console.error('No rows updated - RLS may be blocking');
      toast.error('Ingen rækker opdateret - kontroller rettigheder i databasen');
      return;
    }

    toast.success('Data-synlighed opdateret');
    queryClient.invalidateQueries({ queryKey: ['page-permissions'] });
  };

  if (permissionsLoading || rolesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }


  const selectedRoleData = roles.find(r => r.key === selectedRole);
  const rolePermissions = selectedRole ? (permissionsByRole[selectedRole] || []) : [];
  const hierarchy = getPermissionHierarchy(rolePermissions);

  // Get pages for parent dropdown
  const availablePages = rolePermissions
    .filter(p => p.permission_type === 'page' || !p.parent_key)
    .map(p => p.permission_key);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Rediger rettigheder
          </CardTitle>
          <CardDescription>
            Vælg en rolle for at redigere dens side-, fane- og handlingsrettigheder. Alle sider og faner oprettes automatisk fra kodebasen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 items-center">
            {roles.map((role) => (
              <div key={role.key} className="flex items-center gap-1">
                <Button
                  variant={selectedRole === role.key ? "default" : "outline"}
                  onClick={() => setSelectedRole(role.key)}
                  className="gap-2"
                >
                  <Badge className={colorMap[role.color || "gray"]} variant="secondary">
                    {role.label}
                  </Badge>
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              onClick={() => setIsCreateRoleOpen(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Opret rolle
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedRole && selectedRoleData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Badge className={colorMap[selectedRoleData.color || "gray"]}>
                    {selectedRoleData.label}
                  </Badge>
                  Rettigheder
                </CardTitle>
                <CardDescription className="mt-1">
                  {rolePermissions.length} rettigheder konfigureret (af {ALL_PERMISSION_KEYS.length} totalt)
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => seedPermissionsForRole(selectedRole)}
                  disabled={isSeeding}
                >
                  {isSeeding ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1" />
                  )}
                  Synkroniser alle
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleDeleteRoleClick(selectedRoleData)}
                >
                  Slet rolle
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isSeeding ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Opretter rettigheder...</p>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Nøgle</TableHead>
                    <TableHead>Beskrivelse</TableHead>
                    <TableHead className="text-center">Kan se</TableHead>
                    <TableHead className="text-center">Kan redigere</TableHead>
                    <TableHead className="text-center">
                      <span className="text-green-600">Alle</span>
                    </TableHead>
                    <TableHead className="text-center">
                      <span className="text-blue-600">Team</span>
                    </TableHead>
                    <TableHead className="text-center">
                      <span className="text-amber-600">Kun egen</span>
                    </TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Side-adgang sektion */}
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={9} className="font-semibold text-sm py-2">
                      SIDE-ADGANG
                    </TableCell>
                  </TableRow>
                  {hierarchy.map((page) => (
                    <PermissionRow 
                      key={page.id}
                      permission={page}
                      level={0}
                      rolePermissions={rolePermissions}
                      togglePermission={togglePermission}
                      isChildDisabled={isChildDisabled}
                      openEditPermission={openEditPermission}
                      updateRowVisibility={updateRowVisibility}
                    />
                  ))}
                  {hierarchy.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-4">
                        Ingen side-rettigheder konfigureret
                      </TableCell>
                    </TableRow>
                  )}
                  
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              Rediger rettighed
            </SheetTitle>
            <SheetDescription>
              Konfigurer side-, fane- eller handlingsrettighed
            </SheetDescription>
          </SheetHeader>

          {editingPermission && (
            <div className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={editingPermission.permission_type}
                  onValueChange={(v) => setEditingPermission({
                    ...editingPermission,
                    permission_type: v as PermissionType,
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="page">
                      <div className="flex items-center gap-2">
                        <Folder className="h-4 w-4" /> Side
                      </div>
                    </SelectItem>
                    <SelectItem value="tab">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" /> Fane
                      </div>
                    </SelectItem>
                    <SelectItem value="action">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4" /> Handling
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Rettigheds-nøgle</Label>
                <Input
                  value={editingPermission.permission_key}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Nøglen kan ikke ændres da den kommer fra kodebasen
                </p>
              </div>

              {editingPermission.permission_type !== 'page' && (
                <div className="space-y-2">
                  <Label>Tilhører side</Label>
                  <Select
                    value={editingPermission.parent_key || ''}
                    onValueChange={(v) => setEditingPermission({
                      ...editingPermission,
                      parent_key: v || null,
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vælg overordnet side" />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePages.map((key) => (
                        <SelectItem key={key} value={key}>
                          {permissionKeyLabels[key] || key}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Beskrivelse</Label>
                <Input
                  value={editingPermission.description}
                  onChange={(e) => setEditingPermission({
                    ...editingPermission,
                    description: e.target.value,
                  })}
                  placeholder="Beskrivelse af rettigheden"
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <Label>Kan se</Label>
                <Switch
                  checked={editingPermission.can_view}
                  onCheckedChange={(checked) => setEditingPermission({
                    ...editingPermission,
                    can_view: checked,
                  })}
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <Label>Kan redigere</Label>
                <Switch
                  checked={editingPermission.can_edit}
                  onCheckedChange={(checked) => setEditingPermission({
                    ...editingPermission,
                    can_edit: checked,
                  })}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={handleSave} 
                  disabled={updateMutation.isPending}
                  className="flex-1"
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Gem
                </Button>
                <Button variant="outline" onClick={() => setIsSheetOpen(false)}>
                  Annuller
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Create Role Dialog */}
      <Dialog open={isCreateRoleOpen} onOpenChange={setIsCreateRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Opret ny rolle</DialogTitle>
            <DialogDescription>
              Opret en ny systemrolle. Alle rettigheder oprettes automatisk.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nøgle *</Label>
                <Input
                  value={newRoleForm.key}
                  onChange={(e) => setNewRoleForm({ ...newRoleForm, key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  placeholder="f.eks. salgschef"
                />
                <p className="text-xs text-muted-foreground">Unik identifikator (ingen mellemrum)</p>
              </div>
              <div className="space-y-2">
                <Label>Navn *</Label>
                <Input
                  value={newRoleForm.label}
                  onChange={(e) => setNewRoleForm({ ...newRoleForm, label: e.target.value })}
                  placeholder="f.eks. Salgschef"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Beskrivelse</Label>
              <Input
                value={newRoleForm.description}
                onChange={(e) => setNewRoleForm({ ...newRoleForm, description: e.target.value })}
                placeholder="Kort beskrivelse af rollens ansvar"
              />
            </div>

            {/* Copy from existing role */}
            <div className="space-y-2">
              <Label>Kopier rettigheder fra</Label>
              <Select
                value={newRoleForm.copyFromRole || 'none'}
                onValueChange={(v) => setNewRoleForm({ 
                  ...newRoleForm, 
                  copyFromRole: v === 'none' ? null : v 
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Start fra bunden" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">Start fra bunden (alle slået fra)</span>
                  </SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role.key} value={role.key}>
                      <div className="flex items-center gap-2">
                        <Badge className={colorMap[role.color || "gray"]}>
                          {role.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          ({permissionsByRole[role.key]?.length || 0} rettigheder)
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Vælg en rolle at kopiere rettigheder fra, eller start fra bunden
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Farve</Label>
                <Select
                  value={newRoleForm.color}
                  onValueChange={(v) => setNewRoleForm({ ...newRoleForm, color: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_COLORS.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center gap-2">
                          <Badge className={color.class}>{color.label}</Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioritet</Label>
                <Input
                  type="number"
                  value={newRoleForm.priority}
                  onChange={(e) => setNewRoleForm({ ...newRoleForm, priority: parseInt(e.target.value) || 100 })}
                  placeholder="100"
                />
                <p className="text-xs text-muted-foreground">Højere = mere adgang</p>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateRoleOpen(false)}>
              Annuller
            </Button>
            <Button 
              onClick={handleCreateRole}
              disabled={createRoleMutation.isPending}
            >
              {createRoleMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Opret rolle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Role Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Slet rolle: {roleToDelete?.label}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Er du sikker på, at du vil slette denne rolle? Dette vil:</p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>Slette alle {permissionsByRole[roleToDelete?.key || '']?.length || 0} rettigheder for rollen</li>
                  <li>Fjerne rollen fra alle tilknyttede stillinger</li>
                </ul>
                {linkedPositions.length > 0 && (
                  <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950 rounded-md">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Følgende stillinger er tilknyttet denne rolle:
                    </p>
                    <ul className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                      {linkedPositions.map((pos, i) => (
                        <li key={i}>• {pos}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => roleToDelete && deleteRoleMutation.mutate(roleToDelete.key)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteRoleMutation.isPending}
            >
              {deleteRoleMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Slet rolle
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}