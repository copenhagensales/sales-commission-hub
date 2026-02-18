import { useMemo } from "react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface DataFreshnessBadgeProps {
  calculatedAt: string | null | undefined;
  /** Warning threshold in minutes (default: 5) */
  warnMinutes?: number;
  /** Error threshold in minutes (default: 15) */
  errorMinutes?: number;
  className?: string;
  /** Compact mode for tight spaces */
  compact?: boolean;
}

/**
 * Displays when data was last refreshed with color-coded freshness indicator.
 * Green = fresh, Yellow = stale (>warnMinutes), Red = very stale (>errorMinutes).
 */
export function DataFreshnessBadge({
  calculatedAt,
  warnMinutes = 5,
  errorMinutes = 15,
  className,
  compact = false,
}: DataFreshnessBadgeProps) {
  const { label, status } = useMemo(() => {
    if (!calculatedAt) {
      return { label: "Ingen data", status: "unknown" as const };
    }

    const now = new Date();
    const calcDate = new Date(calculatedAt);
    const diffMs = now.getTime() - calcDate.getTime();
    const diffMinutes = Math.floor(diffMs / 60_000);

    const timeStr = format(calcDate, "HH:mm", { locale: da });
    const label = compact ? timeStr : `Opdateret kl. ${timeStr}`;

    if (diffMinutes >= errorMinutes) {
      return { label, status: "error" as const };
    }
    if (diffMinutes >= warnMinutes) {
      return { label, status: "warn" as const };
    }
    return { label, status: "ok" as const };
  }, [calculatedAt, warnMinutes, errorMinutes, compact]);

  const statusStyles = {
    ok: "text-emerald-600 dark:text-emerald-400",
    warn: "text-amber-600 dark:text-amber-400",
    error: "text-red-600 dark:text-red-400",
    unknown: "text-muted-foreground",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-medium tabular-nums",
        statusStyles[status],
        className
      )}
      title={
        calculatedAt
          ? `Data beregnet: ${format(new Date(calculatedAt), "d. MMM HH:mm:ss", { locale: da })}`
          : "Ingen data tilgængelig"
      }
    >
      <Clock className="h-3 w-3" />
      {label}
    </span>
  );
}
