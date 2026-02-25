import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronLeft, ChevronRight, CalendarIcon, ChevronDown } from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, startOfDay, endOfDay, startOfWeek, endOfWeek, subDays } from "date-fns";
import { da } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

type PeriodMode = "payroll" | "month" | "week" | "day" | "custom";

interface DBPeriodSelectorProps {
  periodStart: Date;
  periodEnd: Date;
  onChange: (start: Date, end: Date) => void;
  mode: PeriodMode;
  onModeChange: (mode: PeriodMode) => void;
  selectedPresetLabel?: string;
  onPresetLabelChange?: (label: string | undefined) => void;
}

import { getPayrollPeriod } from "@/lib/calculations";

export function DBPeriodSelector({
  periodStart,
  periodEnd,
  onChange,
  mode,
  onModeChange,
  selectedPresetLabel,
  onPresetLabelChange,
}: DBPeriodSelectorProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: periodStart,
    to: periodEnd,
  });

  const presets = useMemo(() => {
    const now = new Date();
    const yesterday = subDays(now, 1);
    const currentPayroll = getPayrollPeriod(now);
    const prevPayroll = getPayrollPeriod(subMonths(now, 1));
    const thisMonth = { start: startOfMonth(now), end: endOfMonth(now) };
    const lastMonth = {
      start: startOfMonth(subMonths(now, 1)),
      end: endOfMonth(subMonths(now, 1)),
    };
    const today = { start: startOfDay(now), end: endOfDay(now) };
    const yesterdayPeriod = { start: startOfDay(yesterday), end: endOfDay(yesterday) };
    const thisWeek = { 
      start: startOfWeek(now, { weekStartsOn: 1 }), 
      end: endOfWeek(now, { weekStartsOn: 1 }) 
    };

    return [
      { label: "I dag", mode: "day" as PeriodMode, ...today },
      { label: "I går", mode: "day" as PeriodMode, ...yesterdayPeriod },
      { label: "Denne uge", mode: "week" as PeriodMode, ...thisWeek },
      { label: "Denne lønperiode", mode: "payroll" as PeriodMode, ...currentPayroll },
      { label: "Forrige lønperiode", mode: "payroll" as PeriodMode, ...prevPayroll },
      { label: "Denne måned", mode: "month" as PeriodMode, ...thisMonth },
      { label: "Forrige måned", mode: "month" as PeriodMode, ...lastMonth },
    ];
  }, []);

  const handlePrevious = () => {
    if (mode === "payroll") {
      const prevPeriod = getPayrollPeriod(subMonths(periodStart, 1));
      onChange(prevPeriod.start, prevPeriod.end);
    } else if (mode === "month") {
      const prevMonth = subMonths(periodStart, 1);
      onChange(startOfMonth(prevMonth), endOfMonth(prevMonth));
    } else if (mode === "week") {
      const prevWeek = new Date(periodStart);
      prevWeek.setDate(prevWeek.getDate() - 7);
      onChange(startOfWeek(prevWeek, { weekStartsOn: 1 }), endOfWeek(prevWeek, { weekStartsOn: 1 }));
    } else if (mode === "day") {
      const prevDay = new Date(periodStart);
      prevDay.setDate(prevDay.getDate() - 1);
      onChange(startOfDay(prevDay), endOfDay(prevDay));
    }
  };

  const handleNext = () => {
    if (mode === "payroll") {
      const nextPeriod = getPayrollPeriod(addMonths(periodStart, 1));
      onChange(nextPeriod.start, nextPeriod.end);
    } else if (mode === "month") {
      const nextMonth = addMonths(periodStart, 1);
      onChange(startOfMonth(nextMonth), endOfMonth(nextMonth));
    } else if (mode === "week") {
      const nextWeek = new Date(periodStart);
      nextWeek.setDate(nextWeek.getDate() + 7);
      onChange(startOfWeek(nextWeek, { weekStartsOn: 1 }), endOfWeek(nextWeek, { weekStartsOn: 1 }));
    } else if (mode === "day") {
      const nextDay = new Date(periodStart);
      nextDay.setDate(nextDay.getDate() + 1);
      onChange(startOfDay(nextDay), endOfDay(nextDay));
    }
  };

  const handlePresetSelect = (preset: (typeof presets)[0]) => {
    onModeChange(preset.mode);
    onChange(preset.start, preset.end);
    onPresetLabelChange?.(preset.label);
  };

  const handleCustomSelect = () => {
    setDropdownOpen(false);
    // Small delay to let dropdown close before opening calendar
    setTimeout(() => {
      onModeChange("custom");
      onPresetLabelChange?.("Brugerdefineret");
      setCalendarOpen(true);
    }, 100);
  };

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    setDateRange(range);
    if (range?.from && range?.to) {
      onChange(range.from, range.to);
    }
  };

  const formatPeriodDisplay = () => {
    if (mode === "day") {
      return format(periodStart, "d. MMMM yyyy", { locale: da });
    } else if (mode === "week") {
      return `Uge ${format(periodStart, "w", { locale: da })}, ${format(periodStart, "yyyy", { locale: da })}`;
    } else if (mode === "payroll") {
      return `${format(periodStart, "d. MMM", { locale: da })} - ${format(periodEnd, "d. MMM yyyy", { locale: da })}`;
    } else if (mode === "month") {
      return format(periodStart, "MMMM yyyy", { locale: da });
    } else {
      return `${format(periodStart, "d. MMM", { locale: da })} - ${format(periodEnd, "d. MMM yyyy", { locale: da })}`;
    }
  };

  const getModeLabel = () => {
    switch (mode) {
      case "day":
        return "Dag";
      case "week":
        return "Uge";
      case "payroll":
        return "Lønperiode";
      case "month":
        return "Måned";
      case "custom":
        return "Brugerdefineret";
    }
  };

  const getButtonLabel = () => {
    if (selectedPresetLabel) {
      return selectedPresetLabel;
    }
    return "Vælg periode";
  };

  return (
    <div className="flex items-center gap-2">
      {/* Arrow navigation - disabled for custom mode */}
      <Button
        variant="outline"
        size="icon"
        onClick={handlePrevious}
        disabled={mode === "custom"}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* Period display */}
      <div className="min-w-[200px] text-center">
        <span className="font-medium capitalize">{formatPeriodDisplay()}</span>
        <span className="ml-2 text-xs text-muted-foreground">({getModeLabel()})</span>
      </div>

      <Button
        variant="outline"
        size="icon"
        onClick={handleNext}
        disabled={mode === "custom"}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {/* Preset dropdown */}
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            <CalendarIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{getButtonLabel()}</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-popover z-50">
          {presets.map((preset) => (
            <DropdownMenuItem
              key={preset.label}
              onClick={() => handlePresetSelect(preset)}
            >
              {preset.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleCustomSelect}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            Brugerdefineret...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Separate calendar popover for custom date range */}
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <span className="sr-only">Åbn kalender</span>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 z-50" align="end" sideOffset={8}>
          <Calendar
            mode="range"
            defaultMonth={periodStart}
            selected={dateRange}
            onSelect={handleDateRangeSelect}
            numberOfMonths={2}
            locale={da}
            className={cn("p-3 pointer-events-auto")}
          />
          <div className="border-t p-3 flex justify-end">
            <Button
              size="sm"
              onClick={() => setCalendarOpen(false)}
              disabled={!dateRange?.from || !dateRange?.to}
            >
              Anvend
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
