import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { BarChart3 } from "lucide-react";
import type { ForecastResult } from "@/types/forecast";

interface Props {
  forecast: ForecastResult;
}

export function ForecastWaterfallChart({ forecast }: Props) {
  const estSales = forecast.establishedEmployees.reduce((s, e) => s + e.forecastSales + (e.actualSales || 0), 0);
  const estChurnLoss = forecast.establishedChurnLoss || 0;
  const grossEstablished = estSales + estChurnLoss + forecast.absenceLoss;
  const cohortSales = forecast.cohorts.reduce((s, c) => s + c.forecastSales, 0);

  const data = [
    {
      name: "Brutto-kapacitet",
      value: grossEstablished,
      fill: "hsl(var(--primary))",
      isTotal: true,
    },
    {
      name: "Fravær",
      value: -forecast.absenceLoss,
      fill: "hsl(var(--destructive))",
      isTotal: false,
    },
    {
      name: "Churn-risiko",
      value: -estChurnLoss,
      fill: "hsl(var(--destructive))",
      isTotal: false,
    },
    ...(cohortSales > 0 ? [{
      name: "Nye hold",
      value: cohortSales,
      fill: "hsl(142, 71%, 45%)",
      isTotal: false,
    }] : []),
    {
      name: "Forventet",
      value: forecast.totalSalesExpected,
      fill: "hsl(var(--primary))",
      isTotal: true,
    },
  ];

  // Compute running total for waterfall positioning
  let runningTotal = 0;
  const waterfallData = data.map((d) => {
    if (d.isTotal) {
      const result = { ...d, base: 0, top: d.value };
      runningTotal = d.value;
      return result;
    }
    const base = runningTotal;
    runningTotal += d.value;
    return {
      ...d,
      base: d.value >= 0 ? base : base + d.value,
      top: Math.abs(d.value),
    };
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          Forecast-opbygning
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={waterfallData} barCategoryGap="20%">
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12 }}
            />
            <YAxis hide />
            <Tooltip
              formatter={(value: number, _name: string, props: any) => {
                const entry = props.payload;
                const display = entry.isTotal ? entry.value : entry.value;
                return [`${display > 0 ? '+' : ''}${display.toLocaleString('da-DK')} salg`, ''];
              }}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
            />
            {/* Invisible base bar */}
            <Bar dataKey="base" stackId="waterfall" fill="transparent" />
            {/* Visible value bar */}
            <Bar dataKey="top" stackId="waterfall" radius={[4, 4, 0, 0]}>
              {waterfallData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
