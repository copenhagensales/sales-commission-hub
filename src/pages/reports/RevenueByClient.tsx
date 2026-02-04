import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, parseISO, startOfDay, endOfDay } from "date-fns";
import { da } from "date-fns/locale";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, Loader2, CalendarIcon, Building2, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

// Hard-coded whitelist - ONLY these users can access this report
const ALLOWED_EMAILS = ["km@copenhagensales.dk", "mg@copenhagensales.dk"];

type PeriodType = "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "custom";

interface ClientRevenueData {
  clientId: string;
  clientName: string;
  salesCount: number;
  totalRevenue: number;
  totalCommission: number;
  totalVacationPay: number;
  totalEarnings: number;
  avgRevenue: number;
}

interface ClientPieData {
  name: string;
  value: number;
}

export default function RevenueByClient() {
  const { user, loading: authLoading } = useAuth();
  const [period, setPeriod] = useState<PeriodType>("today");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [deductionPercents, setDeductionPercents] = useState<Record<string, number>>({});
  const [cancellationPercents, setCancellationPercents] = useState<Record<string, number>>({});

  // Hard-coded access control
  const userEmail = user?.email?.toLowerCase() || "";
  const hasAccess = ALLOWED_EMAILS.includes(userEmail);

  // Calculate date range based on period selection
  const { startDate, endDate } = useMemo(() => {
    const today = new Date();
    
    switch (period) {
      case "today":
        return { startDate: startOfDay(today), endDate: endOfDay(today) };
      case "yesterday":
        const yesterday = subDays(today, 1);
        return { startDate: startOfDay(yesterday), endDate: endOfDay(yesterday) };
      case "this_week":
        return { startDate: startOfWeek(today, { weekStartsOn: 1 }), endDate: endOfDay(today) };
      case "last_week":
        const lastWeekStart = startOfWeek(subDays(today, 7), { weekStartsOn: 1 });
        const lastWeekEnd = endOfWeek(subDays(today, 7), { weekStartsOn: 1 });
        return { startDate: lastWeekStart, endDate: lastWeekEnd };
      case "this_month":
        return { startDate: startOfMonth(today), endDate: endOfDay(today) };
      case "custom":
        return { 
          startDate: customStartDate ? startOfDay(customStartDate) : startOfDay(today), 
          endDate: customEndDate ? endOfDay(customEndDate) : endOfDay(today) 
        };
      default:
        return { startDate: startOfDay(today), endDate: endOfDay(today) };
    }
  }, [period, customStartDate, customEndDate]);

  const startDateStr = format(startDate, "yyyy-MM-dd");
  const endDateStr = format(endDate, "yyyy-MM-dd");

  // Fetch clients for filter dropdown
  const { data: clients } = useQuery({
    queryKey: ["revenue-by-client-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch revenue data
  const { data: revenueData, isLoading } = useQuery({
    queryKey: ["revenue-by-client", startDateStr, endDateStr, selectedClientId],
    queryFn: async () => {
      // Get TM sales with client info
      let salesData: any[] = [];
      let page = 0;
      const pageSize = 1000;
      
      while (true) {
        const { data: salesPage, error } = await supabase
          .from("sales")
          .select(`
            id, 
            sale_datetime, 
            client_campaign_id,
            client_campaigns(client_id, clients(id, name)),
            dialer_campaign_id
          `)
          .gte("sale_datetime", `${startDateStr}T00:00:00`)
          .lte("sale_datetime", `${endDateStr}T23:59:59`)
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) throw error;
        if (!salesPage || salesPage.length === 0) break;
        salesData = [...salesData, ...salesPage];
        if (salesPage.length < pageSize) break;
        page++;
      }

      // Get sale_items with revenue
      const saleIds = salesData.map((s) => s.id);
      let saleItems: any[] = [];
      const BATCH_SIZE = 500;
      
      for (let i = 0; i < saleIds.length; i += BATCH_SIZE) {
        const batchIds = saleIds.slice(i, i + BATCH_SIZE);
        const { data: batchItems } = await supabase
          .from("sale_items")
          .select("sale_id, mapped_revenue, mapped_commission, product_id")
          .in("sale_id", batchIds);
        if (batchItems) {
          saleItems = [...saleItems, ...batchItems];
        }
      }

      // Get campaign mappings for overrides
      const { data: campaignMappings } = await supabase
        .from("adversus_campaign_mappings")
        .select("adversus_campaign_id, id");
      
      const campaignIdToMappingId = new Map<string, string>();
      campaignMappings?.forEach((m) => {
        campaignIdToMappingId.set(m.adversus_campaign_id, m.id);
      });

      // Get product campaign overrides (for both revenue and commission)
      const { data: productCampaignOverrides } = await supabase
        .from("product_campaign_overrides")
        .select("product_id, campaign_mapping_id, revenue_dkk, commission_dkk");
      
      const revenueOverrideMap = new Map<string, number>();
      const commissionOverrideMap = new Map<string, number>();
      productCampaignOverrides?.forEach((o) => {
        const key = `${o.product_id}_${o.campaign_mapping_id}`;
        if (o.revenue_dkk !== null) revenueOverrideMap.set(key, o.revenue_dkk);
        if (o.commission_dkk !== null) commissionOverrideMap.set(key, o.commission_dkk);
      });

      // Map sale_items to sales
      const saleItemsBySaleId: Record<string, any[]> = {};
      saleItems.forEach((si) => {
        if (!saleItemsBySaleId[si.sale_id]) saleItemsBySaleId[si.sale_id] = [];
        saleItemsBySaleId[si.sale_id].push(si);
      });

      // Get FM sales
      const { data: fmSales } = await supabase
        .from("fieldmarketing_sales")
        .select("id, registered_at, product_name, client_id, clients(id, name)")
        .gte("registered_at", `${startDateStr}T00:00:00`)
        .lte("registered_at", `${endDateStr}T23:59:59`);

      // Get products for FM revenue and commission lookup
      const { data: products } = await supabase
        .from("products")
        .select("name, revenue_dkk, commission_dkk");
      
      const productRevenueMap = new Map<string, number>();
      const productCommissionMap = new Map<string, number>();
      products?.forEach((p) => {
        const lowerName = p.name.toLowerCase();
        productRevenueMap.set(lowerName, p.revenue_dkk ?? 0);
        productCommissionMap.set(lowerName, p.commission_dkk ?? 0);
      });

      // Aggregate per client and date (now includes commission)
      const revenueByClientAndDate: Record<string, Record<string, { count: number; revenue: number; commission: number }>> = {};
      const clientNames: Record<string, string> = {};

      // Process TM sales
      salesData.forEach((sale) => {
        const clientId = sale.client_campaigns?.clients?.id;
        const clientName = sale.client_campaigns?.clients?.name || "Ukendt";
        if (!clientId) return;
        
        // Apply client filter
        if (selectedClientId !== "all" && clientId !== selectedClientId) return;

        clientNames[clientId] = clientName;
        const saleDate = format(parseISO(sale.sale_datetime), "yyyy-MM-dd");
        const items = saleItemsBySaleId[sale.id] || [];
        const campaignMappingId = sale.dialer_campaign_id 
          ? campaignIdToMappingId.get(sale.dialer_campaign_id) 
          : null;
        
        let saleRevenue = 0;
        let saleCommission = 0;
        items.forEach((item) => {
          const overrideKey = campaignMappingId ? `${item.product_id}_${campaignMappingId}` : null;
          const revenueOverride = overrideKey ? revenueOverrideMap.get(overrideKey) : undefined;
          const commissionOverride = overrideKey ? commissionOverrideMap.get(overrideKey) : undefined;
          
          if (revenueOverride !== undefined) {
            saleRevenue += revenueOverride;
          } else {
            saleRevenue += Number(item.mapped_revenue) || 0;
          }
          
          if (commissionOverride !== undefined) {
            saleCommission += commissionOverride;
          } else {
            saleCommission += Number(item.mapped_commission) || 0;
          }
        });

        if (!revenueByClientAndDate[clientId]) revenueByClientAndDate[clientId] = {};
        if (!revenueByClientAndDate[clientId][saleDate]) {
          revenueByClientAndDate[clientId][saleDate] = { count: 0, revenue: 0, commission: 0 };
        }
        revenueByClientAndDate[clientId][saleDate].count += 1;
        revenueByClientAndDate[clientId][saleDate].revenue += saleRevenue;
        revenueByClientAndDate[clientId][saleDate].commission += saleCommission;
      });

      // Process FM sales
      fmSales?.forEach((sale) => {
        const clientId = sale.client_id;
        const clientName = (sale.clients as any)?.name || "Ukendt FM";
        if (!clientId) return;
        
        // Apply client filter
        if (selectedClientId !== "all" && clientId !== selectedClientId) return;

        clientNames[clientId] = clientName;
        const saleDate = format(parseISO(sale.registered_at), "yyyy-MM-dd");
        const productName = (sale.product_name || "").toLowerCase();
        const revenue = productRevenueMap.get(productName) || 0;
        const commission = productCommissionMap.get(productName) || 0;

        if (!revenueByClientAndDate[clientId]) revenueByClientAndDate[clientId] = {};
        if (!revenueByClientAndDate[clientId][saleDate]) {
          revenueByClientAndDate[clientId][saleDate] = { count: 0, revenue: 0, commission: 0 };
        }
        revenueByClientAndDate[clientId][saleDate].count += 1;
        revenueByClientAndDate[clientId][saleDate].revenue += revenue;
        revenueByClientAndDate[clientId][saleDate].commission += commission;
      });

      return { revenueByClientAndDate, clientNames };
    },
    refetchInterval: 60000,
  });

  // Calculate aggregated data per client
  const clientSummary: ClientRevenueData[] = useMemo(() => {
    if (!revenueData) return [];
    
    const { revenueByClientAndDate, clientNames } = revenueData;
    const summary: ClientRevenueData[] = [];

    Object.entries(revenueByClientAndDate).forEach(([clientId, dates]) => {
      let totalSales = 0;
      let totalRevenue = 0;
      let totalCommission = 0;

      Object.values(dates).forEach(({ count, revenue, commission }) => {
        totalSales += count;
        totalRevenue += revenue;
        totalCommission += commission;
      });

      const totalVacationPay = totalCommission * 0.125;
      const totalEarnings = totalRevenue - totalCommission - totalVacationPay;

      summary.push({
        clientId,
        clientName: clientNames[clientId] || "Ukendt",
        salesCount: totalSales,
        totalRevenue,
        totalCommission,
        totalVacationPay,
        totalEarnings,
        avgRevenue: totalSales > 0 ? totalRevenue / totalSales : 0,
      });
    });

    return summary.sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [revenueData]);

  // Calculate totals
  const totalRevenue = useMemo(() => {
    return clientSummary.reduce((sum, c) => sum + c.totalRevenue, 0);
  }, [clientSummary]);

  const totalEarnings = useMemo(() => {
    return clientSummary.reduce((sum, c) => sum + c.totalEarnings, 0);
  }, [clientSummary]);

  // Build pie chart data - total revenue per client
  const pieChartData: ClientPieData[] = useMemo(() => {
    return clientSummary.map((client) => ({
      name: client.clientName,
      value: client.totalRevenue,
    }));
  }, [clientSummary]);


  // Chart colors
  const CHART_COLORS = [
    "hsl(142, 71%, 45%)", // emerald
    "hsl(217, 91%, 60%)", // blue
    "hsl(262, 83%, 58%)", // purple
    "hsl(24, 95%, 53%)",  // orange
    "hsl(340, 82%, 52%)", // rose
    "hsl(173, 80%, 40%)", // teal
    "hsl(47, 95%, 53%)",  // yellow
    "hsl(280, 65%, 60%)", // violet
  ];

  const formatRevenue = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M kr`;
    }
    if (value >= 1000) {
      return `${Math.round(value / 1000)}k kr`;
    }
    return `${value.toLocaleString("da-DK")} kr`;
  };

  // Access control check AFTER all hooks
  if (authLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!hasAccess) {
    return <Navigate to="/home" replace />;
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Daglig omsætning per opgave</h1>
          <p className="text-muted-foreground">
            Overblik over omsætning fordelt på klienter
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Vælg periode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">I dag</SelectItem>
              <SelectItem value="yesterday">I går</SelectItem>
              <SelectItem value="this_week">Denne uge</SelectItem>
              <SelectItem value="last_week">Sidste uge</SelectItem>
              <SelectItem value="this_month">Denne måned</SelectItem>
              <SelectItem value="custom">Valgfri datoer</SelectItem>
            </SelectContent>
          </Select>

          {period === "custom" && (
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal", !customStartDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customStartDate ? format(customStartDate, "dd/MM/yyyy") : "Fra dato"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customStartDate}
                    onSelect={setCustomStartDate}
                    locale={da}
                  />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal", !customEndDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customEndDate ? format(customEndDate, "dd/MM/yyyy") : "Til dato"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customEndDate}
                    onSelect={setCustomEndDate}
                    locale={da}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Alle klienter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle klienter</SelectItem>
              {clients?.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Total Revenue Card */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Total omsætning
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">
                    {formatRevenue(totalRevenue)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(startDate, "d. MMMM", { locale: da })} - {format(endDate, "d. MMMM yyyy", { locale: da })}
                  </p>
                </CardContent>
              </Card>

              {/* Total Earnings Card */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Wallet className="h-5 w-5 text-blue-500" />
                    Total indtjening
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${totalEarnings >= 0 ? 'text-blue-500' : 'text-destructive'}`}>
                    {formatRevenue(totalEarnings)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Efter provision + 12,5% feriepenge
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Table - Now first */}
            <Card>
              <CardHeader>
                <CardTitle>Omsætning per klient</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Klient</TableHead>
                      <TableHead className="text-right">Antal salg</TableHead>
                      <TableHead className="text-right">Total omsætning</TableHead>
                      <TableHead className="text-right">Provision + feriepenge</TableHead>
                      <TableHead className="text-right w-24">Fradrag %</TableHead>
                      <TableHead className="text-right w-24">Annullering %</TableHead>
                      <TableHead className="text-right">Indtjening</TableHead>
                      <TableHead className="text-right">Gns. per salg</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientSummary.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          Ingen data for den valgte periode
                        </TableCell>
                      </TableRow>
                    ) : (
                      clientSummary.map((client) => {
                        const totalLaborCost = client.totalCommission + client.totalVacationPay;
                        const deductionPct = deductionPercents[client.clientId] || 0;
                        const cancellationPct = cancellationPercents[client.clientId] || 0;
                        // 1. Først: Beregn annulleringsbeløb fra total omsætning
                        const cancellationAmount = client.totalRevenue * (cancellationPct / 100);
                        // 2. Derefter: Beregn fradrag fra reduceret omsætning (efter annulleringer)
                        const revenueAfterCancellation = client.totalRevenue - cancellationAmount;
                        const deductionAmount = revenueAfterCancellation * (deductionPct / 100);
                        // 3. Endelig: Beregn justeret indtjening
                        const adjustedEarnings = client.totalEarnings - cancellationAmount - deductionAmount;
                        
                        return (
                          <TableRow key={client.clientId}>
                            <TableCell className="font-medium">{client.clientName}</TableCell>
                            <TableCell className="text-right">{client.salesCount}</TableCell>
                            <TableCell className="text-right font-medium text-primary">
                              {client.totalRevenue.toLocaleString("da-DK")} kr
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {Math.round(totalLaborCost).toLocaleString("da-DK")} kr
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                className="w-20 text-right h-8"
                                placeholder="0"
                                value={deductionPercents[client.clientId] || ""}
                                onChange={(e) => setDeductionPercents(prev => ({
                                  ...prev,
                                  [client.clientId]: parseFloat(e.target.value) || 0
                                }))}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                className="w-20 text-right h-8"
                                placeholder="0"
                                value={cancellationPercents[client.clientId] || ""}
                                onChange={(e) => setCancellationPercents(prev => ({
                                  ...prev,
                                  [client.clientId]: parseFloat(e.target.value) || 0
                                }))}
                              />
                            </TableCell>
                            <TableCell className={`text-right font-medium ${adjustedEarnings >= 0 ? 'text-blue-500' : 'text-destructive'}`}>
                              {Math.round(adjustedEarnings).toLocaleString("da-DK")} kr
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {Math.round(client.avgRevenue).toLocaleString("da-DK")} kr
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Pie Chart - Now below table */}
            {pieChartData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Omsætning per klient
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={150}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        >
                          {pieChartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number) => [`${value.toLocaleString('da-DK')} kr`, 'Omsætning']}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
