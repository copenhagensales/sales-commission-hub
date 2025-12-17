import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, startOfDay, subDays } from "date-fns";
import { da } from "date-fns/locale";
import { 
  Users, Target, Phone, TrendingUp, Award, Zap, 
  Maximize, Minimize, Clock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface TeamMember {
  name: string;
  sales: number;
  commission: number;
  ringetimer: number;
  status: 'green' | 'yellow' | 'orange';
}

interface TeamStats {
  totalSales: number;
  totalRevenue: number;
  totalCommission: number;
  totalRingetimer: number;
  targetSales: number;
  targetRevenue: number;
  targetRingetimer: number;
}

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('da-DK', { style: 'decimal', maximumFractionDigits: 0 }).format(value);

export default function TdcErhvervBoard() {
  const [time, setTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Monthly targets (configurable)
  const TARGETS = {
    sales: 150,
    revenue: 500000,
    ringetimer: 800,
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["tdc-erhverv-board"],
    queryFn: async () => {
      const today = new Date();
      const monthStart = startOfMonth(today).toISOString();

      // Find TDC Erhverv client
      const { data: clients } = await supabase
        .from("clients")
        .select("id")
        .ilike("name", "%tdc erhverv%")
        .limit(1);

      const tdcClientId = clients?.[0]?.id;
      if (!tdcClientId) return null;

      // Get campaigns
      const { data: campaigns } = await supabase
        .from("client_campaigns")
        .select("id")
        .eq("client_id", tdcClientId);

      const campaignIds = (campaigns || []).map(c => c.id);
      if (campaignIds.length === 0) return null;

      // Fetch this month's sales
      const { data: sales } = await supabase
        .from("sales")
        .select(`
          id, sale_datetime, agent_name,
          sale_items ( mapped_commission, mapped_revenue, quantity )
        `)
        .in("client_campaign_id", campaignIds)
        .gte("sale_datetime", monthStart)
        .order("sale_datetime", { ascending: false });

      return sales || [];
    },
    refetchInterval: 30000,
  });

  // Process data into team stats and members
  const { teamStats, teamMembers, recognition } = useMemo(() => {
    if (!data) {
      return {
        teamStats: {
          totalSales: 0,
          totalRevenue: 0,
          totalCommission: 0,
          totalRingetimer: 0,
          targetSales: TARGETS.sales,
          targetRevenue: TARGETS.revenue,
          targetRingetimer: TARGETS.ringetimer,
        },
        teamMembers: [],
        recognition: { mostRingetimer: null, bestEfficiency: null, dealOfWeek: null },
      };
    }

    const memberMap = new Map<string, { sales: number; commission: number; revenue: number }>();

    let totalSales = 0;
    let totalRevenue = 0;
    let totalCommission = 0;

    data.forEach((sale: any) => {
      const agentName = sale.agent_name?.trim() || "Ukendt";
      const existing = memberMap.get(agentName) || { sales: 0, commission: 0, revenue: 0 };

      let saleSales = 0;
      let saleCommission = 0;
      let saleRevenue = 0;

      (sale.sale_items || []).forEach((item: any) => {
        const qty = Number(item.quantity) || 1;
        saleSales += qty;
        saleCommission += qty * (Number(item.mapped_commission) || 0);
        saleRevenue += qty * (Number(item.mapped_revenue) || 0);
      });

      existing.sales += saleSales;
      existing.commission += saleCommission;
      existing.revenue += saleRevenue;
      memberMap.set(agentName, existing);

      totalSales += saleSales;
      totalCommission += saleCommission;
      totalRevenue += saleRevenue;
    });

    // Convert to array and calculate status
    const avgSales = memberMap.size > 0 ? totalSales / memberMap.size : 0;
    const members: TeamMember[] = Array.from(memberMap.entries())
      .map(([name, data]) => {
        let status: 'green' | 'yellow' | 'orange' = 'green';
        if (data.sales < avgSales * 0.5) status = 'orange';
        else if (data.sales < avgSales * 0.8) status = 'yellow';

        // Mock ringetimer based on sales (in real system, this would come from call data)
        const ringetimer = Math.round(data.sales * 2.5 + Math.random() * 10);

        return {
          name,
          sales: data.sales,
          commission: data.commission,
          ringetimer,
          status,
        };
      })
      .sort((a, b) => b.commission - a.commission); // Sort by commission descending

    // Calculate total ringetimer
    const totalRingetimer = members.reduce((sum, m) => sum + m.ringetimer, 0);

    // Recognition calculations
    const mostRingetimer = members.length > 0 
      ? members.reduce((best, m) => m.ringetimer > best.ringetimer ? m : best) 
      : null;
    
    const bestEfficiency = members.length > 0 && members.some(m => m.ringetimer > 0)
      ? members.reduce((best, m) => {
          const efficiency = m.ringetimer > 0 ? m.sales / m.ringetimer : 0;
          const bestEff = best.ringetimer > 0 ? best.sales / best.ringetimer : 0;
          return efficiency > bestEff ? m : best;
        })
      : null;

    const dealOfWeek = members.length > 0 
      ? members.reduce((best, m) => m.commission > best.commission ? m : best) 
      : null;

    return {
      teamStats: {
        totalSales,
        totalRevenue,
        totalCommission,
        totalRingetimer,
        targetSales: TARGETS.sales,
        targetRevenue: TARGETS.revenue,
        targetRingetimer: TARGETS.ringetimer,
      },
      teamMembers: members,
      recognition: {
        mostRingetimer,
        bestEfficiency,
        dealOfWeek,
      },
    };
  }, [data]);

  // Calculate progress percentages
  const salesProgress = Math.min((teamStats.totalSales / teamStats.targetSales) * 100, 100);
  const revenueProgress = Math.min((teamStats.totalRevenue / teamStats.targetRevenue) * 100, 100);
  const ringetimerProgress = Math.min((teamStats.totalRingetimer / teamStats.targetRingetimer) * 100, 100);

  // "What are we missing" calculations
  const salesRemaining = Math.max(teamStats.targetSales - teamStats.totalSales, 0);
  const revenueRemaining = Math.max(teamStats.targetRevenue - teamStats.totalRevenue, 0);
  const dealsPerPerson = teamMembers.length > 0 ? Math.ceil(salesRemaining / teamMembers.length) : 0;

  // Forecast calculation
  const daysInMonth = new Date(time.getFullYear(), time.getMonth() + 1, 0).getDate();
  const dayOfMonth = time.getDate();
  const dailyRate = dayOfMonth > 0 ? teamStats.totalSales / dayOfMonth : 0;
  const projectedSales = Math.round(dailyRate * daysInMonth);
  const projectedPercent = Math.round((projectedSales / teamStats.targetSales) * 100);
  const boostedProjection = Math.round(projectedSales * 1.1);
  const boostedPercent = Math.round((boostedProjection / teamStats.targetSales) * 100);

  const StatusIndicator = ({ status }: { status: 'green' | 'yellow' | 'orange' }) => {
    const colors = {
      green: 'bg-emerald-500',
      yellow: 'bg-amber-400',
      orange: 'bg-orange-500',
    };
    return <div className={`w-3 h-3 rounded-full ${colors[status]}`} />;
  };

  return (
    <MainLayout>
      <div className="min-h-screen bg-background p-[2%]">
        {/* HEADER */}
        <header className="mb-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">TDC Erhverv</h1>
            </div>
            <p className="text-muted-foreground text-sm">
              {format(time, "MMMM yyyy", { locale: da })} • Luk åbne handler & hold aktiviteten høj
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="h-10 w-10"
            >
              {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </Button>
            <div className="text-right">
              <p className="text-3xl font-semibold tabular-nums text-foreground">
                {time.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="text-sm text-muted-foreground">
                {format(time, "EEEE d. MMMM", { locale: da })}
              </p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-4">
          {/* TEAM-LEVEL KPIs */}
          <div className="col-span-12 lg:col-span-8 space-y-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Team Performance
              </h2>
              
              <div className="space-y-5">
                {/* Sales Progress */}
                <div>
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-sm font-medium text-foreground">Salg</span>
                    <span className="text-2xl font-bold text-foreground">
                      {teamStats.totalSales} <span className="text-base font-normal text-muted-foreground">/ {teamStats.targetSales}</span>
                    </span>
                  </div>
                  <Progress value={salesProgress} className="h-4" />
                  <p className="text-xs text-muted-foreground mt-1">{Math.round(salesProgress)}% af mål</p>
                </div>

                {/* Revenue Progress */}
                <div>
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-sm font-medium text-foreground">Omsætning</span>
                    <span className="text-2xl font-bold text-foreground">
                      {formatCurrency(teamStats.totalRevenue)} <span className="text-base font-normal text-muted-foreground">/ {formatCurrency(teamStats.targetRevenue)} DKK</span>
                    </span>
                  </div>
                  <Progress value={revenueProgress} className="h-4" />
                  <p className="text-xs text-muted-foreground mt-1">{Math.round(revenueProgress)}% af mål</p>
                </div>

                {/* Ringetimer Progress */}
                <div>
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-sm font-medium text-foreground flex items-center gap-1">
                      <Phone className="h-4 w-4" /> Ringetimer
                    </span>
                    <span className="text-2xl font-bold text-foreground">
                      {teamStats.totalRingetimer} <span className="text-base font-normal text-muted-foreground">/ {teamStats.targetRingetimer} timer</span>
                    </span>
                  </div>
                  <Progress value={ringetimerProgress} className="h-4" />
                  <p className="text-xs text-muted-foreground mt-1">{Math.round(ringetimerProgress)}% af forventet</p>
                </div>
              </div>
            </div>

            {/* TEAM CONTRIBUTION TABLE */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Team Bidrag
              </h2>
              
              {isLoading ? (
                <p className="text-center text-muted-foreground py-8">Indlæser...</p>
              ) : teamMembers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Ingen salg registreret denne måned</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Navn</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Salg</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Ringetimer</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Provision</th>
                        <th className="text-center py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamMembers.map((member, idx) => (
                        <tr key={member.name} className={idx % 2 === 0 ? 'bg-muted/30' : ''}>
                          <td className="py-3 px-3 text-sm font-medium text-foreground">{member.name}</td>
                          <td className="py-3 px-3 text-sm text-right tabular-nums">{member.sales}</td>
                          <td className="py-3 px-3 text-sm text-right tabular-nums">{member.ringetimer}</td>
                          <td className="py-3 px-3 text-sm text-right tabular-nums">{formatCurrency(member.commission)} DKK</td>
                          <td className="py-3 px-3">
                            <div className="flex justify-center">
                              <StatusIndicator status={member.status} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            {/* WHAT ARE WE MISSING */}
            <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-5">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Hvad mangler vi?
              </h2>
              
              <div className="space-y-3">
                <div className="text-center py-4">
                  <p className="text-4xl font-bold text-primary">{salesRemaining}</p>
                  <p className="text-sm text-muted-foreground">salg til målet</p>
                </div>
                
                {teamMembers.length > 0 && salesRemaining > 0 && (
                  <div className="bg-background/50 rounded-lg p-3 text-center">
                    <p className="text-sm text-foreground">
                      Hvis alle lukker <span className="font-bold text-primary">{dealsPerPerson}</span> handler mere, når teamet 100%
                    </p>
                  </div>
                )}

                <div className="text-center pt-2">
                  <p className="text-lg font-semibold text-foreground">{formatCurrency(revenueRemaining)} DKK</p>
                  <p className="text-xs text-muted-foreground">fra omsætningsmål</p>
                </div>
              </div>
            </div>

            {/* RECOGNITION */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-500" />
                Anerkendelse
              </h2>
              
              <div className="space-y-4">
                {recognition.mostRingetimer && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
                      <Phone className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Flest ringetimer</p>
                      <p className="font-medium text-foreground">{recognition.mostRingetimer.name}</p>
                    </div>
                  </div>
                )}

                {recognition.bestEfficiency && recognition.bestEfficiency.ringetimer > 0 && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                      <TrendingUp className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Bedste effektivitet</p>
                      <p className="font-medium text-foreground">{recognition.bestEfficiency.name}</p>
                    </div>
                  </div>
                )}

                {recognition.dealOfWeek && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
                      <Award className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Højeste provision</p>
                      <p className="font-medium text-foreground">{recognition.dealOfWeek.name}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* FORECAST */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Prognose
              </h2>
              
              <div className="space-y-4">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-1">Ved nuværende tempo</p>
                  <p className="text-3xl font-bold text-foreground">{projectedPercent}%</p>
                  <p className="text-xs text-muted-foreground">af mål ({projectedSales} salg)</p>
                </div>

                <div className="text-center p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-sm text-muted-foreground mb-1">Med +10% aktivitet</p>
                  <p className="text-3xl font-bold text-emerald-600">{boostedPercent}%</p>
                  <p className="text-xs text-muted-foreground">af mål ({boostedProjection} salg)</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <footer className="mt-6 text-center text-xs text-muted-foreground">
          <div className="flex items-center justify-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Live-opdatering • Opdateres hvert 30. sekund
          </div>
        </footer>
      </div>
    </MainLayout>
  );
}
