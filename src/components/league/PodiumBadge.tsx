import { cn } from "@/lib/utils";

interface PodiumBadgeProps {
  rank: 1 | 2 | 3;
  className?: string;
}

const podiumConfig = {
  1: {
    emoji: "🥇",
    gradient: "bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-500",
    shadow: "shadow-yellow-500/25",
  },
  2: {
    emoji: "🥈",
    gradient: "bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400",
    shadow: "shadow-slate-400/25",
  },
  3: {
    emoji: "🥉",
    gradient: "bg-gradient-to-br from-orange-300 via-amber-500 to-orange-600",
    shadow: "shadow-orange-500/25",
  },
};

export function PodiumBadge({ rank, className }: PodiumBadgeProps) {
  const config = podiumConfig[rank];

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center w-6 h-6 rounded-full text-sm",
        config.gradient,
        "shadow-md",
        config.shadow,
        className
      )}
    >
      {config.emoji}
    </div>
  );
}
