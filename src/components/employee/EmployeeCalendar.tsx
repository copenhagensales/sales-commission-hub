import { useMemo } from "react";
import { format, startOfWeek, addDays, isSameDay, addWeeks } from "date-fns";
import { da } from "date-fns/locale";
import { Palmtree, Thermometer, AlarmClock, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Absence {
  id: string;
  type: "sick" | "vacation";
  start_date: string;
  end_date: string;
}

interface LatenessRecord {
  id: string;
  date: string;
  minutes: number;
}

interface EmployeeCalendarProps {
  standardStartTime: string | null;
  absences: Absence[];
  latenessRecords: LatenessRecord[];
  weeksToShow?: number;
}

export function EmployeeCalendar({ 
  standardStartTime, 
  absences, 
  latenessRecords,
  weeksToShow = 8 
}: EmployeeCalendarProps) {
  // Generate calendar days for the past weeks (including current week)
  const calendarWeeks = useMemo(() => {
    const today = new Date();
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weeks: Date[][] = [];

    for (let w = weeksToShow - 1; w >= 0; w--) {
      const weekStart = addWeeks(currentWeekStart, -w);
      const weekDays: Date[] = [];
      
      // Only Monday to Friday (5 days)
      for (let d = 0; d < 5; d++) {
        weekDays.push(addDays(weekStart, d));
      }
      weeks.push(weekDays);
    }

    return weeks;
  }, [weeksToShow]);

  // Check if a date falls within an absence period
  const getAbsenceForDate = (date: Date): Absence | undefined => {
    const dateStr = format(date, "yyyy-MM-dd");
    return absences.find(absence => {
      return dateStr >= absence.start_date && dateStr <= absence.end_date;
    });
  };

  // Check if date has lateness record
  const getLatenessForDate = (date: Date): LatenessRecord | undefined => {
    return latenessRecords.find(record => 
      isSameDay(new Date(record.date), date)
    );
  };

  // Day names for header
  const dayNames = ["Man", "Tir", "Ons", "Tor", "Fre"];

  return (
    <div className="space-y-4">
      {/* Legend - more prominent styling */}
      <div className="flex flex-wrap items-center gap-4 sm:gap-8 text-sm p-3 bg-muted/30 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-emerald-500/20 flex items-center justify-center ring-1 ring-emerald-500/30">
            <Check className="h-4 w-4 text-emerald-600" />
          </div>
          <span className="text-muted-foreground font-medium">Arbejder</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-amber-500/20 flex items-center justify-center ring-1 ring-amber-500/30">
            <Palmtree className="h-4 w-4 text-amber-600" />
          </div>
          <span className="text-muted-foreground font-medium">Ferie</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-red-500/30 flex items-center justify-center ring-2 ring-red-500/50">
            <Thermometer className="h-4 w-4 text-red-500" />
          </div>
          <span className="text-red-600 font-semibold">Syg</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-orange-500/30 flex items-center justify-center ring-2 ring-orange-500/50">
            <AlarmClock className="h-4 w-4 text-orange-600" />
          </div>
          <span className="text-orange-600 font-semibold">Forsinket</span>
        </div>
      </div>

      {/* Calendar Table - Enhanced styling */}
      <div className="rounded-xl border border-border/60 overflow-hidden shadow-sm">
        {/* Header Row */}
        <div className="grid grid-cols-6 bg-gradient-to-r from-muted/80 to-muted/50">
          <div className="px-3 py-3 text-xs font-semibold text-muted-foreground border-r border-border/40">
            Uge
          </div>
          {dayNames.map((day, i) => (
            <div 
              key={day} 
              className={cn(
                "px-2 py-3 text-xs font-semibold text-center text-muted-foreground",
                i < dayNames.length - 1 && "border-r border-border/40"
              )}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Week Rows */}
        {calendarWeeks.map((week, weekIndex) => {
          const weekNumber = format(week[0], "w");
          const isCurrentWeek = week.some(day => isSameDay(day, new Date()));

          return (
            <div 
              key={weekIndex} 
              className={cn(
                "grid grid-cols-6 border-t border-border/40",
                isCurrentWeek && "bg-primary/5"
              )}
            >
              {/* Week Number Cell */}
              <div className="px-3 py-2 flex items-center justify-center border-r border-border/40">
                <span className={cn(
                  "text-xs font-medium",
                  isCurrentWeek ? "text-primary" : "text-muted-foreground"
                )}>
                  {weekNumber}
                </span>
              </div>

              {/* Day Cells */}
              {week.map((day, dayIndex) => {
                const isToday = isSameDay(day, new Date());
                const isPast = day < new Date() && !isToday;
                const isFuture = day > new Date();
                const absence = getAbsenceForDate(day);
                const lateness = getLatenessForDate(day);

                // Determine cell style based on status - ENHANCED visibility for sick/lateness
                let cellBg = "bg-emerald-500/10";
                let iconBg = "bg-emerald-500/20";
                let Icon = Check;
                let iconColor = "text-emerald-600";
                let statusLabel = "";
                let cellRing = "";
                let badgeStyle = "";

                if (absence) {
                  if (absence.type === "vacation") {
                    cellBg = "bg-amber-500/15";
                    iconBg = "bg-amber-500/25";
                    Icon = Palmtree;
                    iconColor = "text-amber-600";
                    statusLabel = "Ferie";
                  } else if (absence.type === "sick") {
                    // ENHANCED: Much more visible sick day styling
                    cellBg = "bg-red-500/25";
                    iconBg = "bg-red-500/40";
                    Icon = Thermometer;
                    iconColor = "text-red-500";
                    statusLabel = "Syg";
                    cellRing = "ring-2 ring-red-500/60 ring-inset";
                    badgeStyle = "bg-red-500 text-white";
                  }
                } else if (lateness) {
                  // ENHANCED: Much more visible lateness styling
                  cellBg = "bg-orange-500/25";
                  iconBg = "bg-orange-500/40";
                  Icon = AlarmClock;
                  iconColor = "text-orange-600";
                  statusLabel = `+${lateness.minutes}m`;
                  cellRing = "ring-2 ring-orange-500/60 ring-inset";
                  badgeStyle = "bg-orange-500 text-white";
                }

                return (
                  <div 
                    key={day.toISOString()}
                    className={cn(
                      "p-1.5 min-h-[60px] transition-all",
                      dayIndex < week.length - 1 && "border-r border-border/40",
                      cellBg,
                      cellRing,
                      isPast && !absence && !lateness && "opacity-50",
                      isFuture && "opacity-40",
                      isToday && !absence && !lateness && "ring-2 ring-primary/40 ring-inset"
                    )}
                  >
                    <div className="flex flex-col items-center justify-center h-full gap-1">
                      {/* Date */}
                      <div className={cn(
                        "text-[10px] font-medium leading-none",
                        isToday ? "text-primary font-bold" : "text-muted-foreground",
                        (absence?.type === "sick" || lateness) && "font-semibold"
                      )}>
                        {format(day, "d", { locale: da })}
                      </div>

                      {/* Status Icon - larger for sick/lateness */}
                      <div className={cn(
                        "rounded-lg flex items-center justify-center",
                        iconBg,
                        absence?.type === "sick" || lateness ? "h-7 w-7" : "h-6 w-6"
                      )}>
                        <Icon className={cn(
                          iconColor,
                          absence?.type === "sick" || lateness ? "h-4 w-4" : "h-3.5 w-3.5"
                        )} />
                      </div>

                      {/* Status Label - badge style for sick/lateness */}
                      {statusLabel && (
                        <span className={cn(
                          "text-[9px] font-bold leading-none px-1.5 py-0.5 rounded",
                          badgeStyle || iconColor
                        )}>
                          {statusLabel}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
