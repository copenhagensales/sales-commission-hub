import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Users, Pencil, Trash2, ChevronDown, ChevronRight, UserPlus, X, User, Building2, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

interface Team {
  id: string;
  name: string;
  description: string | null;
  team_leader_id: string | null;
  created_at: string;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  team_id: string | null;
  is_active: boolean;
}

interface Client {
  id: string;
  name: string;
}

interface TeamClient {
  id: string;
  team_id: string;
  client_id: string;
}

export default function Teams() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "", team_leader_id: "" });
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [addingMemberToTeam, setAddingMemberToTeam] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [dragOverTeamId, setDragOverTeamId] = useState<string | null>(null);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, employeeId: string) => {
    e.dataTransfer.setData("employeeId", employeeId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, teamId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverTeamId(teamId);
  };

  const handleDragLeave = () => {
    setDragOverTeamId(null);
  };

  const handleDrop = (e: React.DragEvent, teamId: string) => {
    e.preventDefault();
    const employeeId = e.dataTransfer.getData("employeeId");
    setDragOverTeamId(null);
    if (employeeId) {
      addMemberMutation.mutate({ employeeId, teamId });
    }
  };
  // Fetch teams
  const { data: teams = [], isLoading: loadingTeams } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Team[];
    },
  });

  // Fetch clients
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as Client[];
    },
  });

  // Fetch team-client associations
  const { data: teamClients = [] } = useQuery({
    queryKey: ["team-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_clients")
        .select("*");
      if (error) throw error;
      return data as TeamClient[];
    },
  });

  // Fetch all active employees
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-for-teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, job_title, team_id, is_active")
        .eq("is_active", true)
        .order("first_name");
      if (error) throw error;
      return data as Employee[];
    },
  });

  // Create/update team
  const saveMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; team_leader_id: string; id?: string; clientIds: string[] }) => {
      const payload = {
        name: data.name,
        description: data.description || null,
        team_leader_id: data.team_leader_id || null,
      };

      let teamId: string;

      if (data.id) {
        const { error } = await supabase.from("teams").update(payload).eq("id", data.id);
        if (error) throw error;
        teamId = data.id;
      } else {
        const { data: newTeam, error } = await supabase.from("teams").insert(payload).select().single();
        if (error) throw error;
        teamId = newTeam.id;
      }

      // Update client associations
      // First, delete existing associations for this team
      await supabase.from("team_clients").delete().eq("team_id", teamId);
      
      // Then insert new ones
      if (data.clientIds.length > 0) {
        const { error: clientError } = await supabase.from("team_clients").insert(
          data.clientIds.map(clientId => ({ team_id: teamId, client_id: clientId }))
        );
        if (clientError) throw clientError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["team-clients"] });
      toast({ title: editingTeam ? "Team opdateret" : "Team oprettet" });
      setDialogOpen(false);
      setEditingTeam(null);
      setFormData({ name: "", description: "", team_leader_id: "" });
      setSelectedClientIds([]);
    },
    onError: (error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  // Delete team
  const deleteMutation = useMutation({
    mutationFn: async (teamId: string) => {
      await supabase.from("employee_master_data").update({ team_id: null }).eq("team_id", teamId);
      const { error } = await supabase.from("teams").delete().eq("id", teamId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["employees-for-teams"] });
      queryClient.invalidateQueries({ queryKey: ["team-clients"] });
      toast({ title: "Team slettet" });
    },
    onError: (error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  // Add employee to team
  const addMemberMutation = useMutation({
    mutationFn: async ({ employeeId, teamId }: { employeeId: string; teamId: string }) => {
      const { error } = await supabase
        .from("employee_master_data")
        .update({ team_id: teamId })
        .eq("id", employeeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees-for-teams"] });
      toast({ title: "Medarbejder tilføjet til team" });
      setAddingMemberToTeam(null);
      setSelectedEmployeeId("");
    },
    onError: (error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  // Remove employee from team
  const removeMemberMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      const { error } = await supabase
        .from("employee_master_data")
        .update({ team_id: null })
        .eq("id", employeeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees-for-teams"] });
      toast({ title: "Medarbejder fjernet fra team" });
    },
    onError: (error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const handleEdit = (team: Team) => {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      description: team.description || "",
      team_leader_id: team.team_leader_id || "",
    });
    // Load existing client associations
    const existingClientIds = teamClients
      .filter(tc => tc.team_id === team.id)
      .map(tc => tc.client_id);
    setSelectedClientIds(existingClientIds);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name) {
      toast({ title: "Angiv et teamnavn", variant: "destructive" });
      return;
    }
    saveMutation.mutate(
      editingTeam 
        ? { ...formData, id: editingTeam.id, clientIds: selectedClientIds } 
        : { ...formData, clientIds: selectedClientIds }
    );
  };

  const toggleTeam = (teamId: string) => {
    const newExpanded = new Set(expandedTeams);
    if (newExpanded.has(teamId)) {
      newExpanded.delete(teamId);
    } else {
      newExpanded.add(teamId);
    }
    setExpandedTeams(newExpanded);
  };

  const toggleClientSelection = (clientId: string) => {
    setSelectedClientIds(prev => 
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const getTeamLeader = (leaderId: string | null) => {
    if (!leaderId) return null;
    return employees.find((e) => e.id === leaderId);
  };

  const getTeamMembers = (teamId: string) => {
    return employees.filter((e) => e.team_id === teamId);
  };

  const getTeamClients = (teamId: string) => {
    const clientIds = teamClients.filter(tc => tc.team_id === teamId).map(tc => tc.client_id);
    return clients.filter(c => clientIds.includes(c.id));
  };

  const getUnassignedEmployees = () => {
    return employees.filter((e) => !e.team_id);
  };

  const getUnassignedClients = () => {
    const assignedClientIds = new Set(teamClients.map(tc => tc.client_id));
    return clients.filter(c => !assignedClientIds.has(c.id));
  };

  const teamLeaderCandidates = employees.filter(
    (e) => e.job_title === "Teamleder" || e.job_title === "Ejer" || e.job_title === "Assisterende Teamleder"
  );

  if (loadingTeams) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-pulse text-muted-foreground">Indlæser teams...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Teams</h1>
            <p className="text-muted-foreground">Organisér medarbejdere i teams med kunde-tilknytning</p>
          </div>
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setEditingTeam(null);
                setFormData({ name: "", description: "", team_leader_id: "" });
                setSelectedClientIds([]);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Opret team
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingTeam ? "Rediger team" : "Opret nyt team"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Teamnavn *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="F.eks. Team TDC Erhverv"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Beskrivelse</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Valgfri beskrivelse"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Teamleder</Label>
                  <Select
                    value={formData.team_leader_id || "none"}
                    onValueChange={(value) => setFormData({ ...formData, team_leader_id: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vælg teamleder" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ingen</SelectItem>
                      {teamLeaderCandidates.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Kunder tilknyttet dette team
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Vælg hvilke kunder dette team arbejder med. Små kunder kan samles under ét team.
                  </p>
                  <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                    {clients.map((client) => (
                      <div key={client.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`client-${client.id}`}
                          checked={selectedClientIds.includes(client.id)}
                          onCheckedChange={() => toggleClientSelection(client.id)}
                        />
                        <label
                          htmlFor={`client-${client.id}`}
                          className="text-sm cursor-pointer flex-1"
                        >
                          {client.name}
                        </label>
                      </div>
                    ))}
                  </div>
                  {selectedClientIds.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {selectedClientIds.length} kunde{selectedClientIds.length !== 1 ? 'r' : ''} valgt
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Annuller
                </Button>
                <Button onClick={handleSave} disabled={saveMutation.isPending}>
                  {editingTeam ? "Gem ændringer" : "Opret team"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{teams.length}</p>
                  <p className="text-sm text-muted-foreground">Teams</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Building2 className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{clients.length - getUnassignedClients().length}</p>
                  <p className="text-sm text-muted-foreground">Tildelte kunder</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <User className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{employees.filter(e => e.team_id).length}</p>
                  <p className="text-sm text-muted-foreground">Tildelte medarbejdere</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <User className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="text-2xl font-bold">{getUnassignedEmployees().length}</p>
                  <p className="text-sm text-muted-foreground">Uden team</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Unassigned clients alert */}
        {getUnassignedClients().length > 0 && (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-700 dark:text-amber-400">
                    {getUnassignedClients().length} kunde{getUnassignedClients().length !== 1 ? 'r' : ''} uden team
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {getUnassignedClients().map(c => c.name).join(", ")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Teams List */}
        <div className="space-y-4">
          {teams.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Ingen teams oprettet endnu</p>
                <p className="text-sm">Klik på "Opret team" for at komme i gang</p>
              </CardContent>
            </Card>
          ) : (
            teams.map((team) => {
              const isExpanded = expandedTeams.has(team.id);
              const members = getTeamMembers(team.id);
              const leader = getTeamLeader(team.team_leader_id);
              const teamClientsList = getTeamClients(team.id);

              return (
                <Card 
                  key={team.id}
                  className={`transition-all duration-200 ${dragOverTeamId === team.id ? 'ring-2 ring-primary ring-offset-2 bg-primary/5' : ''}`}
                  onDragOver={(e) => handleDragOver(e, team.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, team.id)}
                >
                  <Collapsible open={isExpanded} onOpenChange={() => toggleTeam(team.id)}>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            )}
                            <div>
                              <CardTitle className="text-lg">{team.name}</CardTitle>
                              {team.description && (
                                <p className="text-sm text-muted-foreground">{team.description}</p>
                              )}
                              {teamClientsList.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {teamClientsList.map(client => (
                                    <Badge key={client.id} variant="outline" className="text-xs">
                                      <Building2 className="h-3 w-3 mr-1" />
                                      {client.name}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                            <Badge variant="secondary">{members.length} medlemmer</Badge>
                            {leader && (
                              <Badge variant="outline">
                                Leder: {leader.first_name} {leader.last_name}
                              </Badge>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(team)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Slet team?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Dette vil slette teamet "{team.name}" og fjerne alle medarbejdere fra teamet.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuller</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMutation.mutate(team.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Slet
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <div className="border-t pt-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium">Medlemmer</h4>
                            {addingMemberToTeam === team.id ? (
                              <div className="flex items-center gap-2">
                                <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                                  <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="Vælg medarbejder" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {getUnassignedEmployees().map((emp) => (
                                      <SelectItem key={emp.id} value={emp.id}>
                                        {emp.first_name} {emp.last_name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    if (selectedEmployeeId) {
                                      addMemberMutation.mutate({ employeeId: selectedEmployeeId, teamId: team.id });
                                    }
                                  }}
                                  disabled={!selectedEmployeeId || addMemberMutation.isPending}
                                >
                                  Tilføj
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setAddingMemberToTeam(null);
                                    setSelectedEmployeeId("");
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => setAddingMemberToTeam(team.id)}>
                                <UserPlus className="h-4 w-4 mr-2" /> Tilføj medarbejder
                              </Button>
                            )}
                          </div>
                          {members.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4">
                              Ingen medarbejdere i dette team endnu.
                            </p>
                          ) : (
                            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                              {members.map((member) => (
                                <div
                                  key={member.id}
                                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                                >
                                  <Link
                                    to={`/employees/${member.id}`}
                                    className="flex items-center gap-2 hover:underline"
                                  >
                                    <User className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">
                                      {member.first_name} {member.last_name}
                                    </span>
                                    {member.job_title && (
                                      <span className="text-xs text-muted-foreground">
                                        ({member.job_title})
                                      </span>
                                    )}
                                  </Link>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={() => removeMemberMutation.mutate(member.id)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })
          )}

          {/* Unassigned employees section */}
          {getUnassignedEmployees().length > 0 && (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-muted-foreground">
                  <Users className="h-5 w-5" />
                  Medarbejdere uden team ({getUnassignedEmployees().length})
                </CardTitle>
                <p className="text-sm text-muted-foreground">Træk en medarbejder til et team ovenfor</p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {getUnassignedEmployees().map((emp) => (
                    <div
                      key={emp.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, emp.id)}
                      className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors cursor-grab active:cursor-grabbing group"
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground" />
                      <Link
                        to={`/employees/${emp.id}`}
                        className="flex items-center gap-2 flex-1 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {emp.first_name} {emp.last_name}
                        </span>
                        {emp.job_title && (
                          <span className="text-xs text-muted-foreground">({emp.job_title})</span>
                        )}
                      </Link>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
