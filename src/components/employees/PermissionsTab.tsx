import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Users, Calendar, FileText, Loader2, Crown, User, Eye, Lock, Pencil } from "lucide-react";
import { 
  useRoleDefinitions, 
  usePagePermissions, 
  useDataVisibilityRules,
  permissionKeyLabels,
  dataScopeLabels,
  visibilityLabels,
  type Visibility,
  type RoleDefinition
} from "@/hooks/useUnifiedPermissions";

// Icon mapping from database string to component
const iconMap: Record<string, React.ReactNode> = {
  crown: <Crown className="h-4 w-4" />,
  shield: <Shield className="h-4 w-4" />,
  users: <Users className="h-4 w-4" />,
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

// Visibility badge colors
const visibilityColors: Record<Visibility, string> = {
  all: "bg-green-100 text-green-700 border-green-200",
  team: "bg-blue-100 text-blue-700 border-blue-200",
  self: "bg-amber-100 text-amber-700 border-amber-200",
  none: "bg-red-100 text-red-700 border-red-200",
};

export function PermissionsTab() {
  const { data: roleDefinitions = [], isLoading: rolesLoading } = useRoleDefinitions();
  const { data: pagePermissions = [], isLoading: permissionsLoading } = usePagePermissions();
  const { data: visibilityRules = [], isLoading: visibilityLoading } = useDataVisibilityRules();

  const isLoading = rolesLoading || permissionsLoading || visibilityLoading;

  // Create a lookup map for roles
  const roleMap = roleDefinitions.reduce((acc, role) => {
    acc[role.key] = role;
    return acc;
  }, {} as Record<string, RoleDefinition>);

  // Get unique permission keys sorted
  const permissionKeys = [...new Set(pagePermissions.map(p => p.permission_key))].sort();
  
  // Get unique data scopes
  const dataScopes = [...new Set(visibilityRules.map(r => r.data_scope))];
  
  // Get page permission for a role/key combination
  const getPagePermission = (roleKey: string, permissionKey: string) => {
    return pagePermissions.find(p => p.role_key === roleKey && p.permission_key === permissionKey);
  };
  
  // Get visibility for a role/scope combination
  const getVisibilityForRoleScope = (roleKey: string, scope: string): Visibility => {
    const rule = visibilityRules.find(r => r.role_key === roleKey && r.data_scope === scope);
    return (rule?.visibility as Visibility) || "none";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

      {/* Data Visibility Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Data-synlighed
          </CardTitle>
          <CardDescription>
            Hvad kan hver rolle se af andres data? "Alle" = alle medarbejdere, "Team" = kun teammedlemmer, "Kun egen" = kun egne data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datatype</TableHead>
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
                {dataScopes.map((scope) => (
                  <TableRow key={scope}>
                    <TableCell className="font-medium">
                      {dataScopeLabels[scope] || scope.replace(/_/g, ' ')}
                    </TableCell>
                    {roleDefinitions.map((role) => {
                      const visibility = getVisibilityForRoleScope(role.key, scope);
                      return (
                        <TableCell key={role.key} className="text-center">
                          <Badge 
                            variant="outline" 
                            className={visibilityColors[visibility]}
                          >
                            {visibilityLabels[visibility]}
                          </Badge>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className={visibilityColors.all}>Alle</Badge>
              <span>Kan se data for alle medarbejdere</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className={visibilityColors.team}>Team</Badge>
              <span>Kun teammedlemmer</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className={visibilityColors.self}>Kun egen</Badge>
              <span>Kun egne data</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className={visibilityColors.none}>Ingen</Badge>
              <span>Ingen adgang</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
