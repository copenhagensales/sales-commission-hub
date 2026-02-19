import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { da } from "date-fns/locale";
import { CalendarDays, Calendar, CalendarRange, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { useClientDashboardKpis, getKpiValue } from "@/hooks/usePrecomputedKpi";
import { getClientId } from "@/utils/clientIds";
import { useCachedLeaderboards, LeaderboardEntry } from "@/hooks/useCachedLeaderboard";
import { DashboardPeriodSelector, getDefaultPeriod, type PeriodSelection } from "@/components/dashboard/DashboardPeriodSelector";
import { useRequireDashboardAccess } from "@/hooks/useRequireDashboardAccess";
import { TvKpiCard, TvLeaderboardTable, type LeaderboardSeller } from "@/components/dashboard/TvDashboardComponents";
import { isTvMode, useAutoReload } from "@/utils/tvMode";
import { calculatePayrollPeriod } from "@/utils/payrollPeriod";
import { getDisplayName } from "@/utils/formatting";

export default function TdcErhvervDashboard() {
  const { canView, isLoading: accessLoading } = useRequireDashboardAccess("tdc-erhverv");
  
  const tvMode = isTvMode();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodSelection>(() => getDefaultPeriod("payroll_period"));
  const payrollPeriod = useMemo(() => calculatePayrollPeriod(), []);
  
  useAutoReload(tvMode);

  const today = startOfDay(new Date());

  const tdcClientId = getClientId("TDC Erhverv");

  const { data: cachedKpis, isLoading: kpisLoading } = useClientDashboardKpis(
    tdcClientId || null,
    ["sales_count", "total_commission", "total_revenue", "total_hours"]
  );

  const { 
    sellersToday: cachedSellersToday, 
    sellersWeek: cachedSellersWeek, 
    sellersPayroll: cachedSellersPayroll,
    isLoading: leaderboardsLoading 
  } = useCachedLeaderboards(
    { type: "client", id: tdcClientId || null },
    { enabled: true, limit: 30 }
  );

  // Fetch employee avatars
  const { data: employeeData } = useQuery({
    queryKey: ["employee-data-tdc"],
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

  // Convert cached leaderboard entries to shared component format
  const mapToSeller = (entry: LeaderboardEntry): LeaderboardSeller => ({
    id: entry.employeeId,
    name: entry.employeeName,
    displayName: getDisplayName(entry.displayName || entry.employeeName),
    avatarUrl: entry.avatarUrl,
    salesCount: entry.salesCount,
    commission: entry.commission,
  });

  const sortedDailySellers = useMemo(() => cachedSellersToday.map(mapToSeller), [cachedSellersToday]);
  const sortedWeeklySellers = useMemo(() => cachedSellersWeek.map(mapToSeller), [cachedSellersWeek]);
  const sortedPayrollSellers = useMemo(() => cachedSellersPayroll.map(mapToSeller), [cachedSellersPayroll]);

  const isLoading = kpisLoading || leaderboardsLoading;

  const periodLabel = `${format(payrollPeriod.start, "d. MMM", { locale: da })} - ${format(payrollPeriod.end, "d. MMM", { locale: da })}`;

  const todaySales = getKpiValue(cachedKpis?.today?.sales_count, 0);
  const weekSales = getKpiValue(cachedKpis?.this_week?.sales_count, 0);
  const monthSales = getKpiValue(cachedKpis?.this_month?.sales_count, 0);
  const payrollSales = getKpiValue(cachedKpis?.payroll_period?.sales_count, 0);
  const payrollHours = getKpiValue(cachedKpis?.payroll_period?.total_hours, 0);
  const payrollSalesPerHour = payrollHours > 0 ? payrollSales / payrollHours : 0;

  const kpiCards = [
    { label: "Salg i dag", value: todaySales, sub: format(today, "d. MMMM", { locale: da }), icon: CalendarDays },
    { label: "Salg denne uge", value: weekSales, sub: `Uge ${format(today, "w", { locale: da })}`, icon: CalendarRange },
    { label: "Salg denne måned", value: monthSales, sub: format(today, "MMMM", { locale: da }), icon: Calendar },
    { label: "Salg lønperiode", value: payrollSales, sub: periodLabel, icon: Calendar },
    { label: "Salg/time (løn)", value: payrollSalesPerHour.toFixed(2), sub: `${payrollHours.toFixed(1)} timer`, icon: TrendingUp },
  ];

  return (
    <div className={tvMode 
      ? 'w-[1920px] h-[1080px] bg-background p-6 flex flex-col overflow-hidden' 
      : 'min-h-screen bg-background p-6'
    }>
      <DashboardHeader 
        title="TDC Erhverv – Overblik" 
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
            <TvKpiCard
              key={kpi.label}
              label={kpi.label}
              value={kpi.value}
              sub={kpi.sub}
              tvMode={tvMode}
              icon={kpi.icon}
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
          />
          <TvLeaderboardTable 
            title="Top Uge" 
            sellers={sortedWeeklySellers} 
            isLoading={isLoading} 
            tvMode={tvMode}
          />
          <TvLeaderboardTable 
            title="Top Dag" 
            sellers={sortedDailySellers} 
            isLoading={isLoading} 
            tvMode={tvMode}
          />
        </div>
      </div>
    </div>
  );
}
