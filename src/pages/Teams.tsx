import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Users } from "lucide-react";

interface Team {
  id: string;
  name: string;
  description: string | null;
  team_leader_id: string | null;
  created_at: string;
  updated_at: string;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
}

export default function Teams() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "", team_leader_id: "" });

  const { data: teams, isLoading } = useQuery({
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

  const { data: employees } = useQuery({
    queryKey: ["employees-for-teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name")
        .eq("is_active", true)
        .order("first_name");
      if (error) throw error;
      return data as Employee[];
    },
  });

  const { data: teamLeaders } = useQuery({
    queryKey: ["team-leaders-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name");
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach((e) => {
        map[e.id] = `${e.first_name} ${e.last_name}`;
      });
      return map;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; team_leader_id: string | null }) => {
      const { error } = await supabase.from("teams").insert({
        name: data.name,
        description: data.description || null,
        team_leader_id: data.team_leader_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      setIsAddOpen(false);
      setFormData({ name: "", description: "", team_leader_id: "" });
      toast({ title: "Team oprettet" });
    },
    onError: () => {
      toast({ title: "Fejl", description: "Kunne ikke oprette team", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; description: string; team_leader_id: string | null }) => {
      const { error } = await supabase.from("teams").update({
        name: data.name,
        description: data.description || null,
        team_leader_id: data.team_leader_id || null,
      }).eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      setIsEditOpen(false);
      setEditingTeam(null);
      toast({ title: "Team opdateret" });
    },
    onError: () => {
      toast({ title: "Fejl", description: "Kunne ikke opdatere team", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("teams").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      toast({ title: "Team slettet" });
    },
    onError: () => {
      toast({ title: "Fejl", description: "Kunne ikke slette team", variant: "destructive" });
    },
  });

  const handleCreate = () => {
    createMutation.mutate({
      name: formData.name,
      description: formData.description,
      team_leader_id: formData.team_leader_id || null,
    });
  };

  const handleUpdate = () => {
    if (!editingTeam) return;
    updateMutation.mutate({
      id: editingTeam.id,
      name: formData.name,
      description: formData.description,
      team_leader_id: formData.team_leader_id || null,
    });
  };

  const openEdit = (team: Team) => {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      description: team.description || "",
      team_leader_id: team.team_leader_id || "",
    });
    setIsEditOpen(true);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Teams</h1>
          <p className="text-muted-foreground">Administrer teams og teamledere</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setFormData({ name: "", description: "", team_leader_id: "" })}>
              <Plus className="h-4 w-4 mr-2" />
              Tilføj team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tilføj nyt team</DialogTitle>
              <DialogDescription>Opret et nyt team og tildel en teamleder.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Navn</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Teamnavn"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Beskrivelse</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Valgfri beskrivelse..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team_leader">Teamleder</Label>
                <Select
                  value={formData.team_leader_id}
                  onValueChange={(value) => setFormData({ ...formData, team_leader_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg teamleder" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Ingen</SelectItem>
                    {employees?.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Annuller</Button>
              <Button onClick={handleCreate} disabled={!formData.name || createMutation.isPending}>
                {createMutation.isPending ? "Opretter..." : "Opret"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Teams
          </CardTitle>
          <CardDescription>Liste over alle teams i organisationen</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Indlæser...</p>
          ) : teams && teams.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Navn</TableHead>
                  <TableHead>Beskrivelse</TableHead>
                  <TableHead>Teamleder</TableHead>
                  <TableHead className="text-right">Handlinger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((team) => (
                  <TableRow key={team.id}>
                    <TableCell className="font-medium">{team.name}</TableCell>
                    <TableCell className="text-muted-foreground">{team.description || "-"}</TableCell>
                    <TableCell>
                      {team.team_leader_id && teamLeaders?.[team.team_leader_id]
                        ? teamLeaders[team.team_leader_id]
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(team)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(team.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground">Ingen teams oprettet endnu.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rediger team</DialogTitle>
            <DialogDescription>Opdater teamets oplysninger.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Navn</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Teamnavn"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Beskrivelse</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Valgfri beskrivelse..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-team_leader">Teamleder</Label>
              <Select
                value={formData.team_leader_id}
                onValueChange={(value) => setFormData({ ...formData, team_leader_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vælg teamleder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Ingen</SelectItem>
                  {employees?.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Annuller</Button>
            <Button onClick={handleUpdate} disabled={!formData.name || updateMutation.isPending}>
              {updateMutation.isPending ? "Gemmer..." : "Gem"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
