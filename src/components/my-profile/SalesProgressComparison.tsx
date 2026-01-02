import { TrendingUp, TrendingDown, Minus, ArrowRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface SalesProgressComparisonProps {
  currentPeriodTotal: number;
  previousPeriodTotal?: number;
  daysPassedInPeriod: number;
  previousPeriodAtSameDay?: number;
}

export function SalesProgressComparison({
  currentPeriodTotal,
  previousPeriodTotal = 0,
  daysPassedInPeriod,
  previousPeriodAtSameDay = 0,
}: SalesProgressComparisonProps) {
  // If we don't have previous period data, don't show comparison
  if (previousPeriodTotal === 0 && previousPeriodAtSameDay === 0) {
    return null;
  }

  const vsAtSameDay = previousPeriodAtSameDay > 0
    ? ((currentPeriodTotal - previousPeriodAtSameDay) / previousPeriodAtSameDay) * 100
    : 0;

  const vsFinal = previousPeriodTotal > 0
    ? ((currentPeriodTotal - previousPeriodTotal) / previousPeriodTotal) * 100
    : 0;

  const isAheadOfLastPeriod = currentPeriodTotal > previousPeriodAtSameDay;
  const willBeatLastPeriod = vsFinal > 0;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        📊 vs. Forrige periode
      </h4>
      <div className="space-y-4">
        {/* Comparison at same day */}
        {previousPeriodAtSameDay > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Dag {daysPassedInPeriod} sidst
              </span>
              <span className="font-medium">
                {previousPeriodAtSameDay.toLocaleString("da-DK")} kr
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isAheadOfLastPeriod ? (
                <TrendingUp className="h-4 w-4 text-green-400" />
              ) : vsAtSameDay === 0 ? (
                <Minus className="h-4 w-4 text-muted-foreground" />
              ) : (
                <TrendingDown className="h-4 w-4 text-amber-400" />
              )}
              <span className={
                isAheadOfLastPeriod 
                  ? "text-green-400 font-medium text-sm" 
                  : vsAtSameDay === 0 
                    ? "text-muted-foreground text-sm"
                    : "text-amber-400 font-medium text-sm"
              }>
                {vsAtSameDay > 0 ? "+" : ""}{Math.round(vsAtSameDay)}% vs. sidst
              </span>
            </div>
          </div>
        )}

        {/* Final comparison */}
        {previousPeriodTotal > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Forrige periode total
              </span>
              <span className="font-medium">
                {previousPeriodTotal.toLocaleString("da-DK")} kr
              </span>
            </div>
            <Progress 
              value={Math.min(100, (currentPeriodTotal / previousPeriodTotal) * 100)} 
              className="h-1.5 [&>div]:bg-primary"
            />
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <ArrowRight className="h-3 w-3" />
              <span>
                {currentPeriodTotal >= previousPeriodTotal 
                  ? "Du har allerede slået forrige periode! 🎉"
                  : `${(previousPeriodTotal - currentPeriodTotal).toLocaleString("da-DK")} kr til at slå`}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
