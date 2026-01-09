import { cn } from "@/lib/utils";

interface PodiumBadgeProps {
  rank: 1 | 2 | 3;
  className?: string;
}

const podiumConfig = {
  1: {
    emoji: "🥇",
    gradient: "bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500",
    shadow: "shadow-yellow-500/30",
    ring: "ring-yellow-400/50",
  },
  2: {
    emoji: "🥈",
    gradient: "bg-gradient-to-r from-slate-300 via-slate-400 to-slate-300",
    shadow: "shadow-slate-400/30",
    ring: "ring-slate-300/50",
  },
  3: {
    emoji: "🥉",
    gradient: "bg-gradient-to-r from-orange-400 via-amber-600 to-orange-500",
    shadow: "shadow-orange-500/30",
    ring: "ring-orange-400/50",
  },
};

export function PodiumBadge({ rank, className }: PodiumBadgeProps) {
  const config = podiumConfig[rank];

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center w-7 h-7 rounded-full text-base",
        config.gradient,
        "shadow-lg",
        config.shadow,
        "ring-2",
        config.ring,
        className
      )}
    >
      {config.emoji}
    </div>
  );
}
