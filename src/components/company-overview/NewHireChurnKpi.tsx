import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { UserMinus, TrendingUp, TrendingDown, Minus, Info, AlertTriangle } from "lucide-react";
import { subMonths, differenceInDays, format } from "date-fns";
import { da } from "date-fns/locale";

interface ChurnData {
  overallChurn: number;
  totalHires: number;
  totalExits: number;
  hasMinimumData: boolean;
  byTeam: {
    teamId: string;
    teamName: string;
    hires: number;
    exits: number;
    churnRate: number;
    hasMinimumData: boolean;
  }[];
  byManager: {
    managerId: string;
    managerName: string;
    hires: number;
    exits: number;
    churnRate: number;
    hasMinimumData: boolean;
  }[];
  previousPeriodChurn: number;
  trend: number;
}

const MIN_SAMPLE_SIZE = 5;

const getChurnStatus = (rate: number): { label: string; color: string; bgColor: string } => {
  if (rate <= 5) return { label: "Exceptionelt", color: "text-green-700", bgColor: "bg-green-100" };
  if (rate <= 10) return { label: "Sundt", color: "text-emerald-700", bgColor: "bg-emerald-100" };
  if (rate <= 20) return { label: "Advarsel", color: "text-amber-700", bgColor: "bg-amber-100" };
  return { label: "Rødt flag", color: "text-red-700", bgColor: "bg-red-100" };
};

export function NewHireChurnKpi() {
  const { data, isLoading, error } = useQuery<ChurnData>({
    queryKey: ["new-hire-churn-60-days"],
    queryFn: async () => {
      const now = new Date();
      const twelveMonthsAgo = subMonths(now, 12);
      const sixMonthsAgo = subMonths(now, 6);

      // Fetch all employees with relevant data
      const { data: employees, error } = await supabase
        .from("employee_master_data")
        .select(`
          id,
          first_name,
          last_name,
          employment_start_date,
          employment_end_date,
          is_active,
          team_id,
          manager_id,
          is_staff_employee,
          teams:team_id(id, name)
        `)
        .gte("employment_start_date", format(twelveMonthsAgo, "yyyy-MM-dd"));

      if (error) throw error;

      // Fetch managers for name lookup
      const managerIds = [...new Set(employees?.filter(e => e.manager_id).map(e => e.manager_id))];
      const { data: managers } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name")
        .in("id", managerIds.length > 0 ? managerIds : ["00000000-0000-0000-0000-000000000000"]);

      const managerMap = new Map(managers?.map(m => [m.id, `${m.first_name} ${m.last_name}`]) || []);

      // Filter: exclude Stab employees
      const relevantEmployees = employees?.filter(e => {
        const teamName = (e.teams as any)?.name?.toLowerCase() || "";
        return teamName !== "stab" && !e.is_staff_employee;
      }) || [];

      // Calculate churn for current period (rolling 12 months)
      const currentPeriodHires = relevantEmployees;
      const currentPeriodExits = currentPeriodHires.filter(e => {
        if (!e.employment_end_date || !e.employment_start_date) return false;
        const startDate = new Date(e.employment_start_date);
        const endDate = new Date(e.employment_end_date);
        const daysEmployed = differenceInDays(endDate, startDate);
        return daysEmployed <= 60;
      });

      // Calculate by team
      const teamStats = new Map<string, { name: string; hires: number; exits: number }>();
      currentPeriodHires.forEach(e => {
        const teamId = e.team_id || "unknown";
        const teamName = (e.teams as any)?.name || "Ukendt team";
        if (!teamStats.has(teamId)) {
          teamStats.set(teamId, { name: teamName, hires: 0, exits: 0 });
        }
        teamStats.get(teamId)!.hires++;
      });
      currentPeriodExits.forEach(e => {
        const teamId = e.team_id || "unknown";
        if (teamStats.has(teamId)) {
          teamStats.get(teamId)!.exits++;
        }
      });

      // Calculate by manager
      const managerStats = new Map<string, { name: string; hires: number; exits: number }>();
      currentPeriodHires.filter(e => e.manager_id).forEach(e => {
        const managerId = e.manager_id!;
        const managerName = managerMap.get(managerId) || "Ukendt leder";
        if (!managerStats.has(managerId)) {
          managerStats.set(managerId, { name: managerName, hires: 0, exits: 0 });
        }
        managerStats.get(managerId)!.hires++;
      });
      currentPeriodExits.filter(e => e.manager_id).forEach(e => {
        const managerId = e.manager_id!;
        if (managerStats.has(managerId)) {
          managerStats.get(managerId)!.exits++;
        }
      });

      // Calculate previous period for trend (6-12 months ago)
      const previousPeriodHires = relevantEmployees.filter(e => {
        const startDate = new Date(e.employment_start_date!);
        return startDate >= twelveMonthsAgo && startDate < sixMonthsAgo;
      });
      const previousPeriodExits = previousPeriodHires.filter(e => {
        if (!e.employment_end_date || !e.employment_start_date) return false;
        const startDate = new Date(e.employment_start_date);
        const endDate = new Date(e.employment_end_date);
        const daysEmployed = differenceInDays(endDate, startDate);
        return daysEmployed <= 60;
      });

      const overallChurn = currentPeriodHires.length > 0 
        ? (currentPeriodExits.length / currentPeriodHires.length) * 100 
        : 0;
      
      const previousPeriodChurn = previousPeriodHires.length > 0 
        ? (previousPeriodExits.length / previousPeriodHires.length) * 100 
        : 0;

      return {
        overallChurn: Math.round(overallChurn * 10) / 10,
        totalHires: currentPeriodHires.length,
        totalExits: currentPeriodExits.length,
        hasMinimumData: currentPeriodHires.length >= MIN_SAMPLE_SIZE,
        byTeam: Array.from(teamStats.entries())
          .map(([teamId, stats]) => ({
            teamId,
            teamName: stats.name,
            hires: stats.hires,
            exits: stats.exits,
            churnRate: stats.hires > 0 ? Math.round((stats.exits / stats.hires) * 1000) / 10 : 0,
            hasMinimumData: stats.hires >= MIN_SAMPLE_SIZE
          }))
          .filter(t => t.hires > 0)
          .sort((a, b) => b.churnRate - a.churnRate),
        byManager: Array.from(managerStats.entries())
          .map(([managerId, stats]) => ({
            managerId,
            managerName: stats.name,
            hires: stats.hires,
            exits: stats.exits,
            churnRate: stats.hires > 0 ? Math.round((stats.exits / stats.hires) * 1000) / 10 : 0,
            hasMinimumData: stats.hires >= MIN_SAMPLE_SIZE
          }))
          .filter(m => m.hires > 0)
          .sort((a, b) => b.churnRate - a.churnRate),
        previousPeriodChurn: Math.round(previousPeriodChurn * 10) / 10,
        trend: Math.round((overallChurn - previousPeriodChurn) * 10) / 10
      };
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">60-dages New-hire Churn</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-16 bg-muted rounded"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">60-dages New-hire Churn</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Kunne ikke hente data</p>
        </CardContent>
      </Card>
    );
  }

  const status = getChurnStatus(data.overallChurn);
  const TrendIcon = data.trend > 0 ? TrendingUp : data.trend < 0 ? TrendingDown : Minus;
  // For churn, lower is better, so positive trend (increase) is bad
  const trendColor = data.trend > 0 ? "text-red-600" : data.trend < 0 ? "text-green-600" : "text-muted-foreground";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">60-dages New-hire Churn</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm p-4" side="right">
                    <div className="space-y-2 text-sm">
                      <p className="font-medium">Definition</p>
                      <p>Andelen af nyansatte der forlader virksomheden inden for de første 60 dage fra deres startdato.</p>
                      <p className="font-medium mt-2">Formål</p>
                      <p>Early warning-indikator for onboarding, forventningsafstemning og manager-fit.</p>
                      <p className="font-medium mt-2">Benchmarks</p>
                      <ul className="space-y-1">
                        <li className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span>
                          0-5%: Exceptionelt
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          5-10%: Sundt
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                          10-20%: Advarsel
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-500"></span>
                          &gt;20%: Rødt flag
                        </li>
                      </ul>
                      <p className="text-xs text-muted-foreground mt-2">
                        Min. {MIN_SAMPLE_SIZE} ansættelser for pålidelig data
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <CardDescription>
              Rolling 12 måneder • Ekskl. Stab og interne skift
            </CardDescription>
          </div>
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <UserMinus className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main KPI Value */}
        <div className="flex items-end gap-4">
          <div>
            <div className="text-4xl font-bold text-foreground">
              {data.overallChurn}%
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={`${status.bgColor} ${status.color} border-0`}>
                {status.label}
              </Badge>
              {!data.hasMinimumData && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge variant="outline" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Lille datamængde
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Mindre end {MIN_SAMPLE_SIZE} ansættelser i perioden</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
          <div className="flex-1">
            <div className={`flex items-center gap-1 text-sm ${trendColor}`}>
              <TrendIcon className="h-4 w-4" />
              <span>
                {data.trend > 0 ? "+" : ""}{data.trend} pp ift. forrige 6 mdr
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {data.totalExits} af {data.totalHires} nyansatte
            </div>
          </div>
        </div>

        {/* Team Breakdown */}
        {data.byTeam.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Pr. team</h4>
            <div className="space-y-2">
              {data.byTeam.slice(0, 5).map((team) => {
                const teamStatus = getChurnStatus(team.churnRate);
                return (
                  <div key={team.teamId} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-[140px]">{team.teamName}</span>
                      {!team.hasMinimumData && (
                        <span className="text-xs text-muted-foreground">(n={team.hires})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            team.churnRate <= 5 ? "bg-green-500" :
                            team.churnRate <= 10 ? "bg-emerald-500" :
                            team.churnRate <= 20 ? "bg-amber-500" : "bg-red-500"
                          }`}
                          style={{ width: `${Math.min(team.churnRate * 2, 100)}%` }}
                        />
                      </div>
                      <span className={`font-medium w-12 text-right ${teamStatus.color}`}>
                        {team.churnRate}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Manager Breakdown */}
        {data.byManager.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Pr. leder</h4>
            <div className="space-y-2">
              {data.byManager.slice(0, 5).map((manager) => {
                const managerStatus = getChurnStatus(manager.churnRate);
                return (
                  <div key={manager.managerId} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-[140px]">{manager.managerName}</span>
                      {!manager.hasMinimumData && (
                        <span className="text-xs text-muted-foreground">(n={manager.hires})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            manager.churnRate <= 5 ? "bg-green-500" :
                            manager.churnRate <= 10 ? "bg-emerald-500" :
                            manager.churnRate <= 20 ? "bg-amber-500" : "bg-red-500"
                          }`}
                          style={{ width: `${Math.min(manager.churnRate * 2, 100)}%` }}
                        />
                      </div>
                      <span className={`font-medium w-12 text-right ${managerStatus.color}`}>
                        {manager.churnRate}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Legend / Note */}
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Denne KPI bruges til læring og forbedring af onboarding – ikke til bonus eller sanktioner.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
