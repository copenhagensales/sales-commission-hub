import { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameDay, addMonths, subMonths, startOfWeek, addDays, addWeeks } from "date-fns";
import { da } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Briefcase, Thermometer, Umbrella, Palmtree, Clock, CalendarPlus } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCurrentEmployee, useMyShifts, useDanishHolidays, useAbsenceStats, useAbsenceRequests } from "@/hooks/useShiftPlanning";
import { CreateAbsenceDialog } from "@/components/shift-planning/CreateAbsenceDialog";
import { TimeClock } from "@/components/shift-planning/TimeClock";
import { cn } from "@/lib/utils";

export default function MySchedule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [absenceDialogOpen, setAbsenceDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [absenceType, setAbsenceType] = useState<"vacation" | "sick">("vacation");

  const { data: employee, isLoading: employeeLoading } = useCurrentEmployee();
  
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  
  // Generate weeks for the month (Mon-Fri only)
  const generateWeeks = () => {
    const weeks: Date[][] = [];
    let weekStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    
    while (weekStart <= monthEnd) {
      const weekDays: Date[] = [];
      for (let d = 0; d < 5; d++) { // Only Mon-Fri
        const day = addDays(weekStart, d);
        if (day.getMonth() === currentDate.getMonth()) {
          weekDays.push(day);
        }
      }
      if (weekDays.length > 0) {
        weeks.push(weekDays);
      }
      weekStart = addWeeks(weekStart, 1);
    }
    return weeks;
  };
  
  const calendarWeeks = generateWeeks();

  // Parse working hours from standard_start_time
  const parseWorkingHours = (timeString: string | null) => {
    if (!timeString) return { start: "09:00", end: "17:00" };
    const [start, end] = timeString.split("-").map(t => t.trim().replace(".", ":"));
    return { start, end };
  };
  
  const workingHours = employee ? parseWorkingHours(employee.standard_start_time) : { start: "09:00", end: "17:00" };

  const { data: shifts } = useMyShifts(
    employee?.id,
    format(monthStart, "yyyy-MM-dd"),
    format(monthEnd, "yyyy-MM-dd")
  );
  const { data: holidays } = useDanishHolidays(currentDate.getFullYear());
  const { data: absenceStats } = useAbsenceStats(employee?.id, currentDate.getFullYear());
  const { data: myAbsences } = useAbsenceRequests(undefined, employee?.id);

  const isHoliday = (date: Date) => {
    return holidays?.some(h => isSameDay(new Date(h.date), date));
  };

  const getHolidayName = (date: Date) => {
    const holiday = holidays?.find(h => isSameDay(new Date(h.date), date));
    return holiday?.name;
  };

  const getShiftForDay = (date: Date) => {
    return shifts?.find(s => isSameDay(new Date(s.date), date));
  };

  const getAbsenceForDay = (date: Date) => {
    return myAbsences?.find(a => {
      const start = new Date(a.start_date);
      const end = new Date(a.end_date);
      return date >= start && date <= end;
    });
  };

  const handleDayClick = (date: Date, type: "vacation" | "sick") => {
    setSelectedDate(date);
    setAbsenceType(type);
    setAbsenceDialogOpen(true);
  };

  const totalPlannedHours = shifts?.reduce((sum, s) => sum + (s.planned_hours || 0), 0) || 0;

  if (employeeLoading) {
    return (
      <MainLayout>
        <div className="p-6">Indlæser...</div>
      </MainLayout>
    );
  }

  if (!employee) {
    return (
      <MainLayout>
        <div className="p-6">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                Din bruger er ikke tilknyttet en medarbejderprofil.
              </p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Min vagtplan</h1>
            <p className="text-muted-foreground">
              {employee.first_name} {employee.last_name} - {employee.department || "Ingen afdeling"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setAbsenceType("vacation"); setSelectedDate(new Date()); setAbsenceDialogOpen(true); }}>
              <Umbrella className="h-4 w-4 mr-2" />
              Anmod ferie
            </Button>
            <Button variant="outline" onClick={() => { setAbsenceType("sick"); setSelectedDate(new Date()); setAbsenceDialogOpen(true); }}>
              <Thermometer className="h-4 w-4 mr-2" />
              Meld syg
            </Button>
          </div>
        </div>

        {/* Time Clock */}
        <TimeClock employeeId={employee.id} />

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Timer denne måned</p>
              <p className="text-2xl font-bold">{totalPlannedHours.toFixed(1)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Ugentlig norm</p>
              <p className="text-2xl font-bold">{employee.weekly_hours || 37} timer</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Feriedage brugt ({currentDate.getFullYear()})</p>
              <p className="text-2xl font-bold">{absenceStats?.vacationDays || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Sygedage ({currentDate.getFullYear()})</p>
              <p className="text-2xl font-bold">{absenceStats?.sickDays || 0}</p>
            </CardContent>
          </Card>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            {format(subMonths(currentDate, 1), "MMMM", { locale: da })}
          </Button>
          <h2 className="text-lg font-semibold">
            {format(currentDate, "MMMM yyyy", { locale: da })}
          </h2>
          <Button variant="outline" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
            {format(addMonths(currentDate, 1), "MMMM", { locale: da })}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500/20 border border-green-500/30" />
            <span className="text-muted-foreground">Arbejder</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-amber-500/20 border border-amber-500/30" />
            <span className="text-muted-foreground">Ferie</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500/20 border border-red-500/30" />
            <span className="text-muted-foreground">Syg</span>
          </div>
        </div>

        {/* Calendar Grid */}
        <Card>
          <CardContent className="pt-6">
            {/* Day headers */}
            <div className="grid grid-cols-6 bg-muted/50 border-b rounded-t-lg">
              <div className="p-2 text-xs font-medium text-muted-foreground">Uge</div>
              {["Man", "Tir", "Ons", "Tor", "Fre"].map(day => (
                <div key={day} className="p-2 text-xs font-medium text-center text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar weeks */}
            {calendarWeeks.map((week, weekIndex) => {
              const weekNumber = week.length > 0 ? format(week[0], "w") : "";
              const isCurrentWeek = week.some(day => isToday(day));

              return (
                <div 
                  key={weekIndex} 
                  className={cn(
                    "grid grid-cols-6 border-b last:border-b-0",
                    isCurrentWeek && "bg-primary/5"
                  )}
                >
                  {/* Week number */}
                  <div className="p-2 text-xs text-muted-foreground flex items-center justify-center border-r">
                    {weekNumber}
                  </div>

                  {/* Days */}
                  {week.map(day => {
                    const shift = getShiftForDay(day);
                    const holiday = isHoliday(day);
                    const holidayName = getHolidayName(day);
                    const absence = getAbsenceForDay(day);
                    const isPast = day < new Date() && !isToday(day);

                    // Determine cell style based on status
                    let bgColor = "bg-green-500/15"; // Default: working day
                    let icon = <Briefcase className="h-3 w-3 text-green-600" />;
                    let statusText = workingHours.start.replace(":", ".") + "-" + workingHours.end.replace(":", ".");

                    if (holiday) {
                      bgColor = "bg-destructive/10";
                      icon = <CalendarPlus className="h-3 w-3 text-destructive" />;
                      statusText = holidayName || "Helligdag";
                    } else if (absence) {
                      if (absence.type === "vacation") {
                        bgColor = "bg-amber-500/20";
                        icon = <Palmtree className="h-3 w-3 text-amber-600" />;
                        statusText = absence.status === "pending" ? "Ferie (afventer)" : "Ferie";
                      } else {
                        bgColor = "bg-red-500/20";
                        icon = <Thermometer className="h-3 w-3 text-red-500" />;
                        statusText = absence.status === "pending" ? "Syg (afventer)" : "Syg";
                      }
                    } else if (shift) {
                      statusText = `${shift.start_time.slice(0, 5).replace(":", ".")}-${shift.end_time.slice(0, 5).replace(":", ".")}`;
                    }

                    return (
                      <div 
                        key={day.toISOString()}
                        className={cn(
                          "p-1.5 min-h-[60px] border-r last:border-r-0 transition-colors cursor-pointer hover:opacity-80",
                          bgColor,
                          isPast && "opacity-60"
                        )}
                        onClick={() => !holiday && handleDayClick(day, "vacation")}
                      >
                        <div className="flex flex-col h-full">
                          {/* Date */}
                          <div className={cn(
                            "text-xs font-medium mb-1",
                            isToday(day) && "text-primary font-bold"
                          )}>
                            {format(day, "d.")}
                            {isToday(day) && <span className="ml-1 text-[10px]">(i dag)</span>}
                          </div>

                          {/* Status */}
                          <div className="flex items-center gap-1 flex-1">
                            {icon}
                            <span className="text-[10px] text-muted-foreground truncate">
                              {statusText}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Fill empty cells if week doesn't start on Monday */}
                  {week.length < 5 && Array.from({ length: 5 - week.length }).map((_, i) => (
                    <div key={`empty-${i}`} className="p-1.5 min-h-[60px] border-r last:border-r-0 bg-muted/30" />
                  ))}
                </div>
              );
            })}
          </CardContent>
        </Card>
        
        {/* Working hours info */}
        {employee?.standard_start_time && (
          <p className="text-xs text-muted-foreground">
            Din standardmødetid er <span className="font-medium">{employee.standard_start_time}</span> (mandag-fredag)
          </p>
        )}

        {/* Recent Absence Requests */}
        <Card>
          <CardHeader>
            <CardTitle>Mine anmodninger</CardTitle>
          </CardHeader>
          <CardContent>
            {myAbsences && myAbsences.length > 0 ? (
              <div className="space-y-2">
                {myAbsences.slice(0, 5).map(absence => (
                  <div key={absence.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">
                        {absence.type === "vacation" ? "Ferie" : "Sygdom"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(absence.start_date), "d. MMM", { locale: da })}
                        {absence.start_date !== absence.end_date && ` - ${format(new Date(absence.end_date), "d. MMM", { locale: da })}`}
                      </p>
                      {absence.comment && (
                        <p className="text-xs text-muted-foreground mt-1">{absence.comment}</p>
                      )}
                    </div>
                    <Badge
                      variant={
                        absence.status === "approved" ? "default" :
                        absence.status === "pending" ? "secondary" : "destructive"
                      }
                    >
                      {absence.status === "approved" ? "Godkendt" :
                       absence.status === "pending" ? "Afventer" : "Afvist"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">Ingen anmodninger</p>
            )}
          </CardContent>
        </Card>

        {/* Create Absence Dialog */}
        <CreateAbsenceDialog
          open={absenceDialogOpen}
          onOpenChange={setAbsenceDialogOpen}
          employeeId={employee.id}
          selectedDate={selectedDate}
          defaultType={absenceType}
        />
      </div>
    </MainLayout>
  );
}
