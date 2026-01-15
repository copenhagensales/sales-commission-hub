import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Calendar, FileText, Loader2, Crown, User, Eye, Lock, Pencil, Settings2 } from "lucide-react";
import { 
  useRoleDefinitions, 
  usePagePermissions, 
  permissionKeyLabels,
  type RoleDefinition
} from "@/hooks/useUnifiedPermissions";
import { PermissionEditor } from "./permissions/PermissionEditor";

// Icon mapping from database string to component
const iconMap: Record<string, React.ReactNode> = {
  crown: <Crown className="h-4 w-4" />,
  shield: <Shield className="h-4 w-4" />,
  "file-text": <FileText className="h-4 w-4" />,
  calendar: <Calendar className="h-4 w-4" />,
  user: <User className="h-4 w-4" />,
};

// Color mapping from database string to Tailwind classes
const colorMap: Record<string, string> = {
  primary: "bg-primary text-primary-foreground",
  blue: "bg-blue-500 text-white",
  amber: "bg-amber-500 text-white",
  purple: "bg-purple-500 text-white",
  muted: "bg-muted text-muted-foreground",
  gray: "bg-muted text-muted-foreground",
};


export function PermissionsTab() {
  const { data: roleDefinitions = [], isLoading: rolesLoading } = useRoleDefinitions();
  const { data: pagePermissions = [], isLoading: permissionsLoading } = usePagePermissions();

  const isLoading = rolesLoading || permissionsLoading;

  // Get unique permission keys sorted
  const permissionKeys = [...new Set(pagePermissions.map(p => p.permission_key))].sort();
  
  // Get page permission for a role/key combination
  const getPagePermission = (roleKey: string, permissionKey: string) => {
    return pagePermissions.find(p => p.role_key === roleKey && p.permission_key === permissionKey);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList>
        <TabsTrigger value="overview">Oversigt</TabsTrigger>
        <TabsTrigger value="edit" className="gap-2">
          <Settings2 className="h-4 w-4" />
          Rediger
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        {/* Role descriptions from database */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Systemroller
            </CardTitle>
            <CardDescription>
              Hver rolle giver adgang til specifikke funktioner i systemet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roleDefinitions.map((role) => (
                <div key={role.id} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge className={colorMap[role.color || "gray"]}>
                      {iconMap[role.icon || "shield"]}
                      <span className="ml-1">{role.label}</span>
                    </Badge>
                  </div>
                  <p className="text-sm font-medium text-foreground">{role.description}</p>
                  {role.detailed_description && (
                    <div className="text-sm text-muted-foreground whitespace-pre-line border-t pt-3 mt-2">
                      {role.detailed_description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Page Access Matrix - from database */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Side-adgang
            </CardTitle>
            <CardDescription>
              Hvem kan se og redigere hvilke sider? <Eye className="inline h-3 w-3" /> = kan se, <Pencil className="inline h-3 w-3" /> = kan redigere
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Side/Funktion</TableHead>
                    {roleDefinitions.map((role) => (
                      <TableHead key={role.key} className="text-center">
                        <Badge className={colorMap[role.color || "gray"]} variant="outline">
                          {role.label}
                        </Badge>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permissionKeys.map((permKey) => (
                    <TableRow key={permKey}>
                      <TableCell className="font-medium">
                        {permissionKeyLabels[permKey] || permKey.replace('menu_', '')}
                      </TableCell>
                      {roleDefinitions.map((role) => {
                        const perm = getPagePermission(role.key, permKey);
                        const canView = perm?.can_view ?? false;
                        const canEdit = perm?.can_edit ?? false;
                        
                        return (
                          <TableCell key={role.key} className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              {canView ? (
                                <Eye className="h-4 w-4 text-green-600" />
                              ) : (
                                <Eye className="h-4 w-4 text-muted-foreground/30" />
                              )}
                              {canEdit ? (
                                <Pencil className="h-4 w-4 text-blue-600" />
                              ) : (
                                <Pencil className="h-4 w-4 text-muted-foreground/30" />
                              )}
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Eye className="h-4 w-4 text-green-600" />
                <span>Kan se</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Pencil className="h-4 w-4 text-blue-600" />
                <span>Kan redigere</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Eye className="h-4 w-4 text-muted-foreground/30" />
                <span>Ingen adgang</span>
              </div>
            </div>
          </CardContent>
        </Card>

      </TabsContent>

      <TabsContent value="edit">
        <PermissionEditor />
      </TabsContent>
    </Tabs>
  );
}
