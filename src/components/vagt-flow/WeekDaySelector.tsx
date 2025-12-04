import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { addDays, addWeeks, startOfWeek, format } from "date-fns";
import { da } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface WeekDaySelectorProps {
  selectedDays: number[];
  onDaysChange: (days: number[]) => void;
  referenceDate?: Date;
  onWeekChange?: (date: Date) => void;
}

const WEEKDAYS = [
  { label: "M", day: 0, name: "Mandag" },
  { label: "T", day: 1, name: "Tirsdag" },
  { label: "O", day: 2, name: "Onsdag" },
  { label: "T", day: 3, name: "Torsdag" },
  { label: "F", day: 4, name: "Fredag" },
  { label: "L", day: 5, name: "Lørdag" },
  { label: "S", day: 6, name: "Søndag" },
];

export function WeekDaySelector({ selectedDays, onDaysChange, referenceDate = new Date(), onWeekChange }: WeekDaySelectorProps) {
  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });

  const toggleDay = (day: number) => {
    if (selectedDays.includes(day)) {
      onDaysChange(selectedDays.filter((d) => d !== day));
    } else {
      onDaysChange([...selectedDays, day].sort());
    }
  };

  const getDateForDay = (day: number) => {
    return addDays(weekStart, day);
  };

  const navigateWeek = (direction: "prev" | "next") => {
    const newDate = addWeeks(referenceDate, direction === "next" ? 1 : -1);
    onWeekChange?.(newDate);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => navigateWeek("prev")}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          Uge {format(weekStart, "w", { locale: da })} - {format(weekStart, "yyyy")}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => navigateWeek("next")}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {WEEKDAYS.map((weekday) => {
          const date = getDateForDay(weekday.day);
          const isSelected = selectedDays.includes(weekday.day);

          return (
            <button
              key={weekday.day}
              type="button"
              onClick={() => toggleDay(weekday.day)}
              className={cn(
                "flex flex-col items-center justify-center p-2 rounded-lg border transition-colors",
                isSelected
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted border-border"
              )}
            >
              <span className="text-xs font-medium">{weekday.label}</span>
              <span className="text-lg font-bold">{format(date, "d")}</span>
              <span className="text-xs opacity-70">{format(date, "MMM", { locale: da })}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
