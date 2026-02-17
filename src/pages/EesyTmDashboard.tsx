import { useMemo, useEffect, useState } from "react";
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
import { DashboardPeriodSelector, getDefaultPeriod, type PeriodSelection } from "@/components/dashboard/DashboardPeriodSelector";
import { useRequireDashboardAccess } from "@/hooks/useRequireDashboardAccess";

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

// Leaderboard table component to reduce repetition
function TvLeaderboardTable({ 
  title, 
  sellers, 
  isLoading, 
  tvMode,
  employeeData 
}: { 
  title: string; 
  sellers: Array<{ employeeId: string; employeeName: string; displayName: string; avatarUrl?: string | null; salesCount: number; commission: number }>;
  isLoading: boolean; 
  tvMode: boolean;
  employeeData?: { avatarMap: Map<string, string> };
}) {
  return (
    <Card className={tvMode 
      ? 'flex flex-col overflow-hidden border border-border/[0.14] shadow-2xl bg-card' 
      : ''
    }>
      <CardHeader className={tvMode ? 'pb-2 pt-4 px-4' : 'pb-3'}>
        <CardTitle className={tvMode 
          ? 'text-[26px] font-bold tracking-wide text-center uppercase text-foreground' 
          : 'text-lg font-bold'
        }>{title}</CardTitle>
      </CardHeader>
      <CardContent className={tvMode ? 'flex-1 overflow-hidden p-0' : ''}>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-muted-foreground">Indlæser...</span>
          </div>
        ) : sellers.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-muted-foreground">Ingen salg endnu</span>
          </div>
        ) : (
          <>
          <Table>
            <TableHeader>
              <TableRow className={tvMode ? 'border-b-2 border-border/70' : ''}>
                <TableHead className={tvMode ? 'w-[40px] text-center text-[18px] font-bold py-3 text-foreground/80' : 'w-10'}></TableHead>
                <TableHead className={tvMode ? 'text-[18px] font-bold py-3 text-foreground/80' : ''}>Navn</TableHead>
                <TableHead className={tvMode ? 'text-right text-[18px] font-bold py-3 w-[90px] text-foreground/80' : 'text-right'}>Salg</TableHead>
                <TableHead className={tvMode ? 'text-right text-[18px] font-bold py-3 w-[140px] text-foreground/80' : 'text-right'}>Provision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sellers.slice(0, 10).map((seller, index) => (
                <TableRow 
                  key={seller.employeeId} 
                  className={tvMode 
                    ? `border-b border-border/25 ${index % 2 === 1 ? 'bg-muted/40' : ''}` 
                    : 'border-b border-border/30'
                  }
                >
                  <TableCell className={tvMode 
                    ? 'text-center text-muted-foreground font-bold text-[20px] py-[12px] tabular-nums w-[40px]' 
                    : 'py-2 text-center text-muted-foreground font-medium'
                  }>{index + 1}</TableCell>
                  <TableCell className={tvMode ? 'py-[12px]' : 'py-2'}>
                    <div className="flex items-center gap-2">
                      <Avatar className={tvMode ? 'h-8 w-8 flex-shrink-0' : 'h-8 w-8'}>
                        <AvatarImage src={seller.avatarUrl || undefined} alt={seller.employeeName} />
                        <AvatarFallback className={tvMode 
                          ? 'text-[12px] bg-primary/20 font-semibold' 
                          : 'text-xs bg-primary/20'
                        }>{getInitials(seller.employeeName)}</AvatarFallback>
                      </Avatar>
                      <span className={tvMode 
                        ? 'font-semibold text-[20px] text-foreground whitespace-nowrap overflow-hidden text-ellipsis max-w-[180px] block' 
                        : 'font-medium text-sm'
                      }>{seller.displayName}</span>
                    </div>
                  </TableCell>
                  <TableCell className={tvMode 
                    ? 'text-right py-[12px] text-primary font-bold text-[22px] tabular-nums w-[90px]' 
                    : 'text-right py-2 text-primary font-semibold'
                  }>{seller.salesCount}</TableCell>
                  <TableCell className={tvMode 
                    ? 'text-right py-[12px] font-semibold text-[20px] text-foreground tabular-nums w-[140px]' 
                    : 'text-right py-2'
                  }>
                    {tvMode ? (
                      formatCurrency(seller.commission)
                    ) : (
                      <span className="inline-block px-2 py-1 rounded text-sm font-semibold bg-primary/10 text-primary">{formatCurrency(seller.commission)}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {tvMode && sellers.length < 10 && sellers.length > 0 && (
            <p className="text-center text-muted-foreground/60 text-[14px] py-2">
              Kun {sellers.length} registrering{sellers.length !== 1 ? 'er' : ''} i denne periode
            </p>
          )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function EesyTmDashboard() {
  // Runtime access check - redirects if user doesn't have team-based permission
  const { canView, isLoading: accessLoading } = useRequireDashboardAccess("eesy-tm");
  
  const tvMode = isTvMode();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodSelection>(() => getDefaultPeriod("payroll_period"));
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

  // KPI card config - keeps data/order unchanged
  const kpiCards = [
    { label: "Salg i dag", value: salesToday, sub: format(today, "d. MMMM", { locale: da }), icon: CalendarDays },
    { label: "Salg denne uge", value: salesWeek, sub: `Uge ${format(today, "w", { locale: da })}`, icon: CalendarRange },
    { label: "Salg denne måned", value: salesMonth, sub: format(today, "MMMM", { locale: da }), icon: Calendar },
    { label: "Salg lønperiode", value: salesPayroll, sub: periodLabel, icon: Calendar },
    { label: "Salg/time (løn)", value: payrollSalesPerHour.toFixed(2), sub: `${payrollHours.toFixed(1)} timer`, icon: TrendingUp },
  ];

  return (
    <div className={tvMode 
      ? 'w-[1920px] h-[1080px] bg-background p-6 flex flex-col overflow-hidden' 
      : 'min-h-screen bg-background p-6'
    }>
      <DashboardHeader 
        title="Eesy TM – Overblik" 
        subtitle={`Dag, uge og lønperiode (${periodLabel})`}
        rightContent={
          <DashboardPeriodSelector
            selectedPeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
            disabled={tvMode}
          />
        }
      />
      <div className={tvMode ? 'space-y-5 flex-1 flex flex-col min-h-0' : 'space-y-6'}>
        {/* KPI Cards */}
        <div className={tvMode ? 'grid grid-cols-5 gap-4' : 'grid grid-cols-2 gap-4 md:grid-cols-5'}>
          {kpiCards.map((kpi) => (
            <Card key={kpi.label} className={tvMode 
              ? 'border border-border/[0.14] shadow-2xl bg-card' 
              : ''
            }>
              <CardHeader className={tvMode 
                ? 'flex flex-row items-center justify-between space-y-0 pb-0 pt-4 px-5' 
                : 'flex flex-row items-center justify-between space-y-0 pb-2'
              }>
                <CardTitle className={tvMode 
                  ? 'text-[24px] font-semibold text-muted-foreground' 
                  : 'text-sm font-medium'
                }>{kpi.label}</CardTitle>
                {!tvMode && <kpi.icon className="h-4 w-4 text-muted-foreground" />}
              </CardHeader>
              <CardContent className={tvMode ? 'px-5 pb-4' : ''}>
                <div className={tvMode 
                  ? 'text-[90px] leading-none font-extrabold text-primary' 
                  : 'text-3xl font-bold text-primary'
                } style={tvMode ? { fontVariantNumeric: 'tabular-nums' } : undefined}>{kpi.value}</div>
                <p className={tvMode 
                  ? 'text-[17px] text-muted-foreground mt-2' 
                  : 'text-xs text-muted-foreground mt-1'
                }>{kpi.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Leaderboard Tables */}
        <div className={tvMode ? 'grid grid-cols-3 gap-5 flex-1 min-h-0' : 'grid grid-cols-1 gap-6 lg:grid-cols-3'}>
          <TvLeaderboardTable 
            title="Top Løn Periode" 
            sellers={sortedPayrollSellers} 
            isLoading={isLoading} 
            tvMode={tvMode}
            employeeData={employeeData}
          />
          <TvLeaderboardTable 
            title="Top Uge" 
            sellers={sortedWeeklySellers} 
            isLoading={isLoading} 
            tvMode={tvMode}
            employeeData={employeeData}
          />
          <TvLeaderboardTable 
            title="Top Dag" 
            sellers={sortedDailySellers} 
            isLoading={isLoading} 
            tvMode={tvMode}
            employeeData={employeeData}
          />
        </div>
      </div>
    </div>
  );
}
