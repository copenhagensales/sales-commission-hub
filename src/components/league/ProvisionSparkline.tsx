import { memo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProvisionSparklineProps {
  data: number[]; // 7 values [day-6 ... today]
  className?: string;
}

export const ProvisionSparkline = memo(function ProvisionSparkline({
  data,
  className,
}: ProvisionSparklineProps) {
  if (!data || data.length === 0) return null;

  const max = Math.max(...data, 1);
  const w = 48;
  const h = 16;
  const padding = 1;

  const points = data
    .map((v, i) => {
      const x = padding + (i / (data.length - 1)) * (w - padding * 2);
      const y = h - padding - (v / max) * (h - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  // Momentum: compare last 3 days avg vs previous 3 days avg
  const recent = data.slice(-3);
  const older = data.slice(0, 3);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

  const isRising = recentAvg > olderAvg * 1.05;
  const isFalling = recentAvg < olderAvg * 0.95;

  const strokeColor = isRising
    ? "hsl(142 71% 45%)"  // success green
    : isFalling
    ? "hsl(0 84% 60%)"    // danger red
    : "hsl(217 91% 60%)"; // neutral blue

  const MomentumIcon = isRising ? TrendingUp : isFalling ? TrendingDown : Minus;
  const momentumColor = isRising
    ? "text-emerald-400"
    : isFalling
    ? "text-rose-400"
    : "text-slate-400";

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <svg width={w} height={h} className="shrink-0" viewBox={`0 0 ${w} ${h}`}>
        <polyline
          points={points}
          fill="none"
          stroke={strokeColor}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <MomentumIcon className={cn("h-3 w-3 shrink-0", momentumColor)} />
    </div>
  );
});
