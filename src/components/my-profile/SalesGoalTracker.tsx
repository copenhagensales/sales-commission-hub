import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Target,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Rocket,
  Pencil,
} from "lucide-react";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Scatter,
} from "recharts";
import { format, eachDayOfInterval, isBefore, isAfter, isSameDay, startOfDay } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";
import { useSalesGamification } from "@/hooks/useSalesGamification";
import { usePerformanceThresholds, DEFAULT_THRESHOLDS, type PerformanceThresholds } from "@/hooks/usePerformanceThresholds";
import { useGamificationConfig } from "@/hooks/useGamificationConfig";
import { SalesStreakBadge } from "./SalesStreakBadge";
import { SalesExtraEffortSuggestions } from "./SalesExtraEffortSuggestions";
import { PowerMovesMilestones } from "./PowerMovesMilestones";
import { HeroStatusCard } from "./HeroStatusCard";
import { CompactKpiChips } from "./CompactKpiChips";
import { CompactSalesRecords } from "./CompactSalesRecords";

import { CelebrationOverlay } from "@/components/dashboard/CelebrationOverlay";
import { useEffectiveHourlyRate } from "@/hooks/useEffectiveHourlyRate";
import { usePreviousPeriodComparison } from "@/hooks/usePreviousPeriodComparison";
import { useAchievementTargets } from "@/hooks/useAchievementTargets";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEmployeeWorkingDays } from "@/hooks/useEmployeeWorkingDays";

interface SalesGoalTrackerProps {
  employeeId: string;
  payrollPeriod: {
    start: Date;
    end: Date;
  };
  commissionStats: {
    periodTotal: number;
    periodSales: number;
    monthTotal: number;
    monthSales: number;
    todayTotal: number;
    todaySales: number;
    weekTotal?: number;
  };
  absences: Array<{
    start_date: string;
    end_date: string;
    type: string;
  }>;
  danishHolidays: Array<{
    date: string;
    name: string;
  }>;
}

export function SalesGoalTracker({
  employeeId,
  payrollPeriod,
  commissionStats,
  absences,
  danishHolidays,
}: SalesGoalTrackerProps) {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [goalInput, setGoalInput] = useState("");
  const [showCelebration, setShowCelebration] = useState(false);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [celebrationConfig, setCelebrationConfig] = useState<{
    effect: "fireworks" | "confetti" | "stars" | "flames";
    text: string;
  }>({ effect: "confetti", text: "" });

  // Fetch gamification config from KPI definitions
  const { config: gamificationConfig } = useGamificationConfig();
  
  // Fetch achievement targets
  const achievementTargetsQuery = useAchievementTargets();

  // Fetch effective hourly rate based on KPI definitions
  const hourlyRateData = useEffectiveHourlyRate(
    employeeId,
    payrollPeriod.start,
    payrollPeriod.end
  );

  // Calculate passed working days using the shift-aware hook
  const passedDaysForComparison = workingDaysData.data.passed;

  // Fetch previous period comparison data
  const previousPeriodData = usePreviousPeriodComparison(
    employeeId,
    payrollPeriod.start,
    payrollPeriod.end,
    passedDaysForComparison
  );

  // Fetch current goal for this period
  const { data: currentGoal, isLoading } = useQuery({
    queryKey: ["sales-goal", employeeId, payrollPeriod.start.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_sales_goals")
        .select("*")
        .eq("employee_id", employeeId)
        .eq("period_start", format(payrollPeriod.start, "yyyy-MM-dd"))
        .eq("period_end", format(payrollPeriod.end, "yyyy-MM-dd"))
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Week commission from live data (passed via commissionStats)
  const currentWeekTotal = commissionStats.weekTotal || 0;

  // Initialize input when goal loads
  useEffect(() => {
    if (currentGoal?.target_amount) {
      setGoalInput(currentGoal.target_amount.toString());
    }
  }, [currentGoal]);

  // Save goal mutation
  const saveGoalMutation = useMutation({
    mutationFn: async (targetAmount: number) => {
      if (currentGoal) {
        const { error } = await supabase
          .from("employee_sales_goals")
          .update({ target_amount: targetAmount })
          .eq("id", currentGoal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("employee_sales_goals")
          .insert({
            employee_id: employeeId,
            target_amount: targetAmount,
            period_start: format(payrollPeriod.start, "yyyy-MM-dd"),
            period_end: format(payrollPeriod.end, "yyyy-MM-dd"),
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-goal", employeeId] });
      toast.success("Salgsmål gemt");
      setIsEditingGoal(false);
    },
    onError: () => {
      toast.error("Kunne ikke gemme salgsmål");
    },
  });

  // Calculate working days using shift hierarchy (individual → employee standard → team standard → fallback weekday)
  const { data: workingDaysData } = useEmployeeWorkingDays(
    employeeId,
    payrollPeriod,
    absences,
    danishHolidays
  );

  // Calculate KPIs
  const kpis = useMemo(() => {
    const targetAmount = currentGoal?.target_amount || 0;
    const currentAmount = commissionStats.periodTotal;
    const { total, passed, remaining } = workingDaysData;

    const dailyNeeded = total > 0 ? targetAmount / total : 0;
    const expectedByNow = passed > 0 ? (targetAmount / total) * passed : 0;
    const actualDailyAvg = passed > 0 ? currentAmount / passed : 0;
    const projectedFinal = actualDailyAvg * total;
    const amountRemaining = Math.max(0, targetAmount - currentAmount);
    const dailyNeededFromNow = remaining > 0 ? amountRemaining / remaining : 0;
    const todayTarget = dailyNeeded;
    
    const trendPercent = expectedByNow > 0 
      ? ((currentAmount - expectedByNow) / expectedByNow) * 100 
      : 0;
    
    const progressPercent = targetAmount > 0 
      ? Math.min(100, (currentAmount / targetAmount) * 100) 
      : 0;

    const hourlyRate = actualDailyAvg / 8;
    
    const isAhead = currentAmount >= expectedByNow;
    const isOnTrack = Math.abs(trendPercent) < 10;
    const performanceStatus: "ahead" | "on_track" | "behind" = 
      isAhead ? "ahead" : isOnTrack ? "on_track" : "behind";

    return {
      targetAmount,
      currentAmount,
      dailyNeeded,
      expectedByNow,
      actualDailyAvg,
      projectedFinal,
      amountRemaining,
      dailyNeededFromNow,
      todayTarget,
      trendPercent,
      progressPercent,
      hourlyRate,
      performanceStatus,
      isAhead,
      isOnTrack,
      willHitGoal: projectedFinal >= targetAmount,
    };
  }, [currentGoal, commissionStats.periodTotal, workingDaysData]);

  // Build chart data
  const chartData = useMemo(() => {
    const { days, total } = workingDaysData;
    const targetAmount = currentGoal?.target_amount || 0;
    const today = startOfDay(new Date());

    let cumulativeActual = 0;
    const dailyTarget = total > 0 ? targetAmount / total : 0;

    return days.map((day, index) => {
      const dayNumber = index + 1;
      const targetCumulative = dailyTarget * dayNumber;
      const isPast = isBefore(day, today) || isSameDay(day, today);
      const isToday = isSameDay(day, today);

      if (isPast && commissionStats.periodTotal > 0) {
        const avgDaily = commissionStats.periodTotal / workingDaysData.passed;
        cumulativeActual = avgDaily * dayNumber;
        if (dayNumber === workingDaysData.passed) {
          cumulativeActual = commissionStats.periodTotal;
        }
      }

      const isFuture = isAfter(day, today);
      let catchUpLine = null;
      if (isFuture || isToday) {
        const remainingDays = total - workingDaysData.passed;
        const amountRemaining = Math.max(0, targetAmount - commissionStats.periodTotal);
        const dailyNeededFromNow = remainingDays > 0 ? amountRemaining / remainingDays : 0;
        const daysFromToday = dayNumber - workingDaysData.passed;
        catchUpLine = commissionStats.periodTotal + (dailyNeededFromNow * daysFromToday);
      }

      return {
        day: format(day, "d. MMM", { locale: da }),
        dayNumber,
        date: day,
        targetCumulative: Math.round(targetCumulative),
        actualCumulative: isPast ? Math.round(cumulativeActual) : null,
        catchUpLine: catchUpLine ? Math.round(catchUpLine) : null,
        goalLine: targetAmount,
        isToday,
        todayMarker: isToday ? commissionStats.periodTotal : null,
      };
    });
  }, [workingDaysData, currentGoal, commissionStats]);

  // Initialize gamification hook
  const gamification = useSalesGamification({
    employeeId,
    currentPeriodTotal: commissionStats.periodTotal,
    targetAmount: kpis.targetAmount,
    progressPercent: kpis.progressPercent,
    isAhead: kpis.isAhead,
    isOnTrack: kpis.isOnTrack,
    daysPassedInPeriod: workingDaysData.passed,
    totalDaysInPeriod: workingDaysData.total,
    dailyTarget: kpis.todayTarget,
    todayTotal: commissionStats.todayTotal,
    currentWeekTotal,
  });

  const processedAchievementsRef = useRef<Set<string>>(new Set());
  const hasUpdatedStreakRef = useRef(false);

  useEffect(() => {
    const newAchievementsList = gamification.newAchievements;
    if (newAchievementsList.length > 0) {
      const unprocessedAchievement = newAchievementsList.find(
        id => !processedAchievementsRef.current.has(id)
      );
      
      if (unprocessedAchievement) {
        processedAchievementsRef.current.add(unprocessedAchievement);
        gamification.unlockAchievement(unprocessedAchievement);
        setCelebrationConfig({ effect: "stars", text: "Achievement Unlocked! 🏅" });
        setShowCelebration(true);
      }
    }
  }, [gamification.newAchievements.join(',')]);

  useEffect(() => {
    if (gamification.hitDailyGoal && currentGoal && !hasUpdatedStreakRef.current) {
      hasUpdatedStreakRef.current = true;
      gamification.updateStreak(true);
    }
  }, [gamification.hitDailyGoal, currentGoal]);

  // Celebrate new records
  useEffect(() => {
    if (gamification.newRecordType) {
      const recordText = gamification.newRecordType === "best_day" 
        ? "Ny dagsrekord! 🏆" 
        : "Ny ugerekord! 🏆";
      setCelebrationConfig({ effect: "fireworks", text: recordText });
      setShowCelebration(true);
      gamification.clearNewRecord();
    }
  }, [gamification.newRecordType]);

  const handleSaveGoal = () => {
    const amount = parseInt(goalInput);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Indtast et gyldigt beløb");
      return;
    }
    saveGoalMutation.mutate(amount);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="h-[200px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Indlæser...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate pulse percent for HeroStatusCard
  const pulsePercent = kpis.actualDailyAvg > 0 
    ? Math.round((commissionStats.todayTotal / kpis.actualDailyAvg) * 100)
    : 0;

  return (
    <div className="space-y-3">
      {/* Celebration Overlay */}
      <CelebrationOverlay
        isOpen={showCelebration}
        onClose={() => setShowCelebration(false)}
        effect={celebrationConfig.effect}
        text={celebrationConfig.text}
        duration={3000}
      />

      {/* Goal Input Section - Compact */}
      <Card>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            {currentGoal && !isEditingGoal ? (
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4" />
                Dit mål: {currentGoal.target_amount.toLocaleString("da-DK")} kr
              </CardTitle>
            ) : (
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4" />
                {currentGoal ? "Rediger mål" : "Sæt salgsmål"}
              </CardTitle>
            )}
            <div className="flex items-center gap-2">
              <SalesStreakBadge 
                currentStreak={gamification.currentStreak} 
                streakAtRisk={gamification.streakAtRisk}
              />
              {currentGoal && !isEditingGoal && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsEditingGoal(true)}
                  className="h-7 w-7"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        {(!currentGoal || isEditingGoal) && (
          <CardContent className="pt-0 pb-4 px-4">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Input
                  type="number"
                  placeholder="F.eks. 50000"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  className="h-9"
                />
              </div>
              <Button 
                onClick={handleSaveGoal} 
                disabled={saveGoalMutation.isPending}
                size="sm"
                className="gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {currentGoal ? "Gem" : "Sæt mål"}
              </Button>
              {currentGoal && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingGoal(false)}
                >
                  Annuller
                </Button>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {currentGoal && (
        <>
          {/* Hero Status Card - Fusioned main display */}
          <HeroStatusCard
            pulsePercent={pulsePercent}
            todayTotal={commissionStats.todayTotal}
            actualDailyAvg={kpis.actualDailyAvg}
            thresholds={gamificationConfig.pulseThresholds}
            currentAmount={kpis.currentAmount}
            projectedFinal={kpis.projectedFinal}
            targetAmount={kpis.targetAmount}
            willHitGoal={kpis.willHitGoal}
            isAhead={kpis.isAhead}
            isOnTrack={kpis.isOnTrack}
            progressPercent={kpis.progressPercent}
          />

          {/* Compact KPI Chips - Horizontal scrollable */}
          <CompactKpiChips
            amountRemaining={kpis.amountRemaining}
            dailyNeededFromNow={kpis.dailyNeededFromNow}
            remainingDays={workingDaysData.remaining}
            trendPercent={kpis.trendPercent}
            isAhead={kpis.isAhead}
            hourlyRate={hourlyRateData.hourlyRate}
            isHourlyLoading={hourlyRateData.isLoading}
          />

          {/* Power Moves - Financial Milestones */}
          <PowerMovesMilestones 
            currentAmount={Math.round(kpis.currentAmount)}
            projectedAmount={Math.round(kpis.projectedFinal)} 
          />

          {/* Compact Records & Streak */}
          <Card>
            <CardContent className="p-4">
              <CompactSalesRecords
                bestDayRecord={gamification.bestDayRecord}
                bestWeekRecord={gamification.bestWeekRecord}
                longestStreak={gamification.longestStreak}
                currentStreak={gamification.currentStreak}
                todayTotal={commissionStats.todayTotal}
                currentWeekTotal={currentWeekTotal}
                hitDailyGoal={commissionStats.todayTotal >= kpis.todayTarget}
              />
            </CardContent>
          </Card>

          {/* Extra Effort Suggestions */}
          {kpis.hourlyRate > 0 && (
            <SalesExtraEffortSuggestions
              hourlyRate={kpis.hourlyRate}
              amountRemaining={kpis.amountRemaining}
              currentAmount={kpis.currentAmount}
              targetAmount={kpis.targetAmount}
              status={kpis.performanceStatus}
              bestDayRecord={gamification.bestDayRecord?.record_value}
            />
          )}

          {/* Simplified Progression Chart */}
          <Card>
            <CardHeader className="pb-2 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Progression
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                    <defs>
                      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                        <feMerge>
                          <feMergeNode in="coloredBlur"/>
                          <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                      </filter>
                    </defs>
                    
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/20" />
                    
                    <XAxis 
                      dataKey="day" 
                      tick={{ fontSize: 10 }} 
                      interval="preserveStartEnd"
                      className="text-muted-foreground"
                    />
                    <YAxis 
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                      className="text-muted-foreground"
                      width={35}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value: number, name: string) => {
                        const labels: Record<string, string> = {
                          targetCumulative: "Forventet",
                          actualCumulative: "Faktisk",
                          catchUpLine: "For at nå mål",
                        };
                        return [`${value?.toLocaleString("da-DK")} kr`, labels[name] || name];
                      }}
                    />
                    
                    {/* Goal reference line */}
                    <ReferenceLine
                      y={kpis.targetAmount}
                      stroke="hsl(var(--primary))"
                      strokeDasharray="5 5"
                      strokeWidth={1.5}
                    />
                    
                    {/* Expected progression line */}
                    <Line
                      type="monotone"
                      dataKey="targetCumulative"
                      stroke="hsl(var(--muted-foreground) / 0.3)"
                      strokeDasharray="6 6"
                      strokeWidth={1}
                      dot={false}
                      name="Forventet"
                    />
                    
                    {/* Catch-up line */}
                    <Line
                      type="monotone"
                      dataKey="catchUpLine"
                      stroke="hsl(142 76% 36%)"
                      strokeDasharray="4 2"
                      strokeWidth={1.5}
                      dot={false}
                      name="For at nå mål"
                      connectNulls={false}
                    />
                    
                    {/* Actual progression - Hero line */}
                    <Area
                      type="monotone"
                      dataKey="actualCumulative"
                      fill="hsl(var(--primary) / 0.2)"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      name="Faktisk"
                      connectNulls={false}
                      style={{ filter: "url(#glow)" }}
                    />
                    
                    {/* Today marker */}
                    <Scatter
                      dataKey="todayMarker"
                      fill="hsl(var(--primary))"
                      shape={(props: any) => {
                        if (!props.payload?.isToday) return null;
                        return (
                          <circle
                            cx={props.cx}
                            cy={props.cy}
                            r={6}
                            fill="hsl(var(--primary))"
                            stroke="hsl(var(--background))"
                            strokeWidth={2}
                          />
                        );
                      }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-3 mt-2 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 bg-primary rounded" />
                  <span>Faktisk</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 bg-muted-foreground/30 rounded" />
                  <span>Forventet</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span>I dag</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
