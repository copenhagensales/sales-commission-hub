import { useState, useCallback } from "react";
import { format, startOfMonth, endOfMonth, isToday, isSameDay, addMonths, subMonths, startOfWeek, addDays, addWeeks, getDay } from "date-fns";
import { da } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Briefcase, Thermometer, Palmtree, Clock, AlarmClock, UserX, CalendarX2, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyShifts, useDanishHolidays, useAbsenceRequests, useAbsencesForDateRange } from "@/hooks/useShiftPlanning";
import { useTimeStampsForRange } from "@/hooks/useTimeStamps";
import { CreateAbsenceDialog } from "@/components/shift-planning/CreateAbsenceDialog";
import { PendingAbsencesList } from "@/components/shift-planning/PendingAbsencesList";
import { cn } from "@/lib/utils";

interface MyScheduleTabContentProps {
  employeeId: string;
  salaryType?: string | null;
  salaryAmount?: number | null;
}

export function MyScheduleTabContent({ employeeId, salaryType, salaryAmount }: MyScheduleTabContentProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [absenceDialogOpen, setAbsenceDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
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
    employeeId,
    format(monthStart, "yyyy-MM-dd"),
    format(monthEnd, "yyyy-MM-dd")
  );
  const { data: holidays } = useDanishHolidays(currentDate.getFullYear());
  const { data: myAbsences } = useAbsenceRequests(undefined, employeeId);
  
  const { data: approvedAbsences } = useAbsencesForDateRange(
    format(monthStart, "yyyy-MM-dd"),
    format(monthEnd, "yyyy-MM-dd")
  );
  
  const { data: timeStamps } = useTimeStampsForRange(
    employeeId,
    format(monthStart, "yyyy-MM-dd"),
    format(monthEnd, "yyyy-MM-dd")
  );

  // Fetch team membership for this employee
  const { data: myTeamMembership } = useQuery({
    queryKey: ["my-team-membership", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("employee_id", employeeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
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

  // Fetch employee special shift assignment
  const { data: employeeSpecialShift } = useQuery({
    queryKey: ["my-special-shift", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_standard_shifts")
        .select(`
          employee_id,
          shift_id,
          team_standard_shifts (id, hours_source, start_time, end_time)
        `)
        .eq("employee_id", employeeId)
        .maybeSingle();
      
      if (error && error.code !== "PGRST116") throw error;
      if (!data) return null;
      
      const { data: days } = await supabase
        .from("team_standard_shift_days")
        .select("day_of_week, start_time, end_time")
        .eq("shift_id", data.shift_id);
        
      return { ...data, shiftDays: days || [] };
    },
  });

  // Fetch lateness records
  const { data: latenessRecords } = useQuery({
    queryKey: ["my-lateness", employeeId, format(monthStart, "yyyy-MM-dd"), format(monthEnd, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lateness_record")
        .select("*")
        .eq("employee_id", employeeId)
        .gte("date", format(monthStart, "yyyy-MM-dd"))
        .lte("date", format(monthEnd, "yyyy-MM-dd"));
      if (error) throw error;
      return data;
    },
  });

  const getWorkTimesForDay = useCallback((date: Date): string | null => {
    const jsDay = getDay(date);
    const dbDayOfWeek = jsDay === 0 ? 7 : jsDay;

    if (employeeSpecialShift) {
      const specialDays = employeeSpecialShift.shiftDays || [];
      if (specialDays.length === 0) return null;
      
      const dayConfig = specialDays.find((d: { day_of_week: number }) => d.day_of_week === dbDayOfWeek);
      if (dayConfig) {
        return `${dayConfig.start_time.slice(0,5)}-${dayConfig.end_time.slice(0,5)}`;
      }
      return null;
    }

    if (!primaryShiftData?.shift) return null;

    // Skip if the primary shift has zero times (e.g. "Deltid" placeholder)
    const shiftStart = primaryShiftData.shift.start_time.slice(0,5);
    const shiftEnd = primaryShiftData.shift.end_time.slice(0,5);
    if (shiftStart === '00:00' && shiftEnd === '00:00') return null;

    const dayConfig = primaryShiftData.days.find(
      (d: { day_of_week: number }) => d.day_of_week === dbDayOfWeek
    );

    if (dayConfig) {
      return `${dayConfig.start_time.slice(0,5)}-${dayConfig.end_time.slice(0,5)}`;
    }

    if (dbDayOfWeek === 6 || dbDayOfWeek === 7) return null;

    return `${shiftStart}-${shiftEnd}`;
  }, [primaryShiftData, employeeSpecialShift]);

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
    return approvedAbsences?.filter(a => a.employee_id === employeeId).find(a => {
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

  const pendingAbsences = myAbsences?.filter(a => a.status === "pending") || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold">Min kalender</h2>
          <p className="text-sm text-muted-foreground">Se dine vagter og anmod om ferie</p>
        </div>
        <Button 
          size="sm"
          className="bg-amber-500 hover:bg-amber-600 text-white"
          onClick={() => { setSelectedDate(new Date()); setAbsenceDialogOpen(true); }}
        >
          <Palmtree className="h-4 w-4 mr-2" />
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
          <h3 className="text-lg font-semibold">
            {format(currentDate, "MMMM yyyy", { locale: da })}
          </h3>
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
                      bgColor = "bg-green-500/15";
                      icon = <Briefcase className="h-3 w-3 text-green-600" />;
                      statusText = `${shift.start_time.slice(0, 5)}-${shift.end_time.slice(0, 5)}`;
                    } else if (workTimes) {
                      bgColor = "bg-green-500/15";
                      icon = <Briefcase className="h-3 w-3 text-green-600" />;
                      statusText = workTimes;
                    } else {
                      bgColor = "bg-muted/30";
                      statusText = "";
                    }
                    
                    if (timeStamp && !holiday && !approvedAbsence) {
                      const clockIn = format(new Date(timeStamp.clock_in), "HH:mm");
                      const clockOut = timeStamp.clock_out 
                        ? format(new Date(timeStamp.clock_out), "HH:mm") 
                        : "...";
                      const effectiveHours = timeStamp.effective_hours ?? null;
                      
                      const isFixedSalary = salaryType === 'fixed';
                      const hourlyRate = salaryAmount || 0;
                      
                      timeStampInfo = (
                        <div className="mt-1 text-[10px] text-blue-600 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          <span>{clockIn}-{clockOut}</span>
                          {effectiveHours !== null && isFixedSalary && hourlyRate > 0 && (
                            <span className="text-green-600 font-medium ml-1">
                              +{Math.round(effectiveHours * hourlyRate)} kr
                            </span>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div
                        key={format(day, "yyyy-MM-dd")}
                        onClick={() => handleDayClick(day)}
                        className={cn(
                          "p-1.5 min-h-[56px] border-r last:border-r-0 cursor-pointer hover:bg-muted/50 transition-colors",
                          bgColor,
                          isToday(day) && "ring-2 ring-primary ring-inset"
                        )}
                      >
                        <div className="flex flex-col h-full">
                          <span className={cn(
                            "text-xs font-medium",
                            isToday(day) && "text-primary"
                          )}>
                            {format(day, "d")}
                          </span>
                          <div className="flex items-center gap-1 mt-auto">
                            {icon}
                            <span className="text-[10px] text-muted-foreground truncate">
                              {statusText}
                            </span>
                          </div>
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
      </div>

      {/* Pending absences */}
      {pendingAbsences.length > 0 && (
        <PendingAbsencesList absences={pendingAbsences} />
      )}

      {/* Absence dialog */}
      <CreateAbsenceDialog
        open={absenceDialogOpen}
        onOpenChange={setAbsenceDialogOpen}
        employeeId={employeeId}
        selectedDate={selectedDate}
        defaultType="vacation"
      />
    </div>
  );
}
