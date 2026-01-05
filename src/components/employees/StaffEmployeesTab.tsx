import React, { useState, useEffect } from "react";
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
import { Plus, Pencil, Search, Users, Phone, Loader2, FileText, Trash2, Eye, EyeOff, Mail, UserCheck, Send, ArrowRightLeft, Clock, X, Check, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [sortColumn, setSortColumn] = useState<"name" | "position" | "team">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createData, setCreateData] = useState({ first_name: "", last_name: "", email: "", password: "", job_title: "" });
  const [creatingEmployee, setCreatingEmployee] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [deleteEmployeeId, setDeleteEmployeeId] = useState<string | null>(null);
  const [moveToRegularId, setMoveToRegularId] = useState<string | null>(null);
  const [sendingResetTo, setSendingResetTo] = useState<string | null>(null);
  const [deactivatingEmployee, setDeactivatingEmployee] = useState<StaffEmployee | null>(null);
  const { canEditEmployees } = usePermissions();
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  interface StaffEmployee {
    id: string;
    first_name: string;
    last_name: string;
    private_email: string | null;
    work_email: string | null;
    private_phone: string | null;
    job_title: string | null;
    department: string | null;
    team_id: string | null;
    is_active: boolean;
    invitation_status: string | null;
  }

  const { data: staffEmployees = [], isLoading } = useQuery<StaffEmployee[]>({
    queryKey: ["staff-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, private_email, work_email, private_phone, job_title, department, team_id, is_active, invitation_status")
        .eq("is_staff_employee", true)
        .order("last_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as StaffEmployee[];
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
        .returns<{ employee_id: string; status: string }[]>();
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch team memberships
  const { data: teamMemberships = [] } = useQuery({
    queryKey: ["staff-employee-team-memberships"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("employee_id, teams:team_id(name)");
      if (error) throw error;
      return data as { employee_id: string; teams: { name: string } | null }[];
    },
  });

  // Get teams for an employee
  const getEmployeeTeams = (employeeId: string): string => {
    const memberships = teamMemberships.filter(tm => tm.employee_id === employeeId);
    if (memberships.length === 0) return "";
    return memberships.map(tm => tm.teams?.name).filter(Boolean).join(", ");
  };

  // Get unique teams for filter dropdown
  const uniqueTeams = React.useMemo(() => {
    const teams = new Set<string>();
    teamMemberships.forEach(tm => {
      if (tm.teams?.name) teams.add(tm.teams.name);
    });
    return Array.from(teams).sort((a, b) => a.localeCompare(b, 'da'));
  }, [teamMemberships]);

  // Keyboard shortcut for search (⌘K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle sort
  const handleSort = (column: "name" | "position" | "team") => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Get contract status for an employee (prioritized: signed > pending > rejected > none)
  const getContractStatus = (employeeId: string): 'signed' | 'pending' | 'rejected' | 'none' => {
    const employeeContracts = contracts.filter(c => c.employee_id === employeeId);
    if (employeeContracts.some(c => c.status === 'signed')) return 'signed';
    if (employeeContracts.some(c => c.status === 'pending_employee')) return 'pending';
    if (employeeContracts.some(c => c.status === 'rejected')) return 'rejected';
    return 'none';
  };

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active, employee }: { id: string; is_active: boolean; employee?: StaffEmployee }) => {
      const today = new Date().toISOString().split("T")[0];
      const updateData = is_active
        ? { is_active, employment_start_date: today, employment_end_date: null }
        : { is_active, employment_end_date: today };
      
      const { error } = await supabase
        .from("employee_master_data")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;

      // If deactivating, send deactivation reminder
      if (!is_active && employee?.team_id) {
        // Get config for this team (manually configured recipients)
        const { data: config } = await supabase
          .from("deactivation_reminder_config")
          .select("recipients")
          .eq("team_id", employee.team_id)
          .single();

        const manualRecipients = config?.recipients 
          ? config.recipients.split(",").map((r: string) => r.trim()).filter((r: string) => r)
          : [];

        // Get team with team leader and assistant team leader
        const { data: team } = await supabase
          .from("teams")
          .select("name, team_leader_id, assistant_team_leader_id")
          .eq("id", employee.team_id)
          .single();

        // Collect automatic recipients
        const autoRecipientEmails: string[] = [];

        // Get team leader and assistant team leader work emails (only work_email, no fallback)
        const leaderIds = [team?.team_leader_id, team?.assistant_team_leader_id].filter(Boolean) as string[];
        if (leaderIds.length > 0) {
          const { data: leaders } = await supabase
            .from("employee_master_data")
            .select("work_email")
            .in("id", leaderIds);
          
          (leaders || []).forEach(l => {
            if (l.work_email) autoRecipientEmails.push(l.work_email);
          });
        }

        // Get all recruitment responsible employees (only work_email)
        const { data: recruiters } = await supabase
          .from("employee_master_data")
          .select("work_email")
          .eq("job_title", "Rekruttering")
          .eq("is_active", true);
        
        (recruiters || []).forEach(r => {
          if (r.work_email) autoRecipientEmails.push(r.work_email);
        });

        // Get all owners (only work_email) - exclude Angel, owners only get initial email (no followup)
        const { data: owners } = await supabase
          .from("employee_master_data")
          .select("work_email")
          .eq("job_title", "Ejer")
          .eq("is_active", true)
          .neq("first_name", "Angel");
        
        const ownerEmails: string[] = [];
        (owners || []).forEach(o => {
          if (o.work_email) ownerEmails.push(o.work_email);
        });

        // Combine all recipients (manual + automatic) and remove duplicates
        const allRecipients = [...new Set([...manualRecipients, ...autoRecipientEmails, ...ownerEmails])];

        if (allRecipients.length > 0) {
          await supabase.functions.invoke("send-deactivation-reminder", {
            body: {
              employee_id: id,
              employee_name: `${employee.first_name} ${employee.last_name}`,
              employee_email: employee.work_email || "",
              team_id: employee.team_id,
              team_name: team?.name || "Ukendt team",
              recipients: allRecipients,
              is_followup: false,
            },
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-employees"] });
      setDeactivatingEmployee(null);
      toast({ title: t("employees.toast.statusUpdated") });
    },
    onError: (error) => {
      toast({ title: t("employees.toast.error"), description: error.message, variant: "destructive" });
    },
  });

  const moveToRegularMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("employee_master_data")
        .update({ is_staff_employee: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-employees"] });
      queryClient.invalidateQueries({ queryKey: ["employee-master-data"] });
      queryClient.invalidateQueries({ queryKey: ["staff-employee-count"] });
      toast({ title: "Medarbejder flyttet" });
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
      setDeleteEmployeeId(null);
      toast({ title: t("employees.toast.deleted") });
    },
    onError: (error) => {
      toast({ title: t("employees.toast.error"), description: error.message, variant: "destructive" });
    },
  });

  const handleCreateEmployee = async () => {
    if (!createData.first_name.trim()) {
      toast({ title: "Fornavn er påkrævet", variant: "destructive" });
      return;
    }
    if (!createData.email.trim()) {
      toast({ title: "Email er påkrævet", variant: "destructive" });
      return;
    }
    if (!createData.password.trim() || createData.password.length < 6) {
      toast({ title: "Kodeord skal være mindst 6 tegn", variant: "destructive" });
      return;
    }
    if (!createData.job_title) {
      toast({ title: "Vælg en stilling", variant: "destructive" });
      return;
    }

    setCreatingEmployee(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("create-employee-user", {
        body: {
          first_name: createData.first_name.trim(),
          last_name: createData.last_name.trim(),
          email: createData.email.trim().toLowerCase(),
          password: createData.password,
          job_title: createData.job_title,
          is_staff_employee: true,
        },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      queryClient.invalidateQueries({ queryKey: ["staff-employees"] });
      queryClient.invalidateQueries({ queryKey: ["staff-employee-count"] });
      setCreateDialogOpen(false);
      setCreateData({ first_name: "", last_name: "", email: "", password: "", job_title: "" });
      toast({ title: "Backoffice medarbejder oprettet", description: "Medarbejderen kan nu logge ind med den angivne email og kodeord." });
    } catch (error) {
      console.error("Create employee error:", error);
      toast({ 
        title: "Fejl ved oprettelse", 
        description: error instanceof Error ? error.message : "Der opstod en fejl", 
        variant: "destructive" 
      });
    } finally {
      setCreatingEmployee(false);
    }
  };

  const handleSendInvitation = async (employee: StaffEmployee) => {
    const email = employee.private_email || employee.work_email;
    if (!email) {
      toast({
        title: t("employees.toast.noEmail"),
        variant: "destructive",
      });
      return;
    }

    setSendingResetTo(employee.id);
    try {
      const { error } = await supabase.functions.invoke("send-employee-invitation", {
        body: {
          employee_id: employee.id,
          email: email,
          name: `${employee.first_name} ${employee.last_name}`,
        },
      });

      if (error) throw error;

      await supabase
        .from("employee_master_data")
        .update({ invitation_status: "pending" })
        .eq("id", employee.id);

      queryClient.invalidateQueries({ queryKey: ["staff-employees"] });
      toast({
        title: t("employees.toast.invitationSent"),
        description: `${t("employees.toast.sentTo")} ${email}`,
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
    .filter((e) => {
      if (teamFilter === "all") return true;
      const employeeTeams = getEmployeeTeams(e.id);
      return employeeTeams.includes(teamFilter);
    })
    .filter(
      (e) =>
        `${e.first_name} ${e.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.private_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.job_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getEmployeeTeams(e.id).toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let comparison = 0;
      if (sortColumn === "name") {
        const nameA = `${a.last_name} ${a.first_name}`.toLowerCase();
        const nameB = `${b.last_name} ${b.first_name}`.toLowerCase();
        comparison = nameA.localeCompare(nameB, 'da');
      } else if (sortColumn === "position") {
        const posA = a.job_title || "";
        const posB = b.job_title || "";
        comparison = posA.localeCompare(posB, 'da');
      } else if (sortColumn === "team") {
        const teamA = getEmployeeTeams(a.id) || "";
        const teamB = getEmployeeTeams(b.id) || "";
        comparison = teamA.localeCompare(teamB, 'da');
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

  const activeCount = staffEmployees.filter((e) => e.is_active).length;
  const inactiveCount = staffEmployees.length - activeCount;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-card/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Aktive backoffice</span>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">{activeCount}</div>
        </div>
        <div className="rounded-xl bg-card/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Inaktive backoffice</span>
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
          <h2 className="text-xl font-semibold">Backoffice oversigt</h2>
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
                Inaktive
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
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="w-36 h-9 bg-muted/50 border-0">
                <SelectValue placeholder="Alle teams" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">Alle teams</SelectItem>
                {uniqueTeams.map((team) => (
                  <SelectItem key={team} value={team}>{team}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                ref={searchInputRef}
                placeholder="Søg backoffice..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="pl-9 pr-12 bg-muted/50 border-0 focus-visible:ring-1 h-9" 
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                <span className="text-xs">⌘</span>K
              </kbd>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={(open) => {
              setCreateDialogOpen(open);
              if (!open) setCreateData({ first_name: "", last_name: "", email: "", password: "", job_title: "" });
            }}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> Opret backoffice</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Opret ny backoffice medarbejder</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Opret en ny backoffice medarbejder med login-adgang til systemet.
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
                  <TableHead 
                    className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center gap-1">
                      {t("employees.table.name")}
                      {sortColumn === "name" ? (
                        sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort("position")}
                  >
                    <div className="flex items-center gap-1">
                      {t("employees.table.position")}
                      {sortColumn === "position" ? (
                        sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort("team")}
                  >
                    <div className="flex items-center gap-1">
                      Team
                      {sortColumn === "team" ? (
                        sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </div>
                  </TableHead>
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
                      <div className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="relative">
                              {getContractStatus(employee.id) === 'signed' ? (
                                <div className="flex items-center">
                                  <FileText className="h-3.5 w-3.5 text-green-500" />
                                  <Check className="h-2.5 w-2.5 text-green-500 absolute -right-1 -bottom-0.5" />
                                </div>
                              ) : getContractStatus(employee.id) === 'pending' ? (
                                <div className="flex items-center">
                                  <FileText className="h-3.5 w-3.5 text-amber-500" />
                                  <Clock className="h-2.5 w-2.5 text-amber-500 absolute -right-1 -bottom-0.5" />
                                </div>
                              ) : getContractStatus(employee.id) === 'rejected' ? (
                                <div className="flex items-center">
                                  <FileText className="h-3.5 w-3.5 text-red-500" />
                                  <X className="h-2.5 w-2.5 text-red-500 absolute -right-1 -bottom-0.5" />
                                </div>
                              ) : (
                                <FileText className="h-3.5 w-3.5 text-muted-foreground/30" />
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {getContractStatus(employee.id) === 'signed' 
                              ? t("employees.table.contractSigned")
                              : getContractStatus(employee.id) === 'pending'
                              ? "Afventer underskrift"
                              : getContractStatus(employee.id) === 'rejected'
                              ? "Kontrakt afvist"
                              : t("employees.table.noContractSigned")}
                          </TooltipContent>
                        </Tooltip>
                        <span>{employee.first_name} {employee.last_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-sm">{employee.job_title || <span className="text-muted-foreground/50">-</span>}</TableCell>
                    <TableCell className="py-3">
                      {getEmployeeTeams(employee.id) ? (
                        <Badge variant="secondary" className="text-xs font-normal">{getEmployeeTeams(employee.id)}</Badge>
                      ) : <span className="text-muted-foreground/50">-</span>}
                    </TableCell>
                    <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                      <Switch 
                        checked={employee.is_active} 
                        onCheckedChange={(checked) => {
                          if (!checked) {
                            setDeactivatingEmployee(employee);
                          } else {
                            toggleActiveMutation.mutate({ id: employee.id, is_active: true, employee });
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-0.5">
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
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={(e) => { e.stopPropagation(); setMoveToRegularId(employee.id); }}
                              disabled={moveToRegularMutation.isPending}
                            >
                              <ArrowRightLeft className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Flyt til medarbejdere</TooltipContent>
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
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Ingen backoffice medarbejdere fundet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Deactivation confirmation dialog */}
      <AlertDialog open={!!deactivatingEmployee} onOpenChange={(open) => !open && setDeactivatingEmployee(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deaktiver medarbejder</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på at du vil deaktivere {deactivatingEmployee?.first_name} {deactivatingEmployee?.last_name}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deactivatingEmployee && toggleActiveMutation.mutate({ id: deactivatingEmployee.id, is_active: false, employee: deactivatingEmployee })}
            >
              Deaktiver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      <AlertDialog open={!!moveToRegularId} onOpenChange={(open) => !open && setMoveToRegularId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Flyt til medarbejdere</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på at du vil flytte denne backoffice medarbejder til almindelige medarbejdere?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (moveToRegularId) {
                  moveToRegularMutation.mutate(moveToRegularId);
                  setMoveToRegularId(null);
                }
              }}
            >
              Flyt medarbejder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
