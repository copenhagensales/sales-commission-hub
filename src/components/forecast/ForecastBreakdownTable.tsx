import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, ArrowUpDown, AlertTriangle, Info } from "lucide-react";
import type { EmployeeForecastResult, CohortForecastResult } from "@/types/forecast";
import { ForecastIntervalBadge } from "./ForecastIntervalBadge";

interface Props {
  employees: EmployeeForecastResult[];
  cohorts: CohortForecastResult[];
  isCurrentPeriod?: boolean;
}

export function ForecastBreakdownTable({ employees, cohorts, isCurrentPeriod = false }: Props) {
  const [sortKey, setSortKey] = useState<'name' | 'sph' | 'forecast' | 'total'>('total');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Split mapped vs unmapped employees
  const mappedEmployees = employees.filter(e => !e.missingAgentMapping);
  const unmappedEmployees = employees.filter(e => e.missingAgentMapping);

  // Further split mapped into active (has data) vs no-data
  const activeEmployees = mappedEmployees.filter(e => e.expectedSph > 0 || (e.actualSales || 0) > 0);
  const noDataEmployees = mappedEmployees.filter(e => e.expectedSph === 0 && (e.actualSales || 0) === 0);

  const hasActuals = isCurrentPeriod && activeEmployees.some(e => (e.actualSales || 0) > 0);

  // Avg SPH for risk badges — only from active employees
  const avgSph = activeEmployees.length > 0
    ? activeEmployees.reduce((s, e) => s + e.expectedSph, 0) / activeEmployees.length
    : 0;

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sortedEmployees = [...activeEmployees].sort((a, b) => {
    const dir = sortDir === 'desc' ? -1 : 1;
    switch (sortKey) {
      case 'name': return dir * a.employeeName.localeCompare(b.employeeName) * -1;
      case 'sph': return dir * (a.expectedSph - b.expectedSph);
      case 'forecast': return dir * (a.forecastSales - b.forecastSales);
      case 'total':
      default: {
        const totalA = (a.actualSales || 0) + a.forecastSales;
        const totalB = (b.actualSales || 0) + b.forecastSales;
        return dir * (totalA - totalB);
      }
    }
  });

  return (
    <div className="space-y-4">
      {/* Established employees */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Etablerede sælgere ({activeEmployees.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                    <th className="pb-2 font-medium text-muted-foreground cursor-pointer select-none" onClick={() => toggleSort('name')}>
                      <span className="flex items-center gap-1">Sælger <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Timer</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right cursor-pointer select-none" onClick={() => toggleSort('sph')}>
                      <span className="flex items-center justify-end gap-1">Salg/time <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Fremmøde</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Status</th>
                    {hasActuals ? (
                      <>
                        <th className="pb-2 font-medium text-muted-foreground text-right">Faktisk</th>
                        <th className="pb-2 font-medium text-muted-foreground text-right">Rest</th>
                        <th className="pb-2 font-medium text-muted-foreground text-right cursor-pointer select-none" onClick={() => toggleSort('total')}>
                          <span className="flex items-center justify-end gap-1">Total <ArrowUpDown className="h-3 w-3" /></span>
                        </th>
                      </>
                    ) : (
                      <th className="pb-2 font-medium text-muted-foreground text-right cursor-pointer select-none" onClick={() => toggleSort('forecast')}>
                        <span className="flex items-center justify-end gap-1">Forecast <ArrowUpDown className="h-3 w-3" /></span>
                      </th>
                    )}
                  </tr>
              </thead>
              <tbody>
                {sortedEmployees.map((emp) => {
                  const actual = emp.actualSales || 0;
                  const total = actual + emp.forecastSales;

                  // Risk badge logic
                  let riskBadge: { label: string; className: string } | null = null;
                  if (emp.churnProbability > 0.3) {
                    riskBadge = { label: "Churn-risiko", className: "bg-destructive/10 text-destructive border-destructive/20" };
                  } else if (emp.expectedSph > 0 && emp.expectedSph < avgSph * 0.5) {
                    riskBadge = { label: "Lav SPH", className: "bg-amber-100 text-amber-700 border-amber-200" };
                  } else if (emp.expectedSph >= avgSph * 1.2) {
                    riskBadge = { label: "Top", className: "bg-emerald-100 text-emerald-700 border-emerald-200" };
                  }

                  return (
                    <tr key={emp.employeeId} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2.5">
                        <div>
                          <p className="font-medium">{emp.employeeName}</p>
                          {emp.teamName && (
                            <p className="text-xs text-muted-foreground">{emp.teamName}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{emp.plannedHours}</td>
                      <td className="py-2.5 text-right tabular-nums">{emp.expectedSph.toFixed(2)}</td>
                      <td className="py-2.5 text-right tabular-nums">{Math.round(emp.attendanceFactor * 100)}%</td>
                      <td className="py-2.5 text-right">
                        {riskBadge ? (
                          <Badge variant="outline" className={`text-xs ${riskBadge.className}`}>{riskBadge.label}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      {hasActuals ? (
                        <>
                          <td className="py-2.5 text-right tabular-nums font-medium">{actual}</td>
                          <td className="py-2.5 text-right tabular-nums text-muted-foreground">{emp.forecastSales}</td>
                          <td className="py-2.5 text-right">
                            <span className="font-semibold tabular-nums">{total}</span>
                          </td>
                        </>
                      ) : (
                        <td className="py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="font-semibold tabular-nums">{emp.forecastSales}</span>
                            <span className="text-xs text-muted-foreground">
                              ({emp.forecastSalesLow}-{emp.forecastSalesHigh})
                            </span>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t font-semibold">
                  <td className="pt-2">Total</td>
                  <td className="pt-2 text-right tabular-nums">{activeEmployees.reduce((s, e) => s + e.plannedHours, 0)}</td>
                  <td className="pt-2 text-right">—</td>
                  <td className="pt-2 text-right">—</td>
                  <td className="pt-2 text-right">—</td>
                  {hasActuals ? (
                    <>
                      <td className="pt-2 text-right tabular-nums">{activeEmployees.reduce((s, e) => s + (e.actualSales || 0), 0)}</td>
                      <td className="pt-2 text-right tabular-nums">{activeEmployees.reduce((s, e) => s + e.forecastSales, 0)}</td>
                      <td className="pt-2 text-right tabular-nums">{activeEmployees.reduce((s, e) => s + (e.actualSales || 0) + e.forecastSales, 0)}</td>
                    </>
                  ) : (
                    <td className="pt-2 text-right tabular-nums">{activeEmployees.reduce((s, e) => s + e.forecastSales, 0)}</td>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* No-data employees — mapped but zero sales */}
      {noDataEmployees.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-600" />
              <span>Ingen salgsdata ({noDataEmployees.length})</span>
              <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-200 ml-auto">
                Korrekt opsat — ingen salg registreret
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-blue-700 mb-3">
              Disse medarbejdere er korrekt opsat, men har ingen registrerede salg for den valgte kampagne i de seneste 8 uger. De indgår derfor ikke i forecastet.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-blue-200 text-left">
                    <th className="pb-2 font-medium text-blue-700">Medarbejder</th>
                    <th className="pb-2 font-medium text-blue-700 text-right">Team</th>
                    <th className="pb-2 font-medium text-blue-700 text-right">Planlagte timer</th>
                  </tr>
                </thead>
                <tbody>
                  {noDataEmployees.map((emp) => (
                    <tr key={emp.employeeId} className="border-b border-blue-100 last:border-0">
                      <td className="py-2 font-medium">{emp.employeeName}</td>
                      <td className="py-2 text-right text-muted-foreground">{emp.teamName || '—'}</td>
                      <td className="py-2 text-right tabular-nums">{emp.plannedHours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unmapped employees — missing agent mapping */}
      {unmappedEmployees.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span>Mangler opsætning ({unmappedEmployees.length})</span>
              <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-200 ml-auto">
                Salgsdata kan ikke tilknyttes
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-amber-700 mb-3">
              Disse medarbejdere mangler en agent-kobling, og deres salg kan derfor ikke registreres i forecastet. Kontakt en administrator for at oprette koblingen.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-amber-200 text-left">
                    <th className="pb-2 font-medium text-amber-700">Medarbejder</th>
                    <th className="pb-2 font-medium text-amber-700 text-right">Team</th>
                    <th className="pb-2 font-medium text-amber-700 text-right">Planlagte timer</th>
                  </tr>
                </thead>
                <tbody>
                  {unmappedEmployees.map((emp) => (
                    <tr key={emp.employeeId} className="border-b border-amber-100 last:border-0">
                      <td className="py-2 font-medium">{emp.employeeName}</td>
                      <td className="py-2 text-right text-muted-foreground">{emp.teamName || '—'}</td>
                      <td className="py-2 text-right tabular-nums">{emp.plannedHours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cohorts */}
      {cohorts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-muted-foreground" />
              Nye opstartshold ({cohorts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium text-muted-foreground">Hold</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Planlagt</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Effektive</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Ramp</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Survival</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Forecast</th>
                  </tr>
                </thead>
                <tbody>
                  {cohorts.map((cohort) => (
                    <tr key={cohort.cohortId} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2.5">
                        <div>
                          <p className="font-medium">Start {new Date(cohort.startDate).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}</p>
                          {cohort.note && <p className="text-xs text-muted-foreground">{cohort.note}</p>}
                        </div>
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{cohort.plannedHeadcount}</td>
                      <td className="py-2.5 text-right tabular-nums">{cohort.effectiveHeads}</td>
                      <td className="py-2.5 text-right">
                        <Badge variant="outline" className="text-xs">{Math.round(cohort.rampFactor * 100)}%</Badge>
                      </td>
                      <td className="py-2.5 text-right">
                        <Badge variant="outline" className="text-xs">{Math.round(cohort.survivalFactor * 100)}%</Badge>
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="font-semibold tabular-nums">{cohort.forecastSales}</span>
                          <span className="text-xs text-muted-foreground">
                            ({cohort.forecastSalesLow}-{cohort.forecastSalesHigh})
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t font-semibold">
                    <td className="pt-2">Total</td>
                    <td className="pt-2 text-right tabular-nums">{cohorts.reduce((s, c) => s + c.plannedHeadcount, 0)}</td>
                    <td className="pt-2 text-right tabular-nums">{cohorts.reduce((s, c) => s + c.effectiveHeads, 0).toFixed(1)}</td>
                    <td className="pt-2 text-right">—</td>
                    <td className="pt-2 text-right">—</td>
                    <td className="pt-2 text-right tabular-nums">{cohorts.reduce((s, c) => s + c.forecastSales, 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
