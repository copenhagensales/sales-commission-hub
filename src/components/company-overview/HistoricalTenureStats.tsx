import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { differenceInDays } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell, PieChart, Pie } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface HistoricalEmployee {
  id: string;
  employee_name: string;
  start_date: string;
  end_date: string;
  team_name: string;
  tenure_days: number;
}

// Normalize team names
const normalizeTeamName = (name: string): string => {
  const lower = name.toLowerCase().trim();
  if (lower.includes("eesy fm") || lower === "eesy fm") return "Eesy FM";
  if (lower.includes("eesy tm") || lower === "eesy tm") return "Eesy TM";
  if (lower.includes("fieldmarketing")) return "Fieldmarketing";
  if (lower.includes("relatel")) return "Relatel";
  if (lower.includes("tdc erhverv")) return "TDC Erhverv";
  if (lower.includes("united")) return "United";
  return name;
};

// Colors for teams
const TEAM_COLORS: Record<string, string> = {
  "Eesy FM": "#3b82f6",
  "Eesy TM": "#8b5cf6",
  "Fieldmarketing": "#10b981",
  "Relatel": "#f59e0b",
  "TDC Erhverv": "#ef4444",
  "United": "#6366f1",
};

export function HistoricalTenureStats() {
  const { data, isLoading } = useQuery({
    queryKey: ["historical-employment-stats"],
    queryFn: async () => {
      const { data: historicalData, error } = await supabase
        .from("historical_employment")
        .select("*");

      if (error) throw error;
      return historicalData as HistoricalEmployee[];
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Historisk data</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return null;
  }

  // Group by normalized team
  const teamStats = new Map<string, { totalDays: number; count: number; churned60: number }>();
  
  data.forEach(emp => {
    const normalizedTeam = normalizeTeamName(emp.team_name);
    if (!teamStats.has(normalizedTeam)) {
      teamStats.set(normalizedTeam, { totalDays: 0, count: 0, churned60: 0 });
    }
    const stats = teamStats.get(normalizedTeam)!;
    stats.totalDays += emp.tenure_days;
    stats.count++;
    if (emp.tenure_days <= 60) {
      stats.churned60++;
    }
  });

  // Calculate averages and churn rates
  const teamChartData = Array.from(teamStats.entries()).map(([team, stats]) => ({
    team,
    avgTenureDays: Math.round(stats.totalDays / stats.count),
    avgTenureMonths: Math.round((stats.totalDays / stats.count / 30) * 10) / 10,
    count: stats.count,
    churned60: stats.churned60,
    churnRate60: Math.round((stats.churned60 / stats.count) * 100 * 10) / 10,
  })).sort((a, b) => b.avgTenureDays - a.avgTenureDays);

  // Overall stats
  const totalEmployees = data.length;
  const totalDays = data.reduce((sum, e) => sum + e.tenure_days, 0);
  const avgTenureDays = Math.round(totalDays / totalEmployees);
  const avgTenureMonths = Math.round((avgTenureDays / 30) * 10) / 10;
  const churned60 = data.filter(e => e.tenure_days <= 60).length;
  const churnRate60 = Math.round((churned60 / totalEmployees) * 100 * 10) / 10;

  // Pie chart data for team distribution
  const pieData = teamChartData.map(t => ({
    name: t.team,
    value: t.count,
  }));

  // 60-day churn comparison chart
  const churnChartData = teamChartData.map(t => ({
    team: t.team,
    churnRate: t.churnRate60,
    count: t.churned60,
  })).sort((a, b) => b.churnRate - a.churnRate);

  // Tenure distribution (buckets)
  const tenureBuckets = [
    { label: "0-30 dage", min: 0, max: 30 },
    { label: "31-60 dage", min: 31, max: 60 },
    { label: "61-90 dage", min: 61, max: 90 },
    { label: "3-6 mdr", min: 91, max: 180 },
    { label: "6-12 mdr", min: 181, max: 365 },
    { label: "12+ mdr", min: 366, max: Infinity },
  ];
  
  const tenureDistribution = tenureBuckets.map(bucket => ({
    label: bucket.label,
    count: data.filter(e => e.tenure_days >= bucket.min && e.tenure_days <= bucket.max).length,
  }));

  return (
    <div className="space-y-6">
      {/* Overall Historical Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Historisk anciennitet (tidligere ansatte)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-3xl font-bold">{totalEmployees}</div>
              <div className="text-sm text-muted-foreground">Total historiske ansatte</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-3xl font-bold">{avgTenureMonths} mdr</div>
              <div className="text-sm text-muted-foreground">Gns. anciennitet</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-3xl font-bold text-red-600">{churnRate60}%</div>
              <div className="text-sm text-muted-foreground">60-dages churn</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-3xl font-bold">{churned60}</div>
              <div className="text-sm text-muted-foreground">Stoppede indenfor 60 dage</div>
            </div>
          </div>

          <Tabs defaultValue="tenure">
            <TabsList className="mb-4">
              <TabsTrigger value="tenure">Anciennitet per team</TabsTrigger>
              <TabsTrigger value="churn">60-dages churn</TabsTrigger>
              <TabsTrigger value="distribution">Fordeling</TabsTrigger>
            </TabsList>

            <TabsContent value="tenure">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={teamChartData} layout="vertical">
                    <XAxis type="number" unit=" mdr" />
                    <YAxis type="category" dataKey="team" width={100} />
                    <Tooltip 
                      formatter={(value: number) => [`${value} måneder`, "Gns. anciennitet"]}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))"
                      }}
                    />
                    <Bar dataKey="avgTenureMonths" name="Gns. anciennitet (mdr)">
                      {teamChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={TEAM_COLORS[entry.team] || "#888"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>

            <TabsContent value="churn">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={churnChartData} layout="vertical">
                    <XAxis type="number" unit="%" />
                    <YAxis type="category" dataKey="team" width={100} />
                    <Tooltip 
                      formatter={(value: number, name: string) => {
                        if (name === "churnRate") return [`${value}%`, "60-dages churn"];
                        return [value, name];
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))"
                      }}
                    />
                    <Bar dataKey="churnRate" name="60-dages churn (%)" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>

            <TabsContent value="distribution">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tenureDistribution}>
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number) => [value, "Antal"]}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))"
                      }}
                    />
                    <Bar dataKey="count" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Team breakdown table */}
      <Card>
        <CardHeader>
          <CardTitle>Detaljeret teamoversigt (historisk)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">Antal</TableHead>
                <TableHead className="text-right">Gns. anciennitet</TableHead>
                <TableHead className="text-right">60-dages exits</TableHead>
                <TableHead className="text-right">60-dages churn</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamChartData.map((team) => (
                <TableRow key={team.team}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: TEAM_COLORS[team.team] || "#888" }}
                      />
                      {team.team}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{team.count}</TableCell>
                  <TableCell className="text-right">{team.avgTenureMonths} mdr</TableCell>
                  <TableCell className="text-right">{team.churned60}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={team.churnRate60 > 30 ? "destructive" : team.churnRate60 > 20 ? "secondary" : "default"}>
                      {team.churnRate60}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold bg-muted/50">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{totalEmployees}</TableCell>
                <TableCell className="text-right">{avgTenureMonths} mdr</TableCell>
                <TableCell className="text-right">{churned60}</TableCell>
                <TableCell className="text-right">
                  <Badge variant="destructive">{churnRate60}%</Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
