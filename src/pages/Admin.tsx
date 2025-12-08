import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Shield, Users, Crown, User, Search, Trash2, Eye, EyeOff, Check, X, ChevronDown, ChevronUp, Save, RotateCcw, Home } from "lucide-react";
import { useCanAccess, SystemRole } from "@/hooks/useSystemRoles";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface EmployeeRole {
  employee_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  job_title: string | null;
  is_active: boolean;
  auth_user_id: string | null;
  role_id: string | null;
  role: SystemRole | null;
}

interface TeamInfo {
  id: string;
  name: string;
  team_leader_id: string | null;
  team_leader_name?: string;
  member_count: number;
}

// Menu item definitions with permissions
const menuItems = [
  { id: "employees", name: "Medarbejdere", icon: "Users", category: "Stamdata" },
  { id: "teams", name: "Teams", icon: "Users", category: "Stamdata" },
  { id: "contracts", name: "Kontrakter", icon: "FileText", category: "Stamdata" },
  { id: "my-contracts", name: "Mine kontrakter", icon: "FileText", category: "Personligt" },
  { id: "my-profile", name: "Min profil", icon: "User", category: "Personligt" },
  { id: "my-schedule", name: "Min kalender", icon: "Calendar", category: "Personligt" },
  { id: "career-wishes", name: "Karriereønsker", icon: "Sparkles", category: "Personligt" },
  { id: "pulse-survey", name: "Pulsmåling", icon: "HeartHandshake", category: "Personligt" },
  { id: "sales", name: "Salg", icon: "ShoppingCart", category: "Salgsdata" },
  { id: "codan", name: "Codan", icon: "Shield", category: "Salgsdata" },
  { id: "tdc-erhverv", name: "TDC Erhverv", icon: "Building2", category: "Salgsdata" },
  { id: "payroll", name: "Lønkørsel", icon: "Wallet", category: "Løn" },
  { id: "shift-planning", name: "Vagtplan", icon: "ClipboardList", category: "Vagtplan" },
  { id: "absence", name: "Godkend fravær", icon: "Clock", category: "Vagtplan" },
  { id: "time-tracking", name: "Tidsregistrering", icon: "Timer", category: "Vagtplan" },
  { id: "extra-work", name: "Ekstra arbejde", icon: "Plus", category: "Vagtplan" },
  { id: "recruitment-dashboard", name: "Rekruttering", icon: "Users", category: "Rekruttering" },
  { id: "candidates", name: "Kandidater", icon: "UserPlus", category: "Rekruttering" },
  { id: "messages", name: "Beskeder", icon: "MessageSquare", category: "Rekruttering" },
  { id: "upcoming-interviews", name: "Kommende samtaler", icon: "Calendar", category: "Rekruttering" },
  { id: "upcoming-hires", name: "Kommende ansættelser", icon: "UserCheck", category: "Rekruttering" },
  { id: "winback", name: "Winback", icon: "RefreshCw", category: "Rekruttering" },
  { id: "car-quiz", name: "Bil-quiz", icon: "Car", category: "Compliance" },
  { id: "code-of-conduct", name: "Code of Conduct", icon: "Shield", category: "Compliance" },
  { id: "pulse-results", name: "Pulsmåling resultater", icon: "BarChart3", category: "Rapporter" },
  { id: "car-quiz-admin", name: "Bil-quiz overblik", icon: "Car", category: "Rapporter" },
  { id: "coc-admin", name: "Code of Conduct overblik", icon: "Shield", category: "Rapporter" },
  { id: "career-wishes-overview", name: "Karriereønsker overblik", icon: "Sparkles", category: "Rapporter" },
  { id: "fieldmarketing", name: "Fieldmarketing", icon: "Calendar", category: "Fieldmarketing" },
  { id: "some", name: "SOME", icon: "Share2", category: "SOME" },
  { id: "time-stamp", name: "Stempel", icon: "Clock", category: "Tidregistrering" },
  { id: "admin", name: "Administration", icon: "Shield", category: "System" },
  { id: "settings", name: "Indstillinger", icon: "Settings", category: "System" },
];

// Employee type definitions
type EmployeeType = "salgskonsulent" | "fieldmarketing";

const employeeTypeLabels: Record<EmployeeType, { label: string, color: string }> = {
  salgskonsulent: { label: "Salgskonsulent", color: "text-blue-500" },
  fieldmarketing: { label: "Fieldmarketing", color: "text-emerald-500" },
};

// Default job type permissions (within medarbejder role)
const defaultJobTypePermissions: Record<EmployeeType, string[]> = {
  salgskonsulent: ["my-profile", "my-schedule", "my-contracts", "career-wishes", "pulse-survey", "code-of-conduct"],
  fieldmarketing: ["my-profile", "my-schedule", "my-contracts", "career-wishes", "car-quiz", "fieldmarketing"],
};

// Default role permissions matrix (used as fallback if no DB config)
const defaultRolePermissions: Record<SystemRole, { 
  menuItems: string[], 
  description: string,
  dataScope: string,
  canManageTeam: boolean,
  canManageAllData: boolean,
  canManageRoles: boolean,
}> = {
  medarbejder: {
    menuItems: ["my-profile", "my-schedule", "my-contracts", "career-wishes", "pulse-survey"],
    description: "Basalt adgangsniveau til egne data",
    dataScope: "Kun egne data",
    canManageTeam: false,
    canManageAllData: false,
    canManageRoles: false,
  },
  rekruttering: {
    menuItems: ["employees", "teams", "contracts", "my-contracts", "my-profile", "my-schedule", "career-wishes", "career-wishes-overview"],
    description: "Kan se alle medarbejdere og sende kontrakter",
    dataScope: "Alle medarbejdere (kun læsning + kontrakter)",
    canManageTeam: false,
    canManageAllData: false,
    canManageRoles: false,
  },
  teamleder: {
    menuItems: ["shift-planning", "absence", "employees", "contracts", "my-contracts", "my-profile", "pulse-results", "coc-admin", "time-tracking", "extra-work"],
    description: "Adgang til eget teams data og vagtplan",
    dataScope: "Eget team (via manager_id)",
    canManageTeam: true,
    canManageAllData: false,
    canManageRoles: false,
  },
  ejer: {
    menuItems: menuItems.map(m => m.id),
    description: "Fuld systemadgang",
    dataScope: "Alle data",
    canManageTeam: true,
    canManageAllData: true,
    canManageRoles: true,
  },
};

const roleLabels: Record<SystemRole, { label: string, color: string, icon: typeof Crown }> = {
  medarbejder: { label: "Medarbejder", color: "text-muted-foreground", icon: User },
  rekruttering: { label: "Rekruttering", color: "text-purple-500", icon: Users },
  teamleder: { label: "Teamleder", color: "text-blue-500", icon: Users },
  ejer: { label: "Ejer", color: "text-amber-500", icon: Crown },
};

export default function Admin() {
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<EmployeeRole | null>(null);
  const [expandedRoles, setExpandedRoles] = useState<SystemRole[]>(["ejer", "teamleder", "rekruttering", "medarbejder"]);
  const [editedPermissions, setEditedPermissions] = useState<Record<SystemRole, string[]>>({
    medarbejder: [...defaultRolePermissions.medarbejder.menuItems],
    rekruttering: [...defaultRolePermissions.rekruttering.menuItems],
    teamleder: [...defaultRolePermissions.teamleder.menuItems],
    ejer: [...defaultRolePermissions.ejer.menuItems],
  });
  const [editedJobTypePermissions, setEditedJobTypePermissions] = useState<Record<EmployeeType, string[]>>({
    salgskonsulent: [...defaultJobTypePermissions.salgskonsulent],
    fieldmarketing: [...defaultJobTypePermissions.fieldmarketing],
  });
  const [landingPages, setLandingPages] = useState<Record<string, string>>({
    salgskonsulent: "/my-profile",
    fieldmarketing: "/vagt-flow/min-uge",
    rekruttering: "/recruitment",
    teamleder: "/shift-planning/overview",
    ejer: "/employees",
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [userPermissionSearch, setUserPermissionSearch] = useState("");
  const [showOnlyWithExtras, setShowOnlyWithExtras] = useState(false);
  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState<EmployeeRole | null>(null);
  const queryClient = useQueryClient();
  const { isOwner, isLoading: accessLoading } = useCanAccess();

  // Toggle menu access for a role
  const toggleMenuAccess = (role: SystemRole, menuId: string) => {
    // Ejer always has access to everything
    if (role === "ejer") return;
    
    setEditedPermissions(prev => {
      const current = prev[role] || [];
      const updated = current.includes(menuId)
        ? current.filter(id => id !== menuId)
        : [...current, menuId];
      return { ...prev, [role]: updated };
    });
    setHasChanges(true);
  };

  // Toggle menu access for a job type
  const toggleJobTypeMenuAccess = (jobType: EmployeeType, menuId: string) => {
    setEditedJobTypePermissions(prev => {
      const current = prev[jobType] || [];
      const updated = current.includes(menuId)
        ? current.filter(id => id !== menuId)
        : [...current, menuId];
      return { ...prev, [jobType]: updated };
    });
    setHasChanges(true);
  };

  // Reset to defaults
  const resetPermissions = () => {
    setEditedPermissions({
      medarbejder: [...defaultRolePermissions.medarbejder.menuItems],
      rekruttering: [...defaultRolePermissions.rekruttering.menuItems],
      teamleder: [...defaultRolePermissions.teamleder.menuItems],
      ejer: [...defaultRolePermissions.ejer.menuItems],
    });
    setEditedJobTypePermissions({
      salgskonsulent: [...defaultJobTypePermissions.salgskonsulent],
      fieldmarketing: [...defaultJobTypePermissions.fieldmarketing],
    });
    setHasChanges(false);
    toast.info("Rettigheder nulstillet til standard");
  };

  // Update landing page for a group
  const updateLandingPage = (group: string, path: string) => {
    setLandingPages(prev => ({ ...prev, [group]: path }));
    setHasChanges(true);
  };

  // Save permissions (for now just local - can be extended to save to DB)
  const savePermissions = () => {
    // Store in localStorage for persistence
    localStorage.setItem("admin_role_permissions", JSON.stringify(editedPermissions));
    localStorage.setItem("admin_job_type_permissions", JSON.stringify(editedJobTypePermissions));
    localStorage.setItem("admin_landing_pages", JSON.stringify(landingPages));
    setHasChanges(false);
    toast.success("Rettigheder gemt");
  };

  // Load saved permissions on mount
  useEffect(() => {
    const saved = localStorage.getItem("admin_role_permissions");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setEditedPermissions(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error("Failed to parse saved permissions", e);
      }
    }
    const savedJobType = localStorage.getItem("admin_job_type_permissions");
    if (savedJobType) {
      try {
        const parsed = JSON.parse(savedJobType);
        setEditedJobTypePermissions(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error("Failed to parse saved job type permissions", e);
      }
    }
    const savedLandingPages = localStorage.getItem("admin_landing_pages");
    if (savedLandingPages) {
      try {
        const parsed = JSON.parse(savedLandingPages);
        setLandingPages(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error("Failed to parse saved landing pages", e);
      }
    }
  }, []);

  // Create working rolePermissions based on edited state
  const rolePermissions: Record<SystemRole, { 
    menuItems: string[], 
    description: string,
    dataScope: string,
    canManageTeam: boolean,
    canManageAllData: boolean,
    canManageRoles: boolean,
  }> = {
    medarbejder: {
      ...defaultRolePermissions.medarbejder,
      menuItems: editedPermissions.medarbejder,
    },
    rekruttering: {
      ...defaultRolePermissions.rekruttering,
      menuItems: editedPermissions.rekruttering,
    },
    teamleder: {
      ...defaultRolePermissions.teamleder,
      menuItems: editedPermissions.teamleder,
    },
    ejer: {
      ...defaultRolePermissions.ejer,
      menuItems: menuItems.map(m => m.id), // Ejer always has all permissions
    },
  };

  // Fetch users with their roles using the secure RPC function
  const { data: users, isLoading, error } = useQuery({
    queryKey: ["admin-employee-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_employee_roles_for_admin");
      if (error) throw error;
      return data as EmployeeRole[];
    },
    enabled: isOwner,
  });

  // Fetch individual user permissions from database
  const { data: individualPermissions } = useQuery({
    queryKey: ["user-menu-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_menu_permissions")
        .select("*");
      if (error) throw error;
      return data;
    },
    enabled: isOwner,
  });

  // Filter users for the individual permissions table
  const filteredUsersForPermissions = users?.filter((user) => {
    const fullName = `${user.first_name || ""} ${user.last_name || ""}`.toLowerCase();
    const email = user.email?.toLowerCase() || "";
    const search = userPermissionSearch.toLowerCase();
    const matchesSearch = fullName.includes(search) || email.includes(search);
    
    if (showOnlyWithExtras) {
      const hasExtras = individualPermissions?.some(p => p.user_id === user.auth_user_id);
      return matchesSearch && hasExtras;
    }
    return matchesSearch;
  });

  // Add individual permission mutation
  const addIndividualPermission = useMutation({
    mutationFn: async ({ userId, menuItemId }: { userId: string; menuItemId: string }) => {
      const { error } = await supabase
        .from("user_menu_permissions")
        .insert({ user_id: userId, menu_item_id: menuItemId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-menu-permissions"] });
      toast.success("Rettighed tilføjet");
    },
    onError: (error: Error) => {
      toast.error("Kunne ikke tilføje rettighed: " + error.message);
    },
  });

  // Remove individual permission mutation
  const removeIndividualPermission = useMutation({
    mutationFn: async ({ userId, menuItemId }: { userId: string; menuItemId: string }) => {
      const { error } = await supabase
        .from("user_menu_permissions")
        .delete()
        .eq("user_id", userId)
        .eq("menu_item_id", menuItemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-menu-permissions"] });
      toast.success("Rettighed fjernet");
    },
    onError: (error: Error) => {
      toast.error("Kunne ikke fjerne rettighed: " + error.message);
    },
  });

  // Fetch teams with their members
  const { data: teams } = useQuery({
    queryKey: ["admin-teams"],
    queryFn: async () => {
      const { data: teamsData, error: teamsError } = await supabase
        .from("teams")
        .select("id, name, team_leader_id");
      
      if (teamsError) throw teamsError;

      const teamsWithInfo: TeamInfo[] = await Promise.all(
        (teamsData || []).map(async (team) => {
          const { count } = await supabase
            .from("employee_master_data")
            .select("*", { count: "exact", head: true })
            .eq("team_id", team.id);

          let teamLeaderName = "";
          if (team.team_leader_id) {
            const { data: leader } = await supabase
              .from("employee_master_data")
              .select("first_name, last_name")
              .eq("id", team.team_leader_id)
              .single();
            if (leader) {
              teamLeaderName = `${leader.first_name} ${leader.last_name}`;
            }
          }

          return {
            ...team,
            team_leader_name: teamLeaderName,
            member_count: count || 0,
          };
        })
      );

      return teamsWithInfo;
    },
    enabled: isOwner,
  });

  // Assign role mutation using RPC
  const assignRole = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: SystemRole }) => {
      const { error } = await supabase.rpc("assign_role_by_email", {
        _email: email,
        _role: role,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-employee-roles"] });
      queryClient.invalidateQueries({ queryKey: ["system-role"] });
      toast.success("Rolle opdateret");
    },
    onError: (error: Error) => {
      toast.error("Kunne ikke opdatere rolle: " + error.message);
    },
  });

  // Remove role mutation using RPC
  const removeRole = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.rpc("remove_role_by_email", {
        _email: email,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-employee-roles"] });
      queryClient.invalidateQueries({ queryKey: ["system-role"] });
      toast.success("Rolle fjernet");
    },
    onError: (error: Error) => {
      toast.error("Kunne ikke fjerne rolle: " + error.message);
    },
  });

  // Delete employee mutation
  const deleteEmployee = useMutation({
    mutationFn: async (employeeId: string) => {
      const { error } = await supabase
        .from("employee_master_data")
        .delete()
        .eq("id", employeeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-employee-roles"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Medarbejder slettet");
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    },
    onError: (error: Error) => {
      toast.error("Kunne ikke slette medarbejder: " + error.message);
    },
  });

  const handleDeleteClick = (user: EmployeeRole) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (userToDelete) {
      deleteEmployee.mutate(userToDelete.employee_id);
    }
  };

  const toggleRole = (role: SystemRole) => {
    setExpandedRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role) 
        : [...prev, role]
    );
  };

  const filteredUsers = users?.filter((user) => {
    const fullName = `${user.first_name || ""} ${user.last_name || ""}`.toLowerCase();
    const email = user.email?.toLowerCase() || "";
    const search = searchTerm.toLowerCase();
    return fullName.includes(search) || email.includes(search);
  });

  // Group users by role
  const usersByRole = {
    ejer: filteredUsers?.filter(u => u.role === "ejer") || [],
    teamleder: filteredUsers?.filter(u => u.role === "teamleder") || [],
    rekruttering: filteredUsers?.filter(u => u.role === "rekruttering") || [],
    medarbejder: filteredUsers?.filter(u => u.role === "medarbejder" || !u.role) || [],
  };

  // Group menu items by category
  const menuByCategory = menuItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof menuItems>);

  const getRoleBadge = (role: SystemRole | null) => {
    const roleInfo = role ? roleLabels[role] : null;
    if (!roleInfo) {
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Ingen rolle
        </Badge>
      );
    }
    const Icon = roleInfo.icon;
    return (
      <Badge className={`bg-${roleInfo.color.replace('text-', '')}/20 ${roleInfo.color} border-${roleInfo.color.replace('text-', '')}/30`}>
        <Icon className="h-3 w-3 mr-1" />
        {roleInfo.label}
      </Badge>
    );
  };

  if (accessLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </MainLayout>
    );
  }

  if (!isOwner) {
    return (
      <MainLayout>
        <div className="container mx-auto py-6">
          <Alert variant="destructive">
            <Shield className="h-4 w-4" />
            <AlertTitle>Ingen adgang</AlertTitle>
            <AlertDescription>
              Du har ikke adgang til denne side. Kun ejere kan administrere roller.
            </AlertDescription>
          </Alert>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8" />
              Administration
            </h1>
            <p className="text-muted-foreground mt-1">
              Administrer brugerroller, rettigheder og adgangskontrol
            </p>
          </div>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-lg">
            <TabsTrigger value="users">Brugere</TabsTrigger>
            <TabsTrigger value="permissions">Rettigheder</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
          </TabsList>

          {/* USERS TAB */}
          <TabsContent value="users" className="space-y-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Søg efter navn eller email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 max-w-md"
              />
            </div>

            {/* Users grouped by role */}
            <div className="space-y-4">
              {(["ejer", "teamleder", "rekruttering", "medarbejder"] as SystemRole[]).map((role) => {
                const roleInfo = roleLabels[role];
                const usersInRole = usersByRole[role];
                const isExpanded = expandedRoles.includes(role);
                const Icon = roleInfo.icon;

                return (
                  <Collapsible key={role} open={isExpanded} onOpenChange={() => toggleRole(role)}>
                    <Card>
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg bg-${roleInfo.color.replace('text-', '')}/10`}>
                                <Icon className={`h-5 w-5 ${roleInfo.color}`} />
                              </div>
                              <div>
                                <CardTitle className="text-lg">{roleInfo.label}</CardTitle>
                                <CardDescription>{rolePermissions[role].description}</CardDescription>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge variant="secondary" className="text-sm">
                                {usersInRole.length} brugere
                              </Badge>
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </div>
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent>
                          {usersInRole.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">
                              Ingen brugere med denne rolle
                            </p>
                          ) : (
                            <div className="space-y-6">
                              {/* Group by job_title: Salgskonsulenter */}
                              {(() => {
                                const salgskonsulenter = usersInRole.filter(u => u.job_title === "Salgskonsulent");
                                if (salgskonsulenter.length === 0) return null;
                                return (
                                  <div>
                                    <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                                      Salgskonsulenter ({salgskonsulenter.length})
                                    </h4>
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Navn</TableHead>
                                          <TableHead>Email</TableHead>
                                          <TableHead>Login</TableHead>
                                          <TableHead className="text-right">Handlinger</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {salgskonsulenter.map((user) => (
                                          <TableRow key={user.employee_id}>
                                            <TableCell className="font-medium">
                                              {user.first_name} {user.last_name}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                              {user.email || "-"}
                                            </TableCell>
                                            <TableCell>
                                              {user.auth_user_id ? (
                                                <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                                                  Aktiv
                                                </Badge>
                                              ) : (
                                                <Badge variant="outline" className="text-muted-foreground">
                                                  Ingen
                                                </Badge>
                                              )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                              <div className="flex items-center justify-end gap-2">
                                                {user.auth_user_id && user.email ? (
                                                  <Select
                                                    value={user.role || "none"}
                                                    onValueChange={(value) => {
                                                      if (value === "none") {
                                                        removeRole.mutate(user.email!);
                                                      } else {
                                                        assignRole.mutate({
                                                          email: user.email!,
                                                          role: value as SystemRole,
                                                        });
                                                      }
                                                    }}
                                                  >
                                                    <SelectTrigger className="w-[130px]">
                                                      <SelectValue placeholder="Vælg rolle" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                      <SelectItem value="none">Ingen rolle</SelectItem>
                                                      <SelectItem value="medarbejder">Medarbejder</SelectItem>
                                                      <SelectItem value="rekruttering">Rekruttering</SelectItem>
                                                      <SelectItem value="teamleder">Teamleder</SelectItem>
                                                      <SelectItem value="ejer">Ejer</SelectItem>
                                                    </SelectContent>
                                                  </Select>
                                                ) : (
                                                  <span className="text-sm text-muted-foreground">
                                                    Kræver login
                                                  </span>
                                                )}
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                  onClick={() => handleDeleteClick(user)}
                                                >
                                                  <Trash2 className="h-4 w-4" />
                                                </Button>
                                              </div>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                );
                              })()}

                              {/* Group by job_title: Fieldmarketing */}
                              {(() => {
                                const fieldmarketing = usersInRole.filter(u => u.job_title === "Fieldmarketing");
                                if (fieldmarketing.length === 0) return null;
                                return (
                                  <div>
                                    <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                      Fieldmarketing ({fieldmarketing.length})
                                    </h4>
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Navn</TableHead>
                                          <TableHead>Email</TableHead>
                                          <TableHead>Login</TableHead>
                                          <TableHead className="text-right">Handlinger</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {fieldmarketing.map((user) => (
                                          <TableRow key={user.employee_id}>
                                            <TableCell className="font-medium">
                                              {user.first_name} {user.last_name}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                              {user.email || "-"}
                                            </TableCell>
                                            <TableCell>
                                              {user.auth_user_id ? (
                                                <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                                                  Aktiv
                                                </Badge>
                                              ) : (
                                                <Badge variant="outline" className="text-muted-foreground">
                                                  Ingen
                                                </Badge>
                                              )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                              <div className="flex items-center justify-end gap-2">
                                                {user.auth_user_id && user.email ? (
                                                  <Select
                                                    value={user.role || "none"}
                                                    onValueChange={(value) => {
                                                      if (value === "none") {
                                                        removeRole.mutate(user.email!);
                                                      } else {
                                                        assignRole.mutate({
                                                          email: user.email!,
                                                          role: value as SystemRole,
                                                        });
                                                      }
                                                    }}
                                                  >
                                                    <SelectTrigger className="w-[130px]">
                                                      <SelectValue placeholder="Vælg rolle" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                      <SelectItem value="none">Ingen rolle</SelectItem>
                                                      <SelectItem value="medarbejder">Medarbejder</SelectItem>
                                                      <SelectItem value="rekruttering">Rekruttering</SelectItem>
                                                      <SelectItem value="teamleder">Teamleder</SelectItem>
                                                      <SelectItem value="ejer">Ejer</SelectItem>
                                                    </SelectContent>
                                                  </Select>
                                                ) : (
                                                  <span className="text-sm text-muted-foreground">
                                                    Kræver login
                                                  </span>
                                                )}
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                  onClick={() => handleDeleteClick(user)}
                                                >
                                                  <Trash2 className="h-4 w-4" />
                                                </Button>
                                              </div>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                );
                              })()}

                              {/* Group by job_title: Øvrige (other job titles) */}
                              {(() => {
                                const other = usersInRole.filter(u => u.job_title !== "Salgskonsulent" && u.job_title !== "Fieldmarketing");
                                if (other.length === 0) return null;
                                return (
                                  <div>
                                    <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                                      <span className="w-2 h-2 rounded-full bg-gray-500" />
                                      Øvrige ({other.length})
                                    </h4>
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Navn</TableHead>
                                          <TableHead>Email</TableHead>
                                          <TableHead>Stilling</TableHead>
                                          <TableHead>Login</TableHead>
                                          <TableHead className="text-right">Handlinger</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {other.map((user) => (
                                          <TableRow key={user.employee_id}>
                                            <TableCell className="font-medium">
                                              {user.first_name} {user.last_name}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                              {user.email || "-"}
                                            </TableCell>
                                            <TableCell>{user.job_title || "-"}</TableCell>
                                            <TableCell>
                                              {user.auth_user_id ? (
                                                <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                                                  Aktiv
                                                </Badge>
                                              ) : (
                                                <Badge variant="outline" className="text-muted-foreground">
                                                  Ingen
                                                </Badge>
                                              )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                              <div className="flex items-center justify-end gap-2">
                                                {user.auth_user_id && user.email ? (
                                                  <Select
                                                    value={user.role || "none"}
                                                    onValueChange={(value) => {
                                                      if (value === "none") {
                                                        removeRole.mutate(user.email!);
                                                      } else {
                                                        assignRole.mutate({
                                                          email: user.email!,
                                                          role: value as SystemRole,
                                                        });
                                                      }
                                                    }}
                                                  >
                                                    <SelectTrigger className="w-[130px]">
                                                      <SelectValue placeholder="Vælg rolle" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                      <SelectItem value="none">Ingen rolle</SelectItem>
                                                      <SelectItem value="medarbejder">Medarbejder</SelectItem>
                                                      <SelectItem value="rekruttering">Rekruttering</SelectItem>
                                                      <SelectItem value="teamleder">Teamleder</SelectItem>
                                                      <SelectItem value="ejer">Ejer</SelectItem>
                                                    </SelectContent>
                                                  </Select>
                                                ) : (
                                                  <span className="text-sm text-muted-foreground">
                                                    Kræver login
                                                  </span>
                                                )}
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                  onClick={() => handleDeleteClick(user)}
                                                >
                                                  <Trash2 className="h-4 w-4" />
                                                </Button>
                                              </div>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              })}
            </div>
          </TabsContent>

          {/* PERMISSIONS TAB */}
          <TabsContent value="permissions" className="space-y-6">
            <div className="flex items-center justify-between">
              <Alert className="flex-1">
                <Shield className="h-4 w-4" />
                <AlertTitle>Rollebaseret adgangskontrol</AlertTitle>
                <AlertDescription>
                  Klik på switchene for at tildele eller fjerne adgang til menupunkter. Ejer har altid fuld adgang.
                </AlertDescription>
              </Alert>
              <div className="flex items-center gap-2 ml-4">
                {hasChanges && (
                  <>
                    <Button variant="outline" size="sm" onClick={resetPermissions}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Nulstil
                    </Button>
                    <Button size="sm" onClick={savePermissions}>
                      <Save className="h-4 w-4 mr-2" />
                      Gem ændringer
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Combined Permissions matrix */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Rettigheder</span>
                  {hasChanges && (
                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                      Ikke gemt
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Klik på en switch for at ændre adgang. Ejer kan ikke redigeres.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px]">Menupunkt</TableHead>
                        <TableHead className="text-center">
                          <div className="flex items-center justify-center gap-1 text-blue-500">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            Salgskonsulent
                          </div>
                        </TableHead>
                        <TableHead className="text-center">
                          <div className="flex items-center justify-center gap-1 text-emerald-500">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            Fieldmarketing
                          </div>
                        </TableHead>
                        <TableHead className="text-center">
                          <div className="flex items-center justify-center gap-1 text-purple-500">
                            <Users className="h-4 w-4" />
                            Rekruttering
                          </div>
                        </TableHead>
                        <TableHead className="text-center">
                          <div className="flex items-center justify-center gap-1 text-blue-500">
                            <Users className="h-4 w-4" />
                            Teamleder
                          </div>
                        </TableHead>
                        <TableHead className="text-center">
                          <div className="flex items-center justify-center gap-1 text-amber-500">
                            <Crown className="h-4 w-4" />
                            Ejer
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(menuByCategory).map(([category, items]) => (
                        <>
                          <TableRow key={category} className="bg-muted/50">
                            <TableCell colSpan={6} className="font-semibold text-sm uppercase tracking-wide">
                              {category}
                            </TableCell>
                          </TableRow>
                          {items.map((item) => (
                            <TableRow key={item.id} className="hover:bg-muted/30">
                              <TableCell className="font-medium">{item.name}</TableCell>
                              {/* Salgskonsulent */}
                              <TableCell className="text-center">
                                <div className="flex justify-center">
                                  <Switch
                                    checked={editedJobTypePermissions.salgskonsulent?.includes(item.id) || false}
                                    onCheckedChange={() => toggleJobTypeMenuAccess("salgskonsulent", item.id)}
                                    className="cursor-pointer"
                                  />
                                </div>
                              </TableCell>
                              {/* Fieldmarketing */}
                              <TableCell className="text-center">
                                <div className="flex justify-center">
                                  <Switch
                                    checked={editedJobTypePermissions.fieldmarketing?.includes(item.id) || false}
                                    onCheckedChange={() => toggleJobTypeMenuAccess("fieldmarketing", item.id)}
                                    className="cursor-pointer"
                                  />
                                </div>
                              </TableCell>
                              {/* Rekruttering, Teamleder, Ejer */}
                              {(["rekruttering", "teamleder", "ejer"] as SystemRole[]).map((role) => {
                                const hasAccess = editedPermissions[role]?.includes(item.id) || false;
                                const isDisabled = role === "ejer";
                                return (
                                  <TableCell key={role} className="text-center">
                                    <div className="flex justify-center">
                                      <Switch
                                        checked={hasAccess}
                                        disabled={isDisabled}
                                        onCheckedChange={() => toggleMenuAccess(role, item.id)}
                                        className={isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                                      />
                                    </div>
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          ))}
                        </>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Individual user permissions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Individuelle tilføjelser
                </CardTitle>
                <CardDescription>
                  Giv specifikke brugere ekstra adgang ud over deres rolle. Klik på en bruger for at redigere.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Filter for users with individual permissions */}
                    <div className="flex items-center gap-4">
                      <Input
                        placeholder="Søg efter bruger..."
                        className="max-w-xs"
                        value={userPermissionSearch}
                        onChange={(e) => setUserPermissionSearch(e.target.value)}
                      />
                      <label className="flex items-center gap-2 text-sm">
                        <Switch
                          checked={showOnlyWithExtras}
                          onCheckedChange={setShowOnlyWithExtras}
                        />
                        Vis kun brugere med ekstra rettigheder
                      </label>
                    </div>
                    
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Bruger</TableHead>
                          <TableHead>Rolle</TableHead>
                          <TableHead>Ekstra adgang</TableHead>
                          <TableHead className="text-right">Handling</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsersForPermissions?.map((user) => {
                          const userExtras = individualPermissions?.filter(p => p.user_id === user.auth_user_id) || [];
                          const extraMenuNames = userExtras.map(p => menuItems.find(m => m.id === p.menu_item_id)?.name).filter(Boolean);
                          
                          return (
                            <TableRow 
                              key={user.employee_id}
                              className={selectedUserForPermissions?.employee_id === user.employee_id ? "bg-muted" : "hover:bg-muted/50 cursor-pointer"}
                              onClick={() => user.auth_user_id && setSelectedUserForPermissions(user)}
                            >
                              <TableCell className="font-medium">
                                {user.first_name} {user.last_name}
                              </TableCell>
                              <TableCell>{getRoleBadge(user.role)}</TableCell>
                              <TableCell>
                                {extraMenuNames.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {extraMenuNames.map((name, i) => (
                                      <Badge key={i} variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
                                        + {name}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-sm">Ingen</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {user.auth_user_id ? (
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedUserForPermissions(user);
                                    }}
                                  >
                                    Rediger
                                  </Button>
                                ) : (
                                  <span className="text-sm text-muted-foreground">Kræver login</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Landing pages config */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-5 w-5" />
                  Startsider
                </CardTitle>
                <CardDescription>
                  Vælg hvilken side hver gruppe ser som det første når de logger ind
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { key: "salgskonsulent", label: "Salgskonsulent", color: "bg-blue-500" },
                    { key: "fieldmarketing", label: "Fieldmarketing", color: "bg-emerald-500" },
                    { key: "rekruttering", label: "Rekruttering", color: "bg-purple-500" },
                    { key: "teamleder", label: "Teamleder", color: "bg-blue-500" },
                    { key: "ejer", label: "Ejer", color: "bg-amber-500" },
                  ].map(({ key, label, color }) => (
                    <div key={key} className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${color}`} />
                        {label}
                      </label>
                      <Select
                        value={landingPages[key] || ""}
                        onValueChange={(value) => updateLandingPage(key, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Vælg startside" />
                        </SelectTrigger>
                        <SelectContent>
                          {menuItems.map((item) => (
                            <SelectItem key={item.id} value={`/${item.id.replace(/-/g, "/")}`}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Data scope cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(["medarbejder", "rekruttering", "teamleder", "ejer"] as SystemRole[]).map((role) => {
                const info = rolePermissions[role];
                const label = roleLabels[role];
                const Icon = label.icon;
                return (
                  <Card key={role}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${label.color}`} />
                        {label.label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Datascope</p>
                        <p className="text-sm font-medium">{info.dataScope}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={info.canManageTeam ? "default" : "secondary"} className="text-xs">
                          {info.canManageTeam ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                          Team
                        </Badge>
                        <Badge variant={info.canManageAllData ? "default" : "secondary"} className="text-xs">
                          {info.canManageAllData ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                          Alle data
                        </Badge>
                        <Badge variant={info.canManageRoles ? "default" : "secondary"} className="text-xs">
                          {info.canManageRoles ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                          Roller
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* TEAMS TAB */}
          <TabsContent value="teams" className="space-y-6">
            <Alert>
              <Users className="h-4 w-4" />
              <AlertTitle>Teamdefinition</AlertTitle>
              <AlertDescription>
                Teams defineres via <strong>manager_id</strong> feltet i medarbejderdata. 
                Teamledere kan se alle medarbejdere hvor de selv er sat som manager.
                For at ændre teammedlemskab, rediger medarbejderens manager felt.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams?.map((team) => (
                <Card key={team.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{team.name}</CardTitle>
                    <CardDescription>
                      {team.team_leader_name ? (
                        <span className="flex items-center gap-1">
                          <Crown className="h-3 w-3 text-amber-500" />
                          {team.team_leader_name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Ingen teamleder</span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Medlemmer</span>
                      <Badge variant="secondary">{team.member_count}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(!teams || teams.length === 0) && (
                <Card className="col-span-full">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Ingen teams oprettet endnu
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Users without team assignment */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Brugere med tildelt manager</CardTitle>
                <CardDescription>
                  Oversigt over hvilke brugere der er tilknyttet en teamleder via manager_id
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Medarbejder</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Rolle</TableHead>
                        <TableHead>Manager tildelt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users?.slice(0, 15).map((user) => (
                        <TableRow key={user.employee_id}>
                          <TableCell className="font-medium">
                            {user.first_name} {user.last_name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {user.email || "-"}
                          </TableCell>
                          <TableCell>{getRoleBadge(user.role)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-muted-foreground">
                              Se medarbejderdata
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet medarbejder?</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på, at du vil slette{" "}
              <strong>{userToDelete?.first_name} {userToDelete?.last_name}</strong>?
              <br /><br />
              Denne handling kan ikke fortrydes. Alle data tilknyttet medarbejderen vil blive slettet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteEmployee.isPending ? "Sletter..." : "Slet medarbejder"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Individual permissions dialog */}
      <Dialog 
        open={!!selectedUserForPermissions} 
        onOpenChange={(open) => !open && setSelectedUserForPermissions(null)}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Rediger rettigheder for {selectedUserForPermissions?.first_name} {selectedUserForPermissions?.last_name}
            </DialogTitle>
            <DialogDescription>
              Rolle: {getRoleBadge(selectedUserForPermissions?.role || null)}
              <br />
              Tilføj ekstra menupunkter som denne bruger skal have adgang til ud over sin rolle.
            </DialogDescription>
          </DialogHeader>
          
          <div className="overflow-y-auto flex-1 py-4">
            <div className="space-y-4">
              {Object.entries(menuByCategory).map(([category, items]) => {
                const userRole = selectedUserForPermissions?.role || "medarbejder";
                const roleMenus = editedPermissions[userRole] || [];
                const userExtras = individualPermissions?.filter(
                  p => p.user_id === selectedUserForPermissions?.auth_user_id
                ).map(p => p.menu_item_id) || [];
                
                return (
                  <div key={category}>
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      {category}
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {items.map((item) => {
                        const isInRole = roleMenus.includes(item.id);
                        const isExtraPermission = userExtras.includes(item.id);
                        
                        return (
                          <div 
                            key={item.id} 
                            className={`flex items-center justify-between p-2 rounded-lg border ${
                              isInRole ? "bg-muted/50 border-muted" : 
                              isExtraPermission ? "bg-blue-500/10 border-blue-500/30" : 
                              "border-border"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{item.name}</span>
                              {isInRole && (
                                <Badge variant="secondary" className="text-xs">
                                  Fra rolle
                                </Badge>
                              )}
                              {isExtraPermission && (
                                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 text-xs">
                                  Tilføjet
                                </Badge>
                              )}
                            </div>
                            {!isInRole && selectedUserForPermissions?.auth_user_id && (
                              <Switch
                                checked={isExtraPermission}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    addIndividualPermission.mutate({
                                      userId: selectedUserForPermissions.auth_user_id!,
                                      menuItemId: item.id,
                                    });
                                  } else {
                                    removeIndividualPermission.mutate({
                                      userId: selectedUserForPermissions.auth_user_id!,
                                      menuItemId: item.id,
                                    });
                                  }
                                }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedUserForPermissions(null)}>
              Luk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
