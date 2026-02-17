import { useMemo, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { da } from "date-fns/locale";
import { CalendarDays, Calendar, CalendarRange, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatNumber } from "@/lib/calculations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { useClientDashboardKpis, getKpiValue } from "@/hooks/usePrecomputedKpi";
import { getClientId } from "@/utils/clientIds";
import { useCachedLeaderboards, LeaderboardEntry } from "@/hooks/useCachedLeaderboard";
import { DashboardPeriodSelector, getDefaultPeriod, canUseCachedKpis, type PeriodSelection } from "@/components/dashboard/DashboardPeriodSelector";
import { useRequireDashboardAccess } from "@/hooks/useRequireDashboardAccess";
import { useSalesAggregatesExtended } from "@/hooks/useSalesAggregatesExtended";
import { TvKpiCard, TvLeaderboardTable, type LeaderboardSeller } from "@/components/dashboard/TvDashboardComponents";

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

const formatCurrency = formatNumber;

const getDisplayName = (name: string) => {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  }
  return name;
};

export default function RelatelDashboard() {
  const { canView, isLoading: accessLoading } = useRequireDashboardAccess("relatel");
  
  const tvMode = isTvMode();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodSelection>(() => getDefaultPeriod("payroll_period"));
  const payrollPeriod = useMemo(() => calculatePayrollPeriod(), []);
  
  useAutoReload(tvMode);

  const today = startOfDay(new Date());

  const relatelClientId = getClientId("Relatel");

  const useCached = canUseCachedKpis(selectedPeriod.type);

  // ========== CACHED DATA ==========
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

  // Fetch employee names and avatars
  const { data: employeeData } = useQuery({
    queryKey: ["employee-data-relatel"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, avatar_url")
        .eq("is_active", true);
      
      const avatarMap = new Map<string, string>();
      const idToNameMap = new Map<string, string>();
      const idToAvatarMap = new Map<string, string | null>();
      (data || []).forEach(emp => {
        const fullName = `${emp.first_name} ${emp.last_name}`;
        if (emp.avatar_url) {
          avatarMap.set(fullName.toLowerCase(), emp.avatar_url);
        }
        idToNameMap.set(emp.id, fullName);
        idToAvatarMap.set(emp.id, emp.avatar_url);
      });
      return { avatarMap, idToNameMap, idToAvatarMap };
    },
    enabled: !tvMode
  });

  // Convert cached leaderboard entries to shared component format
  const mapToSeller = (entry: LeaderboardEntry): LeaderboardSeller => ({
    id: entry.employeeId,
    name: entry.employeeName,
    displayName: getDisplayName(entry.displayName || entry.employeeName),
    avatarUrl: entry.avatarUrl,
    salesCount: entry.salesCount,
    commission: entry.commission,
    crossSales: entry.crossSaleCount || 0,
  });

  // LIVE sellers
  const liveSellers: LeaderboardSeller[] = useMemo(() => {
    if (!liveData?.byEmployee) return [];
    const idToName = employeeData?.idToNameMap;
    const idToAvatar = employeeData?.idToAvatarMap;
    
    return Object.entries(liveData.byEmployee)
      .map(([key, emp]) => {
        const name = idToName?.get(key) || emp.name;
        return {
          id: key,
          name,
          displayName: getDisplayName(name),
          avatarUrl: idToAvatar?.get(key) ?? null,
          salesCount: emp.sales,
          commission: emp.commission,
        };
      })
      .sort((a, b) => b.commission - a.commission);
  }, [liveData, employeeData]);

  const sortedDailySellers = useMemo(() => cachedSellersToday.map(mapToSeller), [cachedSellersToday]);
  const sortedWeeklySellers = useMemo(() => cachedSellersWeek.map(mapToSeller), [cachedSellersWeek]);
  const sortedPayrollSellers = useMemo(() => cachedSellersPayroll.map(mapToSeller), [cachedSellersPayroll]);

  const isLoading = useCached 
    ? (kpisLoading || leaderboardsLoading) 
    : liveLoading;

  const periodLabel = `${format(payrollPeriod.start, "d. MMM", { locale: da })} - ${format(payrollPeriod.end, "d. MMM", { locale: da })}`;

  // ========== KPI values ==========
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

  const liveSalesCount = liveData?.totals.sales ?? 0;

  // KPI cards for cached mode
  const kpiCards = [
    { 
      label: "Salg i dag", 
      value: todaySales, 
      sub: format(today, "d. MMMM", { locale: da }), 
      icon: CalendarDays,
      suffix: todaySwitch > 0 ? <span className="text-lg font-normal text-muted-foreground ml-2">(+{todaySwitch} switch)</span> : null,
    },
    { 
      label: "Salg denne uge", 
      value: weekSales, 
      sub: `Uge ${format(today, "w", { locale: da })}`, 
      icon: CalendarRange,
      suffix: weekSwitch > 0 ? <span className="text-lg font-normal text-muted-foreground ml-2">(+{weekSwitch} switch)</span> : null,
    },
    { label: "Salg denne måned", value: monthSales, sub: format(today, "MMMM", { locale: da }), icon: Calendar },
    { 
      label: "Salg lønperiode", 
      value: payrollSales, 
      sub: periodLabel, 
      icon: Calendar,
      suffix: payrollSwitch > 0 ? <span className="text-lg font-normal text-muted-foreground ml-2">(+{payrollSwitch} switch)</span> : null,
    },
    { label: "Salg/time (løn)", value: payrollSalesPerHour.toFixed(2), sub: `${payrollHours.toFixed(1)} timer`, icon: TrendingUp },
  ];

  return (
    <div className={tvMode 
      ? 'w-[1920px] h-[1080px] bg-background p-6 flex flex-col overflow-hidden' 
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
      <div className={tvMode ? 'space-y-5 flex-1 flex flex-col min-h-0' : 'space-y-6'}>

        {/* ========== CACHED MODE ========== */}
        {useCached && (
          <>
            {/* KPI Cards */}
            <div className={tvMode ? 'grid grid-cols-5 gap-4' : 'grid grid-cols-2 gap-4 md:grid-cols-5'}>
              {kpiCards.map((kpi) => (
                <TvKpiCard
                  key={kpi.label}
                  label={kpi.label}
                  value={kpi.value}
                  sub={kpi.sub}
                  tvMode={tvMode}
                  icon={kpi.icon}
                  suffix={kpi.suffix}
                />
              ))}
            </div>

            {/* Leaderboard Tables */}
            <div className={tvMode ? 'grid grid-cols-3 gap-5 flex-1 min-h-0' : 'grid grid-cols-1 gap-6 lg:grid-cols-3'}>
              <TvLeaderboardTable 
                title="Top Løn Periode" 
                sellers={sortedPayrollSellers} 
                isLoading={isLoading} 
                tvMode={tvMode}
                showCrossSales={!tvMode}
              />
              <TvLeaderboardTable 
                title="Top Uge" 
                sellers={sortedWeeklySellers} 
                isLoading={isLoading} 
                tvMode={tvMode}
                showCrossSales={!tvMode}
              />
              <TvLeaderboardTable 
                title="Top Dag" 
                sellers={sortedDailySellers} 
                isLoading={isLoading} 
                tvMode={tvMode}
                showCrossSales={!tvMode}
              />
            </div>
          </>
        )}

        {/* ========== LIVE MODE ========== */}
        {!useCached && (
          <>
            <div className="grid grid-cols-1 gap-4 max-w-sm">
              <TvKpiCard
                label="Salg"
                value={isLoading ? "..." : liveSalesCount}
                sub={selectedPeriod.label}
                tvMode={false}
                icon={CalendarDays}
              />
            </div>

            <div className="grid grid-cols-1 gap-4">
              <TvLeaderboardTable 
                title={`Top – ${selectedPeriod.label}`}
                sellers={liveSellers} 
                isLoading={isLoading} 
                tvMode={false}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
