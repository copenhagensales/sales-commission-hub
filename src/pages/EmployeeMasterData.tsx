import { useState } from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Search, Users, Phone, MessageSquare, Mail, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

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
  const [sendingInvitation, setSendingInvitation] = useState<string | null>(null);

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

  const handleSendInvitation = async (employee: EmployeeMasterDataRecord) => {
    if (!employee.private_email) {
      toast({ title: "Mangler email", description: "Medarbejderen skal have en email-adresse", variant: "destructive" });
      return;
    }

    setSendingInvitation(employee.id);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-employee-invitation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeId: employee.id,
            email: employee.private_email,
            firstName: employee.first_name,
            lastName: employee.last_name,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Kunne ikke sende invitation");
      }

      toast({ title: "Invitation sendt", description: `Email sendt til ${employee.private_email}` });
    } catch (error) {
      console.error("Invitation error:", error);
      toast({
        title: "Fejl",
        description: error instanceof Error ? error.message : "Kunne ikke sende invitation",
        variant: "destructive",
      });
    } finally {
      setSendingInvitation(null);
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Medarbejdere</h1>
            <p className="text-muted-foreground">Stamkort og medarbejderdata</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingEmployee(null);
              setFormData(defaultEmployee);
            }
          }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Tilføj medarbejder</Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingEmployee ? "Rediger medarbejder" : "Ny medarbejder"}</DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="identity" className="w-full">
                <TabsList className="grid w-full grid-cols-6">
                  <TabsTrigger value="identity">Identitet</TabsTrigger>
                  <TabsTrigger value="contact">Kontakt</TabsTrigger>
                  <TabsTrigger value="employment">Ansættelse</TabsTrigger>
                  <TabsTrigger value="salary">Løn</TabsTrigger>
                  <TabsTrigger value="vacation">Ferie</TabsTrigger>
                  <TabsTrigger value="other">Andet</TabsTrigger>
                </TabsList>

                <TabsContent value="identity" className="space-y-4 mt-4">
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
                </TabsContent>

                <TabsContent value="contact" className="space-y-4 mt-4">
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
                </TabsContent>

                <TabsContent value="employment" className="space-y-4 mt-4">
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
                          <SelectItem value="Salgskonsulent">Salgskonsulent</SelectItem>
                          <SelectItem value="Fieldmarketing">Fieldmarketing</SelectItem>
                          <SelectItem value="Teamleder">Teamleder</SelectItem>
                          <SelectItem value="Assisterende Teamleder">Assisterende Teamleder</SelectItem>
                          <SelectItem value="Rekruttering">Rekruttering</SelectItem>
                          <SelectItem value="SOME">SOME</SelectItem>
                          <SelectItem value="Backoffice">Backoffice</SelectItem>
                          <SelectItem value="Projektleder">Projektleder</SelectItem>
                          <SelectItem value="Ejer">Ejer</SelectItem>
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
                </TabsContent>

                <TabsContent value="salary" className="space-y-4 mt-4">
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
                </TabsContent>

                <TabsContent value="vacation" className="space-y-4 mt-4">
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
                </TabsContent>

                <TabsContent value="other" className="space-y-4 mt-4">
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
                </TabsContent>
              </Tabs>
              <div className="flex justify-end mt-6">
                <Button onClick={handleSave} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Gemmer..." : "Gem"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Aktive medarbejdere</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Inaktive medarbejdere</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{employees.length - activeCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{employees.length}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <CardTitle>Medarbejderoversigt</CardTitle>
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-lg border border-border p-1">
                  <Button
                    variant={statusFilter === "active" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setStatusFilter("active")}
                    className="h-7 px-3"
                  >
                    Aktive ({activeCount})
                  </Button>
                  <Button
                    variant={statusFilter === "inactive" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setStatusFilter("inactive")}
                    className="h-7 px-3"
                  >
                    Inaktive ({inactiveCount})
                  </Button>
                  <Button
                    variant={statusFilter === "all" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setStatusFilter("all")}
                    className="h-7 px-3"
                  >
                    Alle ({employees.length})
                  </Button>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Søg..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8" />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Indlæser...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Navn</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Afdeling</TableHead>
                    <TableHead>Stilling</TableHead>
                    <TableHead>Løntype</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((employee) => (
                    <TableRow 
                      key={employee.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/employees/${employee.id}`)}
                    >
                      <TableCell className="font-medium">
                        {employee.first_name} {employee.last_name}
                      </TableCell>
                      <TableCell>{employee.private_email || "-"}</TableCell>
                      <TableCell>{employee.private_phone || "-"}</TableCell>
                      <TableCell>{employee.department || "-"}</TableCell>
                      <TableCell>{employee.job_title || "-"}</TableCell>
                      <TableCell>
                        {employee.salary_type === "provision" && "Provision"}
                        {employee.salary_type === "fixed" && "Fast løn"}
                        {employee.salary_type === "hourly" && "Timeløn"}
                        {!employee.salary_type && "-"}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Switch 
                          checked={employee.is_active} 
                          onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: employee.id, is_active: checked })}
                        />
                      </TableCell>
                      <TableCell className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            toast({ title: "Ring op", description: "Softphone integration kommer snart" });
                          }}
                          disabled={!employee.private_phone}
                        >
                          <Phone className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            toast({ title: "Send SMS", description: "SMS integration kommer snart" });
                          }}
                          disabled={!employee.private_phone}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            handleSendInvitation(employee);
                          }}
                          disabled={!employee.private_email || sendingInvitation === employee.id}
                          title="Send invitation til medarbejder"
                        >
                          {sendingInvitation === employee.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Mail className="h-4 w-4" />
                          )}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEdit(employee); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        Ingen medarbejdere fundet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
