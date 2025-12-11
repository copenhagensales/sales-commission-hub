import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, DollarSign, Receipt, PiggyBank, Minus, RefreshCw, Wallet } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useFinanceSummary } from "@/hooks/useFinanceSummary";
import { useToast } from "@/hooks/use-toast";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LineChart, Line 
} from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, subMonths } from "date-fns";
import { da } from "date-fns/locale";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', '#8884d8', '#82ca9d', '#ffc658'];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('da-DK', {
    style: 'currency',
    currency: 'DKK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompact(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(0)}k`;
  }
  return value.toFixed(0);
}

export default function EconomicBoard() {
  const [time, setTime] = useState(new Date());
  const { toast } = useToast();
  
  // Calculate date range: last 12 months
  const toDate = format(new Date(), 'yyyy-MM');
  const fromDate = format(subMonths(new Date(), 11), 'yyyy-MM');
  
  const { data, isLoading, error, refetch, isFetching } = useFinanceSummary({
    from: fromDate,
    to: toDate,
    salary: 0, // Will be calculated from actual data
  });

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Auto-refresh every 5 minutes
    const interval = setInterval(() => refetch(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refetch]);

  const handleRefresh = async () => {
    await refetch();
    toast({
      title: "Data opdateret",
      description: "Finansielle data er hentet fra e-conomic",
    });
  };

  // Calculate KPIs
  const currentMonth = data?.current_month;
  const monthlySummary = data?.monthly_summary || [];
  const previousMonth = monthlySummary.length >= 2 ? monthlySummary[monthlySummary.length - 2] : null;
  
  const revenueChange = currentMonth && previousMonth 
    ? ((currentMonth.revenue_actual - previousMonth.revenue_actual) / (previousMonth.revenue_actual || 1)) * 100 
    : 0;
  
  const expenseChange = currentMonth && previousMonth
    ? (((currentMonth.expenses_variable_actual + currentMonth.expenses_fixed_planned) - 
        (previousMonth.expenses_variable_actual + previousMonth.expenses_fixed_planned)) / 
       ((previousMonth.expenses_variable_actual + previousMonth.expenses_fixed_planned) || 1)) * 100
    : 0;

  // Prepare chart data
  const trendData = monthlySummary.map(m => ({
    month: format(new Date(m.month + '-01'), 'MMM yy', { locale: da }),
    omsætning: m.revenue_actual,
    udgifter: m.expenses_variable_actual + m.expenses_fixed_planned,
    profit: m.profit,
  }));

  const categoryData = (data?.expenses_by_category || []).map((cat, index) => ({
    name: cat.category,
    value: cat.amount,
    fill: COLORS[index % COLORS.length],
  }));

  if (error) {
    return (
      <MainLayout>
        <div className="min-h-screen bg-background p-8 flex items-center justify-center">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center">
              <p className="text-destructive mb-4">Kunne ikke hente data fra e-conomic</p>
              <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
              <Button onClick={() => refetch()}>Prøv igen</Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-screen bg-background p-8">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Wallet className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-foreground">E-conomic</h1>
              <p className="text-muted-foreground">Finansielt overblik</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
              Opdater
            </Button>
            <div className="text-right">
              <p className="text-5xl font-bold tabular-nums text-foreground">
                {time.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="text-xl text-muted-foreground">
                {time.toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            </div>
          </div>
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-pulse text-muted-foreground">Indlæser finansielle data...</div>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
              {/* Revenue */}
              <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Omsætning denne måned
                  </CardTitle>
                  <DollarSign className="h-5 w-5 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-500">
                    {formatCurrency(currentMonth?.revenue_actual || 0)}
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    {revenueChange >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-destructive" />
                    )}
                    <span className={`text-sm ${revenueChange >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                      {revenueChange >= 0 ? '+' : ''}{revenueChange.toFixed(1)}% vs. forrige måned
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Variable Expenses */}
              <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Variable udgifter
                  </CardTitle>
                  <Receipt className="h-5 w-5 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-orange-500">
                    {formatCurrency(currentMonth?.expenses_variable_actual || 0)}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Denne måned
                  </p>
                </CardContent>
              </Card>

              {/* Fixed Expenses */}
              <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Faste udgifter
                  </CardTitle>
                  <Receipt className="h-5 w-5 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-500">
                    {formatCurrency(currentMonth?.expenses_fixed_planned || 0)}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Planlagt denne måned
                  </p>
                </CardContent>
              </Card>

              {/* Profit */}
              <Card className={`bg-gradient-to-br ${(currentMonth?.profit || 0) >= 0 ? 'from-primary/10 to-primary/5 border-primary/20' : 'from-destructive/10 to-destructive/5 border-destructive/20'}`}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Resultat
                  </CardTitle>
                  <PiggyBank className={`h-5 w-5 ${(currentMonth?.profit || 0) >= 0 ? 'text-primary' : 'text-destructive'}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${(currentMonth?.profit || 0) >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {formatCurrency(currentMonth?.profit || 0)}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Efter alle udgifter
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid gap-6 lg:grid-cols-2 mb-8">
              {/* Monthly Trend Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Månedlig udvikling
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      />
                      <YAxis 
                        tickFormatter={(v) => formatCompact(v)}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="omsætning" 
                        name="Omsætning"
                        stroke="hsl(142.1 76.2% 36.3%)" 
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="udgifter" 
                        name="Udgifter"
                        stroke="hsl(var(--destructive))" 
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="profit" 
                        name="Profit"
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Expenses by Category */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-primary" />
                    Udgifter pr. kategori
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {categoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={categoryData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      Ingen kategoridata tilgængelig
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Tables Row */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Top 10 Expenses */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-destructive" />
                    Top 10 udgifter denne måned
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dato</TableHead>
                        <TableHead>Beskrivelse</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead className="text-right">Beløb</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.top_expenses || []).slice(0, 10).map((expense, index) => (
                        <TableRow key={index}>
                          <TableCell className="text-muted-foreground">
                            {expense.date ? format(new Date(expense.date), 'dd/MM', { locale: da }) : '-'}
                          </TableCell>
                          <TableCell className="font-medium truncate max-w-[200px]" title={expense.text}>
                            {expense.text || '-'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {expense.category || '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-destructive">
                            {formatCurrency(Math.abs(expense.amount))}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!data?.top_expenses || data.top_expenses.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            Ingen udgifter fundet
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Monthly Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Månedsoversigt
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Måned</TableHead>
                        <TableHead className="text-right">Omsætning</TableHead>
                        <TableHead className="text-right">Udgifter</TableHead>
                        <TableHead className="text-right">Resultat</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...monthlySummary].reverse().slice(0, 12).map((month, index) => {
                        const totalExpenses = month.expenses_variable_actual + month.expenses_fixed_planned;
                        return (
                          <TableRow key={index}>
                            <TableCell className="font-medium">
                              {format(new Date(month.month + '-01'), 'MMMM yyyy', { locale: da })}
                            </TableCell>
                            <TableCell className="text-right font-mono text-green-500">
                              {formatCurrency(month.revenue_actual)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-destructive">
                              {formatCurrency(totalExpenses)}
                            </TableCell>
                            <TableCell className={`text-right font-mono ${month.profit >= 0 ? 'text-primary' : 'text-destructive'}`}>
                              {formatCurrency(month.profit)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {monthlySummary.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            Ingen månedlige data tilgængelige
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* Footer */}
            <footer className="mt-8 text-center text-sm text-muted-foreground">
              <div className="flex items-center justify-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                Data opdateres automatisk hvert 5. minut
              </div>
            </footer>
          </>
        )}
      </div>
    </MainLayout>
  );
}
