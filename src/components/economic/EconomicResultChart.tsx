import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

interface MonthData {
  omsaetning: number;
  udgifter: number;
  resultat: number;
}

interface Props {
  data?: Record<string, MonthData>;
}

const formatDKK = (value: number) => {
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export function EconomicResultChart({ data }: Props) {
  const chartData = useMemo(() => {
    if (!data) return [];
    
    return Object.entries(data)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, values]) => ({
        month: month.slice(5), // "01", "02", etc.
        label: new Date(month + "-01").toLocaleDateString("da-DK", { month: "short" }),
        ...values,
      }));
  }, [data]);
  
  if (!chartData.length) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        Ingen data
      </div>
    );
  }
  
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            dataKey="label" 
            className="text-xs"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis 
            tickFormatter={(value) => `${Math.round(value / 1000)}k`}
            className="text-xs"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />
          <Tooltip 
            formatter={(value: number) => formatDKK(value)}
            labelFormatter={(label) => `Måned: ${label}`}
            contentStyle={{ 
              backgroundColor: 'hsl(var(--card))', 
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
          />
          <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
          <Line 
            type="monotone" 
            dataKey="omsaetning" 
            stroke="hsl(142, 76%, 36%)" 
            strokeWidth={2}
            name="Omsætning"
            dot={{ fill: 'hsl(142, 76%, 36%)' }}
          />
          <Line 
            type="monotone" 
            dataKey="udgifter" 
            stroke="hsl(0, 84%, 60%)" 
            strokeWidth={2}
            name="Udgifter"
            dot={{ fill: 'hsl(0, 84%, 60%)' }}
          />
          <Line 
            type="monotone" 
            dataKey="resultat" 
            stroke="hsl(221, 83%, 53%)" 
            strokeWidth={3}
            name="Resultat"
            dot={{ fill: 'hsl(221, 83%, 53%)' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
