import { useState, useMemo } from "react";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BarChart3, RefreshCcw, Loader2, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { ForecastKpiCards } from "@/components/forecast/ForecastKpiCards";
import { ForecastDriversPanel } from "@/components/forecast/ForecastDriversPanel";
import { ForecastBreakdownTable } from "@/components/forecast/ForecastBreakdownTable";
import { ForecastVsActualChart } from "@/components/forecast/ForecastVsActualChart";
import { ForecastCohortManager } from "@/components/forecast/ForecastCohortManager";
import { ForecastAssumptions } from "@/components/forecast/ForecastAssumptions";
import { ForecastSummary } from "@/components/forecast/ForecastSummary";
import { ForecastProgressBar } from "@/components/forecast/ForecastProgressBar";
import { ForecastTeamOverview } from "@/components/forecast/ForecastTeamOverview";

import { ForecastInsights } from "@/components/forecast/ForecastInsights";
import { FmWeeklyForecastTable } from "@/components/forecast/FmWeeklyForecastTable";
import { DataFreshnessBadge } from "@/components/ui/DataFreshnessBadge";
import { MOCK_RAMP_PROFILE, MOCK_SURVIVAL_PROFILE } from "@/lib/calculations/forecast";
import { useClientForecast } from "@/hooks/useClientForecast";
import { useForecastVsActual } from "@/hooks/useForecastVsActual";
import { useEmployeeForecastOverrides } from "@/hooks/useEmployeeForecastOverrides";
import { useFmWeeklyForecast } from "@/hooks/useFmWeeklyForecast";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ClientForecastCohort } from "@/types/forecast";

export default function Forecast() {
  const [selectedClient, setSelectedClient] = useState("all");
  const [period, setPeriod] = useState<"current" | "next">("next");
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
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

  // Fetch campaigns for cohort dialog
  const { data: campaigns = [] } = useQuery({
    queryKey: ["forecast-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_campaigns")
        .select("id, name, client_id, clients(name)")
        .order("name");
      if (error) throw error;
      return (data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        clientName: c.clients?.name || '',
      }));
    },
  });

  // Fetch Danish holidays for forecast period
  const { data: danishHolidays = [] } = useQuery({
    queryKey: ["danish-holidays-forecast", period],
    queryFn: async () => {
      const now = new Date();
      const target = period === "current"
        ? now
        : new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const y = target.getFullYear();
      const m = target.getMonth();
      const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const end = `${y}-${String(m + 1).padStart(2, '0')}-${new Date(y, m + 1, 0).getDate()}`;
      const { data, error } = await supabase
        .from("danish_holiday")
        .select("date")
        .gte("date", start)
        .lte("date", end);
      if (error) throw error;
      return (data || []).map((h: any) => h.date as string);
    },
  });

  // Real forecast data
  const { data: forecastData, isLoading: forecastLoading, refetch } = useClientForecast(selectedClient, period);
  const forecast = forecastData?.forecast;
  const cohorts = forecastData?.cohorts || [];
  const calculatedAt = forecastData?.calculatedAt || null;
  const activeRampProfile = forecastData?.activeRampProfile || MOCK_RAMP_PROFILE;
  const activeSurvivalProfile = forecastData?.activeSurvivalProfile || MOCK_SURVIVAL_PROFILE;

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

  // Update cohort mutation
  const updateCohort = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { start_date: string; planned_headcount: number; note: string | null; client_campaign_id: string | null } }) => {
      const { error } = await supabase
        .from("client_forecast_cohorts")
        .update({
          start_date: data.start_date,
          planned_headcount: data.planned_headcount,
          note: data.note,
          client_campaign_id: data.client_campaign_id,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-forecast"] });
      toast.success("Opstartshold opdateret");
    },
    onError: () => {
      toast.error("Kunne ikke opdatere opstartshold");
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

  // Target data
  const periodStart = useMemo(() => {
    const now = new Date();
    const m = period === "current" ? now.getMonth() : now.getMonth() + 1;
    const y = now.getFullYear() + Math.floor(m / 12);
    const month = (m % 12) + 1;
    return `${y}-${String(month).padStart(2, '0')}-01`;
  }, [period]);

  // Forecast overrides per employee
  const { overrides, upsertOverride, deleteOverride: deleteOverrideMutation } = useEmployeeForecastOverrides(selectedClient, periodStart);

  const handleOverride = (employeeId: string, value: number | null) => {
    if (value === null) {
      deleteOverrideMutation.mutate(employeeId);
    } else {
      upsertOverride.mutate({ employeeId, overrideSales: value });
    }
  };

  const { data: targetData } = useQuery({
    queryKey: ["client-target", selectedClient, periodStart],
    queryFn: async () => {
      if (selectedClient === "all") return null;
      const { data, error } = await supabase
        .from("client_monthly_targets")
        .select("target_sales")
        .eq("client_id", selectedClient)
        .eq("period_start", periodStart)
        .maybeSingle();
      if (error) throw error;
      return data?.target_sales ?? null;
    },
    enabled: selectedClient !== "all",
  });

  const upsertTarget = useMutation({
    mutationFn: async (target: number) => {
      const { error } = await supabase
        .from("client_monthly_targets")
        .upsert({
          client_id: selectedClient,
          period_start: periodStart,
          target_sales: target,
          updated_at: new Date().toISOString(),
        }, { onConflict: "client_id,period_start" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-target"] });
      toast.success("Kundetarget gemt");
    },
    onError: () => toast.error("Kunne ikke gemme target"),
  });

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
            <Link to="/forecast/rapport">
              <Button variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                Kunderapport
              </Button>
            </Link>
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
            {/* Executive Summary */}
            <ForecastSummary
              forecast={forecast}
              periodLabel={periodLabel}
              isCurrentPeriod={period === "current"}
              clientTarget={targetData}
              onTargetChange={(t) => upsertTarget.mutate(t)}
              showTarget={selectedClient !== "all"}
            />

            {/* Progress bar (current period only) */}
            {period === "current" && <ForecastProgressBar forecast={forecast} clientTarget={targetData} />}

            {/* Team Overview */}
            <ForecastTeamOverview
              forecast={forecast}
              isCurrentPeriod={period === "current"}
              onTeamClick={setSelectedTeam}
              selectedTeam={selectedTeam}
            />

            {/* KPI Cards */}
            <ForecastKpiCards forecast={forecast} clientTarget={targetData ?? undefined} danishHolidays={danishHolidays} />


            {/* Main content grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left column: Drivers + Insights + Cohorts + Assumptions */}
              <div className="space-y-4">
                <ForecastDriversPanel drivers={forecast.drivers} />
                <ForecastInsights forecast={forecast} />
                <ForecastCohortManager
                  cohorts={cohorts}
                  campaigns={campaigns}
                  onAdd={(data) => {
                    addCohort.mutate({
                      ...data,
                      client_id: selectedClient === "all" ? clients[0]?.id || "" : selectedClient,
                    });
                  }}
                  onDelete={(id) => deleteCohort.mutate(id)}
                  onEdit={(id, data) => updateCohort.mutate({ id, data })}
                />
                <ForecastAssumptions
                  rampProfile={activeRampProfile}
                  survivalProfile={activeSurvivalProfile}
                  avgAttendance={avgAttendance}
                  baselineSph={baselineSph}
                />
              </div>

              {/* Right column: Breakdown + Chart */}
              <div className="lg:col-span-2 space-y-4">
                <ForecastBreakdownTable
                  employees={forecast.establishedEmployees}
                  cohorts={forecast.cohorts}
                  isCurrentPeriod={period === "current"}
                  overrides={selectedClient !== "all" ? overrides : undefined}
                  onOverride={selectedClient !== "all" ? handleOverride : undefined}
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
