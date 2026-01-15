import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, addDays, isWeekend } from "date-fns";
import { da } from "date-fns/locale";
import { Users, Package, DollarSign, ShoppingCart, Trophy, Clock, TrendingUp, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardDateRangePicker } from "@/components/dashboard/DashboardDateRangePicker";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DateRange } from "react-day-picker";
import { useDashboardSalesData } from "@/hooks/useDashboardSalesData";

const EESY_TM_TEAM_ID = "53bb1f37-e08e-42b2-9f71-ab7b69495e55"; // Eesy TM team ID

interface ProductStat {
  name: string;
  quantity: number;
  revenue: number;
  commission: number;
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

// Calculate working days in range (excludes weekends)
function getWorkingDaysInRange(start: Date, end: Date): number {
  let count = 0;
  let current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(23, 59, 59, 999);
  
  while (current <= endDate) {
    if (!isWeekend(current)) {
      count++;
    }
    current = addDays(current, 1);
  }
  return count;
}

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('da-DK', { style: 'decimal', maximumFractionDigits: 0 }).format(value) + ' kr';

const getInitials = (name: string) => {
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const getMedal = (rank: number) => {
  switch (rank) {
    case 1: return "🥇";
    case 2: return "🥈";
    case 3: return "🥉";
    default: return null;
  }
};

export default function EesyTmDashboard() {
  const payrollPeriod = useMemo(() => calculatePayrollPeriod(), []);
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(new Date()),
    to: new Date()
  });

  // Use the unified dashboard sales data hook
  const dashboardData = useDashboardSalesData({
    clientName: "Eesy",
    startDate: dateRange?.from || payrollPeriod.start,
    endDate: dateRange?.to || new Date(),
    enabled: !!dateRange?.from
  });

  // Fetch team goal for payroll period
  const periodStartStr = format(payrollPeriod.start, "yyyy-MM-dd");
  const periodEndStr = format(payrollPeriod.end, "yyyy-MM-dd");

  const { data: teamGoal } = useQuery({
    queryKey: ["team-sales-goal-eesy-tm", EESY_TM_TEAM_ID, periodStartStr, periodEndStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("team_sales_goals")
        .select("id, target_amount")
        .eq("team_id", EESY_TM_TEAM_ID)
        .eq("period_start", periodStartStr)
        .eq("period_end", periodEndStr)
        .maybeSingle();
      return data;
    },
  });

  // Fetch product stats for the selected date range
  const { data: productData, isLoading: productsLoading } = useQuery({
    queryKey: ["eesy-tm-products", dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      if (!dateRange?.from) return [];
      
      const rangeStart = startOfDay(dateRange.from);
      const rangeEnd = dateRange.to ? new Date(startOfDay(dateRange.to)) : new Date(rangeStart);
      rangeEnd.setDate(rangeEnd.getDate() + 1);

      const { data: clients } = await supabase
        .from("clients")
        .select("id")
        .ilike("name", "%eesy%")
        .limit(1);

      const eesyClientId = clients?.[0]?.id;
      if (!eesyClientId) return [];

      const { data: campaigns } = await supabase
        .from("client_campaigns")
        .select("id")
        .eq("client_id", eesyClientId);

      const campaignIds = (campaigns || []).map(c => c.id);
      if (campaignIds.length === 0) return [];

      const { data: sales } = await supabase
        .from("sales")
        .select(`
          sale_items (
            quantity,
            mapped_commission,
            products (name, counts_as_sale)
          )
        `)
        .in("client_campaign_id", campaignIds)
        .gte("sale_datetime", rangeStart.toISOString())
        .lt("sale_datetime", rangeEnd.toISOString());

      const productMap = new Map<string, ProductStat>();
      
      (sales || []).forEach((sale: any) => {
        (sale.sale_items || []).forEach((item: any) => {
          const product = item.products;
          if (product?.counts_as_sale === false) return;
          
          const qty = Number(item.quantity) || 1;
          const commission = Number(item.mapped_commission) || 0;
          const productName = product?.name || "Ukendt produkt";
          
          const existing = productMap.get(productName) || { name: productName, quantity: 0, revenue: 0, commission: 0 };
          existing.quantity += qty;
          existing.commission += commission;
          productMap.set(productName, existing);
        });
      });

      return Array.from(productMap.values()).sort((a, b) => b.quantity - a.quantity);
    },
    enabled: !!dateRange?.from
  });

  // Calculate team progress metrics
  const teamProgress = useMemo(() => {
    const targetAmount = teamGoal?.target_amount || 0;
    const achieved = dashboardData.totalCommission;
    const progressPercent = targetAmount > 0 ? (achieved / targetAmount) * 100 : 0;

    const today = new Date();
    const totalWorkingDays = getWorkingDaysInRange(payrollPeriod.start, payrollPeriod.end);
    const elapsedWorkingDays = getWorkingDaysInRange(payrollPeriod.start, today > payrollPeriod.end ? payrollPeriod.end : today);
    
    const expectedProgress = totalWorkingDays > 0 ? (elapsedWorkingDays / totalWorkingDays) * 100 : 0;
    const expectedAmount = targetAmount * (expectedProgress / 100);
    const vsExpected = expectedAmount > 0 ? ((achieved - expectedAmount) / expectedAmount) * 100 : 0;

    return {
      targetAmount,
      achieved,
      progressPercent: Math.min(progressPercent, 100),
      expectedProgress,
      expectedAmount,
      vsExpected,
      isAhead: achieved >= expectedAmount,
      elapsedWorkingDays,
      totalWorkingDays
    };
  }, [teamGoal, dashboardData.totalCommission, payrollPeriod]);

  // Sort employees by commission for leaderboard
  const sortedEmployees = useMemo(() => {
    return [...dashboardData.employeeStats].sort((a, b) => b.totalCommission - a.totalCommission);
  }, [dashboardData.employeeStats]);

  const topSellers = sortedEmployees.slice(0, 5);

  // Calculate averages
  const avgSalesPerHour = dashboardData.totalHours > 0 
    ? (dashboardData.totalSales / dashboardData.totalHours).toFixed(2) 
    : "0";

  const getSubtitle = () => {
    if (!dateRange?.from) return "Baseret på produkt-mapping fra MG Test";
    const isSingleDay = !dateRange.to || startOfDay(dateRange.from).getTime() === startOfDay(dateRange.to).getTime();
    if (isSingleDay) {
      const isToday = startOfDay(dateRange.from).getTime() === startOfDay(new Date()).getTime();
      return `Salg for ${isToday ? "i dag" : format(dateRange.from, "d. MMMM yyyy", { locale: da })} • Baseret på produkt-mapping fra MG Test`;
    }
    return `Salg fra ${format(dateRange.from, "d. MMM", { locale: da })} til ${format(dateRange.to!, "d. MMM yyyy", { locale: da })} • Baseret på produkt-mapping fra MG Test`;
  };

  const periodLabel = `${format(payrollPeriod.start, "d. MMM", { locale: da })} - ${format(payrollPeriod.end, "d. MMM yyyy", { locale: da })}`;

  const datePickerContent = (
    <DashboardDateRangePicker 
      dateRange={dateRange} 
      onDateRangeChange={setDateRange} 
    />
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <DashboardHeader 
        title="Eesy TM – Overblik" 
        subtitle={getSubtitle()}
        rightContent={datePickerContent}
      />
      <div className="space-y-6">

        {/* Team Progress Hero */}
        {teamProgress.targetAmount > 0 && (
          <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
            <CardContent className="pt-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium text-muted-foreground">Team Fremskridt</span>
                    <Badge variant="outline" className="text-xs">{periodLabel}</Badge>
                  </div>
                  
                  <div className="flex items-baseline gap-3 mb-4">
                    <span className="text-4xl font-bold text-primary">
                      {teamProgress.progressPercent.toFixed(0)}%
                    </span>
                    <span className="text-muted-foreground">
                      {formatCurrency(teamProgress.achieved)} af {formatCurrency(teamProgress.targetAmount)}
                    </span>
                  </div>
                  
                  <Progress value={teamProgress.progressPercent} className="h-3 mb-4" />
                  
                  <div className="flex items-center gap-4 text-sm">
                    <div className={`flex items-center gap-1 ${teamProgress.isAhead ? 'text-green-600' : 'text-red-500'}`}>
                      <TrendingUp className={`h-4 w-4 ${!teamProgress.isAhead && 'rotate-180'}`} />
                      <span className="font-medium">
                        {teamProgress.isAhead ? '+' : ''}{teamProgress.vsExpected.toFixed(0)}% vs. forventet
                      </span>
                    </div>
                    <span className="text-muted-foreground">
                      Dag {teamProgress.elapsedWorkingDays} af {teamProgress.totalWorkingDays}
                    </span>
                  </div>
                </div>
                
                <div className="lg:text-right">
                  <div className="text-sm text-muted-foreground mb-1">Forventet nu</div>
                  <div className="text-xl font-semibold">{formatCurrency(teamProgress.expectedAmount)}</div>
                  <div className={`text-sm ${teamProgress.isAhead ? 'text-green-600' : 'text-red-500'}`}>
                    {teamProgress.isAhead ? '↑ Foran' : '↓ Bagud'} med {formatCurrency(Math.abs(teamProgress.achieved - teamProgress.expectedAmount))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Antal salg</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{dashboardData.totalSales}</div>
              <p className="text-xs text-muted-foreground mt-1">I valgt periode</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Provision</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(dashboardData.totalCommission)}</div>
              <p className="text-xs text-muted-foreground mt-1">Fra mappede produkter</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Timer</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{dashboardData.totalHours.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground mt-1">Totale arbejdstimer</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Salg/time</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{avgSalesPerHour}</div>
              <p className="text-xs text-muted-foreground mt-1">Effektivitet</p>
            </CardContent>
          </Card>
        </div>

        {/* Top Sellers Leaderboard */}
        {topSellers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Top Sælgere
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {topSellers.map((seller, index) => {
                  const rank = index + 1;
                  const medal = getMedal(rank);
                  const salesPerHour = seller.totalHours > 0 
                    ? (seller.totalSales / seller.totalHours).toFixed(2) 
                    : "0";
                  
                  return (
                    <div 
                      key={seller.employeeId} 
                      className={`flex items-center gap-4 p-3 rounded-lg ${
                        rank <= 3 ? 'bg-gradient-to-r from-primary/10 to-transparent' : 'bg-muted/50'
                      }`}
                    >
                      <div className="w-8 text-center">
                        {medal || <span className="text-muted-foreground font-medium">{rank}</span>}
                      </div>
                      
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className={rank <= 3 ? 'bg-primary/20 text-primary font-semibold' : ''}>
                          {getInitials(seller.employeeName)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <Link 
                          to={`/my-goals/${seller.employeeId}`}
                          className="font-medium hover:text-primary transition-colors truncate block"
                        >
                          {seller.employeeName}
                        </Link>
                      </div>
                      
                      <div className="hidden sm:flex items-center gap-6 text-sm">
                        <div className="text-center">
                          <div className="font-semibold">{seller.totalSales}</div>
                          <div className="text-muted-foreground text-xs">salg</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold">{seller.totalHours.toFixed(1)}t</div>
                          <div className="text-muted-foreground text-xs">timer</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold">{salesPerHour}</div>
                          <div className="text-muted-foreground text-xs">salg/t</div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="font-bold text-primary">{formatCurrency(seller.totalCommission)}</div>
                        <div className="text-xs text-muted-foreground sm:hidden">{seller.totalSales} salg</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Full Sales Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Alle sælgere
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboardData.isLoading ? (
                <p className="text-center text-muted-foreground py-8">Indlæser...</p>
              ) : sortedEmployees.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Ingen salg registreret i perioden</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sælger</TableHead>
                      <TableHead className="text-right">Salg</TableHead>
                      <TableHead className="text-right">Timer</TableHead>
                      <TableHead className="text-right">Provision</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedEmployees.map((seller) => (
                      <TableRow key={seller.employeeId}>
                        <TableCell className="font-medium">
                          <Link 
                            to={`/my-goals/${seller.employeeId}`}
                            className="hover:text-primary transition-colors"
                          >
                            {seller.employeeName}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right">{seller.totalSales}</TableCell>
                        <TableCell className="text-right">{seller.totalHours.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(seller.totalCommission)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Product Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Produkter solgt
              </CardTitle>
            </CardHeader>
            <CardContent>
              {productsLoading ? (
                <p className="text-center text-muted-foreground py-8">Indlæser...</p>
              ) : !productData || productData.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Ingen produkter solgt i perioden</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produkt</TableHead>
                      <TableHead className="text-right">Antal</TableHead>
                      <TableHead className="text-right">Provision</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productData.map((product) => (
                      <TableRow key={product.name}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell className="text-right">{product.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(product.commission)}</TableCell>
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
