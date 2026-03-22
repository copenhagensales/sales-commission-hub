import { Flame, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface DailyTopBadgeProps {
  rank: 1 | 2 | 3;
  className?: string;
  size?: "sm" | "lg";
}

const config = {
  1: { icon: Flame, color: "text-amber-400", glow: "drop-shadow-[0_0_6px_rgba(251,191,36,0.7)]", label: "#1" },
  2: { icon: Zap, color: "text-slate-300", glow: "drop-shadow-[0_0_5px_rgba(203,213,225,0.6)]", label: "#2" },
  3: { icon: Zap, color: "text-orange-400", glow: "drop-shadow-[0_0_5px_rgba(251,146,60,0.6)]", label: "#3" },
};

export function DailyTopBadge({ rank, className, size = "sm" }: DailyTopBadgeProps) {
  const { icon: Icon, color, glow, label } = config[rank];

  if (size === "lg") {
    return (
      <span className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5",
        rank === 1 && "bg-amber-400/15",
        rank === 2 && "bg-slate-300/15",
        rank === 3 && "bg-orange-400/15",
        className
      )}>
        <Icon className={cn("h-3.5 w-3.5 shrink-0 animate-pulse", color, glow)} />
        <span className={cn("text-[10px] font-bold", color)}>{label}</span>
      </span>
    );
  }

  return (
    <Icon className={cn("h-3.5 w-3.5 shrink-0 animate-pulse", color, glow, className)} />
  );
}

/** Compute top 3 employee IDs by today's provision */
export function computeTodayTop3(
  todayProvisionMap: Record<string, number>
): Record<string, 1 | 2 | 3> {
  const sorted = Object.entries(todayProvisionMap)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const result: Record<string, 1 | 2 | 3> = {};
  sorted.forEach(([id], i) => {
    result[id] = (i + 1) as 1 | 2 | 3;
  });
  return result;
}
