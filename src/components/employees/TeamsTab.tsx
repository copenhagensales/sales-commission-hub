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
import { Plus, Pencil, Trash2, Users, Building2, UserCheck, UserX } from "lucide-react";
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
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    team_leader_id: "",
    assistant_team_leader_id: "",
    client_ids: [] as string[],
    employee_ids: [] as string[],
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
        .select("id, first_name, last_name, job_title, team_id")
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

      // Add members
      if (data.employee_ids.length > 0) {
        const { error: membersError } = await supabase
          .from("team_members")
          .insert(data.employee_ids.map((employee_id) => ({ team_id: newTeam.id, employee_id })));
        if (membersError) throw membersError;
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

      // Delete existing members and re-add
      await supabase.from("team_members").delete().eq("team_id", data.id);
      if (data.employee_ids.length > 0) {
        const { error: membersError } = await supabase
          .from("team_members")
          .insert(data.employee_ids.map((employee_id) => ({ team_id: data.id, employee_id })));
        if (membersError) throw membersError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams-tab"] });
      queryClient.invalidateQueries({ queryKey: ["team-clients-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["team-members-mappings"] });
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

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      team_leader_id: "",
      assistant_team_leader_id: "",
      client_ids: [],
      employee_ids: [],
    });
    setClientSearch("");
    setEmployeeSearch("");
  };

  // Filtered lists for search
  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const filteredEmployees = employees.filter((emp) =>
    `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(employeeSearch.toLowerCase())
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
    });
    setDialogOpen(true);
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

  const toggleEmployee = (employeeId: string) => {
    setFormData((prev) => ({
      ...prev,
      employee_ids: prev.employee_ids.includes(employeeId)
        ? prev.employee_ids.filter((id) => id !== employeeId)
        : [...prev.employee_ids, employeeId],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Teams</h2>
          <p className="text-sm text-muted-foreground">Administrer teams, teamledere og medarbejdere</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Opret team
        </Button>
      </div>

      <div className="rounded-xl bg-card/50 overflow-hidden">
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
                  <TableRow key={team.id} className="border-b border-border/30">
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
          </Table>
        )}
      </div>

      {/* Employees without team */}
      {(() => {
        // Get all employee IDs that are in at least one team
        const employeeIdsWithTeam = new Set(teamMembers.map((tm) => tm.employee_id));
        
        // Filter employees who are NOT in any team
        const employeesWithoutTeam = employees.filter(
          (emp) => !employeeIdsWithTeam.has(emp.id)
        );
        
        if (employeesWithoutTeam.length === 0) return null;
        
        return (
          <div className="rounded-xl border border-border bg-card/50 p-4">
            <div className="flex items-center gap-2 mb-4">
              <UserX className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-foreground">
                Medarbejdere uden team ({employeesWithoutTeam.length})
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {employeesWithoutTeam.map((emp) => (
                <div
                  key={emp.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => navigate(`/employees/${emp.id}`)}
                >
                  <span className="text-sm text-foreground">
                    {emp.first_name} {emp.last_name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

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
            <div className="px-6 pt-4 pb-2 border-b bg-muted/30">
              <TabsList className="h-auto p-1 bg-transparent gap-1">
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
                  value="employees"
                  className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg px-4 py-2 text-sm font-medium"
                >
                  <UserCheck className="h-4 w-4 mr-2" />
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
                        Kun stabsmedarbejdere vises her
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

              {/* Employees Tab */}
              <TabsContent value="employees" className="mt-0 py-6">
                <div className="space-y-4">
                  <div className="relative">
                    <Input
                      placeholder="Søg efter medarbejder..."
                      value={employeeSearch}
                      onChange={(e) => setEmployeeSearch(e.target.value)}
                      className="h-11 pl-10"
                    />
                    <UserCheck className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                  
                  <div className="grid sm:grid-cols-2 gap-2">
                    {filteredEmployees.length === 0 ? (
                      <div className="col-span-2 py-8 text-center text-muted-foreground">
                        Ingen medarbejdere fundet
                      </div>
                    ) : (
                      filteredEmployees.map((emp) => {
                        const isSelected = formData.employee_ids.includes(emp.id);
                        return (
                          <div 
                            key={emp.id} 
                            onClick={() => toggleEmployee(emp.id)}
                            className={`
                              flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                              ${isSelected 
                                ? 'bg-primary/5 border-primary/30 ring-1 ring-primary/20' 
                                : 'hover:bg-muted/50 border-border'
                              }
                            `}
                          >
                            <Checkbox
                              id={`emp-${emp.id}`}
                              checked={isSelected}
                              onCheckedChange={() => toggleEmployee(emp.id)}
                              className="pointer-events-none"
                            />
                            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                              {emp.first_name.charAt(0)}{emp.last_name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium block truncate">
                                {emp.first_name} {emp.last_name}
                              </span>
                              {emp.job_title && (
                                <span className="text-xs text-muted-foreground truncate block">
                                  {emp.job_title}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Schedule Tab */}
              <TabsContent value="schedule" className="mt-0 py-6">
                <TeamStandardShifts teamId={editingTeam?.id || null} />
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
