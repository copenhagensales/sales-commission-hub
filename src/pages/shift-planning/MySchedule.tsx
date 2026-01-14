import { useState, useCallback } from "react";
import { format, startOfMonth, endOfMonth, isToday, isSameDay, addMonths, subMonths, startOfWeek, addDays, addWeeks, getDay } from "date-fns";
import { da } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Briefcase, Thermometer, Palmtree, CalendarPlus, Clock, AlarmClock, UserX, CalendarX2 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { useCurrentEmployee, useMyShifts, useDanishHolidays, useAbsenceRequests, useAbsencesForDateRange } from "@/hooks/useShiftPlanning";
import { useTimeStampsForRange } from "@/hooks/useTimeStamps";
import { CreateAbsenceDialog } from "@/components/shift-planning/CreateAbsenceDialog";
import { PendingAbsencesList } from "@/components/shift-planning/PendingAbsencesList";
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
  const generateWeeks = () => {
    const weeks: (Date | null)[][] = [];
    let weekStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    
    while (weekStart <= monthEnd) {
      const weekDays: (Date | null)[] = [];
      for (let d = 0; d < 5; d++) {
        const day = addDays(weekStart, d);
        if (day.getMonth() === currentDate.getMonth()) {
          weekDays.push(day);
        } else {
          weekDays.push(null);
        }
      }
      if (weekDays.some(d => d !== null)) {
        weeks.push(weekDays);
      }
      weekStart = addWeeks(weekStart, 1);
    }
    return weeks;
  };
  
  const calendarWeeks = generateWeeks();

  const { data: shifts } = useMyShifts(
    employee?.id,
    format(monthStart, "yyyy-MM-dd"),
    format(monthEnd, "yyyy-MM-dd")
  );
  const { data: holidays } = useDanishHolidays(currentDate.getFullYear());
  const { data: myAbsences } = useAbsenceRequests(undefined, employee?.id);
  
  // Fetch APPROVED absences only (same as ShiftOverview)
  const { data: approvedAbsences } = useAbsencesForDateRange(
    format(monthStart, "yyyy-MM-dd"),
    format(monthEnd, "yyyy-MM-dd")
  );
  
  // Get time stamps for the month
  const { data: timeStamps } = useTimeStampsForRange(
    employee?.id,
    format(monthStart, "yyyy-MM-dd"),
    format(monthEnd, "yyyy-MM-dd")
  );

  // Fetch team membership for this employee
  const { data: myTeamMembership } = useQuery({
    queryKey: ["my-team-membership", employee?.id],
    queryFn: async () => {
      if (!employee?.id) return null;
      const { data, error } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("employee_id", employee.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!employee?.id,
  });

  // Fetch primary shift for my team with day configurations
  const { data: primaryShiftData } = useQuery({
    queryKey: ["my-primary-shift", myTeamMembership?.team_id],
    queryFn: async () => {
      if (!myTeamMembership?.team_id) return null;
      
      const { data: shift, error } = await supabase
        .from("team_standard_shifts")
        .select("id, team_id, name, start_time, end_time, hours_source")
        .eq("team_id", myTeamMembership.team_id)
        .eq("is_active", true)
        .maybeSingle();
      
      if (error) throw error;
      if (!shift) return null;

      const { data: days } = await supabase
        .from("team_standard_shift_days")
        .select("day_of_week, start_time, end_time")
        .eq("shift_id", shift.id);

      return { shift, days: days || [] };
    },
    enabled: !!myTeamMembership?.team_id,
  });

  // Fetch employee special shift assignment (overrides team primary)
  const { data: employeeSpecialShift } = useQuery({
    queryKey: ["my-special-shift", employee?.id],
    queryFn: async () => {
      if (!employee?.id) return null;
      const { data, error } = await supabase
        .from("employee_standard_shifts")
        .select(`
          employee_id,
          shift_id,
          team_standard_shifts (id, hours_source, start_time, end_time)
        `)
        .eq("employee_id", employee.id)
        .maybeSingle();
      
      if (error && error.code !== "PGRST116") throw error;
      if (!data) return null;
      
      // Fetch day configs for special shift
      const { data: days } = await supabase
        .from("team_standard_shift_days")
        .select("day_of_week, start_time, end_time")
        .eq("shift_id", data.shift_id);
        
      return { ...data, shiftDays: days || [] };
    },
    enabled: !!employee?.id,
  });

  // Fetch lateness records
  const { data: latenessRecords } = useQuery({
    queryKey: ["my-lateness", employee?.id, format(monthStart, "yyyy-MM-dd"), format(monthEnd, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!employee?.id) return [];
      const { data, error } = await supabase
        .from("lateness_record")
        .select("*")
        .eq("employee_id", employee.id)
        .gte("date", format(monthStart, "yyyy-MM-dd"))
        .lte("date", format(monthEnd, "yyyy-MM-dd"));
      if (error) throw error;
      return data;
    },
    enabled: !!employee?.id,
  });

  // Get work times for a specific day using the same hierarchy as ShiftOverview
  const getWorkTimesForDay = useCallback((date: Date): string | null => {
    if (!employee?.id) return null;

    const jsDay = getDay(date);
    const dbDayOfWeek = jsDay === 0 ? 7 : jsDay;

    // 1. Check special shift first (employee-specific override)
    if (employeeSpecialShift) {
      const specialDays = employeeSpecialShift.shiftDays || [];
      if (specialDays.length === 0) return null;
      
      const dayConfig = specialDays.find((d: { day_of_week: number }) => d.day_of_week === dbDayOfWeek);
      if (dayConfig) {
        return `${dayConfig.start_time.slice(0,5)}-${dayConfig.end_time.slice(0,5)}`;
      }
      return null;
    }

    // 2. Fallback to team primary shift
    if (!primaryShiftData?.shift) return null;

    const dayConfig = primaryShiftData.days.find(
      (d: { day_of_week: number }) => d.day_of_week === dbDayOfWeek
    );

    if (dayConfig) {
      return `${dayConfig.start_time.slice(0,5)}-${dayConfig.end_time.slice(0,5)}`;
    }

    // No weekend fallback
    if (dbDayOfWeek === 6 || dbDayOfWeek === 7) return null;

    // Weekday fallback to main shift times
    return `${primaryShiftData.shift.start_time.slice(0,5)}-${primaryShiftData.shift.end_time.slice(0,5)}`;
  }, [employee?.id, primaryShiftData, employeeSpecialShift]);

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

  const getApprovedAbsenceForDay = (date: Date) => {
    return approvedAbsences?.filter(a => a.employee_id === employee?.id).find(a => {
      const start = new Date(a.start_date);
      const end = new Date(a.end_date);
      return date >= start && date <= end;
    }) || null;
  };

  const getLatenessForDay = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return latenessRecords?.find(r => r.date === dateStr) || null;
  };
  
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

  // Pending absences for "Mine anmodninger" section
  const pendingAbsences = myAbsences?.filter(a => a.status === "pending") || [];

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
                <div className="w-3 h-3 rounded bg-orange-500/20 border border-orange-500/30" />
                <span className="text-muted-foreground">Forsinket</span>
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

                      {/* Days */}
                      {week.map((day, dayIndex) => {
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
                        const approvedAbsence = getApprovedAbsenceForDay(day);
                        const lateness = getLatenessForDay(day);
                        const timeStamp = getTimeStampForDay(day);
                        const workTimes = getWorkTimesForDay(day);
                        const isPast = day < new Date() && !isToday(day);

                        // Determine cell style using same hierarchy as ShiftOverview
                        let bgColor = "";
                        let icon = null;
                        let statusText = "";
                        let timeStampInfo: React.ReactNode = null;

                        if (holiday) {
                          bgColor = "bg-destructive/10";
                          icon = <CalendarPlus className="h-3 w-3 text-destructive" />;
                          statusText = holidayName || "Helligdag";
                        } else if (approvedAbsence) {
                          if (approvedAbsence.type === "vacation") {
                            bgColor = "bg-amber-500/20";
                            icon = <Palmtree className="h-3 w-3 text-amber-600" />;
                            statusText = "Ferie";
                          } else if (approvedAbsence.type === "sick") {
                            bgColor = "bg-red-500/20";
                            icon = <Thermometer className="h-3 w-3 text-red-500" />;
                            statusText = "Syg";
                          } else if (approvedAbsence.type === "day_off") {
                            bgColor = "bg-blue-500/20";
                            icon = <CalendarX2 className="h-3 w-3 text-blue-600" />;
                            statusText = "Fridag";
                          } else if (approvedAbsence.type === "no_show") {
                            bgColor = "bg-gray-500/20";
                            icon = <UserX className="h-3 w-3 text-gray-600" />;
                            statusText = "Udeblivelse";
                          }
                        } else if (lateness) {
                          bgColor = "bg-orange-500/15";
                          icon = <AlarmClock className="h-3 w-3 text-orange-600" />;
                          const newTime = lateness.new_start_time?.slice(0,5) || "";
                          const endTime = workTimes?.split('-')[1] || "";
                          statusText = newTime && endTime ? `${newTime}-${endTime}` : `+${lateness.minutes} min`;
                        } else if (shift) {
                          // Individual shift exception
                          bgColor = "bg-green-500/15";
                          icon = <Briefcase className="h-3 w-3 text-green-600" />;
                          statusText = `${shift.start_time.slice(0, 5)}-${shift.end_time.slice(0, 5)}`;
                        } else if (workTimes) {
                          // Standard shift from hierarchy
                          bgColor = "bg-green-500/15";
                          icon = <Briefcase className="h-3 w-3 text-green-600" />;
                          statusText = workTimes;
                        } else {
                          // No shift configured for this day
                          bgColor = "bg-muted/30";
                          statusText = "";
                        }
                        
                        // Show time stamp info if available
                        if (timeStamp && !holiday && !approvedAbsence) {
                          const clockIn = format(new Date(timeStamp.clock_in), "HH:mm");
                          const clockOut = timeStamp.clock_out 
                            ? format(new Date(timeStamp.clock_out), "HH:mm") 
                            : "...";
                          const effectiveHours = timeStamp.effective_hours ?? null;
                          
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
                            onClick={() => !holiday && !approvedAbsence && handleDayClick(day)}
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
                              {(icon || statusText) && (
                                <div className="flex items-center gap-1">
                                  {icon}
                                  <span className="text-[10px] text-muted-foreground truncate">
                                    {statusText}
                                  </span>
                                </div>
                              )}
                              
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

            {/* Pending Absence Requests with Edit/Delete */}
            <PendingAbsencesList absences={pendingAbsences} />
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
