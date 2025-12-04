import { useState, useMemo } from "react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isToday, isSameDay } from "date-fns";
import { da } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Users } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useShifts, useDepartments, useEmployeesForShifts, useDanishHolidays, Shift } from "@/hooks/useShiftPlanning";
import { CreateShiftDialog } from "@/components/shift-planning/CreateShiftDialog";
import { ShiftCard } from "@/components/shift-planning/ShiftCard";
import { cn } from "@/lib/utils";

export default function ShiftOverview() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const { data: shifts, isLoading: shiftsLoading } = useShifts(
    format(weekStart, "yyyy-MM-dd"),
    format(weekEnd, "yyyy-MM-dd"),
    selectedDepartment
  );
  const { data: departments } = useDepartments();
  const { data: employees } = useEmployeesForShifts(selectedDepartment);
  const { data: holidays } = useDanishHolidays(currentDate.getFullYear());

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

  const totalPlannedHours = useMemo(() => {
    return shifts?.reduce((sum, s) => sum + (s.planned_hours || 0), 0) || 0;
  }, [shifts]);

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
            <Button onClick={() => { setSelectedDate(new Date()); setCreateDialogOpen(true); }}>
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
                  </div>
                  {weekDays.map(day => {
                    const dateKey = format(day, "yyyy-MM-dd");
                    const dayShifts = shiftsByEmployeeAndDate.get(employee.id)?.get(dateKey) || [];
                    const holiday = isHoliday(day);
                    
                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          "min-h-[60px] border border-border rounded-lg p-1 cursor-pointer hover:bg-muted/50 transition-colors",
                          holiday && "bg-destructive/5"
                        )}
                        onClick={() => {
                          if (!holiday) {
                            setSelectedDate(day);
                            setCreateDialogOpen(true);
                          }
                        }}
                      >
                        {dayShifts.map(shift => (
                          <ShiftCard key={shift.id} shift={shift} compact />
                        ))}
                        {dayShifts.length === 0 && !holiday && (
                          <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
                            <Plus className="h-3 w-3" />
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
        />
      </div>
    </MainLayout>
  );
}
