import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { TimeSelect } from "@/components/ui/time-select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Clock, X, Star, Calendar } from "lucide-react";

interface StandardShift {
  id: string;
  team_id: string;
  name: string;
  start_time: string;
  end_time: string;
  is_primary: boolean;
}

interface ShiftDay {
  id: string;
  shift_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface ShiftBreak {
  id: string;
  shift_id: string;
  break_start: string;
  break_end: string;
  day_of_week: number | null;
}

interface BreakInput {
  break_start: string;
  break_end: string;
  day_of_week?: number | null;
}

interface DayConfig {
  enabled: boolean;
  start_time: string;
  end_time: string;
  breaks: BreakInput[];
}

interface TeamStandardShiftsProps {
  teamId: string | null;
}

const DAY_NAMES = ["Søn", "Man", "Tirs", "Ons", "Tors", "Fre", "Lør"];
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first

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
  const [useDifferentTimes, setUseDifferentTimes] = useState(false);
  
  // Day configurations - indexed by day_of_week (0-6)
  const [dayConfigs, setDayConfigs] = useState<Record<number, DayConfig>>(() => {
    const initial: Record<number, DayConfig> = {};
    for (let i = 0; i < 7; i++) {
      initial[i] = { enabled: false, start_time: "08:00", end_time: "16:00", breaks: [] };
    }
    return initial;
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

  // Fetch all shift days for all shifts
  const { data: allShiftDays = [] } = useQuery({
    queryKey: ["team-shift-days", teamId],
    queryFn: async () => {
      if (!teamId) return [];
      const shiftIds = shifts.map((s) => s.id);
      if (shiftIds.length === 0) return [];
      const { data, error } = await supabase
        .from("team_standard_shift_days")
        .select("*")
        .in("shift_id", shiftIds)
        .order("day_of_week");
      if (error) throw error;
      return data as ShiftDay[];
    },
    enabled: !!teamId && shifts.length > 0,
  });

  // Get breaks for a specific shift
  const getShiftBreaks = (shiftId: string): ShiftBreak[] => {
    return allBreaks.filter((b) => b.shift_id === shiftId);
  };

  // Get days for a specific shift
  const getShiftDays = (shiftId: string): ShiftDay[] => {
    return allShiftDays.filter((d) => d.shift_id === shiftId);
  };

  // Create shift mutation
  const createMutation = useMutation({
    mutationFn: async (data: { 
      name: string; 
      start_time: string; 
      end_time: string; 
      breaks: BreakInput[];
      dayConfigs: Record<number, DayConfig>;
    }) => {
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

      // Create general breaks (for "Samme tider" mode)
      const validBreaks = data.breaks.filter((b) => b.break_start && b.break_end);
      if (validBreaks.length > 0) {
        const { error: breaksError } = await supabase.from("team_shift_breaks").insert(
          validBreaks.map((b) => ({
            shift_id: newShift.id,
            break_start: b.break_start,
            break_end: b.break_end,
            day_of_week: null,
          }))
        );
        if (breaksError) throw breaksError;
      }

      // Create day-specific breaks (for "Forskellige tider" mode)
      const dayBreaks: { shift_id: string; break_start: string; break_end: string; day_of_week: number }[] = [];
      Object.entries(data.dayConfigs).forEach(([day, config]) => {
        if (config.enabled && config.breaks) {
          config.breaks.forEach(b => {
            if (b.break_start && b.break_end) {
              dayBreaks.push({
                shift_id: newShift.id,
                break_start: b.break_start,
                break_end: b.break_end,
                day_of_week: parseInt(day),
              });
            }
          });
        }
      });
      if (dayBreaks.length > 0) {
        const { error: dayBreaksError } = await supabase.from("team_shift_breaks").insert(dayBreaks);
        if (dayBreaksError) throw dayBreaksError;
      }

      // Create day configurations
      const enabledDays = Object.entries(data.dayConfigs)
        .filter(([_, config]) => config.enabled)
        .map(([day, config]) => ({
          shift_id: newShift.id,
          day_of_week: parseInt(day),
          start_time: config.start_time,
          end_time: config.end_time,
        }));

      if (enabledDays.length > 0) {
        const { error: daysError } = await supabase
          .from("team_standard_shift_days")
          .insert(enabledDays);
        if (daysError) throw daysError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-standard-shifts", teamId] });
      queryClient.invalidateQueries({ queryKey: ["team-shift-breaks", teamId] });
      queryClient.invalidateQueries({ queryKey: ["team-shift-days", teamId] });
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
    mutationFn: async (data: { 
      id: string; 
      name: string; 
      start_time: string; 
      end_time: string; 
      breaks: BreakInput[];
      dayConfigs: Record<number, DayConfig>;
    }) => {
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
      
      // Add general breaks
      const validBreaks = data.breaks.filter((b) => b.break_start && b.break_end);
      if (validBreaks.length > 0) {
        const { error: breaksError } = await supabase.from("team_shift_breaks").insert(
          validBreaks.map((b) => ({
            shift_id: data.id,
            break_start: b.break_start,
            break_end: b.break_end,
            day_of_week: null,
          }))
        );
        if (breaksError) throw breaksError;
      }

      // Add day-specific breaks
      const dayBreaks: { shift_id: string; break_start: string; break_end: string; day_of_week: number }[] = [];
      Object.entries(data.dayConfigs).forEach(([day, config]) => {
        if (config.enabled && config.breaks) {
          config.breaks.forEach(b => {
            if (b.break_start && b.break_end) {
              dayBreaks.push({
                shift_id: data.id,
                break_start: b.break_start,
                break_end: b.break_end,
                day_of_week: parseInt(day),
              });
            }
          });
        }
      });
      if (dayBreaks.length > 0) {
        const { error: dayBreaksError } = await supabase.from("team_shift_breaks").insert(dayBreaks);
        if (dayBreaksError) throw dayBreaksError;
      }

      // Delete existing days and re-add
      await supabase.from("team_standard_shift_days").delete().eq("shift_id", data.id);

      const enabledDays = Object.entries(data.dayConfigs)
        .filter(([_, config]) => config.enabled)
        .map(([day, config]) => ({
          shift_id: data.id,
          day_of_week: parseInt(day),
          start_time: config.start_time,
          end_time: config.end_time,
        }));

      if (enabledDays.length > 0) {
        const { error: daysError } = await supabase
          .from("team_standard_shift_days")
          .insert(enabledDays);
        if (daysError) throw daysError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-standard-shifts", teamId] });
      queryClient.invalidateQueries({ queryKey: ["team-shift-breaks", teamId] });
      queryClient.invalidateQueries({ queryKey: ["team-shift-days", teamId] });
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
      queryClient.invalidateQueries({ queryKey: ["team-shift-days", teamId] });
      toast({ title: "Standard vagt slettet" });
    },
    onError: (error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  // Toggle primary mutation
  const togglePrimaryMutation = useMutation({
    mutationFn: async ({ shiftId, isPrimary }: { shiftId: string; isPrimary: boolean }) => {
      // If setting as primary, first unset all others for this team
      if (isPrimary) {
        await supabase
          .from("team_standard_shifts")
          .update({ is_primary: false })
          .eq("team_id", teamId);
      }
      // Then set/unset this one
      const { error } = await supabase
        .from("team_standard_shifts")
        .update({ is_primary: isPrimary })
        .eq("id", shiftId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-standard-shifts", teamId] });
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
    setUseDifferentTimes(false);
    // Reset day configs
    const initial: Record<number, DayConfig> = {};
    for (let i = 0; i < 7; i++) {
      initial[i] = { enabled: false, start_time: "08:00", end_time: "16:00", breaks: [] };
    }
    setDayConfigs(initial);
  };

  const openCreate = () => {
    setEditingShift(null);
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (shift: StandardShift) => {
    setEditingShift(shift);
    const shiftBreaks = getShiftBreaks(shift.id);
    const shiftDays = getShiftDays(shift.id);
    
    setFormData({
      name: shift.name,
      start_time: shift.start_time.slice(0, 5),
      end_time: shift.end_time.slice(0, 5),
    });
    // Get general breaks (day_of_week is null)
    const generalBreaks = shiftBreaks.filter(b => b.day_of_week === null);
    setBreaks(
      generalBreaks.map((b) => ({
        break_start: b.break_start.slice(0, 5),
        break_end: b.break_end.slice(0, 5),
      }))
    );

    // Set day configs from existing data
    const newDayConfigs: Record<number, DayConfig> = {};
    let hasDifferentTimes = false;
    for (let i = 0; i < 7; i++) {
      const existingDay = shiftDays.find(d => d.day_of_week === i);
      const dayBreaks = shiftBreaks
        .filter(b => b.day_of_week === i)
        .map(b => ({
          break_start: b.break_start.slice(0, 5),
          break_end: b.break_end.slice(0, 5),
        }));
      
      if (existingDay) {
        newDayConfigs[i] = {
          enabled: true,
          start_time: existingDay.start_time.slice(0, 5),
          end_time: existingDay.end_time.slice(0, 5),
          breaks: dayBreaks,
        };
        // Check if this day has different times or breaks than the standard
        if (existingDay.start_time.slice(0, 5) !== shift.start_time.slice(0, 5) ||
            existingDay.end_time.slice(0, 5) !== shift.end_time.slice(0, 5) ||
            dayBreaks.length > 0) {
          hasDifferentTimes = true;
        }
      } else {
        newDayConfigs[i] = {
          enabled: false,
          start_time: shift.start_time.slice(0, 5),
          end_time: shift.end_time.slice(0, 5),
          breaks: [],
        };
      }
    }
    setDayConfigs(newDayConfigs);
    setUseDifferentTimes(hasDifferentTimes);
    
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.start_time || !formData.end_time) {
      toast({ title: "Udfyld navn og tidspunkter", variant: "destructive" });
      return;
    }
    if (editingShift) {
      updateMutation.mutate({ ...formData, id: editingShift.id, breaks, dayConfigs });
    } else {
      createMutation.mutate({ ...formData, breaks, dayConfigs });
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

  const toggleDay = (day: number) => {
    setDayConfigs(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        enabled: !prev[day].enabled,
        // When enabling, use the default times from formData
        start_time: !prev[day].enabled ? formData.start_time : prev[day].start_time,
        end_time: !prev[day].enabled ? formData.end_time : prev[day].end_time,
        breaks: !prev[day].enabled ? [] : prev[day].breaks,
      }
    }));
  };

  const updateDayTime = (day: number, field: "start_time" | "end_time", value: string) => {
    setDayConfigs(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      }
    }));
  };

  const addDayBreak = (day: number) => {
    setDayConfigs(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        breaks: [...prev[day].breaks, { break_start: "12:00", break_end: "12:30" }],
      }
    }));
  };

  const removeDayBreak = (day: number, index: number) => {
    setDayConfigs(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        breaks: prev[day].breaks.filter((_, i) => i !== index),
      }
    }));
  };

  const updateDayBreak = (day: number, index: number, field: "break_start" | "break_end", value: string) => {
    setDayConfigs(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        breaks: prev[day].breaks.map((b, i) => (i === index ? { ...b, [field]: value } : b)),
      }
    }));
  };

  const formatTime = (time: string | null) => {
    if (!time) return "-";
    return time.slice(0, 5);
  };

  // Calculate working time for display
  const workingMinutes = useDifferentTimes
    ? Object.entries(dayConfigs)
        .filter(([_, config]) => config.enabled)
        .reduce((sum, [_, config]) => {
          return sum + calculateWorkingTime(config.start_time, config.end_time, config.breaks);
        }, 0)
    : calculateWorkingTime(formData.start_time, formData.end_time, breaks);

  // Get enabled days count
  const enabledDaysCount = Object.values(dayConfigs).filter(c => c.enabled).length;

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
                <TableHead className="text-xs w-16">Primær</TableHead>
                <TableHead className="text-xs">Navn</TableHead>
                <TableHead className="text-xs">Standard tid</TableHead>
                <TableHead className="text-xs">Dage</TableHead>
                <TableHead className="text-xs">Pauser</TableHead>
                <TableHead className="text-xs">Arbejdstid</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shifts.map((shift) => {
                const shiftBreaks = getShiftBreaks(shift.id);
                const shiftDays = getShiftDays(shift.id);
                const breakInputs = shiftBreaks.map((b) => ({
                  break_start: b.break_start,
                  break_end: b.break_end,
                }));
                const workTime = calculateWorkingTime(shift.start_time, shift.end_time, breakInputs);
                
                return (
                  <TableRow key={shift.id}>
                    <TableCell>
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={shift.is_primary}
                          onCheckedChange={(checked) => 
                            togglePrimaryMutation.mutate({ shiftId: shift.id, isPrimary: !!checked })
                          }
                          disabled={togglePrimaryMutation.isPending}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5">
                        {shift.is_primary && <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />}
                        {shift.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                    </TableCell>
                    <TableCell>
                      {shiftDays.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {WEEKDAY_ORDER.map(day => {
                            const dayConfig = shiftDays.find(d => d.day_of_week === day);
                            if (!dayConfig) return null;
                            const hasCustomTime = 
                              dayConfig.start_time.slice(0, 5) !== shift.start_time.slice(0, 5) ||
                              dayConfig.end_time.slice(0, 5) !== shift.end_time.slice(0, 5);
                            return (
                              <Badge 
                                key={day} 
                                variant={hasCustomTime ? "default" : "secondary"} 
                                className="text-xs"
                                title={hasCustomTime ? `${formatTime(dayConfig.start_time)}-${formatTime(dayConfig.end_time)}` : undefined}
                              >
                                {DAY_NAMES[day]}
                                {hasCustomTime && ` (${formatTime(dayConfig.start_time)}-${formatTime(dayConfig.end_time)})`}
                              </Badge>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">Alle dage</span>
                      )}
                    </TableCell>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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

            {/* Toggle for same/different times - at the top */}
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setUseDifferentTimes(false)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    !useDifferentTimes 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  Samme tider
                </button>
                <button
                  type="button"
                  onClick={() => setUseDifferentTimes(true)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    useDifferentTimes 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  Forskellige tider
                </button>
              </div>
              <span className="text-xs text-muted-foreground">
                {useDifferentTimes ? "Angiv tid pr. dag" : "Alle dage har samme tid"}
              </span>
            </div>

            {/* Standard times - only show when "Samme tider" */}
            {!useDifferentTimes && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start tid *</Label>
                  <TimeSelect
                    value={formData.start_time}
                    onChange={(value) => setFormData({ ...formData, start_time: value })}
                    placeholder="Vælg start"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slut tid *</Label>
                  <TimeSelect
                    value={formData.end_time}
                    onChange={(value) => setFormData({ ...formData, end_time: value })}
                    placeholder="Vælg slut"
                  />
                </div>
              </div>
            )}

            {/* Day selection */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Label>Vælg dage (valgfrit)</Label>
              </div>

              {/* Day checkboxes - always visible */}
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_ORDER.map(day => {
                  const config = dayConfigs[day];
                  return (
                    <label
                      key={day}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors ${
                        config.enabled 
                          ? "bg-primary/10 border-primary text-primary" 
                          : "bg-muted/30 border-border hover:bg-muted/50"
                      }`}
                    >
                      <Checkbox
                        checked={config.enabled}
                        onCheckedChange={() => toggleDay(day)}
                        className="sr-only"
                      />
                      <span className="text-sm font-medium">{DAY_NAMES[day]}</span>
                    </label>
                  );
                })}
              </div>

              {/* Individual day times and breaks - only show when "Forskellige tider" is selected and days are enabled */}
              {useDifferentTimes && enabledDaysCount > 0 && (
                    <div className="space-y-4 p-3 border rounded-lg bg-background">
                      {WEEKDAY_ORDER.filter(day => dayConfigs[day].enabled).map(day => {
                        const config = dayConfigs[day];
                        return (
                          <div key={day} className="space-y-2">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-semibold w-12">{DAY_NAMES[day]}</span>
                              <TimeSelect
                                value={config.start_time}
                                onChange={(value) => updateDayTime(day, "start_time", value)}
                                placeholder="Start"
                                className="flex-1"
                              />
                              <span className="text-muted-foreground">-</span>
                              <TimeSelect
                                value={config.end_time}
                                onChange={(value) => updateDayTime(day, "end_time", value)}
                                placeholder="Slut"
                                className="flex-1"
                              />
                            </div>
                            
                            {/* Day-specific breaks */}
                            <div className="ml-12 space-y-2">
                              {config.breaks.map((b, index) => (
                                <div key={index} className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground w-12">Pause</span>
                                  <TimeSelect
                                    value={b.break_start}
                                    onChange={(value) => updateDayBreak(day, index, "break_start", value)}
                                    placeholder="Start"
                                    className="flex-1"
                                  />
                                  <span className="text-muted-foreground">-</span>
                                  <TimeSelect
                                    value={b.break_end}
                                    onChange={(value) => updateDayBreak(day, index, "break_end", value)}
                                    placeholder="Slut"
                                    className="flex-1"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                                    onClick={() => removeDayBreak(day, index)}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => addDayBreak(day)}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Tilføj pause
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

              <p className="text-xs text-muted-foreground">
                {enabledDaysCount === 0 
                  ? "Ingen dage valgt = gælder alle dage med standard tidspunkter" 
                  : `${enabledDaysCount} dag(e) valgt`}
              </p>
            </div>

            {/* Breaks - only show when "Samme tider" is selected */}
            {!useDifferentTimes && (
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
                        <TimeSelect
                          value={b.break_start}
                          onChange={(value) => updateBreak(index, "break_start", value)}
                          placeholder="Start"
                          className="flex-1"
                        />
                        <span className="text-muted-foreground">-</span>
                        <TimeSelect
                          value={b.break_end}
                          onChange={(value) => updateBreak(index, "break_end", value)}
                          placeholder="Slut"
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                          onClick={() => removeBreak(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

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
