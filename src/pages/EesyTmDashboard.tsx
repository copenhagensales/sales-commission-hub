import { useMemo, useEffect } from "react";
import { format, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { da } from "date-fns/locale";
import { CalendarDays, Calendar, CalendarRange, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatNumber } from "@/lib/calculations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useClientDashboardKpis, getKpiValue } from "@/hooks/usePrecomputedKpi";
import { getClientId } from "@/utils/clientIds";
import { useCachedLeaderboards } from "@/hooks/useCachedLeaderboard";
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

// formatNumber imported from @/lib/calculations - alias as formatCurrency for dashboard display
const formatCurrency = formatNumber;

const getInitials = (name: string) => {
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

// Neutral commission styling - clean and readable
const getCommissionStyle = () => "bg-primary/10 text-primary";

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
      (data || []).forEach(emp => {
        const fullName = `${emp.first_name} ${emp.last_name}`;
        if (emp.avatar_url) {
          avatarMap.set(fullName.toLowerCase(), emp.avatar_url);
        }
      });
      return { avatarMap };
    },
    staleTime: 300000,
  });

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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPayrollSellers.map((seller, index) => (
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
                          <span className={`inline-block px-2 py-1 rounded text-sm font-semibold ${getCommissionStyle()}`}>{formatCurrency(seller.commission)}</span>
                        </TableCell>
                      </TableRow>
                    ))}
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedWeeklySellers.map((seller, index) => (
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
                          <span className={`inline-block px-2 py-1 rounded text-sm font-semibold ${getCommissionStyle()}`}>{formatCurrency(seller.commission)}</span>
                        </TableCell>
                      </TableRow>
                    ))}
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedDailySellers.map((seller, index) => (
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
                          <span className={`inline-block px-2 py-1 rounded text-sm font-semibold ${getCommissionStyle()}`}>{formatCurrency(seller.commission)}</span>
                        </TableCell>
                      </TableRow>
                    ))}
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
