import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Target } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { usePrecomputedKpis, getKpiValue } from "@/hooks/usePrecomputedKpi";
import { useRequireDashboardAccess } from "@/hooks/useRequireDashboardAccess";
import { TvBoardQuickGenerator } from "@/components/dashboard/TvBoardQuickGenerator";
import { DataFreshnessBadge } from "@/components/ui/DataFreshnessBadge";
import { REFRESH_PROFILES } from "@/utils/tvMode";

// Check if we're in TV mode
const isTvMode = () => {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/tv/') ||
         window.location.pathname.startsWith('/t/') ||
         sessionStorage.getItem('tv_board_code') !== null;
};

interface TvDashboardData {
  date: string;
  timestamp: string;
  sales: {
    total: number;
    confirmed: number;
    pending: number;
    byClient: Record<string, { count: number; logoUrl: string | null }>;
    recent: any[];
  };
  employees: {
    active: number;
    staff: number;
  };
  sellersOnBoard: number;
}

export default function SalesOverviewAll() {
  const { canView, isLoading: accessLoading } = useRequireDashboardAccess("sales-overview-all");

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const tvMode = isTvMode();

  // Fetch global cached KPIs
  const { data: globalKpis } = usePrecomputedKpis(
    ["active_employees"],
    "today",
    "global"
  );

  // TV mode edge function
  const { data: tvData } = useQuery<TvDashboardData>({
    queryKey: ["tv-dashboard-data", todayStr],
    queryFn: async () => {
      const response = await supabase.functions.invoke('tv-dashboard-data', {
        body: null,
        method: 'GET',
      });
      if (response.error) throw response.error;
      return response.data;
    },
    enabled: tvMode,
    ...REFRESH_PROFILES.dashboard,
  });

  // Per-client sales from cached KPIs (updated every minute by edge function)
  const { data: cachedClientSales } = useQuery({
    queryKey: ["sales-overview-all-cached-clients", todayStr],
    queryFn: async () => {
      // Fetch all client-scoped sales_count for today
      const { data: kpiData, error } = await supabase
        .from("kpi_cached_values")
        .select("scope_id, value")
        .eq("kpi_slug", "sales_count")
        .eq("scope_type", "client")
        .eq("period_type", "today");

      if (error) throw error;

      // Fetch client logos
      const clientIds = (kpiData || []).map(k => k.scope_id).filter(Boolean) as string[];
      let clientMap: Record<string, { name: string; logo_url: string | null }> = {};

      if (clientIds.length > 0) {
        const { data: clients } = await supabase
          .from("clients")
          .select("id, name, logo_url")
          .in("id", clientIds);
        for (const c of clients || []) {
          clientMap[c.id] = { name: c.name, logo_url: c.logo_url };
        }
      }

      const byClient: Record<string, { count: number; logoUrl: string | null }> = {};
      for (const row of kpiData || []) {
        if (!row.scope_id || row.value <= 0) continue;
        const client = clientMap[row.scope_id];
        if (client) {
          byClient[client.name] = { count: row.value, logoUrl: client.logo_url };
        }
      }

      const total = Object.values(byClient).reduce((sum, c) => sum + c.count, 0);
      return { byClient, total };
    },
    enabled: !tvMode,
    ...REFRESH_PROFILES.dashboard,
  });

  const cachedActiveEmployees = getKpiValue(globalKpis?.active_employees, 0);

  const { data: activeEmployeesQuery = 0 } = useQuery({
    queryKey: ["sales-overview-all-active-employees"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("employee_master_data")
        .select("*", { count: "exact", head: true })
        .eq("is_staff_employee", false);
      if (error) throw error;
      return count || 0;
    },
    enabled: !tvMode && cachedActiveEmployees === 0,
    ...REFRESH_PROFILES.config,
  });

  const activeEmployees = cachedActiveEmployees > 0 ? cachedActiveEmployees : activeEmployeesQuery;

  const displaySalesTotal = tvMode && tvData ? tvData.sales.total : (cachedClientSales?.total || 0);
  const displaySalesByClientToday = tvMode && tvData
    ? Object.fromEntries(Object.entries(tvData.sales.byClient).filter(([k]) => k !== "Ukendt"))
    : (cachedClientSales?.byClient || {});
  const displayConfirmed = tvMode && tvData ? tvData.sales.confirmed : 0;
  const displayPending = tvMode && tvData ? tvData.sales.pending : 0;
  const displaySellersOnBoard = tvMode && tvData ? tvData.sellersOnBoard : 0;
  const displayActiveEmployees = tvMode && tvData ? tvData.employees.active : activeEmployees;

  const clientColors = [
    'from-blue-500/20 to-blue-500/5 border-blue-500/30',
    'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30',
    'from-purple-500/20 to-purple-500/5 border-purple-500/30',
    'from-orange-500/20 to-orange-500/5 border-orange-500/30',
    'from-pink-500/20 to-pink-500/5 border-pink-500/30',
    'from-cyan-500/20 to-cyan-500/5 border-cyan-500/30',
    'from-amber-500/20 to-amber-500/5 border-amber-500/30',
    'from-indigo-500/20 to-indigo-500/5 border-indigo-500/30',
  ];

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // TV mode content
  const tvContent = (
    <div className="space-y-12 animate-fade-in">
      {/* Hero Clock */}
      <div className="flex flex-col items-center justify-center pt-8 pb-4">
        <span className="text-[120px] font-extralight tabular-nums tracking-tight leading-none text-white">
          {format(now, "HH:mm:ss")}
        </span>
        <span className="text-xl font-light uppercase tracking-[0.3em] text-white/40 mt-4">
          {format(now, "EEEE d. MMMM yyyy", { locale: da })}
        </span>
      </div>

      {/* Total Sales Hero */}
      <div className="flex flex-col items-center justify-center">
        <span className="text-[96px] font-extralight tabular-nums leading-none text-white">
          {displaySalesTotal}
        </span>
        <span className="text-sm font-medium uppercase tracking-[0.4em] text-white/30 mt-3">
          Salg i dag
        </span>
      </div>

      {/* Client Grid - Glassmorphism */}
      <div className="px-8">
        {Object.keys(displaySalesByClientToday).length === 0 ? (
          <p className="text-white/30 text-center py-8 text-lg">Ingen salg registreret i dag</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {Object.entries(displaySalesByClientToday)
              .sort(([, a], [, b]) => b.count - a.count)
              .map(([client, data]) => (
                <div
                  key={client}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 animate-fade-in"
                >
                  {data.logoUrl && (
                    <div className="flex items-center justify-center rounded-xl h-16 w-32 p-3" style={{ backgroundColor: '#ffffff', colorScheme: 'light' }}>
                      <img
                        src={data.logoUrl}
                        alt={client}
                        className="object-contain max-h-full max-w-full"
                      />
                    </div>
                  )}
                  <span className="text-5xl font-light tabular-nums text-white">{data.count}</span>
                  <span className="text-sm uppercase tracking-[0.2em] text-white/40 text-center truncate w-full">
                    {client}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center gap-3 text-white/25 text-sm pt-4">
        <span className="inline-flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          LIVE
        </span>
        <span>•</span>
        <span>{format(now, "HH:mm:ss")}</span>
      </div>
    </div>
  );

  // Normal dashboard content
  const normalContent = (
    <div className="space-y-6">
      {/* Unified header with clock */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Salgsoversigt alle</h1>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground capitalize">
              {format(today, "EEEE d. MMMM yyyy", { locale: da })}
            </p>
            <DataFreshnessBadge calculatedAt={globalKpis?.active_employees?.calculated_at} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <TvBoardQuickGenerator dashboardSlug="sales-overview-all" />
          <span className="text-4xl font-semibold tabular-nums tracking-tight">
            {format(now, "HH:mm:ss")}
          </span>
        </div>
      </div>

      {/* Client grid */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-base">Salg per klient i dag</h3>
          <Badge variant="secondary" className="ml-auto">{displaySalesTotal} total</Badge>
        </div>
        {Object.keys(displaySalesByClientToday).length === 0 ? (
          <p className="text-muted-foreground text-center py-4">Ingen salg registreret i dag</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Object.entries(displaySalesByClientToday)
              .sort(([, a], [, b]) => b.count - a.count)
              .map(([client, data], index) => (
                <Card
                  key={client}
                  className={`bg-gradient-to-br ${clientColors[index % clientColors.length]} py-3`}
                >
                  <CardContent className="flex flex-col items-center justify-center p-3">
                    {data.logoUrl && (
                      <div className="flex items-center justify-center rounded-xl shadow-sm h-16 w-32 mb-3 p-2.5" style={{ backgroundColor: '#ffffff', colorScheme: 'light' }}>
                        <img
                          src={data.logoUrl}
                          alt={client}
                          className="object-contain max-h-full max-w-full"
                        />
                      </div>
                    )}
                    <span className="font-bold text-3xl">{data.count}</span>
                    <span className="text-muted-foreground text-center truncate w-full text-xs">
                      {client}
                    </span>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}
      </div>
    </div>
  );

  if (tvMode) {
    return (
      <div className="min-h-screen p-4" style={{ background: 'radial-gradient(ellipse at center, #0f1729 0%, #0a1628 70%)' }}>
        {tvContent}
      </div>
    );
  }

  return (
    <DashboardLayout>
      {normalContent}
    </DashboardLayout>
  );
}
