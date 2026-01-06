import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Shield,
  Eye,
  Edit,
  Lock,
  Play,
  Info,
  Layers,
  Database,
  User,
  Users,
  Globe,
  Search,
  Settings,
  Check,
  X,
  ChevronDown,
} from "lucide-react";
import { Json } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PERMISSION_CATEGORIES,
  LANDING_PAGE_OPTIONS,
  generateAllPermissions,
  type DataScope,
  type Permission,
  type PermissionCategory,
} from "@/config/permissions";

// Owner position name - this position is locked and cannot be edited
const OWNER_POSITION_NAME = "Ejer";

const isOwnerPosition = (name: string) => name.toLowerCase() === OWNER_POSITION_NAME.toLowerCase();

interface JobPosition {
  id: string;
  name: string;
  description: string | null;
  default_landing_page: string | null;
  permissions: Record<string, boolean | { view: boolean; edit: boolean } | DataScope>;
  is_active: boolean;
  created_at: string;
  requires_mfa: boolean;
  session_timeout_minutes: number;
  max_session_hours: number;
}

interface FormData {
  name: string;
  description: string;
  default_landing_page: string;
  permissions: Record<string, boolean | { view: boolean; edit: boolean } | DataScope>;
  requires_mfa: boolean;
  session_timeout_minutes: number;
  max_session_hours: number;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  private_email: string | null;
  job_title: string | null;
}

export function PositionsTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<JobPosition | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    description: "",
    default_landing_page: "/home",
    permissions: {},
    requires_mfa: false,
    session_timeout_minutes: 60,
    max_session_hours: 10,
  });
  const [permissionSearch, setPermissionSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Test dialog state
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [testPosition, setTestPosition] = useState<JobPosition | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [employeeSearch, setEmployeeSearch] = useState("");

  // Fetch positions
  const { data: positions = [], isLoading } = useQuery({
    queryKey: ["job-positions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("job_positions").select("*").order("name");

      if (error) throw error;
      return data.map((p) => ({
        ...p,
        permissions: (p.permissions as Record<string, boolean | { view: boolean; edit: boolean } | DataScope>) || {},
      })) as JobPosition[];
    },
  });

  // Fetch employees for test selection
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-for-test"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, private_email, job_title")
        .eq("is_active", true)
        .order("first_name");

      if (error) throw error;
      return data as Employee[];
    },
  });

  // Filter employees based on search
  const filteredEmployees = useMemo(() => {
    if (!employeeSearch.trim()) return employees;
    const search = employeeSearch.toLowerCase();
    return employees.filter(
      (e) =>
        `${e.first_name} ${e.last_name}`.toLowerCase().includes(search) ||
        e.private_email?.toLowerCase().includes(search) ||
        e.job_title?.toLowerCase().includes(search),
    );
  }, [employees, employeeSearch]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase.from("job_positions").insert({
        name: data.name,
        description: data.description || null,
        default_landing_page: data.default_landing_page || "/home",
        permissions: data.permissions as unknown as Json,
        requires_mfa: data.requires_mfa,
        session_timeout_minutes: data.session_timeout_minutes,
        max_session_hours: data.max_session_hours,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-positions"] });
      queryClient.invalidateQueries({ queryKey: ["position-permissions"] });
      toast.success("Stilling oprettet");
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error("Fejl ved oprettelse: " + error.message);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      const { error } = await supabase
        .from("job_positions")
        .update({
          name: data.name,
          description: data.description || null,
          default_landing_page: data.default_landing_page || "/home",
          permissions: data.permissions as unknown as Json,
          requires_mfa: data.requires_mfa,
          session_timeout_minutes: data.session_timeout_minutes,
          max_session_hours: data.max_session_hours,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-positions"] });
      queryClient.invalidateQueries({ queryKey: ["position-permissions"] });
      toast.success("Stilling opdateret");
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error("Fejl ved opdatering: " + error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("job_positions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-positions"] });
      queryClient.invalidateQueries({ queryKey: ["position-permissions"] });
      toast.success("Stilling slettet");
    },
    onError: (error: Error) => {
      toast.error("Fejl ved sletning: " + error.message);
    },
  });

  const handleOpenCreate = () => {
    setEditingPosition(null);
    setFormData({
      name: "",
      description: "",
      default_landing_page: "/home",
      permissions: {},
      requires_mfa: false,
      session_timeout_minutes: 60,
      max_session_hours: 10,
    });
    setPermissionSearch("");
    setActiveCategory(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (position: JobPosition) => {
    const isOwner = isOwnerPosition(position.name);
    setEditingPosition(position);
    setFormData({
      name: position.name,
      description: position.description || "",
      default_landing_page: position.default_landing_page || "/home",
      permissions: isOwner ? generateAllPermissions() : position.permissions,
      requires_mfa: isOwner ? true : position.requires_mfa ?? false,
      session_timeout_minutes: position.session_timeout_minutes ?? 60,
      max_session_hours: position.max_session_hours ?? 10,
    });
    setPermissionSearch("");
    setActiveCategory(null);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingPosition(null);
    setFormData({
      name: "",
      description: "",
      default_landing_page: "/home",
      permissions: {},
      requires_mfa: false,
      session_timeout_minutes: 60,
      max_session_hours: 10,
    });
    setPermissionSearch("");
    setActiveCategory(null);
  };

  const handleOpenTest = (position: JobPosition) => {
    setTestPosition(position);
    setSelectedEmployeeId("");
    setEmployeeSearch("");
    setIsTestDialogOpen(true);
  };

  const handleStartTest = () => {
    if (!testPosition) return;

    const employeeParam = selectedEmployeeId ? `?employee=${selectedEmployeeId}` : "";
    navigate(`/role-preview/${testPosition.id}${employeeParam}`);
    setIsTestDialogOpen(false);
  };

  // Filter categories and permissions based on search
  const filteredCategories = useMemo(() => {
    if (!permissionSearch.trim()) return PERMISSION_CATEGORIES;
    const search = permissionSearch.toLowerCase();
    return PERMISSION_CATEGORIES.map((cat) => ({
      ...cat,
      permissions: cat.permissions.filter(
        (p) => p.label.toLowerCase().includes(search) || p.description.toLowerCase().includes(search),
      ),
    })).filter((cat) => cat.permissions.length > 0);
  }, [permissionSearch]);

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error("Navn er påkrævet");
      return;
    }

    if (editingPosition) {
      updateMutation.mutate({ id: editingPosition.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };
  const getPermissionValue = (key: string, type?: "view" | "edit"): boolean => {
    const value = formData.permissions[key];
    if (type) {
      if (typeof value === "object" && value !== null) {
        return value[type] || false;
      }
      return false;
    }
    if (typeof value === "boolean") return value;
    if (typeof value === "object" && value !== null) {
      return value.view || value.edit || false;
    }
    return false;
  };

  const handlePermissionChange = (key: string, checked: boolean, type?: "view" | "edit") => {
    setFormData((prev) => {
      const newPermissions = { ...prev.permissions };

      if (type) {
        const currentValue =
          typeof newPermissions[key] === "object"
            ? (newPermissions[key] as { view: boolean; edit: boolean })
            : { view: false, edit: false };

        if (type === "edit" && checked) {
          // If enabling edit, also enable view
          newPermissions[key] = { view: true, edit: true };
        } else if (type === "view" && !checked) {
          // If disabling view, also disable edit
          newPermissions[key] = { view: false, edit: false };
        } else {
          newPermissions[key] = { ...currentValue, [type]: checked };
        }
      } else {
        newPermissions[key] = checked;
      }

      return { ...prev, permissions: newPermissions };
    });
  };

  const handleScopeChange = (key: string, scope: DataScope) => {
    setFormData((prev) => ({
      ...prev,
      permissions: { ...prev.permissions, [key]: scope },
    }));
  };

  const getScopeValue = (key: string): DataScope => {
    const value = formData.permissions[key];
    if (value === "egen" || value === "team" || value === "alt") {
      return value;
    }
    return "egen"; // Default
  };

  const countActivePermissions = (
    permissions: Record<string, boolean | { view: boolean; edit: boolean } | DataScope> | null | undefined,
  ) => {
    if (!permissions) return 0;
    let count = 0;
    Object.entries(permissions).forEach(([key, value]) => {
      // Don't count data scope permissions in this count
      if (key.startsWith("scope_")) return;
      if (typeof value === "boolean" && value) count++;
      if (typeof value === "object" && value !== null && (value.view || value.edit)) count++;
    });
    return count;
  };

  const getTotalPermissions = () => {
    return PERMISSION_CATEGORIES.reduce((acc, cat) => acc + cat.permissions.length, 0);
  };

  if (isLoading) {
    return <div className="p-4">Indlæser...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Stillinger</h2>
          <p className="text-sm text-muted-foreground">Definer stillinger og deres tilhørende rettigheder</p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Opret stilling
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Navn</TableHead>
            <TableHead>Beskrivelse</TableHead>
            <TableHead>Rettigheder</TableHead>
            <TableHead className="w-[100px]">Handlinger</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Ingen stillinger oprettet endnu
              </TableCell>
            </TableRow>
          ) : (
            positions.map((position) => {
              const isOwner = isOwnerPosition(position.name);
              const displayPermissions = isOwner ? generateAllPermissions() : position.permissions;

              return (
                <TableRow key={position.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {position.name}
                      {isOwner && (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <Lock className="h-3 w-3" />
                          Låst
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">
                    {position.description || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {isOwner ? getTotalPermissions() : countActivePermissions(displayPermissions)} af{" "}
                        {getTotalPermissions()}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {!isOwner && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenTest(position)}
                          title="Test"
                          className="text-primary hover:text-primary"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      {isOwner ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(position)}
                          title="Se rettigheder (kan ikke redigeres)"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      ) : (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(position)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Er du sikker på at du vil slette denne stilling?")) {
                                deleteMutation.mutate(position.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              {editingPosition && isOwnerPosition(editingPosition.name) ? (
                <>
                  <Lock className="h-5 w-5 text-muted-foreground" />
                  Se rettigheder for Ejer
                </>
              ) : editingPosition ? (
                "Rediger stilling"
              ) : (
                "Opret stilling"
              )}
            </DialogTitle>
            {editingPosition && isOwnerPosition(editingPosition.name) && (
              <p className="text-sm text-muted-foreground">Ejer-stillingen har alle rettigheder og kan ikke ændres.</p>
            )}
          </DialogHeader>

          <Tabs defaultValue="basic" className="flex-1 flex flex-col min-h-0">
            <TabsList className="mx-6 mt-4 w-fit">
              <TabsTrigger value="basic" className="gap-2">
                <Settings className="h-4 w-4" />
                Grundlæggende
              </TabsTrigger>
              <TabsTrigger value="permissions" className="gap-2">
                <Shield className="h-4 w-4" />
                Rettigheder
                <Badge variant="secondary" className="ml-1">
                  {countActivePermissions(formData.permissions)}/{getTotalPermissions()}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="security" className="gap-2">
                <Lock className="h-4 w-4" />
                Sikkerhed
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="flex-1 px-6 py-4 overflow-auto">
              <div className="space-y-6 max-w-xl">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Navn *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="F.eks. Teamleder"
                      disabled={editingPosition && isOwnerPosition(editingPosition.name)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Beskrivelse</Label>
                    <Input
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Kort beskrivelse"
                      disabled={editingPosition && isOwnerPosition(editingPosition.name)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Standardside ved login</Label>
                  <Select
                    value={formData.default_landing_page}
                    onValueChange={(value) => setFormData({ ...formData, default_landing_page: value })}
                    disabled={editingPosition && isOwnerPosition(editingPosition.name)}
                  >
                    <SelectTrigger className="w-full max-w-xs">
                      <SelectValue placeholder="Vælg startside" />
                    </SelectTrigger>
                    <SelectContent className="z-50 bg-popover">
                      {LANDING_PAGE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Siden medarbejdere med denne stilling ser først ved login
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="permissions" className="flex-1 flex flex-col min-h-0 overflow-hidden px-6 py-4">
              {/* Search */}
              <div className="flex gap-4 mb-4 flex-shrink-0">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Søg i rettigheder..."
                    value={permissionSearch}
                    onChange={(e) => setPermissionSearch(e.target.value)}
                    className="pl-9"
                    disabled={editingPosition && isOwnerPosition(editingPosition.name)}
                  />
                </div>
              </div>

              {/* Categories accordion */}
              <ScrollArea className="flex-1 min-h-0 -mx-2 px-2">
                <TooltipProvider delayDuration={200}>
                  <div className="space-y-2 pb-4">
                    {filteredCategories
                      .filter((c) => !c.key.startsWith("tabs_"))
                      .map((category) => {
                        const isOwnerLocked = editingPosition && isOwnerPosition(editingPosition.name);
                        const activeCount = isOwnerLocked
                          ? category.permissions.length
                          : category.permissions.filter((p) => getPermissionValue(p.key)).length;

                        // Find associated tab categories for this menu
                        const tabCategories = filteredCategories.filter(
                          (c) =>
                            c.key.startsWith("tabs_") &&
                            c.key.replace("tabs_", "menu_").replace(/_.*$/, "") ===
                              category.key.replace("menu_", "").replace(/_.*$/, ""),
                        );

                        // Calculate total tabs count
                        const totalTabsCount = tabCategories.reduce((sum, tc) => sum + tc.permissions.length, 0);
                        const activeTabsCount = isOwnerLocked
                          ? totalTabsCount
                          : tabCategories.reduce(
                              (sum, tc) => sum + tc.permissions.filter((p) => getPermissionValue(p.key)).length,
                              0,
                            );

                        const isExpanded = activeCategory === category.key;
                        const hasAllPermissions =
                          activeCount === category.permissions.length &&
                          (totalTabsCount === 0 || activeTabsCount === totalTabsCount);

                        return (
                          <Card
                            key={category.key}
                            className={cn(
                              "overflow-hidden transition-colors",
                              hasAllPermissions && !isOwnerLocked && "border-green-500/50",
                              isExpanded && "ring-1 ring-primary/30",
                            )}
                          >
                            {/* Clickable header */}
                            <button
                              type="button"
                              onClick={() => setActiveCategory(isExpanded ? null : category.key)}
                              className={cn(
                                "w-full py-3 px-4 flex items-center justify-between gap-3 transition-colors text-left",
                                isExpanded ? "bg-primary/10" : "bg-muted/30 hover:bg-muted/50",
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-xl">{category.icon}</span>
                                <div className="text-left">
                                  <div className="text-sm font-medium">{category.label}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {category.permissions.length} menupunkter
                                    {totalTabsCount > 0 && ` • ${totalTabsCount} faner`}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={hasAllPermissions ? "default" : "secondary"}
                                  className={cn("text-xs", hasAllPermissions && !isOwnerLocked && "bg-green-600")}
                                >
                                  {activeCount + activeTabsCount}/{category.permissions.length + totalTabsCount}
                                </Badge>
                                <ChevronDown
                                  className={cn(
                                    "h-4 w-4 text-muted-foreground transition-transform",
                                    isExpanded && "rotate-180",
                                  )}
                                />
                              </div>
                            </button>

                            {/* Expandable content */}
                            {isExpanded && (
                              <CardContent className="p-0">
                                {/* Menu permissions */}
                                <div className="border-t">
                                  <div className="px-4 py-2 bg-muted/20 text-xs font-medium text-muted-foreground flex items-center gap-1.5 border-b">
                                    <Shield className="h-3.5 w-3.5" />
                                    Menupunkter
                                  </div>
                                  <div className="divide-y">
                                    {category.permissions.map((permission) => (
                                      <PermissionRow
                                        key={permission.key}
                                        permission={permission}
                                        isOwnerLocked={!!isOwnerLocked}
                                        getPermissionValue={getPermissionValue}
                                        handlePermissionChange={handlePermissionChange}
                                        getScopeValue={getScopeValue}
                                        handleScopeChange={handleScopeChange}
                                      />
                                    ))}
                                  </div>
                                </div>

                                {/* Associated tabs - grouped by category */}
                                {tabCategories.map(
                                  (tabCategory) =>
                                    tabCategory.permissions.length > 0 && (
                                      <div key={tabCategory.key} className="border-t bg-muted/10">
                                        <div className="px-4 py-2 bg-muted/20 text-xs font-medium text-muted-foreground flex items-center gap-1.5 border-b">
                                          <Layers className="h-3.5 w-3.5" />
                                          {tabCategory.label}
                                        </div>
                                        <div className="divide-y">
                                          {tabCategory.permissions.map((permission) => (
                                            <PermissionRow
                                              key={permission.key}
                                              permission={permission}
                                              isOwnerLocked={!!isOwnerLocked}
                                              getPermissionValue={getPermissionValue}
                                              handlePermissionChange={handlePermissionChange}
                                              getScopeValue={getScopeValue}
                                              handleScopeChange={handleScopeChange}
                                              isSubItem
                                            />
                                          ))}
                                        </div>
                                      </div>
                                    ),
                                )}
                              </CardContent>
                            )}
                          </Card>
                        );
                      })}
                  </div>
                </TooltipProvider>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="security" className="flex-1 px-6 py-4 overflow-auto">
              <div className="space-y-6 max-w-xl">
                {/* MFA Settings */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      To-faktor-godkendelse (MFA)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="requires-mfa">Kræv MFA for denne stilling</Label>
                        <p className="text-xs text-muted-foreground">
                          Medarbejdere med denne stilling skal bruge en authenticator-app ved login
                        </p>
                      </div>
                      <Switch
                        id="requires-mfa"
                        checked={formData.requires_mfa}
                        onCheckedChange={(checked) => setFormData({ ...formData, requires_mfa: checked })}
                        disabled={editingPosition && isOwnerPosition(editingPosition.name)}
                      />
                    </div>
                    {editingPosition && isOwnerPosition(editingPosition.name) && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                        <Info className="h-3.5 w-3.5" />
                        Ejer-stillingen har altid MFA aktiveret
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Session Timeout Settings */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Session-indstillinger
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="session-timeout">Inaktivitets-timeout (minutter)</Label>
                        <Input
                          id="session-timeout"
                          type="number"
                          min={5}
                          max={480}
                          value={formData.session_timeout_minutes}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            session_timeout_minutes: Math.max(5, Math.min(480, parseInt(e.target.value) || 60))
                          })}
                          disabled={editingPosition && isOwnerPosition(editingPosition.name)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Tid før automatisk logout ved inaktivitet
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="max-session">Max session-varighed (timer)</Label>
                        <Input
                          id="max-session"
                          type="number"
                          min={1}
                          max={24}
                          value={formData.max_session_hours}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            max_session_hours: Math.max(1, Math.min(24, parseInt(e.target.value) || 10))
                          })}
                          disabled={editingPosition && isOwnerPosition(editingPosition.name)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Maksimal tid før tvungen logout
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="px-6 py-4 border-t">
            <Button variant="outline" onClick={handleCloseDialog}>
              {editingPosition && isOwnerPosition(editingPosition.name) ? "Luk" : "Annuller"}
            </Button>
            {!(editingPosition && isOwnerPosition(editingPosition.name)) && (
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                {editingPosition ? "Gem ændringer" : "Opret"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Position Dialog */}
      <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-5 w-5 text-primary" />
              Test stilling: {testPosition?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Vælg en medarbejder hvis data du vil se i preview, eller start uden valg for at se generelt view.
            </p>

            <div className="space-y-2">
              <Label>Søg medarbejder</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Søg efter navn, email eller stilling..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Vælg medarbejder (valgfrit)</Label>
              <ScrollArea className="h-[200px] border rounded-md">
                <div className="p-1">
                  <div
                    className={cn(
                      "flex items-center gap-3 p-2 rounded cursor-pointer transition-colors",
                      selectedEmployeeId === "" ? "bg-primary/10 text-primary" : "hover:bg-muted",
                    )}
                    onClick={() => setSelectedEmployeeId("")}
                  >
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Ingen medarbejder valgt</span>
                  </div>
                  {filteredEmployees.map((employee) => (
                    <div
                      key={employee.id}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded cursor-pointer transition-colors",
                        selectedEmployeeId === employee.id ? "bg-primary/10 text-primary" : "hover:bg-muted",
                      )}
                      onClick={() => setSelectedEmployeeId(employee.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {employee.first_name} {employee.last_name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {employee.private_email || "Ingen email"}
                          {employee.job_title && ` • ${employee.job_title}`}
                        </div>
                      </div>
                      {selectedEmployeeId === employee.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </div>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <div className="p-4 text-center text-sm text-muted-foreground">Ingen medarbejdere fundet</div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTestDialogOpen(false)}>
              Annuller
            </Button>
            <Button onClick={handleStartTest}>
              <Play className="h-4 w-4 mr-2" />
              Start test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Separate component for permission row to keep things clean
function PermissionRow({
  permission,
  isOwnerLocked,
  getPermissionValue,
  handlePermissionChange,
  getScopeValue,
  handleScopeChange,
  isSubItem = false,
}: {
  permission: Permission;
  isOwnerLocked: boolean;
  getPermissionValue: (key: string, type?: "view" | "edit") => boolean;
  handlePermissionChange: (key: string, checked: boolean, type?: "view" | "edit") => void;
  getScopeValue: (key: string) => DataScope;
  handleScopeChange: (key: string, scope: DataScope) => void;
  isSubItem?: boolean;
}) {
  const hasView = isOwnerLocked || getPermissionValue(permission.key, "view");
  const hasEdit = isOwnerLocked || getPermissionValue(permission.key, "edit");
  const isActive = isOwnerLocked || getPermissionValue(permission.key);

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-3 py-2.5 transition-colors",
        isOwnerLocked && "bg-green-500/5",
        !isOwnerLocked && "hover:bg-muted/30",
        isSubItem && "pl-6 bg-muted/10",
      )}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-primary cursor-help shrink-0" />
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <p className="font-medium mb-1">{permission.label}</p>
            <p className="text-muted-foreground text-xs">{permission.description}</p>
          </TooltipContent>
        </Tooltip>
        <span className={cn("text-sm truncate", isActive ? "text-foreground" : "text-muted-foreground")}>
          {permission.label}
        </span>
      </div>

      {permission.hasEditOption ? (
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 bg-muted/50 rounded-md px-1.5 py-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => !isOwnerLocked && handlePermissionChange(permission.key, !hasView, "view")}
                  disabled={isOwnerLocked}
                  className={cn(
                    "flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors",
                    hasView ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                    isOwnerLocked && "cursor-default",
                  )}
                >
                  <Eye className="h-3 w-3" />
                  Se
                </button>
              </TooltipTrigger>
              <TooltipContent>Kan se indhold</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => !isOwnerLocked && handlePermissionChange(permission.key, !hasEdit, "edit")}
                  disabled={isOwnerLocked || !hasView}
                  className={cn(
                    "flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors",
                    hasEdit ? "bg-orange-500 text-white" : "text-muted-foreground hover:bg-muted",
                    (isOwnerLocked || !hasView) && "cursor-default opacity-50",
                  )}
                >
                  <Edit className="h-3 w-3" />
                  Ret
                </button>
              </TooltipTrigger>
              <TooltipContent>{!hasView ? "Aktiver 'Se' først" : "Kan redigere indhold"}</TooltipContent>
            </Tooltip>
          </div>
          {/* 
          {permission.scopeKey && hasView && (
            <div className="flex items-center gap-1 text-xs border-l pl-2">
              <Database className="h-3 w-3 text-muted-foreground" />
              <RadioGroup
                value={isOwnerLocked ? "alt" : getScopeValue(permission.scopeKey)}
                onValueChange={(value) => handleScopeChange(permission.scopeKey!, value as DataScope)}
                className="flex items-center gap-1"
                disabled={isOwnerLocked}
              >
                {[
                  { value: "egen", icon: User, label: "Egen" },
                  { value: "team", icon: Users, label: "Team" },
                  { value: "alt", icon: Globe, label: "Alt" },
                ].map(({ value, icon: Icon, label }) => (
                  <Tooltip key={value}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center">
                        <RadioGroupItem value={value} id={`${permission.scopeKey}-${value}`} className="sr-only" />
                        <Label 
                          htmlFor={`${permission.scopeKey}-${value}`} 
                          className={cn(
                            "px-1.5 py-0.5 rounded cursor-pointer flex items-center gap-0.5 transition-colors",
                            (isOwnerLocked ? "alt" : getScopeValue(permission.scopeKey!)) === value 
                              ? "bg-primary/20 text-primary font-medium" 
                              : "text-muted-foreground hover:bg-muted",
                            isOwnerLocked && "cursor-default"
                          )}
                        >
                          <Icon className="h-3 w-3" />
                        </Label>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>{label} data</TooltipContent>
                  </Tooltip>
                ))}
              </RadioGroup>
            </div>
          )} */}
        </div>
      ) : (
        <Switch
          checked={isActive}
          onCheckedChange={(checked) => handlePermissionChange(permission.key, checked)}
          disabled={isOwnerLocked}
        />
      )}
    </div>
  );
}
