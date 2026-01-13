import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Users, Building2, UserCheck, UserX, X, Coins, ArrowRightLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TeamStandardShifts } from "./TeamStandardShifts";

interface Team {
  id: string;
  name: string;
  description: string | null;
  team_leader_id: string | null;
  assistant_team_leader_id: string | null;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  team_id: string | null;
  is_staff_employee: boolean;
}

interface Client {
  id: string;
  name: string;
  logo_url: string | null;
}

export function TeamsTab() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [viewMode, setViewMode] = useState<"teams" | "employees">("teams");
  
  // Move team dialog state
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [employeeToMove, setEmployeeToMove] = useState<Employee | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [moveEmployeeSearch, setMoveEmployeeSearch] = useState("");
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    team_leader_id: "",
    assistant_team_leader_id: "",
    client_ids: [] as string[],
    employee_ids: [] as string[],
    daily_bonus: {} as Record<string, { amount: number; days: number }>,
  });

  // Fetch teams
  const { data: teams = [], isLoading } = useQuery({
    queryKey: ["teams-tab"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Team[];
    },
  });

  // Fetch staff employees for team leader selection
  const { data: teamLeaders = [] } = useQuery({
    queryKey: ["staff-employees-for-teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, job_title")
        .eq("is_active", true)
        .eq("is_staff_employee", true)
        .order("first_name");
      if (error) throw error;
      return data as Employee[];
    },
  });

  // Fetch all active employees
  const { data: employees = [] } = useQuery({
    queryKey: ["all-employees-for-teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, job_title, team_id, is_staff_employee")
        .eq("is_active", true)
        .order("first_name");
      if (error) throw error;
      return data as Employee[];
    },
  });

  // Fetch clients (from MG Test)
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, logo_url")
        .order("name");
      if (error) throw error;
      return data as Client[];
    },
  });

  // Fetch team_clients mappings
  const { data: teamClients = [] } = useQuery({
    queryKey: ["team-clients-mappings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_clients")
        .select("team_id, client_id");
      if (error) throw error;
      return data;
    },
  });

  // Fetch team_members mappings
  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team-members-mappings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("team_id, employee_id");
      if (error) throw error;
      return data;
    },
  });

  // Fetch team_client_daily_bonus mappings
  const { data: teamDailyBonus = [] } = useQuery({
    queryKey: ["team-client-daily-bonus"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_client_daily_bonus")
        .select("team_id, client_id, bonus_amount, bonus_days");
      if (error) throw error;
      return data as { team_id: string; client_id: string; bonus_amount: number; bonus_days: number }[];
    },
  });

  // Get daily bonus for a team
  const getTeamDailyBonus = (teamId: string) => {
    const bonuses: Record<string, { amount: number; days: number }> = {};
    teamDailyBonus
      .filter((b) => b.team_id === teamId)
      .forEach((b) => {
        bonuses[b.client_id] = { amount: Number(b.bonus_amount), days: b.bonus_days };
      });
    return bonuses;
  };

  // Employee map for displaying names
  const employeeMap = employees.reduce((acc, emp) => {
    acc[emp.id] = `${emp.first_name} ${emp.last_name}`;
    return acc;
  }, {} as Record<string, string>);

  // Get clients for a team
  const getTeamClients = (teamId: string) => {
    return teamClients.filter((tc) => tc.team_id === teamId).map((tc) => tc.client_id);
  };

  // Get members for a team
  const getTeamMembers = (teamId: string) => {
    return teamMembers.filter((tm) => tm.team_id === teamId).map((tm) => tm.employee_id);
  };

  // Create team mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Create team
      const { data: newTeam, error: teamError } = await supabase
        .from("teams")
        .insert({
          name: data.name,
          description: data.description || null,
          team_leader_id: data.team_leader_id || null,
          assistant_team_leader_id: data.assistant_team_leader_id || null,
        })
        .select()
        .single();
      if (teamError) throw teamError;

      // Add clients
      if (data.client_ids.length > 0) {
        const { error: clientsError } = await supabase
          .from("team_clients")
          .insert(data.client_ids.map((client_id) => ({ team_id: newTeam.id, client_id })));
        if (clientsError) throw clientsError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams-tab"] });
      queryClient.invalidateQueries({ queryKey: ["team-clients-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["team-members-mappings"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "Team oprettet" });
    },
    onError: (error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  // Update team mutation
  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData & { id: string }) => {
      // Update team
      const { error: teamError } = await supabase
        .from("teams")
        .update({
          name: data.name,
          description: data.description || null,
          team_leader_id: data.team_leader_id || null,
          assistant_team_leader_id: data.assistant_team_leader_id || null,
        })
        .eq("id", data.id);
      if (teamError) throw teamError;

      // Delete existing clients and re-add
      await supabase.from("team_clients").delete().eq("team_id", data.id);
      if (data.client_ids.length > 0) {
        const { error: clientsError } = await supabase
          .from("team_clients")
          .insert(data.client_ids.map((client_id) => ({ team_id: data.id, client_id })));
        if (clientsError) throw clientsError;
      }

      // Delete existing daily bonus and re-add
      await supabase.from("team_client_daily_bonus").delete().eq("team_id", data.id);
      const bonusEntries = Object.entries(data.daily_bonus)
        .filter(([_, value]) => value.amount > 0 || value.days > 0)
        .map(([client_id, value]) => ({
          team_id: data.id,
          client_id,
          bonus_amount: value.amount,
          bonus_days: value.days,
        }));
      if (bonusEntries.length > 0) {
        const { error: bonusError } = await supabase
          .from("team_client_daily_bonus")
          .insert(bonusEntries);
        if (bonusError) throw bonusError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams-tab"] });
      queryClient.invalidateQueries({ queryKey: ["team-clients-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["team-members-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["team-client-daily-bonus"] });
      setDialogOpen(false);
      setEditingTeam(null);
      resetForm();
      toast({ title: "Team opdateret" });
    },
    onError: (error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  // Delete team mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("teams").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams-tab"] });
      queryClient.invalidateQueries({ queryKey: ["team-clients-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["team-members-mappings"] });
      toast({ title: "Team slettet" });
    },
    onError: (error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  // Move employee to team mutation
  // Database trigger automatically removes non-staff employees from other teams
  const moveEmployeeToTeamMutation = useMutation({
    mutationFn: async ({ employeeId, teamId }: { employeeId: string; teamId: string }) => {
      // Check if employee is staff
      const employee = employees.find(e => e.id === employeeId);
      const isStaffEmployee = employee?.is_staff_employee ?? false;
      
      // Get existing team memberships for this employee
      const existingTeams = teamMembers.filter(tm => tm.employee_id === employeeId);
      const previousTeamIds = existingTeams.map(tm => tm.team_id);
      
      // Check if already in target team
      if (previousTeamIds.includes(teamId)) {
        throw new Error("Medarbejderen er allerede på dette team");
      }
      
      // Insert into new team - database trigger handles cleanup for non-staff
      const { error } = await supabase
        .from("team_members")
        .insert({ employee_id: employeeId, team_id: teamId });
      if (error) throw error;
      
      // Return context for toast message
      return { isStaffEmployee, previousTeamIds, newTeamId: teamId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["team-members-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["all-employees-for-teams"] });
      
      const newTeam = teams.find(t => t.id === result.newTeamId);
      const previousTeams = result.previousTeamIds
        .filter(id => id !== result.newTeamId)
        .map(id => teams.find(t => t.id === id)?.name)
        .filter(Boolean);
      
      if (result.isStaffEmployee) {
        toast({ title: `Medarbejder tilføjet til ${newTeam?.name || 'team'}` });
      } else if (previousTeams.length > 0) {
        toast({ 
          title: `Medarbejder flyttet til ${newTeam?.name || 'team'}`,
          description: `Fjernet fra: ${previousTeams.join(', ')}`
        });
      } else {
        toast({ title: `Medarbejder tilføjet til ${newTeam?.name || 'team'}` });
      }
      
      // Close dialog and reset
      setMoveDialogOpen(false);
      setEmployeeToMove(null);
      setSelectedTeamId("");
      setMoveEmployeeSearch("");
    },
    onError: (error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      team_leader_id: "",
      assistant_team_leader_id: "",
      client_ids: [],
      employee_ids: [],
      daily_bonus: {},
    });
    setClientSearch("");
  };

  // Filtered lists for search
  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const openCreate = () => {
    setEditingTeam(null);
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (team: Team) => {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      description: team.description || "",
      team_leader_id: team.team_leader_id || "",
      assistant_team_leader_id: team.assistant_team_leader_id || "",
      client_ids: getTeamClients(team.id),
      employee_ids: getTeamMembers(team.id),
      daily_bonus: getTeamDailyBonus(team.id),
    });
    setDialogOpen(true);
  };

  // Update daily bonus for a client
  const updateDailyBonus = (clientId: string, field: 'amount' | 'days', value: number) => {
    setFormData((prev) => ({
      ...prev,
      daily_bonus: {
        ...prev.daily_bonus,
        [clientId]: {
          ...prev.daily_bonus[clientId],
          amount: prev.daily_bonus[clientId]?.amount || 0,
          days: prev.daily_bonus[clientId]?.days || 0,
          [field]: value,
        },
      },
    }));
  };

  const handleSave = () => {
    if (!formData.name) {
      toast({ title: "Udfyld teamnavn", variant: "destructive" });
      return;
    }
    if (editingTeam) {
      updateMutation.mutate({ ...formData, id: editingTeam.id });
    } else {
      createMutation.mutate(formData);
    }
  };

  const toggleClient = (clientId: string) => {
    setFormData((prev) => ({
      ...prev,
      client_ids: prev.client_ids.includes(clientId)
        ? prev.client_ids.filter((id) => id !== clientId)
        : [...prev.client_ids, clientId],
    }));
  };

  // Calculate employees without team
  const employeeIdsWithTeam = new Set(teamMembers.map((tm) => tm.employee_id));
  const employeesWithoutTeam = employees.filter(
    (emp) => !employeeIdsWithTeam.has(emp.id)
  );

  // Open move dialog
  const openMoveDialog = (emp?: Employee) => {
    setEmployeeToMove(emp || null);
    setSelectedTeamId("");
    setMoveEmployeeSearch("");
    setMoveDialogOpen(true);
  };

  // Handle move employee
  const handleMoveEmployee = () => {
    if (employeeToMove && selectedTeamId) {
      moveEmployeeToTeamMutation.mutate({ 
        employeeId: employeeToMove.id, 
        teamId: selectedTeamId 
      });
    }
  };

  // Get current team names for an employee
  const getEmployeeTeamNames = (employeeId: string) => {
    const empTeams = teamMembers
      .filter(tm => tm.employee_id === employeeId)
      .map(tm => teams.find(t => t.id === tm.team_id)?.name)
      .filter(Boolean);
    return empTeams;
  };

  // Filtered employees for move dialog
  const filteredMoveEmployees = employees.filter((emp) =>
    `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(moveEmployeeSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Teams</h2>
          <p className="text-sm text-muted-foreground">
            Administrer teams, teamledere og medarbejdere
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-muted">
            <Button
              variant={viewMode === "teams" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("teams")}
              className="h-8"
            >
              <Building2 className="h-4 w-4 mr-2" />
              Teams
            </Button>
            <Button
              variant={viewMode === "employees" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("employees")}
              className="h-8"
            >
              <Users className="h-4 w-4 mr-2" />
              Medarbejdere
            </Button>
          </div>
          <Button variant="outline" onClick={() => openMoveDialog()}>
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            Flyt team
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Opret team
          </Button>
        </div>
      </div>

      {/* Teams table */}
      {viewMode === "teams" && (
        <>
          <div className="rounded-xl bg-card/50 overflow-hidden border border-border">
            {isLoading ? (
              <p className="text-muted-foreground p-6">Indlæser...</p>
            ) : teams.length === 0 ? (
              <p className="text-muted-foreground p-6">Ingen teams oprettet endnu.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-border/50">
                    <TableHead className="text-xs font-medium text-muted-foreground">Navn</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Beskrivelse</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Teamleder</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Ass. Teamleder</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Kunder</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Medarbejdere</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teams.map((team) => {
                    const teamClientIds = getTeamClients(team.id);
                    const teamMemberIds = getTeamMembers(team.id);
                    return (
                      <TableRow 
                        key={team.id}
                        className="border-b border-border/30"
                      >
                        <TableCell className="font-medium py-3">{team.name}</TableCell>
                        <TableCell className="text-muted-foreground py-3">
                          {team.description || "-"}
                        </TableCell>
                        <TableCell className="py-3">
                          {team.team_leader_id && employeeMap[team.team_leader_id]
                            ? employeeMap[team.team_leader_id]
                            : "-"}
                        </TableCell>
                        <TableCell className="py-3">
                          {team.assistant_team_leader_id && employeeMap[team.assistant_team_leader_id]
                            ? employeeMap[team.assistant_team_leader_id]
                            : "-"}
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {teamClientIds.length > 0 ? (
                              teamClientIds.slice(0, 3).map((clientId) => {
                                const client = clients.find((c) => c.id === clientId);
                                return client ? (
                                  <Badge key={clientId} variant="secondary" className="text-xs flex items-center gap-1.5 pr-2">
                                    {client.logo_url ? (
                                      <img
                                        src={client.logo_url}
                                        alt=""
                                        className="h-4 w-4 object-contain rounded-sm"
                                      />
                                    ) : (
                                      <Building2 className="h-3 w-3" />
                                    )}
                                    {client.name}
                                  </Badge>
                                ) : null;
                              })
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                            {teamClientIds.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{teamClientIds.length - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>{teamMemberIds.length}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-0.5">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(team)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => deleteMutation.mutate(team.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <tfoot>
                  <tr className="border-t border-border/50 bg-muted/30">
                    <td colSpan={5} className="py-3 px-4 text-sm font-medium text-muted-foreground text-right">
                      Samlet antal unikke medarbejdere:
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold text-foreground">
                          {new Set(teamMembers.map(tm => tm.employee_id)).size}
                        </span>
                      </div>
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </Table>
            )}
          </div>

          {/* Employees without team */}
          {employeesWithoutTeam.length > 0 && (
            <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <UserX className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">
                    Medarbejdere uden team ({employeesWithoutTeam.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Brug "Flyt team" knappen for at tilføje dem til et team
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {employeesWithoutTeam.map((emp) => (
                  <div
                    key={emp.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 hover:bg-primary/20 hover:border-primary/30 transition-all cursor-pointer"
                    onClick={() => openMoveDialog(emp)}
                  >
                    <span className="text-sm font-medium text-foreground">
                      {emp.first_name} {emp.last_name}
                    </span>
                    <ArrowRightLeft className="h-3 w-3 text-primary/50" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Employee view - grouped by teams */}
      {viewMode === "employees" && (
        <div className="space-y-4">
          {isLoading ? (
            <p className="text-muted-foreground p-6">Indlæser...</p>
          ) : (
            <>
              {teams
                .map((team) => {
                  const memberIds = getTeamMembers(team.id);
                  const teamEmployees = employees.filter((emp) => memberIds.includes(emp.id));
                  if (teamEmployees.length === 0) return null;

                  return (
                    <div key={team.id} className="rounded-xl bg-card/50 border border-border p-4">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold">{team.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {teamEmployees.length} medarbejdere
                            {team.team_leader_id && employeeMap[team.team_leader_id] && 
                              ` • Teamleder: ${employeeMap[team.team_leader_id]}`}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(team)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                        {teamEmployees
                          .sort((a, b) => a.first_name.localeCompare(b.first_name, 'da'))
                          .map((emp) => (
                            <div 
                              key={emp.id}
                              className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer group"
                              onClick={() => navigate(`/employees/${emp.id}`)}
                            >
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <span className="text-xs font-medium text-primary">
                                  {emp.first_name[0]}{emp.last_name[0]}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">
                                  {emp.first_name} {emp.last_name}
                                </p>
                                {emp.job_title && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {emp.job_title}
                                  </p>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openMoveDialog(emp);
                                }}
                              >
                                <ArrowRightLeft className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                        ))}
                      </div>
                    </div>
                  );
                })
                .filter(Boolean)}

              {/* Employees without team */}
              {employeesWithoutTeam.length > 0 && (
                <div className="rounded-xl border-2 border-dashed border-muted-foreground/30 p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <UserX className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-muted-foreground">Uden team</h3>
                      <p className="text-sm text-muted-foreground">
                        {employeesWithoutTeam.length} medarbejdere uden teamtilknytning
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                    {employeesWithoutTeam
                      .sort((a, b) => a.first_name.localeCompare(b.first_name, 'da'))
                      .map((emp) => (
                        <div 
                          key={emp.id}
                          className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer group"
                          onClick={() => navigate(`/employees/${emp.id}`)}
                        >
                          <div className="h-8 w-8 rounded-full bg-muted-foreground/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-medium text-muted-foreground">
                              {emp.first_name[0]}{emp.last_name[0]}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">
                              {emp.first_name} {emp.last_name}
                            </p>
                            {emp.job_title && (
                              <p className="text-xs text-muted-foreground truncate">
                                {emp.job_title}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              openMoveDialog(emp);
                            }}
                          >
                            <ArrowRightLeft className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Move Team Dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              {employeeToMove ? "Flyt medarbejder" : "Flyt medarbejder til team"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Employee selection (if not pre-selected) */}
            {!employeeToMove ? (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Vælg medarbejder</Label>
                <div className="relative">
                  <Input
                    placeholder="Søg efter medarbejder..."
                    value={moveEmployeeSearch}
                    onChange={(e) => setMoveEmployeeSearch(e.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto border rounded-lg">
                  {filteredMoveEmployees.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-3 text-center">
                      Ingen medarbejdere fundet
                    </p>
                  ) : (
                    filteredMoveEmployees.map((emp) => {
                      const empTeams = getEmployeeTeamNames(emp.id);
                      return (
                        <div
                          key={emp.id}
                          className={`flex items-center gap-3 p-3 cursor-pointer transition-colors border-b last:border-b-0 ${
                            employeeToMove?.id === emp.id
                              ? "bg-primary/10"
                              : "hover:bg-muted/50"
                          }`}
                          onClick={() => setEmployeeToMove(emp)}
                        >
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-medium text-primary">
                              {emp.first_name[0]}{emp.last_name[0]}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate flex items-center gap-1.5">
                              {emp.first_name} {emp.last_name}
                              {emp.is_staff_employee && (
                                <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
                                  Stab
                                </Badge>
                              )}
                            </p>
                            {empTeams.length > 0 ? (
                              <p className="text-xs text-muted-foreground truncate">
                                Team: {empTeams.join(", ")}
                              </p>
                            ) : (
                              <p className="text-xs text-orange-500">Uden team</p>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Valgt medarbejder</Label>
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {employeeToMove.first_name[0]}{employeeToMove.last_name[0]}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium flex items-center gap-1.5">
                      {employeeToMove.first_name} {employeeToMove.last_name}
                      {employeeToMove.is_staff_employee && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
                          Stab
                        </Badge>
                      )}
                    </p>
                    {(() => {
                      const empTeams = getEmployeeTeamNames(employeeToMove.id);
                      return empTeams.length > 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Nuværende team: {empTeams.join(", ")}
                        </p>
                      ) : (
                        <p className="text-sm text-orange-500">Uden team</p>
                      );
                    })()}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setEmployeeToMove(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                {!employeeToMove.is_staff_employee && getEmployeeTeamNames(employeeToMove.id).length > 0 && (
                  <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
                    ⚠️ Denne medarbejder vil blive fjernet fra sit nuværende team når du flytter dem.
                  </p>
                )}
                
                {employeeToMove.is_staff_employee && (
                  <p className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-950/30 p-2 rounded">
                    ℹ️ Stabs-medarbejdere kan være på flere teams samtidig.
                  </p>
                )}
              </div>
            )}

            {/* Team selection */}
            {employeeToMove && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Vælg nyt team</Label>
                <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Vælg team..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => {
                      const isCurrentTeam = teamMembers.some(
                        tm => tm.employee_id === employeeToMove.id && tm.team_id === team.id
                      );
                      return (
                        <SelectItem 
                          key={team.id} 
                          value={team.id}
                          disabled={isCurrentTeam}
                        >
                          <span className="flex items-center gap-2">
                            {team.name}
                            {isCurrentTeam && (
                              <Badge variant="secondary" className="text-[10px]">Nuværende</Badge>
                            )}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setMoveDialogOpen(false)}>
              Annuller
            </Button>
            <Button
              onClick={handleMoveEmployee}
              disabled={!employeeToMove || !selectedTeamId || moveEmployeeToTeamMutation.isPending}
            >
              {moveEmployeeToTeamMutation.isPending ? "Flytter..." : (
                employeeToMove?.is_staff_employee ? "Tilføj til team" : "Flyt til team"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Team Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden">
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 bg-background border-b px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg">{editingTeam ? "Rediger team" : "Opret nyt team"}</DialogTitle>
                {editingTeam && (
                  <p className="text-sm text-muted-foreground">{formData.name || "Team"}</p>
                )}
              </div>
            </div>
          </div>
          
          <Tabs defaultValue="team" className="w-full flex flex-col">
            {/* Tab Navigation */}
            <div className="px-6 pt-4 pb-2 border-b bg-muted/30 overflow-x-auto">
              <TabsList className="h-auto p-1 bg-transparent gap-1 flex-wrap">
                <TabsTrigger 
                  value="team" 
                  className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg px-4 py-2 text-sm font-medium"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Team info
                </TabsTrigger>
                <TabsTrigger 
                  value="clients"
                  className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg px-4 py-2 text-sm font-medium"
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  Kunder
                  {formData.client_ids.length > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                      {formData.client_ids.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="team-members"
                  className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg px-4 py-2 text-sm font-medium"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Medarbejdere
                  {formData.employee_ids.length > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                      {formData.employee_ids.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="schedule"
                  className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg px-4 py-2 text-sm font-medium"
                >
                  <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                  Vagtplan
                </TabsTrigger>
                <TabsTrigger 
                  value="daily-bonus"
                  className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg px-4 py-2 text-sm font-medium"
                >
                  <Coins className="h-4 w-4 mr-2" />
                  Dagsbonus
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto max-h-[calc(80vh-200px)] px-6 scrollbar-thin">
              {/* Team Tab */}
              <TabsContent value="team" className="mt-0 py-6">
                <div className="grid gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Teamnavn *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Indtast teamnavn..."
                      className="h-11"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Beskrivelse</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Valgfri beskrivelse af teamet..."
                      className="min-h-[100px] resize-none"
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Teamleder</Label>
                      <Select
                        value={formData.team_leader_id || "__none__"}
                        onValueChange={(value) => setFormData({ ...formData, team_leader_id: value === "__none__" ? "" : value })}
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Vælg teamleder" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Ingen</SelectItem>
                          {teamLeaders.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.first_name} {emp.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Kun backoffice medarbejdere vises her
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Ass. Teamleder</Label>
                      <Select
                        value={formData.assistant_team_leader_id || "__none__"}
                        onValueChange={(value) => setFormData({ ...formData, assistant_team_leader_id: value === "__none__" ? "" : value })}
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Vælg assisterende teamleder" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Ingen</SelectItem>
                          {teamLeaders.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.first_name} {emp.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Clients Tab */}
              <TabsContent value="clients" className="mt-0 py-6">
                <div className="space-y-4">
                  <div className="relative">
                    <Input
                      placeholder="Søg efter kunde..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      className="h-11 pl-10"
                    />
                    <Building2 className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                  
                  <div className="grid sm:grid-cols-2 gap-2">
                    {filteredClients.length === 0 ? (
                      <div className="col-span-2 py-8 text-center text-muted-foreground">
                        Ingen kunder fundet
                      </div>
                    ) : (
                      filteredClients.map((client) => {
                        const isSelected = formData.client_ids.includes(client.id);
                        return (
                          <div 
                            key={client.id} 
                            onClick={() => toggleClient(client.id)}
                            className={`
                              flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                              ${isSelected 
                                ? 'bg-primary/5 border-primary/30 ring-1 ring-primary/20' 
                                : 'hover:bg-muted/50 border-border'
                              }
                            `}
                          >
                            <Checkbox
                              id={`client-${client.id}`}
                              checked={isSelected}
                              onCheckedChange={() => toggleClient(client.id)}
                              className="pointer-events-none"
                            />
                            {client.logo_url ? (
                              <img
                                src={client.logo_url}
                                alt=""
                                className="h-6 w-6 object-contain rounded"
                              />
                            ) : (
                              <div className="h-6 w-6 rounded bg-muted flex items-center justify-center">
                                <Building2 className="h-3 w-3 text-muted-foreground" />
                              </div>
                            )}
                            <span className="text-sm font-medium">{client.name}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Team Members Tab - Shows selected employees (read-only) */}
              <TabsContent value="team-members" className="mt-0 py-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Brug "Flyt team" knappen for at tilføje eller flytte medarbejdere
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setDialogOpen(false);
                        openMoveDialog();
                      }}
                    >
                      <ArrowRightLeft className="h-4 w-4 mr-2" />
                      Flyt team
                    </Button>
                  </div>
                  
                  {formData.employee_ids.length === 0 ? (
                    <div className="py-12 text-center">
                      <UserX className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-muted-foreground">Ingen medarbejdere på dette team</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Brug "Flyt team" knappen for at tilføje medarbejdere
                      </p>
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-2">
                      {employees
                        .filter(emp => formData.employee_ids.includes(emp.id))
                        .map((emp) => (
                          <div 
                            key={emp.id} 
                            className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-all"
                          >
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                              {emp.first_name.charAt(0)}{emp.last_name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium block truncate flex items-center gap-1.5">
                                {emp.first_name} {emp.last_name}
                                {emp.is_staff_employee && (
                                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
                                    Stab
                                  </Badge>
                                )}
                              </span>
                              {emp.job_title && (
                                <span className="text-xs text-muted-foreground truncate block">
                                  {emp.job_title}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Schedule Tab */}
              <TabsContent value="schedule" className="mt-0 py-6">
                <TeamStandardShifts teamId={editingTeam?.id || null} />
              </TabsContent>

              {/* Daily Bonus Tab */}
              <TabsContent value="daily-bonus" className="mt-0 py-6">
                <div className="space-y-4">
                  {formData.client_ids.length === 0 ? (
                    <div className="py-12 text-center">
                      <Building2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-muted-foreground">Ingen kunder valgt på dette team</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Gå til "Kunder" fanen for at tilføje kunder først
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {clients
                        .filter((client) => formData.client_ids.includes(client.id))
                        .map((client) => {
                          const bonus = formData.daily_bonus[client.id] || { amount: 0, days: 0 };
                          return (
                            <div 
                              key={client.id}
                              className="p-4 rounded-lg border bg-card"
                            >
                              <div className="flex items-center gap-3 mb-4">
                                {client.logo_url ? (
                                  <img
                                    src={client.logo_url}
                                    alt=""
                                    className="h-8 w-8 object-contain rounded"
                                  />
                                ) : (
                                  <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                                    <Building2 className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                )}
                                <span className="font-medium">{client.name}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label className="text-sm text-muted-foreground">Beløb (DKK)</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0"
                                    value={bonus.amount || ""}
                                    onChange={(e) => updateDailyBonus(client.id, 'amount', parseFloat(e.target.value) || 0)}
                                    className="h-10"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-sm text-muted-foreground">Antal dage</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="1"
                                    placeholder="0"
                                    value={bonus.days || ""}
                                    onChange={(e) => updateDailyBonus(client.id, 'days', parseInt(e.target.value) || 0)}
                                    className="h-10"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>

          {/* Sticky Footer */}
          <div className="sticky bottom-0 z-10 bg-background border-t px-6 py-4">
            <div className="flex items-center justify-end gap-3">
              <Button 
                variant="ghost" 
                onClick={() => setDialogOpen(false)}
                className="px-6"
              >
                Annuller
              </Button>
              <Button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="px-6"
              >
                {createMutation.isPending || updateMutation.isPending ? "Gemmer..." : "Gem ændringer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
