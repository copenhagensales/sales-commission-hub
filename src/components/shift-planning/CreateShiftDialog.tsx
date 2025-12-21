import { useState, useEffect, useMemo } from "react";
import { format, getDay } from "date-fns";
import { da } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Info } from "lucide-react";
import { useCreateShift } from "@/hooks/useShiftPlanning";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  department: string | null;
  standard_start_time: string | null;
  weekly_hours: number | null;
  team_id?: string | null;
}

interface CreateShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  employees: Employee[];
  preselectedEmployeeId?: string;
  teamId?: string;
}

interface StandardShift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  is_primary: boolean;
}

interface StandardShiftDay {
  id: string;
  shift_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

// Hook to fetch employee's team via team_members table
function useEmployeeTeamId(employeeId: string | undefined) {
  return useQuery({
    queryKey: ["employee-team-membership", employeeId],
    queryFn: async () => {
      if (!employeeId) return null;
      
      const { data, error } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("employee_id", employeeId)
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data?.team_id || null;
    },
    enabled: !!employeeId,
  });
}

// Hook to fetch primary standard shift for a team
function usePrimaryStandardShift(teamId: string | null | undefined) {
  return useQuery({
    queryKey: ["primary-standard-shift", teamId],
    queryFn: async () => {
      if (!teamId) return null;
      
      const { data: shift, error } = await supabase
        .from("team_standard_shifts")
        .select("*")
        .eq("team_id", teamId)
        .eq("is_primary", true)
        .maybeSingle();
      
      if (error) throw error;
      if (!shift) return null;
      
      // Also fetch shift days for day-specific times
      const { data: shiftDays, error: daysError } = await supabase
        .from("team_standard_shift_days")
        .select("*")
        .eq("shift_id", shift.id);
      
      if (daysError) throw daysError;
      
      return {
        shift: shift as StandardShift,
        days: (shiftDays || []) as StandardShiftDay[],
      };
    },
    enabled: !!teamId,
  });
}

export function CreateShiftDialog({
  open,
  onOpenChange,
  selectedDate,
  employees,
  preselectedEmployeeId,
  teamId
}: CreateShiftDialogProps) {
  const [employeeId, setEmployeeId] = useState<string>("");
  const [date, setDate] = useState<Date | undefined>(selectedDate || undefined);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("16:00");
  const [breakMinutes, setBreakMinutes] = useState("60");
  const [note, setNote] = useState("");

  const createShift = useCreateShift();
  
  // Get the selected employee's team via team_members table
  const { data: employeeTeamId } = useEmployeeTeamId(employeeId || undefined);
  
  const { data: primaryShiftData } = usePrimaryStandardShift(employeeTeamId);

  useEffect(() => {
    if (selectedDate) {
      setDate(selectedDate);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (preselectedEmployeeId) {
      setEmployeeId(preselectedEmployeeId);
    }
  }, [preselectedEmployeeId]);

  // Get times from primary standard shift based on day of week
  const getShiftTimesForDay = (dayDate: Date | undefined) => {
    if (!primaryShiftData || !dayDate) return null;
    
    // Database day_of_week: 1=Monday, 2=Tuesday, ..., 7=Sunday
    // JS getDay(): 0=Sunday, 1=Monday, 2=Tuesday, ..., 6=Saturday
    const jsDay = getDay(dayDate);
    // Convert from JS day to database format (1-7 where 1=Monday)
    const dbDayOfWeek = jsDay === 0 ? 7 : jsDay;
    
    // Check if there's a specific day configuration
    const dayConfig = primaryShiftData.days.find(d => d.day_of_week === dbDayOfWeek);
    
    if (dayConfig) {
      return {
        startTime: dayConfig.start_time.slice(0, 5), // "08:00:00" -> "08:00"
        endTime: dayConfig.end_time.slice(0, 5),
      };
    }
    
    // Fallback to main shift times
    return {
      startTime: primaryShiftData.shift.start_time.slice(0, 5),
      endTime: primaryShiftData.shift.end_time.slice(0, 5),
    };
  };

  // Apply times when date changes (only if using primary shift)
  useEffect(() => {
    if (date && primaryShiftData) {
      const times = getShiftTimesForDay(date);
      if (times) {
        setStartTime(times.startTime);
        setEndTime(times.endTime);
      }
    }
  }, [date, primaryShiftData]);

  // Priority: Primary shift > Employee standard time > defaults
  useEffect(() => {
    // If we have a primary shift, use it (handled above)
    if (primaryShiftData) return;
    
    // Fallback to employee standard time
    if (employeeId) {
      const employee = employees.find(e => e.id === employeeId);
      if (employee?.standard_start_time) {
        // Parse "8.00-16.30" format
        const [start, end] = employee.standard_start_time.split("-");
        if (start && end) {
          setStartTime(start.replace(".", ":"));
          setEndTime(end.replace(".", ":"));
        }
      }
    }
  }, [employeeId, employees, primaryShiftData]);

  const handleSubmit = () => {
    if (!employeeId || !date) return;

    createShift.mutate({
      employee_id: employeeId,
      date: format(date, "yyyy-MM-dd"),
      start_time: startTime,
      end_time: endTime,
      break_minutes: parseInt(breakMinutes) || 0,
      status: "planned",
      note: note || null,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        resetForm();
      }
    });
  };

  const resetForm = () => {
    setEmployeeId("");
    setDate(undefined);
    setStartTime("08:00");
    setEndTime("16:00");
    setBreakMinutes("60");
    setNote("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Opret ny vagt</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {primaryShiftData && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
              <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <span className="font-medium text-primary">Bruger team-vagt: </span>
                <span className="text-muted-foreground">{primaryShiftData.shift.name}</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Medarbejder</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Vælg medarbejder" />
              </SelectTrigger>
              <SelectContent>
                {employees.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name} {emp.department && `(${emp.department})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Dato</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP", { locale: da }) : "Vælg dato"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  locale={da}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Starttid</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Sluttid</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Pause (minutter)</Label>
            <Input
              type="number"
              value={breakMinutes}
              onChange={(e) => setBreakMinutes(e.target.value)}
              min="0"
              max="120"
            />
          </div>

          <div className="space-y-2">
            <Label>Note (valgfri)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Evt. bemærkninger..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuller
          </Button>
          <Button onClick={handleSubmit} disabled={!employeeId || !date || createShift.isPending}>
            {createShift.isPending ? "Opretter..." : "Opret vagt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
