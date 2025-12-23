import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { differenceInDays, parseISO } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface CombinedEmployee {
  id: string;
  full_name: string;
  team_name: string;
  hire_date: string;
  end_date: string | null;
  tenure_days: number;
  is_current: boolean;
}

// Normalize team names
const normalizeTeamName = (name: string | null): string => {
  if (!name) return "Ukendt";
  const lower = name.toLowerCase().trim();
  // Map "Eesy FM" to Fieldmarketing
  if (lower.includes("eesy fm") || lower === "eesy fm") return "Fieldmarketing";
  if (lower.includes("eesy tm") || lower === "eesy tm") return "Eesy TM";
  if (lower.includes("fieldmarketing")) return "Fieldmarketing";
  if (lower.includes("relatel")) return "Relatel";
  if (lower.includes("tdc erhverv")) return "TDC Erhverv";
  if (lower.includes("united")) return "United";
  return name;
};

// Colors for teams
const TEAM_COLORS: Record<string, string> = {
  "Eesy TM": "#8b5cf6",
  "Fieldmarketing": "#10b981",
  "Relatel": "#f59e0b",
  "TDC Erhverv": "#ef4444",
  "United": "#6366f1",
  "Ukendt": "#888888",
};

export function HistoricalTenureStats() {
  // Fetch historical employees (those who left)
  const { data: historicalData, isLoading: loadingHistorical } = useQuery({
    queryKey: ["historical-employment-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("historical_employment")
        .select("*");
      if (error) throw error;
      return (data || []).map(emp => ({
        id: emp.id,
        full_name: emp.employee_name,
        team_name: normalizeTeamName(emp.team_name),
        hire_date: emp.start_date,
        end_date: emp.end_date,
        tenure_days: emp.tenure_days,
        is_current: false
      })) as CombinedEmployee[];
    },
  });

  // Fetch current employees with team memberships via team_members junction table
  const { data: currentData, isLoading: loadingCurrent } = useQuery({
    queryKey: ["current-employees-tenure"],
    queryFn: async () => {
      // First get all active employees
      const { data: employees, error: empError } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, employment_start_date")
        .eq("is_active", true)
        .not("employment_start_date", "is", null);
      if (empError) throw empError;
      
      // Then get team memberships
      const { data: teamMemberships, error: tmError } = await supabase
        .from("team_members")
        .select("employee_id, team:teams(name)");
      if (tmError) throw tmError;
      
      // Create a map of employee_id to team name
      const employeeTeamMap = new Map<string, string>();
      (teamMemberships || []).forEach((tm: { employee_id: string; team: { name: string } | null }) => {
        if (tm.team?.name) {
          // Take first team if multiple
          if (!employeeTeamMap.has(tm.employee_id)) {
            employeeTeamMap.set(tm.employee_id, tm.team.name);
          }
        }
      });
      
      const today = new Date();
      return (employees || []).map(emp => {
        const hireDate = emp.employment_start_date ? parseISO(emp.employment_start_date) : today;
        const tenureDays = differenceInDays(today, hireDate);
        return {
          id: emp.id,
          full_name: `${emp.first_name} ${emp.last_name}`.trim(),
          team_name: normalizeTeamName(employeeTeamMap.get(emp.id) || null),
          hire_date: emp.employment_start_date || "",
          end_date: null,
          tenure_days: Math.max(0, tenureDays),
          is_current: true
        };
      }) as CombinedEmployee[];
    },
  });

  const isLoading = loadingHistorical || loadingCurrent;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Samlet anciennitetsdata</CardTitle>
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

  // Combine both datasets
  const allEmployees: CombinedEmployee[] = [
    ...(historicalData || []),
    ...(currentData || [])
  ];

  if (allEmployees.length === 0) {
    return null;
  }

  const historicalOnly = allEmployees.filter(e => !e.is_current);
  const currentOnly = allEmployees.filter(e => e.is_current);

  // Group by normalized team - ALL employees
  const teamStats = new Map<string, { 
    totalDays: number; 
    count: number; 
    churned30: number;
    churned60: number;
    currentCount: number;
    leftCount: number;
  }>();
  
  allEmployees.forEach(emp => {
    if (!teamStats.has(emp.team_name)) {
      teamStats.set(emp.team_name, { totalDays: 0, count: 0, churned30: 0, churned60: 0, currentCount: 0, leftCount: 0 });
    }
    const stats = teamStats.get(emp.team_name)!;
    stats.totalDays += emp.tenure_days;
    stats.count++;
    if (emp.is_current) {
      stats.currentCount++;
    } else {
      stats.leftCount++;
      // Count 30-day and 60-day churn for people who left
      if (emp.tenure_days <= 30) {
        stats.churned30++;
      }
      if (emp.tenure_days <= 60) {
        stats.churned60++;
      }
    }
  });

  // Teams to exclude from the overview
  const excludedTeams = ["Stab", "Ukendt"];

  // Calculate averages and churn rates
  const teamChartData = Array.from(teamStats.entries())
    .filter(([team]) => !excludedTeams.includes(team))
    .map(([team, stats]) => ({
      team,
      avgTenureDays: Math.round(stats.totalDays / stats.count),
      avgTenureMonths: Math.round((stats.totalDays / stats.count / 30) * 10) / 10,
      count: stats.count,
      currentCount: stats.currentCount,
      leftCount: stats.leftCount,
      churned30: stats.churned30,
      churned60: stats.churned60,
      // Churn rate: % of ALL employees (current + left) who left within 30/60 days
      churnRate30: stats.count > 0 ? Math.round((stats.churned30 / stats.count) * 100 * 10) / 10 : 0,
      churnRate60: stats.count > 0 ? Math.round((stats.churned60 / stats.count) * 100 * 10) / 10 : 0,
    })).sort((a, b) => b.avgTenureDays - a.avgTenureDays);

  // Overall stats
  const totalEmployees = allEmployees.length;
  const totalCurrent = currentOnly.length;
  const totalLeft = historicalOnly.length;
  const totalDays = allEmployees.reduce((sum, e) => sum + e.tenure_days, 0);
  const avgTenureDays = Math.round(totalDays / totalEmployees);
  const avgTenureMonths = Math.round((avgTenureDays / 30) * 10) / 10;
  const churned30 = historicalOnly.filter(e => e.tenure_days <= 30).length;
  const churned60 = historicalOnly.filter(e => e.tenure_days <= 60).length;
  // Churn rate: % of ALL employees who left within 30/60 days
  const churnRate30 = totalEmployees > 0 ? Math.round((churned30 / totalEmployees) * 100 * 10) / 10 : 0;
  const churnRate60 = totalEmployees > 0 ? Math.round((churned60 / totalEmployees) * 100 * 10) / 10 : 0;

  // 60-day churn comparison chart
  const churnChartData = teamChartData
    .filter(t => t.leftCount > 0)
    .map(t => ({
      team: t.team,
      churnRate: t.churnRate60,
      count: t.churned60,
    })).sort((a, b) => b.churnRate - a.churnRate);

  // Tenure distribution (buckets) - all employees
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
    count: allEmployees.filter(e => e.tenure_days >= bucket.min && e.tenure_days <= bucket.max).length,
    current: currentOnly.filter(e => e.tenure_days >= bucket.min && e.tenure_days <= bucket.max).length,
    left: historicalOnly.filter(e => e.tenure_days >= bucket.min && e.tenure_days <= bucket.max).length,
  }));

  return (
    <div className="space-y-6">
      {/* Overall Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Samlet anciennitet (nuværende + tidligere ansatte)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-3xl font-bold">{totalEmployees}</div>
              <div className="text-sm text-muted-foreground">Total ansatte</div>
            </div>
            <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/20">
              <div className="text-3xl font-bold text-green-600">{totalCurrent}</div>
              <div className="text-sm text-muted-foreground">Nuværende</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-3xl font-bold">{totalLeft}</div>
              <div className="text-sm text-muted-foreground">Stoppet</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-3xl font-bold">{avgTenureMonths} mdr</div>
              <div className="text-sm text-muted-foreground">Gns. anciennitet</div>
            </div>
            <div className="text-center p-4 bg-red-500/10 rounded-lg border border-red-500/20">
              <div className="text-3xl font-bold text-red-600">{churnRate60}%</div>
              <div className="text-sm text-muted-foreground">60-dages churn</div>
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
                      formatter={(value: number, name: string) => {
                        if (name === "avgTenureMonths") return [`${value} måneder`, "Gns. anciennitet"];
                        return [value, name];
                      }}
                      labelFormatter={(label) => {
                        const team = teamChartData.find(t => t.team === label);
                        if (team) {
                          return `${label} (${team.currentCount} nuværende, ${team.leftCount} stoppet)`;
                        }
                        return label;
                      }}
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
              <p className="text-sm text-muted-foreground mt-2">
                * Churn beregnes som andelen af stoppede medarbejdere der forlod inden for 60 dage
              </p>
            </TabsContent>

            <TabsContent value="distribution">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tenureDistribution}>
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number, name: string) => {
                        if (name === "current") return [value, "Nuværende"];
                        if (name === "left") return [value, "Stoppet"];
                        return [value, "Total"];
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))"
                      }}
                    />
                    <Bar dataKey="current" stackId="a" fill="#22c55e" name="Nuværende" />
                    <Bar dataKey="left" stackId="a" fill="#94a3b8" name="Stoppet" />
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
          <CardTitle>Detaljeret teamoversigt (alle ansatte)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">Nuværende</TableHead>
                <TableHead className="text-right">Stoppet</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Gns. anciennitet</TableHead>
                <TableHead className="text-right">30-dages exits</TableHead>
                <TableHead className="text-right">30-dages churn</TableHead>
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
                  <TableCell className="text-right text-green-600">{team.currentCount}</TableCell>
                  <TableCell className="text-right">{team.leftCount}</TableCell>
                  <TableCell className="text-right">{team.count}</TableCell>
                  <TableCell className="text-right">{team.avgTenureMonths} mdr</TableCell>
                  <TableCell className="text-right">{team.churned30}</TableCell>
                  <TableCell className="text-right">
                    {team.leftCount > 0 ? (
                      <Badge variant={team.churnRate30 > 20 ? "destructive" : team.churnRate30 > 10 ? "secondary" : "default"}>
                        {team.churnRate30}%
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{team.churned60}</TableCell>
                  <TableCell className="text-right">
                    {team.leftCount > 0 ? (
                      <Badge variant={team.churnRate60 > 30 ? "destructive" : team.churnRate60 > 20 ? "secondary" : "default"}>
                        {team.churnRate60}%
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold bg-muted/50">
                <TableCell>Total</TableCell>
                <TableCell className="text-right text-green-600">{totalCurrent}</TableCell>
                <TableCell className="text-right">{totalLeft}</TableCell>
                <TableCell className="text-right">{totalEmployees}</TableCell>
                <TableCell className="text-right">{avgTenureMonths} mdr</TableCell>
                <TableCell className="text-right">{churned30}</TableCell>
                <TableCell className="text-right">
                  <Badge variant="destructive">{churnRate30}%</Badge>
                </TableCell>
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
