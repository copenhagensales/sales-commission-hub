import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
}

export function TeamManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "", team_leader_id: "" });

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

  // Fetch employees for team leader selection and member display
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-for-teams"],
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

  // Create/update team
  const saveMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; team_leader_id: string; id?: string }) => {
      const payload = {
        name: data.name,
        description: data.description || null,
        team_leader_id: data.team_leader_id || null,
      };

      if (data.id) {
        const { error } = await supabase.from("teams").update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("teams").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      toast({ title: editingTeam ? "Team opdateret" : "Team oprettet" });
      setDialogOpen(false);
      setEditingTeam(null);
      setFormData({ name: "", description: "", team_leader_id: "" });
    },
    onError: (error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  // Delete team
  const deleteMutation = useMutation({
    mutationFn: async (teamId: string) => {
      // First, unassign all employees from this team
      await supabase.from("employee_master_data").update({ team_id: null }).eq("team_id", teamId);
      
      const { error } = await supabase.from("teams").delete().eq("id", teamId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["employees-for-teams"] });
      queryClient.invalidateQueries({ queryKey: ["employee-master-data"] });
      toast({ title: "Team slettet" });
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
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name) {
      toast({ title: "Angiv et teamnavn", variant: "destructive" });
      return;
    }
    saveMutation.mutate(editingTeam ? { ...formData, id: editingTeam.id } : formData);
  };

  const getTeamLeaderName = (leaderId: string | null) => {
    if (!leaderId) return "Ingen";
    const leader = employees.find((e) => e.id === leaderId);
    return leader ? `${leader.first_name} ${leader.last_name}` : "Ukendt";
  };

  const getTeamMemberCount = (teamId: string) => {
    return employees.filter((e) => e.team_id === teamId).length;
  };

  if (loadingTeams) {
    return <div className="text-muted-foreground">Indlæser teams...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Teams</h2>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingTeam(null);
              setFormData({ name: "", description: "", team_leader_id: "" });
            }
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" /> Opret team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTeam ? "Rediger team" : "Opret nyt team"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Teamnavn *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="F.eks. Team Yousee"
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
                  value={formData.team_leader_id}
                  onValueChange={(value) => setFormData({ ...formData, team_leader_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg teamleder" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Ingen</SelectItem>
                    {employees
                      .filter((e) => e.job_title === "Teamleder" || e.job_title === "Ejer")
                      .map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
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

      {teams.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Ingen teams oprettet endnu</p>
            <p className="text-sm">Klik på "Opret team" for at komme i gang</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Card key={team.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{team.name}</CardTitle>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(team)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
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
              <CardContent>
                {team.description && (
                  <p className="text-sm text-muted-foreground mb-2">{team.description}</p>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary">{getTeamMemberCount(team.id)} medlemmer</Badge>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">Leder: {getTeamLeaderName(team.team_leader_id)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
