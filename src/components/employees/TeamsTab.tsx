import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Users, Building2, UserCheck } from "lucide-react";

interface Team {
  id: string;
  name: string;
  description: string | null;
  team_leader_id: string | null;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
}

interface Client {
  id: string;
  name: string;
}

export function TeamsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    team_leader_id: "",
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

  // Fetch team leaders (employees with Teamleder job_title)
  const { data: teamLeaders = [] } = useQuery({
    queryKey: ["team-leaders-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, job_title")
        .eq("is_active", true)
        .in("job_title", ["Teamleder", "Assisterende Teamleder"])
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
        .select("id, first_name, last_name, job_title")
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
        .select("id, name")
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
      client_ids: [],
      employee_ids: [],
    });
  };

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
                      <div className="flex flex-wrap gap-1">
                        {teamClientIds.length > 0 ? (
                          teamClientIds.slice(0, 3).map((clientId) => {
                            const client = clients.find((c) => c.id === clientId);
                            return client ? (
                              <Badge key={clientId} variant="secondary" className="text-xs">
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTeam ? "Rediger team" : "Opret nyt team"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Navn *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Teamnavn"
                />
              </div>
              <div className="space-y-2">
                <Label>Beskrivelse</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Valgfri beskrivelse..."
                />
              </div>
              <div className="space-y-2">
                <Label>Teamleder</Label>
                <Select
                  value={formData.team_leader_id || "__none__"}
                  onValueChange={(value) => setFormData({ ...formData, team_leader_id: value === "__none__" ? "" : value })}
                >
                  <SelectTrigger>
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
                  Kun medarbejdere med stillingen "Teamleder" eller "Assisterende Teamleder" vises her.
                </p>
              </div>
            </div>

            {/* Clients */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <Label>Kunder</Label>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
                {clients.length === 0 ? (
                  <p className="text-sm text-muted-foreground col-span-2">Ingen kunder fundet</p>
                ) : (
                  clients.map((client) => (
                    <div key={client.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`client-${client.id}`}
                        checked={formData.client_ids.includes(client.id)}
                        onCheckedChange={() => toggleClient(client.id)}
                      />
                      <label htmlFor={`client-${client.id}`} className="text-sm cursor-pointer">
                        {client.name}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Employees */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-muted-foreground" />
                <Label>Medarbejdere</Label>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
                {employees.length === 0 ? (
                  <p className="text-sm text-muted-foreground col-span-2">Ingen medarbejdere fundet</p>
                ) : (
                  employees.map((emp) => (
                    <div key={emp.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`emp-${emp.id}`}
                        checked={formData.employee_ids.includes(emp.id)}
                        onCheckedChange={() => toggleEmployee(emp.id)}
                      />
                      <label htmlFor={`emp-${emp.id}`} className="text-sm cursor-pointer">
                        {emp.first_name} {emp.last_name}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuller
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? "Gemmer..." : "Gem"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
