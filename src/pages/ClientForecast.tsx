import { useState } from "react";
import { useForecastSettingsList } from "@/hooks/useForecastSettings";
import { ForecastCard } from "@/components/forecast/ForecastCard";
import { CreateForecastDialog } from "@/components/forecast/CreateForecastDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, BarChart3 } from "lucide-react";

const MONTHS = [
  "Januar", "Februar", "Marts", "April", "Maj", "Juni",
  "Juli", "August", "September", "Oktober", "November", "December"
];

export default function ClientForecast() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const { data: forecasts, isLoading } = useForecastSettingsList(month, year);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Kundeforecast</h1>
          <p className="text-muted-foreground text-sm">Overblik over alle teams med aktive forecasts</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <CreateForecastDialog month={month} year={year} existingTeamIds={forecasts?.map(f => f.team_id) || []} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !forecasts?.length ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Ingen forecasts oprettet</h3>
          <p className="text-muted-foreground text-sm mt-1">
            Opret et forecast for et team ved at klikke "Opret forecast" ovenfor
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {forecasts.map(f => (
            <ForecastCard key={f.id} settings={f} />
          ))}
        </div>
      )}
    </div>
  );
}
