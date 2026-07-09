import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from "recharts";
import { format, subMonths, startOfMonth, endOfMonth, parseISO, differenceInDays } from "date-fns";
import { da } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { ChurnChartStats, withMovingAverage } from "./ChurnChartStats";

const normalizeTeamName = (name: string | null): string => {
  if (!name) return "Ukendt";
  const lower = name.toLowerCase().trim();
  if (lower.includes("stab")) return "Stab";
  return name;
};

const EXCLUDED_TEAMS = ["Stab", "Ukendt"];

export function ChurnTrendChart() {
  const { data: chartData, isLoading } = useQuery({
    queryKey: ["churn-trend-chart-data"],
    queryFn: async () => {
      // Fetch all historical employment data
      const { data: historicalData, error: histError } = await supabase
        .from("historical_employment")
        .select("id, team_name, tenure_days, end_date, start_date");
      if (histError) throw histError;

      // Fetch all employees (active and inactive) from employee_master_data
      const { data: currentEmployees, error: currError } = await supabase
        .from("employee_master_data")
        .select("id, employment_start_date, employment_end_date, is_active");
      if (currError) throw currError;

      // Fetch team memberships
      const { data: teamMemberships, error: tmError } = await supabase
        .from("team_members")
        .select("employee_id, team:teams(name)");
      if (tmError) throw tmError;

      // Map employee_id to team name
      const employeeTeamMap = new Map<string, string>();
      (teamMemberships || []).forEach((tm: { employee_id: string; team: { name: string } | null }) => {
        if (tm.team?.name && !employeeTeamMap.has(tm.employee_id)) {
          employeeTeamMap.set(tm.employee_id, tm.team.name);
        }
      });

      // Generate last 12 months
      const months: { month: Date; label: string }[] = [];
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const monthDate = subMonths(now, i);
        months.push({
          month: monthDate,
          label: format(monthDate, "MMM yy", { locale: da })
        });
      }

      // Calculate cohort-based churn for each month
      // For each month: employees who STARTED in that month, and what % left within 60 days
      const chartPoints = months.map(({ month, label }) => {
        const monthEnd = endOfMonth(month);
        const monthStart = startOfMonth(month);

        // Find employees who STARTED in this specific month (from historical data - they've left)
        const historicalStartedInMonth = (historicalData || []).filter(emp => {
          const teamName = normalizeTeamName(emp.team_name);
          if (EXCLUDED_TEAMS.includes(teamName)) return false;
          if (!emp.start_date) return false;
          
          // Data quality validation
          const startDate = parseISO(emp.start_date);
          const now = new Date();
          if (startDate > now) return false; // Exclude future start dates
          if (emp.tenure_days < 0) return false; // Exclude negative tenure
          
          return startDate >= monthStart && startDate <= monthEnd;
        });

        // Find employees from employee_master_data who STARTED in this specific month
        const masterDataStartedInMonth = (currentEmployees || []).filter(emp => {
          const teamName = normalizeTeamName(employeeTeamMap.get(emp.id) || null);
          if (EXCLUDED_TEAMS.includes(teamName)) return false;
          if (!emp.employment_start_date) return false;
          const startDate = parseISO(emp.employment_start_date);
          
          // Data quality validation
          const now = new Date();
          if (startDate > now) return false; // Exclude future start dates
          
          return startDate >= monthStart && startDate <= monthEnd;
        });

        // Total employees who started in this month (cohort size)
        // Combine historical + master data, but avoid double-counting
        const cohortSize = historicalStartedInMonth.length + masterDataStartedInMonth.length;

        // Count exits within 60 days
        // From historical data
        const historicalExits60 = historicalStartedInMonth.filter(emp => emp.tenure_days <= 60).length;
        
        // From master data (inactive employees who left within 60 days)
        const masterDataExits60 = masterDataStartedInMonth.filter(emp => {
          if (emp.is_active) return false; // Still active, hasn't left
          if (!emp.employment_end_date) return false;
          const startDate = parseISO(emp.employment_start_date);
          const endDate = parseISO(emp.employment_end_date);
          const tenureDays = differenceInDays(endDate, startDate);
          return tenureDays >= 0 && tenureDays <= 60;
        }).length;

        const exits60Days = historicalExits60 + masterDataExits60;

        // Calculate churn rate for this cohort
        const churnRate = cohortSize > 0 ? (exits60Days / cohortSize) * 100 : 0;

        return {
          month: label,
          churnRate: Math.round(churnRate * 10) / 10,
          exits60Days,
          cohortSize
        };
      });

      return chartPoints;
    }
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>60-dages Churn Udvikling</CardTitle>
          <CardDescription>Udvikling over de sidste 12 måneder</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const rows = chartData ?? [];
  const withMA = withMovingAverage(rows, "churnMA");
  const avgChurn = rows.length > 0
    ? rows.reduce((sum, d) => sum + d.churnRate, 0) / rows.length
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>60-dages Churn Udvikling (Kohorte)</CardTitle>
        <CardDescription>
          Andel af nye medarbejdere i hver måned der stoppede inden for de første 60 dage
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChurnChartStats data={rows} label="churn" />
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={withMA} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="churnFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis
                tickFormatter={(value) => `${value}%`}
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
                domain={[0, 'auto']}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const data = payload[0].payload;
                  return (
                    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                      <p className="font-medium text-foreground">{label}</p>
                      <p className="text-sm text-primary mt-1">
                        Måned: <span className="font-semibold">{data.churnRate}%</span>
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        3-mdr snit: <span className="font-semibold">{data.churnMA}%</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {data.exits60Days} af {data.cohortSize} nye stoppede inden 60 dage
                      </p>
                    </div>
                  );
                }}
              />
              <Legend
                verticalAlign="top"
                height={28}
                iconType="line"
                formatter={(v) => v === "churnRate" ? "Månedlig" : "3-mdr snit"}
              />
              <ReferenceLine
                y={avgChurn}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="5 5"
                label={{
                  value: `12-mdr snit: ${avgChurn.toFixed(1)}%`,
                  position: "right",
                  fontSize: 11,
                  fill: "hsl(var(--muted-foreground))"
                }}
              />
              <Area
                type="monotone"
                dataKey="churnRate"
                stroke="hsl(var(--primary))"
                strokeOpacity={0.35}
                strokeWidth={1.5}
                fill="url(#churnFill)"
                dot={{ fill: "hsl(var(--primary))", r: 2.5, strokeWidth: 0, fillOpacity: 0.6 }}
                activeDot={{ r: 5, fill: "hsl(var(--primary))" }}
                name="churnRate"
              />
              <Line
                type="monotone"
                dataKey="churnMA"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 5 }}
                name="churnMA"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
