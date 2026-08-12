import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo } from "react";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
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
import { useHeadcountMonthly } from "@/hooks/useHeadcount";

/**
 * Viser udviklingen i omsætning pr. medarbejder pr. måned.
 *
 * Kilder:
 *  - Omsætning: get_sales_aggregates RPC (bibelens autoritative kilde).
 *  - Antal medarbejdere: get_headcount_monthly() (ekskl. Stab) — samme kilde som
 *    HeadcountTrendChart og KPI-kortene under Medarbejdere.
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

  // Headcount pr. måned fra databasens ene sandhed.
  const { data: monthlyHeadcount } = useHeadcountMonthly(
    format(months[0]?.monthStart ?? today, "yyyy-MM-dd")
  );
  const headcountByMonth = useMemo(() => {
    const map = new Map<string, number>();
    (monthlyHeadcount ?? []).forEach((m) => {
      map.set(m.monthEnd.slice(0, 7), m.headcountExclStaff);
    });
    return map;
  }, [monthlyHeadcount]);

  // Månedlig omsætning — ét RPC-kald returnerer alle måneder samlet.
  const rangeStart = months[0]?.monthStart;
  const rangeEnd = months[months.length - 1]?.monthEnd;
  const { data: revenueByMonth, isLoading: loadingRevenue } = useQuery({
    queryKey: [
      "revenue-per-employee-monthly",
      rangeStart?.toISOString(),
      rangeEnd?.toISOString(),
    ],
    enabled: !!rangeStart && !!rangeEnd,
    queryFn: async () => {
      // p_end er eksklusiv i RPC'en — brug dagen efter sidste månedsslut.
      const end = new Date(rangeEnd!);
      end.setDate(end.getDate() + 1);
      const { data, error } = await (supabase.rpc as any)("get_monthly_revenue", {
        p_start: rangeStart!.toISOString(),
        p_end: end.toISOString(),
      });
      if (error) throw error;
      const byMonth = new Map<string, number>();
      ((data as any[]) || []).forEach((r) => {
        // month_start kommer som 'YYYY-MM-DD' — brug 'YYYY-MM' som nøgle.
        const key = String(r.month_start).slice(0, 7);
        byMonth.set(key, Number(r.revenue) || 0);
      });
      return months.map((m) => {
        const key = format(m.monthStart, "yyyy-MM");
        return { label: m.label, revenue: byMonth.get(key) ?? 0 };
      });
    },
  });


  const isLoading = loadingRevenue || !monthlyHeadcount;

  const chartData = useMemo(() => {
    if (!revenueByMonth || !monthlyHeadcount) return [];

    return months.map((m, idx) => {
      const headcount = headcountByMonth.get(format(m.monthStart, "yyyy-MM")) ?? 0;
      const revenue = revenueByMonth[idx]?.revenue ?? 0;
      const perEmployee = headcount > 0 ? Math.round(revenue / headcount) : 0;

      return {
        month: m.label,
        revenue,
        headcount,
        perEmployee,
      };
    });
  }, [months, revenueByMonth, monthlyHeadcount, headcountByMonth]);

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
