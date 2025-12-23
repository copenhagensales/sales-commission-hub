import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { format, subMonths, startOfMonth, endOfMonth, parseISO, differenceInDays } from "date-fns";
import { da } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

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

      // Fetch current employees
      const { data: currentEmployees, error: currError } = await supabase
        .from("employee_master_data")
        .select("id, employment_start_date, is_active");
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

      // Calculate churn for each month
      // For each month, we calculate: employees who started before end of month and left within 60 days
      const chartPoints = months.map(({ month, label }) => {
        const monthEnd = endOfMonth(month);
        const monthStart = startOfMonth(month);

        // Get all employees who had left by the end of this month
        const leaversUpToMonth = (historicalData || []).filter(emp => {
          const teamName = normalizeTeamName(emp.team_name);
          if (EXCLUDED_TEAMS.includes(teamName)) return false;
          if (!emp.end_date) return false;
          const endDate = parseISO(emp.end_date);
          return endDate <= monthEnd;
        });

        // Count total employees who had started by end of month (and subsequently left)
        const totalLeaversUpToMonth = leaversUpToMonth.length;

        // Count those who left within 60 days
        const exits60Days = leaversUpToMonth.filter(emp => emp.tenure_days <= 60).length;

        // Also include current employees who started before this month for total count
        const currentStartedBefore = (currentEmployees || []).filter(emp => {
          if (!emp.is_active) return false;
          const teamName = normalizeTeamName(employeeTeamMap.get(emp.id) || null);
          if (EXCLUDED_TEAMS.includes(teamName)) return false;
          if (!emp.employment_start_date) return false;
          const startDate = parseISO(emp.employment_start_date);
          return startDate <= monthEnd;
        }).length;

        const totalEmployees = totalLeaversUpToMonth + currentStartedBefore;
        const churnRate = totalEmployees > 0 ? (exits60Days / totalEmployees) * 100 : 0;

        return {
          month: label,
          churnRate: Math.round(churnRate * 10) / 10,
          exits60Days,
          totalEmployees
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

  const avgChurn = chartData && chartData.length > 0
    ? chartData.reduce((sum, d) => sum + d.churnRate, 0) / chartData.length
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>60-dages Churn Udvikling</CardTitle>
        <CardDescription>
          Andel af medarbejdere der stoppede inden for de første 60 dage — over de sidste 12 måneder
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
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
                formatter={(value: number, name: string, props: any) => [
                  `${value}%`,
                  "60-dages churn"
                ]}
                labelFormatter={(label) => label}
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const data = payload[0].payload;
                  return (
                    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                      <p className="font-medium text-foreground">{label}</p>
                      <p className="text-sm text-primary mt-1">
                        Churn: <span className="font-semibold">{data.churnRate}%</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {data.exits60Days} af {data.totalEmployees} stoppede inden 60 dage
                      </p>
                    </div>
                  );
                }}
              />
              <ReferenceLine 
                y={avgChurn} 
                stroke="hsl(var(--muted-foreground))" 
                strokeDasharray="5 5"
                label={{ 
                  value: `Gns: ${avgChurn.toFixed(1)}%`, 
                  position: "right",
                  fontSize: 11,
                  fill: "hsl(var(--muted-foreground))"
                }}
              />
              <Line 
                type="monotone" 
                dataKey="churnRate" 
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: "hsl(var(--primary))" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
