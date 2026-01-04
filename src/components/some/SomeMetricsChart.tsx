import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, subDays, parseISO, isAfter } from "date-fns";
import { da } from "date-fns/locale";
import type { WeeklyMetrics } from "@/hooks/useSomeMetrics";

interface SomeMetricsChartProps {
  historicalMetrics: WeeklyMetrics[];
}

type PeriodDays = 30 | 60 | 90;

export function SomeMetricsChart({ historicalMetrics }: SomeMetricsChartProps) {
  const [periodDays, setPeriodDays] = useState<PeriodDays>(30);

  const filteredData = useMemo(() => {
    const cutoffDate = subDays(new Date(), periodDays);
    
    return historicalMetrics
      .filter((m) => isAfter(parseISO(m.week_start_date), cutoffDate))
      .map((m) => ({
        week: format(parseISO(m.week_start_date), "d. MMM", { locale: da }),
        views: m.tiktok_views,
      }));
  }, [historicalMetrics, periodDays]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-lg">TikTok visninger over tid</CardTitle>
          <div className="flex gap-1">
            {([30, 60, 90] as PeriodDays[]).map((days) => (
              <Button
                key={days}
                variant={periodDays === days ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setPeriodDays(days)}
              >
                {days} dage
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredData.length === 0 ? (
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            Ingen data for den valgte periode
          </div>
        ) : (
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="week" 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  domain={['dataMin - 10', 'dataMax + 10']}
                  tickFormatter={(value) => value.toLocaleString('da-DK')}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px"
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="views"
                  name="Visninger"
                  stroke="#25F4EE"
                  strokeWidth={2}
                  dot={{ fill: "#25F4EE" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
