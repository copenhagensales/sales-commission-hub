import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Clock, X } from "lucide-react";

interface StandardShift {
  id: string;
  team_id: string;
  name: string;
  start_time: string;
  end_time: string;
}

interface ShiftBreak {
  id: string;
  shift_id: string;
  break_start: string;
  break_end: string;
}

interface BreakInput {
  break_start: string;
  break_end: string;
}

interface TeamStandardShiftsProps {
  teamId: string | null;
}

// Helper to calculate minutes from time string
const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

// Helper to format minutes to hours and minutes
const formatDuration = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${hours}t`;
  return `${hours}t ${minutes}m`;
};

// Calculate working time excluding breaks
const calculateWorkingTime = (
  startTime: string,
  endTime: string,
  breaks: BreakInput[]
): number => {
  const totalMinutes = timeToMinutes(endTime) - timeToMinutes(startTime);
  
  const breakMinutes = breaks.reduce((sum, b) => {
    if (b.break_start && b.break_end) {
      return sum + (timeToMinutes(b.break_end) - timeToMinutes(b.break_start));
    }
    return sum;
  }, 0);
  
  return Math.max(0, totalMinutes - breakMinutes);
};

export function TeamStandardShifts({ teamId }: TeamStandardShiftsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<StandardShift | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    start_time: "08:00",
    end_time: "16:00",
  });
  const [breaks, setBreaks] = useState<BreakInput[]>([]);

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

  // Fetch all breaks for all shifts
  const { data: allBreaks = [] } = useQuery({
    queryKey: ["team-shift-breaks", teamId],
    queryFn: async () => {
      if (!teamId) return [];
      const shiftIds = shifts.map((s) => s.id);
      if (shiftIds.length === 0) return [];
      const { data, error } = await supabase
        .from("team_shift_breaks")
        .select("*")
        .in("shift_id", shiftIds)
        .order("break_start");
      if (error) throw error;
      return data as ShiftBreak[];
    },
    enabled: !!teamId && shifts.length > 0,
  });

  // Get breaks for a specific shift
  const getShiftBreaks = (shiftId: string): ShiftBreak[] => {
    return allBreaks.filter((b) => b.shift_id === shiftId);
  };

  // Create shift mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; start_time: string; end_time: string; breaks: BreakInput[] }) => {
      // Create shift
      const { data: newShift, error: shiftError } = await supabase
        .from("team_standard_shifts")
        .insert({
          team_id: teamId,
          name: data.name,
          start_time: data.start_time,
          end_time: data.end_time,
        })
        .select()
        .single();
      if (shiftError) throw shiftError;

      // Create breaks
      const validBreaks = data.breaks.filter((b) => b.break_start && b.break_end);
      if (validBreaks.length > 0) {
        const { error: breaksError } = await supabase.from("team_shift_breaks").insert(
          validBreaks.map((b) => ({
            shift_id: newShift.id,
            break_start: b.break_start,
            break_end: b.break_end,
          }))
        );
        if (breaksError) throw breaksError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-standard-shifts", teamId] });
      queryClient.invalidateQueries({ queryKey: ["team-shift-breaks", teamId] });
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
    mutationFn: async (data: { id: string; name: string; start_time: string; end_time: string; breaks: BreakInput[] }) => {
      // Update shift
      const { error: shiftError } = await supabase
        .from("team_standard_shifts")
        .update({
          name: data.name,
          start_time: data.start_time,
          end_time: data.end_time,
        })
        .eq("id", data.id);
      if (shiftError) throw shiftError;

      // Delete existing breaks and re-add
      await supabase.from("team_shift_breaks").delete().eq("shift_id", data.id);
      
      const validBreaks = data.breaks.filter((b) => b.break_start && b.break_end);
      if (validBreaks.length > 0) {
        const { error: breaksError } = await supabase.from("team_shift_breaks").insert(
          validBreaks.map((b) => ({
            shift_id: data.id,
            break_start: b.break_start,
            break_end: b.break_end,
          }))
        );
        if (breaksError) throw breaksError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-standard-shifts", teamId] });
      queryClient.invalidateQueries({ queryKey: ["team-shift-breaks", teamId] });
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
      queryClient.invalidateQueries({ queryKey: ["team-shift-breaks", teamId] });
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
    });
    setBreaks([]);
  };

  const openCreate = () => {
    setEditingShift(null);
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (shift: StandardShift) => {
    setEditingShift(shift);
    const shiftBreaks = getShiftBreaks(shift.id);
    setFormData({
      name: shift.name,
      start_time: shift.start_time.slice(0, 5),
      end_time: shift.end_time.slice(0, 5),
    });
    setBreaks(
      shiftBreaks.map((b) => ({
        break_start: b.break_start.slice(0, 5),
        break_end: b.break_end.slice(0, 5),
      }))
    );
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.start_time || !formData.end_time) {
      toast({ title: "Udfyld navn og tidspunkter", variant: "destructive" });
      return;
    }
    if (editingShift) {
      updateMutation.mutate({ ...formData, id: editingShift.id, breaks });
    } else {
      createMutation.mutate({ ...formData, breaks });
    }
  };

  const addBreak = () => {
    setBreaks([...breaks, { break_start: "12:00", break_end: "12:30" }]);
  };

  const removeBreak = (index: number) => {
    setBreaks(breaks.filter((_, i) => i !== index));
  };

  const updateBreak = (index: number, field: "break_start" | "break_end", value: string) => {
    setBreaks(breaks.map((b, i) => (i === index ? { ...b, [field]: value } : b)));
  };

  const formatTime = (time: string | null) => {
    if (!time) return "-";
    return time.slice(0, 5);
  };

  // Calculate working time for display
  const workingMinutes = calculateWorkingTime(formData.start_time, formData.end_time, breaks);

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
                <TableHead className="text-xs">Pauser</TableHead>
                <TableHead className="text-xs">Arbejdstid</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shifts.map((shift) => {
                const shiftBreaks = getShiftBreaks(shift.id);
                const breakInputs = shiftBreaks.map((b) => ({
                  break_start: b.break_start,
                  break_end: b.break_end,
                }));
                const workTime = calculateWorkingTime(shift.start_time, shift.end_time, breakInputs);
                
                return (
                  <TableRow key={shift.id}>
                    <TableCell className="font-medium">{shift.name}</TableCell>
                    <TableCell>{formatTime(shift.start_time)}</TableCell>
                    <TableCell>{formatTime(shift.end_time)}</TableCell>
                    <TableCell>
                      {shiftBreaks.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {shiftBreaks.map((b, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {formatTime(b.break_start)}-{formatTime(b.break_end)}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{formatDuration(workTime)}</Badge>
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
                );
              })}
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

            {/* Breaks */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Pauser</Label>
                <Button type="button" variant="outline" size="sm" onClick={addBreak}>
                  <Plus className="h-3 w-3 mr-1" />
                  Tilføj pause
                </Button>
              </div>
              {breaks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ingen pauser tilføjet.</p>
              ) : (
                <div className="space-y-2">
                  {breaks.map((b, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={b.break_start}
                        onChange={(e) => updateBreak(index, "break_start", e.target.value)}
                        className="flex-1"
                      />
                      <span className="text-muted-foreground">-</span>
                      <Input
                        type="time"
                        value={b.break_end}
                        onChange={(e) => updateBreak(index, "break_end", e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => removeBreak(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Working time summary */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
              <span className="text-sm font-medium">Samlet arbejdstid (ekskl. pause)</span>
              <Badge variant="default">{formatDuration(workingMinutes)}</Badge>
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
