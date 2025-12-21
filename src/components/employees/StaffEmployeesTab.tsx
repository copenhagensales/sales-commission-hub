import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Search, Users, Phone, Loader2, FileText, Trash2, Eye, EyeOff, Mail, UserCheck, Send } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { usePermissions } from "@/hooks/usePositionPermissions";

export function StaffEmployeesTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createData, setCreateData] = useState({ first_name: "", last_name: "", email: "", password: "", job_title: "" });
  const [creatingEmployee, setCreatingEmployee] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [deleteEmployeeId, setDeleteEmployeeId] = useState<string | null>(null);
  const [sendingResetTo, setSendingResetTo] = useState<string | null>(null);
  const { canEditEmployees } = usePermissions();

  interface StaffEmployee {
    id: string;
    first_name: string;
    last_name: string;
    private_email: string | null;
    private_phone: string | null;
    job_title: string | null;
    department: string | null;
    is_active: boolean;
    invitation_status: string | null;
  }

  const { data: staffEmployees = [], isLoading } = useQuery<StaffEmployee[]>({
    queryKey: ["staff-employees"],
    queryFn: async () => {
      const query = supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, private_email, private_phone, job_title, department, is_active, invitation_status");
      // @ts-expect-error - Supabase type instantiation depth issue
      const result = await query.eq("is_staff_employee", true).order("last_name", { ascending: true });
      if (result.error) throw result.error;
      return (result.data as StaffEmployee[]) ?? [];
    },
  });

  const { data: jobPositions = [] } = useQuery({
    queryKey: ["job-positions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_positions")
        .select("id, name, is_active")
        .eq("is_active", true)
        .order("name")
        .returns<{ id: string; name: string; is_active: boolean }[]>();
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["staff-contracts-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("employee_id, status")
        .eq("status", "signed")
        .returns<{ employee_id: string; status: string }[]>();
      if (error) throw error;
      return data ?? [];
    },
  });

  const hasSignedContract = (employeeId: string) => {
    return contracts.some(c => c.employee_id === employeeId);
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
      queryClient.invalidateQueries({ queryKey: ["staff-employees"] });
      toast({ title: t("employees.toast.statusUpdated") });
    },
    onError: (error) => {
      toast({ title: t("employees.toast.error"), description: error.message, variant: "destructive" });
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
      queryClient.invalidateQueries({ queryKey: ["staff-employees"] });
      toast({ title: t("employees.toast.deleted") });
      setDeleteEmployeeId(null);
    },
    onError: (error) => {
      toast({ title: t("employees.toast.error"), description: error.message, variant: "destructive" });
    },
  });

  const handleCreateEmployee = async () => {
    if (!createData.first_name || !createData.email || !createData.password || !createData.job_title) {
      toast({ title: t("employees.toast.fillRequired"), variant: "destructive" });
      return;
    }

    if (createData.password.length < 6) {
      toast({ title: t("employees.toast.passwordTooShort"), variant: "destructive" });
      return;
    }

    setCreatingEmployee(true);
    try {
      const response = await supabase.functions.invoke("create-employee-user", {
        body: {
          email: createData.email,
          password: createData.password,
          firstName: createData.first_name,
          lastName: createData.last_name,
        },
      });

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      if (response.error) {
        throw new Error(response.error.message || t("employees.toast.couldNotCreate"));
      }

      if (!response.data?.success) {
        throw new Error(t("employees.toast.couldNotCreate"));
      }

      const { error: createError } = await supabase
        .from("employee_master_data")
        .insert({
          first_name: createData.first_name,
          last_name: createData.last_name || "",
          private_email: createData.email,
          job_title: createData.job_title,
          is_active: true,
          employment_start_date: new Date().toISOString().split("T")[0],
          is_staff_employee: true,
        });

      if (createError) throw createError;

      queryClient.invalidateQueries({ queryKey: ["staff-employees"] });
      toast({ 
        title: t("employees.toast.created"), 
        description: t("employees.toast.userCreated", { email: createData.email }) 
      });
      setCreateDialogOpen(false);
      setCreateData({ first_name: "", last_name: "", email: "", password: "", job_title: "" });
    } catch (error) {
      console.error("Create error:", error);
      toast({
        title: t("employees.toast.error"),
        description: error instanceof Error ? error.message : t("employees.toast.couldNotCreate"),
        variant: "destructive",
      });
    } finally {
      setCreatingEmployee(false);
    }
  };

  const handleSendInvitation = async (employee: typeof staffEmployees[0]) => {
    if (!employee.private_email) {
      toast({ title: t("employees.toast.noEmail"), description: t("employees.toast.noEmailRegistered"), variant: "destructive" });
      return;
    }

    setSendingResetTo(employee.id);
    try {
      const response = await supabase.functions.invoke("send-employee-invitation", {
        body: {
          employeeId: employee.id,
          email: employee.private_email,
          firstName: employee.first_name,
          lastName: employee.last_name,
        },
      });

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      if (response.error) {
        throw new Error(response.error.message || t("employees.toast.couldNotSendEmail"));
      }

      queryClient.invalidateQueries({ queryKey: ["staff-employees"] });
      toast({ 
        title: t("employees.toast.invitationSent"), 
        description: t("employees.toast.invitationSentDesc", { email: employee.private_email }) 
      });
    } catch (error) {
      console.error("Send invitation error:", error);
      toast({
        title: t("employees.toast.error"),
        description: error instanceof Error ? error.message : t("employees.toast.couldNotSendEmail"),
        variant: "destructive",
      });
    } finally {
      setSendingResetTo(null);
    }
  };

  const filteredEmployees = staffEmployees
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

  const activeCount = staffEmployees.filter((e) => e.is_active).length;
  const inactiveCount = staffEmployees.length - activeCount;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-card/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Aktive stabsmedarbejdere</span>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">{activeCount}</div>
        </div>
        <div className="rounded-xl bg-card/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Inaktive stabsmedarbejdere</span>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">{inactiveCount}</div>
        </div>
        <div className="rounded-xl bg-card/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Total</span>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">{staffEmployees.length}</div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h2 className="text-xl font-semibold">Stabsmedarbejdere oversigt</h2>
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
                Alle ({staffEmployees.length})
              </Button>
            </div>
            <div className="relative w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Søg stabsmedarbejdere..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="pl-9 bg-muted/50 border-0 focus-visible:ring-1 h-9" 
              />
            </div>
            <Dialog open={createDialogOpen} onOpenChange={(open) => {
              setCreateDialogOpen(open);
              if (!open) setCreateData({ first_name: "", last_name: "", email: "", password: "", job_title: "" });
            }}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> Opret stabsmedarbejder</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Opret ny stabsmedarbejder</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Opret en ny stabsmedarbejder med login-adgang til systemet.
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
                      placeholder="stabsmedarbejder@email.dk"
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
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleCreateEmployee} disabled={creatingEmployee}>
                    {creatingEmployee ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opretter...</>
                    ) : (
                      <><Plus className="mr-2 h-4 w-4" /> Opret stabsmedarbejder</>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        
        <div className="rounded-xl bg-card/50 overflow-hidden">
          {isLoading ? (
            <p className="text-muted-foreground p-6">Indlæser...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border/50">
                  <TableHead className="text-xs font-medium text-muted-foreground">{t("employees.table.name")}</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">{t("employees.table.email")}</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">{t("employees.table.phone")}</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">{t("employees.table.position")}</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">{t("employees.table.status")}</TableHead>
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
                              {hasSignedContract(employee.id) ? t("employees.table.contractSigned") : t("employees.table.noContractSigned")}
                            </TooltipContent>
                          </Tooltip>
                          <span>{employee.first_name} {employee.last_name}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                      {employee.private_email ? (
                        <a href={`mailto:${employee.private_email}`} className="text-primary hover:underline text-sm">
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
                          onClick={(e) => e.stopPropagation()}
                          disabled={!employee.private_phone}
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </Button>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                handleSendInvitation(employee);
                              }}
                              disabled={!employee.private_email || sendingResetTo === employee.id || employee.invitation_status === "completed"}
                            >
                              {sendingResetTo === employee.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : employee.invitation_status === "completed" ? (
                                <UserCheck className="h-3.5 w-3.5 text-green-500" />
                              ) : employee.invitation_status === "pending" ? (
                                <Send className="h-3.5 w-3.5 text-amber-500" />
                              ) : (
                                <Mail className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {employee.invitation_status === "completed" 
                              ? t("employees.actions.registered") 
                              : employee.invitation_status === "pending"
                              ? t("employees.actions.resendInvitation")
                              : t("employees.actions.sendInvitation")}
                          </TooltipContent>
                        </Tooltip>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); navigate(`/employees/${employee.id}`); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {canEditEmployees && (
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
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Ingen stabsmedarbejdere fundet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <AlertDialog open={!!deleteEmployeeId} onOpenChange={(open) => !open && setDeleteEmployeeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("employees.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("employees.delete.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("employees.delete.cancel")}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteEmployeeId && deleteMutation.mutate(deleteEmployeeId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("employees.delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
