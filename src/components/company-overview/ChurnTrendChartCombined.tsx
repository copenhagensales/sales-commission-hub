import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, subMonths, startOfMonth, endOfMonth, parseISO, differenceInDays } from "date-fns";
import { da } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

const normalizeTeamName = (name: string | null): string => {
  if (!name) return "Ukendt";
  const lower = name.toLowerCase().trim();
  if (lower.includes("stab")) return "Stab";
  if (lower.includes("united")) return "United";
  if (lower.includes("eesy")) return "Eesy TM";
  return name;
};

const INCLUDED_TEAMS = ["United", "Eesy TM"];

export function ChurnTrendChartCombined() {
  const { data: chartData, isLoading } = useQuery({
    queryKey: ["churn-trend-chart-combined-data"],
    queryFn: async () => {
      const { data: historicalData, error: histError } = await supabase
        .from("historical_employment")
        .select("id, team_name, tenure_days, end_date, start_date");
      if (histError) throw histError;

      const { data: currentEmployees, error: currError } = await supabase
        .from("employee_master_data")
        .select("id, employment_start_date, employment_end_date, is_active");
      if (currError) throw currError;

      const { data: teamMemberships, error: tmError } = await supabase
        .from("team_members")
        .select("employee_id, team:teams(name)");
      if (tmError) throw tmError;

      const employeeTeamMap = new Map<string, string>();
      (teamMemberships || []).forEach((tm: { employee_id: string; team: { name: string } | null }) => {
        if (tm.team?.name && !employeeTeamMap.has(tm.employee_id)) {
          employeeTeamMap.set(tm.employee_id, tm.team.name);
        }
      });

      const months: { month: Date; label: string }[] = [];
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const monthDate = subMonths(now, i);
        months.push({
          month: monthDate,
          label: format(monthDate, "MMM yy", { locale: da })
        });
      }

      const chartPoints = months.map(({ month, label }) => {
        const monthEnd = endOfMonth(month);
        const monthStart = startOfMonth(month);

        const historicalStartedInMonth = (historicalData || []).filter(emp => {
          const teamName = normalizeTeamName(emp.team_name);
          if (!INCLUDED_TEAMS.includes(teamName)) return false;
          if (!emp.start_date) return false;
          const startDate = parseISO(emp.start_date);
          if (startDate > now) return false;
          if (emp.tenure_days < 0) return false;
          return startDate >= monthStart && startDate <= monthEnd;
        });

        const masterDataStartedInMonth = (currentEmployees || []).filter(emp => {
          const teamName = normalizeTeamName(employeeTeamMap.get(emp.id) || null);
          if (!INCLUDED_TEAMS.includes(teamName)) return false;
          if (!emp.employment_start_date) return false;
          const startDate = parseISO(emp.employment_start_date);
          if (startDate > now) return false;
          return startDate >= monthStart && startDate <= monthEnd;
        });

        const cohortSize = historicalStartedInMonth.length + masterDataStartedInMonth.length;

        // 30-day exits
        const historicalExits30 = historicalStartedInMonth.filter(emp => emp.tenure_days <= 30).length;
        const masterDataExits30 = masterDataStartedInMonth.filter(emp => {
          if (emp.is_active) return false;
          if (!emp.employment_end_date) return false;
          const startDate = parseISO(emp.employment_start_date);
          const endDate = parseISO(emp.employment_end_date);
          const tenureDays = differenceInDays(endDate, startDate);
          return tenureDays >= 0 && tenureDays <= 30;
        }).length;
        const exits30Days = historicalExits30 + masterDataExits30;

        // 60-day exits
        const historicalExits60 = historicalStartedInMonth.filter(emp => emp.tenure_days <= 60).length;
        const masterDataExits60 = masterDataStartedInMonth.filter(emp => {
          if (emp.is_active) return false;
          if (!emp.employment_end_date) return false;
          const startDate = parseISO(emp.employment_start_date);
          const endDate = parseISO(emp.employment_end_date);
          const tenureDays = differenceInDays(endDate, startDate);
          return tenureDays >= 0 && tenureDays <= 60;
        }).length;
        const exits60Days = historicalExits60 + masterDataExits60;

        const churnRate30 = cohortSize > 0 ? (exits30Days / cohortSize) * 100 : 0;
        const churnRate60 = cohortSize > 0 ? (exits60Days / cohortSize) * 100 : 0;

        return {
          month: label,
          churnRate30: Math.round(churnRate30 * 10) / 10,
          churnRate60: Math.round(churnRate60 * 10) / 10,
          exits30Days,
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
          <CardTitle>Churn Udvikling – United & Eesy TM</CardTitle>
          <CardDescription>30 og 60 dages kohorte-churn</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Churn Udvikling – United & Eesy TM</CardTitle>
        <CardDescription>
          Andel af nye medarbejdere der stoppede inden for 30 og 60 dage
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
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const data = payload[0].payload;
                  return (
                    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                      <p className="font-medium text-foreground">{label}</p>
                      <p className="text-sm mt-1" style={{ color: "hsl(var(--primary))" }}>
                        30-dages: <span className="font-semibold">{data.churnRate30}%</span>
                        <span className="text-xs text-muted-foreground ml-1">
                          ({data.exits30Days}/{data.cohortSize})
                        </span>
                      </p>
                      <p className="text-sm mt-1" style={{ color: "hsl(25, 95%, 53%)" }}>
                        60-dages: <span className="font-semibold">{data.churnRate60}%</span>
                        <span className="text-xs text-muted-foreground ml-1">
                          ({data.exits60Days}/{data.cohortSize})
                        </span>
                      </p>
                    </div>
                  );
                }}
              />
              <Legend 
                verticalAlign="top" 
                height={36}
                formatter={(value) => value === "churnRate30" ? "30-dages churn" : "60-dages churn"}
              />
              <Line 
                type="monotone" 
                dataKey="churnRate30" 
                name="churnRate30"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: "hsl(var(--primary))" }}
              />
              <Line 
                type="monotone" 
                dataKey="churnRate60" 
                name="churnRate60"
                stroke="hsl(25, 95%, 53%)"
                strokeWidth={2}
                dot={{ fill: "hsl(25, 95%, 53%)", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: "hsl(25, 95%, 53%)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
