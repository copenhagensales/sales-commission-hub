import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, Users, TrendingUp, Info, AlertCircle, Trophy, Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format, addDays, isWeekend } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { da } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FIELDMARKETING_CLIENTS } from "@/hooks/useFieldmarketingSales";

const FIELDMARKETING_TEAM_ID = "900fc72c-8710-4933-9fc5-de89a78b03bf";

const CLIENT_TABS = [
  { id: "eesy-fm", name: "Eesy FM", clientId: FIELDMARKETING_CLIENTS.EESY_FM },
  { id: "yousee", name: "Yousee", clientId: FIELDMARKETING_CLIENTS.YOUSEE },
];

interface TeamMemberGoal {
  employeeId: string;
  firstName: string;
  lastName: string;
  targetAmount: number | null;
  achievedAmount: number;
  progressVsExpected: number;
  progressVsTotal: number;
  status: "ahead" | "on-track" | "behind" | "no-goal";
  dailyRequired: number | null;
  remainingWorkingDays: number;
  goalCreatedAt: string | null;
  goalUpdatedAt: string | null;
  remaining: number;
}

function getWorkingDaysInRange(start: Date, end: Date): number {
  let count = 0;
  let current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(23, 59, 59, 999);
  
  while (current <= endDate) {
    if (!isWeekend(current)) {
      count++;
    }
    current = addDays(current, 1);
  }
  return count;
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

interface ClientGoalsDashboardProps {
  clientId: string;
  clientName: string;
  teamId: string;
  periodStartStr: string;
  periodEndStr: string;
  workingDaysStats: { totalWorkingDays: number; elapsedWorkingDays: number; remainingWorkingDays: number };
}

function ClientGoalsDashboard({ 
  clientId, 
  clientName, 
  teamId, 
  periodStartStr, 
  periodEndStr,
  workingDaysStats 
}: ClientGoalsDashboardProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editGoalAmount, setEditGoalAmount] = useState("");
  const queryClient = useQueryClient();

  // Fetch team members
  const { data: teamMembers, isLoading: loadingMembers } = useQuery({
    queryKey: ["fieldmarketing-team-members", teamId],
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
        .eq("team_id", teamId)
        .eq("employee_master_data.is_active", true);

      if (error) throw error;
      return data;
    },
  });

  // Fetch employee goals for current period
  const { data: goals, isLoading: loadingGoals } = useQuery({
    queryKey: ["employee-goals-fm", periodStartStr, periodEndStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_sales_goals")
        .select("employee_id, target_amount, period_start, period_end, created_at, updated_at")
        .eq("period_start", periodStartStr)
        .eq("period_end", periodEndStr);

      if (error) throw error;
      return data;
    },
  });

  // Fetch team sales goal for current period (client-specific)
  const teamGoalKey = `${teamId}-${clientId}`;
  const { data: teamGoal, isLoading: loadingTeamGoal } = useQuery({
    queryKey: ["team-sales-goal-fm", teamGoalKey, periodStartStr, periodEndStr],
    queryFn: async () => {
      // For now, we'll use a combined team goal - can be split per client if needed
      const { data, error } = await supabase
        .from("team_sales_goals")
        .select("id, target_amount, period_start, period_end")
        .eq("team_id", teamId)
        .eq("period_start", periodStartStr)
        .eq("period_end", periodEndStr)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Fetch product commissions for this client
  const { data: productCommissions, isLoading: loadingProducts } = useQuery({
    queryKey: ["fieldmarketing-product-commissions", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          name,
          commission_dkk,
          client_campaign:client_campaign_id (
            client_id
          )
        `)
        .not("client_campaign_id", "is", null);
      
      if (error) throw error;
      
      const commissionMap: Record<string, number> = {};
      (data || []).forEach((p: any) => {
        if (p.client_campaign?.client_id === clientId) {
          commissionMap[p.name] = p.commission_dkk || 0;
        }
      });
      return commissionMap;
    },
  });

  // Fetch fieldmarketing sales for the period
  const { data: salesData, isLoading: loadingSales } = useQuery({
    queryKey: ["fieldmarketing-sales-period", clientId, periodStartStr, periodEndStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fieldmarketing_sales")
        .select("id, seller_id, product_name, registered_at")
        .eq("client_id", clientId)
        .gte("registered_at", `${periodStartStr}T00:00:00`)
        .lte("registered_at", `${periodEndStr}T23:59:59`);

      if (error) throw error;
      return data;
    },
    enabled: !!productCommissions,
  });

  // Mutation to upsert team goal
  const upsertTeamGoal = useMutation({
    mutationFn: async (targetAmount: number) => {
      const { data, error } = await supabase
        .from("team_sales_goals")
        .upsert({
          team_id: teamId,
          target_amount: targetAmount,
          period_start: periodStartStr,
          period_end: periodEndStr,
        }, {
          onConflict: "team_id,period_start,period_end"
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-sales-goal-fm"] });
      toast.success("Team mål opdateret");
      setIsEditDialogOpen(false);
      setEditGoalAmount("");
    },
    onError: (error) => {
      toast.error("Kunne ikke opdatere team mål");
      console.error(error);
    },
  });

  // Process data into team member goals
  const teamMemberGoals = useMemo((): TeamMemberGoal[] => {
    if (!teamMembers || !productCommissions) return [];

    // Calculate commission per employee from fieldmarketing_sales
    const employeeCommission = new Map<string, number>();
    salesData?.forEach((sale) => {
      const commission = productCommissions[sale.product_name] || 0;
      employeeCommission.set(
        sale.seller_id,
        (employeeCommission.get(sale.seller_id) || 0) + commission
      );
    });

    // Create goal lookup with timestamps
    const goalLookup = new Map<string, { target: number; createdAt: string | null; updatedAt: string | null }>();
    goals?.forEach((g) => {
      goalLookup.set(g.employee_id, {
        target: g.target_amount,
        createdAt: g.created_at,
        updatedAt: g.updated_at,
      });
    });

    const { totalWorkingDays, elapsedWorkingDays, remainingWorkingDays } = workingDaysStats;

    return teamMembers.map((member): TeamMemberGoal => {
      const emp = member.employee_master_data as any;
      const goalData = goalLookup.get(member.employee_id);
      const targetAmount = goalData?.target || null;
      const goalCreatedAt = goalData?.createdAt || null;
      const goalUpdatedAt = goalData?.updatedAt || null;
      const achievedAmount = employeeCommission.get(member.employee_id) || 0;
      
      let progressVsExpected = 0;
      let progressVsTotal = 0;
      let status: TeamMemberGoal["status"] = "no-goal";
      let dailyRequired: number | null = null;

      if (targetAmount && targetAmount > 0) {
        progressVsTotal = (achievedAmount / targetAmount) * 100;
        
        const expectedNow = elapsedWorkingDays > 0 
          ? (elapsedWorkingDays / totalWorkingDays) * targetAmount 
          : 0;
        
        progressVsExpected = expectedNow > 0 
          ? (achievedAmount / expectedNow) * 100 
          : (achievedAmount > 0 ? 100 : 0);
        
        if (progressVsExpected >= 100) {
          status = "ahead";
        } else if (progressVsExpected >= 85) {
          status = "on-track";
        } else {
          status = "behind";
        }

        const remaining = targetAmount - achievedAmount;
        if (remaining > 0 && remainingWorkingDays > 0) {
          dailyRequired = remaining / remainingWorkingDays;
        }
      }

      return {
        employeeId: member.employee_id,
        firstName: emp.first_name || "",
        lastName: emp.last_name || "",
        targetAmount,
        achievedAmount,
        progressVsExpected,
        progressVsTotal,
        status,
        dailyRequired,
        remainingWorkingDays,
        goalCreatedAt,
        goalUpdatedAt,
        remaining: targetAmount ? targetAmount - achievedAmount : 0,
      };
    }).sort((a, b) => {
      const statusOrder = { ahead: 0, "on-track": 1, behind: 2, "no-goal": 3 };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      return b.progressVsExpected - a.progressVsExpected;
    });
  }, [teamMembers, salesData, goals, productCommissions, workingDaysStats]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const withGoal = teamMemberGoals.filter((m) => m.targetAmount !== null);
    const totalTarget = withGoal.reduce((sum, m) => sum + (m.targetAmount || 0), 0);
    const totalAchieved = teamMemberGoals.reduce((sum, m) => sum + m.achievedAmount, 0);
    const avgProgressVsExpected = withGoal.length > 0
      ? withGoal.reduce((sum, m) => sum + m.progressVsExpected, 0) / withGoal.length
      : 0;

    return {
      membersWithGoal: withGoal.length,
      totalMembers: teamMemberGoals.length,
      totalTarget,
      totalAchieved,
      avgProgressVsExpected,
      ahead: teamMemberGoals.filter((m) => m.status === "ahead").length,
      onTrack: teamMemberGoals.filter((m) => m.status === "on-track").length,
      behind: teamMemberGoals.filter((m) => m.status === "behind").length,
      noGoal: teamMemberGoals.filter((m) => m.status === "no-goal").length,
    };
  }, [teamMemberGoals]);

  const isLoading = loadingMembers || loadingGoals || loadingProducts || loadingSales || loadingTeamGoal;

  const teamTargetAmount = teamGoal?.target_amount || stats.totalTarget;
  const teamProgress = teamTargetAmount > 0 ? (stats.totalAchieved / teamTargetAmount) * 100 : 0;
  const isUsingFallback = !teamGoal?.target_amount;
  
  const handleOpenEditDialog = () => {
    setEditGoalAmount(teamGoal?.target_amount?.toString() || stats.totalTarget?.toString() || "");
    setIsEditDialogOpen(true);
  };
  
  const handleSaveTeamGoal = () => {
    const amount = parseFloat(editGoalAmount.replace(/[^0-9.-]+/g, ""));
    if (isNaN(amount) || amount <= 0) {
      toast.error("Indtast et gyldigt beløb");
      return;
    }
    upsertTeamGoal.mutate(amount);
  };

  return (
    <div className="space-y-6">
      {/* Team Progress Hero Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex flex-col items-center gap-2">
              <div className={`text-6xl md:text-7xl font-bold ${teamProgress >= 100 ? 'text-green-600' : teamProgress >= 75 ? 'text-yellow-600' : 'text-red-600'}`}>
                {teamProgress.toFixed(0)}%
              </div>
              <span className="text-sm text-muted-foreground">{clientName} Fremskridt</span>
            </div>
            
            <div className="flex-1 w-full md:max-w-lg">
              <Progress 
                value={Math.min(100, teamProgress)} 
                className={`h-4 mb-3 ${teamProgress >= 100 ? '[&>div]:bg-green-500' : teamProgress >= 75 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-red-500'}`}
              />
              <div className="flex justify-between text-sm">
                <span className="font-medium">{formatCurrency(stats.totalAchieved)}</span>
                <span className="text-muted-foreground">af {formatCurrency(teamTargetAmount)}</span>
              </div>
              {isUsingFallback && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Bruger sum af individuelle mål. Klik for at sætte team-mål.
                </p>
              )}
            </div>
            
            <div className="flex flex-col items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-1.5"
                onClick={handleOpenEditDialog}
              >
                <Pencil className="h-3.5 w-3.5" />
                {teamGoal?.target_amount ? "Rediger mål" : "Sæt team mål"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Medlemmer</CardTitle>
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
            <p className="text-xs text-muted-foreground">med mål</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Mål</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(teamTargetAmount)}</div>
            )}
            <p className="text-xs text-muted-foreground">{isUsingFallback ? "sum af individuelle" : "team mål"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Opnået</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(stats.totalAchieved)}</div>
            )}
            <p className="text-xs text-muted-foreground">i provision</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mangler</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className={`text-2xl font-bold ${teamTargetAmount - stats.totalAchieved <= 0 ? 'text-green-600' : ''}`}>
                {teamTargetAmount - stats.totalAchieved <= 0 
                  ? `+${formatCurrency(Math.abs(teamTargetAmount - stats.totalAchieved))}`
                  : formatCurrency(teamTargetAmount - stats.totalAchieved)
                }
              </div>
            )}
            <p className="text-xs text-muted-foreground">til mål</p>
          </CardContent>
        </Card>
      </div>

      {/* Working days info */}
      <div className="text-sm text-muted-foreground flex items-center gap-1">
        <Info className="h-4 w-4" />
        <span>
          {workingDaysStats.elapsedWorkingDays} af {workingDaysStats.totalWorkingDays} arbejdsdage brugt · {workingDaysStats.remainingWorkingDays} arbejdsdage tilbage
        </span>
      </div>

      {/* Status Summary */}
      <div className="flex flex-wrap gap-4">
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
          <CardTitle>Medarbejder Progress - {clientName}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medarbejder</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Mål</TableHead>
                <TableHead className="text-right">Opnået</TableHead>
                <TableHead className="text-right">Mangler</TableHead>
                <TableHead className="w-[180px]">Af forventet</TableHead>
                <TableHead className="text-right">Dagligt behov</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-8 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : teamMemberGoals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Ingen medarbejdere fundet på dette team
                  </TableCell>
                </TableRow>
              ) : (
                teamMemberGoals.map((member, index) => {
                  const isTopPerformer = index === 0 && member.status === "ahead" && teamMemberGoals.filter(m => m.status === "ahead").length > 0;
                  const initials = `${member.firstName.charAt(0)}${member.lastName.charAt(0)}`.toUpperCase();
                  
                  return (
                    <TableRow key={member.employeeId}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex items-center gap-1.5">
                            <Link 
                              to={`/my-goals/${member.employeeId}`}
                              className="font-medium hover:underline hover:text-primary transition-colors"
                            >
                              {member.firstName} {member.lastName}
                            </Link>
                            {isTopPerformer && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Trophy className="h-4 w-4 text-yellow-500" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <span className="text-xs">Top performer</span>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(member.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {member.targetAmount ? formatCurrency(member.targetAmount) : "-"}
                          {member.goalUpdatedAt && member.goalCreatedAt && member.goalUpdatedAt !== member.goalCreatedAt && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertCircle className="h-3.5 w-3.5 text-orange-500 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-xs">
                                    <div className="font-medium">Mål ændret</div>
                                    <div>Sidst ændret: {format(new Date(member.goalUpdatedAt), "d. MMM yyyy 'kl.' HH:mm", { locale: da })}</div>
                                    <div className="text-muted-foreground">
                                      Oprettet: {format(new Date(member.goalCreatedAt), "d. MMM yyyy", { locale: da })}
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(member.achievedAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {member.targetAmount ? (
                          <span className={member.remaining <= 0 ? "text-green-600 font-medium" : ""}>
                            {member.remaining <= 0 
                              ? `+${formatCurrency(Math.abs(member.remaining))}` 
                              : formatCurrency(member.remaining)
                            }
                          </span>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        {member.targetAmount ? (
                          <div className="flex items-center gap-2">
                            <Progress 
                              value={Math.min(100, member.progressVsExpected)} 
                              className={`h-2 flex-1 ${member.progressVsExpected >= 100 ? '[&>div]:bg-green-500' : member.progressVsExpected >= 85 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-red-500'}`}
                            />
                            <span className={`text-sm font-medium w-12 text-right ${member.progressVsExpected >= 100 ? 'text-green-600' : member.progressVsExpected >= 85 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {member.progressVsExpected.toFixed(0)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {member.dailyRequired !== null && member.dailyRequired > 0 ? (
                          <div className="text-sm">
                            <div>{formatCurrency(member.dailyRequired)}/dag</div>
                            <div className="text-xs text-muted-foreground">({member.remainingWorkingDays} dage)</div>
                          </div>
                        ) : member.status === "no-goal" ? (
                          "-"
                        ) : (
                          <span className="text-green-600 text-sm">Mål nået!</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Team Goal Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sæt {clientName} Mål</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="teamGoalAmount">Målbeløb (DKK)</Label>
              <Input
                id="teamGoalAmount"
                type="text"
                placeholder="350000"
                value={editGoalAmount}
                onChange={(e) => setEditGoalAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Sum af individuelle mål: {formatCurrency(stats.totalTarget)}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Annuller
            </Button>
            <Button onClick={handleSaveTeamGoal} disabled={upsertTeamGoal.isPending}>
              {upsertTeamGoal.isPending ? "Gemmer..." : "Gem"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function FieldmarketingGoalsDashboard() {
  const [activeTab, setActiveTab] = useState(CLIENT_TABS[0].id);
  
  const payrollPeriod = useMemo(() => calculatePayrollPeriod(), []);
  const today = new Date();
  
  const workingDaysStats = useMemo(() => {
    const totalWorkingDays = getWorkingDaysInRange(payrollPeriod.start, payrollPeriod.end);
    const elapsedWorkingDays = getWorkingDaysInRange(payrollPeriod.start, today);
    const remainingWorkingDays = Math.max(0, getWorkingDaysInRange(addDays(today, 1), payrollPeriod.end));
    
    return { totalWorkingDays, elapsedWorkingDays, remainingWorkingDays };
  }, [payrollPeriod, today]);

  const periodStartStr = format(payrollPeriod.start, "yyyy-MM-dd");
  const periodEndStr = format(payrollPeriod.end, "yyyy-MM-dd");
  const periodLabel = `${format(payrollPeriod.start, "d. MMM", { locale: da })} - ${format(payrollPeriod.end, "d. MMM yyyy", { locale: da })}`;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <DashboardHeader 
        title="Fieldmarketing Mål" 
        subtitle={`Teammedlemmernes individuelle mål · ${periodLabel}`}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          {CLIENT_TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="min-w-[100px]">
              {tab.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {CLIENT_TABS.map((tab) => (
          <TabsContent key={tab.id} value={tab.id}>
            <ClientGoalsDashboard
              clientId={tab.clientId}
              clientName={tab.name}
              teamId={FIELDMARKETING_TEAM_ID}
              periodStartStr={periodStartStr}
              periodEndStr={periodEndStr}
              workingDaysStats={workingDaysStats}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
