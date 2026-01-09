import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface QualificationCountdownProps {
  endDate: string;
}

export function QualificationCountdown({ endDate }: QualificationCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const end = new Date(endDate).getTime();
      const now = new Date().getTime();
      const diff = end - now;

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

  if (!timeLeft) {
    return (
      <div className="flex items-center gap-2 text-amber-400">
        <Clock className="h-4 w-4" />
        <span className="font-medium">Kvalifikation afsluttet</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span className="text-sm">Kvalifikation slutter om</span>
      </div>
      <div className="flex gap-2">
        <TimeBlock value={timeLeft.days} label="dage" />
        <TimeBlock value={timeLeft.hours} label="timer" />
        <TimeBlock value={timeLeft.minutes} label="min" />
        <TimeBlock value={timeLeft.seconds} label="sek" />
      </div>
    </div>
  );
}

function TimeBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center bg-slate-800/50 rounded-lg px-3 py-2 min-w-[60px]">
      <span className="text-2xl font-bold text-white">
        {value.toString().padStart(2, "0")}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
