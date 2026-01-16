import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
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
  Lock,
  Play,
  User,
  Search,
  Settings,
  Check,
  ExternalLink,
  Eye,
  Info,
} from "lucide-react";
import { Json } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LANDING_PAGE_OPTIONS } from "@/config/permissions";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Owner position name - this position is locked and cannot be edited
const OWNER_POSITION_NAME = "Ejer";

const isOwnerPosition = (name: string) => name.toLowerCase() === OWNER_POSITION_NAME.toLowerCase();


interface JobPosition {
  id: string;
  name: string;
  description: string | null;
  default_landing_page: string | null;
  is_active: boolean;
  created_at: string;
  requires_mfa: boolean;
  session_timeout_minutes: number;
  max_session_hours: number;
  system_role_key: string | null;
}

interface RoleDefinition {
  key: string;
  label: string;
  color: string | null;
}

interface TrustedIpRange {
  name: string;
  ip: string;
}

interface FormData {
  name: string;
  description: string;
  default_landing_page: string;
  requires_mfa: boolean;
  session_timeout_minutes: number;
  max_session_hours: number;
  trusted_ip_ranges: TrustedIpRange[];
  system_role_key: string | null;
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
    requires_mfa: false,
    session_timeout_minutes: 60,
    max_session_hours: 10,
    trusted_ip_ranges: [],
    system_role_key: null,
  });
  const [newIpName, setNewIpName] = useState("");
  const [newIpAddress, setNewIpAddress] = useState("");

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
        system_role_key: p.system_role_key || null,
      })) as JobPosition[];
    },
  });

  // Fetch role definitions
  const { data: roleDefinitions = [] } = useQuery({
    queryKey: ["role-definitions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_role_definitions")
        .select("key, label, color")
        .order("priority");

      if (error) throw error;
      return data as RoleDefinition[];
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
        requires_mfa: data.requires_mfa,
        session_timeout_minutes: data.session_timeout_minutes,
        max_session_hours: data.max_session_hours,
        trusted_ip_ranges: data.trusted_ip_ranges as unknown as Json,
        system_role_key: data.system_role_key,
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

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      const { error } = await supabase
        .from("job_positions")
        .update({
          name: data.name,
          description: data.description || null,
          default_landing_page: data.default_landing_page || "/home",
          requires_mfa: data.requires_mfa,
          session_timeout_minutes: data.session_timeout_minutes,
          max_session_hours: data.max_session_hours,
          trusted_ip_ranges: data.trusted_ip_ranges as unknown as Json,
          system_role_key: data.system_role_key,
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
      requires_mfa: false,
      session_timeout_minutes: 60,
      max_session_hours: 10,
      trusted_ip_ranges: [],
      system_role_key: null,
    });
    setNewIpName("");
    setNewIpAddress("");
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (position: JobPosition) => {
    const isOwner = isOwnerPosition(position.name);
    setEditingPosition(position);
    const existingRanges = (position as unknown as { trusted_ip_ranges?: TrustedIpRange[] }).trusted_ip_ranges || [];
    setFormData({
      name: position.name,
      description: position.description || "",
      default_landing_page: position.default_landing_page || "/home",
      requires_mfa: isOwner ? true : position.requires_mfa ?? false,
      session_timeout_minutes: position.session_timeout_minutes ?? 60,
      max_session_hours: position.max_session_hours ?? 10,
      trusted_ip_ranges: existingRanges,
      system_role_key: isOwner ? "ejer" : position.system_role_key,
    });
    setNewIpName("");
    setNewIpAddress("");
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingPosition(null);
    setFormData({
      name: "",
      description: "",
      default_landing_page: "/home",
      requires_mfa: false,
      session_timeout_minutes: 60,
      max_session_hours: 10,
      trusted_ip_ranges: [],
      system_role_key: null,
    });
    setNewIpName("");
    setNewIpAddress("");
  };

  // Get role badge color
  const getRoleBadgeClass = (roleKey: string | null) => {
    if (!roleKey) return "bg-muted text-muted-foreground";
    const role = roleDefinitions.find(r => r.key === roleKey);
    const colorMap: Record<string, string> = {
      primary: "bg-primary text-primary-foreground",
      blue: "bg-blue-500 text-white",
      amber: "bg-amber-500 text-white",
      purple: "bg-purple-500 text-white",
      muted: "bg-muted text-muted-foreground",
    };
    return colorMap[role?.color || "muted"] || "bg-muted text-muted-foreground";
  };

  const getRoleLabel = (roleKey: string | null) => {
    if (!roleKey) return "Ingen rolle";
    const role = roleDefinitions.find(r => r.key === roleKey);
    return role?.label || roleKey;
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
            <TableHead>Rolle</TableHead>
            <TableHead>Beskrivelse</TableHead>
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
                  <TableCell>
                    <Badge className={getRoleBadgeClass(position.system_role_key)}>
                      {getRoleLabel(position.system_role_key)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">
                    {position.description || "-"}
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
                          title="Se indstillinger (kan ikke redigeres)"
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingPosition && isOwnerPosition(editingPosition.name) ? (
                <>
                  <Lock className="h-5 w-5 text-muted-foreground" />
                  Se indstillinger for Ejer
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

          <Tabs defaultValue="basic" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic" className="gap-2">
                <Settings className="h-4 w-4" />
                Grundlæggende
              </TabsTrigger>
              <TabsTrigger value="security" className="gap-2">
                <Lock className="h-4 w-4" />
                Sikkerhed
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-6 mt-4">
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

              {/* Role Assignment Section */}
              <div className="space-y-2">
                <Label>Systemrolle</Label>
                <Select
                  value={formData.system_role_key || "none"}
                  onValueChange={(value) => setFormData({ ...formData, system_role_key: value === "none" ? null : value })}
                  disabled={editingPosition && isOwnerPosition(editingPosition.name)}
                >
                  <SelectTrigger className="w-full max-w-xs">
                    <SelectValue placeholder="Vælg rolle" />
                  </SelectTrigger>
                  <SelectContent className="z-50 bg-popover">
                    <SelectItem value="none">Ingen rolle</SelectItem>
                    {roleDefinitions.map((role) => (
                      <SelectItem key={role.key} value={role.key}>
                        <div className="flex items-center gap-2">
                          <Badge className={getRoleBadgeClass(role.key)} variant="secondary">
                            {role.label}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Rollen bestemmer stillingens rettigheder i systemet
                </p>
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

              {/* Permission Editor Reference */}
              <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 dark:text-blue-200">
                  <span className="font-medium">Rettigheder administreres centralt.</span>{" "}
                  For at redigere side- og funktionsadgang for denne rolle, gå til{" "}
                  <Link 
                    to="/employees" 
                    className="font-medium underline hover:no-underline inline-flex items-center gap-1"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Medarbejdere → Rettigheder
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </AlertDescription>
              </Alert>
            </TabsContent>

            <TabsContent value="security" className="space-y-4 mt-4">
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
                </CardContent>
              </Card>

              {/* Session Settings */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lock className="h-4 w-4" />
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
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
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
