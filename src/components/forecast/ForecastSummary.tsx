import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import type { ForecastResult } from "@/types/forecast";

interface Props {
  forecast: ForecastResult;
  periodLabel: string;
  isCurrentPeriod: boolean;
}

export function ForecastSummary({ forecast, periodLabel, isCurrentPeriod }: Props) {
  const totalSales = forecast.totalSalesExpected;
  const numEmployees = forecast.establishedEmployees.length;
  const numCohorts = forecast.cohorts.length;
  const absenceLoss = forecast.absenceLoss;
  const churnLoss = forecast.churnLoss + (forecast.establishedChurnLoss || 0);
  const hasActual = isCurrentPeriod && forecast.actualSalesToDate !== undefined && forecast.actualSalesToDate > 0;

  // Find holidays driver
  const holidayDriver = forecast.drivers.find(d => d.key === "holidays");
  const holidayCount = holidayDriver ? parseInt(holidayDriver.value) || 0 : 0;

  // Build narrative parts
  const parts: string[] = [];

  if (hasActual) {
    parts.push(
      `Der er allerede lavet ${forecast.actualSalesToDate!.toLocaleString('da-DK')} salg, og vi forventer yderligere ${forecast.remainingForecast!.toLocaleString('da-DK')} i de resterende ${forecast.daysRemaining} arbejdsdage.`
    );
  }

  // Context about team
  const teamParts: string[] = [];
  if (numEmployees > 0) teamParts.push(`${numEmployees} etablerede sælgere`);
  if (numCohorts > 0) teamParts.push(`${numCohorts} opstartshold`);
  if (teamParts.length) parts.push(`Baseret på ${teamParts.join(' og ')}.`);

  // Impact factors
  const impacts: string[] = [];
  if (absenceLoss > 0) impacts.push(`fravær reducerer med ${absenceLoss} salg`);
  if (churnLoss > 0) impacts.push(`churn-risiko trækker ${churnLoss} salg`);
  if (holidayCount > 0) impacts.push(`${holidayCount} helligdage i perioden`);
  if (impacts.length) parts.push(`Bemærk: ${impacts.join(', ')}.`);

  // High churn employees
  const highChurn = forecast.establishedEmployees.filter(e => e.churnProbability > 0.3);
  if (highChurn.length > 0) {
    parts.push(`${highChurn.length} medarbejder${highChurn.length > 1 ? 'e' : ''} har forhøjet churn-risiko.`);
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
      <CardContent className="p-5">
        <div className="flex gap-4">
          <div className="p-2.5 rounded-xl bg-primary/10 h-fit">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-3xl font-bold tracking-tight">{totalSales.toLocaleString('da-DK')}</span>
              <span className="text-sm text-muted-foreground font-medium">forventede salg i {periodLabel}</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {parts.join(' ')}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
