import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Shield, ChevronDown, ChevronRight, Eye, Edit, Lock, Play } from "lucide-react";
import { Json } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// Owner position name - this position is locked and cannot be edited
const OWNER_POSITION_NAME = "Ejer";

const isOwnerPosition = (name: string) => name.toLowerCase() === OWNER_POSITION_NAME.toLowerCase();

interface Permission {
  key: string;
  label: string;
  description: string;
  hasEditOption?: boolean; // If true, show separate view/edit toggles
}

interface PermissionCategory {
  key: string;
  label: string;
  icon: string;
  permissions: Permission[];
}

const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    key: "menu_access",
    label: "Menu adgang",
    icon: "📱",
    permissions: [
      { key: "menu_dashboard", label: "Dashboard", description: "Adgang til dashboard oversigt", hasEditOption: false },
      { key: "menu_wallboard", label: "Wallboard", description: "Adgang til wallboard visning", hasEditOption: false },
      { key: "menu_mg_test", label: "MG Test", description: "Adgang til MG Test sektion", hasEditOption: true },
      { key: "menu_sales", label: "Salg", description: "Adgang til salgsdata", hasEditOption: true },
      { key: "menu_agents", label: "Agenter", description: "Adgang til agentdata", hasEditOption: true },
      { key: "menu_payroll", label: "Lønkørsel", description: "Adgang til lønkørsel", hasEditOption: true },
      { key: "menu_shift_planning", label: "Vagtplan", description: "Adgang til vagtplanlægning", hasEditOption: true },
      { key: "menu_recruitment", label: "Rekruttering", description: "Adgang til rekrutteringsmodul", hasEditOption: true },
      { key: "menu_contracts", label: "Kontrakter", description: "Adgang til kontraktmodul", hasEditOption: true },
      { key: "menu_some", label: "SOME", description: "Adgang til social media modul", hasEditOption: true },
      { key: "menu_settings", label: "Indstillinger", description: "Adgang til systemindstillinger", hasEditOption: true },
    ],
  },
  {
    key: "data_visibility",
    label: "Data synlighed",
    icon: "👁️",
    permissions: [
      { key: "view_own_revenue", label: "Se egen omsætning", description: "Kan se egne omsætningstal" },
      { key: "view_team_revenue", label: "Se team omsætning", description: "Kan se omsætning for eget team" },
      { key: "view_all_revenue", label: "Se al omsætning", description: "Kan se omsætning for hele virksomheden" },
      { key: "view_own_commission", label: "Se egen provision", description: "Kan se egne provisionstal" },
      { key: "view_team_commission", label: "Se team provision", description: "Kan se provision for eget team" },
      { key: "view_all_commission", label: "Se al provision", description: "Kan se provision for alle" },
      { key: "view_salary_data", label: "Se løndata", description: "Kan se lønoplysninger" },
      { key: "view_sensitive_data", label: "Se følsomme data", description: "Kan se CPR, bank info mv." },
    ],
  },
  {
    key: "employee_management",
    label: "Medarbejderstyring",
    icon: "👥",
    permissions: [
      { key: "create_employees", label: "Oprette medarbejdere", description: "Kan oprette nye medarbejdere" },
      { key: "edit_employees", label: "Redigere medarbejdere", description: "Kan redigere medarbejderdata" },
      { key: "delete_employees", label: "Slette medarbejdere", description: "Kan slette medarbejdere" },
      { key: "manage_teams", label: "Administrere teams", description: "Kan oprette og redigere teams" },
      { key: "assign_team_members", label: "Tildele teammedlemmer", description: "Kan tilføje/fjerne fra teams" },
      { key: "manage_positions", label: "Administrere stillinger", description: "Kan oprette og redigere stillinger" },
      { key: "assign_roles", label: "Tildele roller", description: "Kan tildele systemroller til brugere" },
    ],
  },
  {
    key: "contract_management",
    label: "Kontraktstyring",
    icon: "📄",
    permissions: [
      { key: "view_contracts", label: "Se kontrakter", description: "Kan se kontraktliste" },
      { key: "create_contracts", label: "Oprette kontrakter", description: "Kan oprette nye kontrakter" },
      { key: "send_contracts", label: "Sende kontrakter", description: "Kan sende kontrakter til underskrift" },
      { key: "edit_contract_templates", label: "Redigere skabeloner", description: "Kan ændre kontraktskabeloner" },
      { key: "delete_contracts", label: "Slette kontrakter", description: "Kan slette kontrakter" },
    ],
  },
  {
    key: "shift_management",
    label: "Vagtstyring",
    icon: "📅",
    permissions: [
      { key: "view_all_shifts", label: "Se alle vagter", description: "Kan se alle medarbejderes vagter" },
      { key: "create_shifts", label: "Oprette vagter", description: "Kan oprette nye vagter" },
      { key: "edit_shifts", label: "Redigere vagter", description: "Kan ændre eksisterende vagter" },
      { key: "approve_absence", label: "Godkende fravær", description: "Kan godkende fraværsanmodninger" },
      { key: "mark_sick", label: "Registrere sygdom", description: "Kan registrere medarbejdere som syge" },
      { key: "edit_time_stamps", label: "Redigere tidsstempler", description: "Kan ændre ind/ud-stemplinger" },
    ],
  },
  {
    key: "sales_data",
    label: "Salgsdata",
    icon: "💰",
    permissions: [
      { key: "view_sales", label: "Se salg", description: "Kan se salgsdata" },
      { key: "edit_sales", label: "Redigere salg", description: "Kan ændre salgsdata" },
      { key: "delete_sales", label: "Slette salg", description: "Kan slette salgsdata" },
      { key: "manage_products", label: "Administrere produkter", description: "Kan oprette/ændre produkter" },
      { key: "manage_campaigns", label: "Administrere kampagner", description: "Kan ændre kampagnemappings" },
      { key: "run_payroll", label: "Køre lønberegning", description: "Kan udføre lønkørsler" },
    ],
  },
  {
    key: "integrations",
    label: "Integrationer",
    icon: "🔌",
    permissions: [
      { key: "view_integrations", label: "Se integrationer", description: "Kan se integrationsopsætning" },
      { key: "manage_integrations", label: "Administrere integrationer", description: "Kan ændre API-integrationer" },
      { key: "view_logs", label: "Se logs", description: "Kan se integrationslogfiler" },
      { key: "trigger_sync", label: "Udføre synkronisering", description: "Kan manuelt starte datasynd" },
    ],
  },
  {
    key: "system",
    label: "System",
    icon: "⚙️",
    permissions: [
      { key: "manage_system_settings", label: "Systemindstillinger", description: "Kan ændre systemkonfiguration" },
      { key: "view_audit_logs", label: "Se aktivitetslog", description: "Kan se systemaktivitetslog" },
      { key: "manage_webhooks", label: "Administrere webhooks", description: "Kan ændre webhook-endpoints" },
      { key: "full_admin_access", label: "Fuld administratoradgang", description: "Har alle rettigheder i systemet" },
    ],
  },
];

// Generate all permissions with full access (must be after PERMISSION_CATEGORIES)
const generateAllPermissions = (): Record<string, boolean | { view: boolean; edit: boolean }> => {
  const allPermissions: Record<string, boolean | { view: boolean; edit: boolean }> = {};
  PERMISSION_CATEGORIES.forEach(category => {
    category.permissions.forEach(permission => {
      if (permission.hasEditOption) {
        allPermissions[permission.key] = { view: true, edit: true };
      } else {
        allPermissions[permission.key] = true;
      }
    });
  });
  return allPermissions;
};

interface JobPosition {
  id: string;
  name: string;
  description: string | null;
  permissions: Record<string, boolean | { view: boolean; edit: boolean }>;
  is_active: boolean;
  created_at: string;
}

interface FormData {
  name: string;
  description: string;
  permissions: Record<string, boolean | { view: boolean; edit: boolean }>;
}

export function PositionsTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<JobPosition | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    description: "",
    permissions: {},
  });
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  // Fetch positions
  const { data: positions = [], isLoading } = useQuery({
    queryKey: ["job-positions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_positions")
        .select("*")
        .order("name");
      
      if (error) throw error;
      return data.map(p => ({
        ...p,
        permissions: (p.permissions as Record<string, boolean | { view: boolean; edit: boolean }>) || {}
      })) as JobPosition[];
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase
        .from("job_positions")
        .insert({
          name: data.name,
          description: data.description || null,
          permissions: data.permissions as unknown as Json,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-positions"] });
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
          permissions: data.permissions as unknown as Json,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-positions"] });
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
      const { error } = await supabase
        .from("job_positions")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-positions"] });
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
      permissions: {},
    });
    setExpandedCategories([]);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (position: JobPosition) => {
    const isOwner = isOwnerPosition(position.name);
    setEditingPosition(position);
    setFormData({
      name: position.name,
      description: position.description || "",
      // For Ejer, always show all permissions as enabled
      permissions: isOwner ? generateAllPermissions() : position.permissions,
    });
    setExpandedCategories(PERMISSION_CATEGORIES.map(c => c.key));
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingPosition(null);
    setFormData({ name: "", description: "", permissions: {} });
    setExpandedCategories([]);
  };

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

  const toggleCategory = (categoryKey: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryKey)
        ? prev.filter(k => k !== categoryKey)
        : [...prev, categoryKey]
    );
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
    setFormData(prev => {
      const newPermissions = { ...prev.permissions };
      
      if (type) {
        const currentValue = typeof newPermissions[key] === "object" 
          ? newPermissions[key] as { view: boolean; edit: boolean }
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

  const countActivePermissions = (permissions: Record<string, boolean | { view: boolean; edit: boolean }>) => {
    let count = 0;
    Object.values(permissions).forEach(value => {
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
          <p className="text-sm text-muted-foreground">
            Definer stillinger og deres tilhørende rettigheder
          </p>
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
                          {isOwner ? getTotalPermissions() : countActivePermissions(displayPermissions)} af {getTotalPermissions()}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/role-preview/${position.id}`)}
                          title="Test stilling"
                          className="text-primary hover:text-primary"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
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
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEdit(position)}
                            >
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingPosition && isOwnerPosition(editingPosition.name) ? (
                <>
                  <Lock className="h-5 w-5 text-muted-foreground" />
                  Se rettigheder for Ejer
                </>
              ) : (
                editingPosition ? "Rediger stilling" : "Opret stilling"
              )}
            </DialogTitle>
            {editingPosition && isOwnerPosition(editingPosition.name) && (
              <p className="text-sm text-muted-foreground">
                Ejer-stillingen har alle rettigheder og kan ikke ændres.
              </p>
            )}
          </DialogHeader>

          <div className="space-y-6">
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
              <Label className="text-base font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Rettigheder
                {editingPosition && isOwnerPosition(editingPosition.name) && (
                  <Badge variant="secondary" className="gap-1 ml-2">
                    <Lock className="h-3 w-3" />
                    Alle rettigheder
                  </Badge>
                )}
              </Label>
              {!(editingPosition && isOwnerPosition(editingPosition.name)) && (
                <p className="text-sm text-muted-foreground">
                  Klik på en kategori for at udvide og konfigurere rettigheder
                </p>
              )}
              
              <div className="space-y-2 mt-4">
                {PERMISSION_CATEGORIES.map((category) => {
                  const isOwnerLocked = editingPosition && isOwnerPosition(editingPosition.name);
                  
                  return (
                    <Collapsible
                      key={category.key}
                      open={expandedCategories.includes(category.key)}
                      onOpenChange={() => toggleCategory(category.key)}
                    >
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-between px-4 py-3 h-auto hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{category.icon}</span>
                            <span className="font-medium">{category.label}</span>
                            <span className={cn(
                              "text-xs px-2 py-0.5 rounded-full",
                              isOwnerLocked
                                ? "bg-green-500/20 text-green-600"
                                : "text-muted-foreground bg-muted"
                            )}>
                              {isOwnerLocked 
                                ? `${category.permissions.length} / ${category.permissions.length}`
                                : `${category.permissions.filter(p => getPermissionValue(p.key)).length} / ${category.permissions.length}`
                              }
                            </span>
                          </div>
                          {expandedCategories.includes(category.key) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border rounded-lg mt-2 divide-y">
                          {category.permissions.map((permission) => (
                            <div
                              key={permission.key}
                              className={cn(
                                "flex items-center justify-between gap-4 px-4 py-3",
                                isOwnerLocked && "bg-green-500/5"
                              )}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm">{permission.label}</div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {permission.description}
                                </div>
                              </div>
                              
                              {permission.hasEditOption ? (
                                <div className="flex items-center gap-4">
                                  <div className="flex items-center gap-2">
                                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">Se</span>
                                    <Switch
                                      checked={isOwnerLocked ? true : getPermissionValue(permission.key, "view")}
                                      onCheckedChange={(checked) =>
                                        handlePermissionChange(permission.key, checked, "view")
                                      }
                                      disabled={!!isOwnerLocked}
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">Ret</span>
                                    <Switch
                                      checked={isOwnerLocked ? true : getPermissionValue(permission.key, "edit")}
                                      onCheckedChange={(checked) =>
                                        handlePermissionChange(permission.key, checked, "edit")
                                      }
                                      disabled={!!isOwnerLocked || !getPermissionValue(permission.key, "view")}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <Switch
                                  checked={isOwnerLocked ? true : getPermissionValue(permission.key)}
                                  onCheckedChange={(checked) =>
                                    handlePermissionChange(permission.key, checked)
                                  }
                                  disabled={!!isOwnerLocked}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              {editingPosition && isOwnerPosition(editingPosition.name) ? "Luk" : "Annuller"}
            </Button>
            {!(editingPosition && isOwnerPosition(editingPosition.name)) && (
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingPosition ? "Gem ændringer" : "Opret"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
