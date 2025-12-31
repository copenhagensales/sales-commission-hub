import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, subDays, differenceInMinutes } from "date-fns";
import { da } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  Phone,
  PhoneCall,
  PhoneOff,
  PhoneMissed,
  Clock,
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  Zap,
  Timer,
  BarChart3,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ComposedChart,
} from "recharts";

interface CallsAnalyticsProps {
  dateRange: { from: Date; to: Date };
}

const STATUS_COLORS: Record<string, string> = {
  ANSWERED: "#10b981",
  NO_ANSWER: "#f59e0b",
  BUSY: "#ef4444",
  FAILED: "#6b7280",
  OTHER: "#8b5cf6",
};

const STATUS_ICONS: Record<string, typeof Phone> = {
  ANSWERED: PhoneCall,
  NO_ANSWER: PhoneMissed,
  BUSY: PhoneOff,
  FAILED: PhoneOff,
  OTHER: Phone,
};

export function CallsAnalytics({ dateRange }: CallsAnalyticsProps) {
  const startISO = format(dateRange.from, "yyyy-MM-dd") + "T00:00:00";
  const endISO = format(dateRange.to, "yyyy-MM-dd") + "T23:59:59";

  // Fetch all calls in date range with pagination
  const { data: callsData, isLoading } = useQuery({
    queryKey: ["calls-analytics", startISO, endISO],
    queryFn: async () => {
      const allCalls: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("dialer_calls")
          .select(`
            id,
            external_id,
            dialer_name,
            integration_type,
            start_time,
            end_time,
            duration_seconds,
            total_duration_seconds,
            status,
            agent_external_id,
            agent_id,
            campaign_external_id,
            agents (id, name, email)
          `)
          .gte("start_time", startISO)
          .lte("start_time", endISO)
          .order("start_time", { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) throw error;
        if (data && data.length > 0) {
          allCalls.push(...data);
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }
      return allCalls;
    },
  });

  // Compute advanced analytics
  const analytics = useMemo(() => {
    if (!callsData || callsData.length === 0) return null;

    const totalCalls = callsData.length;
    
    // Status breakdown
    const statusCounts: Record<string, number> = {};
    callsData.forEach((c) => {
      const s = c.status || "OTHER";
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });
    
    const answeredCalls = statusCounts["ANSWERED"] || 0;
    const noAnswerCalls = statusCounts["NO_ANSWER"] || 0;
    const busyCalls = statusCounts["BUSY"] || 0;
    
    // Answer rate (key KPI)
    const answerRate = totalCalls > 0 ? (answeredCalls / totalCalls) * 100 : 0;
    
    // Duration analytics (only for answered calls)
    const answeredCallsData = callsData.filter((c) => c.status === "ANSWERED");
    const talkTimes = answeredCallsData.map((c) => c.duration_seconds || 0);
    const totalDurations = answeredCallsData.map((c) => c.total_duration_seconds || 0);
    
    const avgTalkTime = talkTimes.length > 0 ? talkTimes.reduce((a, b) => a + b, 0) / talkTimes.length : 0;
    const avgTotalDuration = totalDurations.length > 0 ? totalDurations.reduce((a, b) => a + b, 0) / totalDurations.length : 0;
    
    // Median talk time (more robust than mean)
    const sortedTalkTimes = [...talkTimes].sort((a, b) => a - b);
    const medianTalkTime = sortedTalkTimes.length > 0 
      ? sortedTalkTimes[Math.floor(sortedTalkTimes.length / 2)] 
      : 0;
    
    // P90 talk time (90th percentile)
    const p90Index = Math.floor(sortedTalkTimes.length * 0.9);
    const p90TalkTime = sortedTalkTimes[p90Index] || 0;
    
    // Total talk time
    const totalTalkTime = talkTimes.reduce((a, b) => a + b, 0);
    const totalTalkTimeHours = totalTalkTime / 3600;
    
    // Ring time (total - talk for answered calls)
    const avgRingTime = avgTotalDuration - avgTalkTime;
    
    // Calls by hour (heatmap data)
    const callsByHour: Record<number, { total: number; answered: number }> = {};
    for (let i = 0; i < 24; i++) {
      callsByHour[i] = { total: 0, answered: 0 };
    }
    callsData.forEach((c) => {
      const hour = parseISO(c.start_time).getHours();
      callsByHour[hour].total += 1;
      if (c.status === "ANSWERED") callsByHour[hour].answered += 1;
    });
    
    // Calls by day
    const callsByDay: Record<string, { total: number; answered: number; talkTime: number }> = {};
    callsData.forEach((c) => {
      const day = format(parseISO(c.start_time), "yyyy-MM-dd");
      if (!callsByDay[day]) {
        callsByDay[day] = { total: 0, answered: 0, talkTime: 0 };
      }
      callsByDay[day].total += 1;
      if (c.status === "ANSWERED") {
        callsByDay[day].answered += 1;
        callsByDay[day].talkTime += c.duration_seconds || 0;
      }
    });
    
    // Agent performance
    const agentStats: Record<string, { 
      name: string; 
      total: number; 
      answered: number; 
      talkTime: number;
      avgTalkTime: number;
    }> = {};
    
    callsData.forEach((c) => {
      const agentId = c.agent_id || c.agent_external_id || "unknown";
      const agentName = (c.agents as any)?.name || c.agent_external_id || "Unknown";
      
      if (!agentStats[agentId]) {
        agentStats[agentId] = { name: agentName, total: 0, answered: 0, talkTime: 0, avgTalkTime: 0 };
      }
      agentStats[agentId].total += 1;
      if (c.status === "ANSWERED") {
        agentStats[agentId].answered += 1;
        agentStats[agentId].talkTime += c.duration_seconds || 0;
      }
    });
    
    // Calculate avg talk time per agent
    Object.values(agentStats).forEach((agent) => {
      agent.avgTalkTime = agent.answered > 0 ? agent.talkTime / agent.answered : 0;
    });
    
    // Duration distribution buckets
    const durationBuckets = [
      { label: "0-30s", min: 0, max: 30, count: 0 },
      { label: "30s-1m", min: 30, max: 60, count: 0 },
      { label: "1-2m", min: 60, max: 120, count: 0 },
      { label: "2-5m", min: 120, max: 300, count: 0 },
      { label: "5-10m", min: 300, max: 600, count: 0 },
      { label: "10m+", min: 600, max: Infinity, count: 0 },
    ];
    
    answeredCallsData.forEach((c) => {
      const dur = c.duration_seconds || 0;
      const bucket = durationBuckets.find((b) => dur >= b.min && dur < b.max);
      if (bucket) bucket.count += 1;
    });
    
    // Dialer breakdown
    const dialerStats: Record<string, { total: number; answered: number }> = {};
    callsData.forEach((c) => {
      const dialer = c.dialer_name || "Unknown";
      if (!dialerStats[dialer]) {
        dialerStats[dialer] = { total: 0, answered: 0 };
      }
      dialerStats[dialer].total += 1;
      if (c.status === "ANSWERED") dialerStats[dialer].answered += 1;
    });
    
    return {
      totalCalls,
      answeredCalls,
      noAnswerCalls,
      busyCalls,
      answerRate,
      avgTalkTime,
      medianTalkTime,
      p90TalkTime,
      avgRingTime,
      totalTalkTimeHours,
      statusBreakdown: Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
        percentage: (count / totalCalls) * 100,
        color: STATUS_COLORS[status] || "#6b7280",
      })),
      callsByHour: Object.entries(callsByHour).map(([hour, data]) => ({
        hour: parseInt(hour),
        label: `${hour}:00`,
        ...data,
        answerRate: data.total > 0 ? (data.answered / data.total) * 100 : 0,
      })),
      callsByDay: Object.entries(callsByDay)
        .map(([date, data]) => ({
          date,
          label: format(parseISO(date), "dd MMM", { locale: da }),
          ...data,
          answerRate: data.total > 0 ? (data.answered / data.total) * 100 : 0,
          avgTalkTime: data.answered > 0 ? data.talkTime / data.answered : 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      agentLeaderboard: Object.entries(agentStats)
        .map(([id, stats]) => ({ id, ...stats, answerRate: stats.total > 0 ? (stats.answered / stats.total) * 100 : 0 }))
        .filter((a) => a.total >= 5)
        .sort((a, b) => b.answered - a.answered)
        .slice(0, 15),
      durationDistribution: durationBuckets,
      dialerBreakdown: Object.entries(dialerStats).map(([name, stats]) => ({
        name,
        ...stats,
        answerRate: stats.total > 0 ? (stats.answered / stats.total) * 100 : 0,
      })),
    };
  }, [callsData]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <Card className="p-8 text-center">
        <PhoneOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-medium mb-2">No Call Data</h3>
        <p className="text-sm text-muted-foreground">
          No calls found in the selected date range. Sync calls from Settings → Dialer Integrations.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Primary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <Card className="col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Phone className="h-4 w-4" />
              <span className="text-xs">Total Calls</span>
            </div>
            <div className="text-2xl font-bold">{analytics.totalCalls.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <PhoneCall className="h-4 w-4 text-green-500" />
              <span className="text-xs">Answered</span>
            </div>
            <div className="text-2xl font-bold text-green-600">{analytics.answeredCalls.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Target className="h-4 w-4 text-blue-500" />
              <span className="text-xs">Answer Rate</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">{analytics.answerRate.toFixed(1)}%</div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4 text-purple-500" />
              <span className="text-xs">Avg Talk</span>
            </div>
            <div className="text-2xl font-bold text-purple-600">{formatDuration(analytics.avgTalkTime)}</div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Timer className="h-4 w-4 text-orange-500" />
              <span className="text-xs">Median Talk</span>
            </div>
            <div className="text-2xl font-bold text-orange-600">{formatDuration(analytics.medianTalkTime)}</div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span className="text-xs">P90 Talk</span>
            </div>
            <div className="text-2xl font-bold text-yellow-600">{formatDuration(analytics.p90TalkTime)}</div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <PhoneMissed className="h-4 w-4 text-amber-500" />
              <span className="text-xs">No Answer</span>
            </div>
            <div className="text-2xl font-bold text-amber-600">{analytics.noAnswerCalls.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <BarChart3 className="h-4 w-4 text-cyan-500" />
              <span className="text-xs">Total Hours</span>
            </div>
            <div className="text-2xl font-bold text-cyan-600">{analytics.totalTalkTimeHours.toFixed(1)}h</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Daily Call Volume & Answer Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={analytics.callsByDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === "answerRate") return [`${value.toFixed(1)}%`, "Answer Rate"];
                      return [value, name === "total" ? "Total" : "Answered"];
                    }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="total" fill="hsl(var(--muted))" name="Total" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="left" dataKey="answered" fill="#10b981" name="Answered" radius={[4, 4, 0, 0]} />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="answerRate"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="answerRate"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Call Outcome Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] flex items-center">
              <div className="w-1/2">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={analytics.statusBreakdown}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      label={({ status, percentage }) => `${status} ${percentage.toFixed(0)}%`}
                      labelLine={false}
                    >
                      {analytics.statusBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => value.toLocaleString()} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-1/2 space-y-2">
                {analytics.statusBreakdown.map((item) => {
                  const Icon = STATUS_ICONS[item.status] || Phone;
                  return (
                    <div key={item.status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" style={{ color: item.color }} />
                        <span className="text-sm">{item.status}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-medium">{item.count.toLocaleString()}</span>
                        <span className="text-xs text-muted-foreground ml-1">({item.percentage.toFixed(1)}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Heatmap */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Hourly Call Pattern (Answer Rate)
            </CardTitle>
            <CardDescription className="text-xs">Best hours to reach contacts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.callsByHour.filter((h) => h.total > 0)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={1} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === "answerRate") return [`${value.toFixed(1)}%`, "Answer Rate"];
                      return [value, name];
                    }}
                  />
                  <Bar
                    dataKey="answerRate"
                    name="answerRate"
                    radius={[4, 4, 0, 0]}
                  >
                    {analytics.callsByHour.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.answerRate >= 50
                            ? "#10b981"
                            : entry.answerRate >= 40
                            ? "#f59e0b"
                            : "#ef4444"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Duration Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Timer className="h-4 w-4" />
              Talk Time Distribution
            </CardTitle>
            <CardDescription className="text-xs">Answered calls by duration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.durationDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Calls" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agent Leaderboard */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />
            Agent Performance (min. 5 calls)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky top-0 bg-background">#</TableHead>
                  <TableHead className="sticky top-0 bg-background">Agent</TableHead>
                  <TableHead className="sticky top-0 bg-background text-right">Total</TableHead>
                  <TableHead className="sticky top-0 bg-background text-right">Answered</TableHead>
                  <TableHead className="sticky top-0 bg-background text-right">Rate</TableHead>
                  <TableHead className="sticky top-0 bg-background text-right">Avg Talk</TableHead>
                  <TableHead className="sticky top-0 bg-background text-right">Total Talk</TableHead>
                  <TableHead className="sticky top-0 bg-background w-32">Performance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.agentLeaderboard.map((agent, idx) => (
                  <TableRow key={agent.id}>
                    <TableCell className="font-medium">{idx + 1}</TableCell>
                    <TableCell className="font-medium truncate max-w-[150px]" title={agent.name}>
                      {agent.name}
                    </TableCell>
                    <TableCell className="text-right">{agent.total}</TableCell>
                    <TableCell className="text-right text-green-600">{agent.answered}</TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={agent.answerRate >= 50 ? "default" : agent.answerRate >= 40 ? "secondary" : "destructive"}
                        className="text-xs"
                      >
                        {agent.answerRate.toFixed(0)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatDuration(agent.avgTalkTime)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {(agent.talkTime / 3600).toFixed(1)}h
                    </TableCell>
                    <TableCell>
                      <Progress
                        value={agent.answerRate}
                        className="h-2"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialer Breakdown */}
      {analytics.dialerBreakdown.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Dialer Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {analytics.dialerBreakdown.map((dialer) => (
                <div key={dialer.name} className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">{dialer.name}</h4>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-lg font-bold">{dialer.total}</div>
                      <div className="text-xs text-muted-foreground">Total</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-green-600">{dialer.answered}</div>
                      <div className="text-xs text-muted-foreground">Answered</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-blue-600">{dialer.answerRate.toFixed(0)}%</div>
                      <div className="text-xs text-muted-foreground">Rate</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
