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
type MetricType = "followers" | "views" | "likes";

export function SomeMetricsChart({ historicalMetrics }: SomeMetricsChartProps) {
  const [periodDays, setPeriodDays] = useState<PeriodDays>(30);
  const [metricType, setMetricType] = useState<MetricType>("followers");

  const filteredData = useMemo(() => {
    const cutoffDate = subDays(new Date(), periodDays);
    
    return historicalMetrics
      .filter((m) => isAfter(parseISO(m.week_start_date), cutoffDate))
      .map((m) => ({
        week: format(parseISO(m.week_start_date), "d. MMM", { locale: da }),
        tiktok: metricType === "followers" ? m.tiktok_followers 
              : metricType === "views" ? m.tiktok_views 
              : m.tiktok_likes,
        instagram: metricType === "followers" ? m.insta_followers 
              : metricType === "views" ? m.insta_views 
              : m.insta_likes,
      }));
  }, [historicalMetrics, periodDays, metricType]);

  const metricLabels: Record<MetricType, string> = {
    followers: "Følgere",
    views: "Visninger",
    likes: "Likes",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-lg">Udvikling over tid</CardTitle>
          <div className="flex flex-wrap gap-2">
            <div className="flex gap-1">
              {(["followers", "views", "likes"] as MetricType[]).map((type) => (
                <Button
                  key={type}
                  variant={metricType === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMetricType(type)}
                >
                  {metricLabels[type]}
                </Button>
              ))}
            </div>
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
                <Legend />
                <Line
                  type="monotone"
                  dataKey="tiktok"
                  name="TikTok"
                  stroke="#000000"
                  strokeWidth={2}
                  dot={{ fill: "#000000" }}
                />
                <Line
                  type="monotone"
                  dataKey="instagram"
                  name="Instagram"
                  stroke="#E1306C"
                  strokeWidth={2}
                  dot={{ fill: "#E1306C" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
