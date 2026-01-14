import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isToday, isSameDay, parseISO, isWithinInterval, getDay } from "date-fns";
import { da } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Users, Clock, Palmtree, Thermometer, CalendarDays, Coins, Eye, EyeOff, Umbrella } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useShifts, useEmployeesForShifts, useDanishHolidays, useAbsencesForDateRange, usePendingVacationRequests, Shift, AbsenceRequest } from "@/hooks/useShiftPlanning";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface LatenessRecord {
  id: string;
  employee_id: string;
  date: string;
  minutes: number;
  note: string | null;
  new_start_time: string | null;
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

export default function VagtplanFMContent() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showWeekend, setShowWeekend] = useState(false);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd }).filter(
    day => day.getDay() !== 0 && day.getDay() !== 6
  );
  
  const displayDays = showWeekend 
    ? eachDayOfInterval({ start: weekStart, end: weekEnd })
    : weekDays;

  // Get Fieldmarketing team ID
  const { data: fieldmarketingTeam } = useQuery({
    queryKey: ["fieldmarketing-team-id"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name")
        .ilike("name", "Fieldmarketing")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const fieldmarketingTeamId = fieldmarketingTeam?.id;

  // Fetch employees for Fieldmarketing team only
  const { data: fmEmployees } = useQuery({
    queryKey: ["fm-shift-employees", fieldmarketingTeamId],
    queryFn: async () => {
      if (!fieldmarketingTeamId) return [];
      
      const { data, error } = await supabase
        .from("team_members")
        .select(`
          employee_id,
          employee:employee_id(
            id,
            first_name,
            last_name,
            department,
            salary_type,
            salary_amount,
            standard_start_time,
            is_active
          )
        `)
        .eq("team_id", fieldmarketingTeamId);

      if (error) throw error;
      
      return (data || [])
        .filter(tm => tm.employee && tm.employee.is_active)
        .map(tm => ({
          id: tm.employee.id,
          first_name: tm.employee.first_name,
          last_name: tm.employee.last_name,
          department: tm.employee.department,
          salary_type: tm.employee.salary_type,
          salary_amount: tm.employee.salary_amount,
          standard_start_time: tm.employee.standard_start_time,
        }));
    },
    enabled: !!fieldmarketingTeamId,
  });

  const { data: shifts } = useShifts(
    format(weekStart, "yyyy-MM-dd"),
    format(weekEnd, "yyyy-MM-dd"),
    fieldmarketingTeamId || "none"
  );
  const { data: holidays } = useDanishHolidays(currentDate.getFullYear());
  const { data: absences } = useAbsencesForDateRange(
    format(weekStart, "yyyy-MM-dd"),
    format(weekEnd, "yyyy-MM-dd")
  );
  const { data: pendingVacations } = usePendingVacationRequests(
    format(weekStart, "yyyy-MM-dd"),
    format(weekEnd, "yyyy-MM-dd")
  );

  // Fetch lateness records for the week
  const { data: latenessRecords } = useQuery({
    queryKey: ["lateness-records-fm", format(weekStart, "yyyy-MM-dd"), format(weekEnd, "yyyy-MM-dd")],
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
    queryKey: ["time-stamps-fm", format(weekStart, "yyyy-MM-dd"), format(weekEnd, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_stamps")
        .select("*")
        .gte("clock_in", `${format(weekStart, "yyyy-MM-dd")}T00:00:00`)
        .lte("clock_in", `${format(weekEnd, "yyyy-MM-dd")}T23:59:59`);
      if (error) throw error;
      return data as TimeStampData[];
    },
  });

  // Fetch primary shifts with their day configurations
  const { data: primaryShiftsData } = useQuery({
    queryKey: ["primary-shifts-fm", fieldmarketingTeamId],
    queryFn: async () => {
      if (!fieldmarketingTeamId) return { shifts: [], days: [] };
      
      const { data: shiftData, error } = await supabase
        .from("team_standard_shifts")
        .select("id, team_id, name, start_time, end_time, hours_source")
        .eq("team_id", fieldmarketingTeamId)
        .eq("is_active", true);
      if (error) throw error;
      if (!shiftData || shiftData.length === 0) return { shifts: [], days: [] };

      const shiftIds = shiftData.map(s => s.id);
      const { data: days, error: daysError } = await supabase
        .from("team_standard_shift_days")
        .select("shift_id, day_of_week, start_time, end_time")
        .in("shift_id", shiftIds);
      if (daysError) throw daysError;

      return { 
        shifts: shiftData as { id: string; team_id: string; name: string; start_time: string; end_time: string; hours_source: 'timestamp' | 'shift' }[],
        days: (days || []) as { shift_id: string; day_of_week: number; start_time: string; end_time: string }[]
      };
    },
    enabled: !!fieldmarketingTeamId,
  });

  // Fetch paid bonuses
  const { data: paidBonuses } = useQuery({
    queryKey: ["daily-bonus-payouts-fm"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_bonus_payouts")
        .select("employee_id, date, amount");
      if (error) throw error;
      return data as { employee_id: string; date: string; amount: number }[];
    },
  });

  // Fetch employee special shift assignments (employee_standard_shifts)
  const { data: employeeSpecialShifts } = useQuery({
    queryKey: ["employee-special-shifts-fm"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_standard_shifts")
        .select(`
          employee_id,
          shift_id,
          team_standard_shifts (
            id, hours_source, start_time, end_time
          )
        `);
      if (error) throw error;
      
      // Get all unique shift IDs and fetch day configurations
      const shiftIds = [...new Set(data?.map(d => d.shift_id) || [])];
      let shiftDaysMap: Record<string, { day_of_week: number; start_time: string; end_time: string }[]> = {};
      if (shiftIds.length > 0) {
        const { data: days } = await supabase
          .from("team_standard_shift_days")
          .select("shift_id, day_of_week, start_time, end_time")
          .in("shift_id", shiftIds);
        // Group by shift_id
        (days || []).forEach(d => {
          if (!shiftDaysMap[d.shift_id]) shiftDaysMap[d.shift_id] = [];
          shiftDaysMap[d.shift_id].push(d);
        });
      }
      
      return { assignments: data, shiftDays: shiftDaysMap };
    },
  });

  // Helper to get work times from primary shift (respects special shift hierarchy)
  const getWorkTimesForEmployeeAndDay = useCallback((employeeId: string, date: Date): string | null => {
    const jsDay = getDay(date);
    const dbDayOfWeek = jsDay === 0 ? 7 : jsDay;

    // 1. FIRST: Check if employee has a special shift assigned
    const specialShiftAssignment = employeeSpecialShifts?.assignments?.find(
      s => s.employee_id === employeeId
    );
    if (specialShiftAssignment) {
      const specialShiftDays = employeeSpecialShifts?.shiftDays?.[specialShiftAssignment.shift_id] || [];
      
      // If special shift has NO days configured, employee gets 0 shifts ("Ingen vagter")
      if (specialShiftDays.length === 0) {
        return null;
      }
      
      // Check if this day is configured for the special shift
      const dayConfig = specialShiftDays.find(d => d.day_of_week === dbDayOfWeek);
      if (dayConfig) {
        return `${dayConfig.start_time.slice(0, 5)}-${dayConfig.end_time.slice(0, 5)}`;
      }
      
      // Day not configured in special shift = no shift for this day
      return null;
    }

    // 2. FALLBACK: Use team's primary shift
    if (!primaryShiftsData || primaryShiftsData.shifts.length === 0) return null;

    const primaryShift = primaryShiftsData.shifts[0];
    if (!primaryShift) return null;

    const dayConfig = primaryShiftsData.days.find(
      d => d.shift_id === primaryShift.id && d.day_of_week === dbDayOfWeek
    );

    if (dayConfig) {
      const start = dayConfig.start_time.slice(0, 5);
      const end = dayConfig.end_time.slice(0, 5);
      return `${start}-${end}`;
    }

    const isWeekend = dbDayOfWeek === 6 || dbDayOfWeek === 7;
    if (isWeekend) return null;

    const start = primaryShift.start_time.slice(0, 5);
    const end = primaryShift.end_time.slice(0, 5);
    return `${start}-${end}`;
  }, [primaryShiftsData, employeeSpecialShifts]);

  const getTimeStampForDate = (employeeId: string, date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return timeStamps?.find(ts => {
      const tsDate = ts.clock_in.split("T")[0];
      return ts.employee_id === employeeId && tsDate === dateStr;
    }) || null;
  };

  const hasPendingVacationForDate = useCallback((employeeId: string, date: Date): boolean => {
    if (!pendingVacations) return false;
    const dateStr = format(date, "yyyy-MM-dd");
    return pendingVacations.some(pv => {
      if (pv.employee_id !== employeeId) return false;
      return dateStr >= pv.start_date && dateStr <= pv.end_date;
    });
  }, [pendingVacations]);

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

  const isDateInAbsence = (employeeId: string, date: Date): AbsenceRequest | null => {
    const employeeAbsences = absencesByEmployee.get(employeeId);
    if (!employeeAbsences) return null;
    
    return employeeAbsences.find(absence => {
      const startDate = parseISO(absence.start_date);
      const endDate = parseISO(absence.end_date);
      return isWithinInterval(date, { start: startDate, end: endDate });
    }) || null;
  };

  const getLatenessForDate = (employeeId: string, date: Date): LatenessRecord | null => {
    const dateStr = format(date, "yyyy-MM-dd");
    return latenessRecords?.find(r => r.employee_id === employeeId && r.date === dateStr) || null;
  };

  const getBonusPaidForDate = (employeeId: string, date: Date): { amount: number } | null => {
    const dateStr = format(date, "yyyy-MM-dd");
    const paid = paidBonuses?.find(b => b.employee_id === employeeId && b.date === dateStr);
    return paid ? { amount: paid.amount } : null;
  };

  const totalPlannedHours = useMemo(() => {
    return shifts?.reduce((sum, s) => sum + (s.planned_hours || 0), 0) || 0;
  }, [shifts]);

  // Employees filtered for FM team only
  const employees = fmEmployees || [];

  // Calculate absence statistics
  const absenceStats = useMemo(() => {
    const employeeCount = employees.length;
    if (employeeCount === 0) return { weekVacation: 0, weekSick: 0 };

    let weekVacationDays = 0;
    let weekSickDays = 0;

    employees.forEach(emp => {
      weekDays.forEach(day => {
        const absence = absences?.find(a => {
          const start = parseISO(a.start_date);
          const end = parseISO(a.end_date);
          return a.employee_id === emp.id && isWithinInterval(day, { start, end });
        });
        if (absence?.type === "vacation") weekVacationDays++;
        if (absence?.type === "sick") weekSickDays++;
      });
    });

    const totalWeekSlots = employeeCount * weekDays.length;
    return {
      weekVacation: totalWeekSlots > 0 ? Math.round((weekVacationDays / totalWeekSlots) * 100) : 0,
      weekSick: totalWeekSlots > 0 ? Math.round((weekSickDays / totalWeekSlots) * 100) : 0,
    };
  }, [employees, absences, weekDays]);

  const getAbsenceIcon = (type: string) => {
    switch (type) {
      case "vacation": return <Palmtree className="h-3 w-3" />;
      case "sick": return <Thermometer className="h-3 w-3" />;
      default: return null;
    }
  };

  const getAbsenceLabel = (type: string) => {
    switch (type) {
      case "vacation": return "Ferie";
      case "sick": return "Syg";
      case "day_off": return "Fridag";
      case "no_show": return "Udeblivelse";
      default: return type;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="space-y-4">
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
                className="h-10 px-5 text-sm font-semibold hover:bg-primary/20 hover:text-primary transition-all rounded-lg"
                onClick={() => setCurrentDate(new Date())}
              >
                Uge {format(currentDate, "w", { locale: da })}
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
              <p className="text-lg font-medium text-muted-foreground">
                {format(weekStart, "d. MMMM", { locale: da })} – {format(weekEnd, "d. MMMM yyyy", { locale: da })}
              </p>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="h-10 gap-2"
              onClick={() => setShowWeekend(!showWeekend)}
            >
              {showWeekend ? (
                <>
                  <EyeOff className="h-4 w-4" />
                  Skjul weekend
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" />
                  Se weekend
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card border border-border/40 rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase">Medarbejdere</p>
              <p className="text-xl font-semibold text-foreground">{employees.length}</p>
            </div>
          </div>
          <div className="bg-card border border-border/40 rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <CalendarDays className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase">Vagter</p>
              <p className="text-xl font-semibold text-foreground">{shifts?.length || 0}</p>
            </div>
          </div>
          <div className="bg-card border border-border/40 rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Palmtree className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase">Ferie</p>
              <p className="text-xl font-semibold text-foreground">{absenceStats.weekVacation}%</p>
            </div>
          </div>
          <div className="bg-card border border-border/40 rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <Thermometer className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase">Syg</p>
              <p className="text-xl font-semibold text-foreground">{absenceStats.weekSick}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-amber-100 dark:bg-amber-900/30" />
          <span>Ferie</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-red-100 dark:bg-red-900/30" />
          <span>Syg</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-orange-100 dark:bg-orange-900/30" />
          <span>Forsinket</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Umbrella className="h-3 w-3 text-amber-500" />
          <span>Afventer ferie</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Coins className="h-3 w-3 text-yellow-500" />
          <span>Dagsbonus udbetalt</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-destructive/10" />
          <span>Helligdag</span>
        </div>
      </div>

      {/* Schedule Table */}
      <div className="overflow-x-auto rounded-lg border border-border/40 bg-card">
        <table className="w-full min-w-[800px] table-fixed">
          <thead>
            <tr className="border-b border-border/40">
              <th className="w-[200px] text-left p-3 bg-muted/30 text-sm font-semibold text-foreground sticky left-0 z-10">
                Medarbejder
              </th>
              {displayDays.map(day => {
                const holidayName = getHolidayName(day);
                const isHolidayDay = !!holidayName;
                const isTodayDate = isToday(day);
                
                return (
                  <th 
                    key={day.toISOString()} 
                    className={cn(
                      "p-2 text-center bg-muted/30 min-w-[120px]",
                      isTodayDate && "bg-primary/10",
                      isHolidayDay && "bg-destructive/5"
                    )}
                  >
                    <div className="text-sm font-semibold text-foreground capitalize">
                      {format(day, "EEEE", { locale: da })}
                    </div>
                    <div className={cn(
                      "text-xs text-muted-foreground",
                      isTodayDate && "text-primary font-semibold"
                    )}>
                      {format(day, "d. MMM", { locale: da })}
                    </div>
                    {holidayName && (
                      <div className="text-[10px] text-destructive font-medium mt-0.5">
                        {holidayName}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {employees.map(employee => (
              <tr key={employee.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                <td className="p-3 sticky left-0 bg-card z-10 border-r border-border/20">
                  <div className="font-medium text-sm text-foreground">
                    {employee.first_name} {employee.last_name}
                  </div>
                </td>
                {displayDays.map(day => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const dayShifts = shiftsByEmployeeAndDate.get(employee.id)?.get(dateStr) || [];
                  const absence = isDateInAbsence(employee.id, day);
                  const lateness = getLatenessForDate(employee.id, day);
                  const timeStamp = getTimeStampForDate(employee.id, day);
                  const workTimes = getWorkTimesForEmployeeAndDay(employee.id, day);
                  const bonusPaid = getBonusPaidForDate(employee.id, day);
                  const holidayName = getHolidayName(day);
                  const hasPendingVacation = hasPendingVacationForDate(employee.id, day);
                  
                  const hasShift = dayShifts.length > 0 || !!workTimes;
                  
                  // Determine cell background
                  let cellBg = "";
                  if (absence?.type === "vacation") cellBg = "bg-amber-50 dark:bg-amber-900/20";
                  else if (absence?.type === "sick") cellBg = "bg-red-50 dark:bg-red-900/20";
                  else if (absence?.type === "day_off") cellBg = "bg-blue-50 dark:bg-blue-900/20";
                  else if (absence?.type === "no_show") cellBg = "bg-gray-100 dark:bg-gray-800/50";
                  else if (lateness) cellBg = "bg-orange-50 dark:bg-orange-900/20";
                  else if (holidayName) cellBg = "bg-destructive/5";
                  
                  return (
                    <td 
                      key={day.toISOString()} 
                      className={cn(
                        "p-2 text-center relative",
                        cellBg,
                        isToday(day) && !cellBg && "bg-primary/5"
                      )}
                    >
                      {absence ? (
                        <div className="flex flex-col items-center justify-center gap-1">
                          <Badge 
                            variant="secondary" 
                            className={cn(
                              "text-[10px] gap-1",
                              absence.type === "vacation" && "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
                              absence.type === "sick" && "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
                              absence.type === "day_off" && "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
                              absence.type === "no_show" && "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                            )}
                          >
                            {getAbsenceIcon(absence.type)}
                            {getAbsenceLabel(absence.type)}
                          </Badge>
                        </div>
                      ) : hasShift ? (
                        <div className="flex flex-col items-center gap-1">
                          {dayShifts.length > 0 ? (
                            dayShifts.map(shift => (
                              <div 
                                key={shift.id} 
                                className="text-xs font-medium text-foreground bg-primary/10 px-2 py-1 rounded"
                              >
                                {shift.start_time?.slice(0, 5)} - {shift.end_time?.slice(0, 5)}
                              </div>
                            ))
                          ) : workTimes ? (
                            <div className="text-xs text-muted-foreground">
                              {lateness ? (
                                <span className="text-orange-600 font-medium">{lateness.new_start_time?.slice(0, 5)}-{workTimes.split('-')[1]}</span>
                              ) : (
                                workTimes
                              )}
                            </div>
                          ) : null}
                          
                          {/* Indicators */}
                          <div className="flex items-center gap-1">
                            {bonusPaid && (
                              <Coins className="h-3 w-3 text-yellow-500" />
                            )}
                            {hasPendingVacation && (
                              <Umbrella className="h-3 w-3 text-amber-500" />
                            )}
                          </div>
                          
                          {/* Timestamp info */}
                          {timeStamp && (
                            <div className="text-[10px] text-muted-foreground">
                              {timeStamp.clock_in && format(new Date(timeStamp.clock_in), "HH:mm")}
                              {timeStamp.clock_out && ` - ${format(new Date(timeStamp.clock_out), "HH:mm")}`}
                            </div>
                          )}
                        </div>
                      ) : hasPendingVacation ? (
                        <div className="flex items-center justify-center">
                          <Umbrella className="h-4 w-4 text-amber-500" />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td colSpan={displayDays.length + 1} className="p-8 text-center text-muted-foreground">
                  Ingen medarbejdere i Fieldmarketing teamet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
