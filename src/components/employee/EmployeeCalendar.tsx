import { useMemo } from "react";
import { format, startOfWeek, endOfWeek, addDays, isSameDay, isWeekend, startOfMonth, endOfMonth, addWeeks } from "date-fns";
import { da } from "date-fns/locale";
import { Palmtree, Thermometer, Briefcase, AlarmClock } from "lucide-react";
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
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 }); // Start from Monday
    const weeks: Date[][] = [];

    // Go back weeksToShow-1 weeks, then show up to current week
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
    return absences.find(absence => {
      const start = new Date(absence.start_date);
      const end = new Date(absence.end_date);
      return date >= start && date <= end;
    });
  };

  // Check if date has lateness record
  const getLatenessForDate = (date: Date): LatenessRecord | undefined => {
    return latenessRecords.find(record => 
      isSameDay(new Date(record.date), date)
    );
  };

  // Parse time from standard_start_time (e.g., "8.00-16.30")
  const parseWorkingHours = (timeString: string | null) => {
    if (!timeString) return { start: "09:00", end: "17:00" };
    const [start, end] = timeString.split("-").map(t => t.trim().replace(".", ":"));
    return { start, end };
  };

  const workingHours = parseWorkingHours(standardStartTime);

  // Day names for header
  const dayNames = ["Man", "Tir", "Ons", "Tor", "Fre"];

  return (
    <div className="space-y-4">
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
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-orange-500/20 border border-orange-500/30" />
          <span className="text-muted-foreground">Forsinket</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-6 bg-muted/50 border-b">
          <div className="p-2 text-xs font-medium text-muted-foreground">Uge</div>
          {dayNames.map((day) => (
            <div key={day} className="p-2 text-xs font-medium text-center text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {calendarWeeks.map((week, weekIndex) => {
          const weekNumber = format(week[0], "w");
          const isCurrentWeek = week.some(day => isSameDay(day, new Date()));

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
              {week.map((day) => {
                const isToday = isSameDay(day, new Date());
                const isPast = day < new Date() && !isToday;
                const absence = getAbsenceForDate(day);
                const lateness = getLatenessForDate(day);

                // Determine cell style based on status
                let bgColor = "bg-green-500/15"; // Default: working day
                let borderColor = "border-green-500/30";
                let icon = <Briefcase className="h-3 w-3 text-green-600" />;
                let statusText = workingHours.start.replace(":", ".") + "-" + workingHours.end.replace(":", ".");

                if (absence) {
                  if (absence.type === "vacation") {
                    bgColor = "bg-amber-500/20";
                    borderColor = "border-amber-500/30";
                    icon = <Palmtree className="h-3 w-3 text-amber-600" />;
                    statusText = "Ferie";
                  } else if (absence.type === "sick") {
                    bgColor = "bg-red-500/20";
                    borderColor = "border-red-500/30";
                    icon = <Thermometer className="h-3 w-3 text-red-500" />;
                    statusText = "Syg";
                  }
                } else if (lateness) {
                  bgColor = "bg-orange-500/20";
                  borderColor = "border-orange-500/30";
                  icon = <AlarmClock className="h-3 w-3 text-orange-600" />;
                  statusText = `${lateness.minutes} min`;
                }

                return (
                  <div 
                    key={day.toISOString()}
                    className={cn(
                      "p-1.5 min-h-[60px] border-r last:border-r-0 transition-colors",
                      bgColor,
                      isPast && "opacity-60"
                    )}
                  >
                    <div className="flex flex-col h-full">
                      {/* Date */}
                      <div className={cn(
                        "text-xs font-medium mb-1",
                        isToday && "text-primary font-bold"
                      )}>
                        {format(day, "d.")}
                        {isToday && <span className="ml-1 text-[10px]">(i dag)</span>}
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
            </div>
          );
        })}
      </div>

      {/* Working hours info */}
      {standardStartTime && (
        <p className="text-xs text-muted-foreground">
          Din standardmødetid er <span className="font-medium">{standardStartTime}</span> (mandag-fredag)
        </p>
      )}
    </div>
  );
}