import { MainLayout } from "@/components/layout/MainLayout";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLiquidityCalculator, LiquidityCustomer, LiquidityExpense, LiquiditySettings, ScenarioModifiers, LiquidityKPIs } from "@/hooks/useLiquidityCalculator";
import { Loader2, ArrowRight, TrendingUp, TrendingDown, Calendar, AlertTriangle } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function LiquidityScenarios() {
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

  // Scenario modifiers
  const [scenarioModifiers, setScenarioModifiers] = useState<ScenarioModifiers>({
    globalDelayDays: 0,
    revenueChangePercent: 0,
    salaryChangePercent: 0,
    invoiceOnDay15: false,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: customersData } = await supabase
        .from('liquidity_customers')
        .select('*')
        .eq('is_active', true);

      const { data: expensesData } = await supabase
        .from('liquidity_expenses')
        .select('*')
        .eq('is_active', true);

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
      console.error('Error fetching data:', error);
      toast.error('Kunne ikke hente data');
    } finally {
      setIsLoading(false);
    }
  };

  // Base scenario (no modifiers)
  const { kpis: baseKpis } = useLiquidityCalculator(
    customers,
    expenses,
    settings,
    { globalDelayDays: 0, revenueChangePercent: 0, salaryChangePercent: 0, invoiceOnDay15: false }
  );

  // Modified scenario
  const { kpis: modifiedKpis, dailyCashflow } = useLiquidityCalculator(
    customers,
    expenses,
    settings,
    scenarioModifiers
  );

  const formatCurrency = (value: number) => value.toLocaleString('da-DK') + ' kr';
  
  const formatDelta = (base: number, modified: number) => {
    const delta = modified - base;
    const sign = delta >= 0 ? '+' : '';
    return `${sign}${formatCurrency(delta)}`;
  };

  const formatDeltaDays = (base: number, modified: number) => {
    const delta = modified - base;
    const sign = delta >= 0 ? '+' : '';
    return `${sign}${delta} dage`;
  };

  const getDeltaColor = (base: number, modified: number, higherIsBetter: boolean = true) => {
    const delta = modified - base;
    if (delta === 0) return 'text-muted-foreground';
    if (higherIsBetter) {
      return delta > 0 ? 'text-success' : 'text-danger';
    } else {
      return delta < 0 ? 'text-success' : 'text-danger';
    }
  };

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
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Scenarier</h1>
          <p className="mt-1 text-muted-foreground">
            Simuler forskellige scenarier og se effekten på likviditeten
          </p>
        </div>

        {/* Scenario Controls */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Basic Scenarios */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Basis-scenarier</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <Label htmlFor="invoiceDay15">Fakturér d. 15 i stedet for sidste dag</Label>
                <Switch
                  id="invoiceDay15"
                  checked={scenarioModifiers.invoiceOnDay15}
                  onCheckedChange={(checked) => 
                    setScenarioModifiers(prev => ({ ...prev, invoiceOnDay15: checked }))
                  }
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Løn ændring</Label>
                  <span className="text-sm font-medium">
                    {scenarioModifiers.salaryChangePercent > 0 ? '+' : ''}
                    {scenarioModifiers.salaryChangePercent}%
                  </span>
                </div>
                <Slider
                  value={[scenarioModifiers.salaryChangePercent]}
                  onValueChange={([v]) => setScenarioModifiers(prev => ({ ...prev, salaryChangePercent: v }))}
                  min={-30}
                  max={30}
                  step={5}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Simulerer stigning/fald i løn (-30% til +30%)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Advanced Scenarios */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Avancerede scenarier</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Global betalingsforsinkelse</Label>
                  <span className="text-sm font-medium">+{scenarioModifiers.globalDelayDays} dage</span>
                </div>
                <Slider
                  value={[scenarioModifiers.globalDelayDays]}
                  onValueChange={([v]) => setScenarioModifiers(prev => ({ ...prev, globalDelayDays: v }))}
                  min={0}
                  max={30}
                  step={1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Hvad hvis alle kunder forsinkes med X ekstra dage?
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Omsætningsændring</Label>
                  <span className="text-sm font-medium">
                    {scenarioModifiers.revenueChangePercent > 0 ? '+' : ''}
                    {scenarioModifiers.revenueChangePercent}%
                  </span>
                </div>
                <Slider
                  value={[scenarioModifiers.revenueChangePercent]}
                  onValueChange={([v]) => setScenarioModifiers(prev => ({ ...prev, revenueChangePercent: v }))}
                  min={-30}
                  max={30}
                  step={5}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Hvad hvis omsætningen falder/stiger med X%?
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Comparison */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-lg font-semibold text-foreground mb-6">Sammenligning: Basis vs. Scenarie</h3>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Min Balance */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                {modifiedKpis.minBalance < 0 ? (
                  <TrendingDown className="h-4 w-4 text-danger" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-success" />
                )}
                <span className="text-sm text-muted-foreground">Min. kassesaldo</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Basis</p>
                  <p className="font-semibold">{formatCurrency(baseKpis.minBalance)}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Scenarie</p>
                  <p className="font-semibold">{formatCurrency(modifiedKpis.minBalance)}</p>
                </div>
              </div>
              <p className={`text-sm mt-2 ${getDeltaColor(baseKpis.minBalance, modifiedKpis.minBalance)}`}>
                Δ {formatDelta(baseKpis.minBalance, modifiedKpis.minBalance)}
              </p>
            </div>

            {/* Negative Days */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-warning" />
                <span className="text-sm text-muted-foreground">Negative dage</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Basis</p>
                  <p className="font-semibold">{baseKpis.negativeDays}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Scenarie</p>
                  <p className="font-semibold">{modifiedKpis.negativeDays}</p>
                </div>
              </div>
              <p className={`text-sm mt-2 ${getDeltaColor(baseKpis.negativeDays, modifiedKpis.negativeDays, false)}`}>
                Δ {formatDeltaDays(baseKpis.negativeDays, modifiedKpis.negativeDays)}
              </p>
            </div>

            {/* Longest Negative Period */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-danger" />
                <span className="text-sm text-muted-foreground">Længste negative periode</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Basis</p>
                  <p className="font-semibold">{baseKpis.longestNegativePeriod} dage</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Scenarie</p>
                  <p className="font-semibold">{modifiedKpis.longestNegativePeriod} dage</p>
                </div>
              </div>
              <p className={`text-sm mt-2 ${getDeltaColor(baseKpis.longestNegativePeriod, modifiedKpis.longestNegativePeriod, false)}`}>
                Δ {formatDeltaDays(baseKpis.longestNegativePeriod, modifiedKpis.longestNegativePeriod)}
              </p>
            </div>

            {/* Required Buffer */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <span className="text-sm text-muted-foreground">Nødvendig buffer</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Basis</p>
                  <p className="font-semibold">{formatCurrency(baseKpis.requiredBuffer)}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Scenarie</p>
                  <p className="font-semibold">{formatCurrency(modifiedKpis.requiredBuffer)}</p>
                </div>
              </div>
              <p className={`text-sm mt-2 ${getDeltaColor(baseKpis.requiredBuffer, modifiedKpis.requiredBuffer, false)}`}>
                Δ {formatDelta(baseKpis.requiredBuffer, modifiedKpis.requiredBuffer)}
              </p>
            </div>

            {/* Average Balance */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Gns. kassesaldo</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Basis</p>
                  <p className="font-semibold">{formatCurrency(baseKpis.avgBalance)}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Scenarie</p>
                  <p className="font-semibold">{formatCurrency(modifiedKpis.avgBalance)}</p>
                </div>
              </div>
              <p className={`text-sm mt-2 ${getDeltaColor(baseKpis.avgBalance, modifiedKpis.avgBalance)}`}>
                Δ {formatDelta(baseKpis.avgBalance, modifiedKpis.avgBalance)}
              </p>
            </div>
          </div>
        </div>

        {/* Monthly Peak Liquidity Need Comparison */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Peak likviditetsbehov pr. måned
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3">Måned</th>
                  <th className="text-right py-2 px-3">Basis</th>
                  <th className="text-right py-2 px-3">Scenarie</th>
                  <th className="text-right py-2 px-3">Δ</th>
                </tr>
              </thead>
              <tbody>
                {modifiedKpis.peakLiquidityNeedByMonth.map((item, index) => {
                  const baseItem = baseKpis.peakLiquidityNeedByMonth[index];
                  const baseNeed = baseItem?.need || 0;
                  return (
                    <tr key={item.month} className="border-b border-border/50">
                      <td className="py-2 px-3 font-medium">{item.month}</td>
                      <td className="text-right py-2 px-3">{formatCurrency(baseNeed)}</td>
                      <td className="text-right py-2 px-3">{formatCurrency(item.need)}</td>
                      <td className={`text-right py-2 px-3 ${getDeltaColor(baseNeed, item.need, false)}`}>
                        {formatDelta(baseNeed, item.need)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
