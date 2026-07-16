import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo } from "react";
import { endOfMonth, format, parseISO, startOfMonth, subMonths } from "date-fns";
import { da } from "date-fns/locale";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

/**
 * Viser udviklingen i omsætning pr. medarbejder pr. måned.
 *
 * Kilder:
 *  - Omsætning: get_sales_aggregates RPC (bibelens autoritative kilde).
 *  - Antal medarbejdere: employee_master_data + historical_employment (ekskl. Stab),
 *    samme logik som HeadcountTrendChart.
 *
 * Vises fra dec 2025 (samme trustworthy start som headcount-grafen).
 */

const TRUSTWORTHY_START = new Date(2025, 11, 1);

type MonthPoint = {
  label: string;
  monthStart: Date;
  monthEnd: Date;
};

function buildMonths(today: Date): MonthPoint[] {
  const twelveMonthsAgo = startOfMonth(subMonths(today, 11));
  const startMonth = twelveMonthsAgo > TRUSTWORTHY_START ? twelveMonthsAgo : TRUSTWORTHY_START;
  const monthsBack =
    (today.getFullYear() - startMonth.getFullYear()) * 12 +
    (today.getMonth() - startMonth.getMonth());
  return Array.from({ length: monthsBack + 1 }, (_, i) => {
    const monthDate = subMonths(today, monthsBack - i);
    return {
      label: format(monthDate, "MMM yy", { locale: da }),
      monthStart: startOfMonth(monthDate),
      monthEnd: endOfMonth(monthDate),
    };
  });
}

export function RevenuePerEmployeeChart() {
  const today = useMemo(() => new Date(), []);
  const months = useMemo(() => buildMonths(today), [today]);

  // Headcount-data (samme kilde som HeadcountTrendChart)
  const { data: currentEmployees } = useQuery({
    queryKey: ["headcount-trend-current"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, employment_start_date, employment_end_date, is_staff_employee")
        .eq("is_staff_employee", false)
        .not("employment_start_date", "is", null);
      if (error) throw error;
      return (data || []).map((e: any) => ({
        start_date: e.employment_start_date as string,
        end_date: (e.employment_end_date as string | null) ?? null,
      }));
    },
  });

  const { data: historicalEmployees } = useQuery({
    queryKey: ["headcount-trend-historical"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("historical_employment")
        .select("id, start_date, end_date, team_name");
      if (error) throw error;
      return (data || [])
        .filter((e: any) => !(e.team_name ?? "").toLowerCase().includes("stab"))
        .map((e: any) => ({
          start_date: e.start_date as string,
          end_date: (e.end_date as string | null) ?? null,
        }));
    },
  });

  // Månedlig omsætning — én RPC pr. måned, parallelt.
  const { data: revenueByMonth, isLoading: loadingRevenue } = useQuery({
    queryKey: ["revenue-per-employee-monthly", months.map((m) => m.label).join("|")],
    queryFn: async () => {
      const results = await Promise.all(
        months.map(async (m) => {
          // For nuværende måned: cut off ved dags dato.
          const end = m.monthEnd > today ? today : m.monthEnd;
          const { data, error } = await supabase.rpc("get_sales_aggregates", {
            p_start: m.monthStart.toISOString(),
            p_end: end.toISOString(),
            p_team_id: null,
            p_employee_id: null,
            p_client_id: null,
          });
          if (error) throw error;
          const row = (data as any)?.[0];
          return {
            label: m.label,
            revenue: Number(row?.total_revenue) || 0,
          };
        })
      );
      return results;
    },
  });

  const isLoading = loadingRevenue || !currentEmployees || !historicalEmployees;

  const chartData = useMemo(() => {
    if (!revenueByMonth || !currentEmployees || !historicalEmployees) return [];

    const combined = [...currentEmployees, ...historicalEmployees];

    return months.map((m, idx) => {
      const cutoff = m.monthEnd > today ? today : m.monthEnd;
      const headcount = combined.filter((e) => {
        if (!e.start_date) return false;
        const start = parseISO(e.start_date);
        if (start > cutoff) return false;
        if (e.end_date) {
          const end = parseISO(e.end_date);
          if (end < cutoff) return false;
        }
        return true;
      }).length;

      const revenue = revenueByMonth[idx]?.revenue ?? 0;
      const perEmployee = headcount > 0 ? Math.round(revenue / headcount) : 0;

      return {
        month: m.label,
        revenue,
        headcount,
        perEmployee,
      };
    });
  }, [months, revenueByMonth, currentEmployees, historicalEmployees, today]);

  const latest = chartData[chartData.length - 1]?.perEmployee ?? 0;
  const first = chartData[0]?.perEmployee ?? 0;
  const delta = latest - first;
  const deltaPct = first > 0 ? (delta / first) * 100 : 0;

  const fmtKr = (n: number) =>
    new Intl.NumberFormat("da-DK", {
      style: "currency",
      currency: "DKK",
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Omsætning pr. medarbejder – siden dec 2025</CardTitle>
        <p className="text-sm text-muted-foreground">
          Månedlig omsætning (ekskl. Field Marketing i omsætningskilden) delt med antal ansatte (ekskl. Stab) pr. månedsslut.
          {!isLoading && chartData.length > 1 && (
            <>
              {" "}Nu: <span className="font-medium text-foreground">{fmtKr(latest)}</span>
              {" · "}
              Ændring: <span className={`font-medium ${delta > 0 ? "text-green-500" : delta < 0 ? "text-red-500" : "text-foreground"}`}>
                {delta > 0 ? "+" : ""}{fmtKr(delta)} ({deltaPct > 0 ? "+" : ""}{deltaPct.toFixed(1)}%)
              </span>
            </>
          )}
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[320px] flex items-center justify-center text-muted-foreground">
            Indlæser...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                stroke="hsl(var(--border))"
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                stroke="hsl(var(--border))"
                tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                stroke="hsl(var(--border))"
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                formatter={(value: number, name: string) => {
                  if (name === "Omsætning pr. medarbejder") return [fmtKr(value), name];
                  if (name === "Antal ansatte") return [`${value}`, name];
                  return [fmtKr(value), name];
                }}
              />
              <Legend />
              <Bar
                yAxisId="right"
                dataKey="headcount"
                name="Antal ansatte"
                fill="hsl(var(--muted-foreground) / 0.25)"
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="perEmployee"
                name="Omsætning pr. medarbejder"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                dot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
