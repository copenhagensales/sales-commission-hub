import { MainLayout } from "@/components/layout/MainLayout";
import { KPICard } from "@/components/dashboard/KPICard";
import { TopAgentsTable } from "@/components/dashboard/TopAgentsTable";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { SickLeaveChart } from "@/components/dashboard/SickLeaveChart";
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  RefreshCw, 
  Loader2, 
  DollarSign,
  Thermometer,
  Palmtree,
  PiggyBank
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DashboardStats {
  // Economic KPIs
  revenue: number;
  commissionCosts: number;
  vacationPayCosts: number;
  sickPayCosts: number;
  netMargin: number;
  
  // Performance KPIs
  salesThisMonth: number;
  clawbackRate: number;
  clawbackedSalesCount: number;
  
  // Absence KPIs
  sickDaysThisMonth: number;
  totalWorkDays: number;
  sickPercentage: number;
  
  // Legacy
  salesToday: number;
  salesYesterday: number;
  earnedCommission: number;
  pendingCommission: number;
  pendingSalesCount: number;
}

interface TopAgent {
  id: string;
  name: string;
  sales: number;
  commission: number;
  revenue: number;
}

export default function Dashboard() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    revenue: 0,
    commissionCosts: 0,
    vacationPayCosts: 0,
    sickPayCosts: 0,
    netMargin: 0,
    salesThisMonth: 0,
    clawbackRate: 0,
    clawbackedSalesCount: 0,
    sickDaysThisMonth: 0,
    totalWorkDays: 0,
    sickPercentage: 0,
    salesToday: 0,
    salesYesterday: 0,
    earnedCommission: 0,
    pendingCommission: 0,
    pendingSalesCount: 0,
  });
  const [topAgents, setTopAgents] = useState<TopAgent[]>([]);

  const fetchDashboardData = async () => {
    try {
      // Get current date info - aktuel måned
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const startOfYesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1).toISOString();

      // Calculate working days this month (approx 22 days per month)
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const daysSoFar = today.getDate();
      const workDaysInMonth = Math.round(daysInMonth * (5/7));
      const workDaysSoFar = Math.round(daysSoFar * (5/7));

      // Fetch sales with product info for revenue calculation
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          id, 
          sale_date, 
          status, 
          agent_id,
          sale_amount,
          product_id,
          products (
            id,
            name,
            revenue_amount,
            commission_value,
            commission_type
          )
        `)
        .gte('sale_date', startOfMonth);

      if (salesError) throw salesError;

      // Calculate sales stats
      const activeSales = salesData?.filter(s => s.status === 'active' || s.status === 'pending') || [];
      const clawbackedSales = salesData?.filter(s => s.status === 'clawbacked' || s.status === 'cancelled') || [];
      const totalSales = salesData?.length || 0;
      const clawbackRate = totalSales > 0 ? (clawbackedSales.length / totalSales) * 100 : 0;

      const salesToday = salesData?.filter(s => s.sale_date && new Date(s.sale_date) >= new Date(startOfToday)).length || 0;
      const salesYesterday = salesData?.filter(s => {
        if (!s.sale_date) return false;
        const saleDate = new Date(s.sale_date);
        return saleDate >= new Date(startOfYesterday) && saleDate < new Date(startOfToday);
      }).length || 0;

      // Calculate revenue from active/pending sales
      let revenue = 0;
      activeSales.forEach(sale => {
        const product = sale.products as any;
        if (product?.revenue_amount) {
          revenue += product.revenue_amount;
        }
      });

      // Fetch commission transactions
      const { data: commissionData, error: commissionError } = await supabase
        .from('commission_transactions')
        .select('type, amount, sale_id, agent_id')
        .gte('created_at', startOfMonth);

      if (commissionError) throw commissionError;

      // Calculate commission costs (earned - clawback = net cost)
      let earnedCommission = 0;
      let clawbackedCommission = 0;
      
      commissionData?.forEach(ct => {
        if (ct.type === 'earn') {
          earnedCommission += ct.amount || 0;
        } else if (ct.type === 'clawback') {
          clawbackedCommission += Math.abs(ct.amount || 0);
        }
      });

      const commissionCosts = earnedCommission - clawbackedCommission;
      
      // Vacation pay is typically 12.5% of commission
      const vacationPayRate = 0.125;
      const vacationPayCosts = commissionCosts * vacationPayRate;

      // Fetch absences for sick leave calculation
      const { data: absencesData, error: absencesError } = await supabase
        .from('absences')
        .select('id, agent_id, type, hours, date')
        .eq('type', 'sick')
        .gte('date', startOfMonth.split('T')[0]);

      if (absencesError) throw absencesError;

      // Calculate sick days
      const sickDaysThisMonth = absencesData?.reduce((sum, a) => sum + ((a.hours || 7.5) / 7.5), 0) || 0;
      
      // Calculate sick pay based on average daily earnings
      // Get average daily commission per agent
      const { data: agentsData, error: agentsError } = await supabase
        .from('agents')
        .select('id, name')
        .eq('is_active', true);

      if (agentsError) throw agentsError;

      // Calculate average daily commission (rough estimate based on this month)
      const avgDailyCommission = workDaysSoFar > 0 && agentsData && agentsData.length > 0
        ? commissionCosts / (workDaysSoFar * agentsData.length)
        : 500; // Default assumption if no data

      const sickPayCosts = sickDaysThisMonth * avgDailyCommission;

      // Calculate sick percentage
      const totalPossibleWorkDays = (agentsData?.length || 1) * workDaysSoFar;
      const sickPercentage = totalPossibleWorkDays > 0 
        ? (sickDaysThisMonth / totalPossibleWorkDays) * 100 
        : 0;

      // Calculate net margin
      const netMargin = revenue - commissionCosts - vacationPayCosts - sickPayCosts;

      // Calculate pending commission
      const pendingSales = salesData?.filter(s => s.status === 'pending') || [];
      const pendingCommissions = commissionData?.filter(ct => 
        ct.type === 'earn' && pendingSales.some(s => s.id === ct.sale_id)
      ) || [];
      const pendingCommission = pendingCommissions.reduce((sum, ct) => sum + (ct.amount || 0), 0);

      setStats({
        revenue,
        commissionCosts,
        vacationPayCosts,
        sickPayCosts,
        netMargin,
        salesThisMonth: totalSales,
        clawbackRate,
        clawbackedSalesCount: clawbackedSales.length,
        sickDaysThisMonth,
        totalWorkDays: totalPossibleWorkDays,
        sickPercentage,
        salesToday,
        salesYesterday,
        earnedCommission,
        pendingCommission,
        pendingSalesCount: pendingSales.length,
      });

      // Calculate agent stats for top agents
      const agentStats: TopAgent[] = [];
      
      for (const agent of agentsData || []) {
        const agentSales = salesData?.filter(s => s.agent_id === agent.id) || [];
        const agentActiveSales = agentSales.filter(s => s.status === 'active' || s.status === 'pending');
        
        // Calculate agent revenue
        let agentRevenue = 0;
        agentActiveSales.forEach(sale => {
          const product = sale.products as any;
          if (product?.revenue_amount) {
            agentRevenue += product.revenue_amount;
          }
        });

        const agentCommission = commissionData?.filter(ct => ct.agent_id === agent.id)
          .reduce((sum, ct) => sum + (ct.amount || 0), 0) || 0;

        if (agentSales.length > 0 || agentCommission > 0) {
          agentStats.push({
            id: agent.id,
            name: agent.name,
            sales: agentActiveSales.length,
            commission: agentCommission,
            revenue: agentRevenue,
          });
        }
      }

      // Sort by revenue and take top 5
      agentStats.sort((a, b) => b.revenue - a.revenue);
      setTopAgents(agentStats.slice(0, 5));

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Kunne ikke hente dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-adversus', {
        body: { hours: 24 }
      });

      if (error) throw error;

      toast.success(`Synkronisering fuldført: ${data.summary?.sessions?.salesCreated || 0} nye salg`);
      await fetchDashboardData();
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Synkronisering fejlede');
    } finally {
      setIsSyncing(false);
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('da-DK') + ' kr';
  };

  const formatPercent = (value: number) => {
    return value.toFixed(1) + '%';
  };

  const currentMonth = new Date().toLocaleDateString('da-DK', { month: 'long', year: 'numeric' });

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
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
            <p className="mt-1 text-muted-foreground">
              Økonomisk overblik for {currentMonth}
            </p>
          </div>
          <Button 
            onClick={handleSync} 
            disabled={isSyncing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            Synkroniser Adversus
          </Button>
        </div>

        {/* Top KPIs - Economic Overview */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Omsætning"
            value={formatCurrency(stats.revenue)}
            icon={DollarSign}
            variant="success"
            subtitle={currentMonth}
          />
          <KPICard
            title="Netto margin"
            value={formatCurrency(stats.netMargin)}
            icon={stats.netMargin >= 0 ? TrendingUp : TrendingDown}
            variant={stats.netMargin >= 0 ? "success" : "danger"}
            subtitle="Efter alle udgifter"
          />
          <KPICard
            title="Salgsomkostninger"
            value={formatCurrency(stats.commissionCosts + stats.vacationPayCosts)}
            icon={Wallet}
            subtitle="Provision + feriepenge"
          />
          <KPICard
            title="Sygeprocent"
            value={formatPercent(stats.sickPercentage)}
            icon={Thermometer}
            variant={stats.sickPercentage > 5 ? "danger" : stats.sickPercentage > 3 ? "warning" : "success"}
            subtitle={`${stats.sickDaysThisMonth.toFixed(1)} sygedage`}
          />
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          <RevenueChart />
          <SickLeaveChart />
        </div>

        {/* Performance & Details Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          <TopAgentsTable agents={topAgents} />
          
          {/* Economic Summary */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <PiggyBank className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Økonomisk overblik</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">{currentMonth}</p>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Omsætning</span>
                <span className="font-semibold text-success">+{formatCurrency(stats.revenue)}</span>
              </div>
              
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Provision</span>
                <span className="font-semibold text-danger">-{formatCurrency(stats.commissionCosts)}</span>
              </div>
              
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Feriepenge (12.5%)</span>
                <span className="font-semibold text-danger">-{formatCurrency(stats.vacationPayCosts)}</span>
              </div>
              
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Sygeløn</span>
                <span className="font-semibold text-danger">-{formatCurrency(stats.sickPayCosts)}</span>
              </div>
              
              <div className="flex items-center justify-between py-3 bg-muted/50 rounded-lg px-3 -mx-3">
                <span className="font-semibold text-foreground">Netto margin</span>
                <span className={`text-xl font-bold ${stats.netMargin >= 0 ? 'text-success' : 'text-danger'}`}>
                  {stats.netMargin >= 0 ? '' : '-'}{formatCurrency(Math.abs(stats.netMargin))}
                </span>
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-border">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{stats.salesThisMonth}</p>
                <p className="text-xs text-muted-foreground">Salg i alt</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{formatPercent(stats.clawbackRate)}</p>
                <p className="text-xs text-muted-foreground">Clawback rate</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
