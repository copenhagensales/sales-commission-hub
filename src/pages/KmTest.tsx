import { MainLayout } from "@/components/layout/MainLayout";
import { KpiCard } from "@/components/km-test/KpiCard";
import { ExpensesByCategoryChart } from "@/components/km-test/ExpensesByCategoryChart";
import { TopExpensesTable } from "@/components/km-test/TopExpensesTable";
import { TrendChart } from "@/components/km-test/TrendChart";
import { useFinanceSummary } from "@/hooks/useFinanceSummary";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, Copy } from "lucide-react";
import { toast } from "sonner";

export default function KmTest() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const startOfYear = `${new Date().getFullYear()}-01`;
  
  const [fromMonth, setFromMonth] = useState(startOfYear);
  const [toMonth, setToMonth] = useState(currentMonth);
  const [salaryPerMonth, setSalaryPerMonth] = useState(50000);
  const [periodFilter, setPeriodFilter] = useState<'12' | '24'>('12');

  const { data, loading, error, refetch } = useFinanceSummary(fromMonth, toMonth, salaryPerMonth);

  // Calculate MTD values
  const mtdData = useMemo(() => {
    if (!data?.monthly_summary) return null;
    const currentMonthData = data.monthly_summary.find(m => m.month === currentMonth);
    return currentMonthData || {
      revenue_actual: 0,
      expenses_variable_actual: 0,
      expenses_fixed_planned: 0,
      salary: salaryPerMonth,
      profit: 0,
    };
  }, [data, currentMonth, salaryPerMonth]);

  const webhookUrl = `https://jwlimmeijpfmaksvmuru.supabase.co/functions/v1/economic-webhook`;

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('Webhook URL kopieret');
  };

  // Filter data for trend chart based on period
  const trendData = useMemo(() => {
    if (!data?.monthly_summary) return [];
    const months = parseInt(periodFilter);
    return data.monthly_summary.slice(-months);
  }, [data, periodFilter]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Økonomi Dashboard</h1>
            <p className="text-muted-foreground">Overblik over indtjening, udgifter og trends</p>
          </div>
          <Button onClick={refetch} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Opdater</span>
          </Button>
        </div>

        {/* Webhook URL Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">e-conomic Webhook URL</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <code className="flex-1 bg-muted p-2 rounded text-sm break-all">{webhookUrl}</code>
              <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Vælg "Faktura bogført" og "Kassekladde bogført" som webhook types i e-conomic
            </p>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Fra måned</Label>
                <Input 
                  type="month" 
                  value={fromMonth} 
                  onChange={(e) => setFromMonth(e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <Label>Til måned</Label>
                <Input 
                  type="month" 
                  value={toMonth} 
                  onChange={(e) => setToMonth(e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <Label>Løn pr. måned (DKK)</Label>
                <Input 
                  type="number" 
                  value={salaryPerMonth} 
                  onChange={(e) => setSalaryPerMonth(Number(e.target.value))} 
                />
              </div>
              <div className="space-y-2">
                <Label>Trend periode</Label>
                <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as '12' | '24')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12">12 måneder</SelectItem>
                    <SelectItem value="24">24 måneder</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">Fejl: {error}</p>
            </CardContent>
          </Card>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <KpiCard 
            title="Omsætning MTD" 
            value={mtdData?.revenue_actual || 0}
            trend="up"
          />
          <KpiCard 
            title="Variable udgifter MTD" 
            value={mtdData?.expenses_variable_actual || 0}
            trend="down"
          />
          <KpiCard 
            title="Faste udgifter MTD" 
            value={mtdData?.expenses_fixed_planned || 0}
          />
          <KpiCard 
            title="Løn MTD" 
            value={mtdData?.salary || salaryPerMonth}
          />
          <KpiCard 
            title="Indtjening MTD" 
            value={mtdData?.profit || 0}
            trend={mtdData?.profit && mtdData.profit > 0 ? 'up' : 'down'}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ExpensesByCategoryChart data={data?.top_expenses || []} />
          <TopExpensesTable expenses={data?.top_expenses || []} />
        </div>

        {/* Trend Chart */}
        <TrendChart data={trendData} />
      </div>
    </MainLayout>
  );
}
