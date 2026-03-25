import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sparkles, Pencil, Check, X, Target } from "lucide-react";
import type { ForecastResult } from "@/types/forecast";

interface Props {
  forecast: ForecastResult;
  periodLabel: string;
  isCurrentPeriod: boolean;
  clientTarget?: number | null;
  onTargetChange?: (target: number) => void;
  showTarget?: boolean;
  overrideTotal?: number;
}

export function ForecastSummary({ forecast, periodLabel, isCurrentPeriod, clientTarget, onTargetChange, showTarget, overrideTotal }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const totalSales = overrideTotal ?? forecast.totalSalesExpected;
  const numEmployees = forecast.establishedEmployees.length;
  const numCohorts = forecast.cohorts.length;
  const absenceLoss = forecast.absenceLoss;
  const churnLoss = forecast.churnLoss + (forecast.establishedChurnLoss || 0);
  const hasActual = isCurrentPeriod && forecast.actualSalesToDate !== undefined && forecast.actualSalesToDate > 0;

  // Find holidays driver
  const holidayDriver = forecast.drivers.find(d => d.key === "holidays");
  const holidayCount = holidayDriver ? parseInt(holidayDriver.value) || 0 : 0;

  // Build narrative parts
  const parts: string[] = [];

  if (hasActual) {
    parts.push(
      `Der er allerede lavet ${forecast.actualSalesToDate!.toLocaleString('da-DK')} salg, og vi forventer yderligere ${forecast.remainingForecast!.toLocaleString('da-DK')} i de resterende ${forecast.daysRemaining} arbejdsdage.`
    );
  }

  // Context about team
  const teamParts: string[] = [];
  if (numEmployees > 0) teamParts.push(`${numEmployees} etablerede sælgere`);
  if (numCohorts > 0) teamParts.push(`${numCohorts} opstartshold`);
  if (teamParts.length) parts.push(`Baseret på ${teamParts.join(' og ')}.`);

  // Impact factors
  const impacts: string[] = [];
  if (absenceLoss > 0) impacts.push(`fravær reducerer med ${absenceLoss} salg`);
  if (churnLoss > 0) impacts.push(`churn-risiko trækker ${churnLoss} salg`);
  if (holidayCount > 0) impacts.push(`${holidayCount} helligdage i perioden`);
  if (impacts.length) parts.push(`Bemærk: ${impacts.join(', ')}.`);

  // High churn employees
  const highChurn = forecast.establishedEmployees.filter(e => e.churnProbability > 0.3);
  if (highChurn.length > 0) {
    parts.push(`${highChurn.length} medarbejder${highChurn.length > 1 ? 'e' : ''} har forhøjet churn-risiko.`);
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
      <CardContent className="p-5">
        <div className="flex gap-4">
          <div className="p-2.5 rounded-xl bg-primary/10 h-fit">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-3xl font-bold tracking-tight">{totalSales.toLocaleString('da-DK')}</span>
              <span className="text-sm text-muted-foreground font-medium">forventede salg i {periodLabel}</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {parts.join(' ')}
            </p>
            {showTarget && (
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                <Target className="h-4 w-4 text-muted-foreground" />
                {isEditing ? (
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="h-7 w-24 text-sm"
                      placeholder="Target"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editValue) {
                          onTargetChange?.(parseInt(editValue));
                          setIsEditing(false);
                        }
                        if (e.key === 'Escape') setIsEditing(false);
                      }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => {
                        if (editValue) onTargetChange?.(parseInt(editValue));
                        setIsEditing(false);
                      }}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => setIsEditing(false)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {clientTarget ? (
                      <>
                        <span className="text-sm font-medium">
                          Kundetarget: {clientTarget.toLocaleString('da-DK')} salg
                        </span>
                        {(() => {
                          const diff = totalSales - clientTarget;
                          const pct = Math.round((diff / clientTarget) * 100);
                          return (
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${diff >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
                              {diff >= 0 ? '+' : ''}{diff.toLocaleString('da-DK')} ({pct >= 0 ? '+' : ''}{pct}%)
                            </span>
                          );
                        })()}
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">Intet kundetarget sat</span>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => {
                        setEditValue(clientTarget?.toString() || "");
                        setIsEditing(true);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
