import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { ForecastResult } from "@/types/forecast";

interface Props {
  forecast: ForecastResult;
  clientTarget?: number | null;
}

export function ForecastProgressBar({ forecast, clientTarget }: Props) {
  const actual = forecast.actualSalesToDate;
  const total = clientTarget ?? forecast.totalSalesExpected;
  const daysElapsed = forecast.daysElapsed;
  const daysRemaining = forecast.daysRemaining;

  if (!actual || !daysElapsed || !daysRemaining || total === 0) return null;

  const totalDays = daysElapsed + daysRemaining;
  const progressPct = Math.min(100, Math.round((actual / total) * 100));
  const timePct = Math.round((daysElapsed / totalDays) * 100);

  // Pace calculation
  const dailyPaceActual = daysElapsed > 0 ? actual / daysElapsed : 0;
  const dailyPaceNeeded = daysRemaining > 0 ? (total - actual) / daysRemaining : 0;

  // Status
  const ratio = timePct > 0 ? progressPct / timePct : 1;
  let status: 'ahead' | 'on_track' | 'behind';
  if (ratio >= 1.05) status = 'ahead';
  else if (ratio >= 0.92) status = 'on_track';
  else status = 'behind';

  const statusConfig = {
    ahead: { label: 'Foran plan', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', Icon: TrendingUp },
    on_track: { label: 'På sporet', color: 'bg-blue-100 text-blue-700 border-blue-200', Icon: Minus },
    behind: { label: 'Bagud', color: 'bg-destructive/10 text-destructive border-destructive/20', Icon: TrendingDown },
  };

  const config = statusConfig[status];
  const StatusIcon = config.Icon;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Månedens progress</span>
              <Badge variant="outline" className={`text-xs ${config.color}`}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {config.label}
              </Badge>
            </div>
            <span className="text-sm tabular-nums text-muted-foreground">
              {actual.toLocaleString('da-DK')} / {total.toLocaleString('da-DK')} salg
            </span>
          </div>

          <div className="relative">
            <Progress value={progressPct} className="h-3" />
            {/* Time marker */}
            <div
              className="absolute top-0 h-3 w-0.5 bg-foreground/40 rounded-full"
              style={{ left: `${timePct}%` }}
              title={`${timePct}% af måneden forløbet`}
            />
          </div>

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              Nuværende pace: <span className="font-medium text-foreground">{Math.round(dailyPaceActual)} salg/dag</span>
            </span>
            <span>
              Behøves resten: <span className="font-medium text-foreground">{Math.round(dailyPaceNeeded)} salg/dag</span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
