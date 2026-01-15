import { useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, startOfWeek, differenceInBusinessDays, getDay, getHours } from "date-fns";
import { da } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useDashboardSalesData } from "@/hooks/useDashboardSalesData";
import { GoalProgressRing, GoalProgressRingEmpty } from "@/components/league/GoalProgressRing";

// Check if we're in TV mode
const isTvMode = () => {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/tv/') || 
         window.location.pathname.startsWith('/t/') || 
         sessionStorage.getItem('tv_board_code') !== null;
};

// Auto-reload page every 5 minutes to pick up code/layout changes
const useAutoReload = (enabled: boolean, intervalMs = 5 * 60 * 1000) => {
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      window.location.reload();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [enabled, intervalMs]);
};

interface TvCsTop20Data {
  sellersToday: Array<{ name: string; sales: number; commission: number; avatarUrl?: string; employeeId?: string; goalTarget?: number | null }>;
  sellersWeek: Array<{ name: string; sales: number; commission: number; avatarUrl?: string; employeeId?: string; goalTarget?: number | null }>;
  sellersPayroll: Array<{ name: string; sales: number; commission: number; avatarUrl?: string; employeeId?: string; goalTarget?: number | null }>;
}

// Calculate payroll period (15th to 14th)
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

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('da-DK', { style: 'decimal', maximumFractionDigits: 0 }).format(value);

const getInitials = (name: string) => {
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

// Commission color thresholds based on period type
const getCommissionColor = (commission: number, period: 'day' | 'week' | 'payroll') => {
  const thresholds = {
    day: { green: 1250, yellow: 1000 },
    week: { green: 6250, yellow: 5000 },
    payroll: { green: 26250, yellow: 21000 }
  };
  const { green, yellow } = thresholds[period];
  if (commission >= green) return "bg-green-500";
  if (commission >= yellow) return "bg-yellow-500";
  return "bg-red-500";
};

export default function CsTop20Dashboard() {
  const tvMode = isTvMode();
  const payrollPeriod = useMemo(() => calculatePayrollPeriod(), []);
  
  // Auto-reload for TV mode to pick up layout/code changes
  useAutoReload(tvMode);

  const today = startOfDay(new Date());
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });

  // Fetch TV data from edge function (bypasses RLS for TV mode)
  const { data: tvData } = useQuery<TvCsTop20Data>({
    queryKey: ["tv-cs-top-20-data"],
    queryFn: async () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/tv-dashboard-data?action=cs-top-20-data`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch TV data");
      }
      return response.json();
    },
    enabled: tvMode,
    refetchInterval: 30000,
  });

  // Fetch sales for today (all clients)
  const dailySalesData = useDashboardSalesData({
    startDate: today,
    endDate: new Date(),
    enabled: !tvMode,
    refetchInterval: 30000
  });

  // Fetch sales for this week (all clients)
  const weeklySalesData = useDashboardSalesData({
    startDate: weekStart,
    endDate: new Date(),
    enabled: !tvMode,
    refetchInterval: 30000
  });

  // Fetch sales for payroll period (all clients)
  const payrollSalesData = useDashboardSalesData({
    startDate: payrollPeriod.start,
    endDate: new Date(),
    enabled: !tvMode,
    refetchInterval: 30000
  });

  // Fetch employee avatars and IDs
  const { data: employeeData } = useQuery({
    queryKey: ["employee-data-cs-top-20"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, avatar_url")
        .eq("is_active", true);
      
      const avatarMap = new Map<string, string>();
      const nameToIdMap = new Map<string, string>();
      (data || []).forEach(emp => {
        const fullName = `${emp.first_name} ${emp.last_name}`;
        nameToIdMap.set(fullName.toLowerCase(), emp.id);
        if (emp.avatar_url) {
          avatarMap.set(fullName.toLowerCase(), emp.avatar_url);
        }
      });
      return { avatarMap, nameToIdMap };
    },
    enabled: !tvMode
  });

  // Fetch employee sales goals for payroll period
  const { data: employeeGoals } = useQuery({
    queryKey: ["employee-goals-cs-top-20", payrollPeriod.start.toISOString(), payrollPeriod.end.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("employee_sales_goals")
        .select("employee_id, target_amount")
        .gte("period_start", format(payrollPeriod.start, "yyyy-MM-dd"))
        .lte("period_end", format(payrollPeriod.end, "yyyy-MM-dd"));
      
      const goalMap = new Map<string, number>();
      (data || []).forEach(g => goalMap.set(g.employee_id, g.target_amount));
      return goalMap;
    },
    enabled: !tvMode
  });

  // Calculate time-based progress for relative goal tracking
  const timeProgress = useMemo(() => {
    const now = new Date();
    const totalWorkingDays = 21;
    
    // Payroll period: days elapsed out of 21
    const payrollDaysElapsed = Math.max(1, differenceInBusinessDays(now, payrollPeriod.start) + 1);
    const payrollExpectedPercent = Math.min(100, (payrollDaysElapsed / totalWorkingDays) * 100);
    
    // Week: current weekday (1=Monday to 5=Friday)
    const weekdayIndex = getDay(now);
    const workDaysInWeekSoFar = weekdayIndex === 0 ? 5 : weekdayIndex === 6 ? 5 : weekdayIndex;
    const weekExpectedPercent = (workDaysInWeekSoFar / 5) * 100;
    
    // Day: how much of the workday is done (8:00-17:00)
    const hour = getHours(now);
    const dayProgressPercent = Math.min(100, Math.max(0, ((hour - 8) / 9) * 100));
    
    return { payrollExpectedPercent, weekExpectedPercent, dayExpectedPercent: dayProgressPercent };
  }, [payrollPeriod.start]);

  // Get goal info for an employee with period-relative expected progress
  const getGoalInfo = (employeeName: string, commission: number, period: 'day' | 'week' | 'payroll', sellerGoalTarget?: number | null) => {
    let payrollTarget: number | undefined;
    
    if (tvMode) {
      payrollTarget = sellerGoalTarget ?? undefined;
    } else {
      const employeeId = employeeData?.nameToIdMap.get(employeeName.toLowerCase());
      if (!employeeId) return null;
      payrollTarget = employeeGoals?.get(employeeId);
    }
    
    if (!payrollTarget) return null;

    const target = period === 'payroll' ? payrollTarget 
                 : period === 'week' ? Math.round((payrollTarget / 21) * 5)
                 : Math.round(payrollTarget / 21);
    
    const expectedPercent = period === 'payroll' ? timeProgress.payrollExpectedPercent
                          : period === 'week' ? timeProgress.weekExpectedPercent
                          : timeProgress.dayExpectedPercent;
    
    const progress = (commission / target) * 100;
    const expectedAmount = (expectedPercent / 100) * target;
    return { target, progress, expectedPercent, expectedAmount };
  };

  // Sort employees by commission for each period - TOP 20
  const sortedDailySellers = useMemo(() => {
    if (tvMode && tvData?.sellersToday) return tvData.sellersToday.slice(0, 20);
    return [...dailySalesData.employeeStats]
      .filter(emp => emp.totalSales > 0)
      .sort((a, b) => b.totalCommission - a.totalCommission)
      .slice(0, 20);
  }, [dailySalesData.employeeStats, tvMode, tvData]);

  const sortedWeeklySellers = useMemo(() => {
    if (tvMode && tvData?.sellersWeek) return tvData.sellersWeek.slice(0, 20);
    return [...weeklySalesData.employeeStats]
      .filter(emp => emp.totalSales > 0)
      .sort((a, b) => b.totalCommission - a.totalCommission)
      .slice(0, 20);
  }, [weeklySalesData.employeeStats, tvMode, tvData]);

  const sortedPayrollSellers = useMemo(() => {
    if (tvMode && tvData?.sellersPayroll) return tvData.sellersPayroll.slice(0, 20);
    return [...payrollSalesData.employeeStats]
      .filter(emp => emp.totalSales > 0)
      .sort((a, b) => b.totalCommission - a.totalCommission)
      .slice(0, 20);
  }, [payrollSalesData.employeeStats, tvMode, tvData]);

  const getAvatarUrl = (name: string) => {
    if (!employeeData?.avatarMap) return undefined;
    return employeeData.avatarMap.get(name.toLowerCase());
  };

  const isLoading = dailySalesData.isLoading || weeklySalesData.isLoading || payrollSalesData.isLoading;

  const periodLabel = `${format(payrollPeriod.start, "d. MMM", { locale: da })} - ${format(payrollPeriod.end, "d. MMM", { locale: da })}`;

  return (
    <div className="min-h-screen bg-background p-6">
      <DashboardHeader 
        title="CS Top 20" 
        subtitle={`Top 20 på tværs af alle teams og opgaver (${periodLabel})`}
      />
      <div className="space-y-6">

        {/* Three leaderboard columns - Top 20 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          
          {/* Top Løn Periode */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-center text-lg font-bold uppercase tracking-wider">
                Top 20 Løn Periode
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <p className="text-center text-muted-foreground py-8">Indlæser...</p>
              ) : sortedPayrollSellers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Ingen salg</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border/50">
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Navn</TableHead>
                      <TableHead className="text-right">Salg</TableHead>
                      <TableHead className="text-right">Provision</TableHead>
                      <TableHead className="text-right">Mål</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPayrollSellers.map((seller, index) => {
                      const name = 'employeeName' in seller ? seller.employeeName : seller.name;
                      const sales = 'totalSales' in seller ? seller.totalSales : seller.sales;
                      const commission = 'totalCommission' in seller ? seller.totalCommission : seller.commission;
                      const avatarUrl = 'avatarUrl' in seller ? seller.avatarUrl : getAvatarUrl(name);
                      const sellerGoalTarget = 'goalTarget' in seller ? seller.goalTarget : undefined;
                      const goalInfo = getGoalInfo(name, commission, 'payroll', sellerGoalTarget);
                      
                      return (
                        <TableRow key={name} className="border-b border-border/30">
                          <TableCell className="py-2 text-center text-muted-foreground font-medium">{index + 1}</TableCell>
                          <TableCell className="py-2">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={avatarUrl} alt={name} />
                                <AvatarFallback className="text-xs bg-primary/20">{getInitials(name)}</AvatarFallback>
                              </Avatar>
                              <span className="font-medium text-sm">{name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-2 text-primary font-semibold">{sales}</TableCell>
                          <TableCell className="text-right py-2">
                            <span className={`inline-block px-2 py-1 rounded text-sm font-bold text-white ${getCommissionColor(commission, 'payroll')}`}>{formatCurrency(commission)}</span>
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="flex justify-end">
                              {goalInfo ? (
                                <GoalProgressRing
                                  progress={goalInfo.progress}
                                  expectedPercent={goalInfo.expectedPercent}
                                  current={commission}
                                  target={goalInfo.target}
                                  expectedAmount={goalInfo.expectedAmount}
                                />
                              ) : (
                                <GoalProgressRingEmpty />
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Top Uge */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-center text-lg font-bold uppercase tracking-wider">
                Top 20 Uge
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <p className="text-center text-muted-foreground py-8">Indlæser...</p>
              ) : sortedWeeklySellers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Ingen salg</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border/50">
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Navn</TableHead>
                      <TableHead className="text-right">Salg</TableHead>
                      <TableHead className="text-right">Provision</TableHead>
                      <TableHead className="text-right">Mål</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedWeeklySellers.map((seller, index) => {
                      const name = 'employeeName' in seller ? seller.employeeName : seller.name;
                      const sales = 'totalSales' in seller ? seller.totalSales : seller.sales;
                      const commission = 'totalCommission' in seller ? seller.totalCommission : seller.commission;
                      const avatarUrl = 'avatarUrl' in seller ? seller.avatarUrl : getAvatarUrl(name);
                      const sellerGoalTarget = 'goalTarget' in seller ? seller.goalTarget : undefined;
                      const goalInfo = getGoalInfo(name, commission, 'week', sellerGoalTarget);
                      
                      return (
                        <TableRow key={name} className="border-b border-border/30">
                          <TableCell className="py-2 text-center text-muted-foreground font-medium">
                            {index + 1}
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={avatarUrl} alt={name} />
                                <AvatarFallback className="text-xs bg-primary/20">
                                  {getInitials(name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium text-sm">{name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-2 text-primary font-semibold">
                            {sales}
                          </TableCell>
                          <TableCell className="text-right py-2">
                            <span className={`inline-block px-2 py-1 rounded text-sm font-bold text-white ${getCommissionColor(commission, 'week')}`}>
                              {formatCurrency(commission)}
                            </span>
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="flex justify-end">
                              {goalInfo ? (
                                <GoalProgressRing
                                  progress={goalInfo.progress}
                                  expectedPercent={goalInfo.expectedPercent}
                                  current={commission}
                                  target={goalInfo.target}
                                  expectedAmount={goalInfo.expectedAmount}
                                />
                              ) : (
                                <GoalProgressRingEmpty />
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Top Dag */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-center text-lg font-bold uppercase tracking-wider">
                Top 20 Dag
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <p className="text-center text-muted-foreground py-8">Indlæser...</p>
              ) : sortedDailySellers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Ingen salg</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border/50">
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Navn</TableHead>
                      <TableHead className="text-right">Salg</TableHead>
                      <TableHead className="text-right">Provision</TableHead>
                      <TableHead className="text-right">Mål</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedDailySellers.map((seller, index) => {
                      const name = 'employeeName' in seller ? seller.employeeName : seller.name;
                      const sales = 'totalSales' in seller ? seller.totalSales : seller.sales;
                      const commission = 'totalCommission' in seller ? seller.totalCommission : seller.commission;
                      const avatarUrl = 'avatarUrl' in seller ? seller.avatarUrl : getAvatarUrl(name);
                      const sellerGoalTarget = 'goalTarget' in seller ? seller.goalTarget : undefined;
                      const goalInfo = getGoalInfo(name, commission, 'day', sellerGoalTarget);
                      
                      return (
                        <TableRow key={name} className="border-b border-border/30">
                          <TableCell className="py-2 text-center text-muted-foreground font-medium">
                            {index + 1}
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={avatarUrl} alt={name} />
                                <AvatarFallback className="text-xs bg-primary/20">
                                  {getInitials(name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium text-sm">{name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-2 text-primary font-semibold">
                            {sales}
                          </TableCell>
                          <TableCell className="text-right py-2">
                            <span className={`inline-block px-2 py-1 rounded text-sm font-bold text-white ${getCommissionColor(commission, 'day')}`}>
                              {formatCurrency(commission)}
                            </span>
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="flex justify-end">
                              {goalInfo ? (
                                <GoalProgressRing
                                  progress={goalInfo.progress}
                                  expectedPercent={goalInfo.expectedPercent}
                                  current={commission}
                                  target={goalInfo.target}
                                  expectedAmount={goalInfo.expectedAmount}
                                />
                              ) : (
                                <GoalProgressRingEmpty />
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
