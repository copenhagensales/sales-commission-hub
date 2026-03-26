import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useClientForecast } from "@/hooks/useClientForecast";
import type { ForecastSettings } from "@/hooks/useForecastSettings";
import { TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";

interface Props {
  settings: ForecastSettings & { teams: { id: string; name: string } };
}

export function ForecastCard({ settings }: Props) {
  const navigate = useNavigate();
  const forecast = useClientForecast(settings.team_id, settings, settings.month, settings.year);
  
  const goal = settings.client_goal;
  const progressPct = goal > 0 ? Math.min(100, Math.round((forecast.actualSalesMtd / goal) * 100)) : 0;
  
  // Pace calculation: expected by now vs actual
  const today = new Date();
  const daysInMonth = new Date(settings.year, settings.month, 0).getDate();
  const currentDay = today.getMonth() + 1 === settings.month && today.getFullYear() === settings.year
    ? today.getDate()
    : daysInMonth;
  const expectedByNow = goal > 0 ? Math.round((currentDay / daysInMonth) * goal) : 0;
  
  let status: "ahead" | "behind" | "on_track" = "on_track";
  if (expectedByNow > 0) {
    const paceRatio = forecast.actualSalesMtd / expectedByNow;
    if (paceRatio >= 1.05) status = "ahead";
    else if (paceRatio < 0.95) status = "behind";
  }

  const statusConfig = {
    ahead: { label: "Foran", variant: "default" as const, icon: TrendingUp, color: "text-green-600" },
    behind: { label: "Bagud", variant: "destructive" as const, icon: TrendingDown, color: "text-red-600" },
    on_track: { label: "På mål", variant: "secondary" as const, icon: Minus, color: "text-muted-foreground" },
  };

  const { label, variant, icon: StatusIcon, color } = statusConfig[status];

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate(`/client-forecast/${settings.id}`)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{settings.teams?.name || "Team"}</CardTitle>
          <Badge variant={variant} className="gap-1">
            <StatusIcon className="h-3 w-3" />
            {label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {forecast.isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <p className="text-muted-foreground">Mål</p>
                <p className="font-semibold text-lg">{goal}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Forecast</p>
                <p className={`font-semibold text-lg ${color}`}>{forecast.totalForecast}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Faktisk</p>
                <p className="font-semibold text-lg">{forecast.actualSalesMtd}</p>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Fremdrift</span>
                <span>{progressPct}%</span>
              </div>
              <Progress value={progressPct} className="h-2" />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
