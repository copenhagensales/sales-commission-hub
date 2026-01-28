import { useMemo } from "react";
import { BarChart, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Bar,
  BarChart as RechartsBarChart,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { DailyCommissionEntry } from "@/hooks/usePersonalWeeklyStats";

interface DailyCommissionChartProps {
  dailyData: DailyCommissionEntry[];
}

export function DailyCommissionChart({ dailyData }: DailyCommissionChartProps) {
  // Filter to only workdays and take the last 10
  const workdayData = useMemo(() => {
    return dailyData
      .filter((d) => !d.isWeekend)
      .slice(-10);
  }, [dailyData]);

  // Calculate average
  const average = useMemo(() => {
    if (workdayData.length === 0) return 0;
    const total = workdayData.reduce((sum, d) => sum + d.commission, 0);
    return Math.round(total / workdayData.length);
  }, [workdayData]);

  // Count days above average
  const daysAboveAverage = useMemo(() => {
    return workdayData.filter((d) => d.commission > average).length;
  }, [workdayData, average]);

  // Check for streak (3+ consecutive days above average at the end)
  const hasStreak = useMemo(() => {
    if (workdayData.length < 3) return false;
    const lastThree = workdayData.slice(-3);
    return lastThree.every((d) => d.commission > average);
  }, [workdayData, average]);

  // Get motivational message
  const getMotivationalMessage = () => {
    const todayData = workdayData.find((d) => d.isToday);
    
    if (hasStreak) {
      return { emoji: "🔥", text: "Du er på en streak!" };
    }
    if (todayData && todayData.commission > average) {
      return { emoji: "💪", text: "Stærk dag så langt!" };
    }
    if (daysAboveAverage >= workdayData.length / 2) {
      return { emoji: "📈", text: `${daysAboveAverage} dage over gennemsnittet!` };
    }
    return { emoji: "💡", text: "Tid til comeback!" };
  };

  const motivation = getMotivationalMessage();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("da-DK", {
      style: "currency",
      currency: "DKK",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const chartConfig = {
    commission: {
      label: "Provision",
      color: "hsl(var(--primary))",
    },
  };

  // Determine bar colors
  const getBarColor = (entry: DailyCommissionEntry) => {
    if (entry.isToday) {
      return "hsl(var(--primary))";
    }
    if (entry.commission > average) {
      return "hsl(142.1 76.2% 36.3%)"; // Green
    }
    return "hsl(var(--muted-foreground) / 0.4)";
  };

  if (workdayData.length === 0) {
    return (
      <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <BarChart className="w-4 h-4 text-primary" />
            Dine seneste 10 dage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Ingen salgsdata tilgængelig endnu.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <BarChart className="w-4 h-4 text-primary" />
            Dine seneste 10 dage
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            Snit: {formatCurrency(average)}/dag
          </span>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <ChartContainer config={chartConfig} className="h-[140px] w-full">
          <RechartsBarChart
            data={workdayData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <XAxis
              dataKey="dayName"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              tickMargin={4}
            />
            <YAxis hide />
            <ReferenceLine
              y={average}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="3 3"
              strokeOpacity={0.5}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name, item) => (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-muted-foreground text-xs">
                        {item.payload.date}
                      </span>
                      <span className="font-semibold">
                        {formatCurrency(value as number)}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Bar dataKey="commission" radius={[4, 4, 0, 0]} maxBarSize={32}>
              {workdayData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry)} />
              ))}
            </Bar>
          </RechartsBarChart>
        </ChartContainer>

        {/* Motivational feedback */}
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span>{motivation.emoji}</span>
          <span className="text-muted-foreground">{motivation.text}</span>
        </div>
      </CardContent>
    </Card>
  );
}
