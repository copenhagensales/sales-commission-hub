import { Trophy, TrendingUp, Calendar, Flame } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { da } from "date-fns/locale";

interface RecordData {
  record_type: string;
  record_value: number;
  achieved_at: string;
  period_reference?: string;
}

interface SalesRecordsProps {
  bestDayRecord?: RecordData | null;
  bestWeekRecord?: RecordData | null;
  longestStreak: number;
  currentStreak: number;
  todayTotal: number;
  currentPeriodTotal: number;
}

export function SalesRecords({
  bestDayRecord,
  bestWeekRecord,
  longestStreak,
  currentStreak,
  todayTotal,
  currentPeriodTotal,
}: SalesRecordsProps) {
  const bestDayValue = bestDayRecord?.record_value || 0;
  const bestWeekValue = bestWeekRecord?.record_value || 0;
  const todayVsBestDay = bestDayValue > 0 ? (todayTotal / bestDayValue) * 100 : 0;
  const streakToRecord = longestStreak - currentStreak;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        🏆 Dine rekorder
      </h4>
      <div className="space-y-4">
        {/* Best Day Record */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-400" />
              <span className="text-muted-foreground">Bedste dag</span>
            </div>
            <span className="font-semibold">
              {bestDayValue > 0 
                ? `${bestDayValue.toLocaleString("da-DK")} kr`
                : "Ingen rekord endnu"}
            </span>
          </div>
          {bestDayValue > 0 && (
            <>
              <Progress 
                value={Math.min(100, todayVsBestDay)} 
                className="h-1.5 [&>div]:bg-blue-400"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>I dag: {todayTotal.toLocaleString("da-DK")} kr</span>
                <span className={todayVsBestDay >= 100 ? "text-green-400 font-medium" : ""}>
                  {todayVsBestDay >= 100 
                    ? "🎉 Ny rekord!"
                    : `${Math.round(todayVsBestDay)}% af rekord`}
                </span>
              </div>
            </>
          )}
          {bestDayRecord?.achieved_at && (
            <p className="text-xs text-muted-foreground/70">
              Sat {format(new Date(bestDayRecord.achieved_at), "d. MMM yyyy", { locale: da })}
            </p>
          )}
        </div>

        {/* Best Week Record */}
        {bestWeekValue > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-400" />
                <span className="text-muted-foreground">Bedste uge</span>
              </div>
              <span className="font-semibold">
                {bestWeekValue.toLocaleString("da-DK")} kr
              </span>
            </div>
          </div>
        )}

        {/* Longest Streak */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-400" />
              <span className="text-muted-foreground">Længste streak</span>
            </div>
            <span className="font-semibold">
              {longestStreak > 0 ? `${longestStreak} dage` : "Ingen streak endnu"}
            </span>
          </div>
          {longestStreak > 0 && currentStreak > 0 && (
            <div className="text-xs text-muted-foreground">
              {currentStreak === longestStreak ? (
                <span className="text-green-400">🔥 Du er på din længste streak!</span>
              ) : streakToRecord > 0 ? (
                <span>{streakToRecord} {streakToRecord === 1 ? "dag" : "dage"} til ny rekord!</span>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
