import { Flame, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGamificationConfig, getStreakBadge } from "@/hooks/useGamificationConfig";

interface RecordData {
  record_type: string;
  record_value: number;
  achieved_at: string;
  period_reference?: string;
}

interface CompactSalesRecordsProps {
  bestDayRecord?: RecordData | null;
  bestWeekRecord?: RecordData | null;
  longestStreak: number;
  currentStreak: number;
  todayTotal: number;
  currentWeekTotal?: number;
  hitDailyGoal?: boolean;
}

export function CompactSalesRecords({
  bestDayRecord,
  bestWeekRecord,
  longestStreak,
  currentStreak,
  todayTotal,
  currentWeekTotal = 0,
  hitDailyGoal = true,
}: CompactSalesRecordsProps) {
  const { config } = useGamificationConfig();
  
  const bestDayValue = bestDayRecord?.record_value || 0;
  const bestWeekValue = bestWeekRecord?.record_value || 0;
  
  const todayVsBestDay = bestDayValue > 0 ? (todayTotal / bestDayValue) * 100 : 0;
  const weekVsBestWeek = bestWeekValue > 0 ? (currentWeekTotal / bestWeekValue) * 100 : 0;
  
  const isOnLongestStreak = currentStreak >= longestStreak && currentStreak > 0;
  const streakAtRisk = !hitDailyGoal && currentStreak > 0;
  const streakBadge = getStreakBadge(currentStreak, config.streakThresholds);
  
  const brokeNewDayRecord = todayVsBestDay >= 100 && bestDayValue > 0;
  const brokeNewWeekRecord = weekVsBestWeek >= 100 && bestWeekValue > 0;

  return (
    <div className="space-y-3">
      {/* Streak inline with records */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className={cn(
            "h-4 w-4",
            currentStreak > 0 ? "text-warning" : "text-muted-foreground/40"
          )} />
          <span className={cn(
            "text-lg font-bold tabular-nums",
            currentStreak > 0 ? "text-warning" : "text-muted-foreground"
          )}>
            {currentStreak}
          </span>
          <span className="text-xs text-muted-foreground">
            {currentStreak === 1 ? "dag i træk" : "dage i træk"}
          </span>
          {streakBadge.badge && (
            <span className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
              streakBadge.badge === "legendary" && "bg-primary/15 text-primary",
              streakBadge.badge === "fire" && "bg-warning/15 text-warning",
              streakBadge.badge === "hot" && "bg-warning/10 text-warning/80"
            )}>
              {streakBadge.badge === "legendary" && "👑"}
              {streakBadge.badge === "fire" && "🔥"}
              {streakBadge.badge === "hot" && "🌡️"}
            </span>
          )}
        </div>
        
        {isOnLongestStreak && currentStreak > 1 && (
          <span className="text-xs text-success font-medium">Ny rekord! 🎉</span>
        )}
      </div>

      {/* Compact record row */}
      <div className="grid grid-cols-2 gap-3">
        <div className={cn(
          "rounded-lg border p-3 transition-colors",
          brokeNewDayRecord ? "bg-success/10 border-success/30" : "bg-card border-border"
        )}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground uppercase">Bedste dag</span>
            {brokeNewDayRecord && <Trophy className="h-3 w-3 text-success" />}
          </div>
          <p className="text-base font-bold">
            {bestDayValue > 0 ? `${bestDayValue.toLocaleString("da-DK")} kr` : "–"}
          </p>
          {bestDayValue > 0 && !brokeNewDayRecord && todayVsBestDay >= 70 && (
            <p className="text-[10px] text-muted-foreground mt-1">
              {Math.round(todayVsBestDay)}% af rekord
            </p>
          )}
        </div>

        <div className={cn(
          "rounded-lg border p-3 transition-colors",
          brokeNewWeekRecord ? "bg-success/10 border-success/30" : "bg-card border-border"
        )}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground uppercase">Bedste uge</span>
            {brokeNewWeekRecord && <Trophy className="h-3 w-3 text-success" />}
          </div>
          <p className="text-base font-bold">
            {bestWeekValue > 0 ? `${bestWeekValue.toLocaleString("da-DK")} kr` : "–"}
          </p>
          {bestWeekValue > 0 && !brokeNewWeekRecord && weekVsBestWeek >= 70 && (
            <p className="text-[10px] text-muted-foreground mt-1">
              {Math.round(weekVsBestWeek)}% af rekord
            </p>
          )}
        </div>
      </div>

      {/* Streak motivation */}
      {streakAtRisk && (
        <p className="text-xs text-warning bg-warning/10 rounded px-2 py-1.5 text-center">
          Hold momentum! Overgå gårsdagen og forlæng din streak 💪
        </p>
      )}
    </div>
  );
}
