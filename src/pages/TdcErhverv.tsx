import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, startOfMonth, subDays, isWeekend } from "date-fns";
import { Line, LineChart, CartesianGrid, ReferenceDot, XAxis, YAxis } from "recharts";
import { Building2, CalendarIcon, DollarSign, ShoppingCart, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface TdcSaleItem {
  mapped_commission: number | null;
  mapped_revenue: number | null;
  quantity: number | null;
  products?: {
    name: string | null;
  } | null;
}

interface TdcSale {
  id: string;
  sale_datetime: string;
  agent_name: string | null;
  customer_company: string | null;
  client_campaigns?: {
    name: string | null;
  } | null;
  sale_items: TdcSaleItem[];
}

interface TdcStats {
  salesToday: number;
  revenueToday: number;
  commissionToday: number;
  salesThisMonth: number;
  revenueThisMonth: number;
  commissionThisMonth: number;
  avgCommissionPerSale: number;
}

interface TdcDailySeriesPoint {
  date: string;
  label: string;
  sales: number;
  trend: number;
  isBest: boolean;
}

interface TdcDashboardData {
  stats: TdcStats;
  recentSales: TdcSale[];
  allSales: TdcSale[];
}

const initialStats: TdcStats = {
  salesToday: 0,
  revenueToday: 0,
  commissionToday: 0,
  salesThisMonth: 0,
  revenueThisMonth: 0,
  commissionThisMonth: 0,
  avgCommissionPerSale: 0,
};

const tdcSalesChartConfig: ChartConfig = {
  sales: {
    label: "Salg (stk.)",
    color: "hsl(var(--primary))",
  },
  trend: {
    label: "Tendens",
    color: "hsl(var(--muted-foreground))",
  },
};

const formatCurrency = (value: number) => `${value.toLocaleString("da-DK")} DKK`;

export default function TdcErhverv() {
  const [rangeDays, setRangeDays] = useState<30 | 90 | 180>(180);
  const { data, isLoading } = useQuery<TdcDashboardData>({
    queryKey: ["tdc-erhverv-dashboard"],
    queryFn: async () => {
      const today = new Date();
      const monthStart = startOfMonth(today).toISOString();
      const todayStart = startOfDay(today).toISOString();
      const historyStart = subDays(today, 180).toISOString();

      // Find TDC Erhverv-klienten
      const { data: clients, error: clientsError } = await supabase
        .from("clients")
        .select("id")
        .ilike("name", "%tdc erhverv%")
        .limit(1);

      if (clientsError) throw clientsError;

      const tdcClientId = clients?.[0]?.id as string | undefined;

      if (!tdcClientId) {
        return { stats: initialStats, recentSales: [], allSales: [] };
      }

      // Find alle kampagner for TDC Erhverv
      const { data: campaigns, error: campaignsError } = await supabase
        .from("client_campaigns")
        .select("id")
        .eq("client_id", tdcClientId);

      if (campaignsError) throw campaignsError;

      const campaignIds = (campaigns || []).map((c) => c.id as string);

      if (campaignIds.length === 0) {
        return { stats: initialStats, recentSales: [], allSales: [] };
      }

      // Hent alle TDC Erhverv-salg fra de sidste 180 dage
      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select(
          `id, sale_datetime, agent_name, customer_company,
           client_campaigns ( name ),
           sale_items ( mapped_commission, mapped_revenue, quantity, products ( name ) )`
        )
        .in("client_campaign_id", campaignIds)
        .gte("sale_datetime", historyStart)
        .order("sale_datetime", { ascending: false });

      if (salesError) throw salesError;

      const tdcSales = (sales || []) as unknown as TdcSale[];

      const monthStartDate = new Date(monthStart);
      const todayStartDate = new Date(todayStart);

      const monthSales = tdcSales.filter(
        (sale) => sale.sale_datetime && new Date(sale.sale_datetime) >= monthStartDate
      );

      const todaysSales = tdcSales.filter(
        (sale) => sale.sale_datetime && new Date(sale.sale_datetime) >= todayStartDate
      );

      let revenueThisMonth = 0;
      let commissionThisMonth = 0;

      monthSales.forEach((sale) => {
        sale.sale_items?.forEach((item) => {
          revenueThisMonth += Number(item.mapped_revenue) || 0;
          commissionThisMonth += Number(item.mapped_commission) || 0;
        });
      });

      let revenueToday = 0;
      let commissionToday = 0;
      let salesTodayCount = 0;
      let salesThisMonthCount = 0;

      todaysSales.forEach((sale) => {
        sale.sale_items?.forEach((item) => {
          revenueToday += Number(item.mapped_revenue) || 0;
          commissionToday += Number(item.mapped_commission) || 0;
          const qty = Number((item as any).quantity) || 1;
          salesTodayCount += qty;
        });
      });

      monthSales.forEach((sale) => {
        sale.sale_items?.forEach((item) => {
          const qty = Number((item as any).quantity) || 1;
          salesThisMonthCount += qty;
        });
      });

      const stats: TdcStats = {
        salesToday: salesTodayCount,
        revenueToday,
        commissionToday,
        salesThisMonth: salesThisMonthCount,
        revenueThisMonth,
        commissionThisMonth,
        avgCommissionPerSale:
          salesThisMonthCount > 0 ? commissionThisMonth / salesThisMonthCount : 0,
      };

      const recentSales = tdcSales.slice(0, 25);

      return { stats, recentSales, allSales: tdcSales };
    },
  });

  const stats = data?.stats ?? initialStats;
  const recentSales = data?.recentSales ?? [];
  const allSales = data?.allSales ?? [];

  const [agentFilter, setAgentFilter] = useState<string>("ALL");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  const agentOptions = useMemo(() => {
    const names = Array.from(
      new Set(
        allSales.map((sale) => (sale.agent_name && sale.agent_name.trim().length > 0 ? sale.agent_name : "Ukendt")),
      ),
    );
    return names.sort((a, b) => a.localeCompare(b, "da-DK"));
  }, [allSales]);

  const chartPoints = useMemo<TdcDailySeriesPoint[]>(() => {
    if (!allSales.length) return [];

    const today = new Date();
    const end = customTo ? new Date(customTo + "T23:59:59") : today;
    const start = customFrom ? new Date(customFrom + "T00:00:00") : subDays(end, rangeDays);

    const dailyMap = new Map<string, number>();

    allSales.forEach((sale) => {
      if (!sale.sale_datetime) return;
      const saleDate = new Date(sale.sale_datetime);
      if (saleDate < start || saleDate > end) return;

      const agentName = sale.agent_name && sale.agent_name.trim().length > 0 ? sale.agent_name : "Ukendt";
      if (agentFilter !== "ALL" && agentName !== agentFilter) return;

      const dateKey = format(saleDate, "yyyy-MM-dd");

      let dailyUnits = 0;
      sale.sale_items?.forEach((item) => {
        const qty = Number((item as any).quantity) || 1;
        dailyUnits += qty;
      });

      if (dailyUnits === 0) return;

      dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + dailyUnits);
    });

    const dailyEntries = Array.from(dailyMap.entries())
      .map(([dateKey, salesCount]) => ({ dateKey, sales: salesCount }))
      .sort((a, b) => (a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1 : 0));

    const weekdayEntries = dailyEntries.filter(({ dateKey }) => {
      const d = new Date(dateKey);
      return !isWeekend(d);
    });

    if (!weekdayEntries.length) return [];

    const n = weekdayEntries.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    weekdayEntries.forEach((entry, index) => {
      const x = index;
      const y = entry.sales;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    });

    const denominator = n * sumX2 - sumX * sumX;
    const slope = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
    const intercept = n > 0 ? (sumY - slope * sumX) / n : 0;

    let bestIndex = 0;
    let maxSales = weekdayEntries[0].sales;

    weekdayEntries.forEach((entry, index) => {
      if (entry.sales > maxSales) {
        maxSales = entry.sales;
        bestIndex = index;
      }
    });

    return weekdayEntries.map((entry, index) => {
      const date = new Date(entry.dateKey);
      const trendRaw = intercept + slope * index;

      return {
        date: entry.dateKey,
        label: format(date, "dd/MM"),
        sales: entry.sales,
        trend: Number(trendRaw.toFixed(1)),
        isBest: index === bestIndex,
      };
    });
  }, [allSales, agentFilter, customFrom, customTo, rangeDays]);

  const bestDayPoint = useMemo(() => {
    if (!chartPoints.length) return undefined;
    return chartPoints.reduce((best, point) => (point.sales > best.sales ? point : best), chartPoints[0]);
  }, [chartPoints]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold">TDC Erhverv – salgsdashboard</h1>
            <p className="text-muted-foreground">
              Live overblik over salg, omsætning og provision for kunden TDC Erhverv.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">Kunde: TDC Erhverv</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Salg i dag</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.salesToday}</div>
              <p className="text-xs text-muted-foreground mt-1">Antal registrerede TDC Erhverv-salg i dag</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Omsætning i dag</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.revenueToday)}</div>
              <p className="text-xs text-muted-foreground mt-1">Baseret på mappede produkter</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Omsætning denne måned</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.revenueThisMonth)}</div>
              <p className="text-xs text-muted-foreground mt-1">Alle TDC Erhverv-salg fra månedens start</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gns. provision pr. salg</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.avgCommissionPerSale)}</div>
              <p className="text-xs text-muted-foreground mt-1">Beregnet på månedens TDC Erhverv-salg</p>
            </CardContent>
          </Card>
        </div>

        {chartPoints.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Historisk salgsudvikling (hverdage)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground">Agent</span>
                    <div className="min-w-[160px]">
                      <Select value={agentFilter} onValueChange={setAgentFilter}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Alle agenter" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">Alle agenter</SelectItem>
                          {agentOptions.map((name) => (
                            <SelectItem key={name} value={name}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-muted-foreground">Fra dato</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={`h-8 px-2 text-xs justify-start text-left font-normal ${
                              !customFrom ? "text-muted-foreground" : ""
                            }`}
                          >
                            <CalendarIcon className="mr-1 h-3 w-3" />
                            {customFrom ? format(new Date(customFrom), "dd/MM/yyyy") : <span>Vælg dato</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={customFrom ? new Date(customFrom) : undefined}
                            onSelect={(date) => {
                              if (!date) {
                                setCustomFrom("");
                              } else {
                                setCustomFrom(format(date, "yyyy-MM-dd"));
                              }
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-muted-foreground">Til dato</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={`h-8 px-2 text-xs justify-start text-left font-normal ${
                              !customTo ? "text-muted-foreground" : ""
                            }`}
                          >
                            <CalendarIcon className="mr-1 h-3 w-3" />
                            {customTo ? format(new Date(customTo), "dd/MM/yyyy") : <span>Vælg dato</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={customTo ? new Date(customTo) : undefined}
                            onSelect={(date) => {
                              if (!date) {
                                setCustomTo("");
                              } else {
                                setCustomTo(format(date, "yyyy-MM-dd"));
                              }
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>

                <div className="inline-flex gap-1 rounded-md border border-border bg-background p-0.5">
                  {[30, 90, 180].map((days) => (
                    <Button
                      key={days}
                      size="sm"
                      variant={rangeDays === days ? "default" : "outline"}
                      className="h-7 px-2 text-xs"
                      onClick={() => setRangeDays(days as 30 | 90 | 180)}
                    >
                      {days} dage
                    </Button>
                  ))}
                </div>
              </div>

              <ChartContainer config={tdcSalesChartConfig} className="h-80 w-full">
                <LineChart data={chartPoints} margin={{ left: 12, right: 12, top: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={16}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                  />
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    stroke="var(--color-sales)"
                    strokeWidth={2}
                    dot={false}
                    name="Salg"
                  />
                  <Line
                    type="monotone"
                    dataKey="trend"
                    stroke="var(--color-trend)"
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Tendens"
                  />
                  {bestDayPoint && (
                    <ReferenceDot
                      x={bestDayPoint.label}
                      y={bestDayPoint.sales}
                      r={5}
                      fill="hsl(var(--primary))"
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                    />
                  )}
                </LineChart>
              </ChartContainer>
              <p className="mt-2 text-xs text-muted-foreground">
                Viser antal solgte enheder pr. hverdag i den valgte periode (maks. 180 dage tilbage). Bedste salgsdag for filtret er fremhævet.
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Seneste TDC Erhverv-salg</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground">Indlæser TDC Erhverv-data...</div>
            ) : recentSales.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Ingen registrerede TDC Erhverv-salg endnu. Sørg for at kampagner for TDC Erhverv er korrekt mappet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dato</TableHead>
                    <TableHead>Kampagne</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Produkter</TableHead>
                    <TableHead className="text-right">Omsætning</TableHead>
                    <TableHead className="text-right">Provision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentSales.map((sale) => {
                    let saleRevenue = 0;
                    let saleCommission = 0;

                    sale.sale_items?.forEach((item) => {
                      saleRevenue += Number(item.mapped_revenue) || 0;
                      saleCommission += Number(item.mapped_commission) || 0;
                    });

                    return (
                      <TableRow key={sale.id}>
                        <TableCell>
                          {format(new Date(sale.sale_datetime), "dd/MM/yyyy HH:mm")} 
                        </TableCell>
                        <TableCell>{sale.client_campaigns?.name || "—"}</TableCell>
                        <TableCell>{sale.customer_company || "—"}</TableCell>
                        <TableCell>{sale.agent_name || "—"}</TableCell>
                        <TableCell>
                          {sale.sale_items?.map((item, index) => {
                            const qty = Number((item as any).quantity) || 1;
                            return (
                              <Badge key={index} variant="secondary" className="mr-1 text-xs">
                                {item.products?.name || "Ukendt produkt"} (x{qty})
                              </Badge>
                            );
                          })}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(saleRevenue)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(saleCommission)}
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
    </MainLayout>
  );
}
