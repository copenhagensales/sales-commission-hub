import { MainLayout } from "@/components/layout/MainLayout";
import { KPICard } from "@/components/dashboard/KPICard";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLiquidityCalculator, LiquidityCustomer, LiquidityExpense, LiquiditySettings, ScenarioModifiers } from "@/hooks/useLiquidityCalculator";
import { 
  Loader2, 
  TrendingDown, 
  Calendar, 
  AlertTriangle, 
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle
} from "lucide-react";
import { format, addMonths } from "date-fns";
import { da } from "date-fns/locale";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  ReferenceLine,
  Legend
} from "recharts";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function LiquidityOverview() {
  const [isLoading, setIsLoading] = useState(true);
  const [customers, setCustomers] = useState<LiquidityCustomer[]>([]);
  const [expenses, setExpenses] = useState<LiquidityExpense[]>([]);
  const [settings, setSettings] = useState<LiquiditySettings>({
    startingBalance: 100000,
    startingDate: new Date(),
    forecastMonths: 6,
    vatRate: 25,
    vatPaymentDay: 10,
    totalMonthlySalary: 0,
    vacationPayPercent: 12.5,
    salaryPaymentDay: 15,
  });
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('weekly');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch customers
      const { data: customersData } = await supabase
        .from('liquidity_customers')
        .select('*')
        .eq('is_active', true);

      // Fetch expenses
      const { data: expensesData } = await supabase
        .from('liquidity_expenses')
        .select('*')
        .eq('is_active', true);

      // Fetch settings
      const { data: settingsData } = await supabase
        .from('liquidity_settings')
        .select('*');

      if (customersData) setCustomers(customersData);
      if (expensesData) setExpenses(expensesData as LiquidityExpense[]);
      
      if (settingsData) {
        const general = settingsData.find(s => s.setting_key === 'general')?.setting_value as any;
        const vat = settingsData.find(s => s.setting_key === 'vat')?.setting_value as any;
        const salary = settingsData.find(s => s.setting_key === 'salary')?.setting_value as any;
        
        setSettings(prev => ({
          ...prev,
          startingBalance: general?.starting_balance ?? prev.startingBalance,
          startingDate: general?.starting_date ? new Date(general.starting_date) : new Date(),
          forecastMonths: general?.forecast_months ?? 6,
          vatRate: vat?.rate ?? 25,
          vatPaymentDay: vat?.payment_day ?? 10,
          totalMonthlySalary: salary?.total_monthly ?? 0,
          vacationPayPercent: salary?.vacation_pay_percent ?? 12.5,
          salaryPaymentDay: salary?.payment_day ?? 15,
        }));
      }
    } catch (error) {
      console.error('Error fetching liquidity data:', error);
      toast.error('Kunne ikke hente likviditetsdata');
    } finally {
      setIsLoading(false);
    }
  };

  const { dailyCashflow, weeklyCashflow, monthlyCashflow, kpis } = useLiquidityCalculator(
    customers,
    expenses,
    settings
  );

  const formatCurrency = (value: number) => {
    return value.toLocaleString('da-DK') + ' kr';
  };

  const chartData = viewMode === 'daily' 
    ? dailyCashflow.map(d => ({
        date: format(d.date, 'd/M', { locale: da }),
        balance: d.balance,
        inflows: d.inflows,
        outflows: -d.outflows,
      }))
    : weeklyCashflow.map(w => ({
        date: w.weekLabel,
        balance: w.endBalance,
        inflows: w.inflows,
        outflows: -w.outflows,
      }));

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Likviditet</h1>
            <p className="mt-1 text-muted-foreground">
              Prognose for de næste {settings.forecastMonths} måneder
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant={viewMode === 'daily' ? 'default' : 'outline'}
              onClick={() => setViewMode('daily')}
              size="sm"
            >
              Daglig
            </Button>
            <Button 
              variant={viewMode === 'weekly' ? 'default' : 'outline'}
              onClick={() => setViewMode('weekly')}
              size="sm"
            >
              Ugentlig
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Min. kassesaldo"
            value={formatCurrency(kpis.minBalance)}
            icon={kpis.minBalance < 0 ? TrendingDown : Wallet}
            variant={kpis.minBalance < 0 ? "danger" : "success"}
            subtitle={kpis.minBalanceDate ? format(kpis.minBalanceDate, 'd. MMMM', { locale: da }) : undefined}
          />
          <KPICard
            title="Nødvendig buffer"
            value={formatCurrency(kpis.requiredBuffer)}
            icon={AlertTriangle}
            variant={kpis.requiredBuffer > 0 ? "warning" : "success"}
            subtitle="Inkl. 50.000 kr sikkerhed"
          />
          <KPICard
            title="Negative dage"
            value={kpis.negativeDays.toString()}
            icon={Calendar}
            variant={kpis.negativeDays > 0 ? "danger" : "success"}
            subtitle={kpis.longestNegativePeriod > 0 ? `Længste periode: ${kpis.longestNegativePeriod} dage` : 'Ingen negative perioder'}
          />
          <KPICard
            title="Gns. kassesaldo"
            value={formatCurrency(kpis.avgBalance)}
            icon={Wallet}
            subtitle="I prognoseperioden"
          />
        </div>

        {/* Balance Chart */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Kassesaldo over tid</h3>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey="date" 
                  className="text-xs fill-muted-foreground"
                  tick={{ fontSize: 11 }}
                />
                <YAxis 
                  className="text-xs fill-muted-foreground"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))'
                  }}
                  formatter={(value: number) => [formatCurrency(value), 'Saldo']}
                />
                <ReferenceLine y={0} stroke="hsl(var(--danger))" strokeDasharray="3 3" />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="hsl(var(--primary))"
                  fillOpacity={1}
                  fill="url(#colorBalance)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly In/Out Chart */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Ind- vs. udbetalinger pr. måned</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyCashflow} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="month" 
                    className="text-xs fill-muted-foreground"
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis 
                    className="text-xs fill-muted-foreground"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number, name: string) => [
                      formatCurrency(Math.abs(value)),
                      name === 'inflows' ? 'Indbetalinger' : 'Udbetalinger'
                    ]}
                  />
                  <Legend 
                    formatter={(value) => value === 'inflows' ? 'Indbetalinger' : 'Udbetalinger'}
                  />
                  <Bar dataKey="inflows" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="outflows" fill="hsl(var(--danger))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Peak Liquidity Need by Month */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Likviditetsbehov pr. måned</h3>
            {kpis.peakLiquidityNeedByMonth.some(m => m.need > 0) ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={kpis.peakLiquidityNeedByMonth} 
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis 
                      dataKey="month" 
                      className="text-xs fill-muted-foreground"
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis 
                      className="text-xs fill-muted-foreground"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [formatCurrency(value), 'Behov']}
                    />
                    <Bar 
                      dataKey="need" 
                      fill="hsl(var(--warning))" 
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <div className="text-center">
                  <Wallet className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Ingen likviditetsbehov - saldoen er positiv hele perioden</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Data summary */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Datagrundlag</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-foreground">{customers.length}</p>
              <p className="text-xs text-muted-foreground">Kunder</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-foreground">{expenses.length}</p>
              <p className="text-xs text-muted-foreground">Udgiftsposter</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-foreground">{formatCurrency(settings.startingBalance)}</p>
              <p className="text-xs text-muted-foreground">Startsaldo</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-foreground">{formatCurrency(settings.totalMonthlySalary)}</p>
              <p className="text-xs text-muted-foreground">Månedlig løn</p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
