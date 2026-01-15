import { useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, startOfWeek } from "date-fns";
import { da } from "date-fns/locale";
import { CalendarDays, Calendar, CalendarRange, TrendingUp, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useDashboardSalesData } from "@/hooks/useDashboardSalesData";

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

interface TvUnitedData {
  salesToday: number;
  salesWeek: number;
  salesMonth: number;
  sellersToday: Array<{ name: string; sales: number; commission: number; avatarUrl?: string }>;
  sellersWeek: Array<{ name: string; sales: number; commission: number; avatarUrl?: string }>;
  sellersMonth: Array<{ name: string; sales: number; commission: number; avatarUrl?: string }>;
  clientSales?: Array<{ clientId: string; clientName: string; logoUrl?: string; salesToday: number; salesWeek: number; salesMonth: number }>;
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

// Get distinct color for each client
const getClientColor = (index: number) => {
  const colors = [
    "bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-amber-500", 
    "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-teal-500"
  ];
  return colors[index % colors.length];
};

export default function UnitedDashboard() {
  const tvMode = isTvMode();
  const payrollPeriod = useMemo(() => calculatePayrollPeriod(), []);
  
  // Auto-reload for TV mode to pick up layout/code changes
  useAutoReload(tvMode);

  const today = startOfDay(new Date());
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });

  // Fetch TV data from edge function (bypasses RLS for TV mode)
  const { data: tvData } = useQuery<TvUnitedData>({
    queryKey: ["tv-united-data"],
    queryFn: async () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/tv-dashboard-data?action=united-data&dashboard=united`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch TV data");
      }
      return response.json();
    },
    enabled: tvMode,
    refetchInterval: 30000,
  });

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
    enabled: !tvMode
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
    enabled: !tvMode
  });

  // Fetch sales for today - aggregated across all United clients
  const dailySalesData = useDashboardSalesData({
    teamId: unitedTeamId || undefined,
    startDate: today,
    endDate: new Date(),
    enabled: !tvMode && !!unitedTeamId
  });

  // Fetch sales for this week
  const weeklySalesData = useDashboardSalesData({
    teamId: unitedTeamId || undefined,
    startDate: weekStart,
    endDate: new Date(),
    enabled: !tvMode && !!unitedTeamId
  });

  // Fetch sales for payroll period (lønperiode)
  const payrollSalesData = useDashboardSalesData({
    teamId: unitedTeamId || undefined,
    startDate: payrollPeriod.start,
    endDate: new Date(),
    enabled: !tvMode && !!unitedTeamId
  });

  // Fetch per-client sales data with hours for sales/time calculation
  const { data: clientSalesData } = useQuery({
    queryKey: ["united-client-sales", teamClients?.map((c: any) => c.id), today.toISOString()],
    queryFn: async () => {
      if (!teamClients || teamClients.length === 0) return [];

      const results = await Promise.all(
        teamClients.map(async (client: any) => {
          // Get campaigns for this client
          const { data: campaigns } = await supabase
            .from("client_campaigns")
            .select("id")
            .eq("client_id", client.id);

          if (!campaigns || campaigns.length === 0) {
            return {
              clientId: client.id,
              clientName: client.name,
              salesToday: 0,
              salesWeek: 0,
              salesMonth: 0,
              hoursToday: 0,
              hoursWeek: 0,
              hoursMonth: 0
            };
          }

          const campaignIds = campaigns.map(c => c.id);

          // Fetch sales with proper counting and hours from timestamps
          const [todaySales, weekSales, monthSales] = await Promise.all([
            supabase
              .from("sales")
              .select("sale_items(quantity, products(counts_as_sale))")
              .in("client_campaign_id", campaignIds)
              .gte("sale_datetime", today.toISOString()),
            supabase
              .from("sales")
              .select("sale_items(quantity, products(counts_as_sale))")
              .in("client_campaign_id", campaignIds)
              .gte("sale_datetime", weekStart.toISOString()),
            supabase
              .from("sales")
              .select("sale_items(quantity, products(counts_as_sale))")
              .in("client_campaign_id", campaignIds)
              .gte("sale_datetime", payrollPeriod.start.toISOString())
          ]);

          const countSales = (data: any) => {
            if (!data.data) return 0;
            return data.data.reduce((total: number, sale: any) => {
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
            // Hours will be calculated from the aggregate data
            hoursToday: 0,
            hoursWeek: 0,
            hoursMonth: 0
          };
        })
      );

      return results.sort((a, b) => b.salesMonth - a.salesMonth);
    },
    enabled: !tvMode && !!teamClients && teamClients.length > 0
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
    enabled: !tvMode
  });

  // Sort employees by commission for each period
  const sortedDailySellers = useMemo(() => {
    if (tvMode && tvData?.sellersToday) return tvData.sellersToday;
    return [...dailySalesData.employeeStats]
      .filter(emp => emp.totalSales > 0)
      .sort((a, b) => b.totalCommission - a.totalCommission);
  }, [dailySalesData.employeeStats, tvMode, tvData]);

  const sortedWeeklySellers = useMemo(() => {
    if (tvMode && tvData?.sellersWeek) return tvData.sellersWeek;
    return [...weeklySalesData.employeeStats]
      .filter(emp => emp.totalSales > 0)
      .sort((a, b) => b.totalCommission - a.totalCommission);
  }, [weeklySalesData.employeeStats, tvMode, tvData]);

  const sortedPayrollSellers = useMemo(() => {
    if (tvMode && tvData?.sellersMonth) return tvData.sellersMonth;
    return [...payrollSalesData.employeeStats]
      .filter(emp => emp.totalSales > 0)
      .sort((a, b) => b.totalCommission - a.totalCommission);
  }, [payrollSalesData.employeeStats, tvMode, tvData]);

  const getAvatarUrl = (name: string) => {
    if (!employeeAvatars) return undefined;
    return employeeAvatars.get(name.toLowerCase());
  };

  const isLoading = dailySalesData.isLoading || weeklySalesData.isLoading || payrollSalesData.isLoading;

  const periodLabel = `${format(payrollPeriod.start, "d. MMM", { locale: da })} - ${format(payrollPeriod.end, "d. MMM", { locale: da })}`;

  // Use effective client sales (TV mode or direct query)
  const effectiveClientSales = tvMode && tvData?.clientSales ? tvData.clientSales : (clientSalesData || []);

  return (
    <div className="min-h-screen bg-background p-6">
      <DashboardHeader 
        title="United – Overblik" 
        subtitle={`Dag, uge og lønperiode (${periodLabel})`}
      />
      <div className="space-y-6">

        {/* KPI Cards - Row 1: Time-based sales */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Salg i dag</CardTitle>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {tvMode ? (tvData?.salesToday ?? 0) : dailySalesData.totalSales}
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
                {tvMode ? (tvData?.salesWeek ?? 0) : weeklySalesData.totalSales}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Uge {format(today, "w", { locale: da })}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Salg lønperiode</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {tvMode ? (tvData?.salesMonth ?? 0) : payrollSalesData.totalSales}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{periodLabel}</p>
            </CardContent>
          </Card>
        </div>


        {/* Salg per opgave (Client breakdown) */}
        {effectiveClientSales.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg font-bold">
                <Package className="h-5 w-5" />
                Salg per opgave
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {effectiveClientSales.map((client, index) => {
                  // Calculate sales per hour for each client using aggregate hours
                  const totalSales = client.salesToday + client.salesWeek + client.salesMonth;
                  const clientShare = payrollSalesData.totalSales > 0 
                    ? totalSales / (payrollSalesData.totalSales * 3)
                    : 0;
                  const estimatedHours = payrollSalesData.totalHours * clientShare;
                  const salesPerHour = estimatedHours > 0 
                    ? client.salesMonth / Math.max(estimatedHours, 1) 
                    : client.salesMonth > 0 ? client.salesMonth : 0;
                  
                  return (
                    <div 
                      key={client.clientId} 
                      className="relative rounded-lg border bg-card p-4 hover:shadow-md transition-shadow"
                    >
                      <div className={`absolute top-0 left-0 w-1 h-full rounded-l-lg ${getClientColor(index)}`} />
                      <div className="flex flex-col gap-3">
                        <h4 className="font-semibold text-sm truncate pl-2">{client.clientName}</h4>
                        
                        {/* Sales grid */}
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

                        {/* Sales per hour indicator */}
                        <div className="flex items-center justify-center gap-2 pt-2 border-t">
                          <TrendingUp className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Salg/time:</span>
                          <span className="text-sm font-semibold text-primary">
                            {client.salesMonth > 0 && payrollSalesData.totalHours > 0
                              ? (client.salesMonth / (payrollSalesData.totalHours / Math.max(effectiveClientSales.length, 1))).toFixed(2)
                              : "–"}
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

        {/* Three leaderboard columns */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          
          {/* Top Løn Periode */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-center text-lg font-bold uppercase tracking-wider">
                Top Løn Periode
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <p className="text-center text-muted-foreground py-8">Indlæser...</p>
              ) : sortedPayrollSellers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Ingen salg</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border/50">
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Medarbejder navn</TableHead>
                      <TableHead className="text-right">Salg</TableHead>
                      <TableHead className="text-right">Provision</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPayrollSellers.map((seller, index) => {
                      const name = 'employeeName' in seller ? seller.employeeName : seller.name;
                      const sales = 'totalSales' in seller ? seller.totalSales : seller.sales;
                      const commission = 'totalCommission' in seller ? seller.totalCommission : seller.commission;
                      const avatarUrl = 'avatarUrl' in seller ? seller.avatarUrl : getAvatarUrl(name);
                      
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
                              <span className="font-medium text-sm">{name}</span>
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
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Top Uge */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-center text-lg font-bold uppercase tracking-wider">
                Top Uge
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <p className="text-center text-muted-foreground py-8">Indlæser...</p>
              ) : sortedWeeklySellers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Ingen salg</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border/50">
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Medarbejder navn</TableHead>
                      <TableHead className="text-right">Salg</TableHead>
                      <TableHead className="text-right">Provision</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedWeeklySellers.map((seller, index) => {
                      const name = 'employeeName' in seller ? seller.employeeName : seller.name;
                      const sales = 'totalSales' in seller ? seller.totalSales : seller.sales;
                      const commission = 'totalCommission' in seller ? seller.totalCommission : seller.commission;
                      const avatarUrl = 'avatarUrl' in seller ? seller.avatarUrl : getAvatarUrl(name);
                      
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
                              <span className="font-medium text-sm">{name}</span>
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
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Top Dag */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-center text-lg font-bold uppercase tracking-wider">
                Top Dag
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <p className="text-center text-muted-foreground py-8">Indlæser...</p>
              ) : sortedDailySellers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Ingen salg</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border/50">
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Medarbejder navn</TableHead>
                      <TableHead className="text-right">Salg</TableHead>
                      <TableHead className="text-right">Provision</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedDailySellers.map((seller, index) => {
                      const name = 'employeeName' in seller ? seller.employeeName : seller.name;
                      const sales = 'totalSales' in seller ? seller.totalSales : seller.sales;
                      const commission = 'totalCommission' in seller ? seller.totalCommission : seller.commission;
                      const avatarUrl = 'avatarUrl' in seller ? seller.avatarUrl : getAvatarUrl(name);
                      
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
                              <span className="font-medium text-sm">{name}</span>
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
