import { useState, useMemo } from "react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isToday, isSameDay, parseISO, isWithinInterval } from "date-fns";
import { da } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Users, Clock, Palmtree, Thermometer, CalendarDays } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useShifts, useDepartments, useEmployeesForShifts, useDanishHolidays, useAbsencesForDateRange, Shift, AbsenceRequest } from "@/hooks/useShiftPlanning";
import { CreateShiftDialog } from "@/components/shift-planning/CreateShiftDialog";
import { ShiftCard } from "@/components/shift-planning/ShiftCard";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type CellStatus = "shift" | "vacation" | "sick";

export default function ShiftOverview() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

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

  // Handle cell click - cycle through: shift -> vacation -> sick -> shift
  const handleCellClick = (employeeId: string, date: Date, currentAbsence: AbsenceRequest | null, hasShift: boolean) => {
    const dateStr = format(date, "yyyy-MM-dd");

    if (hasShift) {
      // If there's a shift, open edit dialog instead of cycling
      return;
    }

    if (!currentAbsence) {
      // No absence -> create vacation
      createAbsence.mutate({ employeeId, date: dateStr, type: "vacation" });
    } else if (currentAbsence.type === "vacation") {
      // Vacation -> change to sick
      updateAbsence.mutate({ id: currentAbsence.id, type: "sick" });
    } else if (currentAbsence.type === "sick") {
      // Sick -> remove absence (back to normal/shift)
      deleteAbsence.mutate(currentAbsence.id);
    }
  };

  // Handle double-click to open create shift dialog
  const handleCellDoubleClick = (employeeId: string, date: Date, absence: AbsenceRequest | null) => {
    if (!absence) {
      setSelectedEmployeeId(employeeId);
      setSelectedDate(date);
      setCreateDialogOpen(true);
    }
  };

  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-4">
        {/* Compact Header with Navigation */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 pb-2 border-b border-border/50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-2 text-xs"
                onClick={() => setCurrentDate(new Date())}
              >
                I dag
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div>
              <h1 className="text-lg font-semibold">
                Uge {format(currentDate, "w", { locale: da })}
              </h1>
              <p className="text-xs text-muted-foreground">
                {format(weekStart, "d. MMM", { locale: da })} – {format(weekEnd, "d. MMM yyyy", { locale: da })}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Stats */}
            <div className="flex items-center gap-3 mr-2 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span>{employees?.length || 0}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                <span>{shifts?.length || 0} vagter</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>{totalPlannedHours.toFixed(0)}t</span>
              </div>
            </div>
            
            {/* Absence Stats - subtle separator */}
            <div className="flex items-center gap-2 pl-2 border-l border-border/40 text-xs">
              <div className="flex items-center gap-1 text-amber-600/80" title="Ferie denne uge">
                <Palmtree className="h-3 w-3" />
                <span>{absenceStats.weekVacation}%</span>
              </div>
              <div className="flex items-center gap-1 text-red-500/80" title="Sygdom denne uge">
                <Thermometer className="h-3 w-3" />
                <span>{absenceStats.weekSick}%</span>
              </div>
            </div>
            
            <div className="w-px h-4 bg-border/40 mx-1" />
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
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
              className="h-8 text-xs"
              onClick={() => { setSelectedDate(new Date()); setSelectedEmployeeId(null); setCreateDialogOpen(true); }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Ny vagt
            </Button>
          </div>
        </div>

        {/* Inline Legend */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500/50"></div>
            <span>Arbejder</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-amber-400/60"></div>
            <span>Ferie (1 klik)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-red-400/60"></div>
            <span>Syg (2 klik)</span>
          </div>
          <span className="text-muted-foreground/50">|</span>
          <span className="text-muted-foreground/60">Dobbeltklik = opret vagt</span>
        </div>

        {/* Calendar Grid */}
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Day Headers - 6 columns: employee + 5 weekdays */}
              <div className="grid grid-cols-6 border-b border-border/50 bg-muted/30">
                <div className="p-3 text-xs font-medium text-muted-foreground">
                  Medarbejder
                </div>
                {weekDays.map(day => (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "text-center py-2.5 px-2 border-l border-border/30",
                      isToday(day) && "bg-primary/5"
                    )}
                  >
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      {format(day, "EEE", { locale: da })}
                    </p>
                    <p className={cn(
                      "text-sm font-semibold mt-0.5",
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
                    "grid grid-cols-6 border-b border-border/30 last:border-b-0",
                    idx % 2 === 0 ? "bg-background" : "bg-muted/10"
                  )}
                >
                  <div className="p-2.5 flex flex-col justify-center">
                    <p className="text-sm font-medium leading-tight">
                      {employee.first_name} {employee.last_name?.charAt(0)}.
                    </p>
                    {employee.department && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{employee.department}</p>
                    )}
                  </div>
                  {weekDays.map(day => {
                    const dateKey = format(day, "yyyy-MM-dd");
                    const dayShifts = shiftsByEmployeeAndDate.get(employee.id)?.get(dateKey) || [];
                    const holiday = isHoliday(day);
                    const absence = getAbsenceForDate(employee.id, day);
                    const absenceDisplay = isDateInAbsence(employee.id, day);
                    const hasShift = dayShifts.length > 0;
                    const isVacation = absenceDisplay?.type === "vacation";
                    const isSick = absenceDisplay?.type === "sick";
                    
                    // Default is green (working), vacation is yellow, sick is red
                    const isWorking = !absenceDisplay && !holiday;
                    
                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          "min-h-[52px] p-1 border-l border-border/30 cursor-pointer transition-all duration-150",
                          isToday(day) && "ring-1 ring-primary/30",
                          holiday && "bg-muted/40 cursor-not-allowed",
                          !holiday && isVacation && "bg-amber-400/20 hover:bg-amber-400/30",
                          !holiday && isSick && "bg-red-400/20 hover:bg-red-400/30",
                          !holiday && isWorking && "bg-emerald-500/15 hover:bg-emerald-500/25"
                        )}
                        onClick={() => {
                          if (!holiday) {
                            handleCellClick(employee.id, day, absence, hasShift);
                          }
                        }}
                        onDoubleClick={() => {
                          if (!holiday) {
                            handleCellDoubleClick(employee.id, day, absenceDisplay);
                          }
                        }}
                      >
                        {hasShift && dayShifts.map(shift => (
                          <ShiftCard key={shift.id} shift={shift} compact />
                        ))}
                        {!hasShift && isVacation && (
                          <div className="flex items-center justify-center h-full gap-1 text-amber-600">
                            <Palmtree className="h-3.5 w-3.5" />
                          </div>
                        )}
                        {!hasShift && isSick && (
                          <div className="flex items-center justify-center h-full gap-1 text-red-500">
                            <Thermometer className="h-3.5 w-3.5" />
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
      </div>
    </MainLayout>
  );
}
