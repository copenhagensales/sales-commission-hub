import { memo, useState, useMemo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SparklineDetailModal } from "./SparklineDetailModal";

interface ProvisionSparklineProps {
  data: number[]; // 7 values [day-6 ... today]
  divisionAvg?: number[]; // 7 values, division average per day
  playerName?: string;
  size?: "sm" | "md";
  className?: string;
}

const DAY_LABELS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

function getDayLabels(): string[] {
  const now = new Date();
  const todayIdx = (now.getDay() + 6) % 7; // Mon=0
  const labels: string[] = [];
  for (let i = 6; i >= 0; i--) {
    labels.push(DAY_LABELS[(todayIdx - i + 7) % 7]);
  }
  return labels;
}

export const ProvisionSparkline = memo(function ProvisionSparkline({
  data,
  divisionAvg,
  playerName,
  size = "md",
  className,
}: ProvisionSparklineProps) {
  const [modalOpen, setModalOpen] = useState(false);

  if (!data || data.length === 0) return null;

  const isMd = size === "md";
  const w = isMd ? 160 : 110;
  const h = isMd ? 44 : 32;
  const padding = 4;
  const strokeW = isMd ? 2 : 1.5;

  const allValues = [...data, ...(divisionAvg || [])];
  const max = Math.max(...allValues, 1);

  const toPoint = (v: number, i: number, total: number) => ({
    x: padding + (i / (total - 1)) * (w - padding * 2),
    y: h - padding - (v / max) * (h - padding * 2),
  });

  const points = data.map((v, i) => toPoint(v, i, data.length));

  // Smooth bezier path (catmull-rom to cubic bezier)
  const smoothPath = useMemo(() => {
    if (points.length < 2) return "";
    const pts = points;
    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(i - 1, 0)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(i + 2, pts.length - 1)];
      const tension = 0.3;
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;
      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  }, [points]);

  // Area path for gradient fill
  const areaPath = useMemo(() => {
    if (!smoothPath) return "";
    return `${smoothPath} L ${points[points.length - 1].x},${h} L ${points[0].x},${h} Z`;
  }, [smoothPath, points, h]);

  // Division average smooth path
  const avgPath = useMemo(() => {
    if (!divisionAvg) return null;
    const avgPts = divisionAvg.map((v, i) => toPoint(v, i, divisionAvg.length));
    if (avgPts.length < 2) return null;
    let d = `M ${avgPts[0].x},${avgPts[0].y}`;
    for (let i = 0; i < avgPts.length - 1; i++) {
      const p0 = avgPts[Math.max(i - 1, 0)];
      const p1 = avgPts[i];
      const p2 = avgPts[i + 1];
      const p3 = avgPts[Math.min(i + 2, avgPts.length - 1)];
      const tension = 0.3;
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;
      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  }, [divisionAvg, w, h, max]);

  // Momentum
  const recent = data.slice(-3);
  const older = data.slice(0, 3);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
  const isRising = recentAvg > olderAvg * 1.05;
  const isFalling = recentAvg < olderAvg * 0.95;

  const colorHsl = isRising
    ? "142 71% 45%"
    : isFalling
    ? "0 84% 60%"
    : "217 91% 60%";

  const strokeColor = `hsl(${colorHsl})`;

  const MomentumIcon = isRising ? TrendingUp : isFalling ? TrendingDown : Minus;
  const momentumColor = isRising
    ? "text-emerald-400"
    : isFalling
    ? "text-rose-400"
    : "text-slate-400";

  // Min/max indices
  const minIdx = data.indexOf(Math.min(...data));
  const maxIdx = data.indexOf(Math.max(...data));

  // Endpoint (last point)
  const lastPoint = points[points.length - 1];

  // Total path length estimate for draw animation
  let pathLength = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    pathLength += Math.sqrt(dx * dx + dy * dy);
  }

  // Tooltip content
  const dayLabels = getDayLabels();
  const tooltipText = data
    .map((v, i) => `${dayLabels[i]}: ${v.toLocaleString("da-DK", { maximumFractionDigits: 0 })} kr`)
    .join("\n");

  // Performance vs division average
  const perfLabel = useMemo(() => {
    if (!divisionAvg) return null;
    const playerTotal = data.reduce((a, b) => a + b, 0);
    const avgTotal = divisionAvg.reduce((a, b) => a + b, 0);
    if (avgTotal === 0) return null;
    const pctDiff = ((playerTotal - avgTotal) / avgTotal) * 100;
    if (Math.abs(pctDiff) < 2) return null;
    return { pct: Math.round(pctDiff), above: pctDiff > 0 };
  }, [data, divisionAvg]);

  const gradientId = `spark-grad-${isRising ? "up" : isFalling ? "down" : "flat"}`;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn("flex flex-col items-center gap-0.5 cursor-pointer", className)}
            onClick={() => setModalOpen(true)}
          >
            <div className="flex items-center gap-1">
              <svg
                width={w}
                height={h}
                className="shrink-0"
                viewBox={`0 0 ${w} ${h}`}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={strokeColor} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={strokeColor} stopOpacity={0.02} />
                  </linearGradient>
                </defs>

                {/* Gradient fill area */}
                <path d={areaPath} fill={`url(#${gradientId})`} />

                {/* Division average dashed line */}
                {avgPath && (
                  <path
                    d={avgPath}
                    fill="none"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={1}
                    strokeDasharray="3 2"
                    strokeLinecap="round"
                    opacity={0.35}
                  />
                )}

                {/* Main smooth line with draw animation */}
                <path
                  d={smoothPath}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeW}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="sparkline-draw"
                  style={{
                    strokeDasharray: pathLength * 1.5,
                    strokeDashoffset: pathLength * 1.5,
                    animationDuration: "0.8s",
                    "--sparkline-path-length": pathLength * 1.5,
                  } as React.CSSProperties}
                />

                {/* Min marker */}
                {isMd && minIdx !== maxIdx && (
                  <circle
                    cx={points[minIdx].x}
                    cy={points[minIdx].y}
                    r={2}
                    fill="hsl(var(--muted-foreground))"
                    opacity={0.5}
                  />
                )}

                {/* Max marker */}
                {isMd && minIdx !== maxIdx && (
                  <circle
                    cx={points[maxIdx].x}
                    cy={points[maxIdx].y}
                    r={2.5}
                    fill={strokeColor}
                    opacity={0.7}
                  />
                )}

                {/* Invisible hit areas for hover */}
                {isMd && points.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={8}
                    fill="transparent"
                    className="hover:fill-current opacity-0 hover:opacity-10"
                  >
                    <title>{`${dayLabels[i]}: ${data[i].toLocaleString("da-DK", { maximumFractionDigits: 0 })} kr`}</title>
                  </circle>
                ))}

                {/* Pulsating endpoint */}
                <circle
                  cx={lastPoint.x}
                  cy={lastPoint.y}
                  r={isMd ? 3 : 2}
                  fill={strokeColor}
                  className="sparkline-pulse-dot"
                />
              </svg>
              <MomentumIcon className={cn("h-3 w-3 shrink-0", momentumColor)} />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs whitespace-pre font-mono">
          {tooltipText}
        </TooltipContent>
      </Tooltip>

      <SparklineDetailModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        data={data}
        divisionAvg={divisionAvg}
        playerName={playerName}
        dayLabels={dayLabels}
        isRising={isRising}
        isFalling={isFalling}
      />
    </TooltipProvider>
  );
});
