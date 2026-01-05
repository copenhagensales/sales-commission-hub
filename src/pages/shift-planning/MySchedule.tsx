import { useState } from "react";
import { format, startOfMonth, endOfMonth, isToday, isSameDay, addMonths, subMonths, startOfWeek, addDays, addWeeks } from "date-fns";
import { da } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Briefcase, Thermometer, Palmtree, CalendarPlus, Clock } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { useCurrentEmployee, useMyShifts, useDanishHolidays, useAbsenceRequests } from "@/hooks/useShiftPlanning";
import { useTimeStampsForRange } from "@/hooks/useTimeStamps";
import { CreateAbsenceDialog } from "@/components/shift-planning/CreateAbsenceDialog";
import { cn } from "@/lib/utils";
import VagtMinUge from "@/pages/vagt-flow/MinUge";
import { useRolePreview } from "@/contexts/RolePreviewContext";

export default function MySchedule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [absenceDialogOpen, setAbsenceDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { isPreviewMode, previewRole } = useRolePreview();
  
  const { data: employee, isLoading: employeeLoading } = useCurrentEmployee();
  
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  
  // Generate weeks for the month (Mon-Fri only)
  // Each week always has 5 elements (Mon-Fri), with null for days outside current month
  const generateWeeks = () => {
    const weeks: (Date | null)[][] = [];
    let weekStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    
    while (weekStart <= monthEnd) {
      const weekDays: (Date | null)[] = [];
      for (let d = 0; d < 5; d++) { // Only Mon-Fri
        const day = addDays(weekStart, d);
        // Include day if it's in current month, otherwise null
        if (day.getMonth() === currentDate.getMonth()) {
          weekDays.push(day);
        } else {
          weekDays.push(null);
        }
      }
      // Only add week if it has at least one day from current month
      if (weekDays.some(d => d !== null)) {
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
  
  // Get time stamps for the month
  const { data: timeStamps } = useTimeStampsForRange(
    employee?.id,
    format(monthStart, "yyyy-MM-dd"),
    format(monthEnd, "yyyy-MM-dd")
  );

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
  
  // Get time stamp for a specific day
  const getTimeStampForDay = (date: Date) => {
    return timeStamps?.find(ts => {
      const stampDate = new Date(ts.clock_in);
      return isSameDay(stampDate, date);
    });
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setAbsenceDialogOpen(true);
  };

  if (employeeLoading) {
    return (
      <MainLayout>
        <div className="p-6">Indlæser...</div>
      </MainLayout>
    );
  }

  // If employee is Fieldmarketing (or previewing Fieldmarketing role), show the vagt-flow calendar instead
  const isFieldmarketing = employee?.job_title === "Fieldmarketing" || 
    (isPreviewMode && previewRole === "Fieldmarketing");
  
  if (isFieldmarketing) {
    return <VagtMinUge />;
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
            <h1 className="text-3xl font-bold">Min kalender</h1>
            <p className="text-muted-foreground">Se dine vagter og anmod om ferie</p>
          </div>
          <Button 
            size="lg"
            className="bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-200 font-semibold"
            onClick={() => { setSelectedDate(new Date()); setAbsenceDialogOpen(true); }}
          >
            <Palmtree className="h-5 w-5 mr-2" />
            Anmod ferie
          </Button>
        </div>

        <div className="space-y-4">
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
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-blue-600" />
                <span className="text-muted-foreground">Stemplet</span>
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
                  // Find first non-null day for week number
                  const firstDay = week.find(d => d !== null);
                  const weekNumber = firstDay ? format(firstDay, "w") : "";
                  const isCurrentWeek = week.some(day => day && isToday(day));

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

                      {/* Days - always 5 cells (Mon-Fri) */}
                      {week.map((day, dayIndex) => {
                        // Empty cell for days not in this month
                        if (!day) {
                          return (
                            <div 
                              key={`empty-${dayIndex}`} 
                              className="p-1.5 min-h-[56px] border-r last:border-r-0 bg-muted/30" 
                            />
                          );
                        }

                        const shift = getShiftForDay(day);
                        const holiday = isHoliday(day);
                        const holidayName = getHolidayName(day);
                        const absence = getAbsenceForDay(day);
                        const timeStamp = getTimeStampForDay(day);
                        const isPast = day < new Date() && !isToday(day);

                        // Determine cell style based on status
                        let bgColor = "bg-green-500/15"; // Default: working day
                        let icon = <Briefcase className="h-3 w-3 text-green-600" />;
                        let statusText = workingHours.start.replace(":", ".") + "-" + workingHours.end.replace(":", ".");
                        let timeStampInfo: React.ReactNode = null;

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
                        
                        // Show time stamp info if available
                        if (timeStamp && !holiday && !absence) {
                          const clockIn = format(new Date(timeStamp.clock_in), "HH:mm");
                          const clockOut = timeStamp.clock_out 
                            ? format(new Date(timeStamp.clock_out), "HH:mm") 
                            : "...";
                          const effectiveHours = timeStamp.effective_hours ?? null;
                          
                          // Calculate daily pay if we have effective hours and salary amount
                          // Only show for hourly employees, not fixed salary
                          const isFixedSalary = employee?.salary_type === 'fixed';
                          const hourlyRate = employee?.salary_amount || 0;
                          const dailyPay = !isFixedSalary && effectiveHours != null && hourlyRate > 0 
                            ? effectiveHours * hourlyRate 
                            : null;
                          
                          timeStampInfo = (
                            <div className="mt-0.5 space-y-0.5">
                              <div className="text-[9px] text-blue-600 flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5" />
                                <span>{clockIn}-{clockOut}</span>
                                {effectiveHours != null && (
                                  <span className="text-muted-foreground ml-0.5">
                                    ({effectiveHours.toFixed(1)}t)
                                  </span>
                                )}
                              </div>
                              {dailyPay != null && timeStamp.clock_out && (
                                <div className="text-[9px] text-green-600 font-medium">
                                  💰 {dailyPay.toFixed(0)} kr
                                </div>
                              )}
                            </div>
                          );
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
                              <div className="flex items-center gap-1">
                                {icon}
                                <span className="text-[10px] text-muted-foreground truncate">
                                  {statusText}
                                </span>
                              </div>
                              
                              {/* Time stamp info */}
                              {timeStampInfo}
                            </div>
                          </div>
                        );
                      })}
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
        </div>

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