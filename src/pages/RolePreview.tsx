import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Check, 
  X, 
  LayoutDashboard, 
  Users, 
  ShoppingCart, 
  Wallet, 
  Settings, 
  Tv, 
  Percent, 
  Shield, 
  Building2, 
  Calendar, 
  Clock, 
  FileText, 
  User, 
  Sparkles, 
  Video, 
  Database,
  Car,
  BarChart3,
  Eye,
  Pencil
} from "lucide-react";

// Owner position name
const OWNER_POSITION_NAME = "Ejer";

interface PositionPermissions {
  [key: string]: boolean | { view: boolean; edit: boolean };
}

// Generate all permissions for owner
const generateAllPermissions = (): PositionPermissions => ({
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
  view_own_revenue: true,
  view_team_revenue: true,
  view_all_revenue: true,
  view_own_commission: true,
  view_team_commission: true,
  view_all_commission: true,
  view_salary_data: true,
  view_sensitive_data: true,
  create_employees: true,
  edit_employees: true,
  delete_employees: true,
  manage_teams: true,
  assign_team_members: true,
  manage_positions: true,
  assign_roles: true,
  view_contracts: true,
  create_contracts: true,
  send_contracts: true,
  edit_contract_templates: true,
  delete_contracts: true,
  view_all_shifts: true,
  create_shifts: true,
  edit_shifts: true,
  approve_absence: true,
  mark_sick: true,
  edit_time_stamps: true,
  view_sales: true,
  edit_sales: true,
  delete_sales: true,
  manage_products: true,
  manage_campaigns: true,
  run_payroll: true,
  view_integrations: true,
  manage_integrations: true,
  view_logs: true,
  trigger_sync: true,
  manage_system_settings: true,
  view_audit_logs: true,
  manage_webhooks: true,
  full_admin_access: true,
});

// Define menu items with their permission requirements
const menuItems = [
  { 
    name: "Dashboard", 
    icon: LayoutDashboard, 
    permissionKey: "menu_dashboard",
    category: "Oversigt"
  },
  { 
    name: "Wallboard", 
    icon: Tv, 
    permissionKey: "menu_wallboard",
    category: "Oversigt"
  },
  { 
    name: "MG Test", 
    icon: Percent, 
    permissionKey: "menu_mg_test",
    category: "Data",
    hasEditMode: true
  },
  { 
    name: "Salg", 
    icon: ShoppingCart, 
    permissionKey: "menu_sales",
    category: "Data",
    hasEditMode: true
  },
  { 
    name: "Agenter", 
    icon: Users, 
    permissionKey: "menu_agents",
    category: "Data",
    hasEditMode: true
  },
  { 
    name: "Lønkørsel", 
    icon: Wallet, 
    permissionKey: "menu_payroll",
    category: "Løn",
    hasEditMode: true
  },
  { 
    name: "Vagtplan", 
    icon: Calendar, 
    permissionKey: "menu_shift_planning",
    category: "Planlægning",
    hasEditMode: true
  },
  { 
    name: "Rekruttering", 
    icon: Users, 
    permissionKey: "menu_recruitment",
    category: "HR",
    hasEditMode: true
  },
  { 
    name: "Kontrakter", 
    icon: FileText, 
    permissionKey: "menu_contracts",
    category: "HR",
    hasEditMode: true
  },
  { 
    name: "SOME", 
    icon: Video, 
    permissionKey: "menu_some",
    category: "Marketing",
    hasEditMode: true
  },
  { 
    name: "Indstillinger", 
    icon: Settings, 
    permissionKey: "menu_settings",
    category: "System",
    hasEditMode: true
  },
];

// Data visibility permissions
const dataPermissions = [
  { key: "view_own_revenue", label: "Se egen omsætning" },
  { key: "view_team_revenue", label: "Se team omsætning" },
  { key: "view_all_revenue", label: "Se al omsætning" },
  { key: "view_own_commission", label: "Se egen provision" },
  { key: "view_team_commission", label: "Se team provision" },
  { key: "view_all_commission", label: "Se al provision" },
  { key: "view_salary_data", label: "Se løndata" },
  { key: "view_sensitive_data", label: "Se følsomme data" },
];

// Action permissions
const actionPermissions = [
  { key: "create_employees", label: "Oprette medarbejdere" },
  { key: "edit_employees", label: "Redigere medarbejdere" },
  { key: "delete_employees", label: "Slette medarbejdere" },
  { key: "manage_teams", label: "Administrere teams" },
  { key: "approve_absence", label: "Godkende fravær" },
  { key: "mark_sick", label: "Registrere sygdom" },
  { key: "edit_time_stamps", label: "Redigere tidsstempler" },
  { key: "send_contracts", label: "Sende kontrakter" },
  { key: "run_payroll", label: "Køre lønberegning" },
  { key: "manage_integrations", label: "Administrere integrationer" },
];

export default function RolePreview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: position, isLoading } = useQuery({
    queryKey: ["job-position", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("job_positions")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Indlæser...</p>
        </div>
      </MainLayout>
    );
  }

  if (!position) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Stilling ikke fundet</p>
        </div>
      </MainLayout>
    );
  }

  const isOwner = position.name.toLowerCase() === OWNER_POSITION_NAME.toLowerCase();
  const permissions: PositionPermissions = isOwner 
    ? generateAllPermissions() 
    : (position.permissions as PositionPermissions) || {};

  const hasPermission = (key: string): boolean => {
    const value = permissions[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "object" && value !== null) {
      return value.view || value.edit || false;
    }
    return false;
  };

  const canView = (key: string): boolean => {
    const value = permissions[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "object" && value !== null) {
      return value.view || false;
    }
    return false;
  };

  const canEdit = (key: string): boolean => {
    const value = permissions[key];
    if (typeof value === "object" && value !== null) {
      return value.edit || false;
    }
    return false;
  };

  // Group menu items by category
  const groupedMenuItems = menuItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof menuItems>);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/employees")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              Test rolle: {position.name}
              {isOwner && (
                <Badge variant="secondary" className="text-sm">Fuld adgang</Badge>
              )}
            </h1>
            <p className="text-muted-foreground">
              Se hvad en medarbejder med denne rolle vil opleve ved login
            </p>
          </div>
        </div>

        {/* Simulated sidebar view */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <LayoutDashboard className="h-5 w-5" />
                Sidemenu preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(groupedMenuItems).map(([category, items]) => (
                  <div key={category}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      {category}
                    </p>
                    <div className="space-y-1">
                      {items.map((item) => {
                        const hasAccess = hasPermission(item.permissionKey);
                        const viewOnly = item.hasEditMode && canView(item.permissionKey) && !canEdit(item.permissionKey);
                        const Icon = item.icon;
                        
                        return (
                          <div
                            key={item.name}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                              hasAccess 
                                ? "bg-primary/10 text-foreground" 
                                : "bg-muted/30 text-muted-foreground line-through opacity-50"
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                            <span className="flex-1">{item.name}</span>
                            {hasAccess && viewOnly && (
                              <Badge variant="outline" className="text-xs gap-1">
                                <Eye className="h-3 w-3" />
                                Kun se
                              </Badge>
                            )}
                            {hasAccess && !viewOnly && item.hasEditMode && canEdit(item.permissionKey) && (
                              <Badge variant="default" className="text-xs gap-1">
                                <Pencil className="h-3 w-3" />
                                Fuld
                              </Badge>
                            )}
                            {hasAccess ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <X className="h-4 w-4 text-destructive" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Data visibility */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Data synlighed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {dataPermissions.map((perm) => {
                  const hasAccess = hasPermission(perm.key);
                  return (
                    <div
                      key={perm.key}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                        hasAccess 
                          ? "bg-green-500/10 text-foreground" 
                          : "bg-muted/30 text-muted-foreground"
                      }`}
                    >
                      <span>{perm.label}</span>
                      {hasAccess ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Action permissions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Handlinger
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {actionPermissions.map((perm) => {
                  const hasAccess = hasPermission(perm.key);
                  return (
                    <div
                      key={perm.key}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                        hasAccess 
                          ? "bg-green-500/10 text-foreground" 
                          : "bg-muted/30 text-muted-foreground"
                      }`}
                    >
                      <span>{perm.label}</span>
                      {hasAccess ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Denne rolle har adgang til{" "}
                  <span className="font-semibold text-foreground">
                    {menuItems.filter(item => hasPermission(item.permissionKey)).length}
                  </span>{" "}
                  af {menuItems.length} menupunkter
                </p>
              </div>
              <Button variant="outline" onClick={() => navigate("/employees")}>
                Tilbage til stillinger
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
