import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";
import { Target } from "lucide-react";
import type { ForecastVsActual } from "@/types/forecast";

interface Props {
  data: ForecastVsActual[];
}

export function ForecastVsActualChart({ data }: Props) {
  const chartData = data.map(d => ({
    ...d,
    name: d.period,
  }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          Forecast vs. Faktisk
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="forecastExpected" name="Forecast" fill="hsl(var(--primary))" opacity={0.3} radius={[4, 4, 0, 0]} />
              <Bar dataKey="actual" name="Faktisk" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.actual === 0 ? 'hsl(var(--muted))' : 'hsl(var(--primary))'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Accuracy table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="pb-1.5 text-left font-medium text-muted-foreground">Periode</th>
                <th className="pb-1.5 text-right font-medium text-muted-foreground">Forecast</th>
                <th className="pb-1.5 text-right font-medium text-muted-foreground">Faktisk</th>
                <th className="pb-1.5 text-right font-medium text-muted-foreground">Præcision</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.period} className="border-b last:border-0">
                  <td className="py-1.5">{row.period}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {row.forecastLow}-<strong>{row.forecastExpected}</strong>-{row.forecastHigh}
                  </td>
                  <td className="py-1.5 text-right tabular-nums font-medium">
                    {row.actual > 0 ? row.actual : '—'}
                  </td>
                  <td className="py-1.5 text-right">
                    {row.actual > 0 ? (
                      <Badge variant="outline" className={
                        row.accuracy >= 95 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        row.accuracy >= 90 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                        'bg-destructive/10 text-destructive border-destructive/20'
                      }>
                        {row.accuracy}%
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
