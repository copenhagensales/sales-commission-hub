import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { UserMinus, TrendingUp, TrendingDown, Minus, Info, AlertTriangle } from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";

// Normalize team names to handle variations
const normalizeTeamName = (name: string | null): string => {
  if (!name) return "Ukendt";
  const lower = name.toLowerCase().trim();
  if (lower.includes("eesy fm") || lower === "eesy fm") return "Eesy FM";
  if (lower.includes("eesy tm") || lower === "eesy tm") return "Eesy TM";
  if (lower.includes("fieldmarketing")) return "Fieldmarketing";
  if (lower.includes("relatel")) return "Relatel";
  if (lower.includes("tdc erhverv")) return "TDC Erhverv";
  if (lower.includes("united")) return "United";
  if (lower.includes("stab")) return "Stab";
  return name;
};

// Teams to exclude from the overview
const EXCLUDED_TEAMS = ["Stab", "Ukendt"];

interface ChurnData {
  overallChurn: number;
  totalEmployees: number;
  totalExits60Days: number;
  hasMinimumData: boolean;
  byTeam: {
    teamName: string;
    total: number;
    exits60Days: number;
    churnRate: number;
    currentCount: number;
    hasMinimumData: boolean;
  }[];
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
    queryKey: ["new-hire-churn-combined"],
    queryFn: async () => {
      // Fetch current employees with team memberships
      const { data: employees, error: empError } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, employment_start_date")
        .eq("is_active", true)
        .not("employment_start_date", "is", null);
      if (empError) throw empError;
      
      // Get team memberships
      const { data: teamMemberships, error: tmError } = await supabase
        .from("team_members")
        .select("employee_id, team:teams(name)");
      if (tmError) throw tmError;
      
      // Create a map of employee_id to team name
      const employeeTeamMap = new Map<string, string>();
      (teamMemberships || []).forEach((tm: { employee_id: string; team: { name: string } | null }) => {
        if (tm.team?.name && !employeeTeamMap.has(tm.employee_id)) {
          employeeTeamMap.set(tm.employee_id, tm.team.name);
        }
      });
      
      const today = new Date();
      const currentEmployees = (employees || []).map(emp => {
        const startDate = emp.employment_start_date ? parseISO(emp.employment_start_date) : today;
        const tenureDays = differenceInDays(today, startDate);
        return {
          id: emp.id,
          team_name: normalizeTeamName(employeeTeamMap.get(emp.id) || null),
          tenure_days: Math.max(0, tenureDays),
          is_current: true,
          left_within_60: false
        };
      });

      // Fetch historical employees
      const { data: historicalData, error: histError } = await supabase
        .from("historical_employment")
        .select("id, employee_name, team_name, tenure_days");
      if (histError) throw histError;
      
      const historicalEmployees = (historicalData || []).map(emp => ({
        id: emp.id,
        team_name: normalizeTeamName(emp.team_name),
        tenure_days: emp.tenure_days,
        is_current: false,
        left_within_60: emp.tenure_days <= 60
      }));

      // Combine all employees
      const allEmployees = [...currentEmployees, ...historicalEmployees];

      // Filter out excluded teams
      const relevantEmployees = allEmployees.filter(e => !EXCLUDED_TEAMS.includes(e.team_name));

      // Calculate overall churn: % of ALL employees who left within 60 days
      const totalEmployees = relevantEmployees.length;
      const totalExits60Days = relevantEmployees.filter(e => e.left_within_60).length;
      const overallChurn = totalEmployees > 0 ? (totalExits60Days / totalEmployees) * 100 : 0;

      // Calculate by team
      const teamStats = new Map<string, { total: number; exits60Days: number; currentCount: number }>();
      
      relevantEmployees.forEach(emp => {
        if (!teamStats.has(emp.team_name)) {
          teamStats.set(emp.team_name, { total: 0, exits60Days: 0, currentCount: 0 });
        }
        const stats = teamStats.get(emp.team_name)!;
        stats.total++;
        if (emp.is_current) {
          stats.currentCount++;
        }
        if (emp.left_within_60) {
          stats.exits60Days++;
        }
      });

      const byTeam = Array.from(teamStats.entries())
        .map(([teamName, stats]) => ({
          teamName,
          total: stats.total,
          exits60Days: stats.exits60Days,
          churnRate: stats.total > 0 ? Math.round((stats.exits60Days / stats.total) * 1000) / 10 : 0,
          currentCount: stats.currentCount,
          hasMinimumData: stats.total >= MIN_SAMPLE_SIZE
        }))
        .filter(t => t.total > 0)
        .sort((a, b) => b.churnRate - a.churnRate);

      return {
        overallChurn: Math.round(overallChurn * 10) / 10,
        totalEmployees,
        totalExits60Days,
        hasMinimumData: totalEmployees >= MIN_SAMPLE_SIZE,
        byTeam
      };
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">60-dages Churn</CardTitle>
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
          <CardTitle className="text-lg">60-dages Churn</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Kunne ikke hente data</p>
        </CardContent>
      </Card>
    );
  }

  const status = getChurnStatus(data.overallChurn);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">60-dages Churn</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm p-4" side="right">
                    <div className="space-y-2 text-sm">
                      <p className="font-medium">Definition</p>
                      <p>Andelen af ALLE ansatte (nuværende + tidligere) der forlod virksomheden inden for de første 60 dage.</p>
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
              Alle ansatte (nuværende + tidligere) • Ekskl. Stab
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
            <div className="text-xs text-muted-foreground mt-1">
              {data.totalExits60Days} af {data.totalEmployees} ansatte stoppede inden for 60 dage
            </div>
          </div>
        </div>

        {/* Team Breakdown */}
        {data.byTeam.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Pr. team</h4>
            <div className="space-y-2">
              {data.byTeam.map((team) => {
                const teamStatus = getChurnStatus(team.churnRate);
                return (
                  <div key={team.teamName} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-[140px]">{team.teamName}</span>
                      <span className="text-xs text-muted-foreground">
                        (<span className="text-green-600">{team.currentCount}</span>/{team.total})
                      </span>
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

        {/* Legend / Note */}
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Churn = andelen af alle ansatte (nuværende + stoppede) der forlod inden for 60 dage.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
