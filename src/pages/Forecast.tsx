import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, RefreshCcw } from "lucide-react";
import { ForecastKpiCards } from "@/components/forecast/ForecastKpiCards";
import { ForecastDriversPanel } from "@/components/forecast/ForecastDriversPanel";
import { ForecastBreakdownTable } from "@/components/forecast/ForecastBreakdownTable";
import { ForecastVsActualChart } from "@/components/forecast/ForecastVsActualChart";
import { ForecastCohortManager } from "@/components/forecast/ForecastCohortManager";
import { ForecastAssumptions } from "@/components/forecast/ForecastAssumptions";
import {
  generateMockForecast,
  generateMockForecastVsActual,
  generateMockCohorts,
  MOCK_RAMP_PROFILE,
  MOCK_SURVIVAL_PROFILE,
} from "@/lib/calculations/forecast";
import type { ClientForecastCohort } from "@/types/forecast";

export default function Forecast() {
  const [selectedClient, setSelectedClient] = useState("all");
  const forecast = useMemo(() => generateMockForecast(), []);
  const vsActual = useMemo(() => generateMockForecastVsActual(), []);
  const mockCohortInputs = useMemo(() => generateMockCohorts(), []);
  
  const [cohorts, setCohorts] = useState<ClientForecastCohort[]>(
    mockCohortInputs.map(c => c.cohort)
  );

  const periodLabel = useMemo(() => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return next.toLocaleDateString('da-DK', { month: 'long', year: 'numeric' });
  }, []);

  const avgAttendance = forecast.establishedEmployees.length > 0
    ? forecast.establishedEmployees.reduce((s, e) => s + e.attendanceFactor, 0) / forecast.establishedEmployees.length
    : 0.92;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
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
          <div className="flex items-center gap-3">
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Vælg kunde" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle kunder</SelectItem>
                <SelectItem value="tryg">Tryg</SelectItem>
                <SelectItem value="tdc">TDC</SelectItem>
                <SelectItem value="codan">Codan</SelectItem>
                <SelectItem value="finansforbundet">Finansforbundet</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon">
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Demo badge */}
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
          Demo-data — forecast-beregninger med mock-sælgere og opstartshold
        </Badge>

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
                setCohorts(prev => [...prev, {
                  ...data,
                  id: `cohort-${Date.now()}`,
                  created_at: new Date().toISOString(),
                  created_by: null,
                }]);
              }}
            />
            <ForecastAssumptions
              rampProfile={MOCK_RAMP_PROFILE}
              survivalProfile={MOCK_SURVIVAL_PROFILE}
              avgAttendance={avgAttendance}
              baselineSph={0.45}
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
      </div>
    </div>
  );
}
