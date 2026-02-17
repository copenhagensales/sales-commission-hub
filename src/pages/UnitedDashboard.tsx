import { useMemo, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, startOfWeek } from "date-fns";
import { da } from "date-fns/locale";
import { CalendarDays, Calendar, CalendarRange, TrendingUp, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/utils/supabasePagination";
import { formatNumber } from "@/lib/calculations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { useCachedLeaderboards, LeaderboardEntry } from "@/hooks/useCachedLeaderboard";
import { DashboardPeriodSelector, getDefaultPeriod, type PeriodSelection } from "@/components/dashboard/DashboardPeriodSelector";
import { useRequireDashboardAccess } from "@/hooks/useRequireDashboardAccess";
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

// Get distinct color for each client
const getClientColor = (index: number) => {
  const colors = [
    "bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-amber-500", 
    "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-teal-500"
  ];
  return colors[index % colors.length];
};

const getDisplayName = (name: string) => {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  }
  return name;
};

export default function UnitedDashboard() {
  const { canView, isLoading: accessLoading } = useRequireDashboardAccess("united");
  
  const tvMode = isTvMode();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodSelection>(() => getDefaultPeriod("payroll_period"));
  const payrollPeriod = useMemo(() => calculatePayrollPeriod(), []);
  
  useAutoReload(tvMode);

  const today = startOfDay(new Date());
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });

  // Fetch United team's clients
  const { data: teamClients } = useQuery({
    queryKey: ["united-team-clients"],
    queryFn: async () => {
      const { data: team } = await supabase
        .from("teams")
        .select("id")
        .ilike("name", "%united%")
        .maybeSingle();
      
      if (!team) return [];

      const { data: clients } = await supabase
        .from("team_clients")
        .select(`
          client_id,
          clients (id, name, logo_url)
        `)
        .eq("team_id", team.id);

      return (clients || []).map((tc: any) => tc.clients).filter(Boolean);
    },
    enabled: true
  });

  // Get team ID for United
  const { data: unitedTeamId } = useQuery({
    queryKey: ["united-team-id"],
    queryFn: async () => {
      const { data: team } = await supabase
        .from("teams")
        .select("id")
        .ilike("name", "%united%")
        .maybeSingle();
      return team?.id || null;
    },
    enabled: true
  });

  // Use cached leaderboards for team-scoped data
  const { 
    sellersToday: cachedSellersToday, 
    sellersWeek: cachedSellersWeek, 
    sellersPayroll: cachedSellersPayroll,
    isLoading: leaderboardsLoading 
  } = useCachedLeaderboards(
    { type: "team", id: unitedTeamId || null },
    { enabled: !!unitedTeamId, limit: 30 }
  );

  // Fetch per-client sales data
  const { data: clientSalesData } = useQuery({
    queryKey: ["united-client-sales-v2", teamClients?.map((c: any) => c.id), today.toISOString(), payrollPeriod.start.toISOString()],
    queryFn: async () => {
      if (!teamClients || teamClients.length === 0) return [];

      const results = await Promise.all(
        teamClients.map(async (client: any) => {
          const { data: campaigns } = await supabase
            .from("client_campaigns")
            .select("id")
            .eq("client_id", client.id);

          if (!campaigns || campaigns.length === 0) {
            return { clientId: client.id, clientName: client.name, salesToday: 0, salesWeek: 0, salesMonth: 0, hoursMonth: 0 };
          }

          const campaignIds = campaigns.map(c => c.id);

          const [todaySales, weekSales, monthSales] = await Promise.all([
            supabase
              .from("sales")
              .select("sale_items(quantity, products(counts_as_sale))")
              .in("client_campaign_id", campaignIds)
              .neq("source", "fieldmarketing")
              .neq("validation_status", "rejected")
              .gte("sale_datetime", today.toISOString()),
            supabase
              .from("sales")
              .select("sale_items(quantity, products(counts_as_sale))")
              .in("client_campaign_id", campaignIds)
              .neq("source", "fieldmarketing")
              .neq("validation_status", "rejected")
              .gte("sale_datetime", weekStart.toISOString()),
            fetchAllRows<any>(
              "sales",
              "sale_items(quantity, products(counts_as_sale))",
              (q) => q.in("client_campaign_id", campaignIds)
                .neq("source", "fieldmarketing")
                .neq("validation_status", "rejected")
                .gte("sale_datetime", payrollPeriod.start.toISOString()),
              { orderBy: "sale_datetime", ascending: false }
            )
          ]);

          const countSales = (data: any) => {
            const rows = Array.isArray(data) ? data : data?.data || [];
            return rows.reduce((total: number, sale: any) => {
              const saleCount = (sale.sale_items || []).reduce((sum: number, item: any) => {
                if (item.products?.counts_as_sale !== false) {
                  return sum + (item.quantity || 1);
                }
                return sum;
              }, 0);
              return total + saleCount;
            }, 0);
          };

          return {
            clientId: client.id,
            clientName: client.name,
            salesToday: countSales(todaySales),
            salesWeek: countSales(weekSales),
            salesMonth: countSales(monthSales),
            hoursMonth: 0
          };
        })
      );

      return results.sort((a, b) => b.salesMonth - a.salesMonth);
    },
    enabled: !!teamClients && teamClients.length > 0
  });

  // Fetch actual hours per client
  const clientHoursQueries = useQuery({
    queryKey: ["united-client-hours-v2", teamClients?.map((c: any) => c.id), payrollPeriod.start.toISOString()],
    queryFn: async () => {
      if (!teamClients || teamClients.length === 0) return new Map<string, number>();

      const hoursMap = new Map<string, number>();
      
      await Promise.all(
        teamClients.map(async (client: any) => {
          const { data: campaigns } = await supabase
            .from("client_campaigns")
            .select("id")
            .eq("client_id", client.id);

          if (!campaigns || campaigns.length === 0) {
            hoursMap.set(client.id, 0);
            return;
          }

          const sales = await fetchAllRows<any>(
            "sales",
            "agent_email",
            (q) => q.in("client_campaign_id", campaigns.map(c => c.id))
              .gte("sale_datetime", payrollPeriod.start.toISOString()),
            { orderBy: "sale_datetime", ascending: false }
          );

          const agentEmails = [...new Set((sales || []).map(s => s.agent_email?.toLowerCase()).filter(Boolean))];
          
          if (agentEmails.length === 0) {
            hoursMap.set(client.id, 0);
            return;
          }

          const { data: agents } = await supabase
            .from("agents")
            .select("id, email")
            .in("email", agentEmails as string[]);

          const agentIds = (agents || []).map(a => a.id);

          if (agentIds.length === 0) {
            hoursMap.set(client.id, 0);
            return;
          }

          const { data: agentMappings } = await supabase
            .from("employee_agent_mapping")
            .select("employee_id, agent_id")
            .in("agent_id", agentIds);

          const employeeIds = [...new Set((agentMappings || []).map(m => m.employee_id))];

          if (employeeIds.length === 0) {
            hoursMap.set(client.id, 0);
            return;
          }

          const { data: shifts } = await supabase
            .from("shift")
            .select("employee_id, start_time, end_time, break_minutes")
            .in("employee_id", employeeIds)
            .gte("date", format(payrollPeriod.start, "yyyy-MM-dd"))
            .lte("date", format(new Date(), "yyyy-MM-dd"));

          let totalHours = 0;
          (shifts || []).forEach(shift => {
            if (shift.start_time && shift.end_time) {
              const start = new Date(`2000-01-01T${shift.start_time}`);
              const end = new Date(`2000-01-01T${shift.end_time}`);
              let diffMs = end.getTime() - start.getTime();
              if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000;
              let hours = diffMs / (1000 * 60 * 60);
              const breakMins = shift.break_minutes ?? (hours > 6 ? 30 : 0);
              hours -= breakMins / 60;
              totalHours += Math.max(0, hours);
            }
          });

          hoursMap.set(client.id, totalHours);
        })
      );

      return hoursMap;
    },
    enabled: !!teamClients && teamClients.length > 0
  });

  // Fetch employee avatars
  const { data: employeeAvatars } = useQuery({
    queryKey: ["employee-avatars-united"],
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
      return avatarMap;
    },
    enabled: true
  });

  // Map cached leaderboard entries to shared component format
  const mapToSeller = (entry: LeaderboardEntry): LeaderboardSeller => ({
    id: entry.employeeId,
    name: entry.employeeName,
    displayName: getDisplayName(entry.displayName || entry.employeeName),
    avatarUrl: entry.avatarUrl || undefined,
    salesCount: entry.salesCount,
    commission: entry.commission,
  });

  const sortedDailySellers = useMemo(() => cachedSellersToday.map(mapToSeller), [cachedSellersToday]);
  const sortedWeeklySellers = useMemo(() => cachedSellersWeek.map(mapToSeller), [cachedSellersWeek]);
  const sortedPayrollSellers = useMemo(() => cachedSellersPayroll.map(mapToSeller), [cachedSellersPayroll]);

  const getAvatarUrl = (name: string) => {
    if (!employeeAvatars) return undefined;
    return employeeAvatars.get(name.toLowerCase());
  };

  const isLoading = leaderboardsLoading;

  const totalSalesToday = cachedSellersToday.reduce((sum, s) => sum + s.salesCount, 0);
  const totalSalesWeek = cachedSellersWeek.reduce((sum, s) => sum + s.salesCount, 0);
  const totalSalesPayroll = cachedSellersPayroll.reduce((sum, s) => sum + s.salesCount, 0);

  const periodLabel = `${format(payrollPeriod.start, "d. MMM", { locale: da })} - ${format(payrollPeriod.end, "d. MMM", { locale: da })}`;

  const effectiveClientSales = clientSalesData || [];

  const kpiCards = [
    { label: "Salg i dag", value: totalSalesToday, sub: format(today, "d. MMMM", { locale: da }), icon: CalendarDays },
    { label: "Salg denne uge", value: totalSalesWeek, sub: `Uge ${format(today, "w", { locale: da })}`, icon: CalendarRange },
    { label: "Salg lønperiode", value: totalSalesPayroll, sub: periodLabel, icon: Calendar },
  ];

  return (
    <div className={tvMode 
      ? 'w-[1920px] h-[1080px] bg-background p-6 flex flex-col overflow-hidden' 
      : 'min-h-screen bg-background p-6'
    }>
      <DashboardHeader 
        title="United – Overblik" 
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
        <div className={tvMode ? 'grid grid-cols-3 gap-4' : 'grid grid-cols-3 gap-4'}>
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

        {/* Salg per opgave (Client breakdown) - hide in TV mode for cleaner layout */}
        {!tvMode && effectiveClientSales.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg font-bold">
                <Package className="h-5 w-5" />
                Salg per opgave
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {effectiveClientSales
                  .filter(client => client.salesWeek > 0)
                  .map((client, index) => {
                    const clientHours = clientHoursQueries.data?.get(client.clientId) || 0;
                    const salesPerHour = clientHours > 0 ? client.salesMonth / clientHours : 0;
                    
                    return (
                      <div 
                        key={client.clientId} 
                        className="relative rounded-lg border bg-card p-4 hover:shadow-md transition-shadow"
                      >
                        <div className={`absolute top-0 left-0 w-1 h-full rounded-l-lg ${getClientColor(index)}`} />
                        <div className="flex flex-col gap-3">
                          <h4 className="font-semibold text-sm truncate pl-2">{client.clientName}</h4>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="text-center">
                              <p className="text-muted-foreground">Dag</p>
                              <p className="font-bold text-primary text-lg">{client.salesToday}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-muted-foreground">Uge</p>
                              <p className="font-bold text-primary text-lg">{client.salesWeek}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-muted-foreground">Løn</p>
                              <p className="font-bold text-primary text-lg">{client.salesMonth}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-center gap-2 pt-2 border-t">
                            <TrendingUp className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Salg/time:</span>
                            <span className="text-sm font-semibold text-primary">
                              {salesPerHour > 0 ? salesPerHour.toFixed(2) : "–"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        )}

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
