import { Clock, Target, TrendingUp, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompactKpiChipsProps {
  amountRemaining: number;
  dailyNeededFromNow: number;
  remainingDays: number;
  trendPercent: number;
  isAhead: boolean;
  hourlyRate: number;
  isHourlyLoading?: boolean;
}

export function CompactKpiChips({
  amountRemaining,
  dailyNeededFromNow,
  remainingDays,
  trendPercent,
  isAhead,
  hourlyRate,
  isHourlyLoading,
}: CompactKpiChipsProps) {
  const chips = [
    {
      label: "Resterende",
      value: `${Math.round(amountRemaining).toLocaleString("da-DK")} kr`,
      subLabel: `${remainingDays} dage`,
      icon: Target,
      colorClass: "text-primary",
      bgClass: "bg-primary/10 border-primary/20",
    },
    {
      label: "Dagligt mål",
      value: `${Math.round(dailyNeededFromNow).toLocaleString("da-DK")} kr`,
      subLabel: "for at nå målet",
      icon: TrendingUp,
      colorClass: "text-primary",
      bgClass: "bg-primary/10 border-primary/20",
    },
    {
      label: "Din timeløn",
      value: isHourlyLoading ? "..." : `${Math.round(hourlyRate).toLocaleString("da-DK")} kr/t`,
      subLabel: null,
      icon: Clock,
      colorClass: hourlyRate >= 200 ? "text-success" : hourlyRate >= 150 ? "text-warning" : "text-muted-foreground",
      bgClass: hourlyRate >= 200 ? "bg-success/10 border-success/20" : hourlyRate >= 150 ? "bg-warning/10 border-warning/20" : "bg-muted/50 border-border",
    },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
      {chips.map((chip) => (
        <div
          key={chip.label}
          className={cn(
            "flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors",
            chip.bgClass
          )}
        >
          <chip.icon className={cn("h-4 w-4", chip.colorClass)} />
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground leading-tight">{chip.label}</span>
            <div className="flex items-baseline gap-1">
              <span className={cn("text-sm font-bold leading-tight", chip.colorClass)}>
                {chip.value}
              </span>
              {chip.subLabel && (
                <span className="text-[10px] text-muted-foreground">{chip.subLabel}</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
