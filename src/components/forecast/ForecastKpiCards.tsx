import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, Users, Clock, TrendingDown, UserMinus, BarChart3, CalendarDays, Target } from "lucide-react";
import { ForecastIntervalBadge } from "./ForecastIntervalBadge";
import type { ForecastResult } from "@/types/forecast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMemo } from "react";
import { eachDayOfInterval, isWeekend, parseISO, format } from "date-fns";

interface Props {
  forecast: ForecastResult;
  clientTarget?: number;
  danishHolidays?: string[];
  overrideTotal?: number;
}

function getWorkingDays(start: string, end: string, holidays: string[] = []): number {
  try {
    const holidaySet = new Set(holidays);
    const days = eachDayOfInterval({ start: parseISO(start), end: parseISO(end) });
    return days.filter(d => !isWeekend(d) && !holidaySet.has(format(d, 'yyyy-MM-dd'))).length;
  } catch {
    return 22; // fallback
  }
}

export function ForecastKpiCards({ forecast, clientTarget, danishHolidays = [], overrideTotal }: Props) {
  const effectiveTotal = overrideTotal ?? forecast.totalSalesExpected;
  const hasActualData = forecast.actualSalesToDate !== undefined && forecast.actualSalesToDate > 0;

  // Scale Low/High proportionally when overrides are applied
  const scaleFactor = overrideTotal && forecast.totalSalesExpected > 0
    ? overrideTotal / forecast.totalSalesExpected
    : 1;
  const effectiveLow = Math.round(forecast.totalSalesLow * scaleFactor);
  const effectiveHigh = Math.round(forecast.totalSalesHigh * scaleFactor);

  const workingDays = useMemo(
    () => getWorkingDays(forecast.periodStart, forecast.periodEnd, danishHolidays),
    [forecast.periodStart, forecast.periodEnd, danishHolidays]
  );

  const salesPerDay = useMemo(() => {
    if (clientTarget && clientTarget > 0) {
      return clientTarget / workingDays;
    }
    return effectiveTotal / workingDays;
  }, [effectiveTotal, workingDays]);

  // If we have actual data, calculate remaining sales/day needed
  const remainingSalesPerDay = useMemo(() => {
    if (!hasActualData || !clientTarget || !forecast.daysRemaining) return undefined;
    const remaining = clientTarget - (forecast.actualSalesToDate ?? 0);
    if (remaining <= 0 || forecast.daysRemaining <= 0) return 0;
    return remaining / forecast.daysRemaining;
  }, [hasActualData, clientTarget, forecast.actualSalesToDate, forecast.daysRemaining]);

  const hasProductSplit = forecast.totalSales5G !== undefined && forecast.totalSalesSubs !== undefined;
  // Scale split values proportionally with override
  const effectiveSubs = hasProductSplit ? Math.round((forecast.totalSalesSubs || 0) * scaleFactor) : undefined;
  const effective5G = hasProductSplit ? Math.round((forecast.totalSales5G || 0) * scaleFactor) : undefined;

  const cards = [
    {
      label: "Forventet salg",
      value: effectiveTotal,
      low: effectiveLow,
      high: effectiveHigh,
      unit: "salg",
      icon: ShoppingCart,
      tooltip: hasActualData
        ? `${forecast.actualSalesToDate} faktiske salg + ${forecast.remainingForecast} forventet i resterende ${forecast.daysRemaining} arbejdsdage.`
        : "Samlet forecast baseret på individuel performance, nye hold, churn og fravær.",
      color: "text-primary",
      actualBreakdown: hasActualData ? {
        actual: forecast.actualSalesToDate!,
        remaining: forecast.remainingForecast!,
        daysElapsed: forecast.daysElapsed!,
        daysRemaining: forecast.daysRemaining!,
      } : undefined,
      productSplit: hasProductSplit ? {
        subs: effectiveSubs!,
        fiveG: effective5G!,
      } : undefined,
    },
    {
      label: "Arbejdsdage",
      value: workingDays,
      unit: "dage",
      icon: CalendarDays,
      tooltip: `Der er ${workingDays} arbejdsdage (hverdage ekskl. weekender) i forecast-perioden.${hasActualData && forecast.daysRemaining ? ` ${forecast.daysRemaining} dage tilbage.` : ""}`,
      color: "text-amber-600",
      subtitle: hasActualData && forecast.daysElapsed
        ? `${forecast.daysElapsed} passeret · ${forecast.daysRemaining} tilbage`
        : undefined,
    },
    {
      label: clientTarget ? "Salg/dag (target)" : "Salg/dag (forecast)",
      value: salesPerDay,
      unit: "salg/dag",
      icon: Target,
      tooltip: clientTarget
        ? `For at nå targettet (${clientTarget.toLocaleString("da-DK")} salg) skal der laves ${salesPerDay.toFixed(1)} salg pr. arbejdsdag.${remainingSalesPerDay !== undefined ? ` Resterende: ${remainingSalesPerDay.toFixed(1)} salg/dag.` : ""}`
        : `Baseret på forecast (${effectiveTotal.toLocaleString("da-DK")} salg) fordelt på ${workingDays} arbejdsdage.`,
      color: "text-teal-600",
      isDecimal: true,
      subtitle: remainingSalesPerDay !== undefined && remainingSalesPerDay > 0
        ? `${remainingSalesPerDay.toFixed(1)} salg/dag nødvendigt resten af mdr.`
        : undefined,
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
      value: effectiveTotal,
      low: effectiveLow,
      high: effectiveHigh,
      unit: "",
      icon: BarChart3,
      tooltip: "Low = P20 scenarie, High = P80 scenarie.",
      color: "text-emerald-600",
      isInterval: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                        <>
                          <p className="text-2xl font-bold tracking-tight">
                            {'isDecimal' in card && card.isDecimal
                              ? Number(card.value).toFixed(1)
                              : Number(card.value).toLocaleString('da-DK')}
                            <span className="text-sm font-normal text-muted-foreground ml-1">{card.unit}</span>
                          </p>
                          {card.actualBreakdown && (
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium text-emerald-600">{card.actualBreakdown.actual.toLocaleString('da-DK')} faktiske</span>
                              {' + '}
                              <span className="font-medium">{card.actualBreakdown.remaining.toLocaleString('da-DK')} forventet</span>
                              <span className="ml-1">({card.actualBreakdown.daysRemaining} dage tilbage)</span>
                            </p>
                          )}
                          {'productSplit' in card && card.productSplit && (
                            <p className="text-xs text-muted-foreground">
                              heraf <span className="font-medium">{card.productSplit.subs.toLocaleString('da-DK')} abon.</span>
                              {' + '}
                              <span className="font-medium">{card.productSplit.fiveG.toLocaleString('da-DK')} 5G</span>
                            </p>
                          )}
                          {'subtitle' in card && card.subtitle && (
                            <p className="text-xs text-muted-foreground">{card.subtitle}</p>
                        </>
                      )}
                      {!card.isInterval && card.low !== undefined && !card.actualBreakdown && (
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
