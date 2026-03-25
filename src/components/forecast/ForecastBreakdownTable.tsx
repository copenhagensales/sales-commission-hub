import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, UserPlus, ArrowUpDown, GraduationCap, CalendarOff, PhoneCall, Pencil, X, Check } from "lucide-react";
import type { EmployeeForecastResult, CohortForecastResult } from "@/types/forecast";
import { ForecastIntervalBadge } from "./ForecastIntervalBadge";
import { SetPlannedDepartureDialog } from "./SetPlannedDepartureDialog";
import type { ForecastOverride } from "@/hooks/useEmployeeForecastOverrides";

interface Props {
  employees: EmployeeForecastResult[];
  cohorts: CohortForecastResult[];
  isCurrentPeriod?: boolean;
  overrides?: Map<string, ForecastOverride>;
  onOverride?: (employeeId: string, value: number | null) => void;
}

export function ForecastBreakdownTable({ employees, cohorts, isCurrentPeriod = false, overrides, onOverride }: Props) {
  const [sortKey, setSortKey] = useState<'name' | 'sph' | 'forecast' | 'total'>('total');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [departureDialog, setDepartureDialog] = useState<{ id: string; name: string; endDate?: string | null } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const startEdit = (empId: string, currentValue: number) => {
    setEditingId(empId);
    setEditValue(String(currentValue));
  };

  const confirmEdit = () => {
    if (!editingId || !onOverride) return;
    const val = parseInt(editValue, 10);
    if (!isNaN(val) && val >= 0) {
      onOverride(editingId, val);
    }
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  const removeOverride = (empId: string) => {
    if (onOverride) onOverride(empId, null);
  };

  // Split into: new (ramp-up), active (established with data)
  const mappedEmployees = employees.filter(e => !e.missingAgentMapping);
  const newEmployees = mappedEmployees.filter(e => e.isNew);
  const establishedMapped = mappedEmployees.filter(e => !e.isNew);
  const activeEmployees = establishedMapped.filter(e => e.expectedSph > 0 || (e.actualSales || 0) > 0 || e.plannedHours > 0);

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
                  const override = overrides?.get(emp.employeeId);
                  const displayForecast = override ? override.override_sales : emp.forecastSales;
                  const total = actual + displayForecast;
                  const isEditing = editingId === emp.employeeId;

                  // Risk badge logic
                  let riskBadge: { label: string; className: string } | null = null;
                  if (emp.churnProbability > 0.3) {
                    riskBadge = { label: "Churn-risiko", className: "bg-destructive/10 text-destructive border-destructive/20" };
                  } else if (emp.expectedSph > 0 && emp.expectedSph < avgSph * 0.5) {
                    riskBadge = { label: "Lav SPH", className: "bg-amber-100 text-amber-700 border-amber-200" };
                  } else if (emp.expectedSph >= avgSph * 1.2) {
                    riskBadge = { label: "Top", className: "bg-emerald-100 text-emerald-700 border-emerald-200" };
                  }

                  const renderForecastCell = () => {
                    if (isEditing) {
                      return (
                        <div className="flex items-center justify-end gap-1">
                          <Input
                            ref={editInputRef}
                            type="number"
                            min={0}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") confirmEdit();
                              if (e.key === "Escape") cancelEdit();
                            }}
                            className="h-7 w-20 text-right text-sm tabular-nums"
                          />
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={confirmEdit}>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEdit}>
                            <X className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      );
                    }

                    return (
                      <div className="flex items-center justify-end gap-1 group">
                        {override ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="font-semibold tabular-nums px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                  {displayForecast}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">Beregnet: {emp.forecastSales} | Manuel: {override.override_sales}</p>
                                {override.note && <p className="text-xs text-muted-foreground">{override.note}</p>}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <>
                            <span className="font-semibold tabular-nums">{displayForecast}</span>
                            {!hasActuals && (
                              <span className="text-xs text-muted-foreground">
                                ({emp.forecastSalesLow}-{emp.forecastSalesHigh})
                              </span>
                            )}
                          </>
                        )}
                        {onOverride && (
                          <button
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                            onClick={() => startEdit(emp.employeeId, displayForecast)}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                        {override && onOverride && (
                          <button
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                            onClick={() => removeOverride(emp.employeeId)}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    );
                  };

                  return (
                    <tr key={emp.employeeId} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2.5">
                        <div className="flex items-center gap-1.5">
                          <div>
                            <p className="font-medium">{emp.employeeName}</p>
                            {emp.teamName && (
                              <p className="text-xs text-muted-foreground">{emp.teamName}</p>
                            )}
                          </div>
                          {emp.isOnCall && (
                            <Badge variant="outline" className="text-[10px] bg-blue-100 text-blue-700 border-blue-200">
                              <PhoneCall className="h-2.5 w-2.5 mr-0.5" /> Tilkalde
                            </Badge>
                          )}
                          {emp.plannedEndDate && (
                            <Badge variant="outline" className="text-[10px] bg-orange-100 text-orange-700 border-orange-200 cursor-pointer" onClick={() => setDepartureDialog({ id: emp.employeeId, name: emp.employeeName, endDate: emp.plannedEndDate })}>
                              Stopper {format(new Date(emp.plannedEndDate), "d/M")}
                            </Badge>
                          )}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                                  onClick={() => setDepartureDialog({ id: emp.employeeId, name: emp.employeeName, endDate: emp.plannedEndDate })}
                                >
                                  <CalendarOff className="h-3.5 w-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Sæt planlagt afgang</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{emp.plannedHours}</td>
                      <td className="py-2.5 text-right tabular-nums">
                        <span>{emp.expectedSph.toFixed(2)}</span>
                        {emp.momentumFactor && emp.momentumFactor > 1.0 && (
                          <span className="ml-1 text-xs text-emerald-600 font-medium">↑{Math.round((emp.momentumFactor - 1) * 100)}%</span>
                        )}
                      </td>
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
                          <td className="py-2.5 text-right">{renderForecastCell()}</td>
                          <td className="py-2.5 text-right">
                            <span className="font-semibold tabular-nums">{total}</span>
                            {emp.forecastSalesSubs !== undefined && (
                              <p className="text-[10px] text-muted-foreground font-normal">
                                A:{(emp.actualSalesSubs || 0) + (emp.forecastSalesSubs || 0)} · 5G:{(emp.actualSales5G || 0) + (emp.forecastSales5G || 0)}
                              </p>
                            )}
                          </td>
                        </>
                      ) : (
                        <td className="py-2.5 text-right">
                          {renderForecastCell()}
                          {emp.forecastSalesSubs !== undefined && (
                            <p className="text-[10px] text-muted-foreground">
                              Abon: {emp.forecastSalesSubs} · 5G: {emp.forecastSales5G}
                            </p>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                {(() => {
                  const hasProductSplit = activeEmployees.some(e => e.forecastSalesSubs !== undefined);
                  const totalSubs = hasProductSplit ? activeEmployees.reduce((s, e) => s + (e.forecastSalesSubs || 0), 0) : undefined;
                  const total5G = hasProductSplit ? activeEmployees.reduce((s, e) => s + (e.forecastSales5G || 0), 0) : undefined;
                  return (
                    <tr className="border-t font-semibold">
                      <td className="pt-2">Total</td>
                      <td className="pt-2 text-right tabular-nums">{activeEmployees.reduce((s, e) => s + e.plannedHours, 0)}</td>
                      <td className="pt-2 text-right">—</td>
                      <td className="pt-2 text-right">—</td>
                      <td className="pt-2 text-right">—</td>
                      {hasActuals ? (
                        <>
                          <td className="pt-2 text-right tabular-nums">{activeEmployees.reduce((s, e) => s + (e.actualSales || 0), 0)}</td>
                          <td className="pt-2 text-right tabular-nums">{activeEmployees.reduce((s, e) => s + (overrides?.get(e.employeeId)?.override_sales ?? e.forecastSales), 0)}</td>
                          <td className="pt-2 text-right">
                            <span className="tabular-nums">{activeEmployees.reduce((s, e) => s + (e.actualSales || 0) + (overrides?.get(e.employeeId)?.override_sales ?? e.forecastSales), 0)}</span>
                            {hasProductSplit && totalSubs !== undefined && total5G !== undefined && (
                              <p className="text-xs font-normal text-muted-foreground">Abon: {totalSubs} · 5G: {total5G}</p>
                            )}
                          </td>
                        </>
                      ) : (
                        <td className="pt-2 text-right">
                          <span className="tabular-nums">{activeEmployees.reduce((s, e) => s + (overrides?.get(e.employeeId)?.override_sales ?? e.forecastSales), 0)}</span>
                          {hasProductSplit && totalSubs !== undefined && total5G !== undefined && (
                            <p className="text-xs font-normal text-muted-foreground">Abon: {totalSubs} · 5G: {total5G}</p>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })()}
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* New employees — under ramp-up */}
      {newEmployees.length > 0 && (
        <Card className="border-indigo-200 bg-indigo-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-indigo-600" />
              <span>Under oplæring ({newEmployees.length})</span>
              <Badge variant="outline" className="text-xs bg-indigo-100 text-indigo-700 border-indigo-200 ml-auto">
                Ramp-up model
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-indigo-700 mb-3">
              Nye medarbejdere (≤60 dage). Forecast bruger ramp-up kurve blended med faktisk performance når data er tilgængeligt.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-indigo-200 text-left">
                    <th className="pb-2 font-medium text-indigo-700">Sælger</th>
                    <th className="pb-2 font-medium text-indigo-700 text-right">Timer</th>
                    <th className="pb-2 font-medium text-indigo-700 text-right">Ramp</th>
                    <th className="pb-2 font-medium text-indigo-700 text-right">SPH</th>
                    {isCurrentPeriod && <th className="pb-2 font-medium text-indigo-700 text-right">Faktisk</th>}
                    <th className="pb-2 font-medium text-indigo-700 text-right">Forecast</th>
                    {isCurrentPeriod && <th className="pb-2 font-medium text-indigo-700 text-right">Total</th>}
                  </tr>
                </thead>
                <tbody>
                  <TooltipProvider>
                    {newEmployees.map((emp) => {
                      const actual = emp.actualSales || 0;
                      const total = actual + emp.forecastSales;
                      const rampPct = emp.rampFactor ? Math.round(emp.rampFactor * 100) : 0;
                      return (
                        <tr key={emp.employeeId} className="border-b border-indigo-100 last:border-0 hover:bg-indigo-50/50">
                          <td className="py-2.5">
                            <div>
                              <p className="font-medium">{emp.employeeName}</p>
                              {emp.teamName && <p className="text-xs text-muted-foreground">{emp.teamName}</p>}
                            </div>
                          </td>
                          <td className="py-2.5 text-right tabular-nums">{emp.plannedHours}</td>
                          <td className="py-2.5 text-right">
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="outline" className={`text-xs ${emp.hybridBlend ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-indigo-100 text-indigo-700 border-indigo-200'}`}>
                                  {rampPct}%{emp.hybridBlend ? ' ⚡' : ''}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                {emp.hybridBlend ? (
                                  <div className="text-xs space-y-1">
                                    <p>Hybrid: {Math.round((emp.reliabilityWeight || 0) * 100)}% empirisk, {Math.round((1 - (emp.reliabilityWeight || 0)) * 100)}% ramp</p>
                                    <p>Ramp SPH: {(emp.expectedSph / (emp.reliabilityWeight ? 1 : 1)).toFixed(2)}</p>
                                    {emp.empiricalSph != null && <p>Empirisk SPH: {emp.empiricalSph.toFixed(2)}</p>}
                                    <p>Reliability: {Math.round((emp.reliabilityWeight || 0) * 100)}%</p>
                                  </div>
                                ) : (
                                  <p>{rampPct}% af normal kapacitet (ramp-up kurve, ingen empirisk data endnu)</p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </td>
                          <td className="py-2.5 text-right tabular-nums">{emp.expectedSph.toFixed(2)}</td>
                          {isCurrentPeriod && <td className="py-2.5 text-right tabular-nums font-medium">{actual}</td>}
                          <td className="py-2.5 text-right tabular-nums">{emp.forecastSales}</td>
                          {isCurrentPeriod && <td className="py-2.5 text-right font-semibold tabular-nums">{total}</td>}
                        </tr>
                      );
                    })}
                  </TooltipProvider>
                </tbody>
                <tfoot>
                  <tr className="border-t border-indigo-200 font-semibold">
                    <td className="pt-2">Total</td>
                    <td className="pt-2 text-right tabular-nums">{newEmployees.reduce((s, e) => s + e.plannedHours, 0)}</td>
                    <td className="pt-2 text-right">—</td>
                    <td className="pt-2 text-right">—</td>
                    {isCurrentPeriod && <td className="pt-2 text-right tabular-nums">{newEmployees.reduce((s, e) => s + (e.actualSales || 0), 0)}</td>}
                    <td className="pt-2 text-right tabular-nums">{newEmployees.reduce((s, e) => s + e.forecastSales, 0)}</td>
                    {isCurrentPeriod && <td className="pt-2 text-right tabular-nums">{newEmployees.reduce((s, e) => s + (e.actualSales || 0) + e.forecastSales, 0)}</td>}
                  </tr>
                </tfoot>
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
                          {cohort.activeDays != null && (
                            <p className="text-xs text-muted-foreground">
                              {cohort.activeDays} aktive dage · SPH {cohort.baselineSph?.toFixed(2) ?? '—'}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{cohort.plannedHeadcount}</td>
                      <td className="py-2.5 text-right tabular-nums">{cohort.effectiveHeads}</td>
                      <td className="py-2.5 text-right">
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="outline" className="text-xs">{Math.round(cohort.rampFactor * 100)}%</Badge>
                          </TooltipTrigger>
                          <TooltipContent>Vægtet gennemsnit over {cohort.activeDays ?? '?'} dage</TooltipContent>
                        </Tooltip>
                      </td>
                      <td className="py-2.5 text-right">
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="outline" className="text-xs">{Math.round(cohort.survivalFactor * 100)}%</Badge>
                          </TooltipTrigger>
                          <TooltipContent>Vægtet gennemsnit over {cohort.activeDays ?? '?'} dage</TooltipContent>
                        </Tooltip>
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

      {departureDialog && (
        <SetPlannedDepartureDialog
          open={!!departureDialog}
          onOpenChange={(open) => !open && setDepartureDialog(null)}
          employeeId={departureDialog.id}
          employeeName={departureDialog.name}
          currentEndDate={departureDialog.endDate}
        />
      )}
    </div>
  );
}
