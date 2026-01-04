import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, subDays, parseISO, isAfter } from "date-fns";
import { da } from "date-fns/locale";
import type { WeeklyMetrics } from "@/hooks/useSomeMetrics";

interface SomeCombinedActivityChartProps {
  historicalMetrics: WeeklyMetrics[];
}

export function SomeCombinedActivityChart({ historicalMetrics }: SomeCombinedActivityChartProps) {
  const chartData = useMemo(() => {
    const cutoffDate = subDays(new Date(), 30);
    
    return historicalMetrics
      .filter((m) => isAfter(parseISO(m.week_start_date), cutoffDate))
      .map((m) => ({
        week: format(parseISO(m.week_start_date), "d. MMM", { locale: da }),
        followers: m.tiktok_followers,
      }))
      .sort((a, b) => a.week.localeCompare(b.week));
  }, [historicalMetrics]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">TikTok følgere sidste 30 dage</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            Ingen data for de sidste 30 dage
          </div>
        ) : (
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="tiktokGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#25F4EE" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#25F4EE" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="week" 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  tickFormatter={formatNumber}
                  className="text-muted-foreground"
                  domain={['dataMin - 5', 'dataMax + 5']}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px"
                  }}
                  formatter={(value: number) => [formatNumber(value), ""]}
                />
                <Area
                  type="monotone"
                  dataKey="followers"
                  name="Følgere"
                  stroke="#25F4EE"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#tiktokGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
