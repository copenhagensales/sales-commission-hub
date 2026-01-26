import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
  Lock,
  Search,
  Check,
  X,
  Home,
  Users,
  Crown,
  Calendar,
  Briefcase,
  BarChart3,
  GraduationCap,
  FileBarChart,
  Wrench,
  Video,
  ShoppingCart,
  Phone
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
import { cn } from "@/lib/utils";
import { PermissionRowWithChildren } from "./PermissionRowWithChildren";
import { buildCategoryTree } from "./permissionGroups";

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

// Category definitions with icons and labels
const PERMISSION_CATEGORIES: Record<string, { label: string; icon: React.ReactNode; keys: string[] }> = {
  menu_section_personal: {
    label: "Mit Hjem",
    icon: <Home className="h-4 w-4" />,
    keys: ['menu_home', 'menu_h2h', 'menu_commission_league', 'menu_league_admin', 'menu_liga_test_board', 'menu_h2h_admin', 'menu_team_h2h', 'menu_messages', 'menu_my_schedule', 'menu_my_profile', 'menu_my_goals', 'menu_my_contracts', 'menu_career_wishes', 'menu_my_feedback', 'menu_refer_friend', 'menu_my_sales', 'menu_my_shifts', 'menu_my_absence', 'menu_my_coaching']
  },
  menu_section_personale: {
    label: "Personale",
    icon: <Users className="h-4 w-4" />,
    keys: ['menu_dashboard', 'menu_employees', 'menu_teams', 'menu_permissions', 'menu_login_log', 'menu_upcoming_starts', 'tab_employees_all', 'tab_employees_staff', 'tab_employees_teams', 'tab_employees_positions', 'tab_employees_permissions', 'tab_employees_dialer_mapping']
  },
  menu_section_ledelse: {
    label: "Ledelse",
    icon: <Crown className="h-4 w-4" />,
    keys: ['menu_company_overview', 'menu_contracts', 'menu_career_wishes_overview', 'menu_email_templates_ledelse', 'menu_security_dashboard']
  },
  menu_section_vagtplan: {
    label: "Vagtplan",
    icon: <Calendar className="h-4 w-4" />,
    keys: ['menu_shift_overview', 'menu_absence', 'menu_time_tracking', 'menu_time_stamp', 'menu_closing_shifts']
  },
  menu_section_fieldmarketing: {
    label: "Fieldmarketing",
    icon: <Briefcase className="h-4 w-4" />,
    keys: ['menu_fm_overview', 'menu_fm_booking', 'menu_fm_vehicles', 'menu_fm_dashboard', 'menu_fm_sales_registration', 'menu_fm_billing', 'menu_fm_travel_expenses', 'menu_fm_edit_sales', 'menu_fm_time_off', 'menu_fm_book_week', 'menu_fm_bookings', 'menu_fm_locations', 'menu_fm_vagtplan_fm', 'tab_fm_book_week', 'tab_fm_bookings', 'tab_fm_locations', 'tab_fm_vagtplan', 'tab_fm_eesy', 'tab_fm_yousee']
  },
  menu_section_mg: {
    label: "MG",
    icon: <BarChart3 className="h-4 w-4" />,
    keys: ['menu_team_overview', 'menu_tdc_erhverv', 'menu_tdc_erhverv_dashboard', 'menu_tdc_opsummering', 'menu_relatel_dashboard', 'menu_tryg_dashboard', 'menu_ase_dashboard', 'menu_codan', 'menu_mg_test', 'menu_mg_test_dashboard', 'menu_dialer_data', 'menu_calls_data', 'menu_adversus_data', 'tab_mg_salary_schemes', 'tab_mg_relatel_status', 'tab_mg_relatel_events']
  },
  menu_section_rekruttering: {
    label: "Rekruttering",
    icon: <Users className="h-4 w-4" />,
    keys: ['menu_recruitment_dashboard', 'menu_candidates', 'menu_upcoming_interviews', 'menu_winback', 'menu_upcoming_hires', 'menu_messages_recruitment', 'menu_sms_templates', 'menu_email_templates_recruitment', 'menu_referrals', 'tab_winback_ghostet', 'tab_winback_takket_nej', 'tab_winback_kundeservice']
  },
  menu_section_dashboards: {
    label: "Dashboards",
    icon: <BarChart3 className="h-4 w-4" />,
    keys: ['menu_dashboard_cph_sales', 'menu_dashboard_cs_top_20', 'menu_dashboard_fieldmarketing', 'menu_dashboard_eesy_tm', 'menu_dashboard_tdc_erhverv', 'menu_dashboard_relatel', 'menu_dashboard_mg_test', 'menu_dashboard_united', 'menu_dashboard_design', 'menu_dashboard_settings']
  },
  menu_section_onboarding: {
    label: "Onboarding",
    icon: <GraduationCap className="h-4 w-4" />,
    keys: ['menu_onboarding_overview', 'menu_onboarding_kursus', 'menu_onboarding_ramp', 'menu_onboarding_leader', 'menu_onboarding_drills', 'menu_onboarding_admin', 'menu_coaching_templates', 'tab_onboarding_overview', 'tab_onboarding_ramp', 'tab_onboarding_leader', 'tab_onboarding_drills', 'tab_onboarding_template', 'tab_onboarding_admin']
  },
  menu_section_reports: {
    label: "Rapporter",
    icon: <FileBarChart className="h-4 w-4" />,
    keys: ['menu_reports_admin', 'menu_reports_daily', 'menu_reports_management', 'menu_reports_employee']
  },
  menu_section_some: {
    label: "SOME",
    icon: <Video className="h-4 w-4" />,
    keys: ['menu_some', 'menu_extra_work']
  },
  menu_section_sales_system: {
    label: "Salg & System",
    icon: <ShoppingCart className="h-4 w-4" />,
    keys: ['menu_sales', 'menu_logics', 'menu_live_stats', 'menu_settings', 'menu_leaderboard']
  },
  menu_section_salary: {
    label: "Løn",
    icon: <Briefcase className="h-4 w-4" />,
    keys: ['menu_payroll', 'menu_salary_types']
  },
  menu_section_admin: {
    label: "Admin",
    icon: <Wrench className="h-4 w-4" />,
    keys: ['menu_kpi_definitions']
  },
  menu_section_test: {
    label: "Test",
    icon: <Wrench className="h-4 w-4" />,
    keys: ['menu_car_quiz_admin', 'menu_coc_admin', 'menu_pulse_survey']
  },
  softphone_section: {
    label: "Softphone & SMS",
    icon: <Phone className="h-4 w-4" />,
    keys: ['softphone_outbound', 'softphone_inbound', 'employee_sms']
  },
  messages_section: {
    label: "Beskeder",
    icon: <FileText className="h-4 w-4" />,
    keys: ['tab_messages_all', 'tab_messages_sms', 'tab_messages_email', 'tab_messages_call', 'tab_messages_sent']
  }
};

// ===== PERMISSION HIERARCHY =====
const PERMISSION_HIERARCHY: Record<string, string | null> = {
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
  menu_section_sales_system: null,
  menu_section_spil: null,
};

const getPermissionTypeFromKey = (key: string): PermissionType => {
  if (key.startsWith('tab_')) return 'tab';
  if (key.startsWith('action_')) return 'action';
  return 'page';
};

const ALL_PERMISSION_KEYS = Object.keys(permissionKeyLabels);

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

export function PermissionEditorV2() {
  const queryClient = useQueryClient();
  const { data: permissions = [], isLoading: permissionsLoading } = usePagePermissions();
  const { data: roles = [], isLoading: rolesLoading } = useRoleDefinitions();
  
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [editingPermission, setEditingPermission] = useState<EditingPermission | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openCategories, setOpenCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  
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

  const extendedPermissions = permissions as (PagePermission & { 
    parent_key?: string | null; 
    permission_type?: PermissionType;
  })[];

  const permissionsByRole = extendedPermissions.reduce((acc, p) => {
    if (!acc[p.role_key]) acc[p.role_key] = [];
    acc[p.role_key].push(p);
    return acc;
  }, {} as Record<string, typeof extendedPermissions>);

  const rolePermissions = selectedRole ? (permissionsByRole[selectedRole] || []) : [];

  // Category stats for the current role
  const categoryStats = useMemo(() => {
    const stats: Record<string, { total: number; enabled: number }> = {};
    Object.entries(PERMISSION_CATEGORIES).forEach(([catKey, cat]) => {
      const catPermissions = rolePermissions.filter(p => cat.keys.includes(p.permission_key));
      stats[catKey] = {
        total: cat.keys.length,
        enabled: catPermissions.filter(p => p.can_view).length
      };
    });
    return stats;
  }, [rolePermissions]);

  // Filtered permissions based on search
  const filteredPermissions = useMemo(() => {
    if (!searchQuery.trim()) return rolePermissions;
    const query = searchQuery.toLowerCase();
    return rolePermissions.filter(p => {
      const label = permissionKeyLabels[p.permission_key] || p.permission_key;
      return label.toLowerCase().includes(query) || p.permission_key.toLowerCase().includes(query);
    });
  }, [rolePermissions, searchQuery]);

  // Seed permissions for role
  const seedPermissionsForRole = async (roleKey: string) => {
    setIsSeeding(true);
    try {
      const existingKeys = permissionsByRole[roleKey]?.map(p => p.permission_key) || [];
      const missingKeys = ALL_PERMISSION_KEYS.filter(key => !existingKeys.includes(key));
      
      if (missingKeys.length === 0) {
        toast.info('Alle rettigheder er allerede oprettet');
        setIsSeeding(false);
        return;
      }
      
      const isOwner = roleKey === 'ejer';
      const isTeamleder = roleKey === 'teamleder';
      
      const newPermissions = missingKeys.map(key => ({
        role_key: roleKey,
        permission_key: key,
        parent_key: PERMISSION_HIERARCHY[key] || null,
        permission_type: getPermissionTypeFromKey(key),
        can_view: isOwner,
        can_edit: isOwner,
        visibility: isOwner ? 'all' : (isTeamleder ? 'team' : 'self'),
        description: null,
      }));
      
      const BATCH_SIZE = 50;
      for (let i = 0; i < newPermissions.length; i += BATCH_SIZE) {
        const batch = newPermissions.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('role_page_permissions')
          .upsert(batch, { onConflict: 'role_key,permission_key', ignoreDuplicates: true });
        
        if (error) throw error;
      }
      
      toast.success(`${missingKeys.length} rettigheder oprettet`);
      queryClient.invalidateQueries({ queryKey: ['page-permissions'] });
    } catch (error: any) {
      toast.error('Kunne ikke oprette rettigheder: ' + error.message);
    } finally {
      setIsSeeding(false);
    }
  };

  // Copy permissions from role
  const copyPermissionsFromRole = async (newRoleKey: string, sourceRoleKey: string) => {
    setIsSeeding(true);
    try {
      const sourcePermissions = permissionsByRole[sourceRoleKey] || [];
      
      if (sourcePermissions.length === 0) {
        toast.info('Kilderollen har ingen rettigheder');
        setIsSeeding(false);
        await seedPermissionsForRole(newRoleKey);
        return;
      }
      
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
      
      const BATCH_SIZE = 50;
      for (let i = 0; i < newPermissions.length; i += BATCH_SIZE) {
        const batch = newPermissions.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('role_page_permissions')
          .insert(batch);
        if (error) throw error;
      }
      
      toast.success(`${newPermissions.length} rettigheder kopieret`);
      queryClient.invalidateQueries({ queryKey: ['page-permissions'] });
    } catch (error: any) {
      toast.error('Kunne ikke kopiere rettigheder: ' + error.message);
    } finally {
      setIsSeeding(false);
    }
  };

  // Auto-seed when selecting role with no permissions
  useEffect(() => {
    if (selectedRole && !permissionsLoading) {
      const rolePermissionCount = permissionsByRole[selectedRole]?.length || 0;
      if (rolePermissionCount === 0) {
        seedPermissionsForRole(selectedRole);
      }
    }
  }, [selectedRole, permissionsLoading]);

  // Toggle single permission
  const togglePermission = async (permission: PagePermission & { parent_key?: string | null; permission_type?: PermissionType }, field: 'can_view' | 'can_edit') => {
    const newValue = !permission[field];
    const updateData: Record<string, boolean | string> = { [field]: newValue };
    
    if (field === 'can_view' && !newValue) {
      updateData.can_edit = false;
      updateData.visibility = 'self';
    }
    
    const { data, error } = await supabase
      .from('role_page_permissions')
      .update(updateData)
      .eq('id', permission.id)
      .select();
    
    if (error) {
      toast.error(`Kunne ikke opdatere: ${error.message}`);
      return;
    }
    
    if (!data || data.length === 0) {
      toast.error('Ingen rækker opdateret');
      return;
    }
    
    queryClient.invalidateQueries({ queryKey: ['page-permissions'] });
  };

  // Toggle all permissions in a category
  const toggleCategoryAll = async (categoryKey: string, enable: boolean) => {
    const category = PERMISSION_CATEGORIES[categoryKey];
    if (!category) return;
    
    const categoryPermissions = rolePermissions.filter(p => category.keys.includes(p.permission_key));
    if (categoryPermissions.length === 0) return;
    
    const ids = categoryPermissions.map(p => p.id);
    
    const { error } = await supabase
      .from('role_page_permissions')
      .update({ 
        can_view: enable,
        can_edit: enable,
        visibility: enable ? 'all' : 'self'
      })
      .in('id', ids);
    
    if (error) {
      toast.error(`Kunne ikke opdatere: ${error.message}`);
      return;
    }
    
    toast.success(`${enable ? 'Aktiverede' : 'Deaktiverede'} ${categoryPermissions.length} rettigheder`);
    queryClient.invalidateQueries({ queryKey: ['page-permissions'] });
  };

  // Toggle parent permission with all its children
  const toggleParentWithChildren = async (
    parent: PagePermission & { parent_key?: string | null; permission_type?: PermissionType },
    children: (PagePermission & { parent_key?: string | null; permission_type?: PermissionType })[],
    field: 'can_view' | 'can_edit',
    newValue: boolean
  ) => {
    const updateData: Record<string, boolean | string> = { [field]: newValue };
    
    // If turning off can_view, also turn off can_edit and reset visibility
    if (field === 'can_view' && !newValue) {
      updateData.can_edit = false;
      updateData.visibility = 'self';
    }
    
    // Collect all IDs to update (parent + children)
    const allIds = [parent.id, ...children.map(c => c.id)];
    
    const { error } = await supabase
      .from('role_page_permissions')
      .update(updateData)
      .in('id', allIds);
    
    if (error) {
      toast.error(`Kunne ikke opdatere: ${error.message}`);
      return;
    }
    
    const count = allIds.length;
    toast.success(`${field === 'can_view' ? (newValue ? 'Aktiverede' : 'Deaktiverede') : (newValue ? 'Gav redigeringsadgang til' : 'Fjernede redigeringsadgang fra')} ${count} rettigheder`);
    queryClient.invalidateQueries({ queryKey: ['page-permissions'] });
  };

  // Update visibility
  const updateRowVisibility = async (permission: PermissionWithChildren, newVisibility: 'all' | 'team' | 'self') => {
    const { error } = await supabase
      .from('role_page_permissions')
      .update({ visibility: newVisibility })
      .eq('id', permission.id);

    if (error) {
      toast.error(`Kunne ikke opdatere: ${error.message}`);
      return;
    }

    toast.success('Synlighed opdateret');
    queryClient.invalidateQueries({ queryKey: ['page-permissions'] });
  };

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
      const { error: permError } = await supabase
        .from('role_page_permissions')
        .delete()
        .eq('role_key', roleKey);
      
      if (permError) throw permError;
      
      const { error: posError } = await supabase
        .from('job_positions')
        .update({ system_role_key: null })
        .eq('system_role_key', roleKey);
      
      if (posError) throw posError;
      
      const { error } = await supabase
        .from('system_role_definitions')
        .delete()
        .eq('key', roleKey);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-definitions'] });
      queryClient.invalidateQueries({ queryKey: ['page-permissions'] });
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
    if (roles.some(r => r.key === newRoleForm.key)) {
      toast.error('En rolle med denne nøgle eksisterer allerede');
      return;
    }
    createRoleMutation.mutate(newRoleForm);
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

  const updateMutation = useMutation({
    mutationFn: async (permission: EditingPermission) => {
      const { error } = await supabase
        .from('role_page_permissions')
        .update({
          can_view: permission.can_view,
          can_edit: permission.can_edit,
          description: permission.description,
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
      toast.error('Kunne ikke opdatere: ' + error.message);
    },
  });

  const handleSave = () => {
    if (!editingPermission) return;
    updateMutation.mutate(editingPermission);
  };

  if (permissionsLoading || rolesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedRoleData = roles.find(r => r.key === selectedRole);

  return (
    <div className="space-y-6">
      {/* Role Selection Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings2 className="h-5 w-5" />
            Rediger rettigheder
          </CardTitle>
          <CardDescription>
            Vælg en rolle og konfigurer dens adgang til sider, faner og handlinger.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 items-center">
            {roles.map((role) => (
              <Button
                key={role.key}
                variant={selectedRole === role.key ? "default" : "outline"}
                onClick={() => setSelectedRole(role.key)}
                size="sm"
              >
                <Badge className={cn(colorMap[role.color || "gray"], "mr-1")} variant="secondary">
                  {role.label}
                </Badge>
              </Button>
            ))}
            <Button
              variant="outline"
              onClick={() => setIsCreateRoleOpen(true)}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Opret rolle
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Permission Editor */}
      {selectedRole && selectedRoleData && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Sticky Category Sidebar */}
          <div className="lg:col-span-1">
            <Card className="lg:sticky lg:top-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Kategorier</CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-1">
                    {Object.entries(PERMISSION_CATEGORIES).map(([key, cat]) => {
                      const stats = categoryStats[key];
                      const isActive = activeCategory === key;
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            setActiveCategory(key);
                            setOpenCategories(prev => 
                              prev.includes(key) ? prev : [...prev, key]
                            );
                          }}
                          className={cn(
                            "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors",
                            isActive ? "bg-primary/10 text-primary" : "hover:bg-muted"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            {cat.icon}
                            <span>{cat.label}</span>
                          </div>
                          <Badge variant={stats?.enabled > 0 ? "default" : "secondary"} className="text-xs">
                            {stats?.enabled || 0}/{stats?.total || cat.keys.length}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Badge className={colorMap[selectedRoleData.color || "gray"]}>
                        {selectedRoleData.label}
                      </Badge>
                      <span className="text-sm font-normal text-muted-foreground">
                        {rolePermissions.filter(p => p.can_view).length} af {rolePermissions.length} aktive
                      </span>
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => seedPermissionsForRole(selectedRole)}
                      disabled={isSeeding}
                    >
                      {isSeeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      <span className="ml-1 hidden sm:inline">Synkroniser</span>
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
                
                {/* Search */}
                <div className="relative mt-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Søg efter rettighed..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                      onClick={() => setSearchQuery("")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="p-0">
                {isSeeding ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Opretter rettigheder...</p>
                    </div>
                  </div>
                ) : searchQuery ? (
                  /* Search Results */
                  <div className="p-4">
                    <p className="text-sm text-muted-foreground mb-3">
                      {filteredPermissions.length} resultater for "{searchQuery}"
                    </p>
                    <div className="space-y-1">
                      {filteredPermissions.map((permission) => (
                        <PermissionRowCompact
                          key={permission.id}
                          permission={permission}
                          togglePermission={togglePermission}
                          updateRowVisibility={updateRowVisibility}
                          openEditPermission={openEditPermission}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Accordion Categories */
                  <Accordion
                    type="multiple"
                    value={openCategories}
                    onValueChange={setOpenCategories}
                    className="w-full"
                  >
                    {Object.entries(PERMISSION_CATEGORIES).map(([catKey, cat]) => {
                      const categoryPermissions = rolePermissions.filter(p => cat.keys.includes(p.permission_key));
                      const stats = categoryStats[catKey];
                      
                      return (
                        <AccordionItem key={catKey} value={catKey} className="border-b">
                          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
                            <div className="flex items-center justify-between w-full pr-4">
                              <div className="flex items-center gap-2">
                                {cat.icon}
                                <span className="font-medium">{cat.label}</span>
                                <Badge variant={stats?.enabled > 0 ? "default" : "secondary"} className="text-xs ml-2">
                                  {stats?.enabled || 0}/{stats?.total || cat.keys.length}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => toggleCategoryAll(catKey, true)}
                                >
                                  <Check className="h-3 w-3 mr-1" />
                                  Alle
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => toggleCategoryAll(catKey, false)}
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Ingen
                                </Button>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4">
                            <div className="space-y-1">
                              {categoryPermissions.length > 0 ? (
                                (() => {
                                  const { groups, standalone } = buildCategoryTree(categoryPermissions);
                                  return (
                                    <>
                                      {/* Render hierarchical groups */}
                                      {groups.map((group) => (
                                        <PermissionRowWithChildren
                                          key={group.parent.id}
                                          parent={group.parent}
                                          children={group.children}
                                          groupLabel={group.groupLabel}
                                          togglePermission={togglePermission}
                                          updateRowVisibility={updateRowVisibility}
                                          openEditPermission={openEditPermission}
                                          toggleParentWithChildren={toggleParentWithChildren}
                                        />
                                      ))}
                                      {/* Render standalone permissions */}
                                      {standalone.map((permission) => (
                                        <PermissionRowCompact
                                          key={permission.id}
                                          permission={permission}
                                          togglePermission={togglePermission}
                                          updateRowVisibility={updateRowVisibility}
                                          openEditPermission={openEditPermission}
                                        />
                                      ))}
                                    </>
                                  );
                                })()
                              ) : (
                                <p className="text-sm text-muted-foreground py-2">
                                  Ingen rettigheder i denne kategori. Klik "Synkroniser" for at oprette.
                                </p>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Edit Permission Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Rediger rettighed</SheetTitle>
            <SheetDescription>
              Konfigurer rettigheden
            </SheetDescription>
          </SheetHeader>

          {editingPermission && (
            <div className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label>Rettigheds-nøgle</Label>
                <Input
                  value={permissionKeyLabels[editingPermission.permission_key] || editingPermission.permission_key}
                  disabled
                  className="bg-muted"
                />
              </div>

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
              Opret en ny systemrolle.
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
              <Label>Kopier fra</Label>
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
                  <SelectItem value="none">Start fra bunden</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role.key} value={role.key}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                      <Badge className={color.class}>{color.label}</Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              {createRoleMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Opret
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
                <p>Er du sikker?</p>
                {linkedPositions.length > 0 && (
                  <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-950 rounded-md">
                    <p className="text-sm font-medium">Tilknyttede stillinger:</p>
                    <ul className="mt-1 text-sm">
                      {linkedPositions.map((pos, i) => <li key={i}>• {pos}</li>)}
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
              {deleteRoleMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Slet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Compact permission row component
interface PermissionRowCompactProps {
  permission: PagePermission & { parent_key?: string | null; permission_type?: PermissionType; visibility?: string };
  togglePermission: (permission: any, field: 'can_view' | 'can_edit') => void;
  updateRowVisibility: (permission: any, visibility: 'all' | 'team' | 'self') => void;
  openEditPermission: (permission: any) => void;
}

function PermissionRowCompact({ permission, togglePermission, updateRowVisibility, openEditPermission }: PermissionRowCompactProps) {
  const label = permissionKeyLabels[permission.permission_key] || permission.permission_key;
  const type = permission.permission_type || getPermissionTypeFromKey(permission.permission_key);
  
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 border-b border-border/50 last:border-b-0">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {permissionTypeIcons[type]}
        <span className="text-sm truncate">{label}</span>
        <Badge variant="outline" className="text-xs shrink-0">
          {permissionTypeLabelsUI[type]}
        </Badge>
      </div>
      
      <div className="flex items-center gap-3 shrink-0">
        {/* Can View */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground hidden sm:block">Se</span>
          <Switch
            checked={permission.can_view}
            onCheckedChange={() => togglePermission(permission, 'can_view')}
            className="scale-90"
          />
        </div>
        
        {/* Can Edit */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground hidden sm:block">Ret</span>
          <Switch
            checked={permission.can_edit}
            onCheckedChange={() => togglePermission(permission, 'can_edit')}
            disabled={!permission.can_view}
            className="scale-90"
          />
        </div>
        
        {/* Visibility */}
        <Select
          value={permission.visibility || 'self'}
          onValueChange={(v) => updateRowVisibility(permission, v as 'all' | 'team' | 'self')}
          disabled={!permission.can_view}
        >
          <SelectTrigger className="w-20 h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="team">Team</SelectItem>
            <SelectItem value="self">Egen</SelectItem>
          </SelectContent>
        </Select>
        
        {/* Edit Button */}
        <Button 
          variant="ghost" 
          size="icon"
          className="h-7 w-7"
          onClick={() => openEditPermission(permission)}
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
