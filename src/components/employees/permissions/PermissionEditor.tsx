import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Plus, 
  Trash2, 
  Settings2, 
  Save,
  ChevronRight,
  Folder,
  FileText,
  Zap,
  Loader2,
  AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { 
  usePagePermissions, 
  useRoleDefinitions,
  useDataVisibilityRules,
  permissionKeyLabels,
  dataScopeLabels,
  visibilityLabels,
  type PagePermission,
  type RoleDefinition,
  type Visibility,
  type DataVisibilityRule
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

const permissionTypeLabels: Record<PermissionType, string> = {
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
  children?: PermissionWithChildren[];
}

interface PermissionRowProps {
  permission: PermissionWithChildren;
  level: number;
  rolePermissions: PermissionWithChildren[];
  togglePermission: (permission: PermissionWithChildren, field: 'can_view' | 'can_edit') => void;
  isChildDisabled: (child: PermissionWithChildren, field: 'can_view' | 'can_edit') => boolean;
  openEditPermission: (permission: PermissionWithChildren) => void;
  openNewPermission: (parentKey: string) => void;
  deleteMutation: { mutate: (id: string) => void };
}

function PermissionRow({
  permission,
  level,
  rolePermissions,
  togglePermission,
  isChildDisabled,
  openEditPermission,
  openNewPermission,
  deleteMutation
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
              {permissionTypeLabels[permission.permission_type || 'page']}
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
          <div className="flex items-center justify-center" title={disabled ? 'Slået fra - forælder er deaktiveret' : undefined}>
            <Switch
              checked={permission.can_edit}
              disabled={isChildDisabled(permission, 'can_edit')}
              onCheckedChange={() => togglePermission(permission, 'can_edit')}
              className={isChildDisabled(permission, 'can_edit') ? 'opacity-50' : ''}
            />
          </div>
        </TableCell>
        {/* Empty cells for visibility columns (only applicable for data visibility rows) */}
        <TableCell className="text-center">
          <div className="flex items-center justify-center opacity-30">
            <Switch disabled checked={false} />
          </div>
        </TableCell>
        <TableCell className="text-center">
          <div className="flex items-center justify-center opacity-30">
            <Switch disabled checked={false} />
          </div>
        </TableCell>
        <TableCell className="text-center">
          <div className="flex items-center justify-center opacity-30">
            <Switch disabled checked={false} />
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
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => openNewPermission(permission.permission_key)}
              title="Tilføj fane/handling"
            >
              <Plus className="h-4 w-4" />
            </Button>
            {level > 0 && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => {
                  if (confirm('Er du sikker?')) {
                    deleteMutation.mutate(permission.id);
                  }
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
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
          openNewPermission={openNewPermission}
          deleteMutation={deleteMutation}
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
}

const ROLE_COLORS = [
  { value: 'primary', label: 'Primær', class: 'bg-primary text-primary-foreground' },
  { value: 'blue', label: 'Blå', class: 'bg-blue-500 text-white' },
  { value: 'amber', label: 'Gul', class: 'bg-amber-500 text-white' },
  { value: 'purple', label: 'Lilla', class: 'bg-purple-500 text-white' },
  { value: 'muted', label: 'Grå', class: 'bg-muted text-muted-foreground' },
];

// Data scopes with descriptions for UI
const DATA_SCOPES = [
  { key: 'employees', label: 'Medarbejdere', description: 'Medarbejderdata og profiler' },
  { key: 'sales', label: 'Salg', description: 'Salgsdata og statistik' },
  { key: 'shifts', label: 'Vagter', description: 'Vagtplaner og timer' },
  { key: 'absences', label: 'Fravær', description: 'Fraværsregistreringer' },
  { key: 'coaching', label: 'Coaching', description: 'Coaching sessioner og feedback' },
  { key: 'contracts', label: 'Kontrakter', description: 'Kontraktinformation' },
  { key: 'payroll', label: 'Løn', description: 'Løndata og udbetalinger' },
  { key: 'leaderboard_ranking', label: 'Leaderboard', description: 'Rangering på leaderboards' },
  { key: 'sales_count_others', label: 'Andres salgstal', description: 'Se antal salg for andre medarbejdere' },
  { key: 'commission_details', label: 'Provisionsdetaljer', description: 'Detaljeret provisionsberegning' },
  { key: 'salary_breakdown', label: 'Lønspecifikation', description: 'Detaljeret lønspecifikation' },
  { key: 'h2h_stats', label: 'Head-to-Head', description: 'H2H statistik mod andre' },
  { key: 'employee_performance', label: 'Performance', description: 'Performancerapporter' },
];

const visibilityColors: Record<Visibility, string> = {
  all: "bg-green-100 text-green-700 border-green-300",
  team: "bg-blue-100 text-blue-700 border-blue-300",
  self: "bg-amber-100 text-amber-700 border-amber-300",
  none: "bg-red-100 text-red-700 border-red-300",
};

export function PermissionEditor() {
  const queryClient = useQueryClient();
  const { data: permissions = [], isLoading: permissionsLoading } = usePagePermissions();
  const { data: roles = [], isLoading: rolesLoading } = useRoleDefinitions();
  const { data: visibilityRules = [], isLoading: visibilityLoading } = useDataVisibilityRules();
  
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [editingPermission, setEditingPermission] = useState<EditingPermission | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  
  // Create role state
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
  const [newRoleForm, setNewRoleForm] = useState<NewRoleForm>({
    key: '',
    label: '',
    description: '',
    color: 'muted',
    icon: 'user',
    priority: 100,
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

  // Create permission mutation
  const createMutation = useMutation({
    mutationFn: async (permission: EditingPermission) => {
      const { error } = await supabase
        .from('role_page_permissions')
        .insert({
          role_key: permission.role_key,
          permission_key: permission.permission_key,
          parent_key: permission.parent_key,
          permission_type: permission.permission_type,
          can_view: permission.can_view,
          can_edit: permission.can_edit,
          description: permission.description,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-permissions'] });
      toast.success('Rettighed oprettet');
      setIsSheetOpen(false);
      setEditingPermission(null);
    },
    onError: (error) => {
      toast.error('Kunne ikke oprette rettighed: ' + error.message);
    },
  });

  // Delete permission mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('role_page_permissions')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-permissions'] });
      toast.success('Rettighed slettet');
    },
    onError: (error) => {
      toast.error('Kunne ikke slette rettighed: ' + error.message);
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
    },
    onSuccess: () => {
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
      });
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
      
      // Delete data visibility rules
      const { error: visError } = await supabase
        .from('data_visibility_rules')
        .delete()
        .eq('role_key', roleKey);
      
      if (visError) throw visError;
      
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
    
    console.log('togglePermission called:', {
      permissionId: permission.id,
      permissionKey: permission.permission_key,
      field,
      currentValue: permission[field],
      newValue,
    });
    
    // Update the permission itself
    const { data, error, status, statusText } = await supabase
      .from('role_page_permissions')
      .update({ [field]: newValue })
      .eq('id', permission.id)
      .select();
    
    console.log('Supabase update response:', { data, error, status, statusText, rowsAffected: data?.length });
    
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

  const openNewPermission = (roleKey: string, parentKey?: string) => {
    setEditingPermission({
      role_key: roleKey,
      permission_key: '',
      parent_key: parentKey || null,
      permission_type: parentKey ? 'tab' : 'page',
      can_view: true,
      can_edit: false,
      description: '',
    });
    setIsSheetOpen(true);
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
    } else {
      createMutation.mutate(editingPermission);
    }
  };

  if (permissionsLoading || rolesLoading || visibilityLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Helper to get current visibility for a role and scope
  const getVisibilityForRole = (roleKey: string, scope: string): Visibility => {
    const rule = visibilityRules.find(
      r => r.role_key === roleKey && r.data_scope === scope
    );
    return (rule?.visibility as Visibility) || 'none';
  };

  // Update visibility mutation
  const updateVisibility = async (roleKey: string, scope: string, visibility: Visibility) => {
    console.log('updateVisibility called:', { roleKey, scope, visibility });
    
    const existing = visibilityRules.find(
      r => r.role_key === roleKey && r.data_scope === scope
    );

    try {
      if (existing) {
        console.log('Updating existing rule:', existing.id);
        const { data, error } = await supabase
          .from('data_visibility_rules')
          .update({ visibility })
          .eq('id', existing.id)
          .select();
        
        console.log('Update result:', { data, error, rowsAffected: data?.length });
        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error('Ingen rækker opdateret - RLS blokerer muligvis');
        }
      } else {
        console.log('Creating new rule');
        const scopeData = DATA_SCOPES.find(s => s.key === scope);
        const { error } = await supabase
          .from('data_visibility_rules')
          .insert({
            role_key: roleKey,
            data_scope: scope,
            visibility,
            description: scopeData?.description || scope,
          });
        if (error) throw error;
      }
      
      queryClient.invalidateQueries({ queryKey: ['data-visibility-rules'] });
      toast.success('Synlighed opdateret');
    } catch (error: any) {
      console.error('Visibility update error:', error);
      toast.error('Kunne ikke opdatere synlighed: ' + error.message);
    }
  };

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
            Vælg en rolle for at redigere dens side-, fane- og handlingsrettigheder
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleDeleteRoleClick(role)}
                  title="Slet rolle"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
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
                  {hierarchy.length} sider konfigureret
                </CardDescription>
              </div>
              <Button onClick={() => openNewPermission(selectedRole)} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Tilføj side
              </Button>
            </div>
          </CardHeader>
          <CardContent>
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
                  <TableHead className="w-24"></TableHead>
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
                    openNewPermission={(parentKey) => openNewPermission(selectedRole, parentKey)}
                    deleteMutation={deleteMutation}
                  />
                ))}
                {hierarchy.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-4">
                      Ingen side-rettigheder konfigureret
                    </TableCell>
                  </TableRow>
                )}
                
                {/* Data-synlighed sektion */}
                <TableRow className="bg-muted/50">
                  <TableCell colSpan={9} className="font-semibold text-sm py-2">
                    DATA-SYNLIGHED
                  </TableCell>
                </TableRow>
                {DATA_SCOPES.map((scope) => {
                  const currentVisibility = getVisibilityForRole(selectedRole, scope.key);
                  return (
                    <TableRow key={scope.key}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Data</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {scope.label}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {scope.description}
                      </TableCell>
                      {/* Kan se / Kan redigere - disabled for data visibility */}
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center opacity-30">
                          <Switch disabled checked={false} />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center opacity-30">
                          <Switch disabled checked={false} />
                        </div>
                      </TableCell>
                      {/* Visibility columns */}
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center">
                          <Switch
                            checked={currentVisibility === 'all'}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                updateVisibility(selectedRole, scope.key, 'all');
                              } else if (currentVisibility === 'all') {
                                updateVisibility(selectedRole, scope.key, 'none');
                              }
                            }}
                            className="data-[state=checked]:bg-green-500"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center">
                          <Switch
                            checked={currentVisibility === 'team'}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                updateVisibility(selectedRole, scope.key, 'team');
                              } else if (currentVisibility === 'team') {
                                updateVisibility(selectedRole, scope.key, 'none');
                              }
                            }}
                            className="data-[state=checked]:bg-blue-500"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center">
                          <Switch
                            checked={currentVisibility === 'self'}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                updateVisibility(selectedRole, scope.key, 'self');
                              } else if (currentVisibility === 'self') {
                                updateVisibility(selectedRole, scope.key, 'none');
                              }
                            }}
                            className="data-[state=checked]:bg-amber-500"
                          />
                        </div>
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Data Visibility Section removed - integrated into main table above */}

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {editingPermission?.id ? 'Rediger rettighed' : 'Opret rettighed'}
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
                  onChange={(e) => setEditingPermission({
                    ...editingPermission,
                    permission_key: e.target.value,
                  })}
                  placeholder="f.eks. menu_employees_overview"
                  disabled={!!editingPermission.id}
                />
                <p className="text-xs text-muted-foreground">
                  Bruges i koden til at tjekke adgang
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
                  disabled={updateMutation.isPending || createMutation.isPending}
                  className="flex-1"
                >
                  {(updateMutation.isPending || createMutation.isPending) ? (
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
              Opret en ny systemrolle med tilhørende rettigheder
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
              <Textarea
                value={newRoleForm.description}
                onChange={(e) => setNewRoleForm({ ...newRoleForm, description: e.target.value })}
                placeholder="Beskrivelse af rollens ansvarsområde"
                rows={2}
              />
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
                          <div className={`w-4 h-4 rounded ${color.class}`} />
                          {color.label}
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
                  min={1}
                  max={999}
                />
                <p className="text-xs text-muted-foreground">Lavere = højere rang</p>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateRoleOpen(false)}>
              Annuller
            </Button>
            <Button onClick={handleCreateRole} disabled={createRoleMutation.isPending}>
              {createRoleMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Opret rolle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Role Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Slet rolle "{roleToDelete?.label}"?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {linkedPositions.length > 0 ? (
                  <>
                    <p className="text-destructive font-medium">
                      Advarsel: Denne rolle er tilknyttet {linkedPositions.length} stilling(er):
                    </p>
                    <ul className="list-disc list-inside text-sm bg-muted p-3 rounded-md">
                      {linkedPositions.map(name => <li key={name}>{name}</li>)}
                    </ul>
                    <p>
                      Stillingerne vil miste deres rolletildeling hvis du fortsætter.
                    </p>
                  </>
                ) : (
                  <p>Denne handling kan ikke fortrydes. Alle rettigheder og indstillinger for rollen vil blive slettet.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => roleToDelete && deleteRoleMutation.mutate(roleToDelete.key)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRoleMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Slet rolle
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
