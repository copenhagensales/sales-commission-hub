import { useMemo, useState } from "react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from "date-fns";
import { da } from "date-fns/locale";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type PeriodType = 
  | "today" 
  | "yesterday" 
  | "this_week" 
  | "last_7_days" 
  | "this_month" 
  | "payroll_period" 
  | "custom";

export interface PeriodSelection {
  type: PeriodType;
  from: Date;
  to: Date;
  label: string;
}

interface DashboardPeriodSelectorProps {
  selectedPeriod: PeriodSelection;
  onPeriodChange: (period: PeriodSelection) => void;
  className?: string;
  /** Hide period selector in TV mode */
  disabled?: boolean;
}

// Calculate payroll period (15th to 14th)
function calculatePayrollPeriod(): { start: Date; end: Date } {
  const today = new Date();
  const currentDay = today.getDate();
  
  if (currentDay >= 15) {
    const start = new Date(today.getFullYear(), today.getMonth(), 15);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 14);
    return { start, end };
  } else {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 15);
    const end = new Date(today.getFullYear(), today.getMonth(), 14);
    return { start, end };
  }
}

export function getDefaultPeriod(type: PeriodType = "payroll_period"): PeriodSelection {
  const now = new Date();
  
  switch (type) {
    case "today":
      return {
        type: "today",
        from: startOfDay(now),
        to: endOfDay(now),
        label: "I dag",
      };
    case "yesterday": {
      const yesterday = subDays(now, 1);
      return {
        type: "yesterday",
        from: startOfDay(yesterday),
        to: endOfDay(yesterday),
        label: "I går",
      };
    }
    case "this_week":
      return {
        type: "this_week",
        from: startOfWeek(now, { weekStartsOn: 1 }),
        to: endOfWeek(now, { weekStartsOn: 1 }),
        label: "Denne uge",
      };
    case "last_7_days":
      return {
        type: "last_7_days",
        from: startOfDay(subDays(now, 6)),
        to: endOfDay(now),
        label: "Sidste 7 dage",
      };
    case "this_month":
      return {
        type: "this_month",
        from: startOfMonth(now),
        to: endOfMonth(now),
        label: "Denne måned",
      };
    case "payroll_period": {
      const { start, end } = calculatePayrollPeriod();
      return {
        type: "payroll_period",
        from: start,
        to: end,
        label: "Lønperiode",
      };
    }
    default:
      return {
        type: "today",
        from: startOfDay(now),
        to: endOfDay(now),
        label: "I dag",
      };
  }
}

const PERIOD_PRESETS: Array<{ type: PeriodType; label: string }> = [
  { type: "today", label: "I dag" },
  { type: "yesterday", label: "I går" },
  { type: "this_week", label: "Denne uge" },
  { type: "last_7_days", label: "Sidste 7 dage" },
  { type: "this_month", label: "Denne måned" },
  { type: "payroll_period", label: "Lønperiode" },
];

export function DashboardPeriodSelector({
  selectedPeriod,
  onPeriodChange,
  className,
  disabled = false,
}: DashboardPeriodSelectorProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
    from: selectedPeriod.from,
    to: selectedPeriod.to,
  });

  const displayLabel = useMemo(() => {
    if (selectedPeriod.type === "custom") {
      const fromStr = format(selectedPeriod.from, "d. MMM", { locale: da });
      const toStr = format(selectedPeriod.to, "d. MMM", { locale: da });
      return `${fromStr} - ${toStr}`;
    }
    return selectedPeriod.label;
  }, [selectedPeriod]);

  const handlePresetSelect = (type: PeriodType) => {
    const period = getDefaultPeriod(type);
    onPeriodChange(period);
  };

  const handleDateRangeSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (!range) return;
    
    setDateRange(range);
    
    // Only apply when both dates are selected
    if (range.from && range.to) {
      const fromStr = format(range.from, "d. MMM", { locale: da });
      const toStr = format(range.to, "d. MMM", { locale: da });
      
      onPeriodChange({
        type: "custom",
        from: startOfDay(range.from),
        to: endOfDay(range.to),
        label: `${fromStr} - ${toStr}`,
      });
      setCalendarOpen(false);
    }
  };

  if (disabled) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 min-w-[140px] justify-between">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <span>{displayLabel}</span>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[200px]">
          {PERIOD_PRESETS.map((preset) => (
            <DropdownMenuItem
              key={preset.type}
              onClick={() => handlePresetSelect(preset.type)}
              className={cn(
                "cursor-pointer",
                selectedPeriod.type === preset.type && "bg-accent"
              )}
            >
              {preset.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setCalendarOpen(true);
                }}
                className={cn(
                  "cursor-pointer",
                  selectedPeriod.type === "custom" && "bg-accent"
                )}
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                Brugerdefineret...
              </DropdownMenuItem>
            </PopoverTrigger>
            <PopoverContent 
              className="w-auto p-0" 
              align="end"
              side="left"
              sideOffset={8}
            >
              <Calendar
                mode="range"
                selected={dateRange.from && dateRange.to ? { from: dateRange.from, to: dateRange.to } : undefined}
                onSelect={handleDateRangeSelect}
                numberOfMonths={2}
                locale={da}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * Map PeriodType to the cache period type used in kpi_cached_values
 */
export function mapPeriodTypeToCache(type: PeriodType): string | null {
  switch (type) {
    case "today":
      return "today";
    case "this_week":
      return "this_week";
    case "this_month":
      return "this_month";
    case "payroll_period":
      return "payroll_period";
    default:
      // Custom periods, yesterday, last_7_days need direct DB queries
      return null;
  }
}

/**
 * Check if a period type can use cached KPIs
 */
export function canUseCachedKpis(type: PeriodType): boolean {
  return mapPeriodTypeToCache(type) !== null;
}
