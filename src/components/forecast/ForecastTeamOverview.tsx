import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import type { ForecastResult } from "@/types/forecast";

interface ForecastTeamOverviewProps {
  forecast: ForecastResult;
  isCurrentPeriod: boolean;
  onTeamClick?: (teamName: string | null) => void;
  selectedTeam?: string | null;
}

interface TeamSummary {
  teamName: string;
  expectedSales: number;
  actualSales: number;
  sellerCount: number;
  avgSph: number;
  totalLoss: number; // churn + absence
  status: "ahead" | "on_track" | "behind" | "unknown";
}

export function ForecastTeamOverview({ forecast, isCurrentPeriod, onTeamClick, selectedTeam }: ForecastTeamOverviewProps) {
  const teams = useMemo(() => {
    const mapped = forecast.establishedEmployees.filter(e => !e.missingAgentMapping);
    const grouped = new Map<string, typeof mapped>();

    for (const emp of mapped) {
      const key = emp.teamName || "Uden team";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(emp);
    }

    const result: TeamSummary[] = [];

    for (const [teamName, employees] of grouped) {
      const expectedSales = employees.reduce((s, e) => s + e.forecastSales, 0);
      const actualSales = employees.reduce((s, e) => s + (e.actualSales || 0), 0);
      const sellerCount = employees.length;
      const avgSph = sellerCount > 0
        ? employees.reduce((s, e) => s + e.expectedSph, 0) / sellerCount
        : 0;
      const totalLoss = employees.reduce((s, e) => s + e.churnLoss, 0);

      let status: TeamSummary["status"] = "unknown";
      if (isCurrentPeriod && forecast.daysElapsed && forecast.daysRemaining !== undefined) {
        const totalDays = forecast.daysElapsed + forecast.daysRemaining;
        if (totalDays > 0 && forecast.daysElapsed > 0) {
          const expectedPace = expectedSales * (forecast.daysElapsed / totalDays);
          const ratio = actualSales / (expectedPace || 1);
          if (ratio >= 1.05) status = "ahead";
          else if (ratio >= 0.90) status = "on_track";
          else status = "behind";
        }
      }

      result.push({ teamName, expectedSales, actualSales, sellerCount, avgSph, totalLoss, status });
    }

    return result.sort((a, b) => b.expectedSales - a.expectedSales);
  }, [forecast, isCurrentPeriod]);

  if (teams.length <= 1) return null;

  const statusConfig = {
    ahead: { label: "Foran", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400", icon: TrendingUp },
    on_track: { label: "On track", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", icon: Minus },
    behind: { label: "Bagud", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: TrendingDown },
    unknown: { label: "", className: "hidden", icon: Minus },
  };

  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground mb-3">Team-overblik</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {teams.map((team) => {
          const cfg = statusConfig[team.status];
          const StatusIcon = cfg.icon;
          const isSelected = selectedTeam === team.teamName;

          return (
            <Card
              key={team.teamName}
              className={`cursor-pointer transition-all hover:shadow-md ${
                isSelected ? "ring-2 ring-primary shadow-md" : ""
              }`}
              onClick={() => onTeamClick?.(isSelected ? null : team.teamName)}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-medium text-muted-foreground truncate">{team.teamName}</span>
                  {isCurrentPeriod && team.status !== "unknown" && (
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cfg.className} border-0`}>
                      <StatusIcon className="h-3 w-3 mr-0.5" />
                      {cfg.label}
                    </Badge>
                  )}
                </div>

                <div className="text-2xl font-bold tracking-tight">
                  {Math.round(team.expectedSales)}
                  <span className="text-xs font-normal text-muted-foreground ml-1">salg</span>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {team.sellerCount}
                  </span>
                  <span>SPH {team.avgSph.toFixed(2)}</span>
                </div>

                {team.totalLoss > 0 && (
                  <div className="flex items-center gap-1 text-[10px] text-orange-600 dark:text-orange-400">
                    <AlertTriangle className="h-3 w-3" />
                    <span>-{Math.round(team.totalLoss)} tab</span>
                  </div>
                )}

                {isCurrentPeriod && team.actualSales > 0 && (
                  <div className="text-[10px] text-muted-foreground">
                    Faktisk: {Math.round(team.actualSales)} salg
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
