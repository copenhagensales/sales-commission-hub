import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  Clock,
  ChevronDown,
  ChevronUp,
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
import { usePerformanceThresholds, DEFAULT_THRESHOLDS, type PerformanceThresholds } from "@/hooks/usePerformanceThresholds";
import { useGamificationConfig, getPulseStatus } from "@/hooks/useGamificationConfig";
import { SalesStreakBadge } from "./SalesStreakBadge";
// SalesAchievements removed - functionality merged into SalesRecords
import { SalesRecords } from "./SalesRecords";
import { SalesAvatar } from "./SalesAvatar";
import { SalesMotivationalQuote } from "./SalesMotivationalQuote";
import { SalesProgressComparison } from "./SalesProgressComparison";
import { SalesExtraEffortSuggestions } from "./SalesExtraEffortSuggestions";
import { HeroPulseWidget } from "./HeroPulseWidget";

import { CelebrationOverlay } from "@/components/dashboard/CelebrationOverlay";
import { useEffectiveHourlyRate } from "@/hooks/useEffectiveHourlyRate";
import { usePreviousPeriodComparison } from "@/hooks/usePreviousPeriodComparison";
import { createAchievementConfigs } from "@/lib/gamification-achievements";
import { useAchievementTargets } from "@/hooks/useAchievementTargets";

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

// Motivational Chip Component
function MotivationalChip({ 
  label, 
  value,
  subLabel,
  compareValue,
  progress,
  isPositive,
  icon: Icon 
}: { 
  label: string; 
  value: number | string;
  subLabel?: string;
  compareValue?: number;
  progress?: number;
  isPositive?: boolean;
  icon?: React.ElementType;
}) {
  const hasComparison = compareValue !== undefined;
  const showProgress = progress !== undefined;
  
  // Determine color based on isPositive or comparison
  const colorClass = isPositive === true 
    ? 'text-green-500' 
    : isPositive === false 
      ? 'text-amber-500' 
      : 'text-primary';
  
  const bgClass = isPositive === true 
    ? 'bg-green-500/10 border-green-500/30' 
    : isPositive === false 
      ? 'bg-amber-500/10 border-amber-500/30' 
      : 'bg-primary/10 border-primary/30';

  return (
    <div className={`flex flex-col items-center p-3 rounded-lg border transition-all ${bgClass}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {Icon && <Icon className={`h-3 w-3 ${colorClass}`} />}
        <span className={`text-xs font-medium ${colorClass}`}>
          {label}
        </span>
      </div>
      
      {hasComparison ? (
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-bold ${colorClass}`}>
            {typeof value === 'number' ? value.toLocaleString("da-DK") : value} kr
          </span>
          <span className="text-xs text-muted-foreground">vs.</span>
          <span className="text-xs text-muted-foreground">
            {compareValue.toLocaleString("da-DK")} kr
          </span>
        </div>
      ) : (
        <span className={`text-sm font-bold ${colorClass}`}>
          {typeof value === 'number' ? `${value.toLocaleString("da-DK")} kr` : value}
        </span>
      )}
      
      {subLabel && (
        <span className="text-xs text-muted-foreground mt-0.5">{subLabel}</span>
      )}
      
      {showProgress && (
        <div className="w-full h-1.5 bg-background/50 rounded-full mt-2 overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all ${isPositive !== false ? 'bg-primary' : 'bg-amber-500'}`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}

// Helper to get relative performance (Din puls)
function getRelativePerformance(
  current: number, 
  expected: number, 
  thresholds: PerformanceThresholds
): {
  percent: number;
  label: string;
  isPositive: boolean | undefined;
  icon: React.ElementType;
} {
  if (expected <= 0) return { percent: 100, label: "Start!", isPositive: true, icon: Rocket };
  
  const percent = Math.round((current / expected) * 100);
  
  if (percent >= thresholds.flying) return { percent, label: "Flyver!", isPositive: true, icon: Rocket };
  if (percent >= thresholds.ahead) return { percent, label: "Foran plan", isPositive: true, icon: TrendingUp };
  if (percent >= thresholds.close) return { percent, label: "Tæt på", isPositive: undefined, icon: Target };
  return { percent, label: "Hent ind!", isPositive: false, icon: TrendingDown };
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
  const [kpiCardsOpen, setKpiCardsOpen] = useState(true);
  const [celebrationConfig, setCelebrationConfig] = useState<{
    effect: "fireworks" | "confetti" | "stars" | "flames";
    text: string;
  }>({ effect: "confetti", text: "" });

  // Fetch gamification config from KPI definitions
  const { config: gamificationConfig } = useGamificationConfig();
  
  // Fetch achievement targets
  const achievementTargetsQuery = useAchievementTargets();
  const achievementTargets = achievementTargetsQuery.data;

  // Fetch effective hourly rate based on KPI definitions
  const hourlyRateData = useEffectiveHourlyRate(
    employeeId,
    payrollPeriod.start,
    payrollPeriod.end
  );

  // We need workingDaysData first, but since it's calculated later, 
  // we calculate passed days early for the comparison hook
  const today = startOfDay(new Date());
  const allDaysForComparison = eachDayOfInterval({
    start: payrollPeriod.start,
    end: payrollPeriod.end,
  });
  const passedDaysForComparison = allDaysForComparison.filter(
    (day) => !isWeekend(day) && (isBefore(day, today) || isSameDay(day, today))
  ).length;

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

    // Hourly rate calculation (assuming 8-hour workday)
    const hourlyRate = actualDailyAvg / 8;
    
    // Performance status
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
      gapToTrack,
      todayTarget,
      sprintTarget,
      trendPercent,
      progressPercent,
      hourlyRate,
      performanceStatus,
      isAhead,
      isOnTrack,
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

  // Fetch performance thresholds from KPI definitions
  const { data: thresholds = DEFAULT_THRESHOLDS } = usePerformanceThresholds();

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

  // Track which achievements we've already processed to prevent infinite loops
  const processedAchievementsRef = useRef<Set<string>>(new Set());
  const hasUpdatedStreakRef = useRef(false);

  // Check for new achievements and trigger celebrations - use stable check
  useEffect(() => {
    const newAchievementsList = gamification.newAchievements;
    if (newAchievementsList.length > 0) {
      // Find the first achievement we haven't processed yet
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
  }, [gamification.newAchievements.join(',')]); // Use joined string for stable comparison

  // Update streak when daily goal is hit (only once per session)
  useEffect(() => {
    if (gamification.hitDailyGoal && currentGoal && !hasUpdatedStreakRef.current) {
      hasUpdatedStreakRef.current = true;
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
        <Badge className="bg-success/20 text-success border-success/30 gap-1">
          <Trophy className="h-3 w-3" />
          Mål nået!
        </Badge>
      );
    }
    if (kpis.willHitGoal && kpis.isAhead) {
      return (
        <Badge className="bg-success/20 text-success border-success/30 gap-1">
          <Flame className="h-3 w-3" />
          Foran planen
        </Badge>
      );
    }
    if (kpis.isOnTrack) {
      return (
        <Badge className="bg-warning/20 text-warning border-warning/30 gap-1">
          <Zap className="h-3 w-3" />
          På sporet
        </Badge>
      );
    }
    // Reframed from "Bag planen" to "Gap til plan"
    return (
      <Badge className="bg-warning/20 text-warning border-warning/30 gap-1">
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

      {/* Extra Effort Suggestions */}
      {currentGoal && kpis.hourlyRate > 0 && (
        <SalesExtraEffortSuggestions
          hourlyRate={kpis.hourlyRate}
          amountRemaining={kpis.amountRemaining}
          currentAmount={kpis.currentAmount}
          targetAmount={kpis.targetAmount}
          status={kpis.performanceStatus}
          bestDayRecord={gamification.bestDayRecord?.record_value}
        />
      )}

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
                <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 mb-4">
                  <p className="text-sm text-warning">
                    <span className="font-medium">Gap til plan:</span> +{Math.round(kpis.gapToTrack).toLocaleString("da-DK")} kr/dag for at være på sporet
                  </p>
                  <p className="text-xs text-warning/70 mt-1">
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
                  <p className={`text-2xl font-bold ${kpis.willHitGoal ? 'text-success' : 'text-warning'}`}>
                    {Math.round(kpis.projectedFinal).toLocaleString("da-DK")} kr
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    + {Math.round(kpis.projectedFinal * 0.125).toLocaleString("da-DK")} kr feriepenge
                  </p>
                </div>
              </div>

              {/* Hero Pulse Widget - Replaces the 3 Motivational Chips */}
              {(() => {
                const pulsePercent = kpis.expectedByNow > 0 
                  ? Math.round((kpis.currentAmount / kpis.expectedByNow) * 100)
                  : 100;
                
                return (
                  <HeroPulseWidget
                    pulsePercent={pulsePercent}
                    todayTotal={commissionStats.todayTotal}
                    actualDailyAvg={kpis.actualDailyAvg}
                    thresholds={gamificationConfig.pulseThresholds}
                    className="mt-6"
                  />
                );
              })()}
            </CardContent>
          </Card>

          {/* Collapsible KPI Cards */}
          <Collapsible open={kpiCardsOpen} onOpenChange={setKpiCardsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full flex items-center justify-between p-2 mb-2">
                <span className="text-sm font-medium text-muted-foreground">
                  {kpiCardsOpen ? "Skjul" : "Vis"} KPI detaljer
                </span>
                {kpiCardsOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Calendar className="h-5 w-5 text-primary" />
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
                      <div className={`p-2 rounded-lg ${kpis.isAhead ? "bg-success/10" : "bg-warning/10"}`}>
                        {kpis.isAhead ? (
                          <TrendingUp className="h-5 w-5 text-success" />
                        ) : (
                          <TrendingDown className="h-5 w-5 text-warning" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Trend</p>
                        <p className={`text-xl font-bold ${kpis.isAhead ? "text-success" : "text-warning"}`}>
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

                {/* Effective Hourly Rate Card */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        hourlyRateData.hourlyRate >= 200 
                          ? "bg-success/10" 
                          : hourlyRateData.hourlyRate >= 150 
                            ? "bg-warning/10" 
                            : "bg-muted/50"
                      }`}>
                        <Clock className={`h-5 w-5 ${
                          hourlyRateData.hourlyRate >= 200 
                            ? "text-success" 
                            : hourlyRateData.hourlyRate >= 150 
                              ? "text-warning" 
                              : "text-muted-foreground"
                        }`} />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Din timeløn så langt</p>
                        <p className={`text-xl font-bold ${
                          hourlyRateData.hourlyRate >= 200 
                            ? "text-success" 
                            : hourlyRateData.hourlyRate >= 150 
                              ? "text-warning" 
                              : ""
                        }`}>
                          {hourlyRateData.isLoading 
                            ? "..." 
                            : `${Math.round(hourlyRateData.hourlyRate).toLocaleString("da-DK")} kr/t`
                          }
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Gamification Section - Records & Streaks + Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className={!previousPeriodData.hasData ? "md:col-span-2" : ""}>
              <CardContent className="p-4">
                <SalesRecords
                  bestDayRecord={gamification.bestDayRecord}
                  bestWeekRecord={gamification.bestWeekRecord}
                  longestStreak={gamification.longestStreak}
                  currentStreak={gamification.currentStreak}
                  todayTotal={commissionStats.todayTotal}
                  currentPeriodTotal={commissionStats.periodTotal}
                  dailyTarget={kpis.todayTarget}
                  hitDailyGoal={commissionStats.todayTotal >= kpis.todayTarget}
                />
              </CardContent>
            </Card>

            {previousPeriodData.hasData && (
              <Card>
                <CardContent className="p-4">
                  <SalesProgressComparison
                    currentPeriodTotal={commissionStats.periodTotal}
                    daysPassedInPeriod={workingDaysData.passed}
                    previousPeriodTotal={previousPeriodData.previousPeriodTotal}
                    previousPeriodAtSameDay={previousPeriodData.previousPeriodAtSameDay}
                  />
                </CardContent>
              </Card>
            )}
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
