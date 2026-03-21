import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, AlertTriangle, TrendingDown, UserMinus } from "lucide-react";
import type { ForecastResult } from "@/types/forecast";

interface Props {
  forecast: ForecastResult;
}

interface Insight {
  icon: typeof AlertTriangle;
  color: string;
  text: string;
}

export function ForecastInsights({ forecast }: Props) {
  const insights: Insight[] = [];
  const employees = forecast.establishedEmployees;

  if (employees.length === 0) return null;

  // Avg SPH
  const avgSph = employees.reduce((s, e) => s + e.expectedSph, 0) / employees.length;

  // Low performers (< 50% of avg)
  const lowPerformers = employees.filter(e => e.expectedSph < avgSph * 0.5 && e.expectedSph > 0);
  if (lowPerformers.length > 0) {
    insights.push({
      icon: TrendingDown,
      color: "text-orange-600",
      text: `${lowPerformers.length} sælger${lowPerformers.length > 1 ? 'e' : ''} performer under 50% af teamgennemsnittet — overvej coaching eller opfølgning.`,
    });
  }

  // High churn risk
  const highChurn = employees.filter(e => e.churnProbability > 0.3);
  if (highChurn.length > 0) {
    const names = highChurn.slice(0, 3).map(e => e.employeeName.split(' ')[0]).join(', ');
    insights.push({
      icon: UserMinus,
      color: "text-destructive",
      text: `${highChurn.length} medarbejder${highChurn.length > 1 ? 'e' : ''} har forhøjet churn-risiko (${names}${highChurn.length > 3 ? ' m.fl.' : ''}) — fokusér på fastholdelse.`,
    });
  }

  // Holiday impact
  const holidayDriver = forecast.drivers.find(d => d.key === "holidays");
  if (holidayDriver) {
    const count = parseInt(holidayDriver.value) || 0;
    if (count >= 2) {
      insights.push({
        icon: AlertTriangle,
        color: "text-amber-600",
        text: `${count} helligdage i perioden reducerer kapaciteten — overvej ekstra vagter i ugerne omkring.`,
      });
    }
  }

  // Absence impact
  if (forecast.absenceLoss > 20) {
    insights.push({
      icon: AlertTriangle,
      color: "text-orange-600",
      text: `Fravær koster ${forecast.absenceLoss} salg denne måned — tjek om der er mønstre eller mulighed for vikardækning.`,
    });
  }

  if (insights.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          Anbefalinger
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {insights.map((insight, i) => {
          const Icon = insight.icon;
          return (
            <div key={i} className="flex gap-3 text-sm">
              <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${insight.color}`} />
              <p className="text-muted-foreground leading-relaxed">{insight.text}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
