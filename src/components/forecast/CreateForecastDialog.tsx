import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCreateForecastSettings } from "@/hooks/useForecastSettings";

interface Props {
  month: number;
  year: number;
  existingTeamIds: string[];
}

export function CreateForecastDialog({ month, year, existingTeamIds }: Props) {
  const [open, setOpen] = useState(false);
  const [teamId, setTeamId] = useState("");
  const [clientGoal, setClientGoal] = useState("0");
  const createMutation = useCreateForecastSettings();

  const { data: teams } = useQuery({
    queryKey: ["teams-for-forecast"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const availableTeams = teams?.filter(t => !existingTeamIds.includes(t.id)) || [];

  const handleCreate = () => {
    if (!teamId) return;
    createMutation.mutate(
      { team_id: teamId, month, year, client_goal: parseInt(clientGoal) || 0 },
      { onSuccess: () => { setOpen(false); setTeamId(""); setClientGoal("0"); } }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" /> Opret forecast</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Opret nyt forecast</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Team</Label>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger><SelectValue placeholder="Vælg team" /></SelectTrigger>
              <SelectContent>
                {availableTeams.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Kundens salgsmål</Label>
            <Input type="number" value={clientGoal} onChange={e => setClientGoal(e.target.value)} />
          </div>
          <Button onClick={handleCreate} disabled={!teamId || createMutation.isPending} className="w-full">
            {createMutation.isPending ? "Opretter..." : "Opret"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
