import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MainLayout } from "@/components/layout/MainLayout";
import { 
  Users, 
  UserPlus, 
  Calendar, 
  CheckCircle2, 
  TrendingUp,
  Phone,
  MessageSquare,
  Mail,
  ArrowRight,
  Percent,
  Ghost,
  Handshake
} from "lucide-react";
import { format, subDays, eachDayOfInterval, startOfDay } from "date-fns";
import { da } from "date-fns/locale";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent 
} from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, BarChart, Bar, Cell, Tooltip, LabelList } from "recharts";
import { Link } from "react-router-dom";

const chartConfig = {
  count: {
    label: "Ansøgninger",
    color: "hsl(var(--primary))",
  },
};

function ReferralKpiSection() {
  const { data: referrals = [] } = useQuery({
    queryKey: ["referral-kpis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_referrals")
        .select("id, status, created_at, hired_date")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const stats = useMemo(() => {
    const active = referrals.filter(r => ["pending", "contacted"].includes(r.status)).length;
    const total = referrals.length;
    const hired = referrals.filter(r => ["hired", "eligible_for_bonus", "bonus_paid"].includes(r.status)).length;
    const rate = total > 0 ? Math.round((hired / total) * 1000) / 10 : 0;
    const recentHired = referrals.filter(r =>
      ["hired", "eligible_for_bonus", "bonus_paid"].includes(r.status) &&
      r.hired_date && new Date(r.hired_date) >= subDays(new Date(), 30)
    ).length;
    const awaitingBonus = referrals.filter(r => r.status === "eligible_for_bonus").length;
    return { active, total, hired, rate, recentHired, awaitingBonus };
  }, [referrals]);

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold text-foreground">Anbefalinger</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Aktive anbefalinger</CardTitle>
            <Handshake className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.active}</div>
            <p className="text-xs text-muted-foreground">af {stats.total} i alt</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ansat via anbefaling (30d)</CardTitle>
            <Handshake className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.recentHired}</div>
            <p className="text-xs text-muted-foreground">{stats.hired} ansat i alt</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Konvertering</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.rate}%</div>
            <p className="text-xs text-muted-foreground">{stats.hired} af {stats.total} anbefalinger</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Afventende bonus</CardTitle>
            <Handshake className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.awaitingBonus}</div>
            <p className="text-xs text-muted-foreground">Klar til udbetaling</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


  const [chartPeriod, setChartPeriod] = useState(30);

  const { data: candidates = [] } = useQuery({
    queryKey: ["candidates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });


  const { data: communicationStats } = useQuery({
    queryKey: ["communication-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communication_logs")
        .select("type")
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      
      if (error) throw error;
      
      const stats = {
        sms: data.filter(c => c.type === "sms").length,
        email: data.filter(c => c.type === "email").length,
        call: data.filter(c => c.type === "call").length,
      };
      return stats;
    },
  });

  const thirtyDaysAgo = subDays(new Date(), 30);
  
  const recentCandidates = useMemo(() => 
    candidates.filter(c => new Date(c.created_at) >= thirtyDaysAgo), 
    [candidates]
  );

  // Conversion stats by position type
  const conversionStats = useMemo(() => {
    const categorize = (pos: string | null) => {
      if (!pos) return "other";
      const lower = pos.toLowerCase();
      if (lower.includes("salgskonsulent") || lower.includes("salg")) return "sales";
      if (lower.includes("field") || lower.includes("marketing")) return "field";
      return "other";
    };

    const statusLabels: Record<string, string> = {
      new: "Ny",
      contacted: "Kontaktet",
      interview_scheduled: "Samtale",
      hired: "Ansat",
      rejected: "Afvist",
      not_qualified: "Ikke-kval.",
      ghostet: "Ghostet",
      declined: "Takket nej",
    };

    const calcForCategory = (cat: string) => {
      const filtered = candidates.filter(c => categorize(c.applied_position) === cat);
      const total = filtered.length;
      const hired = filtered.filter(c => c.status === "hired").length;
      const rate = total > 0 ? Math.round((hired / total) * 1000) / 10 : 0;
      const ghosted = filtered.filter(c => c.status === "ghostet").length;
      const ghostRate = total > 0 ? Math.round((ghosted / total) * 1000) / 10 : 0;

      // 30-day stats
      const now = new Date();
      const thirtyDaysAgo = subDays(now, 30);
      const recent = filtered.filter(c => new Date(c.created_at) >= thirtyDaysAgo);
      const recentTotal = recent.length;
      const recentHired = recent.filter(c => c.status === "hired").length;
      const recentRate = recentTotal > 0 ? Math.round((recentHired / recentTotal) * 1000) / 10 : 0;
      const recentGhosted = recent.filter(c => c.status === "ghostet").length;
      const recentGhostRate = recentTotal > 0 ? Math.round((recentGhosted / recentTotal) * 1000) / 10 : 0;

      const buildFunnel = (list: typeof filtered) => {
        const statusBreakdown: Record<string, number> = {};
        list.forEach(c => {
          statusBreakdown[c.status] = (statusBreakdown[c.status] || 0) + 1;
        });
        const funnelOrder = ["new", "contacted", "interview_scheduled", "hired", "rejected", "not_qualified", "ghostet", "declined"];
        return funnelOrder
          .filter(s => statusBreakdown[s])
          .map(s => ({
            status: statusLabels[s] || s,
            count: statusBreakdown[s],
            key: s,
          }));
      };

      const funnelData = buildFunnel(filtered);
      const recentFunnelData = buildFunnel(recent);

      return { total, hired, rate, recentTotal, recentHired, recentRate, ghosted, ghostRate, recentGhosted, recentGhostRate, funnelData, recentFunnelData };
    };

    return {
      sales: calcForCategory("sales"),
      field: calcForCategory("field"),
    };
  }, [candidates]);

  // KPI calculations with trends
  const kpiStats = useMemo(() => {
    const now = new Date();
    
    // Last 24 hours
    const last24h = candidates.filter(c => new Date(c.created_at) >= subDays(now, 1)).length;
    const prev24h = candidates.filter(c => {
      const created = new Date(c.created_at);
      return created >= subDays(now, 2) && created < subDays(now, 1);
    }).length;
    const trend24h = prev24h > 0 ? Math.round(((last24h - prev24h) / prev24h) * 100) : last24h > 0 ? 100 : 0;

    // Last 7 days
    const last7d = candidates.filter(c => new Date(c.created_at) >= subDays(now, 7)).length;
    const prev7d = candidates.filter(c => {
      const created = new Date(c.created_at);
      return created >= subDays(now, 14) && created < subDays(now, 7);
    }).length;
    const trend7d = prev7d > 0 ? Math.round(((last7d - prev7d) / prev7d) * 100) : last7d > 0 ? 100 : 0;

    // Last 30 days
    const last30d = candidates.filter(c => new Date(c.created_at) >= subDays(now, 30)).length;
    const prev30d = candidates.filter(c => {
      const created = new Date(c.created_at);
      return created >= subDays(now, 60) && created < subDays(now, 30);
    }).length;
    const trend30d = prev30d > 0 ? Math.round(((last30d - prev30d) / prev30d) * 100) : last30d > 0 ? 100 : 0;

    // Scheduled interviews
    const scheduledInterviews = candidates.filter(c => c.status === 'interview_scheduled').length;
    
    return {
      last24h,
      trend24h,
      last7d,
      trend7d,
      last30d,
      trend30d,
      scheduledInterviews,
    };
  }, [candidates]);

  const chartData = useMemo(() => {
    const endDate = startOfDay(new Date());
    const startDate = subDays(endDate, chartPeriod);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    return days.map(day => {
      const dayStart = startOfDay(day);
      const count = candidates.filter(c => {
        const created = startOfDay(new Date(c.created_at));
        return created.getTime() === dayStart.getTime();
      }).length;

      return {
        date: day.toISOString(),
        count,
      };
    });
  }, [candidates, chartPeriod]);

  return (
    <MainLayout>
      <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Rekruttering Dashboard</h1>
        <p className="text-muted-foreground">Overblik over rekrutteringsaktiviteter</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sidste 24 timer</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{kpiStats.last24h}</div>
            <div className="flex items-center gap-1 text-xs">
              {kpiStats.trend24h !== 0 && (
                <span className={kpiStats.trend24h > 0 ? "text-green-500" : "text-red-500"}>
                  {kpiStats.trend24h > 0 ? "+" : ""}{kpiStats.trend24h}%
                </span>
              )}
              <span className="text-muted-foreground">vs. forrige 24t</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sidste 7 dage</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{kpiStats.last7d}</div>
            <div className="flex items-center gap-1 text-xs">
              {kpiStats.trend7d !== 0 && (
                <span className={kpiStats.trend7d > 0 ? "text-green-500" : "text-red-500"}>
                  {kpiStats.trend7d > 0 ? "+" : ""}{kpiStats.trend7d}%
                </span>
              )}
              <span className="text-muted-foreground">vs. forrige uge</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sidste 30 dage</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{kpiStats.last30d}</div>
            <div className="flex items-center gap-1 text-xs">
              {kpiStats.trend30d !== 0 && (
                <span className={kpiStats.trend30d > 0 ? "text-green-500" : "text-red-500"}>
                  {kpiStats.trend30d > 0 ? "+" : ""}{kpiStats.trend30d}%
                </span>
              )}
              <span className="text-muted-foreground">vs. forrige måned</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Planlagte samtaler</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{kpiStats.scheduledInterviews}</div>
            <p className="text-xs text-muted-foreground">Kommende interviews</p>
          </CardContent>
        </Card>
      </div>

      {/* Conversion Rate Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Salgskonsulent konvertering (30 dage)</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{conversionStats.sales.recentRate}%</div>
            <p className="text-xs text-muted-foreground">
              {conversionStats.sales.recentHired} af {conversionStats.sales.recentTotal} ansat (30d)
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Historisk: {conversionStats.sales.rate}% ({conversionStats.sales.hired}/{conversionStats.sales.total})
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Fieldmarketing konvertering (30 dage)</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{conversionStats.field.recentRate}%</div>
            <p className="text-xs text-muted-foreground">
              {conversionStats.field.recentHired} af {conversionStats.field.recentTotal} ansat (30d)
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Historisk: {conversionStats.field.rate}% ({conversionStats.field.hired}/{conversionStats.field.total})
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ghost Rate Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Salgskonsulent ghost % (30 dage)</CardTitle>
            <Ghost className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{conversionStats.sales.recentGhostRate}%</div>
            <p className="text-xs text-muted-foreground">
              {conversionStats.sales.recentGhosted} af {conversionStats.sales.recentTotal} ghostet (30d)
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Historisk: {conversionStats.sales.ghostRate}% ({conversionStats.sales.ghosted}/{conversionStats.sales.total})
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Fieldmarketing ghost % (30 dage)</CardTitle>
            <Ghost className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{conversionStats.field.recentGhostRate}%</div>
            <p className="text-xs text-muted-foreground">
              {conversionStats.field.recentGhosted} af {conversionStats.field.recentTotal} ghostet (30d)
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Historisk: {conversionStats.field.ghostRate}% ({conversionStats.field.ghosted}/{conversionStats.field.total})
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Anbefalinger KPI Section */}
      <ReferralKpiSection />

      {/* Funnel Visualization - Recharts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { label: "Salgskonsulent", data: conversionStats.sales },
          { label: "Fieldmarketing", data: conversionStats.field },
        ].map(({ label, data }) => {
          const COLORS: Record<string, string> = {
            new: "hsl(142 60% 75%)",
            contacted: "hsl(142 55% 60%)",
            interview_scheduled: "hsl(142 50% 45%)",
            hired: "hsl(142 70% 35%)",
            rejected: "hsl(0 55% 55%)",
            not_qualified: "hsl(0 40% 65%)",
            ghostet: "hsl(220 10% 60%)",
            declined: "hsl(220 10% 45%)",
          };

          const chartData = data.recentFunnelData.map((item) => ({
            ...item,
            pct: data.recentTotal > 0 ? Math.round((item.count / data.recentTotal) * 100) : 0,
            fill: COLORS[item.key] || "hsl(var(--muted-foreground) / 0.3)",
          }));

          return (
            <Card key={label} className="bg-card border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-foreground">{label} (30 dage)</CardTitle>
                  <span className="text-2xl font-bold text-foreground">{data.recentTotal} ansøgere</span>
                </div>
                <p className="text-xs text-muted-foreground">{data.recentHired} af {data.recentTotal} ansat ({data.recentRate}%)</p>
              </CardHeader>
              <CardContent>
                {chartData.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Ingen data</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} margin={{ top: 20, right: 5, left: -10, bottom: 5 }}>
                      <XAxis
                        dataKey="status"
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                        angle={-25}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis hide />
                      <Tooltip
                        cursor={{ fill: "hsl(var(--muted) / 0.5)" }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs shadow-xl">
                              <p className="font-medium text-foreground">{d.status}</p>
                              <p className="text-muted-foreground">{d.count} ({d.pct}%)</p>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={36}>
                        {chartData.map((entry) => (
                          <Cell key={entry.key} fill={entry.fill} />
                        ))}
                        <LabelList
                          dataKey="count"
                          position="top"
                          style={{ fontSize: 11, fontWeight: 600, fill: "hsl(var(--foreground))" }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

export default function RecruitmentDashboard() {

      {/* Applicants Over Time Chart */}
      <Card className="bg-card border-border">
        <CardHeader className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Ansøgninger over tid
            </CardTitle>
            <div className="flex gap-1 overflow-x-auto pb-1 -mb-1">
              {[
                { label: "30d", days: 30 },
                { label: "60d", days: 60 },
                { label: "90d", days: 90 },
                { label: "6m", days: 180 },
                { label: "12m", days: 365 },
              ].map((option) => (
                <Button
                  key={option.days}
                  variant={chartPeriod === option.days ? "default" : "outline"}
                  size="sm"
                  onClick={() => setChartPeriod(option.days)}
                  className="text-xs px-2 sm:px-3 shrink-0"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[200px] sm:h-[300px] w-full">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="applicantGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                tickFormatter={(value) => format(new Date(value), chartPeriod > 90 ? "MMM" : "d/M", { locale: da })}
                interval={chartPeriod > 90 ? "preserveStartEnd" : Math.floor(chartData.length / 4)}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                allowDecimals={false}
                width={30}
              />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                labelFormatter={(value) => format(new Date(value), "d. MMMM yyyy", { locale: da })}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#applicantGradient)"
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>



      </div>
    </MainLayout>
  );
}
