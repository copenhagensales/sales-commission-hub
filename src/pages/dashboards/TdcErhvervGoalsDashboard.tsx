import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, Users, TrendingUp, Award } from "lucide-react";
import { format, subMonths, addMonths } from "date-fns";
import { da } from "date-fns/locale";

const TDC_ERHVERV_TEAM_ID = "ee967dfd-04c8-465e-bda7-f1c47094bae0";

interface TeamMemberGoal {
  employeeId: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  targetAmount: number | null;
  achievedAmount: number;
  progress: number;
  status: "ahead" | "on-track" | "behind" | "no-goal";
  dailyRequired: number | null;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function calculatePayrollPeriod(): { start: Date; end: Date } {
  const today = new Date();
  const currentDay = today.getDate();
  
  if (currentDay >= 15) {
    const start = new Date(today.getFullYear(), today.getMonth(), 15);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 14);
    return { start, end };
  } else {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 15);
    const end = new Date(today.getFullYear(), today.getMonth(), 14);
    return { start, end };
  }
}

function getStatusBadge(status: TeamMemberGoal["status"]) {
  switch (status) {
    case "ahead":
      return <Badge className="bg-green-500/20 text-green-700 border-green-500/30">Foran</Badge>;
    case "on-track":
      return <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30">På sporet</Badge>;
    case "behind":
      return <Badge className="bg-red-500/20 text-red-700 border-red-500/30">Bagud</Badge>;
    case "no-goal":
      return <Badge variant="outline" className="text-muted-foreground">Intet mål</Badge>;
  }
}

export default function TdcErhvervGoalsDashboard() {
  const payrollPeriod = useMemo(() => calculatePayrollPeriod(), []);
  
  // Calculate days remaining in period
  const today = new Date();
  const daysRemaining = Math.max(0, Math.ceil((payrollPeriod.end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  const totalDays = Math.ceil((payrollPeriod.end.getTime() - payrollPeriod.start.getTime()) / (1000 * 60 * 60 * 24));
  const daysPassed = totalDays - daysRemaining;

  // Fetch team members with goals
  const { data: teamMembers, isLoading: loadingMembers } = useQuery({
    queryKey: ["tdc-erhverv-team-members", TDC_ERHVERV_TEAM_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select(`
          employee_id,
          employee_master_data!inner (
            id,
            first_name,
            last_name,
            job_title,
            salary_type,
            is_active
          )
        `)
        .eq("team_id", TDC_ERHVERV_TEAM_ID)
        .eq("employee_master_data.salary_type", "provision")
        .eq("employee_master_data.is_active", true);

      if (error) throw error;
      return data;
    },
  });

  // Fetch employee goals for current period
  const { data: goals, isLoading: loadingGoals } = useQuery({
    queryKey: ["employee-goals", payrollPeriod.start.toISOString(), payrollPeriod.end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_sales_goals")
        .select("employee_id, target_amount, period_start, period_end")
        .gte("period_start", payrollPeriod.start.toISOString().split("T")[0])
        .lte("period_end", payrollPeriod.end.toISOString().split("T")[0]);

      if (error) throw error;
      return data;
    },
  });

  // Fetch agent mappings for team members (including agent external IDs)
  const { data: agentMappings, isLoading: loadingMappings } = useQuery({
    queryKey: ["agent-mappings", teamMembers?.map((m) => m.employee_id)],
    queryFn: async () => {
      if (!teamMembers?.length) return [];
      
      const employeeIds = teamMembers.map((m) => m.employee_id);
      const { data, error } = await supabase
        .from("employee_agent_mapping")
        .select(`
          employee_id, 
          agent_id,
          agents!inner (
            external_dialer_id
          )
        `)
        .in("employee_id", employeeIds);

      if (error) throw error;
      return data;
    },
    enabled: !!teamMembers?.length,
  });

  // Fetch sales commission for the period using agent_external_id
  const { data: salesData, isLoading: loadingSales } = useQuery({
    queryKey: ["sales-commission", agentMappings, payrollPeriod.start.toISOString()],
    queryFn: async () => {
      if (!agentMappings?.length) return [];
      
      // Get all external dialer IDs from the agent mappings
      const externalIds = agentMappings
        .map((m) => (m.agents as any)?.external_dialer_id)
        .filter(Boolean);
      
      if (!externalIds.length) return [];
      
      const { data, error } = await supabase
        .from("sales")
        .select(`
          id,
          agent_external_id,
          sale_items (
            mapped_commission
          )
        `)
        .in("agent_external_id", externalIds)
        .gte("sale_datetime", payrollPeriod.start.toISOString())
        .lte("sale_datetime", payrollPeriod.end.toISOString());

      if (error) throw error;
      return data;
    },
    enabled: !!agentMappings?.length,
  });

  // Process data into team member goals
  const teamMemberGoals = useMemo((): TeamMemberGoal[] => {
    if (!teamMembers) return [];

    // Create external_id to employee mapping
    const externalIdToEmployee = new Map<string, string>();
    agentMappings?.forEach((m) => {
      const externalId = (m.agents as any)?.external_dialer_id;
      if (externalId) {
        externalIdToEmployee.set(externalId, m.employee_id);
      }
    });

    // Calculate commission per employee
    const employeeCommission = new Map<string, number>();
    salesData?.forEach((sale) => {
      const employeeId = externalIdToEmployee.get(sale.agent_external_id);
      if (employeeId) {
        const saleCommission = sale.sale_items?.reduce(
          (sum, item) => sum + (item.mapped_commission || 0),
          0
        ) || 0;
        employeeCommission.set(
          employeeId,
          (employeeCommission.get(employeeId) || 0) + saleCommission
        );
      }
    });

    // Create goal lookup
    const goalLookup = new Map<string, number>();
    goals?.forEach((g) => {
      goalLookup.set(g.employee_id, g.target_amount);
    });

    return teamMembers.map((member): TeamMemberGoal => {
      const emp = member.employee_master_data as any;
      const targetAmount = goalLookup.get(member.employee_id) || null;
      const achievedAmount = employeeCommission.get(member.employee_id) || 0;
      
      let progress = 0;
      let status: TeamMemberGoal["status"] = "no-goal";
      let dailyRequired: number | null = null;

      if (targetAmount) {
        progress = Math.min(100, (achievedAmount / targetAmount) * 100);
        const expectedProgress = (daysPassed / totalDays) * 100;
        
        if (progress >= 100) {
          status = "ahead";
        } else if (progress >= expectedProgress - 5) {
          status = progress >= expectedProgress ? "ahead" : "on-track";
        } else {
          status = "behind";
        }

        const remaining = targetAmount - achievedAmount;
        if (remaining > 0 && daysRemaining > 0) {
          dailyRequired = remaining / daysRemaining;
        }
      }

      return {
        employeeId: member.employee_id,
        firstName: emp.first_name || "",
        lastName: emp.last_name || "",
        jobTitle: emp.job_title,
        targetAmount,
        achievedAmount,
        progress,
        status,
        dailyRequired,
      };
    }).sort((a, b) => {
      // Sort by status priority, then by progress
      const statusOrder = { ahead: 0, "on-track": 1, behind: 2, "no-goal": 3 };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      return b.progress - a.progress;
    });
  }, [teamMembers, agentMappings, salesData, goals, daysPassed, totalDays, daysRemaining]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const withGoal = teamMemberGoals.filter((m) => m.targetAmount !== null);
    const totalTarget = withGoal.reduce((sum, m) => sum + (m.targetAmount || 0), 0);
    const totalAchieved = teamMemberGoals.reduce((sum, m) => sum + m.achievedAmount, 0);
    const avgProgress = withGoal.length > 0
      ? withGoal.reduce((sum, m) => sum + m.progress, 0) / withGoal.length
      : 0;

    return {
      membersWithGoal: withGoal.length,
      totalMembers: teamMemberGoals.length,
      totalTarget,
      totalAchieved,
      avgProgress,
      ahead: teamMemberGoals.filter((m) => m.status === "ahead").length,
      onTrack: teamMemberGoals.filter((m) => m.status === "on-track").length,
      behind: teamMemberGoals.filter((m) => m.status === "behind").length,
      noGoal: teamMemberGoals.filter((m) => m.status === "no-goal").length,
    };
  }, [teamMemberGoals]);

  const isLoading = loadingMembers || loadingGoals || loadingMappings || loadingSales;
  const periodLabel = `${format(payrollPeriod.start, "d. MMM", { locale: da })} - ${format(payrollPeriod.end, "d. MMM yyyy", { locale: da })}`;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <DashboardHeader 
        title="TDC Erhverv Mål" 
        subtitle={`Teammedlemmernes individuelle mål · ${periodLabel}`}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Medlemmer med mål</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">
                {stats.membersWithGoal} / {stats.totalMembers}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Total Mål</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(stats.totalTarget)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Opnået</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(stats.totalAchieved)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gns. Progress</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats.avgProgress.toFixed(1)}%</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status Summary */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-2 text-sm">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>Foran: {stats.ahead}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span>På sporet: {stats.onTrack}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>Bagud: {stats.behind}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-3 h-3 rounded-full bg-muted" />
          <span>Intet mål: {stats.noGoal}</span>
        </div>
      </div>

      {/* Team Members Table */}
      <Card>
        <CardHeader>
          <CardTitle>Medarbejder Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medarbejder</TableHead>
                <TableHead className="text-right">Mål</TableHead>
                <TableHead className="text-right">Opnået</TableHead>
                <TableHead className="w-[200px]">Progress</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Dagligt behov</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : teamMemberGoals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Ingen provisionslønne medarbejdere fundet på dette team
                  </TableCell>
                </TableRow>
              ) : (
                teamMemberGoals.map((member) => (
                  <TableRow key={member.employeeId}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {member.firstName} {member.lastName}
                        </div>
                        {member.jobTitle && (
                          <div className="text-sm text-muted-foreground">{member.jobTitle}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {member.targetAmount ? formatCurrency(member.targetAmount) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(member.achievedAmount)}
                    </TableCell>
                    <TableCell>
                      {member.targetAmount ? (
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={member.progress} 
                            className="h-2"
                          />
                          <span className="text-sm text-muted-foreground w-12 text-right">
                            {member.progress.toFixed(0)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(member.status)}</TableCell>
                    <TableCell className="text-right">
                      {member.dailyRequired !== null && member.dailyRequired > 0
                        ? formatCurrency(member.dailyRequired)
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Days remaining info */}
      <div className="mt-4 text-sm text-muted-foreground text-center">
        {daysRemaining} dage tilbage i lønperioden
      </div>
    </div>
  );
}
