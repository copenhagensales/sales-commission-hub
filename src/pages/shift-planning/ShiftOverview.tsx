import { useState, useMemo } from "react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isToday, isSameDay, parseISO, isWithinInterval } from "date-fns";
import { da } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Users, Clock, Palmtree, Thermometer, CalendarDays, AlarmClock, Pencil, X, ChevronDown, Info } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useShifts, useDepartments, useEmployeesForShifts, useDanishHolidays, useAbsencesForDateRange, Shift, AbsenceRequest } from "@/hooks/useShiftPlanning";
import { CreateShiftDialog } from "@/components/shift-planning/CreateShiftDialog";
import { ShiftCard } from "@/components/shift-planning/ShiftCard";
import { EditTimeStampDialog } from "@/components/shift-planning/EditTimeStampDialog";
import { ShiftDetailDialog } from "@/components/shift-planning/ShiftDetailDialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface LatenessRecord {
  id: string;
  employee_id: string;
  date: string;
  minutes: number;
  note: string | null;
}

type TimeStampData = {
  id: string;
  employee_id: string;
  clock_in: string;
  clock_out: string | null;
  effective_clock_in: string | null;
  effective_clock_out: string | null;
  effective_hours: number | null;
  break_minutes: number | null;
  note: string | null;
};

export default function ShiftOverview() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [delayDialogOpen, setDelayDialogOpen] = useState(false);
  const [delayMinutes, setDelayMinutes] = useState("");
  const [pendingDelayCell, setPendingDelayCell] = useState<{ employeeId: string; date: string } | null>(null);
  const [editTimeStampDialogOpen, setEditTimeStampDialogOpen] = useState(false);
  const [selectedTimeStamp, setSelectedTimeStamp] = useState<{ id: string; employee_id: string; clock_in: string; clock_out: string | null; effective_clock_in: string | null; effective_clock_out: string | null; effective_hours: number | null; break_minutes: number | null; note: string | null } | null>(null);
  const [selectedTimeStampEmployee, setSelectedTimeStampEmployee] = useState<{ id: string; name: string; date: Date } | null>(null);
  const [openPopoverKey, setOpenPopoverKey] = useState<string | null>(null);
  const [showWeekendStamps, setShowWeekendStamps] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedDetailEmployee, setSelectedDetailEmployee] = useState<{ id: string; first_name: string; last_name: string; department: string | null; salary_type: string | null; salary_amount: number | null; standard_start_time: string | null } | null>(null);
  const [selectedDetailDate, setSelectedDetailDate] = useState<Date | null>(null);
  const [selectedDetailTimeStamp, setSelectedDetailTimeStamp] = useState<TimeStampData | null>(null);

  const queryClient = useQueryClient();

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  // Only show weekdays (Monday-Friday), exclude weekend
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd }).filter(
    day => day.getDay() !== 0 && day.getDay() !== 6
  );
  // Weekend days for fold-out
  const weekendDays = eachDayOfInterval({ start: weekStart, end: weekEnd }).filter(
    day => day.getDay() === 0 || day.getDay() === 6
  );

  const { data: shifts } = useShifts(
    format(weekStart, "yyyy-MM-dd"),
    format(weekEnd, "yyyy-MM-dd"),
    selectedDepartment
  );
  const { data: departments } = useDepartments();
  const { data: employees } = useEmployeesForShifts(selectedDepartment);
  const { data: holidays } = useDanishHolidays(currentDate.getFullYear());
  const { data: absences } = useAbsencesForDateRange(
    format(weekStart, "yyyy-MM-dd"),
    format(weekEnd, "yyyy-MM-dd")
  );

  // Fetch lateness records for the week
  const { data: latenessRecords } = useQuery({
    queryKey: ["lateness-records", format(weekStart, "yyyy-MM-dd"), format(weekEnd, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lateness_record")
        .select("*")
        .gte("date", format(weekStart, "yyyy-MM-dd"))
        .lte("date", format(weekEnd, "yyyy-MM-dd"));
      if (error) throw error;
      return data as LatenessRecord[];
    },
  });

  // Fetch time stamps for the week
  const { data: timeStamps } = useQuery({
    queryKey: ["time-stamps-week", format(weekStart, "yyyy-MM-dd"), format(weekEnd, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_stamps")
        .select("*")
        .gte("clock_in", `${format(weekStart, "yyyy-MM-dd")}T00:00:00`)
        .lte("clock_in", `${format(weekEnd, "yyyy-MM-dd")}T23:59:59`);
      if (error) throw error;
      return data as { id: string; employee_id: string; clock_in: string; clock_out: string | null; effective_clock_in: string | null; effective_clock_out: string | null; effective_hours: number | null; break_minutes: number | null; note: string | null }[];
    },
  });

  // Get time stamp for specific employee and date
  const getTimeStampForDate = (employeeId: string, date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return timeStamps?.find(ts => {
      const tsDate = ts.clock_in.split("T")[0];
      return ts.employee_id === employeeId && tsDate === dateStr;
    }) || null;
  };

  // Mutation to create absence
  const createAbsence = useMutation({
    mutationFn: async ({ employeeId, date, type }: { employeeId: string; date: string; type: "vacation" | "sick" }) => {
      const { error } = await supabase
        .from("absence_request_v2")
        .insert({
          employee_id: employeeId,
          start_date: date,
          end_date: date,
          type,
          status: "approved",
          is_full_day: true,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["absences-date-range"] });
    },
    onError: (error: any) => {
      toast.error("Kunne ikke oprette fravær: " + error.message);
    },
  });

  // Mutation to update absence type
  const updateAbsence = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: "vacation" | "sick" }) => {
      const { error } = await supabase
        .from("absence_request_v2")
        .update({ type })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["absences-date-range"] });
    },
    onError: (error: any) => {
      toast.error("Kunne ikke opdatere fravær: " + error.message);
    },
  });

  // Mutation to delete absence
  const deleteAbsence = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("absence_request_v2")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["absences-date-range"] });
    },
    onError: (error: any) => {
      toast.error("Kunne ikke slette fravær: " + error.message);
    },
  });

  // Mutation to create lateness record
  const createLateness = useMutation({
    mutationFn: async ({ employeeId, date, minutes }: { employeeId: string; date: string; minutes: number }) => {
      const { error } = await supabase
        .from("lateness_record")
        .insert({
          employee_id: employeeId,
          date,
          minutes,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lateness-records"] });
      toast.success("Forsinkelse registreret");
    },
    onError: (error: any) => {
      toast.error("Kunne ikke registrere forsinkelse: " + error.message);
    },
  });

  // Mutation to delete lateness record
  const deleteLateness = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("lateness_record")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lateness-records"] });
    },
    onError: (error: any) => {
      toast.error("Kunne ikke slette forsinkelse: " + error.message);
    },
  });

  const isHoliday = (date: Date) => {
    return holidays?.some(h => isSameDay(new Date(h.date), date));
  };

  const getHolidayName = (date: Date) => {
    const holiday = holidays?.find(h => isSameDay(new Date(h.date), date));
    return holiday?.name;
  };

  const shiftsByEmployeeAndDate = useMemo(() => {
    const map = new Map<string, Map<string, Shift[]>>();
    shifts?.forEach(shift => {
      if (!map.has(shift.employee_id)) {
        map.set(shift.employee_id, new Map());
      }
      const dateKey = shift.date;
      const employeeMap = map.get(shift.employee_id)!;
      if (!employeeMap.has(dateKey)) {
        employeeMap.set(dateKey, []);
      }
      employeeMap.get(dateKey)!.push(shift);
    });
    return map;
  }, [shifts]);

  // Map absences by employee ID
  const absencesByEmployee = useMemo(() => {
    const map = new Map<string, AbsenceRequest[]>();
    absences?.forEach(absence => {
      if (!map.has(absence.employee_id)) {
        map.set(absence.employee_id, []);
      }
      map.get(absence.employee_id)!.push(absence);
    });
    return map;
  }, [absences]);

  // Get absence for specific date (single-day match only for click cycling)
  const getAbsenceForDate = (employeeId: string, date: Date): AbsenceRequest | null => {
    const employeeAbsences = absencesByEmployee.get(employeeId);
    if (!employeeAbsences) return null;
    
    const dateStr = format(date, "yyyy-MM-dd");
    return employeeAbsences.find(absence => {
      // For click cycling, we only match single-day absences on exact date
      return absence.start_date === dateStr && absence.end_date === dateStr;
    }) || null;
  };

  // Check if date is within any absence range (for display)
  const isDateInAbsence = (employeeId: string, date: Date): AbsenceRequest | null => {
    const employeeAbsences = absencesByEmployee.get(employeeId);
    if (!employeeAbsences) return null;
    
    return employeeAbsences.find(absence => {
      const startDate = parseISO(absence.start_date);
      const endDate = parseISO(absence.end_date);
      return isWithinInterval(date, { start: startDate, end: endDate });
    }) || null;
  };

  // Get lateness record for specific employee and date
  const getLatenessForDate = (employeeId: string, date: Date): LatenessRecord | null => {
    const dateStr = format(date, "yyyy-MM-dd");
    return latenessRecords?.find(r => r.employee_id === employeeId && r.date === dateStr) || null;
  };

  const totalPlannedHours = useMemo(() => {
    return shifts?.reduce((sum, s) => sum + (s.planned_hours || 0), 0) || 0;
  }, [shifts]);

  // Calculate absence statistics for the week and today
  const absenceStats = useMemo(() => {
    const employeeCount = employees?.length || 0;
    if (employeeCount === 0) return { weekVacation: 0, weekSick: 0, todayVacation: 0, todaySick: 0 };

    const today = new Date();
    let weekVacationDays = 0;
    let weekSickDays = 0;
    let todayVacation = 0;
    let todaySick = 0;

    employees?.forEach(emp => {
      weekDays.forEach(day => {
        const absence = absences?.find(a => {
          const start = parseISO(a.start_date);
          const end = parseISO(a.end_date);
          return a.employee_id === emp.id && isWithinInterval(day, { start, end });
        });
        if (absence?.type === "vacation") weekVacationDays++;
        if (absence?.type === "sick") weekSickDays++;
        
        if (isToday(day)) {
          if (absence?.type === "vacation") todayVacation++;
          if (absence?.type === "sick") todaySick++;
        }
      });
    });

    const totalWeekSlots = employeeCount * weekDays.length;
    return {
      weekVacation: totalWeekSlots > 0 ? Math.round((weekVacationDays / totalWeekSlots) * 100) : 0,
      weekSick: totalWeekSlots > 0 ? Math.round((weekSickDays / totalWeekSlots) * 100) : 0,
      todayVacation: employeeCount > 0 ? Math.round((todayVacation / employeeCount) * 100) : 0,
      todaySick: employeeCount > 0 ? Math.round((todaySick / employeeCount) * 100) : 0,
    };
  }, [employees, absences, weekDays]);

  // Weekend time stamps - group by employee
  const weekendTimeStamps = useMemo(() => {
    if (!timeStamps || !employees) return [];
    
    const weekendStamps: Array<{
      employee: typeof employees[0];
      date: Date;
      timeStamp: NonNullable<ReturnType<typeof getTimeStampForDate>>;
    }> = [];
    
    weekendDays.forEach(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      employees.forEach(emp => {
        const stamp = timeStamps.find(ts => {
          const tsDate = ts.clock_in.split("T")[0];
          return ts.employee_id === emp.id && tsDate === dateStr;
        });
        if (stamp) {
          weekendStamps.push({ employee: emp, date: day, timeStamp: stamp });
        }
      });
    });
    
    return weekendStamps.sort((a, b) => new Date(b.timeStamp.clock_in).getTime() - new Date(a.timeStamp.clock_in).getTime());
  }, [timeStamps, employees, weekendDays]);

  // Handle popover actions
  const handleSetVacation = (employeeId: string, date: Date, currentAbsence: AbsenceRequest | null) => {
    const dateStr = format(date, "yyyy-MM-dd");
    if (currentAbsence) {
      if (currentAbsence.type !== "vacation") {
        updateAbsence.mutate({ id: currentAbsence.id, type: "vacation" });
      }
    } else {
      createAbsence.mutate({ employeeId, date: dateStr, type: "vacation" });
    }
    setOpenPopoverKey(null);
  };

  const handleSetSick = (employeeId: string, date: Date, currentAbsence: AbsenceRequest | null) => {
    const dateStr = format(date, "yyyy-MM-dd");
    if (currentAbsence) {
      if (currentAbsence.type !== "sick") {
        updateAbsence.mutate({ id: currentAbsence.id, type: "sick" });
      }
    } else {
      createAbsence.mutate({ employeeId, date: dateStr, type: "sick" });
    }
    setOpenPopoverKey(null);
  };

  const handleSetLateness = (employeeId: string, date: Date, currentAbsence: AbsenceRequest | null) => {
    const dateStr = format(date, "yyyy-MM-dd");
    // Remove any existing absence first
    if (currentAbsence) {
      deleteAbsence.mutate(currentAbsence.id);
    }
    setPendingDelayCell({ employeeId, date: dateStr });
    setDelayMinutes("");
    setDelayDialogOpen(true);
    setOpenPopoverKey(null);
  };

  const handleEditTimeStamp = (employee: { id: string; first_name: string; last_name: string }, date: Date, timeStamp: TimeStampData | null) => {
    setSelectedTimeStamp(timeStamp);
    setSelectedTimeStampEmployee({
      id: employee.id,
      name: `${employee.first_name} ${employee.last_name}`,
      date: date,
    });
    setEditTimeStampDialogOpen(true);
    setOpenPopoverKey(null);
  };

  const handleClearStatus = (
    singleDayAbsence: AbsenceRequest | null, 
    currentLateness: LatenessRecord | null,
    multiDayAbsence?: AbsenceRequest | null
  ) => {
    // Use single-day absence if available, otherwise fall back to multi-day
    const absenceToDelete = singleDayAbsence || multiDayAbsence;
    if (absenceToDelete) {
      deleteAbsence.mutate(absenceToDelete.id);
    }
    if (currentLateness) {
      deleteLateness.mutate(currentLateness.id);
    }
    setOpenPopoverKey(null);
  };

  const handleViewDetails = (
    employee: { id: string; first_name: string; last_name: string; department: string | null; salary_type: string | null; salary_amount: number | null; standard_start_time: string | null },
    date: Date,
    timeStamp: TimeStampData | null
  ) => {
    setSelectedDetailEmployee(employee);
    setSelectedDetailDate(date);
    setSelectedDetailTimeStamp(timeStamp);
    setDetailDialogOpen(true);
    setOpenPopoverKey(null);
  };

  // Handle delay dialog submit
  const handleDelaySubmit = () => {
    if (!pendingDelayCell || !delayMinutes) return;
    const minutes = parseInt(delayMinutes, 10);
    if (isNaN(minutes) || minutes <= 0) {
      toast.error("Indtast et gyldigt antal minutter");
      return;
    }
    createLateness.mutate({
      employeeId: pendingDelayCell.employeeId,
      date: pendingDelayCell.date,
      minutes,
    });
    setDelayDialogOpen(false);
    setPendingDelayCell(null);
  };


  return (
    <MainLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6 animate-fade-in">
        {/* Header */}
        <div className="space-y-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            {/* Week Navigation */}
            <div className="flex items-center gap-5">
              <div className="flex items-center bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl p-1.5 shadow-sm border border-primary/10">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-10 w-10 rounded-lg hover:bg-primary/20 hover:text-primary transition-all"
                  onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-10 px-4 text-sm font-semibold hover:bg-primary/20 hover:text-primary transition-all rounded-lg"
                  onClick={() => setCurrentDate(new Date())}
                >
                  I dag
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-10 w-10 rounded-lg hover:bg-primary/20 hover:text-primary transition-all"
                  onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                  Uge {format(currentDate, "w", { locale: da })}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {format(weekStart, "d. MMMM", { locale: da })} – {format(weekEnd, "d. MMMM yyyy", { locale: da })}
                </p>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-3">
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger className="w-[180px] h-10 rounded-lg border-border/60 bg-background/50 backdrop-blur-sm">
                  <SelectValue placeholder="Alle afdelinger" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle afdelinger</SelectItem>
                  {departments?.map(team => (
                    <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-card border border-border/40 rounded-lg p-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase">Medarbejdere</p>
                <p className="text-xl font-semibold text-foreground">{employees?.length || 0}</p>
              </div>
            </div>
            <div className="bg-card border border-border/40 rounded-lg p-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <CalendarDays className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase">Vagter</p>
                <p className="text-xl font-semibold text-foreground">{shifts?.length || 0}</p>
              </div>
            </div>
            <div className="bg-card border border-border/40 rounded-lg p-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Clock className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase">Timer</p>
                <p className="text-xl font-semibold text-foreground">{totalPlannedHours.toFixed(0)}t</p>
              </div>
            </div>
            <div className="bg-card border border-border/40 rounded-lg p-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Palmtree className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase">Ferie</p>
                <p className="text-xl font-semibold text-foreground">{absenceStats.weekVacation}%</p>
              </div>
            </div>
            <div className="bg-card border border-border/40 rounded-lg p-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <Thermometer className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase">Sygdom</p>
                <p className="text-xl font-semibold text-foreground">{absenceStats.weekSick}%</p>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Status:</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 font-medium">
              <Palmtree className="h-3 w-3" /> Ferie
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 font-medium">
              <Thermometer className="h-3 w-3" /> Syg
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 font-medium">
              <AlarmClock className="h-3 w-3" /> Forsinket
            </span>
            <span className="text-muted-foreground/70 ml-auto">Klik på celle for handlinger</span>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-card rounded-xl border border-border/40 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Day Headers */}
              <div className="grid grid-cols-6 border-b border-border/60 bg-muted/30">
                <div className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Medarbejder
                </div>
                {weekDays.map((day, dayIdx) => (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "text-center py-3 px-2 border-l border-border/40",
                      isToday(day) && "bg-primary/10"
                    )}
                  >
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      {format(day, "EEE", { locale: da })}
                    </p>
                    <p className={cn(
                      "text-lg font-semibold mt-0.5",
                      isToday(day) ? "text-primary" : "text-foreground"
                    )}>
                      {format(day, "d")}
                    </p>
                    {isHoliday(day) && (
                      <span className="inline-block text-[9px] px-1.5 py-0.5 mt-1 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 font-medium">
                        {getHolidayName(day)}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Employee Rows */}
              {employees?.map((employee, idx) => (
                <div 
                  key={employee.id} 
                  className={cn(
                    "grid grid-cols-6",
                    idx < (employees?.length || 0) - 1 && "border-b border-border/30"
                  )}
                >
                  {/* Employee name cell */}
                  <div className="p-3 flex items-center gap-3 bg-muted/10">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                      {employee.first_name?.charAt(0)}{employee.last_name?.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {employee.first_name} {employee.last_name}
                      </p>
                      {employee.department && (
                        <p className="text-[10px] text-muted-foreground truncate">{employee.department}</p>
                      )}
                    </div>
                  </div>

                  {/* Day cells */}
                  {weekDays.map((day, dayIdx) => {
                    const dateKey = format(day, "yyyy-MM-dd");
                    const popoverKey = `${employee.id}-${dateKey}`;
                    const dayShifts = shiftsByEmployeeAndDate.get(employee.id)?.get(dateKey) || [];
                    const holiday = isHoliday(day);
                    const absence = getAbsenceForDate(employee.id, day);
                    const absenceDisplay = isDateInAbsence(employee.id, day);
                    const lateness = getLatenessForDate(employee.id, day);
                    const timeStamp = getTimeStampForDate(employee.id, day);
                    const hasShift = dayShifts.length > 0;
                    const isVacation = absenceDisplay?.type === "vacation";
                    const isSick = absenceDisplay?.type === "sick";
                    const isLate = !!lateness;
                    const isWorking = !absenceDisplay && !lateness && !holiday;
                    const workTimes = employee.standard_start_time;
                    const hasStatus = isVacation || isSick || isLate;
                    
                    return (
                      <Popover 
                        key={day.toISOString()} 
                        open={openPopoverKey === popoverKey} 
                        onOpenChange={(open) => setOpenPopoverKey(open ? popoverKey : null)}
                      >
                        <PopoverTrigger asChild>
                          <div
                            className={cn(
                              "min-h-[60px] p-2 border-l border-border/40 cursor-pointer transition-colors relative",
                              isToday(day) && "bg-primary/5",
                              holiday && "bg-muted/40 cursor-not-allowed",
                              !holiday && "hover:bg-muted/30"
                            )}
                          >
                            <div className="flex flex-col items-center justify-center h-full gap-1.5">
                              {/* Shift cards */}
                              {hasShift && dayShifts.map(shift => (
                                <ShiftCard key={shift.id} shift={shift} compact />
                              ))}

                              {/* Status Tags */}
                              {!hasShift && isLate && (
                                <div className="flex flex-col items-center gap-1">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                                    <AlarmClock className="h-3 w-3" />
                                    Forsinket
                                  </span>
                                  <span className="text-[10px] font-medium text-orange-600 dark:text-orange-400">
                                    {lateness.minutes} min
                                  </span>
                                </div>
                              )}

                              {!hasShift && !isLate && isVacation && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                  <Palmtree className="h-3 w-3" />
                                  Ferie
                                </span>
                              )}

                              {!hasShift && !isLate && isSick && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                                  <Thermometer className="h-3 w-3" />
                                  Syg
                                </span>
                              )}

                              {/* Working state */}
                              {!hasShift && !isLate && isWorking && !holiday && (
                                <div className="flex flex-col items-center gap-1">
                                  {workTimes && (
                                    <span className="text-[10px] font-medium text-muted-foreground">
                                      {workTimes}
                                    </span>
                                  )}
                                  {timeStamp && (
                                    <span className="text-[9px] text-muted-foreground/80">
                                      {format(new Date(timeStamp.clock_in), "HH:mm")}
                                      {timeStamp.clock_out && ` – ${format(new Date(timeStamp.clock_out), "HH:mm")}`}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </PopoverTrigger>
                        {!holiday && (
                          <PopoverContent className="w-48 p-2" align="center" side="bottom">
                            <div className="flex flex-col gap-1">
                              <p className="text-xs font-medium text-muted-foreground px-2 py-1 border-b mb-1">
                                {format(day, "EEEE d. MMM", { locale: da })}
                              </p>
                              <Button
                                variant="ghost"
                                size="sm"
                                className={cn(
                                  "justify-start gap-2 h-8",
                                  isVacation && "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                )}
                                onClick={() => handleSetVacation(employee.id, day, absence)}
                              >
                                <Palmtree className="h-4 w-4" />
                                Ferie
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className={cn(
                                  "justify-start gap-2 h-8",
                                  isSick && "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                                )}
                                onClick={() => handleSetSick(employee.id, day, absence)}
                              >
                                <Thermometer className="h-4 w-4" />
                                Syg
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className={cn(
                                  "justify-start gap-2 h-8",
                                  isLate && "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
                                )}
                                onClick={() => handleSetLateness(employee.id, day, absence)}
                              >
                                <AlarmClock className="h-4 w-4" />
                                Forsinket
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="justify-start gap-2 h-8"
                                onClick={() => handleEditTimeStamp(employee, day, timeStamp)}
                              >
                                <Pencil className="h-4 w-4" />
                                Ændre indstempling
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="justify-start gap-2 h-8"
                                onClick={() => handleViewDetails(employee as any, day, timeStamp)}
                              >
                                <Info className="h-4 w-4" />
                                Se info
                              </Button>
                              {hasStatus && (
                                <>
                                  <div className="border-t my-1" />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="justify-start gap-2 h-8 text-destructive hover:text-destructive"
                                    onClick={() => handleClearStatus(absence, lateness, absenceDisplay)}
                                  >
                                    <X className="h-4 w-4" />
                                    Fjern status
                                  </Button>
                                </>
                              )}
                            </div>
                          </PopoverContent>
                        )}
                      </Popover>
                    );
                  })}
                </div>
              ))}

              {(!employees || employees.length === 0) && (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Ingen medarbejdere fundet
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Weekend Time Stamps - Collapsible */}
        <div className="bg-card rounded-xl border border-orange-200 dark:border-orange-800 overflow-hidden shadow-sm">
          <button
            onClick={() => setShowWeekendStamps(!showWeekendStamps)}
            className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900/40">
                <CalendarDays className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-semibold text-foreground">Weekend (lørdag + søndag)</h3>
                <p className="text-xs text-muted-foreground">
                  {weekendTimeStamps.length > 0 
                    ? `${weekendTimeStamps.length} registrering${weekendTimeStamps.length !== 1 ? 'er' : ''} i weekenden`
                    : 'Ingen indstemplinger i weekenden'
                  }
                </p>
              </div>
            </div>
            <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", showWeekendStamps && "rotate-180")} />
          </button>
          
          {showWeekendStamps && (
            <div className="border-t border-orange-200 dark:border-orange-800">
              {weekendTimeStamps.length > 0 ? (
                <div className="divide-y divide-border/30">
                  {weekendTimeStamps.map((item) => {
                    const clockIn = new Date(item.timeStamp.clock_in);
                    const clockOut = item.timeStamp.clock_out ? new Date(item.timeStamp.clock_out) : null;
                    const startTime = clockIn.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
                    const endTime = clockOut ? clockOut.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }) : null;
                    const hours = clockOut ? (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60) : null;
                    
                    return (
                      <div key={`${item.employee.id}-${item.date.toISOString()}`} className="flex items-center justify-between p-4 hover:bg-muted/20">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center text-xs font-semibold text-orange-700 dark:text-orange-300">
                            {item.employee.first_name?.charAt(0)}{item.employee.last_name?.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{item.employee.first_name} {item.employee.last_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(item.date, "EEEE d. MMM", { locale: da })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {startTime}{endTime ? ` - ${endTime}` : ' (ikke udstemplet)'}
                          </span>
                          {hours !== null && (
                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800">
                              {hours.toFixed(1)} timer
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  Ingen weekend-indstemplinger denne uge
                </div>
              )}
            </div>
          )}
        </div>

        {/* Create Shift Dialog */}
        <CreateShiftDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          selectedDate={selectedDate}
          employees={employees || []}
          preselectedEmployeeId={selectedEmployeeId || undefined}
          teamId={selectedDepartment}
        />

        {/* Delay Input Dialog */}
        <Dialog open={delayDialogOpen} onOpenChange={setDelayDialogOpen}>
          <DialogContent className="sm:max-w-[320px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlarmClock className="h-5 w-5 text-orange-500" />
                Registrer forsinkelse
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <label className="text-sm text-muted-foreground mb-2 block">
                Antal minutter forsinket
              </label>
              <Input
                type="number"
                min="1"
                max="480"
                placeholder="f.eks. 15"
                value={delayMinutes}
                onChange={(e) => setDelayMinutes(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleDelaySubmit();
                }}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDelayDialogOpen(false)}>
                Spring over
              </Button>
              <Button onClick={handleDelaySubmit} className="bg-orange-500 hover:bg-orange-600">
                Gem
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Time Stamp Dialog */}
        {selectedTimeStampEmployee && (
          <EditTimeStampDialog
            open={editTimeStampDialogOpen}
            onOpenChange={setEditTimeStampDialogOpen}
            timeStamp={selectedTimeStamp}
            employeeId={selectedTimeStampEmployee.id}
            employeeName={selectedTimeStampEmployee.name}
            date={selectedTimeStampEmployee.date}
          />
        )}

        {/* Shift Detail Dialog */}
        <ShiftDetailDialog
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          employee={selectedDetailEmployee}
          date={selectedDetailDate}
          timeStamp={selectedDetailTimeStamp}
        />
      </div>
    </MainLayout>
  );
}
