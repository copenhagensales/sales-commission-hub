import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import { format, eachDayOfInterval, isWeekend, isBefore, isAfter, isSameDay, startOfDay } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";

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

export function SalesGoalTracker({
  employeeId,
  payrollPeriod,
  commissionStats,
  absences,
  danishHolidays,
}: SalesGoalTrackerProps) {
  const queryClient = useQueryClient();
  const [goalInput, setGoalInput] = useState("");

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
      trendPercent,
      progressPercent,
      isAhead: currentAmount >= expectedByNow,
      isOnTrack: Math.abs(trendPercent) < 10,
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

      // For demonstration, we distribute actual commission proportionally
      // In real implementation, you'd have daily sales data
      if (isPast && commissionStats.periodTotal > 0) {
        const avgDaily = commissionStats.periodTotal / workingDaysData.passed;
        cumulativeActual = avgDaily * dayNumber;
        if (dayNumber === workingDaysData.passed) {
          cumulativeActual = commissionStats.periodTotal;
        }
      }

      return {
        day: format(day, "d. MMM", { locale: da }),
        dayNumber,
        date: day,
        targetCumulative: Math.round(targetCumulative),
        actualCumulative: isPast ? Math.round(cumulativeActual) : null,
        goalLine: targetAmount,
        isToday,
        todayMarker: isToday ? commissionStats.periodTotal : null,
      };
    });
  }, [workingDaysData, currentGoal, commissionStats]);

  const handleSaveGoal = () => {
    const amount = parseInt(goalInput);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Indtast et gyldigt beløb");
      return;
    }
    saveGoalMutation.mutate(amount);
  };

  const getStatusColor = () => {
    if (kpis.willHitGoal && kpis.isAhead) return "text-green-500";
    if (kpis.isOnTrack) return "text-yellow-500";
    return "text-red-500";
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
    return (
      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 gap-1">
        <TrendingDown className="h-3 w-3" />
        Bag planen
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
      {/* Goal Input Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Sæt dit salgsmål for lønperioden
          </CardTitle>
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
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Fremdrift mod mål</span>
                <span className="font-medium">
                  {kpis.currentAmount.toLocaleString("da-DK")} / {kpis.targetAmount.toLocaleString("da-DK")} kr
                </span>
              </div>
              <Progress value={kpis.progressPercent} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {currentGoal && (
        <>
          {/* Hero Status Card */}
          <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
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
                  {getStatusBadge()}
                  <div className="mt-3">
                    <p className="text-sm text-muted-foreground">Projiceret slutprovision</p>
                    <p className={`text-2xl font-bold ${getStatusColor()}`}>
                      {Math.round(kpis.projectedFinal).toLocaleString("da-DK")} kr
                    </p>
                  </div>
                </div>
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
                  <div className={`p-2 rounded-lg ${kpis.isAhead ? "bg-green-500/10" : "bg-red-500/10"}`}>
                    {kpis.isAhead ? (
                      <TrendingUp className="h-5 w-5 text-green-500" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Trend</p>
                    <p className={`text-xl font-bold ${kpis.isAhead ? "text-green-500" : "text-red-500"}`}>
                      {kpis.trendPercent > 0 ? "+" : ""}{Math.round(kpis.trendPercent)}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {kpis.isAhead ? "foran" : "bagud"} forventet tempo
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

          {/* Progression Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Daglig progression mod mål
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
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
                          targetCumulative: "Forventet",
                          actualCumulative: "Faktisk",
                          goalLine: "Mål",
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
                      name="Forventet"
                    />
                    
                    {/* Actual progression area */}
                    <Area
                      type="monotone"
                      dataKey="actualCumulative"
                      fill="hsl(var(--primary) / 0.2)"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      name="Faktisk"
                      connectNulls={false}
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
                            r={8}
                            fill="hsl(var(--primary))"
                            stroke="hsl(var(--background))"
                            strokeWidth={3}
                          />
                        );
                      }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-primary rounded" />
                  <span>Faktisk provision</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-muted-foreground rounded" style={{ borderStyle: "dashed" }} />
                  <span>Forventet tempo</span>
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
