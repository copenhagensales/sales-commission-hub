import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, Users, Clock, TrendingDown, UserMinus, BarChart3 } from "lucide-react";
import { ForecastIntervalBadge } from "./ForecastIntervalBadge";
import type { ForecastResult } from "@/types/forecast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  forecast: ForecastResult;
}

export function ForecastKpiCards({ forecast }: Props) {
  const cards = [
    {
      label: "Forventet salg",
      value: forecast.totalSalesExpected,
      low: forecast.totalSalesLow,
      high: forecast.totalSalesHigh,
      unit: "salg",
      icon: ShoppingCart,
      tooltip: "Samlet forecast baseret på individuel performance, nye hold, churn og fravær.",
      color: "text-primary",
    },
    {
      label: "Aktive sælgere",
      value: Math.round(forecast.totalHeads),
      unit: "personer",
      icon: Users,
      tooltip: "Antal effektive sælgere inkl. overlevende fra nye hold.",
      color: "text-blue-600",
    },
    {
      label: "Forventede timer",
      value: Math.round(forecast.totalHours),
      unit: "timer",
      icon: Clock,
      tooltip: "Planlagte timer justeret for fravær og deltid.",
      color: "text-violet-600",
    },
    {
      label: "Churn-effekt",
      value: forecast.churnLoss + (forecast.establishedChurnLoss || 0),
      unit: "tabte salg",
      icon: UserMinus,
      tooltip: "Forventede tabte salg pga. churn (nye hold + etablerede medarbejdere baseret på anciennitet og team-historik).",
      color: "text-destructive",
    },
    {
      label: "Fraværseffekt",
      value: forecast.absenceLoss,
      unit: "tabte salg",
      icon: TrendingDown,
      tooltip: "Forventede tabte salg pga. sygdom og fravær.",
      color: "text-orange-600",
    },
    {
      label: "Forecast-interval",
      value: forecast.totalSalesExpected,
      low: forecast.totalSalesLow,
      high: forecast.totalSalesHigh,
      unit: "",
      icon: BarChart3,
      tooltip: "Low = P20 scenarie, High = P80 scenarie.",
      color: "text-emerald-600",
      isInterval: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Tooltip key={card.label}>
            <TooltipTrigger asChild>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
                      {card.isInterval ? (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <ForecastIntervalBadge interval="low" value={card.low!} />
                          <ForecastIntervalBadge interval="expected" value={card.value} />
                          <ForecastIntervalBadge interval="high" value={card.high!} />
                        </div>
                      ) : (
                        <p className="text-2xl font-bold tracking-tight">
                          {card.value.toLocaleString('da-DK')}
                          <span className="text-sm font-normal text-muted-foreground ml-1">{card.unit}</span>
                        </p>
                      )}
                      {!card.isInterval && card.low !== undefined && (
                        <div className="flex gap-1.5 pt-0.5">
                          <ForecastIntervalBadge interval="low" value={card.low} />
                          <ForecastIntervalBadge interval="high" value={card.high!} />
                        </div>
                      )}
                    </div>
                    <div className={`p-2 rounded-lg bg-muted/50 ${card.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="text-xs">{card.tooltip}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
