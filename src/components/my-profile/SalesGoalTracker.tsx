import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Calendar,
  Zap,
  Trophy,
  Flame,
  MapPin,
  Rocket,
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
  ReferenceArea,
  Scatter,
} from "recharts";
import { format, eachDayOfInterval, isWeekend, isBefore, isAfter, isSameDay, startOfDay } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";
import { useSalesGamification } from "@/hooks/useSalesGamification";
import { SalesStreakBadge } from "./SalesStreakBadge";
import { SalesAchievements } from "./SalesAchievements";
import { SalesRecords } from "./SalesRecords";
import { SalesAvatar } from "./SalesAvatar";
import { SalesMotivationalQuote } from "./SalesMotivationalQuote";
import { SalesProgressComparison } from "./SalesProgressComparison";
import { CelebrationOverlay } from "@/components/dashboard/CelebrationOverlay";

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

// Milestone Progress Bar Component
function MilestoneProgressBar({ progress, targetAmount, currentAmount }: { 
  progress: number; 
  targetAmount: number;
  currentAmount: number;
}) {
  const milestones = [
    { percent: 0, label: "Start" },
    { percent: 25, label: "25%" },
    { percent: 50, label: "Halvvejs" },
    { percent: 75, label: "Sidste sprint" },
    { percent: 100, label: "Mål" },
  ];

  return (
    <div className="relative mt-6 mb-8">
      {/* Background bar */}
      <div className="h-6 bg-muted/40 rounded-full overflow-hidden relative">
        {/* Progress fill */}
        <div 
          className="h-full bg-gradient-to-r from-primary/80 to-primary rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, progress)}%` }}
        />
        
        {/* Milestone markers */}
        {milestones.map((milestone) => (
          <div
            key={milestone.percent}
            className="absolute top-0 bottom-0 w-0.5 bg-background/50"
            style={{ left: `${milestone.percent}%` }}
          />
        ))}
      </div>
      
      {/* "Du er her" pin */}
      <div 
        className="absolute -top-2 flex flex-col items-center transition-all duration-500"
        style={{ left: `${Math.min(100, Math.max(0, progress))}%`, transform: 'translateX(-50%)' }}
      >
        <div className="flex items-center gap-1 bg-primary text-primary-foreground px-2 py-0.5 rounded-full text-xs font-medium shadow-lg">
          <MapPin className="h-3 w-3" />
          Du er her
        </div>
        <div className="w-0.5 h-2 bg-primary" />
      </div>
      
      {/* Milestone labels */}
      <div className="absolute -bottom-6 left-0 right-0 flex justify-between text-xs text-muted-foreground">
        {milestones.map((milestone) => (
          <span 
            key={milestone.percent} 
            className={`${progress >= milestone.percent ? 'text-primary font-medium' : ''}`}
            style={{ transform: milestone.percent === 100 ? 'translateX(-100%)' : milestone.percent === 0 ? 'none' : 'translateX(-50%)' }}
          >
            {milestone.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// Scenario Chip Component
function ScenarioChip({ 
  label, 
  value, 
  isHighlighted = false,
  icon: Icon 
}: { 
  label: string; 
  value: number; 
  isHighlighted?: boolean;
  icon?: React.ElementType;
}) {
  return (
    <div className={`flex flex-col items-center p-3 rounded-lg border transition-all ${
      isHighlighted 
        ? 'bg-primary/10 border-primary/30 ring-1 ring-primary/20' 
        : 'bg-muted/30 border-border/50'
    }`}>
      <div className="flex items-center gap-1.5 mb-1">
        {Icon && <Icon className={`h-3 w-3 ${isHighlighted ? 'text-primary' : 'text-muted-foreground'}`} />}
        <span className={`text-xs ${isHighlighted ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
          {label}
        </span>
      </div>
      <span className={`text-sm font-bold ${isHighlighted ? 'text-primary' : ''}`}>
        {value.toLocaleString("da-DK")} kr
      </span>
    </div>
  );
}

export function SalesGoalTracker({
  employeeId,
  payrollPeriod,
  commissionStats,
  absences,
  danishHolidays,
}: SalesGoalTrackerProps) {
  const queryClient = useQueryClient();
  const [goalInput, setGoalInput] = useState("");
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationConfig, setCelebrationConfig] = useState<{
    effect: "fireworks" | "confetti" | "stars" | "flames";
    text: string;
  }>({ effect: "confetti", text: "" });

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
    },
    onError: () => {
      toast.error("Kunne ikke gemme salgsmål");
    },
  });

  // Calculate working days (excluding weekends, holidays, and absences)
  const workingDaysData = useMemo(() => {
    const allDays = eachDayOfInterval({
      start: payrollPeriod.start,
      end: payrollPeriod.end,
    });

    const holidayDates = new Set(danishHolidays.map((h) => h.date));
    
    // Create set of absence dates
    const absenceDates = new Set<string>();
    absences.forEach((absence) => {
      const absenceStart = new Date(absence.start_date);
      const absenceEnd = new Date(absence.end_date);
      const absenceDays = eachDayOfInterval({ start: absenceStart, end: absenceEnd });
      absenceDays.forEach((day) => {
        absenceDates.add(format(day, "yyyy-MM-dd"));
      });
    });

    const workingDays = allDays.filter((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      return !isWeekend(day) && !holidayDates.has(dateStr) && !absenceDates.has(dateStr);
    });

    const today = startOfDay(new Date());
    const passedWorkingDays = workingDays.filter((day) => 
      isBefore(day, today) || isSameDay(day, today)
    );
    const remainingWorkingDays = workingDays.filter((day) => 
      isAfter(day, today)
    );

    return {
      total: workingDays.length,
      passed: passedWorkingDays.length,
      remaining: remainingWorkingDays.length,
      days: workingDays,
    };
  }, [payrollPeriod, danishHolidays, absences]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const targetAmount = currentGoal?.target_amount || 0;
    const currentAmount = commissionStats.periodTotal;
    const { total, passed, remaining } = workingDaysData;

    // Daily average needed to hit goal
    const dailyNeeded = total > 0 ? targetAmount / total : 0;
    
    // Expected amount by now (linear progression)
    const expectedByNow = passed > 0 ? (targetAmount / total) * passed : 0;
    
    // Actual daily average so far
    const actualDailyAvg = passed > 0 ? currentAmount / passed : 0;
    
    // Projected final amount based on current pace
    const projectedFinal = actualDailyAvg * total;
    
    // Amount remaining to hit goal
    const amountRemaining = Math.max(0, targetAmount - currentAmount);
    
    // Daily amount needed from now on to hit goal
    const dailyNeededFromNow = remaining > 0 ? amountRemaining / remaining : 0;
    
    // Gap to track: extra per day needed to get back on track
    const gapToTrack = dailyNeededFromNow - dailyNeeded;
    
    // Today's target (daily needed to stay on track)
    const todayTarget = dailyNeeded;
    
    // Sprint target (+10%)
    const sprintTarget = targetAmount * 1.10;
    
    // Trend percentage (how far ahead/behind)
    const trendPercent = expectedByNow > 0 
      ? ((currentAmount - expectedByNow) / expectedByNow) * 100 
      : 0;
    
    // Progress percentage
    const progressPercent = targetAmount > 0 
      ? Math.min(100, (currentAmount / targetAmount) * 100) 
      : 0;

    return {
      targetAmount,
      currentAmount,
      dailyNeeded,
      expectedByNow,
      actualDailyAvg,
      projectedFinal,
      amountRemaining,
      dailyNeededFromNow,
      gapToTrack,
      todayTarget,
      sprintTarget,
      trendPercent,
      progressPercent,
      isAhead: currentAmount >= expectedByNow,
      isOnTrack: Math.abs(trendPercent) < 10,
      willHitGoal: projectedFinal >= targetAmount,
    };
  }, [currentGoal, commissionStats.periodTotal, workingDaysData]);

  // Build chart data with zones
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

      // Calculate catch-up line (from today to target)
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
        // Zone boundaries for reference areas
        greenZone: targetCumulative * 0.90,
        yellowZone: targetCumulative * 0.75,
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
  });

  // Check for new achievements and trigger celebrations
  useEffect(() => {
    if (gamification.newAchievements.length > 0) {
      const achievementId = gamification.newAchievements[0];
      gamification.unlockAchievement(achievementId);
      setCelebrationConfig({ effect: "stars", text: "Achievement Unlocked! 🏅" });
      setShowCelebration(true);
    }
  }, [gamification.newAchievements]);

  // Update streak when daily goal is hit
  useEffect(() => {
    if (gamification.hitDailyGoal && currentGoal) {
      gamification.updateStreak(true);
    }
  }, [gamification.hitDailyGoal, currentGoal]);

  const handleSaveGoal = () => {
    const amount = parseInt(goalInput);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Indtast et gyldigt beløb");
      return;
    }
    saveGoalMutation.mutate(amount);
  };

  const getStatusBadge = () => {
    if (kpis.progressPercent >= 100) {
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1">
          <Trophy className="h-3 w-3" />
          Mål nået!
        </Badge>
      );
    }
    if (kpis.willHitGoal && kpis.isAhead) {
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1">
          <Flame className="h-3 w-3" />
          Foran planen
        </Badge>
      );
    }
    if (kpis.isOnTrack) {
      return (
        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 gap-1">
          <Zap className="h-3 w-3" />
          På sporet
        </Badge>
      );
    }
    // Reframed from "Bag planen" to "Gap til plan"
    return (
      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1">
        <Target className="h-3 w-3" />
        Gap til plan
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="h-[400px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Indlæser...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Celebration Overlay */}
      <CelebrationOverlay
        isOpen={showCelebration}
        onClose={() => setShowCelebration(false)}
        effect={celebrationConfig.effect}
        text={celebrationConfig.text}
        duration={3000}
      />

      {/* Goal Input Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SalesAvatar totalEarned={gamification.totalEarned} showProgress={false} />
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4" />
                Sæt dit salgsmål for lønperioden
              </CardTitle>
            </div>
            <SalesStreakBadge 
              currentStreak={gamification.currentStreak} 
              streakAtRisk={gamification.streakAtRisk}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-sm text-muted-foreground mb-1.5 block">
                Mål i provision (DKK)
              </label>
              <Input
                type="number"
                placeholder="F.eks. 50000"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                className="text-lg font-medium"
              />
            </div>
            <Button 
              onClick={handleSaveGoal} 
              disabled={saveGoalMutation.isPending}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {currentGoal ? "Opdater mål" : "Sæt mål"}
            </Button>
          </div>
          
          {currentGoal && (
            <div className="mt-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Fremdrift mod mål</span>
                <span className="font-medium">
                  {kpis.currentAmount.toLocaleString("da-DK")} / {kpis.targetAmount.toLocaleString("da-DK")} kr
                </span>
              </div>
              <MilestoneProgressBar 
                progress={kpis.progressPercent} 
                targetAmount={kpis.targetAmount}
                currentAmount={kpis.currentAmount}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Motivational Quote */}
      {currentGoal && (
        <SalesMotivationalQuote 
          quote={gamification.motivationalQuote} 
          status={gamification.performanceStatus} 
        />
      )}

      {currentGoal && (
        <>
          {/* Today's Focus Card */}
          <Card className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border-primary/30">
            <CardContent className="p-6">
              {/* Today's Goal - Action Focus */}
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-full bg-primary/20">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Dagens mål</p>
                  <p className="text-2xl font-bold text-primary">
                    {Math.round(kpis.todayTarget).toLocaleString("da-DK")} kr
                  </p>
                </div>
                <div className="ml-auto">
                  {getStatusBadge()}
                </div>
              </div>
              
              {/* Supportive microcopy for gap */}
              {!kpis.isAhead && !kpis.isOnTrack && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-4">
                  <p className="text-sm text-amber-300">
                    <span className="font-medium">Gap til plan:</span> +{Math.round(kpis.gapToTrack).toLocaleString("da-DK")} kr/dag for at være på sporet
                  </p>
                  <p className="text-xs text-amber-300/70 mt-1">
                    Rammer du dagens mål, er du tilbage på planen.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Du er her nu</p>
                  <p className="text-3xl font-bold">
                    {kpis.currentAmount.toLocaleString("da-DK")} kr
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    af {kpis.targetAmount.toLocaleString("da-DK")} kr mål
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground mb-1">Projiceret slutprovision</p>
                  <p className={`text-2xl font-bold ${kpis.willHitGoal ? 'text-green-400' : 'text-amber-400'}`}>
                    {Math.round(kpis.projectedFinal).toLocaleString("da-DK")} kr
                  </p>
                </div>
              </div>

              {/* Scenario Chips */}
              <div className="grid grid-cols-3 gap-3 mt-6">
                <ScenarioChip 
                  label="Nuværende tempo" 
                  value={Math.round(kpis.projectedFinal)} 
                  icon={TrendingUp}
                />
                <ScenarioChip 
                  label="På sporet" 
                  value={kpis.targetAmount} 
                  isHighlighted={true}
                  icon={Target}
                />
                <ScenarioChip 
                  label="Sprint (+10%)" 
                  value={Math.round(kpis.sprintTarget)} 
                  icon={Rocket}
                />
              </div>
            </CardContent>
          </Card>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Calendar className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Dagligt snit behøvet</p>
                    <p className="text-xl font-bold">
                      {Math.round(kpis.dailyNeededFromNow).toLocaleString("da-DK")} kr
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {workingDaysData.remaining} arbejdsdage tilbage
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${kpis.isAhead ? "bg-green-500/10" : "bg-amber-500/10"}`}>
                    {kpis.isAhead ? (
                      <TrendingUp className="h-5 w-5 text-green-500" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-amber-500" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Trend</p>
                    <p className={`text-xl font-bold ${kpis.isAhead ? "text-green-500" : "text-amber-500"}`}>
                      {kpis.trendPercent > 0 ? "+" : ""}{Math.round(kpis.trendPercent)}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {kpis.isAhead ? "foran" : "ift."} forventet tempo
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Target className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Resterende</p>
                    <p className="text-xl font-bold">
                      {Math.round(kpis.amountRemaining).toLocaleString("da-DK")} kr
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Aktuelt snit: {Math.round(kpis.actualDailyAvg).toLocaleString("da-DK")} kr/dag
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gamification Section - Records, Comparison, Achievements */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <SalesRecords
                  bestDayRecord={gamification.bestDayRecord}
                  bestWeekRecord={gamification.bestWeekRecord}
                  longestStreak={gamification.longestStreak}
                  currentStreak={gamification.currentStreak}
                  todayTotal={commissionStats.todayTotal}
                  currentPeriodTotal={commissionStats.periodTotal}
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <SalesProgressComparison
                  currentPeriodTotal={commissionStats.periodTotal}
                  daysPassedInPeriod={workingDaysData.passed}
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <SalesAchievements
                  unlockedAchievementIds={gamification.unlockedAchievementIds}
                />
              </CardContent>
            </Card>
          </div>

          {/* Progression Chart with Race Track Zones */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Daglig progression mod mål
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <defs>
                      <linearGradient id="greenZone" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(142 76% 36%)" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="hsl(142 76% 36%)" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="yellowZone" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(45 93% 47%)" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="hsl(45 93% 47%)" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="redZone" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(0 84% 60%)" stopOpacity={0.1} />
                        <stop offset="100%" stopColor="hsl(0 84% 60%)" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/20" />
                    
                    {/* Background zone areas - Green (on track) */}
                    <ReferenceArea
                      y1={kpis.targetAmount * 0.90}
                      y2={kpis.targetAmount * 1.10}
                      fill="url(#greenZone)"
                      strokeOpacity={0}
                    />
                    
                    {/* Yellow zone (risk) */}
                    <ReferenceArea
                      y1={kpis.targetAmount * 0.75}
                      y2={kpis.targetAmount * 0.90}
                      fill="url(#yellowZone)"
                      strokeOpacity={0}
                    />
                    
                    {/* Red zone (off track) */}
                    <ReferenceArea
                      y1={0}
                      y2={kpis.targetAmount * 0.75}
                      fill="url(#redZone)"
                      strokeOpacity={0}
                    />
                    
                    <XAxis 
                      dataKey="day" 
                      tick={{ fontSize: 11 }} 
                      interval="preserveStartEnd"
                      className="text-muted-foreground"
                    />
                    <YAxis 
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                      className="text-muted-foreground"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number, name: string) => {
                        const labels: Record<string, string> = {
                          targetCumulative: "Forventet tempo",
                          actualCumulative: "Faktisk provision",
                          catchUpLine: "For at nå mål",
                          goalLine: "Slutmål",
                        };
                        return [`${value?.toLocaleString("da-DK")} kr`, labels[name] || name];
                      }}
                    />
                    
                    {/* Goal reference line */}
                    <ReferenceLine
                      y={kpis.targetAmount}
                      stroke="hsl(var(--primary))"
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      label={{
                        value: `Mål: ${kpis.targetAmount.toLocaleString("da-DK")} kr`,
                        position: "right",
                        fill: "hsl(var(--primary))",
                        fontSize: 11,
                      }}
                    />
                    
                    {/* Expected progression line */}
                    <Line
                      type="monotone"
                      dataKey="targetCumulative"
                      stroke="hsl(var(--muted-foreground))"
                      strokeDasharray="4 4"
                      strokeWidth={2}
                      dot={false}
                      name="Forventet tempo"
                    />
                    
                    {/* Catch-up line (from today to target) */}
                    <Line
                      type="monotone"
                      dataKey="catchUpLine"
                      stroke="hsl(142 76% 36%)"
                      strokeDasharray="6 3"
                      strokeWidth={2}
                      dot={false}
                      name="For at nå mål"
                      connectNulls={false}
                    />
                    
                    {/* Actual progression area */}
                    <Area
                      type="monotone"
                      dataKey="actualCumulative"
                      fill="hsl(var(--primary) / 0.2)"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      name="Faktisk provision"
                      connectNulls={false}
                    />
                    
                    {/* Today marker */}
                    <Scatter
                      dataKey="todayMarker"
                      fill="hsl(var(--primary))"
                      shape={(props: any) => {
                        if (!props.payload?.isToday) return null;
                        return (
                          <g>
                            <circle
                              cx={props.cx}
                              cy={props.cy}
                              r={10}
                              fill="hsl(var(--primary))"
                              stroke="hsl(var(--background))"
                              strokeWidth={3}
                            />
                            {/* Today callout */}
                            <text
                              x={props.cx}
                              y={props.cy - 20}
                              textAnchor="middle"
                              fill="hsl(var(--foreground))"
                              fontSize={10}
                              fontWeight="bold"
                            >
                              {`${Math.round(kpis.dailyNeededFromNow).toLocaleString("da-DK")} kr/dag`}
                            </text>
                          </g>
                        );
                      }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-4 mt-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 bg-primary rounded" />
                  <span>Faktisk provision</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-muted-foreground rounded" style={{ borderStyle: "dashed" }} />
                  <span>Forventet tempo</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 rounded" style={{ backgroundColor: "hsl(142 76% 36%)", borderStyle: "dashed" }} />
                  <span>For at nå mål</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary" />
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
