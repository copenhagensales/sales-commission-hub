import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Team {
  id: string;
  name: string;
  description: string | null;
  team_leader_id: string | null;
}

interface TeamLeaderTeamsProps {
  employeeId: string;
  employeeName: string;
}

export function TeamLeaderTeams({ employeeId, employeeName }: TeamLeaderTeamsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState("");

  // Fetch all teams
  const { data: allTeams = [], isLoading } = useQuery({
    queryKey: ["all-teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Team[];
    },
  });

  // Teams this employee leads
  const leaderTeams = allTeams.filter((t) => t.team_leader_id === employeeId);
  
  // Available teams (not assigned to this leader)
  const availableTeams = allTeams.filter((t) => t.team_leader_id !== employeeId);

  // Assign team to this leader
  const assignMutation = useMutation({
    mutationFn: async (teamId: string) => {
      const { error } = await supabase
        .from("teams")
        .update({ team_leader_id: employeeId })
        .eq("id", teamId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-teams"] });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      toast({ title: "Team tilføjet" });
      setIsAdding(false);
      setSelectedTeamId("");
    },
    onError: (error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  // Remove team from this leader
  const removeMutation = useMutation({
    mutationFn: async (teamId: string) => {
      const { error } = await supabase
        .from("teams")
        .update({ team_leader_id: null })
        .eq("id", teamId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-teams"] });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      toast({ title: "Team fjernet" });
    },
    onError: (error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const handleAddTeam = () => {
    if (!selectedTeamId) return;
    assignMutation.mutate(selectedTeamId);
  };

  if (isLoading) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Teams som leder
          </CardTitle>
          {!isAdding && availableTeams.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setIsAdding(true)}>
              <Plus className="h-4 w-4 mr-2" /> Tilføj team
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isAdding && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-muted/50 rounded-lg">
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Vælg team" />
              </SelectTrigger>
              <SelectContent>
                {availableTeams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                    {team.team_leader_id && (
                      <span className="text-muted-foreground ml-2">(har leder)</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleAddTeam} disabled={!selectedTeamId || assignMutation.isPending}>
              Tilføj
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setIsAdding(false); setSelectedTeamId(""); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {leaderTeams.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {employeeName} er ikke leder af nogen teams endnu.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {leaderTeams.map((team) => (
              <Badge
                key={team.id}
                variant="secondary"
                className="pl-3 pr-1 py-1.5 text-sm flex items-center gap-2"
              >
                {team.name}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 hover:bg-destructive/20 hover:text-destructive rounded-full"
                  onClick={() => removeMutation.mutate(team.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
