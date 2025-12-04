import { useState, useMemo } from "react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isToday, isSameDay, parseISO, isWithinInterval } from "date-fns";
import { da } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Users, Palmtree, Thermometer } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

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
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Vagtplan</h1>
            <p className="text-muted-foreground">
              Uge {format(currentDate, "w", { locale: da })} - {format(weekStart, "d. MMM", { locale: da })} til {format(weekEnd, "d. MMM yyyy", { locale: da })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Alle afdelinger" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle afdelinger</SelectItem>
                {departments?.map(dept => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => { setSelectedDate(new Date()); setSelectedEmployeeId(null); setCreateDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Ny vagt
            </Button>
          </div>
        </div>

        {/* Week Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setCurrentDate(subWeeks(currentDate, 1))}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Forrige uge
          </Button>
          <Button variant="ghost" onClick={() => setCurrentDate(new Date())}>
            I dag
          </Button>
          <Button variant="outline" onClick={() => setCurrentDate(addWeeks(currentDate, 1))}>
            Næste uge
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {/* Legend */}
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500/20 border border-green-500"></div>
            <span>Vagt / Normal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-amber-500/20 border border-amber-500"></div>
            <span>Ferie (1 klik)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500/20 border border-red-500"></div>
            <span>Syg (2 klik)</span>
          </div>
          <span className="text-muted-foreground text-xs ml-4">Dobbeltklik for at oprette vagt</span>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Medarbejdere</p>
                  <p className="text-2xl font-bold">{employees?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Vagter denne uge</p>
                  <p className="text-2xl font-bold">{shifts?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Planlagte timer</p>
                  <p className="text-2xl font-bold">{totalPlannedHours.toFixed(1)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Weekly Calendar Grid */}
        <Card>
          <CardHeader>
            <CardTitle>Ugevisning</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Day Headers */}
              <div className="grid grid-cols-8 gap-2 mb-4">
                <div className="font-medium text-sm text-muted-foreground p-2">Medarbejder</div>
                {weekDays.map(day => (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "text-center p-2 rounded-lg",
                      isToday(day) && "bg-primary/10",
                      isHoliday(day) && "bg-destructive/10"
                    )}
                  >
                    <p className="font-medium text-sm">{format(day, "EEEE", { locale: da })}</p>
                    <p className={cn("text-lg", isToday(day) && "text-primary font-bold")}>
                      {format(day, "d")}
                    </p>
                    {isHoliday(day) && (
                      <Badge variant="destructive" className="text-xs mt-1">
                        {getHolidayName(day)}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>

              {/* Employee Rows */}
              {employees?.map(employee => (
                <div key={employee.id} className="grid grid-cols-8 gap-2 mb-2 items-start">
                  <div className="p-2 text-sm">
                    <p className="font-medium">{employee.first_name} {employee.last_name}</p>
                    <p className="text-xs text-muted-foreground">{employee.department}</p>
                    {employee.standard_start_time && (
                      <p className="text-xs text-muted-foreground">Mødetid: {employee.standard_start_time}</p>
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
                    
                    // Determine cell styling based on status
                    const cellClasses = cn(
                      "min-h-[60px] border rounded-lg p-1 cursor-pointer transition-colors select-none",
                      holiday && "bg-destructive/5 border-destructive/20 cursor-not-allowed",
                      !holiday && hasShift && "bg-green-500/20 border-green-500 hover:bg-green-500/30",
                      !holiday && !hasShift && isVacation && "bg-amber-500/20 border-amber-500 hover:bg-amber-500/30",
                      !holiday && !hasShift && isSick && "bg-red-500/20 border-red-500 hover:bg-red-500/30",
                      !holiday && !hasShift && !absenceDisplay && "border-border hover:bg-muted/50"
                    );
                    
                    return (
                      <div
                        key={day.toISOString()}
                        className={cellClasses}
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
                          <div className="flex flex-col items-center justify-center h-full text-amber-600 text-xs gap-1">
                            <Palmtree className="h-4 w-4" />
                            <span>Ferie</span>
                          </div>
                        )}
                        {!hasShift && isSick && (
                          <div className="flex flex-col items-center justify-center h-full text-red-600 text-xs gap-1">
                            <Thermometer className="h-4 w-4" />
                            <span>Syg</span>
                          </div>
                        )}
                        {!hasShift && !absenceDisplay && !holiday && (
                          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs">
                            {employee.standard_start_time ? (
                              <span className="text-[10px]">{employee.standard_start_time}</span>
                            ) : (
                              <Plus className="h-3 w-3" />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              {(!employees || employees.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  Ingen medarbejdere fundet
                </div>
              )}
            </div>
          </CardContent>
        </Card>

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