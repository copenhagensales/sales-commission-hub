import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import type { MonthlySummary } from "@/hooks/useFinanceSummary";

interface TrendChartProps {
  data: MonthlySummary[];
}

export function TrendChart({ data }: TrendChartProps) {
  const [showFixedCosts, setShowFixedCosts] = useState(true);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: 'DKK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      notation: 'compact',
    }).format(value);
  };

  const chartData = data.map(item => ({
    month: item.month,
    omsætning: item.revenue_actual,
    variableUdgifter: item.expenses_variable_actual,
    fasteUdgifter: item.expenses_fixed_planned,
    løn: item.salary,
    totalUdgifter: showFixedCosts 
      ? item.expenses_variable_actual + item.expenses_fixed_planned + item.salary
      : item.expenses_variable_actual + item.salary,
    indtjening: showFixedCosts ? item.profit : item.revenue_actual - item.expenses_variable_actual - item.salary,
  }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Trend over tid</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[400px] text-muted-foreground">
          Ingen data
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Trend over tid</CardTitle>
        <div className="flex items-center space-x-2">
          <Switch
            id="show-fixed"
            checked={showFixedCosts}
            onCheckedChange={setShowFixedCosts}
          />
          <Label htmlFor="show-fixed" className="text-sm">
            Vis faste udgifter
          </Label>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="month" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickFormatter={formatCurrency}
            />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="omsætning"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              dot={false}
              name="Omsætning"
            />
            <Line
              type="monotone"
              dataKey="totalUdgifter"
              stroke="hsl(var(--chart-2))"
              strokeWidth={2}
              dot={false}
              name="Udgifter"
            />
            <Line
              type="monotone"
              dataKey="indtjening"
              stroke="hsl(var(--chart-3))"
              strokeWidth={2}
              dot={false}
              name="Indtjening"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
