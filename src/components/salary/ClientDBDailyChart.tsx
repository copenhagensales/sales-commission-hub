import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { useSalesAggregatesExtended } from "@/hooks/useSalesAggregatesExtended";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { format, parseISO } from "date-fns";

interface ClientDBDailyChartProps {
  periodStart: Date;
  periodEnd: Date;
}

export function ClientDBDailyChart({ periodStart, periodEnd }: ClientDBDailyChartProps) {
  const { data: aggregates, isLoading } = useSalesAggregatesExtended({
    periodStart,
    periodEnd,
    groupBy: ["date"],
    enabled: true,
  });

  const chartData = useMemo(() => {
    if (!aggregates?.byDate) return [];

    return Object.entries(aggregates.byDate)
      .map(([dateStr, d]) => {
        const db = d.revenue - d.commission * 1.125;
        return {
          date: dateStr,
          label: format(parseISO(dateStr), "d/M"),
          db: Math.round(db),
          sales: d.sales,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [aggregates]);

  // Linear regression trend line
  const trendData = useMemo(() => {
    if (chartData.length < 2) return chartData.map((d) => ({ ...d, trend: d.db }));

    const n = chartData.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += chartData[i].db;
      sumXY += i * chartData[i].db;
      sumX2 += i * i;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return chartData.map((d, i) => ({
      ...d,
      trend: Math.round(slope * i + intercept),
    }));
  }, [chartData]);

  if (isLoading) {
    return (
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            DB pr. dag
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
            Indlæser...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (trendData.length === 0) return null;

  const formatDKK = (v: number) =>
    v >= 1000 || v <= -1000
      ? `${(v / 1000).toFixed(0)}k`
      : `${v}`;

  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          DB pr. dag (alle klienter)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={formatDKK}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              width={50}
            />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value: number, name: string) => {
                if (name === "trend") return [`${value.toLocaleString("da-DK")} kr`, "Trend"];
                return [`${value.toLocaleString("da-DK")} kr`, "DB"];
              }}
              labelFormatter={(label: string, payload: any[]) => {
                const sales = payload?.[0]?.payload?.sales;
                return `${label}${sales != null ? ` · ${sales} salg` : ""}`;
              }}
            />
            <Bar dataKey="db" radius={[3, 3, 0, 0]} maxBarSize={40}>
              {trendData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.db >= 0 ? "hsl(142, 71%, 45%)" : "hsl(0, 84%, 60%)"}
                  opacity={0.85}
                />
              ))}
            </Bar>
            <Line
              dataKey="trend"
              type="linear"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              activeDot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
