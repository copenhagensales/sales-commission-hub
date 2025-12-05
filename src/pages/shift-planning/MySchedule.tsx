import { useState } from "react";
import { format, startOfMonth, endOfMonth, isToday, isSameDay, addMonths, subMonths, startOfWeek, addDays, addWeeks } from "date-fns";
import { da } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Briefcase, Thermometer, Palmtree, CalendarPlus, User, MapPin, Wallet, Car, Clock, Umbrella } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentEmployee, useMyShifts, useDanishHolidays, useAbsenceRequests } from "@/hooks/useShiftPlanning";
import { CreateAbsenceDialog } from "@/components/shift-planning/CreateAbsenceDialog";
import { cn } from "@/lib/utils";

export default function MySchedule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [absenceDialogOpen, setAbsenceDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

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

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setAbsenceDialogOpen(true);
  };

  const formatSalaryType = (type: string | null) => {
    if (!type) return "-";
    const map: Record<string, string> = {
      provision: "Provision",
      fixed: "Fast løn",
      hourly: "Timeløn"
    };
    return map[type] || type;
  };

  const formatVacationType = (type: string | null) => {
    if (!type) return "-";
    const map: Record<string, string> = {
      vacation_pay: "Ferieløn",
      vacation_bonus: "1% ferietillæg"
    };
    return map[type] || type;
  };

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
              {employee.first_name} {employee.last_name}
            </p>
          </div>
          <Button variant="outline" onClick={() => { setSelectedDate(new Date()); setAbsenceDialogOpen(true); }}>
            <Umbrella className="h-4 w-4 mr-2" />
            Anmod ferie
          </Button>
        </div>

        <Tabs defaultValue="kalender" className="w-full">
          <TabsList>
            <TabsTrigger value="kalender">Kalender</TabsTrigger>
            <TabsTrigger value="stamkort">Mit stamkort</TabsTrigger>
          </TabsList>

          <TabsContent value="kalender" className="mt-4 space-y-4">
            {/* Month Navigation */}
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                {format(subMonths(currentDate, 1), "MMM", { locale: da })}
              </Button>
              <h2 className="text-lg font-semibold">
                {format(currentDate, "MMMM yyyy", { locale: da })}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                {format(addMonths(currentDate, 1), "MMM", { locale: da })}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-green-500/20 border border-green-500/30" />
                <span className="text-muted-foreground">Arbejder</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/30" />
                <span className="text-muted-foreground">Ferie</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-red-500/20 border border-red-500/30" />
                <span className="text-muted-foreground">Syg</span>
              </div>
            </div>

            {/* Calendar Grid */}
            <Card>
              <CardContent className="pt-4 pb-2">
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
                              "p-1.5 min-h-[56px] border-r last:border-r-0 transition-colors cursor-pointer hover:opacity-80",
                              bgColor,
                              isPast && "opacity-60"
                            )}
                            onClick={() => !holiday && !absence && handleDayClick(day)}
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
                        <div key={`empty-${i}`} className="p-1.5 min-h-[56px] border-r last:border-r-0 bg-muted/30" />
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
            {myAbsences && myAbsences.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Mine anmodninger</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {myAbsences.slice(0, 3).map(absence => (
                      <div key={absence.id} className="flex items-center justify-between p-2 border rounded-lg text-sm">
                        <div>
                          <p className="font-medium">
                            {absence.type === "vacation" ? "Ferie" : "Sygdom"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(absence.start_date), "d. MMM", { locale: da })}
                            {absence.start_date !== absence.end_date && ` - ${format(new Date(absence.end_date), "d. MMM", { locale: da })}`}
                          </p>
                        </div>
                        <Badge
                          variant={
                            absence.status === "approved" ? "default" :
                            absence.status === "pending" ? "secondary" : "destructive"
                          }
                          className="text-xs"
                        >
                          {absence.status === "approved" ? "Godkendt" :
                           absence.status === "pending" ? "Afventer" : "Afvist"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="stamkort" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Identitet */}
              <Card>
                <CardHeader className="flex flex-row items-center gap-2 pb-2">
                  <User className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">Identitet</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Navn</span>
                    <span className="font-medium">{employee.first_name} {employee.last_name}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Stilling</span>
                    <span className="font-medium">{employee.job_title || "-"}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Afdeling</span>
                    <span className="font-medium">{employee.department || "-"}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Kontakt */}
              <Card>
                <CardHeader className="flex flex-row items-center gap-2 pb-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">Kontakt</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Telefon</span>
                    <span className="font-medium">{employee.private_phone || "-"}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-medium truncate max-w-[180px]">{employee.private_email || "-"}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Arbejdssted</span>
                    <span className="font-medium">{employee.work_location || "-"}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Løn */}
              <Card>
                <CardHeader className="flex flex-row items-center gap-2 pb-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">Løn</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Løntype</span>
                    <span className="font-medium">{formatSalaryType(employee.salary_type)}</span>
                  </div>
                  {employee.salary_amount && (
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">Beløb</span>
                      <span className="font-medium">{employee.salary_amount.toLocaleString("da-DK")} kr.</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Ferietype</span>
                    <span className="font-medium">{formatVacationType(employee.vacation_type)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Arbejdstid */}
              <Card>
                <CardHeader className="flex flex-row items-center gap-2 pb-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">Arbejdstid</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Timer/uge</span>
                    <span className="font-medium">{employee.weekly_hours || 37} timer</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Mødetid</span>
                    <span className="font-medium">{employee.standard_start_time || "-"}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Parkering */}
              {employee.has_parking && (
                <Card>
                  <CardHeader className="flex flex-row items-center gap-2 pb-2">
                    <Car className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Parkering</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">P-plads</span>
                      <span className="font-medium">{employee.parking_spot_id || "Tildelt"}</span>
                    </div>
                    {employee.parking_monthly_cost && (
                      <div className="flex justify-between py-1">
                        <span className="text-muted-foreground">Pris/md.</span>
                        <span className="font-medium">{employee.parking_monthly_cost} kr.</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Create Absence Dialog - only vacation */}
        <CreateAbsenceDialog
          open={absenceDialogOpen}
          onOpenChange={setAbsenceDialogOpen}
          employeeId={employee.id}
          selectedDate={selectedDate}
          defaultType="vacation"
        />
      </div>
    </MainLayout>
  );
}
