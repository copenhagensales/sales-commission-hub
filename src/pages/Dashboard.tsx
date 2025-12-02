import { MainLayout } from "@/components/layout/MainLayout";
import { KPICard } from "@/components/dashboard/KPICard";
import { TopAgentsTable } from "@/components/dashboard/TopAgentsTable";
import { Phone, ShoppingCart, TrendingUp, Wallet, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DashboardStats {
  salesToday: number;
  salesYesterday: number;
  salesThisMonth: number;
  earnedCommission: number;
  clawbackedCommission: number;
  pendingCommission: number;
  pendingSalesCount: number;
  clawbackedSalesCount: number;
}

interface TopAgent {
  id: string;
  name: string;
  sales: number;
  commission: number;
}

export default function Dashboard() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    salesToday: 0,
    salesYesterday: 0,
    salesThisMonth: 0,
    earnedCommission: 0,
    clawbackedCommission: 0,
    pendingCommission: 0,
    pendingSalesCount: 0,
    clawbackedSalesCount: 0,
  });
  const [topAgents, setTopAgents] = useState<TopAgent[]>([]);

  const fetchDashboardData = async () => {
    try {
      // Get current date info
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const startOfYesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1).toISOString();

      // Fetch sales data
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('id, sale_date, status, agent_id');

      if (salesError) throw salesError;

      // Calculate sales stats
      const salesToday = salesData?.filter(s => s.sale_date && new Date(s.sale_date) >= new Date(startOfToday)).length || 0;
      const salesYesterday = salesData?.filter(s => {
        if (!s.sale_date) return false;
        const saleDate = new Date(s.sale_date);
        return saleDate >= new Date(startOfYesterday) && saleDate < new Date(startOfToday);
      }).length || 0;
      const salesThisMonth = salesData?.filter(s => s.sale_date && new Date(s.sale_date) >= new Date(startOfMonth)).length || 0;

      // Fetch commission data for this month
      const { data: commissionData, error: commissionError } = await supabase
        .from('commission_transactions')
        .select('type, amount, sale_id')
        .gte('created_at', startOfMonth);

      if (commissionError) throw commissionError;

      // Calculate commission breakdown
      let earnedCommission = 0;
      let clawbackedCommission = 0;

      commissionData?.forEach(ct => {
        if (ct.type === 'earn') {
          earnedCommission += ct.amount || 0;
        } else if (ct.type === 'clawback') {
          clawbackedCommission += Math.abs(ct.amount || 0);
        }
      });

      // Calculate pending (sales in clawback window)
      const pendingSales = salesData?.filter(s => s.status === 'pending') || [];
      const pendingCommissions = commissionData?.filter(ct => 
        ct.type === 'earn' && pendingSales.some(s => s.id === ct.sale_id)
      ) || [];
      const pendingCommission = pendingCommissions.reduce((sum, ct) => sum + (ct.amount || 0), 0);

      // Count clawbacked sales
      const clawbackedSalesCount = salesData?.filter(s => s.status === 'clawbacked' || s.status === 'cancelled').length || 0;

      setStats({
        salesToday,
        salesYesterday,
        salesThisMonth,
        earnedCommission,
        clawbackedCommission,
        pendingCommission,
        pendingSalesCount: pendingSales.length,
        clawbackedSalesCount,
      });

      // Fetch top agents
      const { data: agentsData, error: agentsError } = await supabase
        .from('agents')
        .select('id, name')
        .eq('is_active', true);

      if (agentsError) throw agentsError;

      // Calculate agent stats for this month
      const agentStats: TopAgent[] = [];
      
      for (const agent of agentsData || []) {
        const agentSales = salesData?.filter(s => 
          s.agent_id === agent.id && 
          s.sale_date && 
          new Date(s.sale_date) >= new Date(startOfMonth)
        ).length || 0;

        const agentCommission = commissionData?.filter(ct => {
          const sale = salesData?.find(s => s.id === ct.sale_id);
          return sale?.agent_id === agent.id;
        }).reduce((sum, ct) => sum + (ct.amount || 0), 0) || 0;

        if (agentSales > 0 || agentCommission > 0) {
          agentStats.push({
            id: agent.id,
            name: agent.name,
            sales: agentSales,
            commission: agentCommission,
          });
        }
      }

      // Sort by commission and take top 5
      agentStats.sort((a, b) => b.commission - a.commission);
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
      
      // Refresh dashboard data
      await fetchDashboardData();
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Synkronisering fejlede');
    } finally {
      setIsSyncing(false);
    }
  };

  // Calculate trends
  const salesTrend = stats.salesYesterday > 0 
    ? Math.round(((stats.salesToday - stats.salesYesterday) / stats.salesYesterday) * 100)
    : stats.salesToday > 0 ? 100 : 0;

  const formatCurrency = (value: number) => {
    return value.toLocaleString('da-DK') + ' kr';
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
            <p className="mt-1 text-muted-foreground">
              Oversigt over salg og provision
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

        {/* KPI Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Salg i dag"
            value={stats.salesToday}
            icon={ShoppingCart}
            variant="success"
            trend={stats.salesYesterday > 0 ? { value: salesTrend, label: "vs. i går" } : undefined}
          />
          <KPICard
            title="Salg denne måned"
            value={stats.salesThisMonth}
            icon={ShoppingCart}
            subtitle={new Date().toLocaleDateString('da-DK', { month: 'long', year: 'numeric' })}
          />
          <KPICard
            title="Optjent provision"
            value={formatCurrency(stats.earnedCommission)}
            icon={Wallet}
            variant="success"
            subtitle="Denne måned"
          />
          <KPICard
            title="Netto provision"
            value={formatCurrency(stats.earnedCommission - stats.clawbackedCommission)}
            icon={TrendingUp}
            subtitle="Efter clawback"
          />
        </div>

        {/* Second row */}
        <div className="grid gap-6 lg:grid-cols-2">
          <TopAgentsTable agents={topAgents} />
          
          {/* Commission breakdown */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="mb-4 text-lg font-semibold text-foreground">Provisionsoversigt</h3>
            <p className="text-xs text-muted-foreground mb-4">
              {new Date().toLocaleDateString('da-DK', { month: 'long', year: 'numeric' })}
            </p>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-success/10 p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Optjent provision</p>
                  <p className="text-2xl font-bold text-success">{formatCurrency(stats.earnedCommission)}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-success/20 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-success" />
                </div>
              </div>
              
              <div className="flex items-center justify-between rounded-lg bg-warning/10 p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Afventer (pending)</p>
                  <p className="text-2xl font-bold text-warning">{formatCurrency(stats.pendingCommission)}</p>
                </div>
                <div className="text-xs text-muted-foreground">{stats.pendingSalesCount} salg</div>
              </div>
              
              <div className="flex items-center justify-between rounded-lg bg-danger/10 p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Modregnet (clawback)</p>
                  <p className="text-2xl font-bold text-danger">
                    {stats.clawbackedCommission > 0 ? '-' : ''}{formatCurrency(stats.clawbackedCommission)}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground">{stats.clawbackedSalesCount} annulleringer</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
