import { Flame, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useGamificationConfig, getStreakBadge } from "@/hooks/useGamificationConfig";

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
  dailyTarget?: number;
  currentWeekTotal?: number;
  hitDailyGoal?: boolean;
}

export function SalesRecords({
  bestDayRecord,
  bestWeekRecord,
  longestStreak,
  currentStreak,
  todayTotal,
  dailyTarget = 0,
  currentWeekTotal = 0,
  hitDailyGoal = true,
}: SalesRecordsProps) {
  const { config } = useGamificationConfig();
  
  const bestDayValue = bestDayRecord?.record_value || 0;
  const bestWeekValue = bestWeekRecord?.record_value || 0;
  
  // Calculate progress percentages
  const todayVsBestDay = bestDayValue > 0 ? (todayTotal / bestDayValue) * 100 : 0;
  const weekVsBestWeek = bestWeekValue > 0 ? (currentWeekTotal / bestWeekValue) * 100 : 0;
  
  // Streak calculations
  const streakToRecord = longestStreak - currentStreak;
  const isOnLongestStreak = currentStreak >= longestStreak && currentStreak > 0;
  const streakAtRisk = !hitDailyGoal && currentStreak > 0;
  
  // Get streak badge
  const streakBadge = getStreakBadge(currentStreak, config.streakThresholds);
  
  // Record states
  const brokeNewDayRecord = todayVsBestDay >= 100 && bestDayValue > 0;
  const brokeNewWeekRecord = weekVsBestWeek >= 100 && bestWeekValue > 0;
  const nearDayRecord = todayVsBestDay >= 70 && todayVsBestDay < 100;
  const nearWeekRecord = weekVsBestWeek >= 70 && weekVsBestWeek < 100;

  return (
    <div className="space-y-4">
      {/* Header */}
      <h4 className="text-sm font-medium text-muted-foreground">
        🏆 Rekorder & Streak
      </h4>

      {/* Streak Section - Clean inline design */}
      <div className="rounded-lg bg-muted/30 p-4">
        {/* Main streak row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Flame className={cn(
              "h-5 w-5",
              currentStreak > 0 ? "text-orange-500" : "text-muted-foreground/40"
            )} />
            <div className="flex items-baseline gap-2">
              <span className={cn(
                "text-2xl font-bold tabular-nums",
                currentStreak > 0 ? "text-orange-500" : "text-muted-foreground"
              )}>
                {currentStreak}
              </span>
              <span className="text-sm text-muted-foreground">
                {currentStreak === 1 ? "dags streak" : "dages streak"}
              </span>
            </div>
          </div>
          
          {/* Badge */}
          {streakBadge.badge && (
            <span className={cn(
              "text-xs font-medium px-2 py-1 rounded-full",
              streakBadge.badge === "legendary" && "bg-purple-500/15 text-purple-400",
              streakBadge.badge === "fire" && "bg-orange-500/15 text-orange-400",
              streakBadge.badge === "hot" && "bg-amber-500/15 text-amber-400"
            )}>
              {streakBadge.badge === "legendary" && "👑 Legendarisk"}
              {streakBadge.badge === "fire" && "🔥 Fire"}
              {streakBadge.badge === "hot" && "🌡️ Hot"}
            </span>
          )}
        </div>
        
        {/* Streak status text */}
        {currentStreak > 0 && (
          <p className="text-xs text-muted-foreground mb-3">
            {isOnLongestStreak && currentStreak > 1 ? (
              <span className="text-green-400">🎉 Du er på din længste streak!</span>
            ) : streakToRecord > 0 ? (
              <span>{streakToRecord} {streakToRecord === 1 ? "dag" : "dage"} til ny rekord ({longestStreak})</span>
            ) : null}
          </p>
        )}
        
        {currentStreak === 0 && (
          <p className="text-xs text-muted-foreground">
            Start en streak ved at nå dit dagsmål
          </p>
        )}
        
        {/* Streak at Risk Alert */}
        {streakAtRisk && (
          <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2 mt-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>Streak i fare – nå dit dagsmål for at beholde den</span>
          </div>
        )}
      </div>

      {/* Record Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Best Day */}
        <div className={cn(
          "rounded-lg border p-4 transition-colors",
          brokeNewDayRecord 
            ? "bg-green-500/10 border-green-500/30"
            : "bg-card border-border"
        )}>
          <p className="text-xs text-muted-foreground mb-1">Bedste dag</p>
          <p className="text-xl font-bold mb-3">
            {bestDayValue > 0 ? `${bestDayValue.toLocaleString("da-DK")} kr` : "—"}
          </p>
          
          {bestDayValue > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>I dag: {todayTotal.toLocaleString("da-DK")} kr</span>
                <span>{Math.round(todayVsBestDay)}%</span>
              </div>
              <Progress 
                value={Math.min(100, todayVsBestDay)} 
                className={cn(
                  "h-1.5",
                  brokeNewDayRecord && "[&>div]:bg-green-500"
                )}
              />
              {brokeNewDayRecord ? (
                <p className="text-xs text-green-400 font-medium">NY REKORD! 🎉</p>
              ) : nearDayRecord ? (
                <p className="text-xs text-muted-foreground">
                  {(bestDayValue - todayTotal).toLocaleString("da-DK")} kr til rekord
                </p>
              ) : null}
            </div>
          )}
        </div>

        {/* Best Week */}
        <div className={cn(
          "rounded-lg border p-4 transition-colors",
          brokeNewWeekRecord 
            ? "bg-green-500/10 border-green-500/30"
            : "bg-card border-border"
        )}>
          <p className="text-xs text-muted-foreground mb-1">Bedste uge</p>
          <p className="text-xl font-bold mb-3">
            {bestWeekValue > 0 ? `${bestWeekValue.toLocaleString("da-DK")} kr` : "—"}
          </p>
          
          {bestWeekValue > 0 && currentWeekTotal > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Denne uge: {currentWeekTotal.toLocaleString("da-DK")} kr</span>
                <span>{Math.round(weekVsBestWeek)}%</span>
              </div>
              <Progress 
                value={Math.min(100, weekVsBestWeek)} 
                className={cn(
                  "h-1.5",
                  brokeNewWeekRecord && "[&>div]:bg-green-500"
                )}
              />
              {brokeNewWeekRecord ? (
                <p className="text-xs text-green-400 font-medium">NY REKORD! 🎉</p>
              ) : nearWeekRecord ? (
                <p className="text-xs text-muted-foreground">
                  {(bestWeekValue - currentWeekTotal).toLocaleString("da-DK")} kr til rekord
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
