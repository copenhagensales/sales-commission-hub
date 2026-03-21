import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BarChart3, RefreshCcw, Loader2 } from "lucide-react";
import { ForecastKpiCards } from "@/components/forecast/ForecastKpiCards";
import { ForecastDriversPanel } from "@/components/forecast/ForecastDriversPanel";
import { ForecastBreakdownTable } from "@/components/forecast/ForecastBreakdownTable";
import { ForecastVsActualChart } from "@/components/forecast/ForecastVsActualChart";
import { ForecastCohortManager } from "@/components/forecast/ForecastCohortManager";
import { ForecastAssumptions } from "@/components/forecast/ForecastAssumptions";
import { DataFreshnessBadge } from "@/components/ui/DataFreshnessBadge";
import { MOCK_RAMP_PROFILE, MOCK_SURVIVAL_PROFILE } from "@/lib/calculations/forecast";
import { useClientForecast } from "@/hooks/useClientForecast";
import { useForecastVsActual } from "@/hooks/useForecastVsActual";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ClientForecastCohort } from "@/types/forecast";

export default function Forecast() {
  const [selectedClient, setSelectedClient] = useState("all");
  const [period, setPeriod] = useState<"current" | "next">("next");
  const queryClient = useQueryClient();

  // Fetch real clients for dropdown
  const { data: clients = [] } = useQuery({
    queryKey: ["forecast-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Real forecast data
  const { data: forecastData, isLoading: forecastLoading, refetch } = useClientForecast(selectedClient, period);
  const forecast = forecastData?.forecast;
  const cohorts = forecastData?.cohorts || [];
  const calculatedAt = forecastData?.calculatedAt || null;

  // Real vs actual data
  const { data: vsActual = [], isLoading: vsActualLoading } = useForecastVsActual(selectedClient);

  // Add cohort mutation
  const addCohort = useMutation({
    mutationFn: async (data: Omit<ClientForecastCohort, 'id' | 'created_at' | 'created_by'>) => {
      const { error } = await supabase
        .from("client_forecast_cohorts")
        .insert({
          client_id: data.client_id || selectedClient,
          client_campaign_id: data.client_campaign_id || null,
          start_date: data.start_date,
          planned_headcount: data.planned_headcount,
          ramp_profile_id: data.ramp_profile_id || null,
          survival_profile_id: data.survival_profile_id || null,
          note: data.note || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-forecast"] });
      toast.success("Opstartshold tilføjet");
    },
    onError: () => {
      toast.error("Kunne ikke tilføje opstartshold");
    },
  });

  // Delete cohort mutation
  const deleteCohort = useMutation({
    mutationFn: async (cohortId: string) => {
      const { error } = await supabase
        .from("client_forecast_cohorts")
        .delete()
        .eq("id", cohortId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-forecast"] });
      toast.success("Opstartshold slettet");
    },
    onError: () => {
      toast.error("Kunne ikke slette opstartshold");
    },
  });

  const periodLabel = useMemo(() => {
    const now = new Date();
    const target = period === "current"
      ? now
      : new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return target.toLocaleDateString('da-DK', { month: 'long', year: 'numeric' });
  }, [period]);

  const avgAttendance = forecast && forecast.establishedEmployees.length > 0
    ? forecast.establishedEmployees.reduce((s, e) => s + e.attendanceFactor, 0) / forecast.establishedEmployees.length
    : 0.92;

  // Baseline SPH from established employees
  const baselineSph = forecast && forecast.establishedEmployees.length > 0
    ? forecast.establishedEmployees.reduce((s, e) => s + e.expectedSph, 0) / forecast.establishedEmployees.length
    : 0.45;

  const isLoading = forecastLoading;

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Kundeforecast</h1>
                <p className="text-sm text-muted-foreground">
                  Forecast for <span className="font-medium capitalize">{periodLabel}</span>
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <DataFreshnessBadge calculatedAt={calculatedAt} />
            <ToggleGroup
              type="single"
              value={period}
              onValueChange={(v) => { if (v) setPeriod(v as "current" | "next"); }}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="current">Denne måned</ToggleGroupItem>
              <ToggleGroupItem value="next">Næste måned</ToggleGroupItem>
            </ToggleGroup>
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Vælg kunde" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle kunder</SelectItem>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Beregner forecast...</p>
            </div>
          </div>
        )}

        {/* Content */}
        {!isLoading && forecast && (
          <>
            {/* KPI Cards */}
            <ForecastKpiCards forecast={forecast} />

            {/* Main content grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left column: Drivers + Cohorts + Assumptions */}
              <div className="space-y-4">
                <ForecastDriversPanel drivers={forecast.drivers} />
                <ForecastCohortManager
                  cohorts={cohorts}
                  onAdd={(data) => {
                    addCohort.mutate({
                      ...data,
                      client_id: selectedClient === "all" ? clients[0]?.id || "" : selectedClient,
                    });
                  }}
                  onDelete={(id) => deleteCohort.mutate(id)}
                />
                <ForecastAssumptions
                  rampProfile={MOCK_RAMP_PROFILE}
                  survivalProfile={MOCK_SURVIVAL_PROFILE}
                  avgAttendance={avgAttendance}
                  baselineSph={baselineSph}
                />
              </div>

              {/* Right column: Breakdown + Chart */}
              <div className="lg:col-span-2 space-y-4">
                <ForecastBreakdownTable
                  employees={forecast.establishedEmployees}
                  cohorts={forecast.cohorts}
                />
                <ForecastVsActualChart data={vsActual} />
              </div>
            </div>
          </>
        )}

        {/* Empty state */}
        {!isLoading && forecast && forecast.totalSalesExpected === 0 && forecast.establishedEmployees.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Ingen data for denne kunde</p>
            <p className="text-sm mt-1">Vælg en anden kunde eller tjek at der er tilknyttede teams og sælgere.</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
