import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { WeeklyMetrics } from "@/hooks/useSomeMetrics";

interface SomeKpiCardsProps {
  currentMetrics: WeeklyMetrics | null;
  previousMetrics: WeeklyMetrics | null;
}

export function SomeKpiCards({ currentMetrics, previousMetrics }: SomeKpiCardsProps) {
  const formatNumber = (num: number) => num.toLocaleString("da-DK");
  
  const calculateTrend = (current: number, previous: number) => {
    if (previous === 0) return { percent: 0, direction: "neutral" as const };
    const change = ((current - previous) / previous) * 100;
    return {
      percent: Math.abs(change),
      direction: change > 0 ? "up" as const : change < 0 ? "down" as const : "neutral" as const,
    };
  };

  const kpis = [
    {
      label: "TikTok Følgere",
      value: currentMetrics?.tiktok_followers ?? 0,
      previous: previousMetrics?.tiktok_followers ?? 0,
      color: "bg-black",
    },
    {
      label: "TikTok Visninger",
      value: currentMetrics?.tiktok_views ?? 0,
      previous: previousMetrics?.tiktok_views ?? 0,
      color: "bg-black",
    },
    {
      label: "Instagram Følgere",
      value: currentMetrics?.insta_followers ?? 0,
      previous: previousMetrics?.insta_followers ?? 0,
      color: "bg-gradient-to-r from-purple-500 to-pink-500",
    },
    {
      label: "Instagram Visninger",
      value: currentMetrics?.insta_views ?? 0,
      previous: previousMetrics?.insta_views ?? 0,
      color: "bg-gradient-to-r from-purple-500 to-pink-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {kpis.map((kpi) => {
        const trend = calculateTrend(kpi.value, kpi.previous);
        const diff = kpi.value - kpi.previous;
        
        return (
          <Card key={kpi.label} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2.5 h-2.5 rounded-full ${kpi.color}`} />
                <span className="text-xs text-muted-foreground font-medium truncate">
                  {kpi.label}
                </span>
              </div>
              
              <div className="text-2xl font-bold mb-1">
                {formatNumber(kpi.value)}
              </div>
              
              <div className="flex items-center gap-1.5">
                {trend.direction === "up" && (
                  <div className="flex items-center gap-1 text-green-600">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">
                      +{formatNumber(diff)} ({trend.percent.toFixed(1)}%)
                    </span>
                  </div>
                )}
                {trend.direction === "down" && (
                  <div className="flex items-center gap-1 text-red-500">
                    <TrendingDown className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">
                      {formatNumber(diff)} ({trend.percent.toFixed(1)}%)
                    </span>
                  </div>
                )}
                {trend.direction === "neutral" && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Minus className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Ingen ændring</span>
                  </div>
                )}
                <span className="text-xs text-muted-foreground ml-1">vs. forrige uge</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
