import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfMonth, endOfMonth, startOfYear, parseISO } from "date-fns";
import { da } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, TrendingUp, TrendingDown, Users, DollarSign, BarChart3, RefreshCw, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import SalesFeed from "@/components/sales/SalesFeed";

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

export default function PrivateStats() {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: new Date(),
  });
  const [selectedClient, setSelectedClient] = useState<string>("all");

  // Fetch clients
  const { data: clients } = useQuery({
    queryKey: ["stats-clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").order("name");
      return data || [];
    },
  });

  // Fetch comprehensive sales data with pagination to get all rows
  const { data: salesData, isLoading: salesLoading, refetch: refetchSales } = useQuery({
    queryKey: ["stats-sales", dateRange, selectedClient],
    queryFn: async () => {
      const startISO = format(dateRange.from, "yyyy-MM-dd") + "T00:00:00";
      const endISO = format(dateRange.to, "yyyy-MM-dd") + "T23:59:59";

      // Fetch all sales using pagination (Supabase default limit is 1000)
      const allSales: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("sales")
          .select(`
            id,
            sale_datetime,
            validation_status,
            agent_name,
            client_campaigns (
              id,
              name,
              client_id,
              clients (id, name)
            ),
            sale_items (
              id,
              quantity,
              mapped_commission,
              products (id, name, commission_dkk)
            )
          `)
          .gte("sale_datetime", startISO)
          .lte("sale_datetime", endISO)
          .order("sale_datetime", { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allSales.push(...data);
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      // Filter by client if selected
      let filteredData = allSales;
      if (selectedClient !== "all") {
        filteredData = filteredData.filter(
          (s: any) => s.client_campaigns?.client_id === selectedClient
        );
      }

      return filteredData;
    },
  });

  // Fetch employees data
  const { data: employeesData, isLoading: employeesLoading } = useQuery({
    queryKey: ["stats-employees"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employee_master_data")
        .select(`
          id,
          first_name,
          last_name,
          work_email,
          private_email,
          employment_start_date,
          employment_end_date,
          is_active,
          position_id,
          teams (id, name),
          job_positions:position_id (id, name)
        `)
        .order("first_name");
      return data || [];
    },
  });

  // Fetch KPIs
  const { data: kpisData } = useQuery({
    queryKey: ["stats-kpis"],
    queryFn: async () => {
      const { data } = await supabase
        .from("dashboard_kpis")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      return data || [];
    },
  });

  // Calculate sales statistics
  const salesStats = useMemo(() => {
    if (!salesData) return null;

    const totalSales = salesData.length;
    const validatedSales = salesData.filter((s) => !["cancelled", "rejected"].includes(s.validation_status || "")).length;
    const cancelledSales = salesData.filter((s) => s.validation_status === "cancelled").length;
    const rejectedSales = salesData.filter((s) => s.validation_status === "rejected").length;
    const pendingSales = salesData.filter((s) => s.validation_status === "pending").length;

    const totalCommission = salesData
      .filter((s) => !["cancelled", "rejected"].includes(s.validation_status || ""))
      .reduce((sum, sale) => {
        const saleItems = sale.sale_items || [];
        return sum + saleItems.reduce((itemSum, item: any) => itemSum + (Number(item.mapped_commission) || 0), 0);
      }, 0);

    // Sales by agent
    const salesByAgent = salesData.reduce((acc, sale) => {
      const agent = sale.agent_name || "Unknown";
      if (!acc[agent]) {
        acc[agent] = { sales: 0, commission: 0, cancelled: 0 };
      }
      acc[agent].sales += 1;
      if (sale.validation_status === "cancelled") {
        acc[agent].cancelled += 1;
      } else if (!["rejected"].includes(sale.validation_status || "")) {
        const items = sale.sale_items || [];
        acc[agent].commission += items.reduce((s, i: any) => s + (Number(i.mapped_commission) || 0), 0);
      }
      return acc;
    }, {} as Record<string, { sales: number; commission: number; cancelled: number }>);

    // Sales by date
    const salesByDate = salesData.reduce((acc, sale) => {
      const date = format(parseISO(sale.sale_datetime), "yyyy-MM-dd");
      if (!acc[date]) {
        acc[date] = { sales: 0, commission: 0 };
      }
      acc[date].sales += 1;
      if (!["cancelled", "rejected"].includes(sale.validation_status || "")) {
        const items = sale.sale_items || [];
        acc[date].commission += items.reduce((s, i: any) => s + (Number(i.mapped_commission) || 0), 0);
      }
      return acc;
    }, {} as Record<string, { sales: number; commission: number }>);

    // Sales by client
    const salesByClient = salesData.reduce((acc, sale) => {
      const clientName = (sale.client_campaigns as any)?.clients?.name || "Unknown";
      if (!acc[clientName]) {
        acc[clientName] = { sales: 0, commission: 0 };
      }
      acc[clientName].sales += 1;
      if (!["cancelled", "rejected"].includes(sale.validation_status || "")) {
        const items = sale.sale_items || [];
        acc[clientName].commission += items.reduce((s, i: any) => s + (Number(i.mapped_commission) || 0), 0);
      }
      return acc;
    }, {} as Record<string, { sales: number; commission: number }>);

    // Validation status breakdown
    const statusBreakdown = [
      { name: "Validated", value: validatedSales - pendingSales, color: "#10b981" },
      { name: "Pending", value: pendingSales, color: "#f59e0b" },
      { name: "Cancelled", value: cancelledSales, color: "#ef4444" },
      { name: "Rejected", value: rejectedSales, color: "#6b7280" },
    ].filter((s) => s.value > 0);

    return {
      totalSales,
      validatedSales,
      cancelledSales,
      rejectedSales,
      pendingSales,
      totalCommission,
      salesByAgent: Object.entries(salesByAgent)
        .map(([name, stats]) => ({ name, ...(stats as { sales: number; commission: number; cancelled: number }) }))
        .sort((a, b) => b.commission - a.commission),
      salesByDate: Object.entries(salesByDate)
        .map(([date, stats]) => ({ date, ...(stats as { sales: number; commission: number }) }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      salesByClient: Object.entries(salesByClient)
        .map(([name, stats]) => ({ name, ...(stats as { sales: number; commission: number }) }))
        .sort((a, b) => b.commission - a.commission),
      statusBreakdown,
    };
  }, [salesData]);

  // Calculate employee statistics
  const employeeStats = useMemo(() => {
    if (!employeesData) return null;

    const activeEmployees = employeesData.filter((e) => e.is_active);
    const inactiveEmployees = employeesData.filter((e) => !e.is_active);

    // Team distribution
    const byTeam = activeEmployees.reduce((acc, emp) => {
      const team = (emp.teams as any)?.name || "No Team";
      acc[team] = (acc[team] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Position distribution
    const byPosition = activeEmployees.reduce((acc, emp) => {
      const position = (emp.job_positions as any)?.name || "No Position";
      acc[position] = (acc[position] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Tenure calculation
    const today = new Date();
    const tenures = activeEmployees
      .filter((e) => e.employment_start_date)
      .map((e) => {
        const hireDate = parseISO(e.employment_start_date!);
        const days = Math.floor((today.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24));
        return days;
      });

    const avgTenureDays = tenures.length > 0 ? tenures.reduce((a, b) => a + b, 0) / tenures.length : 0;

    // Recent hires (last 30 days)
    const thirtyDaysAgo = subDays(today, 30);
    const recentHires = activeEmployees.filter((e) => e.employment_start_date && parseISO(e.employment_start_date) >= thirtyDaysAgo);

    // Recent terminations (last 30 days)
    const recentTerminations = employeesData.filter(
      (e) => e.employment_end_date && parseISO(e.employment_end_date) >= thirtyDaysAgo
    );

    return {
      total: employeesData.length,
      active: activeEmployees.length,
      inactive: inactiveEmployees.length,
      byTeam: Object.entries(byTeam)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      byPosition: Object.entries(byPosition)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      avgTenureDays: Math.round(avgTenureDays),
      recentHires: recentHires.length,
      recentTerminations: recentTerminations.length,
    };
  }, [employeesData]);

  const formatCurrency = (value: number) => {
    // Use space as thousands separator for clarity (27 070 instead of 27.070)
    const formatted = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(value);
    return `${formatted.replace(/\./g, " ")} DKK`;
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Private Statistics</h1>
            <p className="text-muted-foreground">Comprehensive data overview</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clients?.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dateRange.from, "dd MMM", { locale: da })} - {format(dateRange.to, "dd MMM", { locale: da })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => {
                    if (range?.from) {
                      setDateRange({ from: range.from, to: range.to || range.from });
                    }
                  }}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>

            <Button variant="outline" size="icon" onClick={() => refetchSales()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Quick Date Presets */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDateRange({ from: new Date(), to: new Date() })}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDateRange({ from: subDays(new Date(), 7), to: new Date() })}
          >
            Last 7 days
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDateRange({ from: startOfMonth(new Date()), to: new Date() })}
          >
            This Month
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const lastMonth = subDays(startOfMonth(new Date()), 1);
              setDateRange({ from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) });
            }}
          >
            Last Month
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDateRange({ from: startOfYear(new Date()), to: new Date() })}
          >
            This Year
          </Button>
        </div>

        <Tabs defaultValue="live" className="space-y-6">
          <TabsList>
            <TabsTrigger value="live" className="gap-2">
              <Radio className="h-3.5 w-3.5" />
              Live Feed
            </TabsTrigger>
            <TabsTrigger value="sales">Sales & Commission</TabsTrigger>
            <TabsTrigger value="employees">Employees</TabsTrigger>
            <TabsTrigger value="kpis">KPIs</TabsTrigger>
            <TabsTrigger value="raw">Raw Data</TabsTrigger>
          </TabsList>

          {/* Live Sales Feed Tab */}
          <TabsContent value="live">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Radio className="h-5 w-5 text-green-500 animate-pulse" />
                  Live Sales Feed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SalesFeed />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sales Tab */}
          <TabsContent value="sales" className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Sales</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{salesStats?.totalSales || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Validated</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{salesStats?.validatedSales || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Cancelled</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{salesStats?.cancelledSales || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">{salesStats?.pendingSales || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Rejected</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-600">{salesStats?.rejectedSales || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Commission</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">
                    {formatCurrency(salesStats?.totalCommission || 0)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Sales Trend */}
              <Card>
                <CardHeader>
                  <CardTitle>Sales & Commission Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={salesStats?.salesByDate || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={(v) => format(parseISO(v), "dd/MM")} />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip
                          formatter={(value: number, name: string) =>
                            name === "commission" ? formatCurrency(value) : value
                          }
                        />
                        <Legend />
                        <Line yAxisId="left" type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6", r: 4 }} name="Sales" />
                        <Line yAxisId="right" type="monotone" dataKey="commission" stroke="#ef4444" strokeWidth={2} dot={{ fill: "#ef4444", r: 4 }} name="Commission" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Status Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Validation Status Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={salesStats?.statusBreakdown || []}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {salesStats?.statusBreakdown?.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sales by Agent */}
            <Card>
              <CardHeader>
                <CardTitle>Sales by Agent</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead className="text-right">Sales</TableHead>
                      <TableHead className="text-right">Cancelled</TableHead>
                      <TableHead className="text-right">Cancel Rate</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesStats?.salesByAgent.slice(0, 20).map((agent) => (
                      <TableRow key={agent.name}>
                        <TableCell className="font-medium">{agent.name}</TableCell>
                        <TableCell className="text-right">{agent.sales}</TableCell>
                        <TableCell className="text-right text-red-600">{agent.cancelled}</TableCell>
                        <TableCell className="text-right">
                          {agent.sales > 0 ? ((agent.cancelled / agent.sales) * 100).toFixed(1) : 0}%
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(agent.commission)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Sales by Client */}
            <Card>
              <CardHeader>
                <CardTitle>Sales by Client</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesStats?.salesByClient || []} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={150} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Bar dataKey="commission" fill="hsl(var(--primary))" name="Commission" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Employees Tab */}
          <TabsContent value="employees" className="space-y-6">
            {/* Employee KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Employees</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{employeeStats?.total || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{employeeStats?.active || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Inactive</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-600">{employeeStats?.inactive || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Avg Tenure (days)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{employeeStats?.avgTenureDays || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Recent Hires (30d)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{employeeStats?.recentHires || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Terminations (30d)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{employeeStats?.recentTerminations || 0}</div>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* By Team */}
              <Card>
                <CardHeader>
                  <CardTitle>Employees by Team</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={employeeStats?.byTeam || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(var(--primary))" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* By Position */}
              <Card>
                <CardHeader>
                  <CardTitle>Employees by Position</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={employeeStats?.byPosition || []}
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          dataKey="count"
                          label={({ name, count }) => `${name}: ${count}`}
                        >
                          {employeeStats?.byPosition?.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Employee List */}
            <Card>
              <CardHeader>
                <CardTitle>Active Employees</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Hire Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employeesData
                      ?.filter((e) => e.is_active)
                      .slice(0, 50)
                      .map((emp) => (
                        <TableRow key={emp.id}>
                          <TableCell className="font-medium">
                            {emp.first_name} {emp.last_name}
                          </TableCell>
                          <TableCell>{emp.work_email || emp.private_email}</TableCell>
                          <TableCell>{(emp.teams as any)?.name || "-"}</TableCell>
                          <TableCell>{(emp.job_positions as any)?.name || "-"}</TableCell>
                          <TableCell>
                            {emp.employment_start_date ? format(parseISO(emp.employment_start_date), "dd/MM/yyyy") : "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={emp.is_active ? "default" : "secondary"}>
                              {emp.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* KPIs Tab */}
          <TabsContent value="kpis" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Configured KPIs</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Data Source</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Dashboards</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kpisData?.map((kpi) => (
                      <TableRow key={kpi.id}>
                        <TableCell className="font-medium">{kpi.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{kpi.kpi_type}</Badge>
                        </TableCell>
                        <TableCell>{kpi.data_source || "-"}</TableCell>
                        <TableCell>{kpi.target_value || "-"}</TableCell>
                        <TableCell>{kpi.unit || "-"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {kpi.dashboard_slugs?.map((slug) => (
                              <Badge key={slug} variant="secondary" className="text-xs">
                                {slug}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Raw Data Tab */}
          <TabsContent value="raw" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Raw Sales Data ({salesData?.length || 0} total)</CardTitle>
                <div className="text-sm text-muted-foreground">
                  Total Commission: <span className="font-bold text-primary">{formatCurrency(salesStats?.totalCommission || 0)}</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Agent</TableHead>
                        <TableHead>Campaign</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Items</TableHead>
                        <TableHead className="text-right">Commission</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesData?.map((sale: any) => {
                        const saleCommission = sale.sale_items?.reduce((s: number, i: any) => s + (Number(i.mapped_commission) || 0), 0) || 0;
                        return (
                          <TableRow key={sale.id}>
                            <TableCell>{format(parseISO(sale.sale_datetime), "dd/MM/yyyy HH:mm")}</TableCell>
                            <TableCell>{sale.agent_name}</TableCell>
                            <TableCell>{sale.client_campaigns?.name || "-"}</TableCell>
                            <TableCell>{sale.client_campaigns?.clients?.name || "-"}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  sale.validation_status === "cancelled"
                                    ? "destructive"
                                    : sale.validation_status === "pending"
                                    ? "secondary"
                                    : "default"
                                }
                              >
                                {sale.validation_status || "unknown"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{sale.sale_items?.length || 0}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(saleCommission)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
