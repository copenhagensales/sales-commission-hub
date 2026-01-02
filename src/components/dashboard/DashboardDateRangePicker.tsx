import { useState } from "react";
import { format, startOfDay, startOfMonth, endOfMonth, subDays, startOfWeek, endOfWeek } from "date-fns";
import { da } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

interface DashboardDateRangePickerProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
}

const presets = [
  { label: "I dag", getValue: () => ({ from: startOfDay(new Date()), to: new Date() }) },
  { label: "I går", getValue: () => ({ from: startOfDay(subDays(new Date(), 1)), to: startOfDay(new Date()) }) },
  { label: "Denne uge", getValue: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: endOfWeek(new Date(), { weekStartsOn: 1 }) }) },
  { label: "Sidste 7 dage", getValue: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
  { label: "Denne måned", getValue: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: "Sidste 30 dage", getValue: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
];

export function DashboardDateRangePicker({ dateRange, onDateRangeChange }: DashboardDateRangePickerProps) {
  const [open, setOpen] = useState(false);

  const formatDateRange = () => {
    if (!dateRange?.from) return "Vælg periode";
    
    const fromDate = format(dateRange.from, "d. MMM", { locale: da });
    const toDate = dateRange.to ? format(dateRange.to, "d. MMM yyyy", { locale: da }) : "";
    
    // Check if it's a single day
    if (dateRange.to && startOfDay(dateRange.from).getTime() === startOfDay(dateRange.to).getTime()) {
      return format(dateRange.from, "EEEE d. MMMM yyyy", { locale: da });
    }
    
    return dateRange.to ? `${fromDate} – ${toDate}` : fromDate;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "min-w-[240px] justify-start text-left font-normal",
            !dateRange && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {formatDateRange()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex">
          <div className="border-r p-2 space-y-1">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="w-full justify-start text-sm"
                onClick={() => {
                  onDateRangeChange(preset.getValue());
                  setOpen(false);
                }}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <Calendar
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={(range) => {
              onDateRangeChange(range);
              // Close popover if both dates are selected
              if (range?.from && range?.to) {
                setOpen(false);
              }
            }}
            numberOfMonths={2}
            className="pointer-events-auto p-3"
            locale={da}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
