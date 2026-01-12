import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { da } from "date-fns/locale";

interface PayrollPeriodSelectorProps {
  onChange: (periodStart: Date, periodEnd: Date) => void;
}

function getPayrollPeriod(baseDate: Date): { start: Date; end: Date } {
  const day = baseDate.getDate();
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  
  if (day >= 15) {
    // Period: 15th of this month to 14th of next month
    return {
      start: new Date(year, month, 15),
      end: new Date(year, month + 1, 14, 23, 59, 59),
    };
  } else {
    // Period: 15th of last month to 14th of this month
    return {
      start: new Date(year, month - 1, 15),
      end: new Date(year, month, 14, 23, 59, 59),
    };
  }
}

export function PayrollPeriodSelector({ onChange }: PayrollPeriodSelectorProps) {
  const [currentBaseDate, setCurrentBaseDate] = useState(() => new Date());
  
  const period = useMemo(() => getPayrollPeriod(currentBaseDate), [currentBaseDate]);
  
  const isCurrentPeriod = useMemo(() => {
    const nowPeriod = getPayrollPeriod(new Date());
    return period.start.getTime() === nowPeriod.start.getTime();
  }, [period]);
  
  const handlePreviousPeriod = useCallback(() => {
    setCurrentBaseDate(prev => {
      const prevPeriod = subMonths(prev, 1);
      const newPeriod = getPayrollPeriod(prevPeriod);
      // Schedule onChange for next tick to avoid state update during render
      setTimeout(() => onChange(newPeriod.start, newPeriod.end), 0);
      return prevPeriod;
    });
  }, [onChange]);
  
  const handleNextPeriod = useCallback(() => {
    setCurrentBaseDate(prev => {
      const nextPeriod = addMonths(prev, 1);
      const newPeriod = getPayrollPeriod(nextPeriod);
      setTimeout(() => onChange(newPeriod.start, newPeriod.end), 0);
      return nextPeriod;
    });
  }, [onChange]);
  
  // Initialize parent with current period
  useMemo(() => {
    onChange(period.start, period.end);
  }, []); // Only on mount
  
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={handlePreviousPeriod}
        className="h-8 w-8"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <h3 className="text-lg font-semibold min-w-[200px] text-center">
        Lønperiode: {format(period.start, "d. MMM", { locale: da })} - {format(period.end, "d. MMM", { locale: da })}
      </h3>
      
      <Button
        variant="outline"
        size="icon"
        onClick={handleNextPeriod}
        disabled={isCurrentPeriod}
        className="h-8 w-8"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
