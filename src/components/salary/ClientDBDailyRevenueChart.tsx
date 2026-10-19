import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";

interface DateAggregate {
  revenue: number;
  commission: number;
  sales: number;
}

interface Props {
  byDate: Record<string, DateAggregate>;
  /** 1 - vægtet forventet annulleringsprocent for perioden */
  cancellationFactor: number;
  isLoading: boolean;
  /** Gruppér pr. dag (standard) eller pr. måned */
  groupBy?: "day" | "month";
}

/** Brutto-omsætning pr. dag fra salg, kun fratrukket forventede annulleringer. */
export function ClientDBDailyRevenueChart({ byDate, cancellationFactor, isLoading, groupBy = "day" }: Props) {
  const data = useMemo(() => {
    const groups: Record<string, { revenue: number; sales: number }> = {};
    for (const [date, d] of Object.entries(byDate || {})) {
      const key = groupBy === "month" ? date.slice(0, 7) : date;
      const g = (groups[key] ||= { revenue: 0, sales: 0 });
      g.revenue += d.revenue;
      g.sales += d.sales;
    }
    return Object.entries(groups)
      .map(([key, g]) => ({
        date: key,
        label: groupBy === "month" ? format(parseISO(`${key}-01`), "MMM yy") : format(parseISO(key), "d/M"),
        omsaetning: Math.round(g.revenue * cancellationFactor),
        sales: g.sales,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [byDate, cancellationFactor, groupBy]);

  const total = data.reduce((s, d) => s + d.omsaetning, 0);
  const pct = Math.round((1 - cancellationFactor) * 1000) / 10;
  const fmt = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`);

  if (!isLoading && data.length === 0) return null;

  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            {groupBy === "month" ? "Omsætning pr. måned (brutto)" : "Omsætning pr. dag (brutto)"}
          </CardTitle>
          {!isLoading && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>
                Oms: <span className="text-foreground font-semibold">{total.toLocaleString("da-DK")} kr</span>
              </span>
              <span>Fratrukket forventet annullering: {pct.toLocaleString("da-DK")}%</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">Indlæser...</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={50} />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number) => [`${value.toLocaleString("da-DK")} kr`, "Omsætning"]}
                labelFormatter={(label: string, payload: { payload?: { sales?: number } }[]) => {
                  const sales = payload?.[0]?.payload?.sales;
                  return `${label}${sales != null ? ` · ${sales} salg` : ""}`;
                }}
              />
              <Bar dataKey="omsaetning" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} maxBarSize={40} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
