import { useState, useEffect, useMemo } from "react";
import { Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface QualificationCountdownProps {
  endDate: string;
  startDate?: string;
}

export function QualificationCountdown({ endDate, startDate }: QualificationCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const calculateTimeLeft = () => {
      const end = new Date(endDate).getTime();
      const current = Date.now();
      setNow(current);
      const diff = end - current;

      if (diff <= 0) {
        setTimeLeft(null);
        return;
      }

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [endDate]);

  const progressPercent = useMemo(() => {
    if (!startDate) return null;
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const total = end - start;
    if (total <= 0) return 100;
    const elapsed = now - start;
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  }, [startDate, endDate, now]);

  const isUrgent = timeLeft !== null && timeLeft.days < 2;

  if (!timeLeft) {
    return (
      <div className="flex items-center gap-2 text-amber-400">
        <Clock className="h-4 w-4" />
        <span className="font-medium">Kvalifikation afsluttet</span>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex flex-col items-center gap-3 rounded-lg p-3",
      isUrgent && "countdown-urgent"
    )}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span className="text-sm">Kvalifikation slutter om</span>
      </div>
      <div className="flex gap-2">
        <TimeBlock value={timeLeft.days} label="dage" urgent={isUrgent} />
        <TimeBlock value={timeLeft.hours} label="timer" urgent={isUrgent} />
        <TimeBlock value={timeLeft.minutes} label="min" urgent={isUrgent} />
        <TimeBlock value={timeLeft.seconds} label="sek" urgent={isUrgent} />
      </div>
      {progressPercent !== null && (
        <div className="w-full space-y-1">
          <Progress value={progressPercent} className="h-1.5" />
          <p className="text-[10px] text-muted-foreground text-center">
            {Math.round(progressPercent)}% af kvalifikationen gennemført
          </p>
        </div>
      )}
    </div>
  );
}

function TimeBlock({ value, label, urgent }: { value: number; label: string; urgent?: boolean }) {
  return (
    <div className={cn(
      "flex flex-col items-center rounded-lg px-3 py-2 min-w-[60px] transition-colors",
      urgent
        ? "bg-red-500/15 border border-red-500/30"
        : "bg-slate-800/50"
    )}>
      <span className={cn(
        "text-2xl font-bold",
        urgent ? "text-red-400" : "text-foreground"
      )}>
        {value.toString().padStart(2, "0")}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
