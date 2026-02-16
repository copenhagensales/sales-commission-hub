import { useMemo, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { useCachedLeaderboards, LeaderboardEntry } from "@/hooks/useCachedLeaderboard";
import { DashboardPeriodSelector, getDefaultPeriod, canUseCachedKpis, type PeriodSelection } from "@/components/dashboard/DashboardPeriodSelector";
import { useRequireDashboardAccess } from "@/hooks/useRequireDashboardAccess";
import { useSalesAggregatesExtended } from "@/hooks/useSalesAggregatesExtended";

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
interface MappedSellerData {
  name: string;
  totalSales: number;
  totalCrossSales: number;
  totalCommission: number;
  avatarUrl: string | null;
  employeeId: string;
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

const formatCurrency = formatNumber;

const getInitials = (name: string) => {
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const getCommissionStyle = () => "bg-primary/10 text-primary";

export default function RelatelDashboard() {
  const { canView, isLoading: accessLoading } = useRequireDashboardAccess("relatel");
  
  const tvMode = isTvMode();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodSelection>(() => getDefaultPeriod("payroll_period"));
  const payrollPeriod = useMemo(() => calculatePayrollPeriod(), []);
  
  useAutoReload(tvMode);

  const today = startOfDay(new Date());
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });

  const relatelClientId = getClientId("Relatel");

  // Determine if we can use cached data or need live query
  const useCached = canUseCachedKpis(selectedPeriod.type);

  // ========== CACHED DATA (for standard periods) ==========
  const { data: cachedKpis, isLoading: kpisLoading } = useClientDashboardKpis(
    relatelClientId || null,
    ["sales_count", "total_commission", "total_revenue", "total_hours"],
  );

  const { 
    sellersToday: cachedSellersToday, 
    sellersWeek: cachedSellersWeek, 
    sellersPayroll: cachedSellersPayroll,
    isLoading: leaderboardsLoading 
  } = useCachedLeaderboards(
    { type: "client", id: relatelClientId || null },
    { enabled: useCached, limit: 30 }
  );

  // ========== LIVE DATA (for custom / non-cached periods) ==========
  const { data: liveData, isLoading: liveLoading } = useSalesAggregatesExtended({
    periodStart: selectedPeriod.from,
    periodEnd: selectedPeriod.to,
    clientId: relatelClientId || undefined,
    groupBy: ['employee'],
    enabled: !useCached,
  });

  // Fetch employee avatars
  const { data: employeeData } = useQuery({
    queryKey: ["employee-data-relatel"],
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
    enabled: !tvMode
  });

  // Convert cached leaderboard entries to component-expected format
  const mapCachedToSeller = (entry: LeaderboardEntry): MappedSellerData => ({
    name: entry.employeeName,
    totalSales: entry.salesCount,
    totalCrossSales: entry.crossSaleCount || 0,
    totalCommission: entry.commission,
    avatarUrl: entry.avatarUrl,
    employeeId: entry.employeeId,
  });

  // ========== LIVE sellers from useSalesAggregatesExtended ==========
  const liveSellers: MappedSellerData[] = useMemo(() => {
    if (!liveData?.byEmployee) return [];
    return Object.entries(liveData.byEmployee)
      .map(([key, emp]) => ({
        name: emp.name,
        totalSales: emp.sales,
        totalCrossSales: 0, // cross-sales not available in live aggregation
        totalCommission: emp.commission,
        avatarUrl: null,
        employeeId: key,
      }))
      .sort((a, b) => b.totalCommission - a.totalCommission);
  }, [liveData]);

  // Cached sellers
  const sortedDailySellers: MappedSellerData[] = useMemo(() => {
    return cachedSellersToday.map(mapCachedToSeller);
  }, [cachedSellersToday]);

  const sortedWeeklySellers: MappedSellerData[] = useMemo(() => {
    return cachedSellersWeek.map(mapCachedToSeller);
  }, [cachedSellersWeek]);

  const sortedPayrollSellers: MappedSellerData[] = useMemo(() => {
    return cachedSellersPayroll.map(mapCachedToSeller);
  }, [cachedSellersPayroll]);

  const getAvatarUrl = (name: string) => {
    if (!employeeData?.avatarMap) return undefined;
    return employeeData.avatarMap.get(name.toLowerCase());
  };

  const isLoading = useCached 
    ? (kpisLoading || leaderboardsLoading) 
    : liveLoading;

  const periodLabel = `${format(payrollPeriod.start, "d. MMM", { locale: da })} - ${format(payrollPeriod.end, "d. MMM", { locale: da })}`;

  // ========== KPI values: cached vs live ==========
  const todaySales = getKpiValue(cachedKpis?.today?.sales_count, 0);
  const weekSales = getKpiValue(cachedKpis?.this_week?.sales_count, 0);
  const monthSales = getKpiValue(cachedKpis?.this_month?.sales_count, 0);
  const payrollSales = getKpiValue(cachedKpis?.payroll_period?.sales_count, 0);

  const todaySwitch = useMemo(() => 
    cachedSellersToday.reduce((sum, s) => sum + (s.crossSaleCount || 0), 0), [cachedSellersToday]);
  const weekSwitch = useMemo(() => 
    cachedSellersWeek.reduce((sum, s) => sum + (s.crossSaleCount || 0), 0), [cachedSellersWeek]);
  const payrollSwitch = useMemo(() => 
    cachedSellersPayroll.reduce((sum, s) => sum + (s.crossSaleCount || 0), 0), [cachedSellersPayroll]);

  const payrollHours = getKpiValue(cachedKpis?.payroll_period?.total_hours, 0);
  const payrollSalesPerHour = payrollHours > 0 ? payrollSales / payrollHours : 0;

  // Live KPI values for non-cached periods
  const liveSalesCount = liveData?.totals.sales ?? 0;
  const liveCommission = liveData?.totals.commission ?? 0;
  const liveRevenue = liveData?.totals.revenue ?? 0;

  // Render a leaderboard table
  const renderLeaderboard = (title: string, sellers: MappedSellerData[], showSwitch = true) => (
    <Card className={tvMode ? 'flex flex-col overflow-hidden' : ''}>
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="text-center text-lg font-bold uppercase tracking-wider">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className={tvMode ? 'p-0 flex-1 overflow-y-auto' : 'p-0'}>
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Indlæser...</p>
        ) : sellers.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Ingen salg</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border/50">
                <TableHead className="w-10"></TableHead>
                <TableHead>Navn</TableHead>
                <TableHead className="text-right">Salg</TableHead>
                {showSwitch && <TableHead className="text-right">Switch</TableHead>}
                <TableHead className="text-right">Provision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sellers.map((seller, index) => {
                const { name, totalSales, totalCrossSales, totalCommission, avatarUrl } = seller;
                return (
                  <TableRow key={name} className="border-b border-border/30">
                    <TableCell className="py-2 text-center text-muted-foreground font-medium">
                      {index + 1}
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={avatarUrl || getAvatarUrl(name) || undefined} alt={name} />
                          <AvatarFallback className="text-xs bg-primary/20">
                            {getInitials(name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm">{name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right py-2 text-primary font-semibold">
                      {totalSales}
                    </TableCell>
                    {showSwitch && (
                      <TableCell className="text-right py-2 text-primary font-semibold">
                        {totalCrossSales}
                      </TableCell>
                    )}
                    <TableCell className="text-right py-2">
                      <span className={`inline-block px-2 py-1 rounded text-sm font-semibold ${getCommissionStyle()}`}>
                        {formatCurrency(totalCommission)}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className={tvMode 
      ? 'w-[1920px] h-[1080px] bg-background p-5 flex flex-col overflow-hidden' 
      : 'min-h-screen bg-background p-6'
    }>
      <DashboardHeader 
        title="Relatel – Overblik" 
        subtitle={useCached 
          ? `Dag, uge og lønperiode (${periodLabel})`
          : `${selectedPeriod.label}`
        }
        rightContent={
          <DashboardPeriodSelector
            selectedPeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
            disabled={tvMode}
          />
        }
      />
      <div className={tvMode ? 'space-y-4 flex-1 flex flex-col min-h-0' : 'space-y-6'}>

        {/* ========== CACHED MODE: Show day/week/month/payroll cards ========== */}
        {useCached && (
          <>
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Salg i dag</CardTitle>
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">
                    {todaySales}
                    {todaySwitch > 0 && (
                      <span className="text-lg font-normal text-muted-foreground ml-2">(+{todaySwitch} switch)</span>
                    )}
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
                    {weekSwitch > 0 && (
                      <span className="text-lg font-normal text-muted-foreground ml-2">(+{weekSwitch} switch)</span>
                    )}
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
                    {payrollSwitch > 0 && (
                      <span className="text-lg font-normal text-muted-foreground ml-2">(+{payrollSwitch} switch)</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{periodLabel}</p>
                </CardContent>
              </Card>
            </div>

            {/* Sales per hour */}
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
              {renderLeaderboard("Top Løn Periode", sortedPayrollSellers)}
              {renderLeaderboard("Top Uge", sortedWeeklySellers)}
              {renderLeaderboard("Top Dag", sortedDailySellers)}
            </div>
          </>
        )}

        {/* ========== LIVE MODE: Show single period KPIs + leaderboard ========== */}
        {!useCached && (
          <>
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Salg</CardTitle>
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">
                    {isLoading ? "..." : liveSalesCount}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{selectedPeriod.label}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Provision</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">
                    {isLoading ? "..." : formatCurrency(liveCommission)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{selectedPeriod.label}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Omsætning</CardTitle>
                  <CalendarRange className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">
                    {isLoading ? "..." : formatCurrency(liveRevenue)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{selectedPeriod.label}</p>
                </CardContent>
              </Card>
            </div>

            {/* Single leaderboard for the selected period */}
            <div className="grid grid-cols-1 gap-4">
              {renderLeaderboard(`Top – ${selectedPeriod.label}`, liveSellers, false)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
