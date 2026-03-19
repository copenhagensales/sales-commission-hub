import { cn } from "@/lib/utils";

interface ZoneProgressBarProps {
  current: number;
  target: number;
  zone: "top" | "promo" | "playoff" | "relegation" | "safe";
  className?: string;
}

const zoneColors = {
  top: "bg-yellow-500",
  promo: "bg-green-500",
  playoff: "bg-orange-500",
  relegation: "bg-red-500",
  safe: "bg-muted-foreground",
};

export function ZoneProgressBar({ current, target, zone, className }: ZoneProgressBarProps) {
  if (target <= 0) return null;
  const pct = Math.min((current / target) * 100, 100);

  return (
    <div className={cn("h-[2px] w-full bg-border/50 rounded-full overflow-hidden", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-700", zoneColors[zone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
