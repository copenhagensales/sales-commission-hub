import { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, addMonths, subMonths } from "date-fns";
import { da } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock, CalendarPlus, Thermometer, Umbrella } from "lucide-react";
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
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

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

        {/* Calendar Grid */}
        <Card>
          <CardContent className="pt-6">
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"].map(day => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells for days before month starts */}
              {Array.from({ length: (monthStart.getDay() + 6) % 7 }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[100px]" />
              ))}
              
              {monthDays.map(day => {
                const shift = getShiftForDay(day);
                const holiday = isHoliday(day);
                const holidayName = getHolidayName(day);
                const absence = getAbsenceForDay(day);
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "min-h-[100px] border border-border rounded-lg p-2 transition-colors",
                      isToday(day) && "ring-2 ring-primary",
                      holiday && "bg-destructive/10",
                      isWeekend && !holiday && "bg-muted/50"
                    )}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={cn(
                        "text-sm font-medium",
                        isToday(day) && "text-primary"
                      )}>
                        {format(day, "d")}
                      </span>
                      {!holiday && !isWeekend && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => handleDayClick(day, "vacation")}
                        >
                          <CalendarPlus className="h-3 w-3" />
                        </Button>
                      )}
                    </div>

                    {holiday && (
                      <Badge variant="destructive" className="text-[10px] mb-1">
                        {holidayName}
                      </Badge>
                    )}

                    {absence && (
                      <Badge
                        variant={absence.status === "approved" ? "default" : absence.status === "pending" ? "secondary" : "destructive"}
                        className="text-[10px] mb-1"
                      >
                        {absence.type === "vacation" ? "Ferie" : "Syg"}
                        {absence.status === "pending" && " (afventer)"}
                      </Badge>
                    )}

                    {shift && !absence && (
                      <div className="bg-primary/10 rounded p-1 text-xs">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}</span>
                        </div>
                        <p className="text-muted-foreground">{shift.planned_hours?.toFixed(1)}t</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

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
