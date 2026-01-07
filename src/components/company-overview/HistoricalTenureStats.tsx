import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { differenceInDays, parseISO, subDays, format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { da } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Info, CalendarIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

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

// Period presets for filtering
type PeriodPreset = "all" | "last30" | "last90" | "last180" | "thisMonth" | "lastMonth" | "custom";

interface PeriodOption {
  label: string;
  value: PeriodPreset;
  getRange: () => { from: Date | null; to: Date };
}

const periodOptions: PeriodOption[] = [
  { 
    label: "Alle data", 
    value: "all", 
    getRange: () => ({ from: null, to: new Date() }) 
  },
  { 
    label: "Sidste 30 dage", 
    value: "last30", 
    getRange: () => ({ from: subDays(new Date(), 30), to: new Date() }) 
  },
  { 
    label: "Sidste 90 dage", 
    value: "last90", 
    getRange: () => ({ from: subDays(new Date(), 90), to: new Date() }) 
  },
  { 
    label: "Sidste 180 dage", 
    value: "last180", 
    getRange: () => ({ from: subDays(new Date(), 180), to: new Date() }) 
  },
  { 
    label: "Denne måned", 
    value: "thisMonth", 
    getRange: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) 
  },
  { 
    label: "Forrige måned", 
    value: "lastMonth", 
    getRange: () => ({ 
      from: startOfMonth(subMonths(new Date(), 1)), 
      to: endOfMonth(subMonths(new Date(), 1)) 
    }) 
  },
];

export function HistoricalTenureStats() {
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("all");
  const [customFrom, setCustomFrom] = useState<Date | undefined>(undefined);
  const [customTo, setCustomTo] = useState<Date | undefined>(undefined);

  // Calculate the active date range based on selection
  const dateRange = useMemo(() => {
    if (periodPreset === "custom") {
      return {
        from: customFrom || null,
        to: customTo || new Date(),
      };
    }
    const option = periodOptions.find(o => o.value === periodPreset);
    return option ? option.getRange() : { from: null, to: new Date() };
  }, [periodPreset, customFrom, customTo]);

  // Fetch historical employees (those who left)
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
  const allEmployeesRaw: CombinedEmployee[] = [
    ...(historicalData || []),
    ...(currentData || [])
  ];

  // Filter employees based on date range (for the detailed table)
  // We filter historical employees by their end_date, current employees are always included
  const filteredEmployees = useMemo(() => {
    return allEmployeesRaw.filter(emp => {
      if (emp.is_current) {
        // For current employees, filter by hire_date if a "from" date is set
        if (dateRange.from && emp.hire_date) {
          const hireDate = parseISO(emp.hire_date);
          return hireDate >= dateRange.from && hireDate <= dateRange.to;
        }
        return true;
      } else {
        // For historical employees, filter by end_date
        if (dateRange.from && emp.end_date) {
          const endDate = parseISO(emp.end_date);
          return endDate >= dateRange.from && endDate <= dateRange.to;
        }
        return !dateRange.from; // Include all if no "from" date
      }
    });
  }, [allEmployeesRaw, dateRange]);

  if (allEmployeesRaw.length === 0) {
    return null;
  }

  const historicalOnly = filteredEmployees.filter(e => !e.is_current);
  const currentOnly = filteredEmployees.filter(e => e.is_current);

  // Date boundaries for trend calculation (last 90 days vs previous 90 days)
  const now = new Date();
  const ninetyDaysAgo = subDays(now, 90);
  const oneEightyDaysAgo = subDays(now, 180);

  // Group by normalized team - ALL employees with trend data
  const teamStats = new Map<string, { 
    totalDays: number; 
    count: number; 
    churned30: number;
    churned60: number;
    currentCount: number;
    leftCount: number;
    // Trend: exits in last 90 days vs previous 90 days
    exits60Last90d: number;
    exits60Prev90d: number;
    leaversLast90d: number;
    leaversPrev90d: number;
  }>();
  
  filteredEmployees.forEach(emp => {
    if (!teamStats.has(emp.team_name)) {
      teamStats.set(emp.team_name, { 
        totalDays: 0, count: 0, churned30: 0, churned60: 0, 
        currentCount: 0, leftCount: 0,
        exits60Last90d: 0, exits60Prev90d: 0,
        leaversLast90d: 0, leaversPrev90d: 0
      });
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
      
      // Track trend data based on end_date
      if (emp.end_date) {
        const endDate = parseISO(emp.end_date);
        if (endDate >= ninetyDaysAgo) {
          stats.leaversLast90d++;
          if (emp.tenure_days <= 60) {
            stats.exits60Last90d++;
          }
        } else if (endDate >= oneEightyDaysAgo) {
          stats.leaversPrev90d++;
          if (emp.tenure_days <= 60) {
            stats.exits60Prev90d++;
          }
        }
      }
    }
  });

  // Teams to exclude from the overview
  const excludedTeams = ["Stab", "Ukendt"];

  // Calculate averages and churn rates with trends
  const teamChartData = Array.from(teamStats.entries())
    .filter(([team]) => !excludedTeams.includes(team))
    .map(([team, stats]) => {
      // Calculate trend: compare 60-day churn rate between periods
      const churnLast90d = stats.leaversLast90d > 0 
        ? (stats.exits60Last90d / stats.leaversLast90d) * 100 
        : 0;
      const churnPrev90d = stats.leaversPrev90d > 0 
        ? (stats.exits60Prev90d / stats.leaversPrev90d) * 100 
        : 0;
      const churnTrend = churnLast90d - churnPrev90d; // Negative = improvement
      
      return {
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
        // Trend data - actual rates for both periods
        churnTrend: Math.round(churnTrend * 10) / 10,
        churnLast90d: Math.round(churnLast90d * 10) / 10,
        churnPrev90d: Math.round(churnPrev90d * 10) / 10,
        exits60Last90d: stats.exits60Last90d,
        exits60Prev90d: stats.exits60Prev90d,
        leaversLast90d: stats.leaversLast90d,
        leaversPrev90d: stats.leaversPrev90d,
      };
    }).sort((a, b) => b.avgTenureDays - a.avgTenureDays);

  // Overall stats
  const totalEmployees = filteredEmployees.length;
  const totalCurrent = currentOnly.length;
  const totalLeft = historicalOnly.length;
  const totalDays = filteredEmployees.reduce((sum, e) => sum + e.tenure_days, 0);
  const avgTenureDays = totalEmployees > 0 ? Math.round(totalDays / totalEmployees) : 0;
  const avgTenureMonths = Math.round((avgTenureDays / 30) * 10) / 10;
  const churned30 = historicalOnly.filter(e => e.tenure_days <= 30).length;
  const churned60 = historicalOnly.filter(e => e.tenure_days <= 60).length;
  // Churn rate: % of ALL employees who left within 30/60 days
  const churnRate30 = totalEmployees > 0 ? Math.round((churned30 / totalEmployees) * 100 * 10) / 10 : 0;
  const churnRate60 = totalEmployees > 0 ? Math.round((churned60 / totalEmployees) * 100 * 10) / 10 : 0;
  
  // Overall trend
  const totalExits60Last90d = teamChartData.reduce((sum, t) => sum + t.exits60Last90d, 0);
  const totalExits60Prev90d = teamChartData.reduce((sum, t) => sum + t.exits60Prev90d, 0);
  const totalLeaversLast90d = teamChartData.reduce((sum, t) => sum + t.leaversLast90d, 0);
  const totalLeaversPrev90d = teamChartData.reduce((sum, t) => sum + t.leaversPrev90d, 0);
  const overallChurnLast90d = totalLeaversLast90d > 0 ? (totalExits60Last90d / totalLeaversLast90d) * 100 : 0;
  const overallChurnPrev90d = totalLeaversPrev90d > 0 ? (totalExits60Prev90d / totalLeaversPrev90d) * 100 : 0;
  const overallChurnTrend = Math.round((overallChurnLast90d - overallChurnPrev90d) * 10) / 10;
  const overallChurnLast90dRounded = Math.round(overallChurnLast90d * 10) / 10;
  const overallChurnPrev90dRounded = Math.round(overallChurnPrev90d * 10) / 10;

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
    count: filteredEmployees.filter(e => e.tenure_days >= bucket.min && e.tenure_days <= bucket.max).length,
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
                    <RechartsTooltip 
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
                    <RechartsTooltip 
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
                    <RechartsTooltip 
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
          <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <span>Detaljeret teamoversigt (alle ansatte)</span>
            <div className="flex flex-wrap items-center gap-2">
              <Select 
                value={periodPreset} 
                onValueChange={(value: PeriodPreset) => setPeriodPreset(value)}
              >
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Vælg periode" />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Brugerdefineret</SelectItem>
                </SelectContent>
              </Select>
              
              {periodPreset === "custom" && (
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "w-[130px] justify-start text-left font-normal",
                          !customFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customFrom ? format(customFrom, "dd/MM/yyyy") : "Fra"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customFrom}
                        onSelect={setCustomFrom}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <span className="text-muted-foreground">-</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "w-[130px] justify-start text-left font-normal",
                          !customTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customTo ? format(customTo, "dd/MM/yyyy") : "Til"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customTo}
                        onSelect={setCustomTo}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
              
              {dateRange.from && (
                <Badge variant="secondary" className="text-xs">
                  {format(dateRange.from, "dd/MM/yyyy", { locale: da })} - {format(dateRange.to, "dd/MM/yyyy", { locale: da })}
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">Nuværende</TableHead>
                <TableHead className="text-right">Stoppet</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Gns. anciennitet</TableHead>
                <TableHead className="text-right">30-dages churn</TableHead>
                <TableHead className="text-right">60-dages churn</TableHead>
                <TableHead className="text-right">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center justify-end gap-1 cursor-help">
                          Udvikling (3 mdr)
                          <Info className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="text-xs">
                          Sammenligner andelen af tidlige opsigelser (inden 60 dage) i de sidste 3 måneder med de foregående 3 måneder.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
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
                  <TableCell className="text-right">
                    {team.leftCount > 0 ? (
                      <Badge variant={team.churnRate30 > 20 ? "destructive" : team.churnRate30 > 10 ? "secondary" : "default"}>
                        {team.churnRate30}%
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {team.leftCount > 0 ? (
                      <Badge variant={team.churnRate60 > 30 ? "destructive" : team.churnRate60 > 20 ? "secondary" : "default"}>
                        {team.churnRate60}%
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {(team.leaversLast90d > 0 || team.leaversPrev90d > 0) ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className={`flex flex-col items-end text-sm cursor-help ${
                              team.churnTrend < 0 ? 'text-green-600' : 
                              team.churnTrend > 0 ? 'text-red-600' : 
                              'text-muted-foreground'
                            }`}>
                              <div className="flex items-center gap-1">
                                {team.churnTrend < 0 ? (
                                  <>
                                    <TrendingDown className="h-4 w-4 shrink-0" />
                                    <span className="font-medium">Forbedret</span>
                                  </>
                                ) : team.churnTrend > 0 ? (
                                  <>
                                    <TrendingUp className="h-4 w-4 shrink-0" />
                                    <span className="font-medium">Forværret</span>
                                  </>
                                ) : (
                                  <>
                                    <Minus className="h-4 w-4 shrink-0" />
                                    <span className="font-medium">Uændret</span>
                                  </>
                                )}
                              </div>
                              {team.churnTrend !== 0 && (
                                <span className="text-xs opacity-75">
                                  {team.churnTrend < 0 ? '' : '+'}{team.churnTrend} pp
                                </span>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-xs">
                            <div className="space-y-2 text-xs">
                              <p className="font-semibold">60-dages tidlig afgang</p>
                              
                              <div className="space-y-1 border-b pb-2">
                                <p className="font-medium">Sidste 3 mdr:</p>
                                <p className="text-muted-foreground text-[10px]">
                                  {format(subDays(new Date(), 90), "d. MMM", { locale: da })} - {format(new Date(), "d. MMM", { locale: da })}
                                </p>
                                <p>
                                  {team.exits60Last90d} af {team.leaversLast90d} stoppede inden 60 dage ({team.churnLast90d}%)
                                </p>
                              </div>
                              
                              <div className="space-y-1">
                                <p className="font-medium">Foregående 3 mdr:</p>
                                <p className="text-muted-foreground text-[10px]">
                                  {format(subDays(new Date(), 180), "d. MMM", { locale: da })} - {format(subDays(new Date(), 91), "d. MMM", { locale: da })}
                                </p>
                                <p>
                                  {team.exits60Prev90d} af {team.leaversPrev90d} stoppede inden 60 dage ({team.churnPrev90d}%)
                                </p>
                              </div>
                              
                              {team.churnTrend !== 0 && (
                                <p className={`pt-2 border-t font-medium ${team.churnTrend < 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  Ændring: {team.churnTrend < 0 ? '' : '+'}{team.churnTrend} procentpoint
                                </p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
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
                <TableCell className="text-right">
                  <Badge variant="destructive">{churnRate30}%</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="destructive">{churnRate60}%</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={`flex flex-col items-end text-sm cursor-help ${
                          overallChurnTrend < 0 ? 'text-green-600' : 
                          overallChurnTrend > 0 ? 'text-red-600' : 
                          'text-muted-foreground'
                        }`}>
                          <div className="flex items-center gap-1">
                            {overallChurnTrend < 0 ? (
                              <>
                                <TrendingDown className="h-4 w-4 shrink-0" />
                                <span className="font-medium">Forbedret</span>
                              </>
                            ) : overallChurnTrend > 0 ? (
                              <>
                                <TrendingUp className="h-4 w-4 shrink-0" />
                                <span className="font-medium">Forværret</span>
                              </>
                            ) : (
                              <>
                                <Minus className="h-4 w-4 shrink-0" />
                                <span className="font-medium">Uændret</span>
                              </>
                            )}
                          </div>
                          {overallChurnTrend !== 0 && (
                            <span className="text-xs opacity-75">
                              {overallChurnTrend < 0 ? '' : '+'}{overallChurnTrend} pp
                            </span>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-xs">
                        <div className="space-y-2 text-xs">
                          <p className="font-semibold">60-dages tidlig afgang (samlet)</p>
                          
                          <div className="space-y-1 border-b pb-2">
                            <p className="font-medium">Sidste 3 mdr:</p>
                            <p className="text-muted-foreground text-[10px]">
                              {format(subDays(new Date(), 90), "d. MMM", { locale: da })} - {format(new Date(), "d. MMM", { locale: da })}
                            </p>
                            <p>
                              {totalExits60Last90d} af {totalLeaversLast90d} stoppede inden 60 dage ({overallChurnLast90dRounded}%)
                            </p>
                          </div>
                          
                          <div className="space-y-1">
                            <p className="font-medium">Foregående 3 mdr:</p>
                            <p className="text-muted-foreground text-[10px]">
                              {format(subDays(new Date(), 180), "d. MMM", { locale: da })} - {format(subDays(new Date(), 91), "d. MMM", { locale: da })}
                            </p>
                            <p>
                              {totalExits60Prev90d} af {totalLeaversPrev90d} stoppede inden 60 dage ({overallChurnPrev90dRounded}%)
                            </p>
                          </div>
                          
                          {overallChurnTrend !== 0 && (
                            <p className={`pt-2 border-t font-medium ${overallChurnTrend < 0 ? 'text-green-600' : 'text-red-600'}`}>
                              Ændring: {overallChurnTrend < 0 ? '' : '+'}{overallChurnTrend} procentpoint
                            </p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
