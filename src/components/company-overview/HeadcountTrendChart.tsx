import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo } from "react";
import { endOfMonth, format, parseISO, startOfMonth, subMonths } from "date-fns";
import { da } from "date-fns/locale";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

/**
 * Viser antal ansatte pr. måned de sidste 12 måneder.
 * En medarbejder tælles med i en måned hvis:
 *   start_date <= månedens sidste dag OG (end_date er null ELLER end_date >= månedens sidste dag)
 * Kombinerer aktive medarbejdere (employee_master_data) og historiske (historical_employment).
 * Stab er ekskluderet for at matche resten af Virksomhedsoverblik.
 */
export function HeadcountTrendChart() {
  const { data: currentEmployees, isLoading: loadingCurrent } = useQuery({
    queryKey: ["headcount-trend-current"],
    queryFn: async () => {
      const { data: employees, error } = await supabase
        .from("employee_master_data")
        .select("id, employment_start_date, employment_end_date, job_title")
        .not("employment_start_date", "is", null);
      if (error) throw error;

      const { data: memberships } = await supabase
        .from("team_members")
        .select("employee_id, team:teams(name)");
      const teamMap = new Map<string, string>();
      (memberships || []).forEach((tm: any) => {
        if (tm.team?.name && !teamMap.has(tm.employee_id)) {
          teamMap.set(tm.employee_id, tm.team.name);
        }
      });

      return (employees || []).map((e: any) => ({
        id: e.id,
        start_date: e.employment_start_date as string,
        end_date: (e.employment_end_date as string | null) ?? null,
        team_name: teamMap.get(e.id) ?? e.job_title ?? null,
      }));
    },
  });

  const { data: historicalEmployees, isLoading: loadingHistorical } = useQuery({
    queryKey: ["headcount-trend-historical"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("historical_employment")
        .select("id, start_date, end_date, team_name");
      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        start_date: string;
        end_date: string | null;
        team_name: string | null;
      }>;
    },
  });

  const isLoading = loadingCurrent || loadingHistorical;

  const chartData = useMemo(() => {
    if (!currentEmployees || !historicalEmployees) return [];

    // Combine and dedupe by id (historical_employment kan indeholde nuværende, men vi
    // holder os til current for aktive og historical for stoppede — filtrér på end_date).
    const combined = [
      ...currentEmployees.map((e) => ({
        id: `curr-${e.id}`,
        start_date: e.start_date,
        end_date: e.end_date,
        team_name: e.team_name,
      })),
      ...historicalEmployees.map((e) => ({
        id: `hist-${e.id}`,
        start_date: e.start_date,
        end_date: e.end_date,
        team_name: e.team_name,
      })),
    ];

    const isStab = (t: string | null) =>
      (t ?? "").toLowerCase().includes("stab");

    const today = new Date();
    const months = Array.from({ length: 12 }, (_, i) => {
      const monthDate = subMonths(today, 11 - i);
      return {
        label: format(monthDate, "MMM yy", { locale: da }),
        monthStart: startOfMonth(monthDate),
        monthEnd: endOfMonth(monthDate),
      };
    });

    // Dedupliker: hvis samme reelle person findes både i current og historical, tæl kun én gang.
    // Vi har ikke fælles nøgle — brug (start_date + team_name) som best-effort.
    const seen = new Set<string>();
    const unique = combined.filter((e) => {
      const key = `${e.start_date}|${(e.team_name ?? "").toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return months.map(({ label, monthEnd }) => {
      const count = unique.filter((e) => {
        if (isStab(e.team_name)) return false;
        if (!e.start_date) return false;
        const start = parseISO(e.start_date);
        if (start > monthEnd) return false;
        if (e.end_date) {
          const end = parseISO(e.end_date);
          if (end < monthEnd) return false;
        }
        return true;
      }).length;
      return { month: label, count };
    });
  }, [currentEmployees, historicalEmployees]);

  const latest = chartData[chartData.length - 1]?.count ?? 0;
  const first = chartData[0]?.count ?? 0;
  const delta = latest - first;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Antal ansatte – sidste 12 måneder</CardTitle>
        <p className="text-sm text-muted-foreground">
          Reelt antal ansatte pr. månedsslut (ekskl. Stab).
          {!isLoading && chartData.length > 0 && (
            <>
              {" "}Nu: <span className="font-medium text-foreground">{latest}</span>
              {" · "}
              Ændring: <span className={`font-medium ${delta > 0 ? "text-green-500" : delta < 0 ? "text-red-500" : "text-foreground"}`}>
                {delta > 0 ? "+" : ""}{delta}
              </span>
            </>
          )}
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Indlæser...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="headcountFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                stroke="hsl(var(--border))"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                stroke="hsl(var(--border))"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                formatter={(value: number) => [`${value} ansatte`, "Antal"]}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#headcountFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
