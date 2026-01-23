import { useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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

// Unified seller data type (from cached leaderboard)
interface SellerData {
  name: string;
  sales: number;
  commission: number;
  avatarUrl: string | null;
  employeeId: string;
  goalTarget: number | null;
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

// Format name for display: "Kasper M" (first name + last initial)
const getDisplayName = (name: string) => {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[parts.length - 1][0]}`;
  }
  return name;
};

// Commission color thresholds based on period type
// Daily: Green ≥ 1250, Yellow ≥ 1000, Red < 1000
// Weekly (5 days): Green ≥ 6250, Yellow ≥ 5000, Red < 5000
// Payroll (21 days): Green ≥ 26250, Yellow ≥ 21000, Red < 21000
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

export default function TdcErhvervDashboard() {
  const tvMode = isTvMode();
  const payrollPeriod = useMemo(() => calculatePayrollPeriod(), []);
  
  // Auto-reload for TV mode to pick up layout/code changes
  useAutoReload(tvMode);

  const today = startOfDay(new Date());
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });

  // Get client ID for cached KPIs
  const tdcClientId = getClientId("TDC Erhverv");

  // Fetch cached KPIs for hero cards (fast, pre-computed) - now includes total_hours
  const { data: cachedKpis, isLoading: kpisLoading } = useClientDashboardKpis(
    tdcClientId || null,
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
    { type: "client", id: tdcClientId || null },
    { enabled: !tvMode, limit: 30 }
  );

  // No more useDashboardSalesData - hours now come from cached KPIs!

  // Fetch employee avatars and IDs
  const { data: employeeData } = useQuery({
    queryKey: ["employee-data-tdc"],
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
  const periodStartStr = format(payrollPeriod.start, "yyyy-MM-dd");
  const periodEndStr = format(payrollPeriod.end, "yyyy-MM-dd");
  
  const { data: employeeGoals } = useQuery({
    queryKey: ["employee-goals-tdc", periodStartStr, periodEndStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("employee_sales_goals")
        .select("employee_id, target_amount")
        .eq("period_start", periodStartStr)
        .eq("period_end", periodEndStr);
      
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
    const weekdayIndex = getDay(now); // 0=Sunday, 1=Monday...
    const workDaysInWeekSoFar = weekdayIndex === 0 ? 5 : weekdayIndex === 6 ? 5 : weekdayIndex;
    const weekExpectedPercent = (workDaysInWeekSoFar / 5) * 100;
    
    // Day: how much of the workday is done (8:00-17:00)
    const hour = getHours(now);
    const dayProgressPercent = Math.min(100, Math.max(0, ((hour - 8) / 9) * 100));
    
    return { payrollExpectedPercent, weekExpectedPercent, dayExpectedPercent: dayProgressPercent };
  }, [payrollPeriod.start]);

  // Get goal info for an employee with period-relative expected progress
  // Now uses goalTarget from cached leaderboard data (same source for all modes)
  const getGoalInfo = (employeeName: string, commission: number, period: 'day' | 'week' | 'payroll', sellerGoalTarget?: number | null) => {
    let payrollTarget: number | undefined;
    
    // First try goalTarget from seller data, then fall back to employeeGoals map
    if (sellerGoalTarget != null) {
      payrollTarget = sellerGoalTarget;
    } else {
      const employeeId = employeeData?.nameToIdMap.get(employeeName.toLowerCase());
      if (employeeId) {
        payrollTarget = employeeGoals?.get(employeeId);
      }
    }
    
    if (!payrollTarget) return null;

    // Calculate target for the specific period
    const target = period === 'payroll' ? payrollTarget 
                 : period === 'week' ? Math.round((payrollTarget / 21) * 5)
                 : Math.round(payrollTarget / 21);
    
    // Get expected progress for this period
    const expectedPercent = period === 'payroll' ? timeProgress.payrollExpectedPercent
                          : period === 'week' ? timeProgress.weekExpectedPercent
                          : timeProgress.dayExpectedPercent;
    
    const progress = (commission / target) * 100;
    const expectedAmount = (expectedPercent / 100) * target;
    return { target, progress, expectedPercent, expectedAmount };
  };

  // Convert cached leaderboard entries to component-expected format
  const mapCachedToSeller = (entry: LeaderboardEntry) => ({
    name: entry.employeeName,
    totalSales: entry.salesCount,
    totalCommission: entry.commission,
    avatarUrl: entry.avatarUrl,
    employeeId: entry.employeeId,
    goalTarget: entry.goalTarget,
  });

  // Sort employees by commission for each period (use cached data - same source for all modes)
  const sortedDailySellers = useMemo(() => {
    return cachedSellersToday.map(mapCachedToSeller);
  }, [cachedSellersToday]);

  const sortedWeeklySellers = useMemo(() => {
    return cachedSellersWeek.map(mapCachedToSeller);
  }, [cachedSellersWeek]);

  const sortedPayrollSellers = useMemo(() => {
    return cachedSellersPayroll.map(mapCachedToSeller);
  }, [cachedSellersPayroll]);

  const getAvatarUrl = (name: string) => {
    if (!employeeData?.avatarMap) return undefined;
    return employeeData.avatarMap.get(name.toLowerCase());
  };

  const isLoading = kpisLoading || leaderboardsLoading;

  const periodLabel = `${format(payrollPeriod.start, "d. MMM", { locale: da })} - ${format(payrollPeriod.end, "d. MMM", { locale: da })}`;

  // Get sales counts from cached KPIs (same source for all modes)
  const todaySales = getKpiValue(cachedKpis?.today?.sales_count, 0);
  const weekSales = getKpiValue(cachedKpis?.this_week?.sales_count, 0);
  const monthSales = getKpiValue(cachedKpis?.this_month?.sales_count, 0);
  const payrollSales = getKpiValue(cachedKpis?.payroll_period?.sales_count, 0);

  // Hours now come from cached KPIs
  const payrollHours = getKpiValue(cachedKpis?.payroll_period?.total_hours, 0);

  // Calculate sales per hour for payroll period
  const payrollSalesPerHour = payrollHours > 0 ? payrollSales / payrollHours : 0;

  return (
    <div className={tvMode 
      ? 'w-[1920px] h-[1080px] bg-background p-5 flex flex-col overflow-hidden' 
      : 'min-h-screen bg-background p-6'
    }>
      <DashboardHeader 
        title="TDC Erhverv – Overblik" 
        subtitle={`Dag, uge og lønperiode (${periodLabel})`}
      />
      <div className={tvMode ? 'space-y-4 flex-1 flex flex-col min-h-0' : 'space-y-6'}>

        {/* KPI Cards - Row 1: Time-based sales */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Salg i dag</CardTitle>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {todaySales}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{format(today, "d. MMMM", { locale: da })}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Salg denne uge</CardTitle>
              <CalendarRange className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {weekSales}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Uge {format(today, "w", { locale: da })}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Salg denne måned</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {monthSales}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{format(today, "MMMM yyyy", { locale: da })}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Salg lønperiode</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {payrollSales}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{periodLabel}</p>
            </CardContent>
          </Card>
        </div>

        {/* KPI Card - Sales per hour (payroll period only) */}
        <div className="grid grid-cols-1 gap-4">
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Salg/time lønperiode</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {payrollSalesPerHour.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {payrollSales} salg / {payrollHours.toFixed(1)} timer
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Three leaderboard columns */}
        <div className={tvMode 
          ? 'grid grid-cols-3 gap-4 flex-1 min-h-0' 
          : 'grid grid-cols-1 gap-4 lg:grid-cols-3'
        }>
          
          {/* Top Løn Periode */}
          <Card className={tvMode ? 'flex flex-col overflow-hidden' : ''}>
            <CardHeader className="pb-3 flex-shrink-0">
              <CardTitle className="text-center text-lg font-bold uppercase tracking-wider">
                Top Løn Periode
              </CardTitle>
            </CardHeader>
            <CardContent className={tvMode ? 'p-0 flex-1 overflow-y-auto' : 'p-0'}>
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
                              <span className="font-medium text-sm">{getDisplayName(name)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-2 text-primary font-semibold">
                            {sales}
                          </TableCell>
                          <TableCell className="text-right py-2">
                            <span className={`inline-block px-2 py-1 rounded text-sm font-bold text-white ${getCommissionColor(commission, 'payroll')}`}>
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

          {/* Top Uge */}
          <Card className={tvMode ? 'flex flex-col overflow-hidden' : ''}>
            <CardHeader className="pb-3 flex-shrink-0">
              <CardTitle className="text-center text-lg font-bold uppercase tracking-wider">
                Top Uge
              </CardTitle>
            </CardHeader>
            <CardContent className={tvMode ? 'p-0 flex-1 overflow-y-auto' : 'p-0'}>
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
                              <span className="font-medium text-sm">{getDisplayName(name)}</span>
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
          <Card className={tvMode ? 'flex flex-col overflow-hidden' : ''}>
            <CardHeader className="pb-3 flex-shrink-0">
              <CardTitle className="text-center text-lg font-bold uppercase tracking-wider">
                Top Dag
              </CardTitle>
            </CardHeader>
            <CardContent className={tvMode ? 'p-0 flex-1 overflow-y-auto' : 'p-0'}>
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
                              <span className="font-medium text-sm">{getDisplayName(name)}</span>
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
