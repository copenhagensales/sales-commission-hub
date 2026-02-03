import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, parseISO, startOfDay, endOfDay } from "date-fns";
import { da } from "date-fns/locale";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, Loader2, CalendarIcon, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

type PeriodType = "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "custom";

interface ClientRevenueData {
  clientId: string;
  clientName: string;
  salesCount: number;
  totalRevenue: number;
  avgRevenue: number;
}

interface DailyClientRevenue {
  date: string;
  [clientName: string]: string | number;
}

export default function RevenueByClient() {
  const [period, setPeriod] = useState<PeriodType>("today");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [selectedClientId, setSelectedClientId] = useState<string>("all");

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
          .select("sale_id, mapped_revenue, product_id")
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

      // Get product campaign overrides
      const { data: productCampaignOverrides } = await supabase
        .from("product_campaign_overrides")
        .select("product_id, campaign_mapping_id, revenue_dkk");
      
      const overrideMap = new Map<string, number>();
      productCampaignOverrides?.forEach((o) => {
        const key = `${o.product_id}_${o.campaign_mapping_id}`;
        overrideMap.set(key, o.revenue_dkk ?? 0);
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

      // Get products for FM revenue lookup
      const { data: products } = await supabase
        .from("products")
        .select("name, revenue_dkk");
      
      const productRevenueMap = new Map<string, number>();
      products?.forEach((p) => {
        productRevenueMap.set(p.name.toLowerCase(), p.revenue_dkk ?? 0);
      });

      // Aggregate per client and date
      const revenueByClientAndDate: Record<string, Record<string, { count: number; revenue: number }>> = {};
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
        items.forEach((item) => {
          const overrideKey = campaignMappingId ? `${item.product_id}_${campaignMappingId}` : null;
          const override = overrideKey ? overrideMap.get(overrideKey) : null;
          
          if (override !== null && override !== undefined) {
            saleRevenue += override;
          } else {
            saleRevenue += Number(item.mapped_revenue) || 0;
          }
        });

        if (!revenueByClientAndDate[clientId]) revenueByClientAndDate[clientId] = {};
        if (!revenueByClientAndDate[clientId][saleDate]) {
          revenueByClientAndDate[clientId][saleDate] = { count: 0, revenue: 0 };
        }
        revenueByClientAndDate[clientId][saleDate].count += 1;
        revenueByClientAndDate[clientId][saleDate].revenue += saleRevenue;
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

        if (!revenueByClientAndDate[clientId]) revenueByClientAndDate[clientId] = {};
        if (!revenueByClientAndDate[clientId][saleDate]) {
          revenueByClientAndDate[clientId][saleDate] = { count: 0, revenue: 0 };
        }
        revenueByClientAndDate[clientId][saleDate].count += 1;
        revenueByClientAndDate[clientId][saleDate].revenue += revenue;
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

      Object.values(dates).forEach(({ count, revenue }) => {
        totalSales += count;
        totalRevenue += revenue;
      });

      summary.push({
        clientId,
        clientName: clientNames[clientId] || "Ukendt",
        salesCount: totalSales,
        totalRevenue,
        avgRevenue: totalSales > 0 ? totalRevenue / totalSales : 0,
      });
    });

    return summary.sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [revenueData]);

  // Calculate total revenue
  const totalRevenue = useMemo(() => {
    return clientSummary.reduce((sum, c) => sum + c.totalRevenue, 0);
  }, [clientSummary]);

  // Build chart data - daily revenue per client
  const chartData: DailyClientRevenue[] = useMemo(() => {
    if (!revenueData) return [];
    
    const { revenueByClientAndDate, clientNames } = revenueData;
    const allDates = new Set<string>();
    
    Object.values(revenueByClientAndDate).forEach((dates) => {
      Object.keys(dates).forEach((date) => allDates.add(date));
    });

    const sortedDates = Array.from(allDates).sort();
    
    return sortedDates.map((date) => {
      const entry: DailyClientRevenue = { 
        date: format(parseISO(date), "dd/MM", { locale: da }) 
      };
      
      Object.entries(revenueByClientAndDate).forEach(([clientId, dates]) => {
        const clientName = clientNames[clientId] || "Ukendt";
        entry[clientName] = dates[date]?.revenue || 0;
      });
      
      return entry;
    });
  }, [revenueData]);

  // Get unique client names for chart colors
  const clientNamesForChart = useMemo(() => {
    if (!revenueData) return [];
    return Object.values(revenueData.clientNames);
  }, [revenueData]);

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
            {/* Total Revenue Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                  Total omsætning
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-emerald-500">
                  {formatRevenue(totalRevenue)}
                </div>
                <p className="text-sm text-muted-foreground">
                  {format(startDate, "d. MMMM", { locale: da })} - {format(endDate, "d. MMMM yyyy", { locale: da })}
                </p>
              </CardContent>
            </Card>

            {/* Chart */}
            {chartData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Omsætning per dag og klient
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis 
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                          width={50}
                        />
                        <Tooltip 
                          formatter={(value: number, name: string) => [`${value.toLocaleString('da-DK')} kr`, name]}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        />
                        <Legend />
                        {clientNamesForChart.map((clientName, index) => (
                          <Bar
                            key={clientName}
                            dataKey={clientName}
                            stackId="a"
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                            radius={index === clientNamesForChart.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Table */}
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
                      <TableHead className="text-right">Gns. per salg</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientSummary.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Ingen data for den valgte periode
                        </TableCell>
                      </TableRow>
                    ) : (
                      clientSummary.map((client) => (
                        <TableRow key={client.clientId}>
                          <TableCell className="font-medium">{client.clientName}</TableCell>
                          <TableCell className="text-right">{client.salesCount}</TableCell>
                          <TableCell className="text-right font-medium text-emerald-600">
                            {client.totalRevenue.toLocaleString("da-DK")} kr
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {Math.round(client.avgRevenue).toLocaleString("da-DK")} kr
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  );
}
