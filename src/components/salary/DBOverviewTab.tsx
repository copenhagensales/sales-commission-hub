import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { da } from "date-fns/locale";
import { DBTeamDetailCard } from "./DBTeamDetailCard";

interface TeamDB {
  teamId: string;
  teamName: string;
  leaderId: string | null;
  leaderName: string;
  revenue: number;
  salaryCosts: number;
  expenses: number;
  db: number;
  leaderSalary: number;
  percentageRate: number;
  minimumSalary: number;
}

export function DBOverviewTab() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedTeam, setSelectedTeam] = useState<TeamDB | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const { data: teamsDB, isLoading } = useQuery<TeamDB[]>({
    queryKey: ["teams-db", monthStart.toISOString(), monthEnd.toISOString()],
    queryFn: async (): Promise<TeamDB[]> => {
      // Get teams with leaders
      const { data: teams, error: teamsError } = await (supabase
        .from("teams") as any)
        .select("id, name, team_leader_id")
        .eq("is_active", true);
      if (teamsError) throw teamsError;

      // Get leader names
      const leaderIds = teams?.map(t => t.team_leader_id).filter(Boolean) as string[];
      const { data: leaders } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name")
        .in("id", leaderIds);

      // Get team expenses for the period
      const { data: expenses } = await supabase
        .from("team_expenses")
        .select("team_id, amount")
        .gte("expense_date", monthStart.toISOString().split("T")[0])
        .lte("expense_date", monthEnd.toISOString().split("T")[0]);

      // Get personnel salaries for team leaders
      const { data: personnelSalaries } = await supabase
        .from("personnel_salaries")
        .select("employee_id, percentage_rate, minimum_salary")
        .eq("salary_type", "team_leader")
        .eq("is_active", true)
        .in("employee_id", leaderIds);

      // Get team members for each team
      const { data: teamMembers } = await supabase
        .from("team_members")
        .select("team_id, employee_id");

      // Get agent mappings
      const { data: agentMappings } = await supabase
        .from("employee_agent_mapping")
        .select("employee_id, agent_id, agents(email, external_dialer_id)");

      // Get sale items for the period
      const { data: saleItems } = await supabase
        .from("sale_items")
        .select(`
          id,
          quantity,
          mapped_commission,
          mapped_revenue,
          sales!inner(
            id,
            sale_datetime,
            agent_email,
            agent_external_id
          )
        `)
        .gte("sales.sale_datetime", monthStart.toISOString())
        .lte("sales.sale_datetime", monthEnd.toISOString());

      // Calculate DB for each team
      const teamsWithDB: TeamDB[] = (teams || []).map(team => {
        // Team expenses
        const teamExpenses = expenses?.filter(e => e.team_id === team.id) || [];
        const totalExpenses = teamExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

        // Team members
        const members = teamMembers?.filter(m => m.team_id === team.id) || [];
        const memberIds = members.map(m => m.employee_id);

        // Agent info for team members
        const memberAgents = agentMappings?.filter(am => memberIds.includes(am.employee_id)) || [];
        const agentEmails = memberAgents.map(a => a.agents?.email?.toLowerCase()).filter(Boolean);
        const agentExtIds = memberAgents.map(a => a.agents?.external_dialer_id).filter(Boolean);

        // Sales for team
        const teamSales = saleItems?.filter(si => {
          const email = si.sales?.agent_email?.toLowerCase();
          const extId = si.sales?.agent_external_id;
          return agentEmails.includes(email) || agentExtIds.includes(extId);
        }) || [];

        const revenue = teamSales.reduce((sum, si) => sum + (Number(si.mapped_revenue) || 0) * (si.quantity || 1), 0);
        const salaryCosts = teamSales.reduce((sum, si) => sum + (Number(si.mapped_commission) || 0) * (si.quantity || 1), 0);
        const db = revenue - salaryCosts - totalExpenses;

        // Leader salary calculation
        const leaderSalary = personnelSalaries?.find(ps => ps.employee_id === team.team_leader_id);
        const percentageRate = Number(leaderSalary?.percentage_rate) || 0;
        const minimumSalary = Number(leaderSalary?.minimum_salary) || 0;
        const calculatedSalary = db * (percentageRate / 100);
        const finalLeaderSalary = Math.max(calculatedSalary, minimumSalary);

        const leader = leaders?.find(l => l.id === team.team_leader_id);

        return {
          teamId: team.id,
          teamName: team.name,
          leaderId: team.team_leader_id,
          leaderName: leader ? `${leader.first_name} ${leader.last_name}` : "Ikke tildelt",
          revenue,
          salaryCosts,
          expenses: totalExpenses,
          db,
          leaderSalary: finalLeaderSalary,
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
      salaryCosts: acc.salaryCosts + t.salaryCosts,
      expenses: acc.expenses + t.expenses,
      db: acc.db + t.db,
      leaderSalary: acc.leaderSalary + t.leaderSalary,
    }),
    { revenue: 0, salaryCosts: 0, expenses: 0, db: 0, leaderSalary: 0 }
  ) || { revenue: 0, salaryCosts: 0, expenses: 0, db: 0, leaderSalary: 0 };

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
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[120px] text-center font-medium capitalize">
              {format(currentMonth, "MMMM yyyy", { locale: da })}
            </span>
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-right">Omsætning</TableHead>
                  <TableHead className="text-right">Lønomk.</TableHead>
                  <TableHead className="text-right">Udgifter</TableHead>
                  <TableHead className="text-right">DB</TableHead>
                  <TableHead className="text-right">TL Løn</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Indlæser...
                    </TableCell>
                  </TableRow>
                ) : !teamsDB?.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
                        <TableCell className="text-right text-destructive">-{formatCurrency(team.salaryCosts)}</TableCell>
                        <TableCell className="text-right text-destructive">-{formatCurrency(team.expenses)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(team.db)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(team.leaderSalary)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{formatCurrency(totals.revenue)}</TableCell>
                      <TableCell className="text-right text-destructive">-{formatCurrency(totals.salaryCosts)}</TableCell>
                      <TableCell className="text-right text-destructive">-{formatCurrency(totals.expenses)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(totals.db)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(totals.leaderSalary)}</TableCell>
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
    </div>
  );
}
