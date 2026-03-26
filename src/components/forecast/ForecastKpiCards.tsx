import { Card, CardContent } from "@/components/ui/card";
import { Target, TrendingUp, BarChart3, HeartPulse, Palmtree, Gauge } from "lucide-react";
import type { ClientForecastResult } from "@/hooks/useClientForecast";
import type { ForecastSettings } from "@/hooks/useForecastSettings";

interface Props {
  forecast: ClientForecastResult;
  settings: ForecastSettings;
}

export function ForecastKpiCards({ forecast, settings }: Props) {
  const goal = settings.client_goal;
  const today = new Date();
  const daysInMonth = new Date(settings.year, settings.month, 0).getDate();
  const currentDay = today.getMonth() + 1 === settings.month && today.getFullYear() === settings.year
    ? today.getDate()
    : daysInMonth;
  const expectedByNow = goal > 0 ? Math.round((currentDay / daysInMonth) * goal) : 0;
  const pace = expectedByNow > 0 ? Math.round((forecast.actualSalesMtd / expectedByNow) * 100) : 0;

  const kpis = [
    { label: "Salg MTD", value: forecast.actualSalesMtd, icon: BarChart3, color: "text-blue-600" },
    { label: "Forecast", value: forecast.totalForecast, icon: TrendingUp, color: "text-emerald-600" },
    { label: "Kundens mål", value: goal, icon: Target, color: "text-orange-600" },
    { label: "Pace", value: `${pace}%`, icon: Gauge, color: pace >= 100 ? "text-green-600" : "text-red-600" },
    { label: "Sygdom %", value: `${settings.sick_pct}%`, icon: HeartPulse, color: "text-rose-600" },
    { label: "Ferie %", value: `${settings.vacation_pct}%`, icon: Palmtree, color: "text-cyan-600" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpis.map(kpi => (
        <Card key={kpi.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              <span className="text-xs text-muted-foreground">{kpi.label}</span>
            </div>
            <p className="text-2xl font-bold">{kpi.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
