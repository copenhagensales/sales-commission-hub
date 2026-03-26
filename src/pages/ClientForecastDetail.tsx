import { useParams, useNavigate } from "react-router-dom";
import { useForecastSettingsById, useDeleteForecastSettings } from "@/hooks/useForecastSettings";
import { useClientForecast } from "@/hooks/useClientForecast";
import { ForecastKpiCards } from "@/components/forecast/ForecastKpiCards";
import { ForecastSettingsPanel } from "@/components/forecast/ForecastSettingsPanel";
import { ForecastEmployeeTable } from "@/components/forecast/ForecastEmployeeTable";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2, Loader2 } from "lucide-react";

const MONTHS = [
  "Januar", "Februar", "Marts", "April", "Maj", "Juni",
  "Juli", "August", "September", "Oktober", "November", "December"
];

export default function ClientForecastDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: settings, isLoading: settingsLoading } = useForecastSettingsById(id);
  const deleteMutation = useDeleteForecastSettings();
  
  const forecast = useClientForecast(
    settings?.team_id,
    settings,
    settings?.month || 1,
    settings?.year || 2026
  );

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="container mx-auto p-6 text-center py-20">
        <p className="text-muted-foreground">Forecast ikke fundet</p>
        <Button variant="ghost" onClick={() => navigate("/client-forecast")} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Tilbage
        </Button>
      </div>
    );
  }

  const handleDelete = () => {
    if (confirm("Er du sikker på du vil slette dette forecast?")) {
      deleteMutation.mutate(settings.id, {
        onSuccess: () => navigate("/client-forecast"),
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/client-forecast")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{settings.teams?.name || "Team"}</h1>
            <p className="text-muted-foreground text-sm">
              Forecast for {MONTHS[settings.month - 1]} {settings.year}
            </p>
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleteMutation.isPending}>
          <Trash2 className="h-4 w-4 mr-1" /> Slet
        </Button>
      </div>

      <ForecastKpiCards forecast={forecast} settings={settings} />
      <ForecastSettingsPanel settings={settings} />
      
      <div>
        <h2 className="text-lg font-semibold mb-3">Medarbejdere</h2>
        <ForecastEmployeeTable employees={forecast.employees} />
      </div>
    </div>
  );
}
