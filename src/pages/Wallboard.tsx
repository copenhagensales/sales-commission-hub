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

    // Fetch sales with items
    const { data: salesData } = await supabase
      .from('sales')
      .select(`
        id,
        sale_datetime,
        agent_name,
        sale_items (
          mapped_commission,
          mapped_revenue
        )
      `)
      .gte('sale_datetime', startOfMonth);

    if (!salesData) return;

    // Calculate stats
    const todaysSales = salesData.filter(s => s.sale_datetime && new Date(s.sale_datetime) >= new Date(startOfToday));
    
    let revenueToday = 0;
    todaysSales.forEach(sale => {
      sale.sale_items?.forEach((item: any) => {
        revenueToday += Number(item.mapped_revenue) || 0;
      });
    });

    let revenueThisMonth = 0;
    salesData.forEach(sale => {
      sale.sale_items?.forEach((item: any) => {
        revenueThisMonth += Number(item.mapped_revenue) || 0;
      });
    });

    // Get unique active agents today
    const activeAgentNames = new Set(todaysSales.map(s => s.agent_name).filter(Boolean));

    setStats({
      salesToday: todaysSales.length,
      revenueToday,
      salesThisMonth: salesData.length,
      revenueThisMonth,
      activeAgents: activeAgentNames.size,
    });

    // Calculate top agents for today
    const agentSalesMap = new Map<string, { name: string; sales: number; revenue: number }>();
    
    todaysSales.forEach(sale => {
      const agentName = sale.agent_name;
      if (agentName) {
        const existing = agentSalesMap.get(agentName) || { name: agentName, sales: 0, revenue: 0 };
        existing.sales += 1;
        sale.sale_items?.forEach((item: any) => {
          existing.revenue += Number(item.mapped_revenue) || 0;
        });
        agentSalesMap.set(agentName, existing);
      }
    });

    const sortedAgents = Array.from(agentSalesMap.values())
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 3);

    setTopAgents(sortedAgents);
  };

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => fetchData(), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('wallboard-sales')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sales' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const formatCurrency = (value: number) => value.toLocaleString('da-DK');

  return (
    <div className="min-h-screen bg-background p-8">
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

      <div className="grid gap-6 lg:grid-cols-4 mb-8">
        <div className="rounded-2xl bg-gradient-to-br from-green-500/20 to-green-500/5 border border-green-500/20 p-8 text-center">
          <ShoppingCart className="mx-auto h-12 w-12 text-green-500 mb-4" />
          <p className="text-7xl font-bold text-green-500 mb-2">{stats.salesToday}</p>
          <p className="text-xl text-muted-foreground">Salg i dag</p>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 p-8 text-center">
          <DollarSign className="mx-auto h-12 w-12 text-primary mb-4" />
          <p className="text-5xl font-bold text-primary mb-2">{formatCurrency(stats.revenueToday)}</p>
          <p className="text-xl text-muted-foreground">Omsætning i dag</p>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/20 p-8 text-center">
          <TrendingUp className="mx-auto h-12 w-12 text-amber-500 mb-4" />
          <p className="text-5xl font-bold text-amber-500 mb-2">{formatCurrency(stats.revenueThisMonth)}</p>
          <p className="text-xl text-muted-foreground">Omsætning md.</p>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-accent to-accent/50 border border-border p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-foreground mb-4" />
          <p className="text-7xl font-bold text-foreground mb-2">{stats.salesThisMonth}</p>
          <p className="text-xl text-muted-foreground">Salg denne md.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-8">
        <h2 className="mb-6 text-2xl font-bold text-foreground flex items-center gap-3">
          <Trophy className="h-8 w-8 text-amber-500" />
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
                    ? "bg-gradient-to-br from-amber-500/20 to-amber-500/5 border-2 border-amber-500/30" 
                    : "bg-muted/30 border border-border"
                }`}
              >
                <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full text-3xl font-bold ${
                  index === 0 ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"
                }`}>
                  {index + 1}
                </div>
                <p className="text-2xl font-bold text-foreground">{agent.name}</p>
                <p className="mt-2 text-4xl font-bold text-green-500">{agent.sales}</p>
                <p className="text-muted-foreground">salg</p>
                <p className="mt-1 text-lg text-primary font-semibold">{formatCurrency(agent.revenue)} kr</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="mt-8 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          Live-opdatering aktiv
        </div>
      </footer>
    </div>
  );
}
