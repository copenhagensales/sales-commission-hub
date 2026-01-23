import { useMemo, useEffect } from "react";
import { format, startOfDay, startOfWeek, startOfMonth, differenceInBusinessDays, getDay, getHours } from "date-fns";
import { da } from "date-fns/locale";
import { CalendarDays, Calendar, CalendarRange, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GoalProgressRing, GoalProgressRingEmpty } from "@/components/league/GoalProgressRing";
import { useClientDashboardKpis, getKpiValue } from "@/hooks/usePrecomputedKpi";
import { getClientId } from "@/utils/clientIds";
import { useCachedLeaderboards, LeaderboardEntry } from "@/hooks/useCachedLeaderboard";
import { useQuery } from "@tanstack/react-query";

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

// Get goal progress color based on expected progress
const getGoalProgressColor = (progressPercent: number, expectedPercent: number) => {
  const ratio = progressPercent / expectedPercent;
  if (ratio >= 1) return "text-green-600";
  if (ratio >= 0.8) return "text-yellow-600";
  return "text-red-600";
};

export default function EesyTmDashboard() {
  const tvMode = isTvMode();
  const payrollPeriod = useMemo(() => calculatePayrollPeriod(), []);
  
  // Auto-reload for TV mode to pick up layout/code changes
  useAutoReload(tvMode);

  const today = startOfDay(new Date());
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const monthStart = startOfMonth(today);

  // Get client ID for Eesy TM
  const eesyClientId = getClientId("Eesy TM");

  // Fetch cached KPIs for hero cards (fast, pre-computed) - now includes total_hours
  const { data: cachedKpis, isLoading: kpisLoading } = useClientDashboardKpis(
    eesyClientId || null,
    ["sales_count", "total_commission", "total_revenue", "total_hours"]
  );

  // ========== CACHED LEADERBOARDS (from kpi_leaderboard_cache) ==========
  // Now uses public RLS policy - works for both normal and TV mode
  const { 
    sellersToday: cachedSellersToday, 
    sellersWeek: cachedSellersWeek, 
    sellersPayroll: cachedSellersPayroll,
    isLoading: leaderboardsLoading 
  } = useCachedLeaderboards(
    { type: "client", id: eesyClientId || null },
    { enabled: true, limit: 30 }
  );

  // Fetch employee avatars and IDs
  const { data: employeeData } = useQuery({
    queryKey: ["employee-data-eesy"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, avatar_url")
        .eq("is_active", true);
      
      const avatarMap = new Map<string, string>();
      const nameToIdMap = new Map<string, string>();
      (data || []).forEach(emp => {
        const fullName = `${emp.first_name} ${emp.last_name}`;
        if (emp.avatar_url) {
          avatarMap.set(fullName.toLowerCase(), emp.avatar_url);
        }
        nameToIdMap.set(fullName.toLowerCase(), emp.id);
      });
      return { avatarMap, nameToIdMap };
    },
    staleTime: 300000,
  });

  // Fetch employee sales goals for payroll period
  const { data: employeeGoals } = useQuery({
    queryKey: ["employee-goals-eesy", payrollPeriod.start.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("employee_sales_goals")
        .select("employee_id, commission_target")
        .gte("period_start", payrollPeriod.start.toISOString())
        .lte("period_start", payrollPeriod.end.toISOString());
      
      const goalsMap = new Map<string, number>();
      (data || []).forEach(goal => {
        if (goal.commission_target) {
          goalsMap.set(goal.employee_id, goal.commission_target);
        }
      });
      return goalsMap;
    },
    staleTime: 300000,
  });

  // Calculate time-based progress for relative goal tracking
  const timeProgress = useMemo(() => {
    const now = new Date();
    const totalWorkingDays = 21;
    
    // Payroll period: days elapsed out of 21
    const payrollDaysElapsed = Math.max(1, differenceInBusinessDays(now, payrollPeriod.start) + 1);
    const payrollExpectedPercent = Math.min(100, (payrollDaysElapsed / totalWorkingDays) * 100);
    
    // Week: current weekday (1=Monday to 5=Friday)
    const weekdayIndex = getDay(now); // 0=Sunday, 1=Monday...
    const workDaysInWeekSoFar = weekdayIndex === 0 ? 5 : weekdayIndex === 6 ? 5 : weekdayIndex;
    const weekExpectedPercent = (workDaysInWeekSoFar / 5) * 100;
    
    // Day: how much of the workday is done (8:00-17:00)
    const hour = getHours(now);
    const dayProgressPercent = Math.min(100, Math.max(0, ((hour - 8) / 9) * 100));
    
    return { payrollExpectedPercent, weekExpectedPercent, dayExpectedPercent: dayProgressPercent };
  }, [payrollPeriod.start]);

  // Get goal info for an employee
  const getGoalInfo = (employeeName: string, commission: number, period: 'day' | 'week' | 'payroll', sellerGoalTarget?: number | null) => {
    let payrollTarget: number | undefined;
    
    if (sellerGoalTarget != null) {
      payrollTarget = sellerGoalTarget;
    } else {
      const employeeId = employeeData?.nameToIdMap.get(employeeName.toLowerCase());
      if (employeeId) {
        payrollTarget = employeeGoals?.get(employeeId);
      }
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

  // Map cached leaderboard entries to display format
  const sortedPayrollSellers = cachedSellersPayroll;
  const sortedWeeklySellers = cachedSellersWeek;
  const sortedDailySellers = cachedSellersToday;

  const isLoading = kpisLoading || leaderboardsLoading;

  const periodLabel = `${format(payrollPeriod.start, "d. MMM", { locale: da })} - ${format(payrollPeriod.end, "d. MMM", { locale: da })}`;

  // Get sales counts from cached KPIs
  const salesToday = getKpiValue(cachedKpis?.today?.sales_count, 0);
  const salesWeek = getKpiValue(cachedKpis?.this_week?.sales_count, 0);
  const salesMonth = getKpiValue(cachedKpis?.this_month?.sales_count, 0);
  const salesPayroll = getKpiValue(cachedKpis?.payroll_period?.sales_count, 0);

  // Hours now come from cached KPIs
  const payrollHours = getKpiValue(cachedKpis?.payroll_period?.total_hours, 0);

  // Calculate sales per hour for payroll period
  const payrollSalesPerHour = payrollHours > 0 ? salesPayroll / payrollHours : 0;

  return (
    <div className={tvMode 
      ? 'w-[1920px] h-[1080px] bg-background p-5 flex flex-col overflow-hidden' 
      : 'min-h-screen bg-background p-6'
    }>
      <DashboardHeader 
        title="Eesy TM – Overblik" 
        subtitle={`Dag, uge og lønperiode (${periodLabel})`}
      />
      <div className={tvMode ? 'space-y-3 flex-1 flex flex-col min-h-0' : 'space-y-6'}>
        {/* KPI Cards */}
        <div className={tvMode ? 'grid grid-cols-5 gap-3' : 'grid grid-cols-2 gap-4 md:grid-cols-5'}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Salg i dag</CardTitle>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{salesToday}</div>
              <p className="text-xs text-muted-foreground mt-1">{format(today, "d. MMMM", { locale: da })}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Salg denne uge</CardTitle>
              <CalendarRange className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{salesWeek}</div>
              <p className="text-xs text-muted-foreground mt-1">Uge {format(today, "w", { locale: da })}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Salg denne måned</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{salesMonth}</div>
              <p className="text-xs text-muted-foreground mt-1">{format(today, "MMMM", { locale: da })}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Salg lønperiode</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{salesPayroll}</div>
              <p className="text-xs text-muted-foreground mt-1">{periodLabel}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Salg/time (løn)</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{payrollSalesPerHour.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">{payrollHours.toFixed(1)} timer</p>
            </CardContent>
          </Card>
        </div>

        {/* Leaderboard Tables */}
        <div className={tvMode ? 'grid grid-cols-3 gap-4 flex-1 min-h-0' : 'grid grid-cols-1 gap-6 lg:grid-cols-3'}>
          {/* Payroll Period */}
          <Card className={tvMode ? 'flex flex-col overflow-hidden' : ''}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold">Top Løn Periode</CardTitle>
            </CardHeader>
            <CardContent className={tvMode ? 'flex-1 overflow-auto p-0' : ''}>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <span className="text-muted-foreground">Indlæser...</span>
                </div>
              ) : sortedPayrollSellers.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <span className="text-muted-foreground">Ingen salg endnu</span>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Navn</TableHead>
                      <TableHead className="text-right">Salg</TableHead>
                      <TableHead className="text-right">Provision</TableHead>
                      <TableHead className="text-right">Mål</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPayrollSellers.map((seller, index) => {
                      const goalInfo = getGoalInfo(seller.employeeName, seller.commission, 'payroll', seller.goalTarget);
                      
                      return (
                        <TableRow key={seller.employeeId} className="border-b border-border/30">
                          <TableCell className="py-2 text-center text-muted-foreground font-medium">{index + 1}</TableCell>
                          <TableCell className="py-2">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={seller.avatarUrl || undefined} alt={seller.employeeName} />
                                <AvatarFallback className="text-xs bg-primary/20">{getInitials(seller.employeeName)}</AvatarFallback>
                              </Avatar>
                              <span className="font-medium text-sm">{seller.displayName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-2 text-primary font-semibold">{seller.salesCount}</TableCell>
                          <TableCell className="text-right py-2">
                            <span className={`inline-block px-2 py-1 rounded text-sm font-bold text-white ${getCommissionColor(seller.commission, 'payroll')}`}>{formatCurrency(seller.commission)}</span>
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="flex justify-end">
                              {goalInfo ? (
                                <GoalProgressRing
                                  progress={goalInfo.progress}
                                  expectedPercent={goalInfo.expectedPercent}
                                  current={seller.commission}
                                  target={goalInfo.target}
                                  expectedAmount={goalInfo.expectedAmount}
                                  size={32}
                                />
                              ) : (
                                <GoalProgressRingEmpty size={32} />
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

          {/* Weekly */}
          <Card className={tvMode ? 'flex flex-col overflow-hidden' : ''}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold">Top Uge</CardTitle>
            </CardHeader>
            <CardContent className={tvMode ? 'flex-1 overflow-auto p-0' : ''}>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <span className="text-muted-foreground">Indlæser...</span>
                </div>
              ) : sortedWeeklySellers.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <span className="text-muted-foreground">Ingen salg endnu</span>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Navn</TableHead>
                      <TableHead className="text-right">Salg</TableHead>
                      <TableHead className="text-right">Provision</TableHead>
                      <TableHead className="text-right">Mål</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedWeeklySellers.map((seller, index) => {
                      const goalInfo = getGoalInfo(seller.employeeName, seller.commission, 'week', seller.goalTarget);
                      
                      return (
                        <TableRow key={seller.employeeId} className="border-b border-border/30">
                          <TableCell className="py-2 text-center text-muted-foreground font-medium">{index + 1}</TableCell>
                          <TableCell className="py-2">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={seller.avatarUrl || undefined} alt={seller.employeeName} />
                                <AvatarFallback className="text-xs bg-primary/20">{getInitials(seller.employeeName)}</AvatarFallback>
                              </Avatar>
                              <span className="font-medium text-sm">{seller.displayName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-2 text-primary font-semibold">{seller.salesCount}</TableCell>
                          <TableCell className="text-right py-2">
                            <span className={`inline-block px-2 py-1 rounded text-sm font-bold text-white ${getCommissionColor(seller.commission, 'week')}`}>{formatCurrency(seller.commission)}</span>
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="flex justify-end">
                              {goalInfo ? (
                                <GoalProgressRing
                                  progress={goalInfo.progress}
                                  expectedPercent={goalInfo.expectedPercent}
                                  current={seller.commission}
                                  target={goalInfo.target}
                                  expectedAmount={goalInfo.expectedAmount}
                                  size={32}
                                />
                              ) : (
                                <GoalProgressRingEmpty size={32} />
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

          {/* Daily */}
          <Card className={tvMode ? 'flex flex-col overflow-hidden' : ''}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold">Top Dag</CardTitle>
            </CardHeader>
            <CardContent className={tvMode ? 'flex-1 overflow-auto p-0' : ''}>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <span className="text-muted-foreground">Indlæser...</span>
                </div>
              ) : sortedDailySellers.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <span className="text-muted-foreground">Ingen salg endnu</span>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Navn</TableHead>
                      <TableHead className="text-right">Salg</TableHead>
                      <TableHead className="text-right">Provision</TableHead>
                      <TableHead className="text-right">Mål</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedDailySellers.map((seller, index) => {
                      const goalInfo = getGoalInfo(seller.employeeName, seller.commission, 'day', seller.goalTarget);
                      
                      return (
                        <TableRow key={seller.employeeId} className="border-b border-border/30">
                          <TableCell className="py-2 text-center text-muted-foreground font-medium">{index + 1}</TableCell>
                          <TableCell className="py-2">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={seller.avatarUrl || undefined} alt={seller.employeeName} />
                                <AvatarFallback className="text-xs bg-primary/20">{getInitials(seller.employeeName)}</AvatarFallback>
                              </Avatar>
                              <span className="font-medium text-sm">{seller.displayName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-2 text-primary font-semibold">{seller.salesCount}</TableCell>
                          <TableCell className="text-right py-2">
                            <span className={`inline-block px-2 py-1 rounded text-sm font-bold text-white ${getCommissionColor(seller.commission, 'day')}`}>{formatCurrency(seller.commission)}</span>
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="flex justify-end">
                              {goalInfo ? (
                                <GoalProgressRing
                                  progress={goalInfo.progress}
                                  expectedPercent={goalInfo.expectedPercent}
                                  current={seller.commission}
                                  target={goalInfo.target}
                                  expectedAmount={goalInfo.expectedAmount}
                                  size={32}
                                />
                              ) : (
                                <GoalProgressRingEmpty size={32} />
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
