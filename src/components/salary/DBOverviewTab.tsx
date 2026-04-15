import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamDBStats } from "@/hooks/useTeamDBStats";
import { useAssistantHoursCalculation } from "@/hooks/useAssistantHoursCalculation";
import { useTeamAssistantLeaders, getTeamAssistantIds, getAllAssistantIds } from "@/hooks/useTeamAssistantLeaders";
import { useCpoRevenue } from "@/hooks/useCpoRevenue";
import { formatCurrency } from "@/lib/calculations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { TrendingUp, Calendar, HelpCircle, ChevronDown, ChevronRight } from "lucide-react";
import { startOfMonth, endOfMonth } from "date-fns";
import { DBTeamDetailCard } from "./DBTeamDetailCard";
import { DBPeriodSelector } from "./DBPeriodSelector";
import { DBDailyBreakdown } from "./DBDailyBreakdown";

type PeriodMode = "payroll" | "month" | "week" | "day" | "custom";
interface TeamDB {
  teamId: string;
  teamName: string;
  leaderId: string | null;
  leaderName: string;
  assistantIds: string[];
  assistantNames: string[];
  revenue: number;
  sellerSalaryCosts: number;
  leaderSalary: number;
  assistantSalary: number;
  expenses: number;
  db: number;
  percentageRate: number;
  minimumSalary: number;
}

export function DBOverviewTab() {
  const [periodStart, setPeriodStart] = useState(() => startOfMonth(new Date()));
  const [periodEnd, setPeriodEnd] = useState(() => endOfMonth(new Date()));
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [selectedPresetLabel, setSelectedPresetLabel] = useState<string | undefined>("Denne måned");
  const [selectedTeam, setSelectedTeam] = useState<TeamDB | null>(null);
  const [dailyViewTeam, setDailyViewTeam] = useState<TeamDB | null>(null);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  const handlePeriodChange = (start: Date, end: Date) => {
    setPeriodStart(start);
    setPeriodEnd(end);
  };

  // Get aggregated sales data from central hook
  const { byEmployee: aggregatesByEmployee, isLoading: aggregatesLoading } = useTeamDBStats(
    periodStart,
    periodEnd,
    undefined, // No specific team - we want all teams
    undefined,
    true
  );

  // Get CPO-based revenue from time clocks
  const { data: cpoRevenue, isLoading: cpoLoading } = useCpoRevenue({
    periodStart,
    periodEnd,
    enabled: true,
  });

  // First, fetch basic team structure
  const { data: teamsBasic } = useQuery({
    queryKey: ["teams-basic-structure"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, team_leader_id");
      if (error) throw error;
      return data;
    },
  });

  // Fetch team assistant leaders from junction table
  const { data: teamAssistants = [] } = useTeamAssistantLeaders();

  // Get all unique assistant IDs for hours calculation
  const assistantIds = useMemo(() => {
    return getAllAssistantIds(teamAssistants);
  }, [teamAssistants]);

  // Calculate assistant salaries based on hours
  const { data: assistantHoursData, isLoading: assistantHoursLoading } = useAssistantHoursCalculation(
    periodStart,
    periodEnd,
    assistantIds
  );

  const { data: teamsDB, isLoading: teamsLoading } = useQuery<TeamDB[]>({
    queryKey: ["teams-db-structure", periodStart.toISOString(), periodEnd.toISOString(), JSON.stringify(assistantHoursData), JSON.stringify(teamAssistants)],
    queryFn: async (): Promise<TeamDB[]> => {
      const teams = teamsBasic || [];

      // Get leader and assistant names
      const leaderIds = teams?.map((t: any) => t.team_leader_id).filter(Boolean) as string[];
      const allEmployeeIds = [...new Set([...leaderIds, ...assistantIds])];

      const { data: employees } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name")
        .in("id", allEmployeeIds.length > 0 ? allEmployeeIds : ["none"]);

      // Get team expenses for the period
      const { data: expenses } = await supabase
        .from("team_expenses")
        .select("team_id, amount")
        .gte("expense_date", periodStart.toISOString().split("T")[0])
        .lte("expense_date", periodEnd.toISOString().split("T")[0]);

      // Get personnel salaries for team leaders
      const { data: leaderSalaries } = await supabase
        .from("personnel_salaries")
        .select("employee_id, percentage_rate, minimum_salary, monthly_salary")
        .eq("salary_type", "team_leader")
        .eq("is_active", true)
        .in("employee_id", leaderIds.length > 0 ? leaderIds : ["none"]);

      // Get team members for each team
      const { data: teamMembers } = await supabase
        .from("team_members")
        .select("team_id, employee_id");

      // Calculate DB for each team using aggregated data
      const teamsWithDB: TeamDB[] = (teams || []).map((team: any) => {
        // Team expenses
        const teamExpenses = expenses?.filter(e => e.team_id === team.id) || [];
        const totalExpenses = teamExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

        // Team members
        const members = teamMembers?.filter(m => m.team_id === team.id) || [];
        const memberIds = members.map(m => m.employee_id);

        // Sum revenue and commission from aggregated data for team members
        let revenue = 0;
        let sellerSalaryCosts = 0;
        
        for (const employeeId of memberIds) {
          const employeeData = aggregatesByEmployee[employeeId];
          if (employeeData) {
            revenue += employeeData.revenue;
            sellerSalaryCosts += employeeData.commission;
          }
        }

        // Leader salary calculation
        const leaderSalary = leaderSalaries?.find(ps => ps.employee_id === team.team_leader_id);
        const percentageRate = Number(leaderSalary?.percentage_rate) || 0;
        const minimumSalary = Number(leaderSalary?.minimum_salary) || 0;
        
        // Calculate DB before leader salary for percentage calc
        const dbBeforeLeader = revenue - sellerSalaryCosts - totalExpenses;
        const calculatedLeaderSalary = dbBeforeLeader * (percentageRate / 100);
        const finalLeaderSalary = Math.max(calculatedLeaderSalary, minimumSalary);

        // Assistant salary - now based on hours worked (supports multiple assistants)
        const teamAssistantIds = getTeamAssistantIds(teamAssistants, team.id);
        let finalAssistantSalary = 0;
        for (const aId of teamAssistantIds) {
          const assistantData = assistantHoursData ? assistantHoursData[aId] : null;
          finalAssistantSalary += assistantData?.totalSalary || 0;
        }

        // Final DB
        const db = revenue - sellerSalaryCosts - finalLeaderSalary - finalAssistantSalary - totalExpenses;

        const leader = employees?.find(e => e.id === team.team_leader_id);
        const assistantNames = teamAssistantIds
          .map(id => {
            const emp = employees?.find(e => e.id === id);
            return emp ? `${emp.first_name} ${emp.last_name}` : null;
          })
          .filter(Boolean) as string[];

        return {
          teamId: team.id,
          teamName: team.name,
          leaderId: team.team_leader_id,
          leaderName: leader ? `${leader.first_name} ${leader.last_name}` : "Ikke tildelt",
          assistantIds: teamAssistantIds,
          assistantNames,
          revenue,
          sellerSalaryCosts,
          leaderSalary: finalLeaderSalary,
          assistantSalary: finalAssistantSalary,
          expenses: totalExpenses,
          db,
          percentageRate,
          minimumSalary,
        };
      });

      return teamsWithDB.sort((a, b) => b.db - a.db);
    },
    enabled: !aggregatesLoading && !!teamsBasic && !assistantHoursLoading,
  });

  const isLoading = teamsLoading || aggregatesLoading || assistantHoursLoading;

  // formatCurrency imported from @/lib/calculations

  const totals = teamsDB?.reduce(
    (acc, t) => ({
      revenue: acc.revenue + t.revenue,
      sellerSalaryCosts: acc.sellerSalaryCosts + t.sellerSalaryCosts,
      leaderSalary: acc.leaderSalary + t.leaderSalary,
      assistantSalary: acc.assistantSalary + t.assistantSalary,
      expenses: acc.expenses + t.expenses,
      db: acc.db + t.db,
    }),
    { revenue: 0, sellerSalaryCosts: 0, leaderSalary: 0, assistantSalary: 0, expenses: 0, db: 0 }
  ) || { revenue: 0, sellerSalaryCosts: 0, leaderSalary: 0, assistantSalary: 0, expenses: 0, db: 0 };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle>Dækningsbidrag (DB) Oversigt</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Period selector */}
          <DBPeriodSelector
            periodStart={periodStart}
            periodEnd={periodEnd}
            onChange={handlePeriodChange}
            mode={periodMode}
            onModeChange={setPeriodMode}
            selectedPresetLabel={selectedPresetLabel}
            onPresetLabelChange={setSelectedPresetLabel}
          />

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-right">Omsætning</TableHead>
                  <TableHead className="text-right">Sælgerløn</TableHead>
                  <TableHead className="text-right">Lederløn</TableHead>
                  <TableHead className="text-right">Assist.løn</TableHead>
                  <TableHead className="text-right">Udgifter</TableHead>
                  <TableHead className="text-right">DB</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Indlæser...
                    </TableCell>
                  </TableRow>
                ) : !teamsDB?.length ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Ingen teams fundet
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {teamsDB.map((team) => {
                      const isExpanded = expandedTeamId === team.teamId;
                      const dbBeforeLeader = team.revenue - team.sellerSalaryCosts - team.expenses;
                      const calculatedLeaderSalary = dbBeforeLeader * (team.percentageRate / 100);
                      const usesMinimum = team.leaderSalary === team.minimumSalary && calculatedLeaderSalary < team.minimumSalary;

                      return (
                        <>
                          <TableRow 
                            key={team.teamId} 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setExpandedTeamId(isExpanded ? null : team.teamId)}
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-1">
                                {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                {team.teamName}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(team.revenue)}</TableCell>
                            <TableCell className="text-right text-destructive">-{formatCurrency(team.sellerSalaryCosts)}</TableCell>
                            <TableCell className="text-right text-destructive">-{formatCurrency(team.leaderSalary)}</TableCell>
                            <TableCell className="text-right text-destructive">-{formatCurrency(team.assistantSalary)}</TableCell>
                            <TableCell className="text-right text-destructive">-{formatCurrency(team.expenses)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(team.db)}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTeam(team);
                                  }}
                                >
                                  <HelpCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDailyViewTeam(team);
                                  }}
                                >
                                  <Calendar className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow key={`${team.teamId}-expanded`} className="bg-muted/30 hover:bg-muted/30">
                              <TableCell colSpan={8} className="py-3 px-6">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <p className="text-muted-foreground">Teamleder</p>
                                    <p className="font-medium">{team.leaderName}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Procentsats</p>
                                    <p className="font-medium">{team.percentageRate}%</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Minimumsløn</p>
                                    <p className="font-medium">{formatCurrency(team.minimumSalary)}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">DB før lederløn</p>
                                    <p className="font-medium">{formatCurrency(dbBeforeLeader)}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Beregnet ({team.percentageRate}% af DB)</p>
                                    <p className="font-medium">{formatCurrency(calculatedLeaderSalary)}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Endelig lederløn</p>
                                    <p className="font-medium text-destructive">
                                      {formatCurrency(team.leaderSalary)} {usesMinimum && <span className="text-xs text-muted-foreground">(minimum)</span>}
                                    </p>
                                  </div>
                                  {team.assistantNames.length > 0 && (
                                    <div>
                                      <p className="text-muted-foreground">Assistenter</p>
                                      <p className="font-medium">{team.assistantNames.join(", ")}</p>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{formatCurrency(totals.revenue)}</TableCell>
                      <TableCell className="text-right text-destructive">-{formatCurrency(totals.sellerSalaryCosts)}</TableCell>
                      <TableCell className="text-right text-destructive">-{formatCurrency(totals.leaderSalary)}</TableCell>
                      <TableCell className="text-right text-destructive">-{formatCurrency(totals.assistantSalary)}</TableCell>
                      <TableCell className="text-right text-destructive">-{formatCurrency(totals.expenses)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(totals.db)}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-sm text-muted-foreground">Klik på et team for at se detaljer</p>
        </CardContent>
      </Card>

      {selectedTeam && (
        <DBTeamDetailCard team={selectedTeam} onClose={() => setSelectedTeam(null)} />
      )}

      {dailyViewTeam && (
        <DBDailyBreakdown
          teamId={dailyViewTeam.teamId}
          teamName={dailyViewTeam.teamName}
          periodStart={periodStart}
          periodEnd={periodEnd}
          onClose={() => setDailyViewTeam(null)}
        />
      )}
    </div>
  );
}
