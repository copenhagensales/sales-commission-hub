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
import { Plus, Pencil, Trash2, Shield, ChevronDown, ChevronRight, Eye, Edit, Lock, Play, Info, LayoutGrid, Layers, Database, User, Users, Globe } from "lucide-react";
import { Json } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Owner position name - this position is locked and cannot be edited
const OWNER_POSITION_NAME = "Ejer";

const isOwnerPosition = (name: string) => name.toLowerCase() === OWNER_POSITION_NAME.toLowerCase();

type DataScope = "egen" | "team" | "alt";

interface Permission {
  key: string;
  label: string;
  description: string;
  hasEditOption?: boolean; // If true, show separate view/edit toggles
}

interface DataScopePermission {
  key: string;
  label: string;
  description: string;
}

interface PermissionCategory {
  key: string;
  label: string;
  icon: string;
  permissions: Permission[];
}

// Data scope permissions - applies to areas where users can see data about others
const DATA_SCOPE_PERMISSIONS: DataScopePermission[] = [
  { key: "scope_employees", label: "Medarbejdere", description: "Hvem kan brugeren se i medarbejderlisten" },
  { key: "scope_shifts", label: "Vagter", description: "Hvem kan brugeren se vagter for" },
  { key: "scope_absence", label: "Fravær", description: "Hvem kan brugeren se fraværsdata for" },
  { key: "scope_time_tracking", label: "Tidsregistrering", description: "Hvem kan brugeren se tidsregistreringer for" },
  { key: "scope_contracts", label: "Kontrakter", description: "Hvem kan brugeren se kontrakter for" },
  { key: "scope_payroll", label: "Løndata", description: "Hvem kan brugeren se løndata for" },
  { key: "scope_career_wishes", label: "Karriereønsker", description: "Hvem kan brugeren se karriereønsker for" },
];

const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    key: "menu_main",
    label: "Hovedmenuer",
    icon: "📱",
    permissions: [
      { key: "menu_dashboard", label: "Dashboard", description: "Adgang til dashboard oversigt", hasEditOption: false },
      { key: "menu_wallboard", label: "Wallboard", description: "Adgang til wallboard visning", hasEditOption: false },
      { key: "menu_some", label: "SOME", description: "Adgang til social media modul", hasEditOption: true },
      { key: "menu_sales", label: "Salg", description: "Adgang til salgsdata", hasEditOption: true },
      { key: "menu_logics", label: "Logikker", description: "Adgang til logikker", hasEditOption: true },
      { key: "menu_closing_shifts", label: "Lukkevagter", description: "Adgang til lukkevagter", hasEditOption: true },
    ],
  },
  {
    key: "menu_personnel",
    label: "Personale menu",
    icon: "👥",
    permissions: [
      { key: "menu_employees", label: "Medarbejdere", description: "Adgang til medarbejdersiden", hasEditOption: true },
      { key: "menu_teams", label: "Teams", description: "Adgang til teams", hasEditOption: true },
    ],
  },
  {
    key: "tabs_employees",
    label: "Medarbejdere faner",
    icon: "📑",
    permissions: [
      { key: "tab_employees_all", label: "Alle medarbejdere", description: "Adgang til alle medarbejdere fane", hasEditOption: true },
      { key: "tab_employees_dialer_mapping", label: "Dialer mapping", description: "Adgang til dialer mapping fane", hasEditOption: true },
      { key: "tab_employees_teams", label: "Teams fane", description: "Adgang til teams fane", hasEditOption: true },
      { key: "tab_employees_positions", label: "Stillinger", description: "Adgang til stillinger fane", hasEditOption: true },
    ],
  },
  {
    key: "menu_management",
    label: "Ledelse menu",
    icon: "👑",
    permissions: [
      { key: "menu_contracts", label: "Kontrakter", description: "Adgang til kontraktmodul", hasEditOption: true },
      { key: "menu_permissions", label: "Rettigheder", description: "Adgang til rettighedsstyring", hasEditOption: true },
      { key: "menu_career_wishes_overview", label: "Karriereønsker overblik", description: "Adgang til karriereønsker overblik", hasEditOption: true },
    ],
  },
  {
    key: "tabs_contracts",
    label: "Kontrakter faner",
    icon: "📑",
    permissions: [
      { key: "tab_contracts_all", label: "Alle kontrakter", description: "Adgang til alle kontrakter fane", hasEditOption: true },
      { key: "tab_contracts_templates", label: "Skabeloner", description: "Adgang til kontraktskabeloner fane", hasEditOption: true },
    ],
  },
  {
    key: "menu_test",
    label: "Test menu",
    icon: "🧪",
    permissions: [
      { key: "menu_car_quiz_admin", label: "Bil Quiz Admin", description: "Adgang til bil quiz administration", hasEditOption: true },
      { key: "menu_coc_admin", label: "Code of Conduct Admin", description: "Adgang til Code of Conduct administration", hasEditOption: true },
      { key: "menu_pulse_survey", label: "Pulsmåling resultater", description: "Adgang til pulsmåling resultater", hasEditOption: true },
    ],
  },
  {
    key: "tabs_car_quiz",
    label: "Bil Quiz faner",
    icon: "📑",
    permissions: [
      { key: "tab_car_quiz_questions", label: "Spørgsmål", description: "Adgang til quiz spørgsmål fane", hasEditOption: true },
      { key: "tab_car_quiz_submissions", label: "Besvarelser", description: "Adgang til besvarelser fane", hasEditOption: true },
    ],
  },
  {
    key: "tabs_coc",
    label: "Code of Conduct faner",
    icon: "📑",
    permissions: [
      { key: "tab_coc_questions", label: "Spørgsmål", description: "Adgang til CoC spørgsmål fane", hasEditOption: true },
      { key: "tab_coc_submissions", label: "Besvarelser", description: "Adgang til CoC besvarelser fane", hasEditOption: true },
    ],
  },
  {
    key: "tabs_pulse_survey",
    label: "Pulsmåling faner",
    icon: "📑",
    permissions: [
      { key: "tab_pulse_results", label: "Resultater", description: "Adgang til pulsmåling resultater fane", hasEditOption: true },
      { key: "tab_pulse_template", label: "Skabelon", description: "Adgang til pulsmåling skabelon fane", hasEditOption: true },
      { key: "tab_pulse_teams", label: "Team sammenligning", description: "Adgang til team sammenligning fane", hasEditOption: true },
    ],
  },
  {
    key: "menu_mg",
    label: "MG menu",
    icon: "📊",
    permissions: [
      { key: "menu_payroll", label: "Lønkørsel", description: "Adgang til lønkørsel", hasEditOption: true },
      { key: "menu_tdc_erhverv", label: "TDC Erhverv", description: "Adgang til TDC Erhverv dashboard", hasEditOption: true },
      { key: "menu_codan", label: "Codan", description: "Adgang til Codan dashboard", hasEditOption: true },
      { key: "menu_mg_test", label: "MG Test", description: "Adgang til MG Test", hasEditOption: true },
      { key: "menu_test_dashboard", label: "Test Dashboard", description: "Adgang til test dashboard", hasEditOption: true },
      { key: "menu_dialer_data", label: "Dialer Data", description: "Adgang til dialer data", hasEditOption: true },
      { key: "menu_calls_data", label: "Calls Data", description: "Adgang til opkaldsdata", hasEditOption: true },
      { key: "menu_adversus_data", label: "Adversus Data", description: "Adgang til Adversus data", hasEditOption: true },
    ],
  },
  {
    key: "tabs_mg_test",
    label: "MG Test faner",
    icon: "📑",
    permissions: [
      { key: "tab_mg_products", label: "Produkter", description: "Adgang til produkter fane", hasEditOption: true },
      { key: "tab_mg_campaigns", label: "Kampagner", description: "Adgang til kampagner fane", hasEditOption: true },
      { key: "tab_mg_customers", label: "Kunder", description: "Adgang til kunder fane", hasEditOption: true },
    ],
  },
  {
    key: "menu_shift_planning",
    label: "Vagtplan menu",
    icon: "📅",
    permissions: [
      { key: "menu_shift_overview", label: "Vagtplan oversigt", description: "Adgang til vagtplan oversigt", hasEditOption: true },
      { key: "menu_my_schedule", label: "Min kalender", description: "Adgang til egen kalender", hasEditOption: false },
      { key: "menu_absence", label: "Fravær", description: "Adgang til fraværsmodul", hasEditOption: true },
      { key: "menu_time_tracking", label: "Tidsregistrering", description: "Adgang til tidsregistrering", hasEditOption: true },
      { key: "menu_extra_work", label: "Ekstra arbejde", description: "Adgang til ekstra arbejde", hasEditOption: true },
      { key: "menu_extra_work_admin", label: "Ekstra arbejde admin", description: "Adgang til ekstra arbejde administration", hasEditOption: true },
    ],
  },
  {
    key: "menu_fieldmarketing",
    label: "Fieldmarketing menu",
    icon: "🚗",
    permissions: [
      { key: "menu_fm_overview", label: "Oversigt", description: "Adgang til fieldmarketing oversigt", hasEditOption: true },
      { key: "menu_fm_my_week", label: "Min uge", description: "Adgang til min uge", hasEditOption: false },
      { key: "menu_fm_book_week", label: "Book uge", description: "Adgang til book uge", hasEditOption: true },
      { key: "menu_fm_bookings", label: "Bookinger", description: "Adgang til bookinger", hasEditOption: true },
      { key: "menu_fm_locations", label: "Lokationer", description: "Adgang til lokationer", hasEditOption: true },
      { key: "menu_fm_vehicles", label: "Køretøjer", description: "Adgang til køretøjer", hasEditOption: true },
      { key: "menu_fm_billing", label: "Fakturering", description: "Adgang til fakturering", hasEditOption: true },
      { key: "menu_fm_time_off", label: "Fraværsanmodninger", description: "Adgang til fraværsanmodninger", hasEditOption: true },
    ],
  },
  {
    key: "menu_recruitment",
    label: "Rekruttering menu",
    icon: "🎯",
    permissions: [
      { key: "menu_recruitment_dashboard", label: "Rekruttering Dashboard", description: "Adgang til rekruttering dashboard", hasEditOption: true },
      { key: "menu_candidates", label: "Kandidater", description: "Adgang til kandidatliste", hasEditOption: true },
      { key: "menu_upcoming_interviews", label: "Kommende interviews", description: "Adgang til kommende interviews", hasEditOption: true },
      { key: "menu_winback", label: "Winback", description: "Adgang til winback", hasEditOption: true },
      { key: "menu_upcoming_hires", label: "Kommende ansættelser", description: "Adgang til kommende ansættelser", hasEditOption: true },
      { key: "menu_messages", label: "Beskeder", description: "Adgang til beskeder", hasEditOption: true },
      { key: "menu_sms_templates", label: "SMS skabeloner", description: "Adgang til SMS skabeloner", hasEditOption: true },
      { key: "menu_email_templates", label: "Email skabeloner", description: "Adgang til email skabeloner", hasEditOption: true },
    ],
  },
  {
    key: "menu_boards",
    label: "Boards menu",
    icon: "📺",
    permissions: [
      { key: "menu_boards_test", label: "Test Board", description: "Adgang til test board", hasEditOption: false },
      { key: "menu_boards_economic", label: "Economic Board", description: "Adgang til economic board", hasEditOption: false },
      { key: "menu_boards_sales", label: "Sales Dashboard", description: "Adgang til sales dashboard", hasEditOption: false },
    ],
  },
  {
    key: "menu_personal",
    label: "Personlige menuer",
    icon: "👤",
    permissions: [
      { key: "menu_my_profile", label: "Min profil", description: "Adgang til egen profil", hasEditOption: true },
      { key: "menu_my_contracts", label: "Mine kontrakter", description: "Adgang til egne kontrakter", hasEditOption: false },
      { key: "menu_career_wishes", label: "Karriereønsker", description: "Adgang til at udfylde karriereønsker", hasEditOption: false },
      { key: "menu_time_stamp", label: "Stempel ind/ud", description: "Adgang til stempel ind/ud", hasEditOption: false },
    ],
  },
  {
    key: "menu_system",
    label: "System menu",
    icon: "⚙️",
    permissions: [
      { key: "menu_settings", label: "Indstillinger", description: "Adgang til systemindstillinger", hasEditOption: true },
    ],
  },
  {
    key: "tabs_settings",
    label: "Indstillinger faner",
    icon: "📑",
    permissions: [
      { key: "tab_settings_api", label: "API Integrationer", description: "Adgang til API integrationer fane", hasEditOption: true },
      { key: "tab_settings_dialer", label: "Dialer Integrationer", description: "Adgang til dialer integrationer fane", hasEditOption: true },
      { key: "tab_settings_customer", label: "Kunde Integrationer", description: "Adgang til kunde integrationer fane", hasEditOption: true },
      { key: "tab_settings_webhooks", label: "Webhooks", description: "Adgang til webhooks fane", hasEditOption: true },
      { key: "tab_settings_logs", label: "Logs", description: "Adgang til integrationslog fane", hasEditOption: true },
      { key: "tab_settings_excel_crm", label: "Excel CRM Import", description: "Adgang til Excel CRM import fane", hasEditOption: true },
    ],
  },
];

// Generate all permissions with full access (must be after PERMISSION_CATEGORIES)
const generateAllPermissions = (): Record<string, boolean | { view: boolean; edit: boolean } | DataScope> => {
  const allPermissions: Record<string, boolean | { view: boolean; edit: boolean } | DataScope> = {};
  PERMISSION_CATEGORIES.forEach(category => {
    category.permissions.forEach(permission => {
      if (permission.hasEditOption) {
        allPermissions[permission.key] = { view: true, edit: true };
      } else {
        allPermissions[permission.key] = true;
      }
    });
  });
  // Add data scope permissions - owner sees all
  DATA_SCOPE_PERMISSIONS.forEach(scope => {
    allPermissions[scope.key] = "alt";
  });
  return allPermissions;
};

interface JobPosition {
  id: string;
  name: string;
  description: string | null;
  permissions: Record<string, boolean | { view: boolean; edit: boolean } | DataScope>;
  is_active: boolean;
  created_at: string;
}

interface FormData {
  name: string;
  description: string;
  permissions: Record<string, boolean | { view: boolean; edit: boolean } | DataScope>;
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
        permissions: (p.permissions as Record<string, boolean | { view: boolean; edit: boolean } | DataScope>) || {}
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

  const handleScopeChange = (key: string, scope: DataScope) => {
    setFormData(prev => ({
      ...prev,
      permissions: { ...prev.permissions, [key]: scope }
    }));
  };

  const getScopeValue = (key: string): DataScope => {
    const value = formData.permissions[key];
    if (value === "egen" || value === "team" || value === "alt") {
      return value;
    }
    return "egen"; // Default
  };

  const countActivePermissions = (permissions: Record<string, boolean | { view: boolean; edit: boolean } | DataScope>) => {
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
                        {!isOwner && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/role-preview/${position.id}`)}
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
              
              <TooltipProvider delayDuration={200}>
                <div className="space-y-3 mt-4">
                  {PERMISSION_CATEGORIES.map((category) => {
                    const isOwnerLocked = editingPosition && isOwnerPosition(editingPosition.name);
                    const isTabCategory = category.key.startsWith("tabs_");
                    const activeCount = isOwnerLocked 
                      ? category.permissions.length
                      : category.permissions.filter(p => getPermissionValue(p.key)).length;
                    
                    return (
                      <Collapsible
                        key={category.key}
                        open={expandedCategories.includes(category.key)}
                        onOpenChange={() => toggleCategory(category.key)}
                      >
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            className={cn(
                              "w-full justify-between px-4 py-3 h-auto hover:bg-muted/50 border rounded-lg",
                              isTabCategory && "ml-6 w-[calc(100%-1.5rem)] bg-muted/30 border-dashed",
                              expandedCategories.includes(category.key) && "border-primary/30"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              {isTabCategory ? (
                                <Layers className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <span className="text-lg">{category.icon}</span>
                              )}
                              <div className="text-left">
                                <span className="font-medium block">{category.label}</span>
                                {isTabCategory && (
                                  <span className="text-xs text-muted-foreground">Under-faner</span>
                                )}
                              </div>
                              <Badge 
                                variant={activeCount === category.permissions.length ? "default" : "secondary"}
                                className={cn(
                                  "ml-2",
                                  activeCount === category.permissions.length && "bg-green-600"
                                )}
                              >
                                {activeCount} / {category.permissions.length}
                              </Badge>
                            </div>
                            {expandedCategories.includes(category.key) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className={cn(
                            "border rounded-lg mt-2 overflow-hidden",
                            isTabCategory && "ml-6"
                          )}>
                            {category.permissions.map((permission, idx) => (
                              <div
                                key={permission.key}
                                className={cn(
                                  "flex items-center justify-between gap-4 px-4 py-3 transition-colors",
                                  isOwnerLocked && "bg-green-500/5",
                                  idx !== category.permissions.length - 1 && "border-b",
                                  !isOwnerLocked && "hover:bg-muted/30"
                                )}
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="cursor-help">
                                        <Info className="h-4 w-4 text-muted-foreground/60 hover:text-primary transition-colors" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="max-w-xs">
                                      <p className="font-medium mb-1">{permission.label}</p>
                                      <p className="text-muted-foreground text-xs">{permission.description}</p>
                                      {permission.hasEditOption && (
                                        <div className="mt-2 pt-2 border-t text-xs space-y-1">
                                          <p className="flex items-center gap-1.5">
                                            <Eye className="h-3 w-3" /> <strong>Se:</strong> Kan se indholdet
                                          </p>
                                          <p className="flex items-center gap-1.5">
                                            <Edit className="h-3 w-3" /> <strong>Ret:</strong> Kan ændre indholdet
                                          </p>
                                        </div>
                                      )}
                                    </TooltipContent>
                                  </Tooltip>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm">{permission.label}</div>
                                  </div>
                                </div>
                                
                                {permission.hasEditOption ? (
                                  <div className="flex items-center gap-6">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="flex items-center gap-2">
                                          <div className={cn(
                                            "flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors",
                                            (isOwnerLocked || getPermissionValue(permission.key, "view")) && "bg-primary/10"
                                          )}>
                                            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span className="text-xs font-medium">Se</span>
                                          </div>
                                          <Switch
                                            checked={isOwnerLocked ? true : getPermissionValue(permission.key, "view")}
                                            onCheckedChange={(checked) =>
                                              handlePermissionChange(permission.key, checked, "view")
                                            }
                                            disabled={!!isOwnerLocked}
                                          />
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>Kan se dette indhold</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="flex items-center gap-2">
                                          <div className={cn(
                                            "flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors",
                                            (isOwnerLocked || getPermissionValue(permission.key, "edit")) && "bg-orange-500/10"
                                          )}>
                                            <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span className="text-xs font-medium">Ret</span>
                                          </div>
                                          <Switch
                                            checked={isOwnerLocked ? true : getPermissionValue(permission.key, "edit")}
                                            onCheckedChange={(checked) =>
                                              handlePermissionChange(permission.key, checked, "edit")
                                            }
                                            disabled={!!isOwnerLocked || !getPermissionValue(permission.key, "view")}
                                          />
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {!getPermissionValue(permission.key, "view") 
                                          ? "Aktiver 'Se' først for at kunne redigere"
                                          : "Kan redigere dette indhold"
                                        }
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                ) : (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex items-center gap-2">
                                        <span className={cn(
                                          "text-xs font-medium px-2 py-1 rounded-md transition-colors",
                                          (isOwnerLocked || getPermissionValue(permission.key)) 
                                            ? "bg-green-500/10 text-green-700" 
                                            : "text-muted-foreground"
                                        )}>
                                          {(isOwnerLocked || getPermissionValue(permission.key)) ? "Aktiveret" : "Deaktiveret"}
                                        </span>
                                        <Switch
                                          checked={isOwnerLocked ? true : getPermissionValue(permission.key)}
                                          onCheckedChange={(checked) =>
                                            handlePermissionChange(permission.key, checked)
                                          }
                                          disabled={!!isOwnerLocked}
                                        />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>{permission.description}</TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
              </TooltipProvider>
            </div>

            {/* Data Scope Section */}
            <div className="space-y-2">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Database className="h-4 w-4" />
                Data synlighed
                {editingPosition && isOwnerPosition(editingPosition.name) && (
                  <Badge variant="secondary" className="gap-1 ml-2">
                    <Lock className="h-3 w-3" />
                    Fuld adgang
                  </Badge>
                )}
              </Label>
              {!(editingPosition && isOwnerPosition(editingPosition.name)) && (
                <p className="text-sm text-muted-foreground">
                  Bestem hvilke data brugeren kan se: egen (kun sig selv), team (sit team), eller alt (alle)
                </p>
              )}

              <div className="border rounded-lg mt-4 overflow-hidden">
                {DATA_SCOPE_PERMISSIONS.map((scopePerm, idx) => {
                  const isOwnerLocked = editingPosition && isOwnerPosition(editingPosition.name);
                  const currentScope = isOwnerLocked ? "alt" : getScopeValue(scopePerm.key);

                  return (
                    <div
                      key={scopePerm.key}
                      className={cn(
                        "flex items-center justify-between gap-4 px-4 py-3 transition-colors",
                        isOwnerLocked && "bg-green-500/5",
                        idx !== DATA_SCOPE_PERMISSIONS.length - 1 && "border-b",
                        !isOwnerLocked && "hover:bg-muted/30"
                      )}
                    >
                      <TooltipProvider delayDuration={200}>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="cursor-help">
                                <Info className="h-4 w-4 text-muted-foreground/60 hover:text-primary transition-colors" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs">
                              <p className="font-medium mb-1">{scopePerm.label}</p>
                              <p className="text-muted-foreground text-xs">{scopePerm.description}</p>
                            </TooltipContent>
                          </Tooltip>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{scopePerm.label}</div>
                          </div>
                        </div>
                      </TooltipProvider>

                      <RadioGroup
                        value={currentScope}
                        onValueChange={(value) => handleScopeChange(scopePerm.key, value as DataScope)}
                        className="flex items-center gap-4"
                        disabled={!!isOwnerLocked}
                      >
                        <div className="flex items-center gap-1.5">
                          <RadioGroupItem value="egen" id={`${scopePerm.key}-egen`} />
                          <Label 
                            htmlFor={`${scopePerm.key}-egen`} 
                            className={cn(
                              "text-xs font-medium cursor-pointer flex items-center gap-1",
                              currentScope === "egen" && "text-primary"
                            )}
                          >
                            <User className="h-3 w-3" />
                            Egen
                          </Label>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <RadioGroupItem value="team" id={`${scopePerm.key}-team`} />
                          <Label 
                            htmlFor={`${scopePerm.key}-team`} 
                            className={cn(
                              "text-xs font-medium cursor-pointer flex items-center gap-1",
                              currentScope === "team" && "text-primary"
                            )}
                          >
                            <Users className="h-3 w-3" />
                            Team
                          </Label>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <RadioGroupItem value="alt" id={`${scopePerm.key}-alt`} />
                          <Label 
                            htmlFor={`${scopePerm.key}-alt`} 
                            className={cn(
                              "text-xs font-medium cursor-pointer flex items-center gap-1",
                              currentScope === "alt" && "text-primary"
                            )}
                          >
                            <Globe className="h-3 w-3" />
                            Alt
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
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
