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
                  {departments?.map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="group bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-4 flex items-center gap-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-0.5">
              <div className="p-3 rounded-xl bg-primary/15 group-hover:bg-primary/25 transition-colors">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Medarbejdere</p>
                <p className="text-2xl font-bold text-foreground">{employees?.length || 0}</p>
              </div>
            </div>
            <div className="group bg-gradient-to-br from-blue-500/5 via-blue-500/10 to-blue-500/5 border border-blue-500/20 rounded-2xl p-4 flex items-center gap-4 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300 hover:-translate-y-0.5">
              <div className="p-3 rounded-xl bg-blue-500/15 group-hover:bg-blue-500/25 transition-colors">
                <CalendarDays className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vagter</p>
                <p className="text-2xl font-bold text-foreground">{shifts?.length || 0}</p>
              </div>
            </div>
            <div className="group bg-gradient-to-br from-emerald-500/5 via-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-4 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300 hover:-translate-y-0.5">
              <div className="p-3 rounded-xl bg-emerald-500/15 group-hover:bg-emerald-500/25 transition-colors">
                <Clock className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Timer</p>
                <p className="text-2xl font-bold text-foreground">{totalPlannedHours.toFixed(0)}t</p>
              </div>
            </div>
            <div className="group bg-gradient-to-br from-amber-500/5 via-amber-500/10 to-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-4 hover:shadow-lg hover:shadow-amber-500/5 transition-all duration-300 hover:-translate-y-0.5">
              <div className="p-3 rounded-xl bg-amber-500/15 group-hover:bg-amber-500/25 transition-colors">
                <Palmtree className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ferie</p>
                <p className="text-2xl font-bold text-foreground">{absenceStats.weekVacation}%</p>
              </div>
            </div>
            <div className="group bg-gradient-to-br from-red-500/5 via-red-500/10 to-red-500/5 border border-red-500/20 rounded-2xl p-4 flex items-center gap-4 hover:shadow-lg hover:shadow-red-500/5 transition-all duration-300 hover:-translate-y-0.5">
              <div className="p-3 rounded-xl bg-red-500/15 group-hover:bg-red-500/25 transition-colors">
                <Thermometer className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sygdom</p>
                <p className="text-2xl font-bold text-foreground">{absenceStats.weekSick}%</p>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm bg-gradient-to-r from-muted/40 to-muted/20 rounded-xl px-5 py-3 border border-border/40">
            <span className="font-semibold text-foreground/80">Status:</span>
            <div className="flex items-center gap-2.5">
              <div className="w-4 h-4 rounded-md bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-sm shadow-emerald-500/30"></div>
              <span className="font-medium">Arbejder</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-4 h-4 rounded-md bg-gradient-to-br from-amber-400 to-amber-500 shadow-sm shadow-amber-500/30"></div>
              <span className="font-medium">Ferie</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-4 h-4 rounded-md bg-gradient-to-br from-red-400 to-red-500 shadow-sm shadow-red-500/30"></div>
              <span className="font-medium">Syg</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-4 h-4 rounded-md bg-gradient-to-br from-orange-400 to-orange-500 shadow-sm shadow-orange-500/30"></div>
              <span className="font-medium">Forsinket</span>
            </div>
            <div className="hidden sm:block w-px h-5 bg-border/60 mx-2" />
            <span className="text-xs text-muted-foreground">Klik = skifte status • Dobbeltklik = rediger tid</span>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-card rounded-2xl border border-border/60 overflow-hidden shadow-xl shadow-black/5">
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Day Headers */}
              <div className="grid grid-cols-6 bg-gradient-to-r from-muted/80 to-muted/60">
                <div className="p-4 text-xs font-bold text-foreground uppercase tracking-wider border-r-2 border-border/30">
                  Medarbejder
                </div>
                {weekDays.map((day, dayIdx) => (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "text-center py-3 px-2 transition-colors",
                      dayIdx < weekDays.length - 1 && "border-r border-border/30",
                      isToday(day) && "bg-primary/15"
                    )}
                  >
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      {format(day, "EEE", { locale: da })}
                    </p>
                    <p className={cn(
                      "text-xl font-bold mt-1",
                      isToday(day) ? "text-primary" : "text-foreground"
                    )}>
                      {format(day, "d")}
                    </p>
                    {isHoliday(day) && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 mt-1.5 border-red-300 text-red-600 bg-red-50 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400 font-semibold">
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
                    "grid grid-cols-6 group/row transition-colors",
                    idx < (employees?.length || 0) - 1 && "border-b border-border/40",
                    idx % 2 === 0 
                      ? "bg-background hover:bg-muted/20" 
                      : "bg-muted/30 hover:bg-muted/40"
                  )}
                >
                  {/* Employee name cell */}
                  <div className={cn(
                    "p-4 flex flex-col justify-center border-r-2 border-border/30",
                    idx % 2 === 0 
                      ? "bg-background" 
                      : "bg-muted/40"
                  )}>
                    <p className="text-sm font-semibold leading-tight text-foreground">
                      {employee.first_name} {employee.last_name?.charAt(0)}.
                    </p>
                    {employee.department && (
                      <p className="text-[10px] text-muted-foreground mt-1 font-medium bg-muted/50 px-2 py-0.5 rounded-full w-fit">{employee.department}</p>
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
                          "min-h-[64px] p-2 cursor-pointer transition-all duration-200 relative group",
                          dayIdx < weekDays.length - 1 && "border-r border-border/30",
                          isToday(day) && "ring-2 ring-inset ring-primary/50 bg-primary/5",
                          holiday && "bg-muted/60 cursor-not-allowed opacity-60",
                          !holiday && isLate && "bg-gradient-to-br from-orange-400/25 to-orange-500/35 hover:from-orange-400/35 hover:to-orange-500/45",
                          !holiday && isVacation && "bg-gradient-to-br from-amber-300/25 to-amber-400/35 hover:from-amber-300/35 hover:to-amber-400/45",
                          !holiday && isSick && "bg-gradient-to-br from-red-400/25 to-red-500/35 hover:from-red-400/35 hover:to-red-500/45",
                          !holiday && isWorking && "bg-gradient-to-br from-emerald-400/15 to-emerald-500/25 hover:from-emerald-400/25 hover:to-emerald-500/35"
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
                          <div className="flex flex-col items-center justify-center h-full gap-1">
                            <div className="p-1.5 rounded-full bg-orange-500/20">
                              <AlarmClock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                            </div>
                            <span className="text-[10px] font-bold text-orange-700 dark:text-orange-300">{lateness.minutes}m</span>
                          </div>
                        )}
                        {!hasShift && !isLate && isVacation && (
                          <div className="flex items-center justify-center h-full">
                            <div className="p-2 rounded-full bg-amber-500/20">
                              <Palmtree className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            </div>
                          </div>
                        )}
                        {!hasShift && !isLate && isSick && (
                          <div className="flex items-center justify-center h-full">
                            <div className="p-2 rounded-full bg-red-500/20">
                              <Thermometer className="h-5 w-5 text-red-600 dark:text-red-400" />
                            </div>
                          </div>
                        )}
                        {/* Show work times and clock-in when working */}
                        {!hasShift && !isLate && isWorking && !holiday && (
                          <div className="flex flex-col items-center justify-center h-full gap-1">
                            {workTimes && (
                              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                {workTimes}
                              </span>
                            )}
                            {timeStamp && (
                              <span className="text-[9px] font-medium text-muted-foreground bg-background/60 px-1.5 py-0.5 rounded">
                                ⏱ {format(new Date(timeStamp.clock_in), "HH:mm")}
                                {timeStamp.clock_out && ` → ${format(new Date(timeStamp.clock_out), "HH:mm")}`}
                              </span>
                            )}
                            {!timeStamp && (
                              <span className="text-[9px] text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity">
                                2x klik = stemple
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
