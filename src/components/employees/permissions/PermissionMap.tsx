import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Map, Shield, Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  useRoleDefinitions,
  usePagePermissions,
  permissionKeyLabels,
  type Visibility,
} from "@/hooks/useUnifiedPermissions";
import {
  generatePermissionCategories,
  getPermissionTypeFromKey,
  SECTION_ICONS,
  PERMISSION_KEYS,
} from "@/config/permissionKeys";
import { cn } from "@/lib/utils";

const colorMap: Record<string, string> = {
  primary: "bg-primary text-primary-foreground",
  blue: "bg-blue-500 text-white",
  amber: "bg-amber-500 text-white",
  purple: "bg-purple-500 text-white",
  muted: "bg-muted text-muted-foreground",
  gray: "bg-muted text-muted-foreground",
};

type AccessLevel = "full" | "edit" | "view" | "none";

function getAccessLevel(canView: boolean, canEdit: boolean, visibility: Visibility): AccessLevel {
  if (!canView) return "none";
  if (canEdit && visibility === "all") return "full";
  if (canEdit) return "edit";
  return "view";
}

const accessConfig: Record<AccessLevel, { color: string; border: string; label: string; canView: boolean; canEdit: boolean; visibility: Visibility }> = {
  full: { color: "bg-green-500", border: "border-green-500/30", label: "Fuld adgang", canView: true, canEdit: true, visibility: "all" },
  edit: { color: "bg-blue-500", border: "border-blue-500/30", label: "Kan redigere", canView: true, canEdit: true, visibility: "team" },
  view: { color: "bg-amber-400", border: "border-amber-400/30", label: "Kun læse", canView: true, canEdit: false, visibility: "self" },
  none: { color: "bg-muted-foreground/20", border: "border-transparent", label: "Ingen adgang", canView: false, canEdit: false, visibility: "none" },
};

const ACCESS_LEVELS: AccessLevel[] = ["full", "edit", "view", "none"];
const DASHBOARD_ACCESS_LEVELS: AccessLevel[] = ["full", "none"];

const isDashboardSection = (sectionKey: string) => sectionKey === "menu_section_dashboards";

const sectionOrder = [
  "menu_section_personal", "menu_section_some", "menu_section_personale",
  "menu_section_ledelse", "menu_section_vagtplan", "menu_section_fieldmarketing",
  "menu_section_mg", "menu_section_salary", "menu_section_dashboards",
  "menu_section_test", "menu_section_rekruttering", "menu_section_onboarding",
  "menu_section_reports", "menu_section_admin", "menu_section_sales_system",
  "menu_section_economic", "menu_section_amo", "menu_section_spil", "softphone_section",
];

export function PermissionMap() {
  const { data: roleDefinitions = [] } = useRoleDefinitions();
  const { data: pagePermissions = [] } = usePagePermissions();
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const categories = useMemo(() => generatePermissionCategories(), []);

  const visibleRoles = selectedRoles.length > 0
    ? roleDefinitions.filter((r) => selectedRoles.includes(r.key))
    : roleDefinitions;

  const toggleRole = (roleKey: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleKey) ? prev.filter((k) => k !== roleKey) : [...prev, roleKey]
    );
  };

  const getPermission = (roleKey: string, permKey: string) => {
    return pagePermissions.find(
      (p) => p.role_key === roleKey && p.permission_key === permKey
    );
  };

  const handleUpdateAccess = async (permId: string, level: AccessLevel) => {
    const config = accessConfig[level];
    setUpdating(permId);
    try {
      const { error } = await supabase
        .from("role_page_permissions")
        .update({
          can_view: config.canView,
          can_edit: config.canEdit,
          visibility: config.visibility,
        })
        .eq("id", permId);

      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["page-permissions"] });
      toast.success("Rettighed opdateret");
    } catch (e: any) {
      toast.error("Kunne ikke opdatere: " + (e.message || "Ukendt fejl"));
    } finally {
      setUpdating(null);
    }
  };

  const handleCreateAndSetAccess = async (roleKey: string, permKey: string, level: AccessLevel) => {
    const config = accessConfig[level];
    const permDef = PERMISSION_KEYS[permKey as keyof typeof PERMISSION_KEYS];
    const parentKey = permDef?.parent ?? null;
    setUpdating(`${roleKey}-${permKey}`);
    try {
      const { error } = await supabase
        .from("role_page_permissions")
        .upsert({
          role_key: roleKey,
          permission_key: permKey,
          parent_key: parentKey,
          permission_type: "page",
          can_view: config.canView,
          can_edit: config.canEdit,
          visibility: config.visibility,
        }, { onConflict: 'role_key,permission_key' });

      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["page-permissions"] });
      toast.success("Rettighed oprettet");
    } catch (e: any) {
      toast.error("Kunne ikke oprette: " + (e.message || "Ukendt fejl"));
    } finally {
      setUpdating(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Map className="h-5 w-5" />
          Rettighedskort
        </CardTitle>
        <CardDescription>
          Visuelt overblik over alle rettigheder per rolle. Klik på en prik for at ændre adgangsniveau.
        </CardDescription>

        <div className="flex flex-wrap gap-2 pt-3">
          <Button variant={selectedRoles.length === 0 ? "default" : "outline"} size="sm" onClick={() => setSelectedRoles([])}>
            Alle roller
          </Button>
          {roleDefinitions.map((role) => (
            <Button
              key={role.key}
              variant={selectedRoles.includes(role.key) ? "default" : "outline"}
              size="sm"
              onClick={() => toggleRole(role.key)}
              className={cn(selectedRoles.includes(role.key) && colorMap[role.color || "gray"])}
            >
              {role.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground pt-3 border-t">
          {ACCESS_LEVELS.map((level) => (
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

              const pageKeys = cat.keys.filter((k) => getPermissionTypeFromKey(k) === "page");
              if (pageKeys.length === 0) return null;

              const SectionIcon = SECTION_ICONS[sectionKey] || Shield;

              return (
                <div key={sectionKey}>
                  <div className="flex items-center gap-2 mb-3">
                    <SectionIcon className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">{cat.label}</h3>
                    <Badge variant="secondary" className="text-xs">{pageKeys.length}</Badge>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                    {pageKeys.map((permKey) => {
                      const label = permissionKeyLabels[permKey] || permKey.replace(/^menu_/, "").replace(/_/g, " ");
                      const levels = isDashboardSection(sectionKey) ? DASHBOARD_ACCESS_LEVELS : ACCESS_LEVELS;

                      return (
                        <div key={permKey} className="border rounded-lg p-2.5 hover:bg-muted/50 transition-colors space-y-2">
                          <p className="text-xs font-medium truncate text-foreground">{label}</p>
                          <div className="flex flex-wrap gap-1">
                            {visibleRoles.map((role) => {
                              const perm = getPermission(role.key, permKey);
                              const canView = perm?.can_view ?? false;
                              const canEdit = perm?.can_edit ?? false;
                              const visibility = (perm?.visibility as Visibility) ?? "none";
                              const level = getAccessLevel(canView, canEdit, visibility);
                              const isUpdating = updating === perm?.id;

                              if (!perm?.id) {
                                const isCreating = updating === `${role.key}-${permKey}`;
                                return (
                                  <Popover key={role.key}>
                                    <PopoverTrigger asChild>
                                      <button
                                        className={cn(
                                          "inline-block h-3 w-3 rounded-full border border-dashed cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-primary/50 transition-all",
                                          accessConfig[level].color,
                                          "border-muted-foreground/40",
                                          isCreating && "animate-pulse"
                                        )}
                                        title={`${role.label}: Ingen rettighed — klik for at oprette`}
                                      />
                                    </PopoverTrigger>
                                    <PopoverContent className="w-48 p-1.5" side="bottom" align="start">
                                      <p className="text-xs font-medium px-2 py-1 text-muted-foreground truncate">{role.label} — {label}</p>
                                      <p className="text-[10px] px-2 pb-1 text-muted-foreground/70">Opretter ny rettighed</p>
                                      <div className="space-y-0.5">
                                        {levels.map((al) => (
                                          <button
                                            key={al}
                                            onClick={() => handleCreateAndSetAccess(role.key, permKey, al)}
                                            className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors text-left"
                                          >
                                            <span className={cn("inline-block h-2.5 w-2.5 rounded-full shrink-0", accessConfig[al].color)} />
                                            <span className="flex-1">{accessConfig[al].label}</span>
                                          </button>
                                        ))}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                );
                              }

                              return (
                                <Popover key={role.key}>
                                  <PopoverTrigger asChild>
                                    <button
                                      className={cn(
                                        "inline-block h-3 w-3 rounded-full border cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-primary/50 transition-all",
                                        accessConfig[level].color,
                                        accessConfig[level].border,
                                        isUpdating && "animate-pulse"
                                      )}
                                      title={`${role.label}: ${accessConfig[level].label}`}
                                    />
                                  </PopoverTrigger>
                                  <PopoverContent className="w-48 p-1.5" side="bottom" align="start">
                                    <p className="text-xs font-medium px-2 py-1 text-muted-foreground truncate">{role.label} — {label}</p>
                                    <div className="space-y-0.5">
                                      {levels.map((al) => (
                                        <button
                                          key={al}
                                          onClick={() => handleUpdateAccess(perm.id, al)}
                                          className={cn(
                                            "flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors text-left",
                                            level === al && "bg-muted font-medium"
                                          )}
                                        >
                                          <span className={cn("inline-block h-2.5 w-2.5 rounded-full shrink-0", accessConfig[al].color)} />
                                          <span className="flex-1">{accessConfig[al].label}</span>
                                          {level === al && <Check className="h-3 w-3 text-primary" />}
                                        </button>
                                      ))}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              );
                            })}
                          </div>
                        </div>
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
