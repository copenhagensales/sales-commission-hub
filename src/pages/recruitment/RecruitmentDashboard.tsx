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
  ArrowRight
} from "lucide-react";
import { format, subDays, eachDayOfInterval, startOfDay } from "date-fns";
import { da } from "date-fns/locale";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent 
} from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { Link } from "react-router-dom";

const chartConfig = {
  count: {
    label: "Ansøgninger",
    color: "hsl(var(--primary))",
  },
};

export default function RecruitmentDashboard() {
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

  const { data: recentApplications = [] } = useQuery({
    queryKey: ["recent-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("*, candidates(*)")
        .order("created_at", { ascending: false })
        .limit(5);
      
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

  const statusCounts = candidates.reduce((acc, candidate) => {
    acc[candidate.status] = (acc[candidate.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const newThisWeek = candidates.filter(c => {
    const created = new Date(c.created_at);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return created > weekAgo;
  }).length;

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
            <CardTitle className="text-sm font-medium text-muted-foreground">Total kandidater</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{candidates.length}</div>
            <p className="text-xs text-muted-foreground">
              +{newThisWeek} denne uge
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Nye ansøgninger</CardTitle>
            <UserPlus className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">{statusCounts.new || 0}</div>
            <p className="text-xs text-muted-foreground">Afventer kontakt</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Planlagte samtaler</CardTitle>
            <Calendar className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-400">{statusCounts.interview_scheduled || 0}</div>
            <p className="text-xs text-muted-foreground">Kommende interviews</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ansat i år</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">{statusCounts.hired || 0}</div>
            <p className="text-xs text-muted-foreground">Succesfulde ansættelser</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Communication Stats */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground flex items-center justify-between">
              Kommunikation (7 dage)
              <Link to="/recruitment/messages">
                <Button variant="ghost" size="sm">
                  Se alle <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <MessageSquare className="h-6 w-6 text-blue-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-blue-400">{communicationStats?.sms || 0}</div>
                <p className="text-xs text-muted-foreground">SMS</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <Mail className="h-6 w-6 text-purple-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-purple-400">{communicationStats?.email || 0}</div>
                <p className="text-xs text-muted-foreground">Emails</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <Phone className="h-6 w-6 text-green-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-400">{communicationStats?.call || 0}</div>
                <p className="text-xs text-muted-foreground">Opkald</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Applications */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground flex items-center justify-between">
              Seneste ansøgninger
              <Link to="/recruitment/candidates">
                <Button variant="ghost" size="sm">
                  Se alle <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentApplications.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Ingen ansøgninger endnu</p>
            ) : (
              <div className="space-y-3">
                {recentApplications.map((app: any) => (
                  <div key={app.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div>
                      <p className="font-medium text-foreground">
                        {app.candidates?.first_name} {app.candidates?.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">{app.role}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-xs">
                        {app.status}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(app.created_at), "d. MMM", { locale: da })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Overview */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Rekrutteringspipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-2">
            {[
              { status: "new", label: "Ny", color: "bg-blue-500" },
              { status: "contacted", label: "Kontaktet", color: "bg-yellow-500" },
              { status: "interview_scheduled", label: "Samtale planlagt", color: "bg-purple-500" },
              { status: "interviewed", label: "Samtale afholdt", color: "bg-cyan-500" },
              { status: "offer_sent", label: "Tilbud sendt", color: "bg-orange-500" },
              { status: "hired", label: "Ansat", color: "bg-green-500" },
            ].map((stage, idx) => (
              <div key={stage.status} className="flex-1 text-center">
                <div className={`h-2 ${stage.color} rounded-full mb-2`} />
                <div className="text-2xl font-bold text-foreground">
                  {statusCounts[stage.status] || 0}
                </div>
                <p className="text-xs text-muted-foreground">{stage.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Applicants Over Time Chart */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Ansøgninger over tid
            </CardTitle>
            <div className="flex gap-1">
              {[
                { label: "30 dage", days: 30 },
                { label: "60 dage", days: 60 },
                { label: "90 dage", days: 90 },
                { label: "6 mdr.", days: 180 },
                { label: "12 mdr.", days: 365 },
              ].map((option) => (
                <Button
                  key={option.days}
                  variant={chartPeriod === option.days ? "default" : "outline"}
                  size="sm"
                  onClick={() => setChartPeriod(option.days)}
                  className="text-xs"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                tickFormatter={(value) => format(new Date(value), chartPeriod > 90 ? "MMM" : "d. MMM", { locale: da })}
                interval={chartPeriod > 90 ? "preserveStartEnd" : Math.floor(chartData.length / 6)}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                allowDecimals={false}
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
