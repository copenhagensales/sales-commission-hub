import { useMemo, useState } from "react";
import { format, startOfDay } from "date-fns";
import { da } from "date-fns/locale";
import { CalendarDays, Calendar, CalendarRange, TrendingUp } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useClientDashboardKpis, getKpiValue } from "@/hooks/usePrecomputedKpi";
import { useCachedLeaderboards, type LeaderboardEntry } from "@/hooks/useCachedLeaderboard";
import { DashboardPeriodSelector, getDefaultPeriod, canUseCachedKpis, type PeriodSelection } from "@/components/dashboard/DashboardPeriodSelector";
import { useRequireDashboardAccess } from "@/hooks/useRequireDashboardAccess";
import { TvKpiCard, TvLeaderboardTable, type LeaderboardSeller } from "@/components/dashboard/TvDashboardComponents";
import { isTvMode, useAutoReload } from "@/utils/tvMode";
import { calculatePayrollPeriod } from "@/lib/calculations";
import { getDisplayName } from "@/utils/formatting";
import { useSalesAggregatesExtended } from "@/hooks/useSalesAggregatesExtended";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAggregatedClientKpis, useAggregatedClientLeaderboards } from "@/hooks/useAggregatedClientCache";

export interface ClientDashboardConfig {
  slug: string;
  /** Client ID for client-scoped dashboards */
  clientId?: string;
  /** Team ID for team-scoped dashboards (e.g. United) */
  teamId?: string;
  title: string;
  features?: {
    /** Show sales/hour KPI card (default: false) */
    salesPerHour?: boolean;
    /** Show month KPI card (default: true) */
    showMonth?: boolean;
    /** Show cross-sales in leaderboard + KPI suffixes (default: false) */
    crossSales?: boolean;
    /** Enable live-mode fallback for custom periods (default: false) */
    liveMode?: boolean;
    /**
     * If set, dashboard aggregates KPI + leaderboard cache across these client IDs
     * instead of querying a (non-existent) team-scoped cache.
     * Used by United dashboard.
     */
    aggregateClientIds?: string[];
  };
  /** Extra content rendered between KPIs and leaderboards (e.g. client breakdown) */
  extraContent?: React.ReactNode;
}

export default function ClientDashboard({ config }: { config: ClientDashboardConfig }) {
  const { canView, isLoading: accessLoading } = useRequireDashboardAccess(config.slug);

  const tvMode = isTvMode();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodSelection>(() => getDefaultPeriod("payroll_period"));
  const payrollPeriod = useMemo(() => calculatePayrollPeriod(), []);

  useAutoReload(tvMode);

  const today = startOfDay(new Date());
  const showMonth = config.features?.showMonth !== false;
  const showSalesPerHour = config.features?.salesPerHour === true;
  const showCrossSales = config.features?.crossSales === true;
  const useLiveMode = config.features?.liveMode === true;

  // Determine scope
  const aggregateClientIds = config.features?.aggregateClientIds;
  const isAggregated = !!(aggregateClientIds && aggregateClientIds.length > 0);
  const scopeType = isAggregated ? "team" : (config.teamId ? "team" : "client");
  const scopeId = config.teamId || config.clientId || null;

  // Should we use cached data or live?
  const useCached = !useLiveMode || canUseCachedKpis(selectedPeriod.type);

  // ========== CACHED KPIs (single client) ==========
  const { data: cachedKpis, isLoading: kpisLoading } = useClientDashboardKpis(
    scopeType === "client" ? scopeId : null,
    ["sales_count", "total_commission", "total_revenue", "total_hours"],
  );

  // ========== AGGREGATED KPIs (multi-client, e.g. United) ==========
  const { data: aggregatedKpis, isLoading: aggKpisLoading } = useAggregatedClientKpis(
    isAggregated ? aggregateClientIds : undefined
  );

  // ========== CACHED LEADERBOARDS ==========
  const singleScopeLeaderboards = useCachedLeaderboards(
    { type: scopeType as "client" | "team", id: scopeId },
    { enabled: useCached && !isAggregated, limit: 30 }
  );

  const aggregatedLeaderboards = useAggregatedClientLeaderboards(
    isAggregated ? aggregateClientIds : undefined,
    { enabled: useCached && isAggregated, limit: 30 }
  );

  const cachedSellersToday = isAggregated ? aggregatedLeaderboards.sellersToday : singleScopeLeaderboards.sellersToday;
  const cachedSellersWeek = isAggregated ? aggregatedLeaderboards.sellersWeek : singleScopeLeaderboards.sellersWeek;
  const cachedSellersPayroll = isAggregated ? aggregatedLeaderboards.sellersPayroll : singleScopeLeaderboards.sellersPayroll;
  const leaderboardsLoading = isAggregated ? aggregatedLeaderboards.isLoading : singleScopeLeaderboards.isLoading;

  // ========== LIVE DATA (optional, for custom periods) ==========
  const { data: liveData, isLoading: liveLoading } = useSalesAggregatesExtended({
    periodStart: selectedPeriod.from,
    periodEnd: selectedPeriod.to,
    clientId: scopeType === "client" ? (scopeId || undefined) : undefined,
    teamId: scopeType === "team" && !isAggregated ? (scopeId || undefined) : undefined,
    groupBy: ['employee'],
    enabled: useLiveMode && !useCached,
  });

  // Employee data for live mode name resolution
  const { data: employeeData } = useQuery({
    queryKey: ["employee-data-dashboard"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, avatar_url")
        .eq("is_active", true);
      const idToNameMap = new Map<string, string>();
      const idToAvatarMap = new Map<string, string | null>();
      (data || []).forEach(emp => {
        idToNameMap.set(emp.id, `${emp.first_name} ${emp.last_name}`);
        idToAvatarMap.set(emp.id, emp.avatar_url);
      });
      return { idToNameMap, idToAvatarMap };
    },
    enabled: useLiveMode && !useCached,
    staleTime: 300000,
  });

  // ========== MAP TO SELLERS ==========
  const mapToSeller = (entry: LeaderboardEntry): LeaderboardSeller => ({
    id: entry.employeeId,
    name: entry.employeeName,
    displayName: getDisplayName(entry.displayName || entry.employeeName),
    avatarUrl: entry.avatarUrl,
    salesCount: entry.salesCount,
    commission: entry.commission,
    crossSales: entry.crossSaleCount || 0,
  });

  const sortedPayrollSellers = useMemo(() => cachedSellersPayroll.map(mapToSeller), [cachedSellersPayroll]);
  const sortedWeeklySellers = useMemo(() => cachedSellersWeek.map(mapToSeller), [cachedSellersWeek]);
  const sortedDailySellers = useMemo(() => cachedSellersToday.map(mapToSeller), [cachedSellersToday]);

  // Live sellers (only used in live mode)
  const liveSellers: LeaderboardSeller[] = useMemo(() => {
    if (!liveData?.byEmployee) return [];
    return Object.entries(liveData.byEmployee)
      .map(([key, emp]) => {
        const name = employeeData?.idToNameMap?.get(key) || emp.name;
        return {
          id: key,
          name,
          displayName: getDisplayName(name),
          avatarUrl: employeeData?.idToAvatarMap?.get(key) ?? null,
          salesCount: emp.sales,
          commission: emp.commission,
        };
      })
      .sort((a, b) => b.commission - a.commission);
  }, [liveData, employeeData]);

  const isLoading = useCached ? (kpisLoading || leaderboardsLoading) : liveLoading;

  const periodLabel = `${format(payrollPeriod.start, "d. MMM", { locale: da })} - ${format(payrollPeriod.end, "d. MMM", { locale: da })}`;

  // ========== KPI VALUES ==========
  // For team-scoped dashboards, derive totals from leaderboard
  const salesToday = scopeType === "team"
    ? cachedSellersToday.reduce((s, e) => s + e.salesCount, 0)
    : getKpiValue(cachedKpis?.today?.sales_count, 0);
  const salesWeek = scopeType === "team"
    ? cachedSellersWeek.reduce((s, e) => s + e.salesCount, 0)
    : getKpiValue(cachedKpis?.this_week?.sales_count, 0);
  const salesMonth = getKpiValue(cachedKpis?.this_month?.sales_count, 0);
  const salesPayroll = scopeType === "team"
    ? cachedSellersPayroll.reduce((s, e) => s + e.salesCount, 0)
    : getKpiValue(cachedKpis?.payroll_period?.sales_count, 0);
  const payrollHours = getKpiValue(cachedKpis?.payroll_period?.total_hours, 0);
  const payrollSalesPerHour = payrollHours > 0 ? salesPayroll / payrollHours : 0;

  // Cross-sales sums
  const todaySwitch = showCrossSales
    ? cachedSellersToday.reduce((sum, s) => sum + (s.crossSaleCount || 0), 0) : 0;
  const weekSwitch = showCrossSales
    ? cachedSellersWeek.reduce((sum, s) => sum + (s.crossSaleCount || 0), 0) : 0;
  const payrollSwitch = showCrossSales
    ? cachedSellersPayroll.reduce((sum, s) => sum + (s.crossSaleCount || 0), 0) : 0;

  const switchSuffix = (count: number) =>
    count > 0 ? <span className="text-lg font-normal text-muted-foreground ml-2">(+{count} switch)</span> : null;

  // Build KPI cards
  const kpiCards: Array<{ label: string; value: string | number; sub: string; icon: any; suffix?: React.ReactNode }> = [
    { label: "Salg i dag", value: salesToday, sub: format(today, "d. MMMM", { locale: da }), icon: CalendarDays, suffix: switchSuffix(todaySwitch) },
    { label: "Salg denne uge", value: salesWeek, sub: `Uge ${format(today, "w", { locale: da })}`, icon: CalendarRange, suffix: switchSuffix(weekSwitch) },
  ];
  if (showMonth) {
    kpiCards.push({ label: "Salg denne måned", value: salesMonth, sub: format(today, "MMMM", { locale: da }), icon: Calendar });
  }
  kpiCards.push({ label: "Salg lønperiode", value: salesPayroll, sub: periodLabel, icon: Calendar, suffix: switchSuffix(payrollSwitch) });
  if (showSalesPerHour) {
    kpiCards.push({ label: "Salg/time (løn)", value: payrollSalesPerHour.toFixed(2), sub: `${payrollHours.toFixed(1)} timer`, icon: TrendingUp });
  }

  // Tailwind needs static classes – map col counts to full class strings
  const colsMap: Record<number, { tv: string; normal: string }> = {
    3: { tv: "grid grid-cols-3 gap-4", normal: "grid grid-cols-3 gap-4" },
    4: { tv: "grid grid-cols-4 gap-4", normal: "grid grid-cols-2 gap-4 md:grid-cols-4" },
    5: { tv: "grid grid-cols-5 gap-4", normal: "grid grid-cols-2 gap-4 md:grid-cols-5" },
  };
  const kpiGridClass = colsMap[kpiCards.length] || colsMap[5];
  const liveSalesCount = liveData?.totals.sales ?? 0;

  return (
    <DashboardShell>
      <div className={tvMode
        ? 'w-[1920px] h-[1080px] bg-background p-6 flex flex-col overflow-hidden'
        : ''
      }>
      <DashboardHeader
        title={config.title}
        subtitle={useCached
          ? `Dag, uge og lønperiode (${periodLabel})`
          : selectedPeriod.label
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
            <div className={tvMode ? kpiGridClass.tv : kpiGridClass.normal}>
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

            {config.extraContent}

            <div className={tvMode ? 'grid grid-cols-3 gap-5 flex-1 min-h-0' : 'grid grid-cols-1 gap-6 lg:grid-cols-3'}>
              <TvLeaderboardTable
                title="Top Løn Periode"
                sellers={sortedPayrollSellers}
                isLoading={isLoading}
                tvMode={tvMode}
                showCrossSales={showCrossSales}
                maxRows={tvMode ? 10 : undefined}
              />
              <TvLeaderboardTable
                title="Top Uge"
                sellers={sortedWeeklySellers}
                isLoading={isLoading}
                tvMode={tvMode}
                showCrossSales={showCrossSales}
                maxRows={tvMode ? 10 : undefined}
              />
              <TvLeaderboardTable
                title="Top Dag"
                sellers={sortedDailySellers}
                isLoading={isLoading}
                tvMode={tvMode}
                showCrossSales={showCrossSales}
                maxRows={tvMode ? 10 : undefined}
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
    </DashboardShell>
  );
}
