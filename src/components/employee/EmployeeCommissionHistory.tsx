import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Clock, ShoppingCart, Coins, AlertTriangle, Umbrella, HeartPulse } from "lucide-react";
import { format, eachDayOfInterval, isSameDay } from "date-fns";
import { da } from "date-fns/locale";

interface EmployeeCommissionHistoryProps {
  employeeId: string;
  periodStart: Date;
  periodEnd: Date;
}

interface DailyData {
  date: Date;
  dateLabel: string;
  hours: number;
  sales: number;
  commission: number;
  clients: string[];
  status: "ok" | "missing_shift" | "sick" | "vacation";
}

export function EmployeeCommissionHistory({ 
  employeeId, 
  periodStart, 
  periodEnd 
}: EmployeeCommissionHistoryProps) {
  // Fetch agent mapping for this employee
  const { data: agentMapping } = useQuery({
    queryKey: ["employee-agent-mapping", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_agent_mapping")
        .select("*, agents(email, external_dialer_id)")
        .eq("employee_id", employeeId);
      if (error) throw error;
      return data;
    },
    enabled: !!employeeId,
  });

  // Fetch time stamps for period
  const { data: timeStamps = [] } = useQuery({
    queryKey: ["employee-timestamps-period", employeeId, periodStart.toISOString(), periodEnd.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_stamps")
        .select("*")
        .eq("employee_id", employeeId)
        .gte("clock_in", periodStart.toISOString())
        .lte("clock_in", periodEnd.toISOString());
      if (error) throw error;
      return data;
    },
    enabled: !!employeeId,
  });

  // Fetch approved absences for period
  const { data: absences = [] } = useQuery({
    queryKey: ["employee-absences-period", employeeId, periodStart.toISOString(), periodEnd.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("absence_request_v2")
        .select("*")
        .eq("employee_id", employeeId)
        .eq("status", "approved")
        .lte("start_date", periodEnd.toISOString().split("T")[0])
        .gte("end_date", periodStart.toISOString().split("T")[0]);
      if (error) throw error;
      return data;
    },
    enabled: !!employeeId,
  });

  // Get agent emails for sales matching
  const agentEmails = useMemo(() => {
    if (!agentMapping) return [];
    return agentMapping
      .filter(m => m.agents?.email)
      .map(m => m.agents!.email!.toLowerCase());
  }, [agentMapping]);

  // Fetch sales for period via agent emails
  const { data: sales = [] } = useQuery({
    queryKey: ["employee-sales-period", agentEmails, periodStart.toISOString(), periodEnd.toISOString()],
    queryFn: async () => {
      if (agentEmails.length === 0) return [];
      const startStr = periodStart.toISOString().split("T")[0];
      const endStr = periodEnd.toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("sales")
        .select(`
          id,
          sale_datetime,
          agent_email,
          client_campaign_id,
          client_campaigns(client_id, clients(name)),
          sale_items(mapped_commission, quantity, products(counts_as_sale))
        `)
        .in("agent_email", agentEmails)
        .gte("sale_datetime", `${startStr}T00:00:00`)
        .lte("sale_datetime", `${endStr}T23:59:59`);
      if (error) throw error;
      return data;
    },
    enabled: agentEmails.length > 0,
  });

  // Fetch fieldmarketing sales for period
  const { data: fmSales = [] } = useQuery({
    queryKey: ["employee-fm-sales-period", employeeId, periodStart.toISOString(), periodEnd.toISOString()],
    queryFn: async () => {
      const startStr = periodStart.toISOString().split("T")[0];
      const endStr = periodEnd.toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("fieldmarketing_sales")
        .select("id, registered_at, seller_id, client_id, clients(name), product_name")
        .eq("seller_id", employeeId)
        .gte("registered_at", `${startStr}T00:00:00`)
        .lte("registered_at", `${endStr}T23:59:59`);
      if (error) throw error;
      return data;
    },
    enabled: !!employeeId,
  });

  // Fetch products for FM commission lookup
  const { data: products = [] } = useQuery({
    queryKey: ["products-commission"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, commission_dkk");
      if (error) throw error;
      return data;
    },
  });

  // Build product commission map for FM
  const productCommissionMap = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach(p => {
      if (p.name) {
        map.set(p.name.toLowerCase(), p.commission_dkk ?? 0);
      }
    });
    return map;
  }, [products]);

  // Process daily data
  const dailyData = useMemo(() => {
    const daysInPeriod = eachDayOfInterval({ start: periodStart, end: new Date(Math.min(periodEnd.getTime(), Date.now())) });
    
    const result: DailyData[] = daysInPeriod.map(date => {
      const dateStr = format(date, "yyyy-MM-dd");
      
      // Check for absences
      const absence = absences.find(a => {
        const start = new Date(a.start_date);
        const end = new Date(a.end_date);
        return date >= start && date <= end;
      });
      
      if (absence) {
        return {
          date,
          dateLabel: format(date, "EEE d.", { locale: da }),
          hours: 0,
          sales: 0,
          commission: 0,
          clients: [],
          status: absence.type === "vacation" ? "vacation" : "sick" as const,
        };
      }
      
      // Calculate hours from timestamps
      const dayStamps = timeStamps.filter(s => 
        format(new Date(s.clock_in), "yyyy-MM-dd") === dateStr
      );
      const hours = dayStamps.reduce((sum, s) => sum + (s.effective_hours ?? 0), 0);
      
      // Calculate sales and commission from telesales
      const daySales = sales.filter(s => {
        if (!s.sale_datetime) return false;
        return s.sale_datetime.startsWith(dateStr);
      });
      let salesCount = 0;
      let commission = 0;
      const clientSet = new Set<string>();
      
      daySales.forEach(sale => {
        // Get client name via client_campaigns relationship
        const clientName = (sale.client_campaigns as any)?.clients?.name;
        if (clientName) clientSet.add(clientName);
        const items = sale.sale_items || [];
        items.forEach((item) => {
          const countsAsSale = (item.products as any)?.counts_as_sale !== false;
          if (countsAsSale) salesCount++;
          commission += item.mapped_commission ?? 0;
        });
      });
      
      // Add fieldmarketing sales
      const dayFmSales = fmSales.filter(s => {
        if (!s.registered_at) return false;
        return s.registered_at.startsWith(dateStr);
      });
      dayFmSales.forEach(sale => {
        if (sale.clients?.name) clientSet.add(sale.clients.name);
        salesCount++;
        // Look up commission from products
        const productName = sale.product_name?.toLowerCase() || "";
        commission += productCommissionMap.get(productName) ?? 0;
      });
      
      // Determine status
      let status: DailyData["status"] = "ok";
      if (hours === 0 && (salesCount > 0 || commission > 0)) {
        status = "missing_shift";
      }
      
      return {
        date,
        dateLabel: format(date, "EEE d.", { locale: da }),
        hours,
        sales: salesCount,
        commission,
        clients: Array.from(clientSet),
        status,
      };
    });
    
    return result;
  }, [periodStart, periodEnd, timeStamps, sales, fmSales, absences, productCommissionMap]);

  // Calculate chart data with cumulative commission
  const chartData = useMemo(() => {
    let cumulative = 0;
    return dailyData
      .filter(d => d.status !== "sick" && d.status !== "vacation")
      .map(d => {
        cumulative += d.commission;
        return {
          date: d.dateLabel,
          daily: d.commission,
          cumulative,
        };
      });
  }, [dailyData]);

  // Calculate totals
  const totals = useMemo(() => {
    const workDays = dailyData.filter(d => d.status === "ok" || d.status === "missing_shift");
    return {
      hours: workDays.reduce((sum, d) => sum + d.hours, 0),
      sales: workDays.reduce((sum, d) => sum + d.sales, 0),
      commission: workDays.reduce((sum, d) => sum + d.commission, 0),
      sickDays: dailyData.filter(d => d.status === "sick").length,
      vacationDays: dailyData.filter(d => d.status === "vacation").length,
    };
  }, [dailyData]);

  const formatCurrency = (value: number) => 
    value.toLocaleString("da-DK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  // Only show days with activity (filter out empty weekends)
  const activeDays = dailyData.filter(d => 
    d.hours > 0 || d.sales > 0 || d.commission > 0 || d.status === "sick" || d.status === "vacation"
  );

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs">Timer</span>
            </div>
            <p className="text-2xl font-bold">{totals.hours.toFixed(1)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <ShoppingCart className="h-4 w-4" />
              <span className="text-xs">Salg</span>
            </div>
            <p className="text-2xl font-bold">{totals.sales}</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Coins className="h-4 w-4" />
              <span className="text-xs">Provision</span>
            </div>
            <p className="text-2xl font-bold text-primary">{formatCurrency(totals.commission)} kr</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <HeartPulse className="h-4 w-4" />
              <span className="text-xs">Sygedage</span>
            </div>
            <p className="text-2xl font-bold">{totals.sickDays}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Umbrella className="h-4 w-4" />
              <span className="text-xs">Feriedage</span>
            </div>
            <p className="text-2xl font-bold">{totals.vacationDays}</p>
          </CardContent>
        </Card>
      </div>

      {/* Commission Development Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
            Provisions-udvikling
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              Ingen provisionsdata for perioden
            </div>
          ) : (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="commissionGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    tick={{ fontSize: 11 }}
                    tickFormatter={(val) => `${formatCurrency(val)} kr`}
                    className="text-muted-foreground"
                    width={70}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                    formatter={(value: number, name: string) => [
                      `${formatCurrency(value)} kr`,
                      name === "cumulative" ? "Total" : "Daglig"
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulative"
                    name="cumulative"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#commissionGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Daily Overview Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Daglig oversigt</CardTitle>
        </CardHeader>
        <CardContent>
          {activeDays.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Ingen aktivitet i perioden
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dato</TableHead>
                    <TableHead className="text-right">Timer</TableHead>
                    <TableHead className="text-right">Salg</TableHead>
                    <TableHead className="text-right">Provision</TableHead>
                    <TableHead>Kunder</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeDays.map((day, idx) => (
                    <TableRow key={idx} className={day.status === "sick" || day.status === "vacation" ? "opacity-60" : ""}>
                      <TableCell className="font-medium">
                        {format(day.date, "EEE d. MMM", { locale: da })}
                      </TableCell>
                      <TableCell className="text-right">
                        {day.status === "sick" || day.status === "vacation" ? "-" : day.hours.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right">
                        {day.status === "sick" || day.status === "vacation" ? "-" : day.sales}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {day.status === "sick" || day.status === "vacation" ? "-" : `${formatCurrency(day.commission)} kr`}
                      </TableCell>
                      <TableCell>
                        {day.clients.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {day.clients.slice(0, 2).map((client, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {client}
                              </Badge>
                            ))}
                            {day.clients.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{day.clients.length - 2}
                              </Badge>
                            )}
                          </div>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        {day.status === "missing_shift" && (
                          <Badge variant="outline" className="text-amber-600 border-amber-500/30 bg-amber-500/10">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Vagt mangler
                          </Badge>
                        )}
                        {day.status === "sick" && (
                          <Badge variant="outline" className="text-red-600 border-red-500/30 bg-red-500/10">
                            <HeartPulse className="h-3 w-3 mr-1" />
                            Syg
                          </Badge>
                        )}
                        {day.status === "vacation" && (
                          <Badge variant="outline" className="text-blue-600 border-blue-500/30 bg-blue-500/10">
                            <Umbrella className="h-3 w-3 mr-1" />
                            Ferie
                          </Badge>
                        )}
                        {day.status === "ok" && (
                          <span className="text-green-600">✓</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
