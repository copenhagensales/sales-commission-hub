import { useState, useMemo } from "react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isToday, isSameDay, parseISO, isWithinInterval } from "date-fns";
import { da } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Users, Clock, Palmtree, Thermometer, CalendarDays, AlarmClock } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useShifts, useDepartments, useEmployeesForShifts, useDanishHolidays, useAbsencesForDateRange, Shift, AbsenceRequest } from "@/hooks/useShiftPlanning";
import { CreateShiftDialog } from "@/components/shift-planning/CreateShiftDialog";
import { ShiftCard } from "@/components/shift-planning/ShiftCard";
import { EditTimeStampDialog } from "@/components/shift-planning/EditTimeStampDialog";
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

  const queryClient = useQueryClient();

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  // Only show weekdays (Monday-Friday), exclude weekend
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd }).filter(
    day => day.getDay() !== 0 && day.getDay() !== 6
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

  // Handle cell click - cycle through: empty -> vacation -> sick -> late (dialog) -> empty
  const handleCellClick = (employeeId: string, date: Date, currentAbsence: AbsenceRequest | null, currentLateness: LatenessRecord | null) => {
    const dateStr = format(date, "yyyy-MM-dd");

    // Cycle: empty -> vacation -> sick -> late (dialog) -> empty
    if (!currentLateness && !currentAbsence) {
      // Empty -> create vacation
      createAbsence.mutate({ employeeId, date: dateStr, type: "vacation" });
    } else if (currentAbsence?.type === "vacation" && !currentLateness) {
      // Vacation -> change to sick
      updateAbsence.mutate({ id: currentAbsence.id, type: "sick" });
    } else if (currentAbsence?.type === "sick" && !currentLateness) {
      // Sick -> show delay dialog (user can skip to go back to empty)
      deleteAbsence.mutate(currentAbsence.id);
      setPendingDelayCell({ employeeId, date: dateStr });
      setDelayMinutes("");
      setDelayDialogOpen(true);
    } else if (currentLateness) {
      // Late -> remove lateness (back to empty)
      deleteLateness.mutate(currentLateness.id);
    }
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

  // Handle double-click to open time stamp edit dialog
  const handleCellDoubleClick = (employee: { id: string; first_name: string; last_name: string }, date: Date, timeStamp: TimeStampData | null) => {
    setSelectedTimeStamp(timeStamp);
    setSelectedTimeStampEmployee({
      id: employee.id,
      name: `${employee.first_name} ${employee.last_name}`,
      date: date,
    });
    setEditTimeStampDialogOpen(true);
  };

  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            {/* Week Navigation */}
            <div className="flex items-center gap-4">
              <div className="flex items-center bg-muted/50 rounded-lg p-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-9 w-9 rounded-md hover:bg-background"
                  onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-9 px-3 text-sm font-medium hover:bg-background"
                  onClick={() => setCurrentDate(new Date())}
                >
                  I dag
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-9 w-9 rounded-md hover:bg-background"
                  onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  Uge {format(currentDate, "w", { locale: da })}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {format(weekStart, "d. MMMM", { locale: da })} – {format(weekEnd, "d. MMMM yyyy", { locale: da })}
                </p>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-3">
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Alle afdelinger" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle afdelinger</SelectItem>
                  {departments?.map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                size="sm" 
                className="h-9"
                onClick={() => { setSelectedDate(new Date()); setSelectedEmployeeId(null); setCreateDialogOpen(true); }}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Ny vagt
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
            <div className="bg-card border border-border/60 rounded-lg p-3 flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Medarbejdere</p>
                <p className="text-lg font-semibold">{employees?.length || 0}</p>
              </div>
            </div>
            <div className="bg-card border border-border/60 rounded-lg p-3 flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-500/10">
                <CalendarDays className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vagter</p>
                <p className="text-lg font-semibold">{shifts?.length || 0}</p>
              </div>
            </div>
            <div className="bg-card border border-border/60 rounded-lg p-3 flex items-center gap-3">
              <div className="p-2 rounded-md bg-emerald-500/10">
                <Clock className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Timer</p>
                <p className="text-lg font-semibold">{totalPlannedHours.toFixed(0)}t</p>
              </div>
            </div>
            <div className="bg-card border border-border/60 rounded-lg p-3 flex items-center gap-3">
              <div className="p-2 rounded-md bg-amber-500/10">
                <Palmtree className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ferie</p>
                <p className="text-lg font-semibold">{absenceStats.weekVacation}%</p>
              </div>
            </div>
            <div className="bg-card border border-border/60 rounded-lg p-3 flex items-center gap-3">
              <div className="p-2 rounded-md bg-red-500/10">
                <Thermometer className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sygdom</p>
                <p className="text-lg font-semibold">{absenceStats.weekSick}%</p>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground bg-muted/30 rounded-lg px-4 py-2.5">
            <span className="font-medium text-foreground/70">Status:</span>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-emerald-500/40 border border-emerald-500/60"></div>
              <span>Arbejder</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-amber-400/50 border border-amber-500/60"></div>
              <span>Ferie</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-400/50 border border-red-500/60"></div>
              <span>Syg</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-orange-400/50 border border-orange-500/60"></div>
              <span>Forsinket</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-border/60 mx-1" />
            <span className="text-xs text-muted-foreground/70">Klik for at skifte status • Dobbeltklik = ny vagt</span>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Day Headers - 6 columns: employee + 5 weekdays */}
              <div className="grid grid-cols-6 border-b-2 border-border bg-muted/50">
                <div className="p-3 text-xs font-semibold text-foreground bg-muted/70 border-r-2 border-border">
                  Medarbejder
                </div>
                {weekDays.map((day, dayIdx) => (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "text-center py-2.5 px-2",
                      dayIdx < weekDays.length - 1 && "border-r border-border/50",
                      isToday(day) && "bg-primary/10"
                    )}
                  >
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {format(day, "EEE", { locale: da })}
                    </p>
                    <p className={cn(
                      "text-base font-bold mt-0.5",
                      isToday(day) && "text-primary"
                    )}>
                      {format(day, "d")}
                    </p>
                    {isHoliday(day) && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 mt-1 border-destructive/30 text-destructive bg-destructive/5">
                        {getHolidayName(day)}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>

              {/* Employee Rows */}
              {employees?.map((employee, idx) => (
                <div 
                  key={employee.id} 
                  className={cn(
                    "grid grid-cols-6 group/row",
                    idx < (employees?.length || 0) - 1 && "border-b border-border/70",
                    idx % 2 === 0 
                      ? "bg-background" 
                      : "bg-muted/40 dark:bg-muted/25"
                  )}
                >
                  {/* Employee name cell - sticky left with clear border */}
                  <div className={cn(
                    "p-3 flex flex-col justify-center border-r-2 border-border",
                    idx % 2 === 0 
                      ? "bg-background" 
                      : "bg-muted/50 dark:bg-muted/30"
                  )}>
                    <p className="text-sm font-semibold leading-tight text-foreground">
                      {employee.first_name} {employee.last_name?.charAt(0)}.
                    </p>
                    {employee.department && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">{employee.department}</p>
                    )}
                  </div>
                  {weekDays.map((day, dayIdx) => {
                    const dateKey = format(day, "yyyy-MM-dd");
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
                    
                    // Default is green (working), late is orange, vacation is yellow, sick is red
                    const isWorking = !absenceDisplay && !lateness && !holiday;

                    // Get work times to display
                    const workTimes = employee.standard_start_time;
                    
                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          "min-h-[56px] p-1.5 cursor-pointer transition-all duration-150 relative",
                          dayIdx < weekDays.length - 1 && "border-r border-border/40",
                          isToday(day) && "ring-2 ring-inset ring-primary/40 bg-primary/5",
                          holiday && "bg-muted/50 cursor-not-allowed",
                          !holiday && isLate && "bg-orange-400/30 hover:bg-orange-400/40",
                          !holiday && isVacation && "bg-amber-400/30 hover:bg-amber-400/40",
                          !holiday && isSick && "bg-red-400/30 hover:bg-red-400/40",
                          !holiday && isWorking && "bg-emerald-500/20 hover:bg-emerald-500/30"
                        )}
                        onClick={() => {
                          if (!holiday) {
                            handleCellClick(employee.id, day, absence, lateness);
                          }
                        }}
                        onDoubleClick={() => {
                          if (!holiday) {
                            handleCellDoubleClick(employee, day, timeStamp);
                          }
                        }}
                      >
                        {hasShift && dayShifts.map(shift => (
                          <ShiftCard key={shift.id} shift={shift} compact />
                        ))}
                        {!hasShift && isLate && (
                          <div className="flex flex-col items-center justify-center h-full gap-0.5 text-orange-600">
                            <AlarmClock className="h-4 w-4" />
                            <span className="text-[10px] font-semibold">{lateness.minutes}m</span>
                          </div>
                        )}
                        {!hasShift && !isLate && isVacation && (
                          <div className="flex items-center justify-center h-full gap-1 text-amber-600">
                            <Palmtree className="h-4 w-4" />
                          </div>
                        )}
                        {!hasShift && !isLate && isSick && (
                          <div className="flex items-center justify-center h-full gap-1 text-red-500">
                            <Thermometer className="h-4 w-4" />
                          </div>
                        )}
                        {/* Show work times and clock-in when working */}
                        {!hasShift && !isLate && isWorking && !holiday && (
                          <div className="flex flex-col items-center justify-center h-full gap-0.5">
                            {workTimes && (
                              <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                                {workTimes}
                              </span>
                            )}
                            {timeStamp && (
                              <span className="text-[9px] text-muted-foreground">
                                ⏱ {format(new Date(timeStamp.clock_in), "HH:mm")}
                                {timeStamp.clock_out && ` - ${format(new Date(timeStamp.clock_out), "HH:mm")}`}
                              </span>
                            )}
                            {!timeStamp && (
                              <span className="text-[9px] text-muted-foreground/50">
                                ⏱ 2x klik for at stemple
                              </span>
                            )}
                          </div>
                        )}
                      </div>
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

        {/* Create Shift Dialog */}
        <CreateShiftDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          selectedDate={selectedDate}
          employees={employees || []}
          preselectedEmployeeId={selectedEmployeeId || undefined}
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
      </div>
    </MainLayout>
  );
}
