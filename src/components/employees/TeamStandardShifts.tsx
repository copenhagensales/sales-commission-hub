import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Clock } from "lucide-react";

interface StandardShift {
  id: string;
  team_id: string;
  name: string;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
}

interface TeamStandardShiftsProps {
  teamId: string | null;
}

export function TeamStandardShifts({ teamId }: TeamStandardShiftsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<StandardShift | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    start_time: "08:00",
    end_time: "16:00",
    break_start: "",
    break_end: "",
  });

  // Fetch standard shifts for this team
  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ["team-standard-shifts", teamId],
    queryFn: async () => {
      if (!teamId) return [];
      const { data, error } = await supabase
        .from("team_standard_shifts")
        .select("*")
        .eq("team_id", teamId)
        .order("start_time");
      if (error) throw error;
      return data as StandardShift[];
    },
    enabled: !!teamId,
  });

  // Create shift mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("team_standard_shifts").insert({
        team_id: teamId,
        name: data.name,
        start_time: data.start_time,
        end_time: data.end_time,
        break_start: data.break_start || null,
        break_end: data.break_end || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-standard-shifts", teamId] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "Standard vagt oprettet" });
    },
    onError: (error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  // Update shift mutation
  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData & { id: string }) => {
      const { error } = await supabase
        .from("team_standard_shifts")
        .update({
          name: data.name,
          start_time: data.start_time,
          end_time: data.end_time,
          break_start: data.break_start || null,
          break_end: data.break_end || null,
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-standard-shifts", teamId] });
      setDialogOpen(false);
      setEditingShift(null);
      resetForm();
      toast({ title: "Standard vagt opdateret" });
    },
    onError: (error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  // Delete shift mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_standard_shifts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-standard-shifts", teamId] });
      toast({ title: "Standard vagt slettet" });
    },
    onError: (error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      start_time: "08:00",
      end_time: "16:00",
      break_start: "",
      break_end: "",
    });
  };

  const openCreate = () => {
    setEditingShift(null);
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (shift: StandardShift) => {
    setEditingShift(shift);
    setFormData({
      name: shift.name,
      start_time: shift.start_time.slice(0, 5),
      end_time: shift.end_time.slice(0, 5),
      break_start: shift.break_start?.slice(0, 5) || "",
      break_end: shift.break_end?.slice(0, 5) || "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.start_time || !formData.end_time) {
      toast({ title: "Udfyld navn og tidspunkter", variant: "destructive" });
      return;
    }
    if (editingShift) {
      updateMutation.mutate({ ...formData, id: editingShift.id });
    } else {
      createMutation.mutate(formData);
    }
  };

  const formatTime = (time: string | null) => {
    if (!time) return "-";
    return time.slice(0, 5);
  };

  if (!teamId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Clock className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Standard vagter</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Gem teamet først for at kunne tilføje standard vagter.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <Label className="text-base font-medium">Standard vagter</Label>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Tilføj vagt
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Indlæser...</p>
      ) : shifts.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Ingen standard vagter oprettet endnu.
        </p>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Navn</TableHead>
                <TableHead className="text-xs">Start</TableHead>
                <TableHead className="text-xs">Slut</TableHead>
                <TableHead className="text-xs">Pause</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shifts.map((shift) => (
                <TableRow key={shift.id}>
                  <TableCell className="font-medium">{shift.name}</TableCell>
                  <TableCell>{formatTime(shift.start_time)}</TableCell>
                  <TableCell>{formatTime(shift.end_time)}</TableCell>
                  <TableCell>
                    {shift.break_start && shift.break_end
                      ? `${formatTime(shift.break_start)} - ${formatTime(shift.break_end)}`
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(shift)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(shift.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingShift ? "Rediger vagt" : "Tilføj standard vagt"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Navn *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="F.eks. Dagvagt, Aftenvagt..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start tid *</Label>
                <Input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Slut tid *</Label>
                <Input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Pause start</Label>
                <Input
                  type="time"
                  value={formData.break_start}
                  onChange={(e) => setFormData({ ...formData, break_start: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Pause slut</Label>
                <Input
                  type="time"
                  value={formData.break_end}
                  onChange={(e) => setFormData({ ...formData, break_end: e.target.value })}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Pausetidspunkter er valgfrie.
            </p>
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
