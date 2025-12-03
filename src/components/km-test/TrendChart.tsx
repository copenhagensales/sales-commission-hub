import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface MonthlySummary {
  month: string;
  revenue_actual: number;
  expenses_variable_actual: number;
  expenses_fixed_planned: number;
  salary: number;
  profit: number;
}

interface TrendChartProps {
  data: MonthlySummary[];
}

export function TrendChart({ data }: TrendChartProps) {
  const [includeFixed, setIncludeFixed] = useState(true);

  const chartData = data.map(item => ({
    month: item.month,
    'Omsætning': item.revenue_actual,
    'Variable udgifter': item.expenses_variable_actual,
    'Faste udgifter': includeFixed ? item.expenses_fixed_planned : 0,
    'Løn': item.salary,
    'Indtjening': includeFixed 
      ? item.profit 
      : item.revenue_actual - item.expenses_variable_actual - item.salary,
  }));

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }).format(value);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Trend (12-24 mdr)</CardTitle>
        <div className="flex items-center space-x-2">
          <Switch
            id="include-fixed"
            checked={includeFixed}
            onCheckedChange={setIncludeFixed}
          />
          <Label htmlFor="include-fixed">Inkl. faste udgifter</Label>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            Ingen data
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="month" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="Omsætning" 
                stroke="hsl(var(--chart-1))" 
                strokeWidth={2}
                dot={false}
              />
              <Line 
                type="monotone" 
                dataKey="Variable udgifter" 
                stroke="hsl(var(--chart-2))" 
                strokeWidth={2}
                dot={false}
              />
              {includeFixed && (
                <Line 
                  type="monotone" 
                  dataKey="Faste udgifter" 
                  stroke="hsl(var(--chart-3))" 
                  strokeWidth={2}
                  dot={false}
                />
              )}
              <Line 
                type="monotone" 
                dataKey="Indtjening" 
                stroke="hsl(var(--chart-4))" 
                strokeWidth={3}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
