import { Flame, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface DailyTopBadgeProps {
  rank: 1 | 2 | 3;
  className?: string;
}

const config = {
  1: { icon: Flame, color: "text-amber-400", label: "🔥" },
  2: { icon: Zap, color: "text-slate-300", label: "⚡" },
  3: { icon: Zap, color: "text-orange-400", label: "⚡" },
};

export function DailyTopBadge({ rank, className }: DailyTopBadgeProps) {
  const { icon: Icon, color } = config[rank];
  return (
    <Icon className={cn("h-3 w-3 shrink-0 animate-pulse", color, className)} />
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
