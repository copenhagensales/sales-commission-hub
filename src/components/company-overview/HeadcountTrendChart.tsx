import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo } from "react";
import { format, parseISO, startOfMonth, subMonths } from "date-fns";
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
import { useHeadcountMonthly } from "@/hooks/useHeadcount";

/**
 * Antal ansatte pr. måned (ekskl. Stab).
 * Tallene kommer fra get_headcount_monthly() — samme kilde som KPI-kortene på
 * Medarbejdere-siden. Deduplikering mellem employee_master_data og
 * historical_employment sker i databasen, så ingen person tælles to gange.
 * Data vises fra dec 2025, hvor løbende registrering begyndte.
 */
const TRUSTWORTHY_START = "2025-12-01";

export function HeadcountTrendChart() {
  const fromDate = useMemo(() => {
    const twelveMonthsAgo = format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-dd");
    return twelveMonthsAgo > TRUSTWORTHY_START ? twelveMonthsAgo : TRUSTWORTHY_START;
  }, []);

  const { data: monthly, isLoading } = useHeadcountMonthly(fromDate);

  const chartData = useMemo(
    () =>
      (monthly ?? []).map((m) => ({
        month: format(parseISO(m.monthEnd), "MMM yy", { locale: da }),
        count: m.headcountExclStaff,
      })),
    [monthly]
  );

  const latest = chartData[chartData.length - 1]?.count ?? 0;
  const first = chartData[0]?.count ?? 0;
  const delta = latest - first;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Antal ansatte – siden dec 2025</CardTitle>
        <p className="text-sm text-muted-foreground">
          Reelt antal ansatte pr. månedsslut (ekskl. Stab og kommende opstarter). Samme kilde som KPI-kortene under Medarbejdere.
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
