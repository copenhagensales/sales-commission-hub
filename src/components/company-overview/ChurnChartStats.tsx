import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Point {
  churnRate: number;
  cohortSize: number;
}

interface Props {
  data: Point[];
  label?: string;
}

/**
 * Compact stats row shown above churn charts.
 * For churn: lower is better → down = green.
 */
export function ChurnChartStats({ data, label = "churn" }: Props) {
  const valid = data.filter(d => d.cohortSize > 0);
  const last = valid[valid.length - 1];
  const latest = last?.churnRate ?? 0;

  const avg = (arr: Point[]) =>
    arr.length ? arr.reduce((s, d) => s + d.churnRate, 0) / arr.length : 0;

  const avg12 = avg(valid);
  const last3 = valid.slice(-3);
  const prev3 = valid.slice(-6, -3);
  const avgLast3 = avg(last3);
  const avgPrev3 = avg(prev3);
  const delta = avgLast3 - avgPrev3;

  const trendTone =
    Math.abs(delta) < 1
      ? "neutral"
      : delta < 0
      ? "good"
      : "bad";

  const TrendIcon =
    trendTone === "neutral" ? Minus : trendTone === "good" ? TrendingDown : TrendingUp;

  const toneClass =
    trendTone === "good"
      ? "text-green-500"
      : trendTone === "bad"
      ? "text-red-500"
      : "text-muted-foreground";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      <Stat label="Seneste måned" value={`${latest.toFixed(1)}%`} sub={last ? `${last.cohortSize} nye` : "—"} />
      <Stat label="3-mdr snit" value={`${avgLast3.toFixed(1)}%`} />
      <Stat label="12-mdr snit" value={`${avg12.toFixed(1)}%`} />
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground">Trend (3 vs. forrige 3)</p>
        <div className={cn("flex items-center gap-1.5 mt-1", toneClass)}>
          <TrendIcon className="h-4 w-4" />
          <span className="text-lg font-semibold">
            {delta > 0 ? "+" : ""}
            {delta.toFixed(1)} pp
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {trendTone === "good" ? `Faldende ${label} – positivt` : trendTone === "bad" ? `Stigende ${label}` : "Stabil"}
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold mt-1">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

/**
 * Adds a 3-month trailing moving average field to each point.
 */
export function withMovingAverage<T extends { churnRate: number }>(
  data: T[],
  key: string = "churnMA"
): (T & Record<string, number | null>)[] {
  return data.map((d, i) => {
    const window = data.slice(Math.max(0, i - 2), i + 1);
    const ma = window.reduce((s, x) => s + x.churnRate, 0) / window.length;
    return { ...d, [key]: Math.round(ma * 10) / 10 };
  });
}
