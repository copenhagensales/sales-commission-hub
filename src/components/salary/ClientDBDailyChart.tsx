import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
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

interface DateAggregate {
  revenue: number;
  commission: number;
  sales: number;
}

interface ClientDBDailyChartProps {
  byDate: Record<string, DateAggregate>;
  nettoTotal: number;
  teamDB: number;
  totalRevenue: number;
  totalOverhead: number;
  isLoading: boolean;
}

export function ClientDBDailyChart({
  byDate,
  nettoTotal,
  teamDB,
  totalRevenue,
  totalOverhead,
  isLoading,
}: ClientDBDailyChartProps) {
  const chartData = useMemo(() => {
    if (!byDate || Object.keys(byDate).length === 0) return [];

    const entries = Object.entries(byDate)
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

    // Distribute overhead only across weekdays with sales
    const isWeekday = (dateStr: string) => {
      const day = parseISO(dateStr).getDay();
      return day >= 1 && day <= 5;
    };
    const weekdaysWithSales = entries.filter((e) => e.sales > 0 && isWeekday(e.date)).length || 1;
    const dailyOverhead = totalOverhead / weekdaysWithSales;

    return entries.map((e) => ({
      ...e,
      netto: Math.round(e.db - (e.sales > 0 && isWeekday(e.date) ? dailyOverhead : 0)),
    }));
  }, [byDate, totalOverhead]);

  // Linear regression trend line on netto
  const trendData = useMemo(() => {
    if (chartData.length < 2) return chartData.map((d) => ({ ...d, trend: d.netto }));

    const n = chartData.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += chartData[i].netto;
      sumXY += i * chartData[i].netto;
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
            NETTO pr. dag
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
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            NETTO pr. dag
          </CardTitle>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-muted-foreground">
              NETTO: <span className={nettoTotal >= 0 ? "text-green-400 font-semibold" : "text-red-400 font-semibold"}>
                {nettoTotal.toLocaleString("da-DK")} kr
              </span>
            </span>
            <span className="text-muted-foreground">
              Team DB: <span className={teamDB >= 0 ? "text-green-400 font-semibold" : "text-red-400 font-semibold"}>
                {teamDB.toLocaleString("da-DK")} kr
              </span>
            </span>
            <span className="text-muted-foreground">
              Oms: <span className="text-foreground font-semibold">{totalRevenue.toLocaleString("da-DK")} kr</span>
            </span>
          </div>
        </div>
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
                return [`${value.toLocaleString("da-DK")} kr`, "NETTO"];
              }}
              labelFormatter={(label: string, payload: any[]) => {
                const sales = payload?.[0]?.payload?.sales;
                return `${label}${sales != null ? ` · ${sales} salg` : ""}`;
              }}
            />
            <Bar dataKey="netto" radius={[3, 3, 0, 0]} maxBarSize={40}>
              {trendData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.netto >= 0 ? "hsl(142, 71%, 45%)" : "hsl(0, 84%, 60%)"}
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
