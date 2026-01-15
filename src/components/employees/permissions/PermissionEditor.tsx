import { useState } from "react";
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
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { 
  usePagePermissions, 
  useRoleDefinitions,
  permissionKeyLabels,
  type PagePermission,
  type RoleDefinition
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

export function PermissionEditor() {
  const queryClient = useQueryClient();
  const { data: permissions = [], isLoading: permissionsLoading } = usePagePermissions();
  const { data: roles = [], isLoading: rolesLoading } = useRoleDefinitions();
  
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [editingPermission, setEditingPermission] = useState<EditingPermission | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

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

  // Toggle permission inline with automatic child inheritance
  const togglePermission = async (permission: PagePermission & { parent_key?: string | null; permission_type?: PermissionType }, field: 'can_view' | 'can_edit') => {
    const newValue = !permission[field];
    
    // Update the permission itself
    const { error } = await supabase
      .from('role_page_permissions')
      .update({ [field]: newValue })
      .eq('id', permission.id);
    
    if (error) {
      toast.error('Kunne ikke opdatere');
      return;
    }

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
            Vælg en rolle for at redigere dens side-, fane- og handlingsrettigheder
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {roles.map((role) => (
              <Button
                key={role.key}
                variant={selectedRole === role.key ? "default" : "outline"}
                onClick={() => setSelectedRole(role.key)}
                className="gap-2"
              >
                <Badge className={colorMap[role.color || "gray"]} variant="secondary">
                  {role.label}
                </Badge>
              </Button>
            ))}
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
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
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
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Ingen rettigheder konfigureret for denne rolle
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
    </div>
  );
}
