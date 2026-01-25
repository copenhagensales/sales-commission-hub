import { Trophy, TrendingUp, Calendar, Flame, AlertTriangle, Award, Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { da } from "date-fns/locale";
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
  currentPeriodTotal,
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
  
  // Get streak badge info
  const streakBadge = getStreakBadge(currentStreak, config.streakThresholds);
  
  // Near-miss effect (>80% of record)
  const isNearDayRecord = todayVsBestDay >= 80 && todayVsBestDay < 100;
  const isNearWeekRecord = weekVsBestWeek >= 80 && weekVsBestWeek < 100;
  const brokeNewDayRecord = todayVsBestDay >= 100 && bestDayValue > 0;
  const brokeNewWeekRecord = weekVsBestWeek >= 100 && bestWeekValue > 0;

  // Streak milestone progress (to next badge)
  const getStreakMilestoneProgress = () => {
    const { hot, fire, legendary } = config.streakThresholds;
    if (currentStreak >= legendary) return { progress: 100, nextMilestone: legendary, label: "Legendarisk!" };
    if (currentStreak >= fire) return { progress: (currentStreak / legendary) * 100, nextMilestone: legendary, label: `${legendary - currentStreak} dage til Legendarisk` };
    if (currentStreak >= hot) return { progress: (currentStreak / fire) * 100, nextMilestone: fire, label: `${fire - currentStreak} dage til 🔥 Fire` };
    return { progress: (currentStreak / hot) * 100, nextMilestone: hot, label: `${hot - currentStreak} dage til 🌡️ Hot` };
  };
  
  const milestoneProgress = getStreakMilestoneProgress();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          🏆 Dine rekorder & streaks
        </h4>
      </div>

      {/* Streak Hero Section */}
      <div className={cn(
        "relative rounded-xl p-4 border-2 transition-all",
        currentStreak > 0 
          ? "bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-transparent border-orange-500/30"
          : "bg-muted/30 border-muted/50"
      )}>
        {/* Streak at Risk Alert */}
        {streakAtRisk && (
          <div className="absolute -top-3 left-4 right-4 bg-destructive text-destructive-foreground text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Din streak er i fare! Nå dit dagsmål for at bevare den</span>
          </div>
        )}
        
        <div className="flex items-center gap-4">
          {/* Streak Counter */}
          <div className={cn(
            "flex flex-col items-center justify-center w-20 h-20 rounded-full border-4 transition-all",
            currentStreak > 0 
              ? "border-orange-500 bg-gradient-to-br from-orange-500/20 to-amber-500/10"
              : "border-muted bg-muted/30"
          )}>
            <Flame className={cn(
              "h-6 w-6 mb-0.5",
              currentStreak > 0 ? "text-orange-500 animate-pulse" : "text-muted-foreground/50"
            )} />
            <span className={cn(
              "text-2xl font-bold tabular-nums",
              currentStreak > 0 ? "text-orange-500" : "text-muted-foreground"
            )}>
              {currentStreak}
            </span>
          </div>
          
          {/* Streak Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg font-semibold">
                {currentStreak > 0 ? "Dages streak" : "Ingen aktiv streak"}
              </span>
              {streakBadge.badge && (
                <span className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full",
                  streakBadge.badge === "legendary" && "bg-purple-500/20 text-purple-400",
                  streakBadge.badge === "fire" && "bg-orange-500/20 text-orange-400",
                  streakBadge.badge === "hot" && "bg-amber-500/20 text-amber-400"
                )}>
                  {streakBadge.badge === "legendary" && "👑 Legendarisk"}
                  {streakBadge.badge === "fire" && "🔥 Fire"}
                  {streakBadge.badge === "hot" && "🌡️ Hot"}
                </span>
              )}
            </div>
            
            {/* Streak Status Message */}
            <p className="text-sm text-muted-foreground mb-2">
              {isOnLongestStreak && currentStreak > 1 ? (
                <span className="text-green-400 font-medium">🎉 Du er på din længste streak nogensinde!</span>
              ) : streakToRecord > 0 && currentStreak > 0 ? (
                <span>{streakToRecord} {streakToRecord === 1 ? "dag" : "dage"} til ny personlig rekord</span>
              ) : currentStreak === 0 ? (
                <span>Start en ny streak ved at nå dit dagsmål</span>
              ) : null}
            </p>
            
            {/* Milestone Progress */}
            {currentStreak > 0 && !streakBadge.badge?.includes("legendary") && (
              <div className="space-y-1">
                <Progress 
                  value={milestoneProgress.progress} 
                  className="h-2 [&>div]:bg-gradient-to-r [&>div]:from-orange-500 [&>div]:to-amber-400"
                />
                <p className="text-xs text-muted-foreground">{milestoneProgress.label}</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Longest Streak Badge */}
        {longestStreak > 0 && (
          <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2 text-xs text-muted-foreground">
            <Award className="h-3.5 w-3.5 text-amber-400" />
            <span>Personlig rekord: <strong className="text-foreground">{longestStreak} dage</strong></span>
          </div>
        )}
      </div>

      {/* Record Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Best Day Record */}
        <div className={cn(
          "rounded-lg border p-3 transition-all",
          brokeNewDayRecord 
            ? "bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-green-500/30"
            : isNearDayRecord 
              ? "bg-gradient-to-br from-amber-500/10 to-yellow-500/5 border-amber-500/30 animate-pulse"
              : "bg-card border-border"
        )}>
          <div className="flex items-center gap-2 mb-2">
            <div className={cn(
              "p-1.5 rounded-md",
              brokeNewDayRecord ? "bg-green-500/20" : "bg-blue-500/20"
            )}>
              <Calendar className={cn(
                "h-4 w-4",
                brokeNewDayRecord ? "text-green-400" : "text-blue-400"
              )} />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Bedste dag</span>
          </div>
          
          <p className="text-xl font-bold mb-1">
            {bestDayValue > 0 ? `${bestDayValue.toLocaleString("da-DK")} kr` : "—"}
          </p>
          
          {bestDayValue > 0 && (
            <>
              <Progress 
                value={Math.min(100, todayVsBestDay)} 
                className={cn(
                  "h-2 mb-1.5",
                  brokeNewDayRecord && "[&>div]:bg-green-500",
                  isNearDayRecord && "[&>div]:bg-gradient-to-r [&>div]:from-amber-500 [&>div]:to-yellow-400"
                )}
              />
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">
                  I dag: {todayTotal.toLocaleString("da-DK")} kr
                </p>
                {brokeNewDayRecord ? (
                  <p className="text-xs text-green-400 font-medium flex items-center gap-1">
                    <Zap className="h-3 w-3" /> NY REKORD! 🎉
                  </p>
                ) : isNearDayRecord ? (
                  <p className="text-xs text-amber-400 font-medium">
                    Kun {(bestDayValue - todayTotal).toLocaleString("da-DK")} kr til rekord! 🎯
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {Math.round(todayVsBestDay)}% af rekord
                  </p>
                )}
              </div>
            </>
          )}
          
          {bestDayRecord?.achieved_at && !brokeNewDayRecord && (
            <p className="text-[10px] text-muted-foreground/70 mt-1.5">
              Sat {format(new Date(bestDayRecord.achieved_at), "d. MMM yyyy", { locale: da })}
            </p>
          )}
        </div>

        {/* Best Week Record */}
        <div className={cn(
          "rounded-lg border p-3 transition-all",
          brokeNewWeekRecord 
            ? "bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-green-500/30"
            : isNearWeekRecord 
              ? "bg-gradient-to-br from-amber-500/10 to-yellow-500/5 border-amber-500/30 animate-pulse"
              : "bg-card border-border"
        )}>
          <div className="flex items-center gap-2 mb-2">
            <div className={cn(
              "p-1.5 rounded-md",
              brokeNewWeekRecord ? "bg-green-500/20" : "bg-green-500/20"
            )}>
              <TrendingUp className={cn(
                "h-4 w-4",
                brokeNewWeekRecord ? "text-green-400" : "text-green-400"
              )} />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Bedste uge</span>
          </div>
          
          <p className="text-xl font-bold mb-1">
            {bestWeekValue > 0 ? `${bestWeekValue.toLocaleString("da-DK")} kr` : "—"}
          </p>
          
          {bestWeekValue > 0 && currentWeekTotal > 0 && (
            <>
              <Progress 
                value={Math.min(100, weekVsBestWeek)} 
                className={cn(
                  "h-2 mb-1.5",
                  brokeNewWeekRecord && "[&>div]:bg-green-500",
                  isNearWeekRecord && "[&>div]:bg-gradient-to-r [&>div]:from-amber-500 [&>div]:to-yellow-400"
                )}
              />
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">
                  Denne uge: {currentWeekTotal.toLocaleString("da-DK")} kr
                </p>
                {brokeNewWeekRecord ? (
                  <p className="text-xs text-green-400 font-medium flex items-center gap-1">
                    <Zap className="h-3 w-3" /> NY REKORD! 🎉
                  </p>
                ) : isNearWeekRecord ? (
                  <p className="text-xs text-amber-400 font-medium">
                    Kun {(bestWeekValue - currentWeekTotal).toLocaleString("da-DK")} kr til rekord! 🎯
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {Math.round(weekVsBestWeek)}% af rekord
                  </p>
                )}
              </div>
            </>
          )}
          
          {bestWeekRecord?.achieved_at && !brokeNewWeekRecord && (
            <p className="text-[10px] text-muted-foreground/70 mt-1.5">
              Sat {format(new Date(bestWeekRecord.achieved_at), "d. MMM yyyy", { locale: da })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
