import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, startOfWeek } from "date-fns";
import { da } from "date-fns/locale";
import { CalendarDays, Calendar, CalendarRange } from "lucide-react";
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

interface TvTdcData {
  salesToday: number;
  salesWeek: number;
  salesMonth: number;
  sellersToday: Array<{ name: string; sales: number; commission: number; avatarUrl?: string }>;
  sellersWeek: Array<{ name: string; sales: number; commission: number; avatarUrl?: string }>;
  sellersMonth: Array<{ name: string; sales: number; commission: number; avatarUrl?: string }>;
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

const getCommissionColor = (commission: number, maxCommission: number) => {
  if (maxCommission === 0) return "bg-green-500";
  const ratio = commission / maxCommission;
  if (ratio >= 0.8) return "bg-green-500";
  if (ratio >= 0.5) return "bg-yellow-500";
  if (ratio >= 0.3) return "bg-orange-500";
  return "bg-red-500";
};

export default function TdcErhvervDashboard() {
  const tvMode = isTvMode();
  const payrollPeriod = useMemo(() => calculatePayrollPeriod(), []);

  const today = startOfDay(new Date());
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });

  // Fetch TV data from edge function (bypasses RLS for TV mode)
  const { data: tvData } = useQuery<TvTdcData>({
    queryKey: ["tv-tdc-erhverv-data"],
    queryFn: async () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/tv-dashboard-data?action=tdc-erhverv-data&dashboard=tdc-erhverv`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch TV data");
      }
      return response.json();
    },
    enabled: tvMode,
    refetchInterval: 30000,
  });

  // Fetch sales for today
  const dailySalesData = useDashboardSalesData({
    clientName: "TDC Erhverv",
    startDate: today,
    endDate: new Date(),
    enabled: !tvMode
  });

  // Fetch sales for this week
  const weeklySalesData = useDashboardSalesData({
    clientName: "TDC Erhverv",
    startDate: weekStart,
    endDate: new Date(),
    enabled: !tvMode
  });

  // Fetch sales for payroll period (lønperiode)
  const payrollSalesData = useDashboardSalesData({
    clientName: "TDC Erhverv",
    startDate: payrollPeriod.start,
    endDate: new Date(),
    enabled: !tvMode
  });

  // Fetch employee avatars
  const { data: employeeAvatars } = useQuery({
    queryKey: ["employee-avatars-tdc"],
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

  // Get max commission for color scaling
  const maxDailyCommission = Math.max(...sortedDailySellers.map(s => 
    'totalCommission' in s ? s.totalCommission : s.commission), 1);
  const maxWeeklyCommission = Math.max(...sortedWeeklySellers.map(s => 
    'totalCommission' in s ? s.totalCommission : s.commission), 1);
  const maxPayrollCommission = Math.max(...sortedPayrollSellers.map(s => 
    'totalCommission' in s ? s.totalCommission : s.commission), 1);

  return (
    <div className="min-h-screen bg-background p-6">
      <DashboardHeader 
        title="TDC Erhverv – Overblik" 
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
                            <span className={`inline-block px-2 py-1 rounded text-sm font-bold text-white ${getCommissionColor(commission, maxPayrollCommission)}`}>
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
                            <span className={`inline-block px-2 py-1 rounded text-sm font-bold text-white ${getCommissionColor(commission, maxWeeklyCommission)}`}>
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
                            <span className={`inline-block px-2 py-1 rounded text-sm font-bold text-white ${getCommissionColor(commission, maxDailyCommission)}`}>
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
