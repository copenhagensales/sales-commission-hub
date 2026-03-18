import { useState, useEffect, useMemo } from "react";
import { Clock } from "lucide-react";
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
      "flex flex-col items-center gap-3 rounded-xl p-4",
      isUrgent && "countdown-urgent"
    )}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        <span className="text-xs font-medium uppercase tracking-wider">Kvalifikation slutter om</span>
      </div>
      <div className="flex items-center gap-1">
        <TimeBlock value={timeLeft.days} label="dage" urgent={isUrgent} />
        <Separator urgent={isUrgent} />
        <TimeBlock value={timeLeft.hours} label="timer" urgent={isUrgent} />
        <Separator urgent={isUrgent} />
        <TimeBlock value={timeLeft.minutes} label="min" urgent={isUrgent} />
        <Separator urgent={isUrgent} />
        <TimeBlock value={timeLeft.seconds} label="sek" urgent={isUrgent} />
      </div>
      {progressPercent !== null && (
        <div className="w-full space-y-1.5">
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                isUrgent
                  ? "bg-gradient-to-r from-red-500 to-orange-400"
                  : "bg-gradient-to-r from-emerald-500 to-cyan-400"
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground/60 text-center">
            {Math.round(progressPercent)}% gennemført
          </p>
        </div>
      )}
    </div>
  );
}

function Separator({ urgent }: { urgent?: boolean }) {
  return (
    <span className={cn(
      "text-lg font-bold pb-4",
      urgent ? "text-red-400/60" : "text-muted-foreground/40"
    )}>:</span>
  );
}

function TimeBlock({ value, label, urgent }: { value: number; label: string; urgent?: boolean }) {
  return (
    <div className={cn(
      "flex flex-col items-center rounded-lg px-2.5 py-1.5 min-w-[52px] transition-colors backdrop-blur-sm",
      urgent
        ? "bg-red-500/10 border border-red-500/20"
        : "bg-white/5 border border-white/10"
    )}>
      <span className={cn(
        "text-xl font-bold font-mono tabular-nums",
        urgent ? "text-red-400" : "text-foreground"
      )}>
        {value.toString().padStart(2, "0")}
      </span>
      <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">{label}</span>
    </div>
  );
}
