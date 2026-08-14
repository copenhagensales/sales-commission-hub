import { useMemo } from "react";
import { BarChart } from "lucide-react";
import { formatCurrency } from "@/lib/calculations";
import { HomeCard, HomeCardEmpty } from "@/components/home/HomeCard";
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
  // Only workdays, last 10
  const workdayData = useMemo(
    () => dailyData.filter((d) => !d.isWeekend).slice(-10),
    [dailyData]
  );

  const average = useMemo(() => {
    if (workdayData.length === 0) return 0;
    const total = workdayData.reduce((sum, d) => sum + d.commission, 0);
    return Math.round(total / workdayData.length);
  }, [workdayData]);

  const bestDay = useMemo(() => {
    if (workdayData.length === 0) return null;
    return workdayData.reduce((best, d) => (d.commission > best.commission ? d : best));
  }, [workdayData]);

  const zeroDays = useMemo(
    () => workdayData.filter((d) => d.commission <= 0).length,
    [workdayData]
  );

  const hasAnyCommission = workdayData.some((d) => d.commission > 0);

  const chartConfig = {
    commission: {
      label: "Provision",
      color: "hsl(var(--primary))",
    },
  };

  const getBarColor = (entry: DailyCommissionEntry) => {
    if (entry.isToday) return "hsl(var(--primary))";
    if (entry.commission > average) return "hsl(var(--success))";
    return "hsl(var(--muted-foreground) / 0.35)";
  };

  const header = (
    <span className="text-xs tabular-nums text-muted-foreground">
      Snit {formatCurrency(average)}/dag
    </span>
  );

  if (workdayData.length === 0 || !hasAnyCommission) {
    return (
      <HomeCard
        icon={BarChart}
        title="Dine seneste 10 dage"
        titleShort="Seneste 10 dage"
        contentClassName="flex items-center justify-center p-4"
      >
        <HomeCardEmpty
          icon={BarChart}
          title="Ingen salg registreret i perioden"
          hint="Dine dagstal vises her, så snart det første salg er registreret"
        />
      </HomeCard>
    );
  }

  return (
    <HomeCard
      icon={BarChart}
      title="Dine seneste 10 dage"
      titleShort="Seneste 10 dage"
      action={header}
      contentClassName="flex flex-col gap-3 p-3 md:p-4"
    >
      <ChartContainer config={chartConfig} className="h-[130px] w-full md:h-[150px]">
        <RechartsBarChart data={workdayData} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
          <XAxis
            dataKey="dayName"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            tickMargin={6}
            interval={0}
          />
          <YAxis hide />
          <ReferenceLine
            y={average}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="3 3"
            strokeOpacity={0.4}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name, item) => (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">{item.payload.date}</span>
                    <span className="font-semibold tabular-nums">
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

      <div className="flex items-center gap-4 border-t border-border/40 pt-2.5 text-xs text-muted-foreground">
        {bestDay && (
          <span>
            Bedste dag{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {formatCurrency(bestDay.commission)}
            </span>
          </span>
        )}
        <span>
          Nuldage{" "}
          <span className="font-semibold tabular-nums text-foreground">
            {zeroDays}/{workdayData.length}
          </span>
        </span>
      </div>
    </HomeCard>
  );
}
