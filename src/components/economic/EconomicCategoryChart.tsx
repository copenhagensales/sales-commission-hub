import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface Props {
  data?: Record<string, number>;
}

const COLORS = [
  "hsl(221, 83%, 53%)",  // blue
  "hsl(262, 83%, 58%)",  // purple
  "hsl(316, 73%, 52%)",  // pink
  "hsl(0, 84%, 60%)",    // red
  "hsl(25, 95%, 53%)",   // orange
  "hsl(45, 93%, 47%)",   // amber
  "hsl(142, 76%, 36%)",  // green
  "hsl(173, 80%, 40%)",  // teal
  "hsl(199, 89%, 48%)",  // cyan
  "hsl(215, 20%, 65%)",  // gray
  "hsl(280, 65%, 60%)",  // violet
  "hsl(350, 80%, 55%)",  // rose
];

const formatDKK = (value: number) => {
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export function EconomicCategoryChart({ data }: Props) {
  const chartData = useMemo(() => {
    if (!data) return [];
    
    return Object.entries(data)
      .filter(([category]) => category !== "Omsætning")
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([category, amount], index) => ({
        category: category.length > 15 ? category.slice(0, 15) + "..." : category,
        fullCategory: category,
        amount,
        fill: COLORS[index % COLORS.length],
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
        <BarChart 
          data={chartData} 
          layout="vertical"
          margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
          <XAxis 
            type="number"
            tickFormatter={(value) => `${Math.round(value / 1000)}k`}
            className="text-xs"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis 
            type="category"
            dataKey="category"
            className="text-xs"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            width={75}
          />
          <Tooltip 
            formatter={(value: number) => formatDKK(value)}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.fullCategory || ""}
            contentStyle={{ 
              backgroundColor: 'hsl(var(--card))', 
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
          />
          <Bar dataKey="amount" name="Beløb" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
