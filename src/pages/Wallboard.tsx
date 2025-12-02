import { useEffect, useState } from "react";
import { DollarSign, ShoppingCart, Trophy, TrendingUp, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TopAgent {
  name: string;
  sales: number;
  revenue: number;
}

interface WallboardStats {
  salesToday: number;
  revenueToday: number;
  salesThisMonth: number;
  revenueThisMonth: number;
  activeAgents: number;
}

export default function Wallboard() {
  const [time, setTime] = useState(new Date());
  const [topAgents, setTopAgents] = useState<TopAgent[]>([]);
  const [stats, setStats] = useState<WallboardStats>({
    salesToday: 0,
    revenueToday: 0,
    salesThisMonth: 0,
    revenueThisMonth: 0,
    activeAgents: 0,
  });

  const fetchData = async () => {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

    // Fetch sales with product and agent info
    const { data: salesData } = await supabase
      .from('sales')
      .select(`
        id,
        sale_date,
        status,
        agent_id,
        agents!sales_agent_id_fkey(id, name),
        products!sales_product_id_fkey(revenue_amount)
      `)
      .gte('sale_date', startOfMonth)
      .in('status', ['active', 'pending']);

    if (!salesData) return;

    // Calculate stats
    const todaysSales = salesData.filter(s => s.sale_date && new Date(s.sale_date) >= new Date(startOfToday));
    
    let revenueToday = 0;
    todaysSales.forEach(sale => {
      const product = sale.products as any;
      if (product?.revenue_amount) {
        revenueToday += product.revenue_amount;
      }
    });

    let revenueThisMonth = 0;
    salesData.forEach(sale => {
      const product = sale.products as any;
      if (product?.revenue_amount) {
        revenueThisMonth += product.revenue_amount;
      }
    });

    // Get unique active agents today
    const activeAgentIds = new Set(todaysSales.map(s => s.agent_id));

    setStats({
      salesToday: todaysSales.length,
      revenueToday,
      salesThisMonth: salesData.length,
      revenueThisMonth,
      activeAgents: activeAgentIds.size,
    });

    // Calculate top agents for today
    const agentSalesMap = new Map<string, { name: string; sales: number; revenue: number }>();
    
    todaysSales.forEach(sale => {
      const agent = sale.agents as any;
      const product = sale.products as any;
      if (agent?.name) {
        const existing = agentSalesMap.get(agent.id) || { name: agent.name, sales: 0, revenue: 0 };
        existing.sales += 1;
        existing.revenue += product?.revenue_amount || 0;
        agentSalesMap.set(agent.id, existing);
      }
    });

    const sortedAgents = Array.from(agentSalesMap.values())
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 3);

    setTopAgents(sortedAgents);
  };

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Real-time subscription for new sales
  useEffect(() => {
    const channel = supabase
      .channel('wallboard-sales')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sales'
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const formatCurrency = (value: number) => value.toLocaleString('da-DK');

  return (
    <div className="min-h-screen bg-background p-8">
      {/* Header */}
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <TrendingUp className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold text-foreground">CPH Sales Live</h1>
        </div>
        <div className="text-right">
          <p className="text-5xl font-bold tabular-nums text-foreground">
            {time.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="text-xl text-muted-foreground">
            {time.toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
      </header>

      {/* Main Stats Grid */}
      <div className="grid gap-6 lg:grid-cols-4 mb-8">
        <div className="rounded-2xl bg-gradient-to-br from-success/20 to-success/5 border border-success/20 p-8 text-center">
          <ShoppingCart className="mx-auto h-12 w-12 text-success mb-4" />
          <p className="text-7xl font-bold text-success mb-2">{stats.salesToday}</p>
          <p className="text-xl text-muted-foreground">Salg i dag</p>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 p-8 text-center">
          <DollarSign className="mx-auto h-12 w-12 text-primary mb-4" />
          <p className="text-5xl font-bold text-primary mb-2">{formatCurrency(stats.revenueToday)}</p>
          <p className="text-xl text-muted-foreground">Omsætning i dag</p>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-warning/20 to-warning/5 border border-warning/20 p-8 text-center">
          <TrendingUp className="mx-auto h-12 w-12 text-warning mb-4" />
          <p className="text-5xl font-bold text-warning mb-2">{formatCurrency(stats.revenueThisMonth)}</p>
          <p className="text-xl text-muted-foreground">Omsætning md.</p>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-accent to-accent/50 border border-border p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-foreground mb-4" />
          <p className="text-7xl font-bold text-foreground mb-2">{stats.salesThisMonth}</p>
          <p className="text-xl text-muted-foreground">Salg denne md.</p>
        </div>
      </div>

      {/* Top Performers */}
      <div className="rounded-2xl border border-border bg-card p-8">
        <h2 className="mb-6 text-2xl font-bold text-foreground flex items-center gap-3">
          <Trophy className="h-8 w-8 text-warning" />
          Dagens Top 3
        </h2>
        {topAgents.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Ingen salg registreret i dag endnu</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {topAgents.map((agent, index) => (
              <div 
                key={agent.name}
                className={`rounded-xl p-6 text-center ${
                  index === 0 
                    ? "bg-gradient-to-br from-warning/20 to-warning/5 border-2 border-warning/30" 
                    : "bg-muted/30 border border-border"
                }`}
              >
                <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full text-3xl font-bold ${
                  index === 0 
                    ? "bg-warning text-warning-foreground" 
                    : "bg-muted text-muted-foreground"
                }`}>
                  {index + 1}
                </div>
                <p className="text-2xl font-bold text-foreground">{agent.name}</p>
                <p className="mt-2 text-4xl font-bold text-success">{agent.sales}</p>
                <p className="text-muted-foreground">salg</p>
                <p className="mt-1 text-lg text-primary font-semibold">{formatCurrency(agent.revenue)} kr</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer with auto-refresh indicator */}
      <footer className="mt-8 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
          </span>
          Live-opdatering aktiv
        </div>
      </footer>
    </div>
  );
}