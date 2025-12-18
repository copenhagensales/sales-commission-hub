import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Shield, Eye, Edit, Lock, Play, Info, Layers, Database, User, Users, Globe, Search, Settings, Check, X } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Owner position name - this position is locked and cannot be edited
const OWNER_POSITION_NAME = "Ejer";

const isOwnerPosition = (name: string) => name.toLowerCase() === OWNER_POSITION_NAME.toLowerCase();

type DataScope = "egen" | "team" | "alt";

interface Permission {
  key: string;
  label: string;
  description: string;
  hasEditOption?: boolean; // If true, show separate view/edit toggles
  scopeKey?: string; // If set, show data scope selector (egen/team/alt)
}

interface PermissionCategory {
  key: string;
  label: string;
  icon: string;
  permissions: Permission[];
}

const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    key: "menu_main",
    label: "Hovedmenuer",
    icon: "📱",
    permissions: [
      { key: "menu_dashboard", label: "Dashboard", description: "Adgang til dashboard oversigt", hasEditOption: false },
      { key: "menu_home_goals", label: "Hjem mål", description: "Ret til at ændre virksomhedens kundemål på hjemsiden", hasEditOption: true },
      { key: "menu_some", label: "SOME", description: "Adgang til social media modul", hasEditOption: true },
      { key: "menu_sales", label: "Salg", description: "Adgang til salgsdata", hasEditOption: true, scopeKey: "scope_sales" },
      { key: "menu_logics", label: "Logikker", description: "Adgang til logikker", hasEditOption: true },
      { key: "menu_closing_shifts", label: "Lukkevagter", description: "Adgang til lukkevagter", hasEditOption: true },
    ],
  },
  {
    key: "menu_personnel",
    label: "Personale menu",
    icon: "👥",
    permissions: [
      { key: "menu_employees", label: "Medarbejdere", description: "Adgang til medarbejdersiden", hasEditOption: true, scopeKey: "scope_employees" },
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
      { key: "menu_contracts", label: "Kontrakter", description: "Adgang til kontraktmodul", hasEditOption: true, scopeKey: "scope_contracts" },
      { key: "menu_permissions", label: "Rettigheder", description: "Adgang til rettighedsstyring", hasEditOption: true },
      { key: "menu_career_wishes_overview", label: "Karriereønsker overblik", description: "Adgang til karriereønsker overblik", hasEditOption: true, scopeKey: "scope_career_wishes" },
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
      { key: "menu_car_quiz_admin", label: "Bil Quiz Admin", description: "Adgang til bil quiz administration", hasEditOption: true, scopeKey: "scope_quiz" },
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
      { key: "menu_payroll", label: "Lønkørsel", description: "Adgang til lønkørsel", hasEditOption: true, scopeKey: "scope_payroll" },
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
      { key: "menu_shift_overview", label: "Vagtplan oversigt", description: "Adgang til vagtplan oversigt", hasEditOption: true, scopeKey: "scope_shifts" },
      { key: "menu_my_schedule", label: "Min kalender", description: "Adgang til egen kalender", hasEditOption: false },
      { key: "menu_absence", label: "Fravær", description: "Adgang til fraværsmodul", hasEditOption: true, scopeKey: "scope_absence" },
      { key: "menu_time_tracking", label: "Tidsregistrering", description: "Adgang til tidsregistrering", hasEditOption: true, scopeKey: "scope_time_tracking" },
      { key: "menu_extra_work", label: "Ekstra arbejde", description: "Adgang til ekstra arbejde", hasEditOption: true, scopeKey: "scope_extra_work" },
      { key: "menu_extra_work_admin", label: "Ekstra arbejde admin", description: "Adgang til ekstra arbejde administration", hasEditOption: true },
    ],
  },
  {
    key: "menu_fieldmarketing",
    label: "Fieldmarketing menu",
    icon: "🚗",
    permissions: [
      { key: "menu_fm_overview", label: "Oversigt", description: "Adgang til fieldmarketing oversigt", hasEditOption: true, scopeKey: "scope_fieldmarketing" },
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
      // Add scope permission if defined - owner sees all
      if (permission.scopeKey) {
        allPermissions[permission.scopeKey] = "alt";
      }
    });
  });
  return allPermissions;
};

// Available landing pages
const LANDING_PAGE_OPTIONS = [
  { value: "/home", label: "Hjem" },
  { value: "/my-schedule", label: "Min kalender" },
  { value: "/shift-planning", label: "Vagtplan" },
  { value: "/dashboard", label: "Dashboard" },
  { value: "/vagt-flow", label: "Fieldmarketing" },
  { value: "/employees", label: "Medarbejdere" },
  { value: "/contracts", label: "Kontrakter" },
  { value: "/recruitment", label: "Rekruttering" },
  { value: "/sales", label: "Salg" },
  { value: "/payroll", label: "Lønkørsel" },
];

interface JobPosition {
  id: string;
  name: string;
  description: string | null;
  default_landing_page: string | null;
  permissions: Record<string, boolean | { view: boolean; edit: boolean } | DataScope>;
  is_active: boolean;
  created_at: string;
}

interface FormData {
  name: string;
  description: string;
  default_landing_page: string;
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
    default_landing_page: "/home",
    permissions: {},
  });
  const [permissionSearch, setPermissionSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

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
          default_landing_page: data.default_landing_page || "/home",
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
          default_landing_page: data.default_landing_page || "/home",
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
      default_landing_page: "/home",
      permissions: {},
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
    });
    setPermissionSearch("");
    setActiveCategory(null);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingPosition(null);
    setFormData({ name: "", description: "", default_landing_page: "/home", permissions: {} });
    setPermissionSearch("");
    setActiveCategory(null);
  };

  // Filter categories and permissions based on search
  const filteredCategories = useMemo(() => {
    if (!permissionSearch.trim()) return PERMISSION_CATEGORIES;
    const search = permissionSearch.toLowerCase();
    return PERMISSION_CATEGORIES.map(cat => ({
      ...cat,
      permissions: cat.permissions.filter(p => 
        p.label.toLowerCase().includes(search) || 
        p.description.toLowerCase().includes(search)
      )
    })).filter(cat => cat.permissions.length > 0);
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

  const countActivePermissions = (permissions: Record<string, boolean | { view: boolean; edit: boolean } | DataScope> | null | undefined) => {
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
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
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
                      {LANDING_PAGE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
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
              {/* Search and category selector */}
              <div className="flex gap-4 mb-4 flex-shrink-0">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Søg i rettigheder..."
                    value={permissionSearch}
                    onChange={(e) => setPermissionSearch(e.target.value)}
                    className="pl-9"
                    disabled={editingPosition && isOwnerPosition(editingPosition.name)}
                  />
                </div>
                <Select 
                  value={activeCategory || "all"} 
                  onValueChange={(v) => setActiveCategory(v === "all" ? null : v)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Alle kategorier" />
                  </SelectTrigger>
                  <SelectContent className="z-50 bg-popover">
                    <SelectItem value="all">Alle kategorier</SelectItem>
                    {PERMISSION_CATEGORIES.filter(c => !c.key.startsWith("tabs_")).map(cat => (
                      <SelectItem key={cat.key} value={cat.key}>
                        {cat.icon} {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Categories grid */}
              <ScrollArea className="flex-1 min-h-0 -mx-2 px-2">
                <TooltipProvider delayDuration={200}>
                  <div className="grid grid-cols-2 gap-4 pb-4">
                    {(activeCategory 
                      ? filteredCategories.filter(c => c.key === activeCategory || c.key.startsWith(`tabs_${activeCategory.replace("menu_", "")}`))
                      : filteredCategories
                    ).filter(c => !c.key.startsWith("tabs_")).map((category) => {
                      const isOwnerLocked = editingPosition && isOwnerPosition(editingPosition.name);
                      const activeCount = isOwnerLocked 
                        ? category.permissions.length
                        : category.permissions.filter(p => getPermissionValue(p.key)).length;
                      
                      // Find associated tab category
                      const tabCategory = filteredCategories.find(c => 
                        c.key.startsWith("tabs_") && 
                        c.key.replace("tabs_", "menu_").replace(/_.*$/, "") === category.key.replace("menu_", "").replace(/_.*$/, "")
                      );

                      return (
                        <Card key={category.key} className={cn(
                          "overflow-hidden",
                          activeCount === category.permissions.length && !isOwnerLocked && "border-green-500/30"
                        )}>
                          <CardHeader className="py-3 px-4 bg-muted/30">
                            <CardTitle className="text-sm font-medium flex items-center justify-between">
                              <span className="flex items-center gap-2">
                                <span className="text-base">{category.icon}</span>
                                {category.label}
                              </span>
                              <Badge 
                                variant={activeCount === category.permissions.length ? "default" : "secondary"}
                                className={cn(
                                  "text-xs",
                                  activeCount === category.permissions.length && "bg-green-600"
                                )}
                              >
                                {activeCount}/{category.permissions.length}
                              </Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-0">
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
                            
                            {/* Associated tabs */}
                            {tabCategory && tabCategory.permissions.length > 0 && (
                              <div className="border-t bg-muted/20">
                                <div className="px-3 py-2 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                  <Layers className="h-3.5 w-3.5" />
                                  Under-faner
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
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </TooltipProvider>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <DialogFooter className="px-6 py-4 border-t">
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
    <div className={cn(
      "flex items-center justify-between gap-3 px-3 py-2.5 transition-colors",
      isOwnerLocked && "bg-green-500/5",
      !isOwnerLocked && "hover:bg-muted/30",
      isSubItem && "pl-6 bg-muted/10"
    )}>
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
        <span className={cn(
          "text-sm truncate",
          isActive ? "text-foreground" : "text-muted-foreground"
        )}>
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
                    isOwnerLocked && "cursor-default"
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
                    (isOwnerLocked || !hasView) && "cursor-default opacity-50"
                  )}
                >
                  <Edit className="h-3 w-3" />
                  Ret
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {!hasView ? "Aktiver 'Se' først" : "Kan redigere indhold"}
              </TooltipContent>
            </Tooltip>
          </div>
          
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
          )}
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