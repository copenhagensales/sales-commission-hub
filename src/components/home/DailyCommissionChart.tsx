import { useMemo } from "react";
import { BarChart } from "lucide-react";
import { formatCurrency } from "@/lib/calculations";
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
      return { emoji: "💪", text: "Stærk dag!" };
    }
    if (daysAboveAverage >= workdayData.length / 2) {
      return { emoji: "📈", text: `${daysAboveAverage} dage over snit` };
    }
    return { emoji: "💡", text: "Tid til comeback!" };
  };

  const motivation = getMotivationalMessage();

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
        <CardHeader className="pb-2 px-3 md:px-6 pt-3 md:pt-6">
          <CardTitle className="flex items-center gap-2 text-sm md:text-base font-semibold">
            <BarChart className="w-4 h-4 text-primary" />
            Dine seneste 10 dage
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
          <p className="text-xs md:text-sm text-muted-foreground">
            Ingen salgsdata tilgængelig endnu.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-2 px-3 md:px-6 pt-3 md:pt-6">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-1.5 md:gap-2 text-sm md:text-base font-semibold">
            <BarChart className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
            <span className="hidden sm:inline">Dine seneste 10 dage</span>
            <span className="sm:hidden">Seneste 10 dage</span>
          </CardTitle>
          <span className="text-[10px] md:text-xs text-muted-foreground whitespace-nowrap">
            Snit: {formatCurrency(average)}/dag
          </span>
        </div>
      </CardHeader>
      <CardContent className="pb-3 md:pb-4 px-2 md:px-6">
        <ChartContainer config={chartConfig} className="h-[120px] md:h-[140px] w-full">
          <RechartsBarChart
            data={workdayData}
            margin={{ top: 8, right: 4, left: -24, bottom: 0 }}
          >
            <XAxis
              dataKey="dayName"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 9 }}
              tickMargin={4}
              interval={0}
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
            <Bar dataKey="commission" radius={[3, 3, 0, 0]} maxBarSize={28}>
              {workdayData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry)} />
              ))}
            </Bar>
          </RechartsBarChart>
        </ChartContainer>

        {/* Motivational feedback - larger emoji on mobile */}
        <div className="mt-2 md:mt-3 flex items-center justify-center md:justify-start gap-2 text-sm">
          <span className="text-lg md:text-base">{motivation.emoji}</span>
          <span className="text-xs md:text-sm text-muted-foreground">{motivation.text}</span>
        </div>
      </CardContent>
    </Card>
  );
}
