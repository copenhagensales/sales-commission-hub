import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCreateForecastSettings } from "@/hooks/useForecastSettings";

const MONTHS = [
  "Januar", "Februar", "Marts", "April", "Maj", "Juni",
  "Juli", "August", "September", "Oktober", "November", "December"
];

interface Props {
  month: number;
  year: number;
  existingTeamIds: string[];
}

export function CreateForecastDialog({ month: defaultMonth, year: defaultYear, existingTeamIds }: Props) {
  const now = new Date();
  const [open, setOpen] = useState(false);
  const [teamId, setTeamId] = useState("");
  const [clientGoal, setClientGoal] = useState("0");
  const [selectedMonth, setSelectedMonth] = useState(String(defaultMonth));
  const [selectedYear, setSelectedYear] = useState(String(defaultYear));
  const createMutation = useCreateForecastSettings();

  const { data: teams } = useQuery({
    queryKey: ["teams-for-forecast"],
    queryFn: async (): Promise<{ id: string; name: string }[]> => {
      const { data, error } = await (supabase as any).from("teams").select("id, name").order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const availableTeams = teams?.filter(t => !existingTeamIds.includes(t.id)) || [];

  const handleCreate = () => {
    if (!teamId) return;
    const month = Number(selectedMonth);
    const year = Number(selectedYear);
    createMutation.mutate(
      { team_id: teamId, month, year, client_goal: parseInt(clientGoal) || 0 },
      {
        onSuccess: () => {
          setOpen(false);
          setTeamId("");
          setClientGoal("0");
        },
      }
    );
  };

  // Reset to parent defaults when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setSelectedMonth(String(defaultMonth));
      setSelectedYear(String(defaultYear));
      setTeamId("");
      setClientGoal("0");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" /> Opret forecast</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Opret nyt forecast</DialogTitle>
          <DialogDescription>Vælg team, måned og salgsmål for det nye forecast.</DialogDescription>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Måned</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>År</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
