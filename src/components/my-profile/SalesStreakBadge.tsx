import { Flame, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SalesStreakBadgeProps {
  currentStreak: number;
  streakAtRisk: boolean;
  className?: string;
}

export function SalesStreakBadge({ 
  currentStreak, 
  streakAtRisk,
  className 
}: SalesStreakBadgeProps) {
  if (currentStreak === 0) return null;

  const isHotStreak = currentStreak >= 7;
  const isBurningStreak = currentStreak >= 14;
  const isLegendaryStreak = currentStreak >= 30;

  return (
    <Badge 
      className={cn(
        "gap-1.5 text-sm font-semibold px-3 py-1.5 transition-all",
        streakAtRisk 
          ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
          : isLegendaryStreak
            ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
            : isBurningStreak
              ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
              : isHotStreak
                ? "bg-orange-500/15 text-orange-400 border-orange-500/25"
                : "bg-primary/20 text-primary border-primary/30",
        className
      )}
    >
      {streakAtRisk ? (
        <>
          <Zap className="h-4 w-4 animate-pulse" />
          <span>Overgå gårsdagen! 💪</span>
        </>
      ) : (
        <>
          <Flame className={cn(
            "h-4 w-4",
            isLegendaryStreak && "animate-bounce",
            isBurningStreak && !isLegendaryStreak && "animate-pulse"
          )} />
          <span>{currentStreak} {currentStreak === 1 ? "dag" : "dage"} i træk</span>
          {isLegendaryStreak && " 👑"}
          {isBurningStreak && !isLegendaryStreak && " 🔥"}
        </>
      )}
    </Badge>
  );
}
