import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/utils/supabasePagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { TrendingUp, Calendar } from "lucide-react";
import { startOfMonth, endOfMonth } from "date-fns";
import { DBTeamDetailCard } from "./DBTeamDetailCard";
import { DBPeriodSelector } from "./DBPeriodSelector";
import { DBDailyBreakdown } from "./DBDailyBreakdown";

type PeriodMode = "payroll" | "month" | "custom";
interface TeamDB {
  teamId: string;
  teamName: string;
  leaderId: string | null;
  leaderName: string;
  assistantId: string | null;
  assistantName: string;
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
  const [selectedTeam, setSelectedTeam] = useState<TeamDB | null>(null);
  const [dailyViewTeam, setDailyViewTeam] = useState<TeamDB | null>(null);

  const handlePeriodChange = (start: Date, end: Date) => {
    setPeriodStart(start);
    setPeriodEnd(end);
  };

  const { data: teamsDB, isLoading } = useQuery<TeamDB[]>({
    queryKey: ["teams-db", periodStart.toISOString(), periodEnd.toISOString()],
    queryFn: async (): Promise<TeamDB[]> => {
      // Get all teams with leaders and assistants
      const { data: teams, error: teamsError } = await (supabase
        .from("teams") as any)
        .select("id, name, team_leader_id, assistant_team_leader_id");
      if (teamsError) throw teamsError;

      // Get leader and assistant names
      const leaderIds = teams?.map((t: any) => t.team_leader_id).filter(Boolean) as string[];
      const assistantIds = teams?.map((t: any) => t.assistant_team_leader_id).filter(Boolean) as string[];
      const allEmployeeIds = [...new Set([...leaderIds, ...assistantIds])];

      const { data: employees } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name")
        .in("id", allEmployeeIds);

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
        .in("employee_id", leaderIds);

      // Get personnel salaries for assistants
      const { data: assistantSalaries } = await supabase
        .from("personnel_salaries")
        .select("employee_id, monthly_salary")
        .eq("salary_type", "assistant")
        .eq("is_active", true)
        .in("employee_id", assistantIds);

      // Get team members for each team
      const { data: teamMembers } = await supabase
        .from("team_members")
        .select("team_id, employee_id");

      // Get agent mappings
      const { data: agentMappings } = await supabase
        .from("employee_agent_mapping")
        .select("employee_id, agent_id, agents(email, external_dialer_id)");

      // Get sale items for the period with pagination to bypass 1000-row limit
      const saleItems = await fetchAllRows<{
        id: string;
        quantity: number;
        mapped_commission: number;
        mapped_revenue: number;
        sales: { id: string; sale_datetime: string; agent_email: string; agent_external_id: string };
      }>(
        "sale_items",
        "id, quantity, mapped_commission, mapped_revenue, sales!inner(id, sale_datetime, agent_email, agent_external_id)",
        (query) =>
          query
            .gte("sales.sale_datetime", periodStart.toISOString())
            .lte("sales.sale_datetime", periodEnd.toISOString()),
        { orderBy: "id", ascending: true }
      );

      // Calculate DB for each team
      const teamsWithDB: TeamDB[] = (teams || []).map((team: any) => {
        // Team expenses
        const teamExpenses = expenses?.filter(e => e.team_id === team.id) || [];
        const totalExpenses = teamExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

        // Team members
        const members = teamMembers?.filter(m => m.team_id === team.id) || [];
        const memberIds = members.map(m => m.employee_id);

        // Agent info for team members
        const memberAgents = agentMappings?.filter(am => memberIds.includes(am.employee_id)) || [];
        const agentEmails = memberAgents.map(a => (a.agents as any)?.email?.toLowerCase()).filter(Boolean);
        const agentExtIds = memberAgents.map(a => (a.agents as any)?.external_dialer_id).filter(Boolean);

        // Sales for team
        const teamSales = saleItems?.filter(si => {
          const email = (si.sales as any)?.agent_email?.toLowerCase();
          const extId = (si.sales as any)?.agent_external_id;
          return agentEmails.includes(email) || agentExtIds.includes(extId);
        }) || [];

        const revenue = teamSales.reduce((sum, si) => sum + (Number(si.mapped_revenue) || 0) * (si.quantity || 1), 0);
        const sellerSalaryCosts = teamSales.reduce((sum, si) => sum + (Number(si.mapped_commission) || 0) * (si.quantity || 1), 0);

        // Leader salary calculation
        const leaderSalary = leaderSalaries?.find(ps => ps.employee_id === team.team_leader_id);
        const percentageRate = Number(leaderSalary?.percentage_rate) || 0;
        const minimumSalary = Number(leaderSalary?.minimum_salary) || 0;
        
        // Calculate DB before leader salary for percentage calc
        const dbBeforeLeader = revenue - sellerSalaryCosts - totalExpenses;
        const calculatedLeaderSalary = dbBeforeLeader * (percentageRate / 100);
        const finalLeaderSalary = Math.max(calculatedLeaderSalary, minimumSalary);

        // Assistant salary
        const assistantSalary = assistantSalaries?.find(ps => ps.employee_id === team.assistant_team_leader_id);
        const finalAssistantSalary = Number(assistantSalary?.monthly_salary) || 0;

        // Final DB
        const db = revenue - sellerSalaryCosts - finalLeaderSalary - finalAssistantSalary - totalExpenses;

        const leader = employees?.find(e => e.id === team.team_leader_id);
        const assistant = employees?.find(e => e.id === team.assistant_team_leader_id);

        return {
          teamId: team.id,
          teamName: team.name,
          leaderId: team.team_leader_id,
          leaderName: leader ? `${leader.first_name} ${leader.last_name}` : "Ikke tildelt",
          assistantId: team.assistant_team_leader_id,
          assistantName: assistant ? `${assistant.first_name} ${assistant.last_name}` : "-",
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
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }).format(amount);

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
                    {teamsDB.map((team) => (
                      <TableRow 
                        key={team.teamId} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedTeam(team)}
                      >
                        <TableCell className="font-medium">{team.teamName}</TableCell>
                        <TableCell className="text-right">{formatCurrency(team.revenue)}</TableCell>
                        <TableCell className="text-right text-destructive">-{formatCurrency(team.sellerSalaryCosts)}</TableCell>
                        <TableCell className="text-right text-destructive">-{formatCurrency(team.leaderSalary)}</TableCell>
                        <TableCell className="text-right text-destructive">-{formatCurrency(team.assistantSalary)}</TableCell>
                        <TableCell className="text-right text-destructive">-{formatCurrency(team.expenses)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(team.db)}</TableCell>
                        <TableCell>
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
                        </TableCell>
                      </TableRow>
                    ))}
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
