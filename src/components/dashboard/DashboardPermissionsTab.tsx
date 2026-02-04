import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, Users, LayoutDashboard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DASHBOARD_LIST } from "@/config/dashboards";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RolePermission {
  id: string;
  role_key: string;
  permission_key: string;
  can_view: boolean;
  can_edit: boolean;
}

interface SystemRole {
  key: string;
  name: string;
}

export function DashboardPermissionsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<string>("");

  // Fetch all system roles from job_positions
  const { data: systemRoles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["system-roles-for-dashboard-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_positions")
        .select("system_role_key, name")
        .not("system_role_key", "is", null)
        .order("name");

      if (error) throw error;

      // Get unique roles
      const uniqueRoles = new Map<string, SystemRole>();
      data?.forEach((pos) => {
        if (pos.system_role_key && !uniqueRoles.has(pos.system_role_key)) {
          uniqueRoles.set(pos.system_role_key, {
            key: pos.system_role_key,
            name: pos.name,
          });
        }
      });

      return Array.from(uniqueRoles.values());
    },
  });

  // Fetch permissions for selected role
  const { data: rolePermissions = [], isLoading: permissionsLoading } = useQuery({
    queryKey: ["dashboard-role-permissions", selectedRole],
    queryFn: async () => {
      if (!selectedRole) return [];

      const dashboardKeys = DASHBOARD_LIST
        .filter(d => d.permissionKey)
        .map(d => d.permissionKey!);

      const { data, error } = await supabase
        .from("role_page_permissions")
        .select("*")
        .eq("role_key", selectedRole)
        .in("permission_key", dashboardKeys);

      if (error) throw error;
      return data as RolePermission[];
    },
    enabled: !!selectedRole,
  });

  // Mutation to update permission
  const updatePermission = useMutation({
    mutationFn: async ({ 
      permissionKey, 
      canView 
    }: { 
      permissionKey: string; 
      canView: boolean;
    }) => {
      // Check if permission exists
      const existingPerm = rolePermissions.find(
        p => p.permission_key === permissionKey
      );

      if (existingPerm) {
        // Update existing
        const { error } = await supabase
          .from("role_page_permissions")
          .update({ can_view: canView, can_edit: canView })
          .eq("id", existingPerm.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("role_page_permissions")
          .insert({
            role_key: selectedRole,
            permission_key: permissionKey,
            can_view: canView,
            can_edit: canView,
            visibility: "all",
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-role-permissions", selectedRole] });
      toast({
        title: "Rettighed opdateret",
        description: "Dashboard-rettigheden er blevet gemt.",
      });
    },
    onError: (error) => {
      console.error("Error updating permission:", error);
      toast({
        title: "Fejl",
        description: "Kunne ikke opdatere rettigheden.",
        variant: "destructive",
      });
    },
  });

  const getPermissionForDashboard = (permissionKey: string) => {
    return rolePermissions.find(p => p.permission_key === permissionKey);
  };

  const handleToggle = (permissionKey: string, currentValue: boolean) => {
    updatePermission.mutate({ permissionKey, canView: !currentValue });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Dashboard Rettigheder
        </CardTitle>
        <CardDescription>
          Vælg en rolle og aktiver/deaktiver adgang til hvert dashboard
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Role Selector */}
        <div className="flex items-center gap-4">
          <Users className="h-5 w-5 text-muted-foreground" />
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Vælg en rolle..." />
            </SelectTrigger>
            <SelectContent>
              {rolesLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : (
                systemRoles.map((role) => (
                  <SelectItem key={role.key} value={role.key}>
                    {role.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Dashboard List */}
        {selectedRole ? (
          permissionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {DASHBOARD_LIST.filter(d => d.permissionKey).map((dashboard) => {
                const permission = getPermissionForDashboard(dashboard.permissionKey!);
                const hasAccess = permission?.can_view ?? false;

                return (
                  <div
                    key={dashboard.slug}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <LayoutDashboard className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{dashboard.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {dashboard.path}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={hasAccess ? "default" : "secondary"}>
                        {hasAccess ? "Aktiv" : "Ingen adgang"}
                      </Badge>
                      <Switch
                        checked={hasAccess}
                        onCheckedChange={() => handleToggle(dashboard.permissionKey!, hasAccess)}
                        disabled={updatePermission.isPending}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Vælg en rolle for at se og redigere dashboard-rettigheder
          </div>
        )}
      </CardContent>
    </Card>
  );
}
