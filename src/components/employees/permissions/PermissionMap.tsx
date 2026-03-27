import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Map, Eye, Pencil, Shield } from "lucide-react";
import {
  useRoleDefinitions,
  usePagePermissions,
  permissionKeyLabels,
  type RoleDefinition,
  type Visibility,
} from "@/hooks/useUnifiedPermissions";
import {
  PERMISSION_KEYS,
  type PermissionKey,
  generatePermissionCategories,
  getPermissionTypeFromKey,
  SECTION_ICONS,
} from "@/config/permissionKeys";
import { cn } from "@/lib/utils";

// Reuse color map from PermissionsTab
const colorMap: Record<string, string> = {
  primary: "bg-primary text-primary-foreground",
  blue: "bg-blue-500 text-white",
  amber: "bg-amber-500 text-white",
  purple: "bg-purple-500 text-white",
  muted: "bg-muted text-muted-foreground",
  gray: "bg-muted text-muted-foreground",
};

// Role color dots for the map view
const roleColorDots: Record<string, string> = {
  primary: "bg-primary",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  purple: "bg-purple-500",
  muted: "bg-muted-foreground/40",
  gray: "bg-muted-foreground/40",
};

type AccessLevel = "full" | "edit" | "view" | "none";

function getAccessLevel(canView: boolean, canEdit: boolean, visibility: Visibility): AccessLevel {
  if (!canView) return "none";
  if (canEdit && visibility === "all") return "full";
  if (canEdit) return "edit";
  return "view";
}

const accessConfig: Record<AccessLevel, { color: string; border: string; label: string }> = {
  full: { color: "bg-green-500", border: "border-green-500/30", label: "Fuld adgang" },
  edit: { color: "bg-blue-500", border: "border-blue-500/30", label: "Kan redigere" },
  view: { color: "bg-amber-400", border: "border-amber-400/30", label: "Kun læse" },
  none: { color: "bg-muted-foreground/20", border: "border-transparent", label: "Ingen adgang" },
};

export function PermissionMap() {
  const { data: roleDefinitions = [] } = useRoleDefinitions();
  const { data: pagePermissions = [] } = usePagePermissions();
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  const categories = useMemo(() => generatePermissionCategories(), []);

  const visibleRoles = selectedRoles.length > 0
    ? roleDefinitions.filter((r) => selectedRoles.includes(r.key))
    : roleDefinitions;

  const toggleRole = (roleKey: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleKey)
        ? prev.filter((k) => k !== roleKey)
        : [...prev, roleKey]
    );
  };

  const getPermission = (roleKey: string, permKey: string) => {
    return pagePermissions.find(
      (p) => p.role_key === roleKey && p.permission_key === permKey
    );
  };

  // Section order for display
  const sectionOrder = [
    "menu_section_personal",
    "menu_section_some",
    "menu_section_personale",
    "menu_section_ledelse",
    "menu_section_vagtplan",
    "menu_section_fieldmarketing",
    "menu_section_mg",
    "menu_section_salary",
    "menu_section_dashboards",
    "menu_section_test",
    "menu_section_rekruttering",
    "menu_section_onboarding",
    "menu_section_reports",
    "menu_section_admin",
    "menu_section_sales_system",
    "menu_section_economic",
    "menu_section_amo",
    "menu_section_spil",
    "softphone_section",
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Map className="h-5 w-5" />
          Rettighedskort
        </CardTitle>
        <CardDescription>
          Visuelt overblik over alle rettigheder per rolle. Klik på en rolle for at filtrere.
        </CardDescription>

        {/* Role filter buttons */}
        <div className="flex flex-wrap gap-2 pt-3">
          <Button
            variant={selectedRoles.length === 0 ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedRoles([])}
          >
            Alle roller
          </Button>
          {roleDefinitions.map((role) => (
            <Button
              key={role.key}
              variant={selectedRoles.includes(role.key) ? "default" : "outline"}
              size="sm"
              onClick={() => toggleRole(role.key)}
              className={cn(
                selectedRoles.includes(role.key) && colorMap[role.color || "gray"]
              )}
            >
              {role.label}
            </Button>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground pt-3 border-t">
          {(["full", "edit", "view", "none"] as AccessLevel[]).map((level) => (
            <div key={level} className="flex items-center gap-1.5">
              <span className={cn("inline-block h-2.5 w-2.5 rounded-full", accessConfig[level].color)} />
              <span>{accessConfig[level].label}</span>
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        <TooltipProvider delayDuration={200}>
          <div className="space-y-6">
            {sectionOrder.map((sectionKey) => {
              const cat = categories[sectionKey];
              if (!cat || cat.keys.length === 0) return null;

              // Only show page-level permissions (not tabs/actions) for cleaner map
              const pageKeys = cat.keys.filter(
                (k) => getPermissionTypeFromKey(k) === "page"
              );
              if (pageKeys.length === 0) return null;

              const SectionIcon = SECTION_ICONS[sectionKey] || Shield;

              return (
                <div key={sectionKey}>
                  {/* Section header */}
                  <div className="flex items-center gap-2 mb-3">
                    <SectionIcon className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">
                      {cat.label}
                    </h3>
                    <Badge variant="secondary" className="text-xs">
                      {pageKeys.length}
                    </Badge>
                  </div>

                  {/* Permission cards grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                    {pageKeys.map((permKey) => {
                      const label =
                        permissionKeyLabels[permKey] ||
                        permKey.replace(/^menu_/, "").replace(/_/g, " ");

                      return (
                        <Tooltip key={permKey}>
                          <TooltipTrigger asChild>
                            <div className="border rounded-lg p-2.5 hover:bg-muted/50 transition-colors cursor-help space-y-2">
                              <p className="text-xs font-medium truncate text-foreground">
                                {label}
                              </p>
                              {/* Role access dots */}
                              <div className="flex flex-wrap gap-1">
                                {visibleRoles.map((role) => {
                                  const perm = getPermission(role.key, permKey);
                                  const canView = perm?.can_view ?? false;
                                  const canEdit = perm?.can_edit ?? false;
                                  const visibility = (perm?.visibility as Visibility) ?? "none";
                                  const level = getAccessLevel(canView, canEdit, visibility);

                                  return (
                                    <span
                                      key={role.key}
                                      className={cn(
                                        "inline-block h-3 w-3 rounded-full border",
                                        accessConfig[level].color,
                                        accessConfig[level].border
                                      )}
                                      title={`${role.label}: ${accessConfig[level].label}`}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs">
                            <div className="space-y-2">
                              <p className="font-medium text-sm">{label}</p>
                              <div className="space-y-1">
                                {visibleRoles.map((role) => {
                                  const perm = getPermission(role.key, permKey);
                                  const canView = perm?.can_view ?? false;
                                  const canEdit = perm?.can_edit ?? false;
                                  const visibility = (perm?.visibility as Visibility) ?? "none";
                                  const level = getAccessLevel(canView, canEdit, visibility);

                                  return (
                                    <div key={role.key} className="flex items-center gap-2 text-xs">
                                      <span
                                        className={cn(
                                          "inline-block h-2 w-2 rounded-full",
                                          accessConfig[level].color
                                        )}
                                      />
                                      <span className="font-medium min-w-[80px]">{role.label}</span>
                                      <span className="text-muted-foreground">
                                        {accessConfig[level].label}
                                        {canView && visibility !== "none" && ` (${
                                          visibility === "all" ? "alt data" : visibility === "team" ? "team" : "egen"
                                        })`}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
