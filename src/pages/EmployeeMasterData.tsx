import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Search, Users, Phone, MessageSquare, Loader2, ArrowRight, Check, FileText, Trash2, Eye, EyeOff } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useCanAccess } from "@/hooks/useSystemRoles";
import { EmployeeExcelImport } from "@/components/employees/EmployeeExcelImport";
import { DialerMappingTab } from "@/components/employees/DialerMappingTab";
import { TeamsTab } from "@/components/employees/TeamsTab";
import { PositionsTab } from "@/components/employees/PositionsTab";


interface EmployeeMasterDataRecord {
  id: string;
  first_name: string;
  last_name: string;
  cpr_number: string | null;
  address_street: string | null;
  address_postal_code: string | null;
  address_city: string | null;
  address_country: string | null;
  private_phone: string | null;
  private_email: string | null;
  work_email: string | null;
  employment_start_date: string | null;
  employment_end_date: string | null;
  job_title: string | null;
  department: string | null;
  work_location: string | null;
  manager_id: string | null;
  contract_id: string | null;
  contract_version: string | null;
  salary_type: "provision" | "fixed" | "hourly" | null;
  salary_amount: number | null;
  bank_reg_number: string | null;
  bank_account_number: string | null;
  system_role_id: string | null;
  vacation_type: "vacation_pay" | "vacation_bonus" | null;
  vacation_bonus_percent: number | null;
  has_parking: boolean;
  parking_spot_id: string | null;
  parking_monthly_cost: number | null;
  working_hours_model: string | null;
  weekly_hours: number | null;
  standard_start_time: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type NewEmployee = Omit<EmployeeMasterDataRecord, "id" | "created_at" | "updated_at">;

const defaultEmployee: NewEmployee = {
  first_name: "",
  last_name: "",
  cpr_number: null,
  address_street: null,
  address_postal_code: null,
  address_city: null,
  address_country: "Danmark",
  private_phone: null,
  private_email: null,
  work_email: null,
  employment_start_date: null,
  employment_end_date: null,
  job_title: null,
  department: null,
  work_location: "København V",
  manager_id: null,
  contract_id: null,
  contract_version: null,
  salary_type: "provision",
  salary_amount: null,
  bank_reg_number: null,
  bank_account_number: null,
  system_role_id: null,
  vacation_type: "vacation_pay",
  vacation_bonus_percent: 1,
  has_parking: false,
  parking_spot_id: null,
  parking_monthly_cost: null,
  working_hours_model: null,
  weekly_hours: null,
  standard_start_time: null,
  is_active: true,
};

export default function EmployeeMasterData() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeMasterDataRecord | null>(null);
  const [formData, setFormData] = useState<NewEmployee>(defaultEmployee);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createData, setCreateData] = useState({ first_name: "", last_name: "", email: "", password: "", job_title: "" });
  const [creatingEmployee, setCreatingEmployee] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [deleteEmployeeId, setDeleteEmployeeId] = useState<string | null>(null);
  
  const { isOwner } = useCanAccess();

  const dialogSteps = [
    { title: "Identitet", key: "identity" },
    { title: "Kontakt", key: "contact" },
    { title: "Ansættelse", key: "employment" },
    { title: "Løn", key: "salary" },
    { title: "Ferie", key: "vacation" },
    { title: "Andet", key: "other" },
  ];

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employee-master-data"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("*")
        .order("last_name", { ascending: true });
      if (error) throw error;
      return data as EmployeeMasterDataRecord[];
    },
  });

  // Fetch job positions from database
  const { data: jobPositions = [] } = useQuery({
    queryKey: ["job-positions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_positions")
        .select("id, name, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch contracts to check signed status
  const { data: contracts = [] } = useQuery({
    queryKey: ["employee-contracts-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("employee_id, status")
        .eq("status", "signed");
      if (error) throw error;
      return data;
    },
  });

  const hasSignedContract = (employeeId: string) => {
    return contracts.some(c => c.employee_id === employeeId);
  };

  const saveMutation = useMutation({
    mutationFn: async (employee: NewEmployee & { id?: string }) => {
      if (employee.id) {
        const { error } = await supabase
          .from("employee_master_data")
          .update(employee)
          .eq("id", employee.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("employee_master_data").insert(employee);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-master-data"] });
      toast({ title: editingEmployee ? "Medarbejder opdateret" : "Medarbejder oprettet" });
      setDialogOpen(false);
      setEditingEmployee(null);
      setFormData(defaultEmployee);
    },
    onError: (error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const handleEdit = (employee: EmployeeMasterDataRecord) => {
    setEditingEmployee(employee);
    setFormData({
      first_name: employee.first_name,
      last_name: employee.last_name,
      cpr_number: employee.cpr_number,
      address_street: employee.address_street,
      address_postal_code: employee.address_postal_code,
      address_city: employee.address_city,
      address_country: employee.address_country,
      private_phone: employee.private_phone,
      private_email: employee.private_email,
      work_email: employee.work_email,
      employment_start_date: employee.employment_start_date,
      employment_end_date: employee.employment_end_date,
      job_title: employee.job_title,
      department: employee.department,
      work_location: employee.work_location,
      manager_id: employee.manager_id,
      contract_id: employee.contract_id,
      contract_version: employee.contract_version,
      salary_type: employee.salary_type,
      salary_amount: employee.salary_amount,
      bank_reg_number: employee.bank_reg_number,
      bank_account_number: employee.bank_account_number,
      system_role_id: employee.system_role_id,
      vacation_type: employee.vacation_type,
      vacation_bonus_percent: employee.vacation_bonus_percent,
      has_parking: employee.has_parking,
      parking_spot_id: employee.parking_spot_id,
      parking_monthly_cost: employee.parking_monthly_cost,
      working_hours_model: employee.working_hours_model,
      weekly_hours: employee.weekly_hours,
      standard_start_time: employee.standard_start_time,
      is_active: employee.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.first_name || !formData.last_name) {
      toast({ title: "Udfyld fornavn og efternavn", variant: "destructive" });
      return;
    }
    saveMutation.mutate(editingEmployee ? { ...formData, id: editingEmployee.id } : formData);
  };

  // Auto-save function for step navigation
  const autoSaveEmployee = useCallback(async () => {
    if (!editingEmployee) return; // Only auto-save for existing employees
    
    setAutoSaving(true);
    try {
      const { error } = await supabase
        .from("employee_master_data")
        .update(formData)
        .eq("id", editingEmployee.id);
      
      if (!error) {
        setLastSaved(new Date());
        queryClient.invalidateQueries({ queryKey: ["employee-master-data"] });
      }
    } catch (err) {
      console.error("Auto-save error:", err);
    } finally {
      setAutoSaving(false);
    }
  }, [editingEmployee, formData, queryClient]);

  // Debounced auto-save when form changes (only for editing existing employee)
  useEffect(() => {
    if (!editingEmployee || !dialogOpen) return;
    
    const timeoutId = setTimeout(() => {
      autoSaveEmployee();
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [formData, editingEmployee, dialogOpen, autoSaveEmployee]);

  const handleStepNext = async () => {
    // Validate first step
    if (currentStep === 0 && (!formData.first_name || !formData.last_name)) {
      toast({ title: "Udfyld fornavn og efternavn", variant: "destructive" });
      return;
    }

    // Auto-save for existing employee
    if (editingEmployee) {
      await autoSaveEmployee();
    }

    if (currentStep < dialogSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Final step - save and close
      handleSave();
    }
  };

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const today = new Date().toISOString().split("T")[0];
      const updateData = is_active
        ? { is_active, employment_start_date: today, employment_end_date: null }
        : { is_active, employment_end_date: today };
      
      const { error } = await supabase
        .from("employee_master_data")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-master-data"] });
      toast({ title: "Status opdateret" });
    },
    onError: (error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("employee_master_data")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-master-data"] });
      toast({ title: "Medarbejder slettet" });
      setDeleteEmployeeId(null);
    },
    onError: (error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const handleCreateEmployee = async () => {
    if (!createData.first_name || !createData.email || !createData.password || !createData.job_title) {
      toast({ title: "Udfyld fornavn, email, kode og stilling", variant: "destructive" });
      return;
    }

    if (createData.password.length < 6) {
      toast({ title: "Koden skal være mindst 6 tegn", variant: "destructive" });
      return;
    }

    setCreatingEmployee(true);
    try {
      // Create auth user first
      const response = await supabase.functions.invoke("create-employee-user", {
        body: {
          email: createData.email,
          password: createData.password,
          firstName: createData.first_name,
          lastName: createData.last_name,
        },
      });

      // Check for error in response data first (edge function returns error in data)
      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      if (response.error) {
        throw new Error(response.error.message || "Kunne ikke oprette bruger");
      }

      if (!response.data?.success) {
        throw new Error("Kunne ikke oprette bruger");
      }

      // Create the employee record
      const { error: createError } = await supabase
        .from("employee_master_data")
        .insert({
          first_name: createData.first_name,
          last_name: createData.last_name || "",
          private_email: createData.email,
          job_title: createData.job_title,
          is_active: true,
          employment_start_date: new Date().toISOString().split("T")[0],
        });

      if (createError) throw createError;

      queryClient.invalidateQueries({ queryKey: ["employee-master-data"] });
      toast({ 
        title: "Medarbejder oprettet", 
        description: `Bruger oprettet med email: ${createData.email}. Giv medarbejderen login-oplysningerne.` 
      });
      setCreateDialogOpen(false);
      setCreateData({ first_name: "", last_name: "", email: "", password: "", job_title: "" });
    } catch (error) {
      console.error("Create error:", error);
      toast({
        title: "Fejl",
        description: error instanceof Error ? error.message : "Kunne ikke oprette medarbejder",
        variant: "destructive",
      });
    } finally {
      setCreatingEmployee(false);
    }
  };

  const filteredEmployees = employees
    .filter((e) => {
      if (statusFilter === "active") return e.is_active;
      if (statusFilter === "inactive") return !e.is_active;
      return true;
    })
    .filter(
      (e) =>
        `${e.first_name} ${e.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.private_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.department?.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const activeCount = employees.filter((e) => e.is_active).length;
  const inactiveCount = employees.length - activeCount;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Medarbejdere</h1>
          <p className="text-muted-foreground">Stamkort og medarbejderdata</p>
        </div>


            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setEditingEmployee(null);
                setFormData(defaultEmployee);
                setCurrentStep(0);
                setLastSaved(null);
              }
            }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingEmployee ? "Rediger medarbejder" : "Ny medarbejder"}</DialogTitle>
              </DialogHeader>
              
              {/* Progress indicator */}
              <div className="flex items-center justify-center mb-4 gap-1">
                {dialogSteps.map((step, index) => (
                  <div key={index} className="flex items-center">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                        index < currentStep
                          ? "bg-green-500 text-white"
                          : index === currentStep
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {index < currentStep ? <Check className="h-3 w-3" /> : index + 1}
                    </div>
                    {index < dialogSteps.length - 1 && (
                      <div className={`w-6 h-0.5 ${index < currentStep ? "bg-green-500" : "bg-muted"}`} />
                    )}
                  </div>
                ))}
              </div>
              
              <p className="text-center text-sm font-medium mb-4">{dialogSteps[currentStep]?.title}</p>

              {/* Auto-save indicator */}
              <div className="text-center mb-4 h-4">
                {autoSaving ? (
                  <span className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Gemmer...
                  </span>
                ) : lastSaved ? (
                  <span className="text-xs text-green-600 flex items-center justify-center gap-1">
                    <Check className="h-3 w-3" /> Gemt automatisk
                  </span>
                ) : null}
              </div>

              {/* Step 0: Identity */}
              {currentStep === 0 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Fornavn(e) *</Label>
                      <Input value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Efternavn *</Label>
                      <Input value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>CPR-nr. (følsomt)</Label>
                      <Input type="password" value={formData.cpr_number || ""} onChange={(e) => setFormData({ ...formData, cpr_number: e.target.value || null })} placeholder="XXXXXX-XXXX" />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 1: Contact */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-2">
                      <Label>Adresse</Label>
                      <Input value={formData.address_street || ""} onChange={(e) => setFormData({ ...formData, address_street: e.target.value || null })} placeholder="Vej og nummer" />
                    </div>
                    <div className="space-y-2">
                      <Label>Postnummer</Label>
                      <Input value={formData.address_postal_code || ""} onChange={(e) => setFormData({ ...formData, address_postal_code: e.target.value || null })} />
                    </div>
                    <div className="space-y-2">
                      <Label>By</Label>
                      <Input value={formData.address_city || ""} onChange={(e) => setFormData({ ...formData, address_city: e.target.value || null })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Land</Label>
                      <Input value={formData.address_country || ""} onChange={(e) => setFormData({ ...formData, address_country: e.target.value || null })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Telefon</Label>
                      <Input value={formData.private_phone || ""} onChange={(e) => setFormData({ ...formData, private_phone: e.target.value || null })} />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>E-mail</Label>
                      <Input type="email" value={formData.private_email || ""} onChange={(e) => setFormData({ ...formData, private_email: e.target.value || null })} />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Employment */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Ansættelsesdato</Label>
                      <Input type="date" value={formData.employment_start_date || ""} onChange={(e) => setFormData({ ...formData, employment_start_date: e.target.value || null })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Slutdato</Label>
                      <Input type="date" value={formData.employment_end_date || ""} onChange={(e) => setFormData({ ...formData, employment_end_date: e.target.value || null })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Stillingsbetegnelse</Label>
                      <Select value={formData.job_title || ""} onValueChange={(v) => setFormData({ ...formData, job_title: v || null })}>
                        <SelectTrigger><SelectValue placeholder="Vælg stilling" /></SelectTrigger>
                        <SelectContent>
                          {jobPositions.map((position) => (
                            <SelectItem key={position.id} value={position.name}>
                              {position.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Afdeling / Team</Label>
                      <Input value={formData.department || ""} onChange={(e) => setFormData({ ...formData, department: e.target.value || null })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Arbejdssted</Label>
                      <Select value={formData.work_location || "København V"} onValueChange={(v) => setFormData({ ...formData, work_location: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="København V">København V</SelectItem>
                          <SelectItem value="Århus">Århus</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Kontrakt-ID</Label>
                      <Input value={formData.contract_id || ""} onChange={(e) => setFormData({ ...formData, contract_id: e.target.value || null })} />
                    </div>
                    <div className="flex items-center space-x-2 col-span-2">
                      <Switch checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
                      <Label>Aktiv medarbejder</Label>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Salary */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Løntype</Label>
                      <Select value={formData.salary_type || "provision"} onValueChange={(v) => setFormData({ ...formData, salary_type: v as "provision" | "fixed" | "hourly" })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="provision">Provision</SelectItem>
                          <SelectItem value="fixed">Fast løn</SelectItem>
                          <SelectItem value="hourly">Timeløn</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {(formData.salary_type === "fixed" || formData.salary_type === "hourly") && (
                      <div className="space-y-2">
                        <Label>Lønbeløb (DKK)</Label>
                        <Input type="number" value={formData.salary_amount || ""} onChange={(e) => setFormData({ ...formData, salary_amount: e.target.value ? parseFloat(e.target.value) : null })} />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Reg.nr.</Label>
                      <Input type="password" value={formData.bank_reg_number || ""} onChange={(e) => setFormData({ ...formData, bank_reg_number: e.target.value || null })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Kontonummer</Label>
                      <Input type="password" value={formData.bank_account_number || ""} onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value || null })} />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Vacation */}
              {currentStep === 4 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Ferietype</Label>
                      <Select value={formData.vacation_type || "vacation_pay"} onValueChange={(v) => setFormData({ ...formData, vacation_type: v as "vacation_pay" | "vacation_bonus" })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vacation_pay">Ferieløn</SelectItem>
                          <SelectItem value="vacation_bonus">Feriebonus</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.vacation_type === "vacation_bonus" && (
                      <div className="space-y-2">
                        <Label>Feriebonus %</Label>
                        <Input type="number" value={formData.vacation_bonus_percent || 1} onChange={(e) => setFormData({ ...formData, vacation_bonus_percent: parseFloat(e.target.value) })} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 5: Other */}
              {currentStep === 5 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch checked={formData.has_parking} onCheckedChange={(checked) => setFormData({ ...formData, has_parking: checked })} />
                      <Label>Parkeringsplads</Label>
                    </div>
                    {formData.has_parking && (
                      <>
                        <div className="space-y-2">
                          <Label>Plads-ID</Label>
                          <Input value={formData.parking_spot_id || ""} onChange={(e) => setFormData({ ...formData, parking_spot_id: e.target.value || null })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Månedlig pris (DKK)</Label>
                          <Input type="number" value={formData.parking_monthly_cost || ""} onChange={(e) => setFormData({ ...formData, parking_monthly_cost: e.target.value ? parseFloat(e.target.value) : null })} />
                        </div>
                      </>
                    )}
                    <div className="space-y-2 col-span-2">
                      <Label>Arbejdstidsmodel</Label>
                      <Input value={formData.working_hours_model || ""} onChange={(e) => setFormData({ ...formData, working_hours_model: e.target.value || null })} placeholder="Fx. Flekstid, Fast" />
                    </div>
                    <div className="space-y-2">
                      <Label>Timer pr. uge</Label>
                      <Input type="number" value={formData.weekly_hours || ""} onChange={(e) => setFormData({ ...formData, weekly_hours: e.target.value ? parseFloat(e.target.value) : null })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Standard mødetid</Label>
                      <Input type="time" value={formData.standard_start_time || ""} onChange={(e) => setFormData({ ...formData, standard_start_time: e.target.value || null })} />
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation buttons */}
              <div className="flex gap-4 mt-6">
                {currentStep > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setCurrentStep(currentStep - 1)}
                  >
                    Tilbage
                  </Button>
                )}
                <Button
                  type="button"
                  className="flex-1"
                  onClick={handleStepNext}
                  disabled={saveMutation.isPending || autoSaving}
                >
                  {saveMutation.isPending || autoSaving ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gemmer...</>
                  ) : currentStep === dialogSteps.length - 1 ? (
                    <>Afslut <Check className="ml-2 h-4 w-4" /></>
                  ) : (
                    <>Næste <ArrowRight className="ml-2 h-4 w-4" /></>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

        <Tabs defaultValue="all-employees" className="space-y-6">
          <TabsList>
            <TabsTrigger value="all-employees">Alle medarbejdere</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="positions">Stillinger</TabsTrigger>
            <TabsTrigger value="dialer-mapping">Dialer mapping</TabsTrigger>
          </TabsList>

          <TabsContent value="all-employees" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-card/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Aktive medarbejdere</span>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{activeCount}</div>
          </div>
          <div className="rounded-xl bg-card/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Inaktive medarbejdere</span>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{employees.length - activeCount}</div>
          </div>
          <div className="rounded-xl bg-card/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Total</span>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{employees.length}</div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h2 className="text-xl font-semibold">Medarbejderoversigt</h2>
            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-lg bg-muted/50 p-1">
                <Button
                  variant={statusFilter === "active" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setStatusFilter("active")}
                  className="h-7 px-3 text-xs"
                >
                  Aktive ({activeCount})
                </Button>
                <Button
                  variant={statusFilter === "inactive" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setStatusFilter("inactive")}
                  className="h-7 px-3 text-xs"
                >
                  Inaktive ({inactiveCount})
                </Button>
                <Button
                  variant={statusFilter === "all" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setStatusFilter("all")}
                  className="h-7 px-3 text-xs"
                >
                  Alle ({employees.length})
                </Button>
              </div>
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Søg..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  className="pl-9 bg-muted/50 border-0 focus-visible:ring-1 h-9" 
                />
              </div>
              <div className="flex items-center gap-2">
                <EmployeeExcelImport />
                <Dialog open={createDialogOpen} onOpenChange={(open) => {
                  setCreateDialogOpen(open);
                  if (!open) setCreateData({ first_name: "", last_name: "", email: "", password: "", job_title: "" });
                }}>
                  <DialogTrigger asChild>
                    <Button><Plus className="mr-2 h-4 w-4" /> Opret ny medarbejder</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Opret ny medarbejder</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <p className="text-sm text-muted-foreground">
                        Opret medarbejder med login. Giv medarbejderen login-oplysningerne.
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Fornavn *</Label>
                          <Input 
                            value={createData.first_name} 
                            onChange={(e) => setCreateData({ ...createData, first_name: e.target.value })} 
                            placeholder="Fornavn"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Efternavn</Label>
                          <Input 
                            value={createData.last_name} 
                            onChange={(e) => setCreateData({ ...createData, last_name: e.target.value })} 
                            placeholder="Efternavn"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Email *</Label>
                        <Input 
                          type="email"
                          value={createData.email} 
                          onChange={(e) => setCreateData({ ...createData, email: e.target.value })} 
                          placeholder="medarbejder@email.dk"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Kodeord *</Label>
                        <div className="relative">
                          <Input 
                            type={showPassword ? "text" : "password"}
                            value={createData.password} 
                            onChange={(e) => setCreateData({ ...createData, password: e.target.value })} 
                            placeholder="Mindst 6 tegn"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Medarbejderen kan ændre koden efter første login.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Stilling *</Label>
                        <Select 
                          value={createData.job_title} 
                          onValueChange={(value) => setCreateData({ ...createData, job_title: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Vælg stilling" />
                          </SelectTrigger>
                          <SelectContent>
                            {jobPositions.map((position) => (
                              <SelectItem key={position.id} value={position.name}>
                                {position.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Rettigheder tildeles automatisk baseret på stilling.
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={handleCreateEmployee} disabled={creatingEmployee}>
                        {creatingEmployee ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opretter...</>
                        ) : (
                          <><Plus className="mr-2 h-4 w-4" /> Opret medarbejder</>
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
          
          <div className="rounded-xl bg-card/50 overflow-hidden">
            {isLoading ? (
              <p className="text-muted-foreground p-6">Indlæser...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-border/50">
                    <TableHead className="text-xs font-medium text-muted-foreground">Navn</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">E-mail</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Telefon</TableHead>
                    
                    <TableHead className="text-xs font-medium text-muted-foreground">Stilling</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Løntype</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((employee) => (
                    <TableRow 
                      key={employee.id} 
                      className="cursor-pointer hover:bg-muted/30 border-b border-border/30"
                      onClick={() => navigate(`/employees/${employee.id}`)}
                    >
                      <TableCell className="font-medium py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                            {employee.first_name?.[0]}{employee.last_name?.[0]}
                          </div>
                          <div className="flex items-center gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <FileText className={`h-3.5 w-3.5 ${hasSignedContract(employee.id) ? "text-green-500" : "text-muted-foreground/30"}`} />
                              </TooltipTrigger>
                              <TooltipContent>
                                {hasSignedContract(employee.id) ? "Kontrakt underskrevet" : "Ingen underskrevet kontrakt"}
                              </TooltipContent>
                            </Tooltip>
                            <span>{employee.first_name} {employee.last_name}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                        {employee.private_email ? (
                          <a 
                            href={`mailto:${employee.private_email}`} 
                            className="text-primary hover:underline text-sm"
                          >
                            {employee.private_email}
                          </a>
                        ) : <span className="text-muted-foreground/50">-</span>}
                      </TableCell>
                      <TableCell className="py-3 text-sm">{employee.private_phone || <span className="text-muted-foreground/50">-</span>}</TableCell>
                      
                      <TableCell className="py-3">
                        {employee.job_title ? (
                          <Badge variant="secondary" className="text-xs font-normal">{employee.job_title}</Badge>
                        ) : <span className="text-muted-foreground/50">-</span>}
                      </TableCell>
                      <TableCell className="py-3 text-sm">
                        {employee.salary_type === "provision" && "Provision"}
                        {employee.salary_type === "fixed" && "Fast løn"}
                        {employee.salary_type === "hourly" && "Timeløn"}
                        {!employee.salary_type && <span className="text-muted-foreground/50">-</span>}
                      </TableCell>
                      <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                        <Switch 
                          checked={employee.is_active} 
                          onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: employee.id, is_active: checked })}
                        />
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-0.5">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              toast({ title: "Ring op", description: "Softphone integration kommer snart" });
                            }}
                            disabled={!employee.private_phone}
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              toast({ title: "Send SMS", description: "SMS integration kommer snart" });
                            }}
                            disabled={!employee.private_phone}
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleEdit(employee); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {isOwner && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); setDeleteEmployeeId(employee.id); }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Ingen medarbejdere fundet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
          </TabsContent>

          <TabsContent value="teams" className="space-y-6">
            <TeamsTab />
          </TabsContent>

          <TabsContent value="positions" className="space-y-6">
            <PositionsTab />
          </TabsContent>

          <TabsContent value="dialer-mapping" className="space-y-6">
            <DialerMappingTab />
          </TabsContent>
        </Tabs>

        {/* Delete confirmation dialog */}
        <AlertDialog open={!!deleteEmployeeId} onOpenChange={(open) => !open && setDeleteEmployeeId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Slet medarbejder?</AlertDialogTitle>
              <AlertDialogDescription>
                Dette vil permanent slette medarbejderen og alle tilknyttede data. Handlingen kan ikke fortrydes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuller</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => deleteEmployeeId && deleteMutation.mutate(deleteEmployeeId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Slet
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
