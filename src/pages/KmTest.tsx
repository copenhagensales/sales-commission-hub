import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useFinanceSummary } from "@/hooks/useFinanceSummary";
import { KpiCard } from "@/components/km-test/KpiCard";
import { ExpensesByCategoryChart } from "@/components/km-test/ExpensesByCategoryChart";
import { TopExpensesTable } from "@/components/km-test/TopExpensesTable";
import { TrendChart } from "@/components/km-test/TrendChart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw, TrendingUp, TrendingDown, DollarSign, Briefcase, PiggyBank } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

export default function KmTest() {
  const [salary, setSalary] = useState(0);
  const [period, setPeriod] = useState("12");
  
  const fromDate = new Date();
  fromDate.setMonth(fromDate.getMonth() - parseInt(period));
  const from = fromDate.toISOString().slice(0, 7);
  const to = new Date().toISOString().slice(0, 7);

  const { data, isLoading, refetch, isRefetching } = useFinanceSummary({
    from,
    to,
    salary,
  });

  const handleSync = async () => {
    try {
      const response = await fetch(
        'https://jwlimmeijpfmaksvmuru.supabase.co/functions/v1/sync-economic',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      
      if (!response.ok) throw new Error('Sync failed');
      
      const result = await response.json();
      toast({
        title: "Sync gennemført",
        description: `${result.inserted} transaktioner importeret`,
      });
      refetch();
    } catch {
      toast({
        title: "Sync fejlede",
        description: "Kunne ikke synkronisere med e-conomic",
        variant: "destructive",
      });
    }
  };

  const currentMonth = data?.current_month;

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Økonomi Dashboard</h1>
            <p className="text-muted-foreground mt-1">Overblik over indtjening og udgifter</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="salary" className="whitespace-nowrap text-sm">Løn/md:</Label>
              <Input
                id="salary"
                type="number"
                value={salary || ''}
                onChange={(e) => setSalary(parseFloat(e.target.value) || 0)}
                className="w-28"
                placeholder="0"
              />
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSync}
              disabled={isRefetching}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
              Sync
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard
            title="Omsætning MTD"
            value={currentMonth?.revenue_actual || 0}
            subtitle="Aktuel måned"
          />
          <KpiCard
            title="Variable udgifter MTD"
            value={currentMonth?.expenses_variable_actual || 0}
            subtitle="Fra e-conomic"
          />
          <KpiCard
            title="Faste udgifter MTD"
            value={currentMonth?.expenses_fixed_planned || 0}
            subtitle="Planlagt"
          />
          <KpiCard
            title="Løn MTD"
            value={currentMonth?.salary || 0}
            subtitle="Manuelt input"
          />
          <KpiCard
            title="Indtjening MTD"
            value={currentMonth?.profit || 0}
            subtitle="Efter alle udgifter"
            className={currentMonth?.profit && currentMonth.profit < 0 ? 'border-destructive' : ''}
          />
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-2">
          <Label className="text-sm">Periode:</Label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6">Sidste 6 måneder</SelectItem>
              <SelectItem value="12">Sidste 12 måneder</SelectItem>
              <SelectItem value="24">Sidste 24 måneder</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Trend Chart */}
        {isLoading ? (
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            Indlæser...
          </div>
        ) : (
          <TrendChart data={data?.monthly_summary || []} />
        )}

        {/* Charts and Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {isLoading ? (
            <>
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                Indlæser...
              </div>
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                Indlæser...
              </div>
            </>
          ) : (
            <>
              <ExpensesByCategoryChart data={data?.expenses_by_category || []} />
              <TopExpensesTable data={data?.top_expenses || []} />
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
